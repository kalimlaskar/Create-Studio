import crypto from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// notify.ts schedules work with next/server's after(); tests only use its pure helpers.
vi.mock('next/server', () => ({ after: vi.fn() }));

const { decrypt, encrypt, isPrivateAddress, prepareTarget, signWebhook, slackMessage } = await import('@/lib/integrations/server');
const { buildPayload, crossedMoments } = await import('@/lib/integrations/notify');
const { normalizeEvents } = await import('@/lib/integrations/validate');

beforeAll(() => { process.env.INTEGRATIONS_SECRET = 'test-integrations-secret'; });

const session = { watched_ms: 30_000, completed: false, cta_clicked: false, seconds_watched: new Array(30).fill(1), device: 'desktop', country: 'IN', source: 'share' as const, referrer_host: null, viewer_email: null };
const video = { id: 'v1', title: 'Pricing <walkthrough>', duration_ms: 60_000 };

describe('stored targets', () => {
    it('encrypts and decrypts, and rejects tampering', () => {
        const stored = encrypt('https://hooks.slack.com/services/T0/B0/secret');
        expect(stored).not.toContain('secret');
        expect(decrypt(stored)).toBe('https://hooks.slack.com/services/T0/B0/secret');
        const parts = stored.split('.');
        parts[3] = Buffer.from('tampered').toString('base64url');
        expect(() => decrypt(parts.join('.'))).toThrow();
    });
});

describe('target checks', () => {
    it('only accepts real Slack webhook URLs', async () => {
        expect(await prepareTarget('slack', 'https://hooks.slack.com/services/T0/B0/abcd')).toMatchObject({ hint: 'hooks.slack.com/…/abcd' });
        expect(await prepareTarget('slack', 'https://evil.com/services/x')).toHaveProperty('error');
    });

    it('blocks webhooks to private networks and plain http', async () => {
        for (const url of ['http://example.com/hook', 'https://localhost/hook', 'https://127.0.0.1/hook', 'https://169.254.169.254/latest', 'https://10.0.0.5/x', 'https://[::1]/x', 'https://user:pw@example.com/x']) {
            expect(await prepareTarget('webhook', url), url).toHaveProperty('error');
        }
        expect(await prepareTarget('webhook', 'https://example.com/hooks/cliprame')).toHaveProperty('target');
    });

    it('recognises private addresses', () => {
        expect(isPrivateAddress('192.168.1.4')).toBe(true);
        expect(isPrivateAddress('172.20.0.1')).toBe(true);
        expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
        expect(isPrivateAddress('8.8.8.8')).toBe(false);
    });
});

describe('webhook signatures', () => {
    it('signs timestamp and body with HMAC-SHA256', () => {
        const header = signWebhook('whsec_test', '{"a":1}', 1_760_000_000);
        const expected = crypto.createHmac('sha256', 'whsec_test').update('1760000000.{"a":1}').digest('hex');
        expect(header).toBe(`t=1760000000,v1=${expected}`);
    });
});

describe('notifications', () => {
    it('fires each moment only when it is first crossed', () => {
        expect(crossedMoments({ watched_ms: 0, completed: false, cta_clicked: false }, { watched_ms: 3000, completed: false, cta_clicked: false })).toEqual(['video.viewed']);
        expect(crossedMoments({ watched_ms: 3000, completed: false, cta_clicked: false }, { watched_ms: 9000, completed: true, cta_clicked: true })).toEqual(['video.completed', 'cta.clicked']);
        expect(crossedMoments({ watched_ms: 3000, completed: true, cta_clicked: true }, { watched_ms: 9000, completed: true, cta_clicked: true })).toEqual([]);
    });

    it('names viewers from personal links or verified emails', () => {
        const anonymous = buildPayload('video.viewed', { video, link: { slug: 's', recipient_name: null, recipient_email: null, recipient_company: null }, session, siteUrl: 'https://cliprame.app' });
        expect(anonymous.viewer).toMatchObject({ name: null, identified: false });
        expect(anonymous.watch.percentWatched).toBe(0.5);
        expect(anonymous.video.shareUrl).toBe('https://cliprame.app/v/s');
        const verified = buildPayload('video.viewed', { video, link: { slug: 's', recipient_name: null, recipient_email: null, recipient_company: null }, session: { ...session, viewer_email: 'ana@acme.com' }, siteUrl: 'https://cliprame.app' });
        expect(verified.viewer).toMatchObject({ name: 'ana@acme.com', email: 'ana@acme.com', identified: true });
    });

    it('escapes Slack formatting in titles', () => {
        const payload = buildPayload('video.completed', { video, link: { slug: 's', recipient_name: 'Ana', recipient_email: null, recipient_company: 'Acme' }, session, siteUrl: 'https://cliprame.app' });
        const message = slackMessage(payload);
        expect(JSON.stringify(message.blocks)).toContain('Pricing &lt;walkthrough&gt;');
        expect(message.text).toBe('Ana (Acme) watched “Pricing <walkthrough>” to the end');
    });

    it('accepts only known event types', () => {
        expect(normalizeEvents(['cta.clicked', 'video.viewed'])).toEqual(['video.viewed', 'cta.clicked']);
        expect(normalizeEvents(['video.deleted'])).toBeNull();
    });
});
