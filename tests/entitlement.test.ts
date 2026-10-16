import { describe, expect, it } from 'vitest';
import { hasPaidAccess, planFromSubscription } from '@/lib/plans/entitlement';

const ids = { creator: 'plan_creator', studio: 'plan_studio' };
const now = new Date('2026-10-17T00:00:00Z');
const future = '2026-11-01T00:00:00Z';
const past = '2026-10-01T00:00:00Z';

describe('paid access', () => {
    it('is free with no subscription', () => {
        expect(planFromSubscription(null, ids, now)).toBe('free');
    });

    it.each(['active', 'authenticated'])('grants the plan while %s', (status) => {
        expect(planFromSubscription({ status, current_period_end: null, razorpay_plan_id: 'plan_studio' }, ids, now)).toBe('studio');
    });

    it.each(['pending', 'cancelled'])('keeps access while %s until the paid period ends', (status) => {
        expect(hasPaidAccess({ status, current_period_end: future }, now)).toBe(true);
        expect(hasPaidAccess({ status, current_period_end: past }, now)).toBe(false);
        expect(hasPaidAccess({ status, current_period_end: null }, now)).toBe(false);
    });

    it.each(['created', 'halted', 'completed', 'expired', 'paused'])('gives no access when %s', (status) => {
        expect(planFromSubscription({ status, current_period_end: future, razorpay_plan_id: 'plan_creator' }, ids, now)).toBe('free');
    });

    it('maps Razorpay plan IDs to our plans', () => {
        expect(planFromSubscription({ status: 'active', current_period_end: null, razorpay_plan_id: 'plan_creator' }, ids, now)).toBe('creator');
        // Unknown plan IDs keep a paying customer on Creator instead of dropping them to Free.
        expect(planFromSubscription({ status: 'active', current_period_end: null, razorpay_plan_id: 'plan_other' }, ids, now)).toBe('creator');
    });
});
