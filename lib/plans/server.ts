import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS, PlanId } from '@/components/pricing/planLimits';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AiKind = 'transcription' | 'voiceover';

const CREATOR_PLAN_ID = process.env.RAZORPAY_PLAN_ID_CREATOR ?? process.env.RAZORPAY_PLAN_ID;
const STUDIO_PLAN_ID = process.env.RAZORPAY_PLAN_ID_STUDIO;

/* ------------------------------ helpers ------------------------------ */

let adminClient: SupabaseClient | null = null;

/** Service-role client. It bypasses row-level security, so it must only be used on the server. */
function admin() {
    adminClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    });
    return adminClient;
}

/** Whole seconds, at least 1, so tiny requests are never free. */
const toSeconds = (seconds: number) => Math.max(1, Math.ceil(seconds));

/** First day of the current month (UTC), the key for monthly usage. */
const currentPeriod = () => `${new Date().toISOString().slice(0, 7)}-01`;

const limitMinutesFor = (plan: PlanId, kind: AiKind) =>
    kind === 'transcription' ? PLAN_LIMITS[plan].transcriptionMinutes : PLAN_LIMITS[plan].voiceoverMinutes;

/* -------------------------------- user -------------------------------- */

export async function getRequestUserId(): Promise<string | null> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

/* -------------------------------- plan -------------------------------- */

/** Maps the Razorpay plan stored on the subscription to one of our plans. */
function planFromRazorpayId(razorpayPlanId: string | null): PlanId {
    if (razorpayPlanId && razorpayPlanId === STUDIO_PLAN_ID) return 'studio';
    if (razorpayPlanId && razorpayPlanId === CREATOR_PLAN_ID) return 'creator';
    // A paying customer on an unrecognized plan gets Creator, not a downgrade. Check your plan ID env vars.
    console.warn('[plans] Unknown razorpay_plan_id on an active subscription:', razorpayPlanId);
    return 'creator';
}

/** The plan a user is entitled to right now. No subscription, or one that has ended, means Free. */
export async function getEffectivePlan(userId: string): Promise<PlanId> {
    const { data } = await admin()
        .from('subscriptions')
        .select('razorpay_plan_id, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();
    if (!data) return 'free';

    const stillPaidFor = data.current_period_end ? new Date(data.current_period_end) > new Date() : false;
    // A cancelled subscription keeps its plan until the period it already paid for ends.
    const hasAccess = data.status === 'active' || (data.status === 'cancelled' && stillPaidFor);
    return hasAccess ? planFromRazorpayId(data.razorpay_plan_id) : 'free';
}

/* ------------------------------- usage ------------------------------- */

export type UsageResult =
    | { ok: true; plan: PlanId; charged: number }
    | { ok: false; plan: PlanId; usedMinutes: number; limitMinutes: number };

/** Adds usage if it stays within the plan's monthly limit. The database does the check atomically. */
export async function consumeAiSeconds(userId: string, kind: AiKind, seconds: number): Promise<UsageResult> {
    const plan = await getEffectivePlan(userId);
    const limitMinutes = limitMinutesFor(plan, kind);
    const charged = toSeconds(seconds);

    const { data, error } = await admin().rpc('consume_ai_seconds', {
        p_user: userId,
        p_kind: kind,
        p_seconds: charged,
        p_limit: limitMinutes * 60,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.allowed) return { ok: true, plan, charged };
    return { ok: false, plan, usedMinutes: Math.floor((row?.used ?? 0) / 60), limitMinutes };
}

/** Gives the minutes back when the AI call fails, so users only pay for what they get. */
export async function refundAiSeconds(userId: string, kind: AiKind, seconds: number) {
    const { error } = await admin().rpc('refund_ai_seconds', {
        p_user: userId,
        p_kind: kind,
        p_seconds: toSeconds(seconds),
    });
    if (error) console.error('Could not refund AI minutes:', error);
}

export async function getUsageThisMonth(userId: string) {
    const { data } = await admin()
        .from('ai_minutes_usage')
        .select('transcription_seconds, voiceover_seconds')
        .eq('user_id', userId)
        .eq('period', currentPeriod())
        .maybeSingle();

    return {
        transcriptionMinutes: Math.floor((data?.transcription_seconds ?? 0) / 60),
        voiceoverMinutes: Math.floor((data?.voiceover_seconds ?? 0) / 60),
    };
}

/** The 429 response to send when a user has used up their minutes. */
export function limitReachedResponse(result: Extract<UsageResult, { ok: false }>, kind: AiKind) {
    const what = kind === 'transcription' ? 'transcription' : 'AI voiceover';
    const upgrade = result.plan === 'studio' ? '' : ' Upgrade your plan for more.';
    return Response.json(
        { error: `You've used your ${result.limitMinutes} minutes of ${what} for this month.${upgrade}`, upgradeUrl: '/pricing' },
        { status: 429 },
    );
}