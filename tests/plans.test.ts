import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, PLAN_LIMITS } from '@/components/pricing/planLimits';
import { planForRazorpayId, toCatalogPlan } from '@/lib/plans/catalog';
import { normalizePlanInput, planIdFrom, reducedLimits } from '@/lib/plans/validate';

const limits = { exportSeconds: 600, watermark: false, transcriptionMinutes: 150, voiceoverMinutes: 50, hostedVideos: 250, aiDailyRequests: 200, embedDomains: true, protection: true, forms: true, maxIntegrations: 20 };

describe('package settings', () => {
    it('accepts a paid package and makes a safe id from its name', () => {
        const result = normalizePlanInput({ name: ' Team Plus ', priceInr: 2500, priceUsd: 29, limits }, { isFree: false });
        expect(result.ok).toBe(true);
        expect(planIdFrom('Team Plus!')).toBe('team-plus');
    });

    it('rejects what would break billing or limits', () => {
        expect(normalizePlanInput({ name: 'Team', priceInr: 0, priceUsd: 10, limits }, { isFree: false })).toMatchObject({ ok: false });
        expect(normalizePlanInput({ name: 'Free', priceInr: 100, priceUsd: 0, limits }, { isFree: true })).toMatchObject({ ok: false });
        expect(normalizePlanInput({ name: 'Team', priceInr: 900, priceUsd: 10, razorpayPlanId: 'nope', limits }, { isFree: false })).toMatchObject({ ok: false });
        expect(normalizePlanInput({ name: 'Team', priceInr: 900, priceUsd: 10, limits: { ...limits, maxIntegrations: 99 } }, { isFree: false })).toMatchObject({ ok: false });
        expect(normalizePlanInput({ name: '', priceInr: 900, priceUsd: 10, limits }, { isFree: false })).toMatchObject({ ok: false });
    });

    it('spells out what existing customers lose', () => {
        const changes = reducedLimits(PLAN_LIMITS.studio, { ...limits, hostedVideos: 100, protection: false });
        expect(changes).toContain('Videos hosted: 500 → 100');
        expect(changes).toContain('Video locks turned off');
    });
});

describe('which package a subscription is on', () => {
    const catalog = [
        ...DEFAULT_CATALOG,
        toCatalogPlan({ id: 'team', name: 'Team', description: null, price_usd: 29, price_inr: 2500, razorpay_plan_id: 'plan_new123', legacy_razorpay_plan_ids: ['plan_old123'], is_public: true, archived: false, sort_order: 3, limits: { hostedVideos: 250 } }),
    ];

    it('finds the package by its current or earlier Razorpay plan', () => {
        expect(planForRazorpayId(catalog, 'plan_new123')).toBe('team');
        // Subscribers from before a price change stay on the same package.
        expect(planForRazorpayId(catalog, 'plan_old123')).toBe('team');
        expect(planForRazorpayId(catalog, 'plan_unknown')).toBeNull();
    });

    it('fills limits added later with defaults', () => {
        const team = catalog.find((plan) => plan.id === 'team')!;
        expect(team.hostedVideos).toBe(250);
        expect(typeof team.forms).toBe('boolean');
        expect(team.priceUsd).toBe(29);
    });
});
