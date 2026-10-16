// The single rule for "which plan does this subscription give?". Used by the
// server (lib/plans/server.ts). The same rule lives in SQL as public.is_pro()
// (supabase/migrations/20261017000100_billing_and_usage.sql); keep them in step.
//
// Razorpay subscription statuses:
//   authenticated – the customer approved payment; the first charge is taken at this point
//   active        – charging normally
//   pending       – a renewal charge failed and Razorpay is retrying (grace period)
//   cancelled     – cancelled; access continues until the paid period ends
//   halted, completed, expired, paused, created – no access

import type { PlanId } from '@/components/pricing/planLimits';

export interface SubscriptionRow {
    status: string;
    current_period_end: string | null;
    razorpay_plan_id: string | null;
}

export interface RazorpayPlanIds {
    creator?: string | null;
    studio?: string | null;
}

const PAYING = new Set(['active', 'authenticated']);
const UNTIL_PERIOD_END = new Set(['pending', 'cancelled']);

/** True while the subscription should unlock paid features. */
export function hasPaidAccess(row: Pick<SubscriptionRow, 'status' | 'current_period_end'> | null, now = new Date()) {
    if (!row) return false;
    if (PAYING.has(row.status)) return true;
    return UNTIL_PERIOD_END.has(row.status) && Boolean(row.current_period_end) && new Date(row.current_period_end as string) > now;
}

/** The plan a subscription row grants right now. */
export function planFromSubscription(row: SubscriptionRow | null, ids: RazorpayPlanIds, now = new Date()): PlanId {
    if (!hasPaidAccess(row, now)) return 'free';
    if (ids.studio && row?.razorpay_plan_id === ids.studio) return 'studio';
    if (ids.creator && row?.razorpay_plan_id === ids.creator) return 'creator';
    // A paying customer on a plan ID we don't recognise keeps Creator rather than losing access.
    // This usually means RAZORPAY_PLAN_ID_* is missing or wrong.
    console.warn('[plans] Paid subscription with an unknown razorpay_plan_id:', row?.razorpay_plan_id);
    return 'creator';
}
