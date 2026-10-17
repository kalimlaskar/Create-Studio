import { beforeAll, describe, expect, it } from 'vitest';
import { cleanQuery, emailFrom, normalizeInteractions, resolveTemplate, toPublicInteractions, validateAnswers, type FormInteraction } from '@/lib/videos/interactions';
import { readLead, signLead } from '@/lib/videos/access';
import { hubspotBody } from '@/lib/leads/forward';

beforeAll(() => { process.env.VIDEO_ACCESS_SECRET = 'test-secret-for-lead-tokens'; });

const form = (change: Record<string, unknown> = {}) => ({
    id: 'gate1234',
    type: 'form',
    placement: 'start',
    title: 'Before you watch',
    fields: [
        { name: 'email', label: 'Work email', type: 'email', required: true },
        { name: 'company', label: 'Company', type: 'text', required: false },
        { name: 'team', label: 'Team size', type: 'select', required: false, options: ['1-10', '11-50'] },
    ],
    hidden: [{ name: 'utm_source', value: '{utm_source}' }, { name: 'lead_source', value: 'video:{video_title}' }],
    destination: { kind: 'hubspot', portalId: '12345678', formId: '1a2b3c4d-1234-4abc-8def-0123456789ab' },
    ...change,
});

describe('saving forms, buttons and bookings', () => {
    it('accepts a gate form and sorts everything by when it appears', () => {
        const result = normalizeInteractions([
            { id: 'end12345', type: 'button', placement: 'end', label: 'Book a demo', url: 'https://cal.com/me' },
            { id: 'mid12345', type: 'booking', placement: 'time', atMs: 30_000, url: 'https://calendly.com/me/30min' },
            form(),
        ], 60_000);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.interactions.map((item) => item.id)).toEqual(['gate1234', 'mid12345', 'end12345']);
    });

    it('rejects what would break the player or the submission', () => {
        expect(normalizeInteractions([form(), form({ id: 'gate5678' })], 60_000)).toMatchObject({ ok: false, error: 'Only one form can appear before the video.' });
        expect(normalizeInteractions([{ id: 'btn12345', type: 'button', placement: 'start', label: 'Hi', url: 'https://a.com' }], 60_000)).toMatchObject({ ok: false });
        expect(normalizeInteractions([form({ placement: 'time', atMs: 90_000 })], 60_000)).toMatchObject({ ok: false });
        expect(normalizeInteractions([form({ hidden: [{ name: 'email', value: 'x' }] })], 60_000)).toMatchObject({ ok: false });
        expect(normalizeInteractions([form({ fields: [{ name: 'bad name', label: 'Bad', type: 'text' }] })], 60_000)).toMatchObject({ ok: false });
        expect(normalizeInteractions([form({ destination: { kind: 'hubspot', portalId: 'abc', formId: 'x' } })], 60_000)).toMatchObject({ ok: false });
        expect(normalizeInteractions([form({ destination: { kind: 'url', url: 'http://insecure.com' } })], 60_000)).toMatchObject({ ok: false });
    });

    it('never sends hidden templates or destinations to viewers', () => {
        const result = normalizeInteractions([form()], 60_000);
        if (!result.ok) throw new Error(result.error);
        const [publicForm] = toPublicInteractions(result.interactions);
        expect(publicForm).not.toHaveProperty('hidden');
        expect(publicForm).not.toHaveProperty('destination');
        expect(JSON.stringify(publicForm)).not.toContain('12345678');
    });
});

describe('hidden fields', () => {
    const context = {
        query: cleanQuery({ utm_source: 'linkedin', utm_campaign: 'q4', ref: 'nl', 'bad key!': 'x', long: 'y'.repeat(1000) }),
        referrer: 'https://www.linkedin.com/',
        pageUrl: 'https://cliprame.app/v/abc?utm_source=linkedin',
        videoTitle: 'Q4 pricing',
        videoId: 'v1',
        linkName: 'Ana Lopez',
        linkEmail: 'ana@acme.com',
        linkCompany: 'Acme',
        source: 'share' as const,
        now: new Date('2026-10-17T10:00:00Z'),
    };

    it('fills in tokens from the link and the video', () => {
        expect(resolveTemplate('{utm_source}', context)).toBe('linkedin');
        expect(resolveTemplate('video:{video_title}|{utm_campaign}|{param:ref}', context)).toBe('video:Q4 pricing|q4|nl');
        expect(resolveTemplate('{link_name} at {link_company}', context)).toBe('Ana Lopez at Acme');
        expect(resolveTemplate('{utm_medium}{unknown}', context)).toBe('');
        expect(resolveTemplate('{date}', context)).toBe('2026-10-17T10:00:00.000Z');
    });

    it('keeps only sensible link parameters', () => {
        expect(context.query).not.toHaveProperty('bad key!');
        expect(context.query.long).toHaveLength(300);
    });
});

describe('answers', () => {
    const fields = (normalizeInteractions([form()], 60_000) as { ok: true; interactions: FormInteraction[] }).interactions[0];

    it('checks required fields, emails and choices', () => {
        expect(validateAnswers(fields, {})).toMatchObject({ ok: false, error: 'Please fill in “Work email”.' });
        expect(validateAnswers(fields, { email: 'nope' })).toMatchObject({ ok: false });
        expect(validateAnswers(fields, { email: 'a@b.co', team: '500+' })).toMatchObject({ ok: false });
        const ok = validateAnswers(fields, { email: ' Ana@Acme.com ', company: 'Acme', team: '1-10', extra: 'ignored' });
        expect(ok).toEqual({ ok: true, values: { email: 'ana@acme.com', company: 'Acme', team: '1-10' } });
        if (ok.ok) expect(emailFrom(fields, ok.values)).toBe('ana@acme.com');
    });
});

describe('gate pass', () => {
    it('only opens the video and form it was issued for', () => {
        const token = signLead('video-1', 'gate1234', 'ana@acme.com')!;
        expect(readLead(token, 'video-1', 'gate1234')).toEqual({ email: 'ana@acme.com' });
        expect(readLead(token, 'video-2', 'gate1234')).toBeNull();
        // A new gate form asks again.
        expect(readLead(token, 'video-1', 'gate9999')).toBeNull();
        expect(readLead(`${token.split('.')[0]}.forged`, 'video-1', 'gate1234')).toBeNull();
    });
});

describe('forwarding to HubSpot', () => {
    it('sends every field by name with the page context', () => {
        expect(hubspotBody({ email: 'ana@acme.com', utm_source: 'linkedin' }, { pageUrl: 'https://cliprame.app/v/abc', pageName: 'Q4 pricing' })).toEqual({
            fields: [{ name: 'email', value: 'ana@acme.com' }, { name: 'utm_source', value: 'linkedin' }],
            context: { pageUri: 'https://cliprame.app/v/abc', pageName: 'Q4 pricing' },
        });
    });
});
