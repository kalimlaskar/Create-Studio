import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isPaidPlan, type PlanId } from '@/components/pricing/planLimits';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hasPaidAccess } from './entitlement';
import { getCatalog, getCatalogPlan, planForRazorpayId } from './catalog';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AiKind = 'transcription' | 'voiceover';


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

async function limitMinutesFor(plan: PlanId, kind: AiKind) {
    const limits = await getCatalogPlan(plan);
    return kind === 'transcription' ? limits.transcriptionMinutes : limits.voiceoverMinutes;
}

/* -------------------------------- user -------------------------------- */

export async function getRequestUserId(): Promise<string | null> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

/* -------------------------------- plan -------------------------------- */

/**
 * The plan a user is entitled to right now, read only from the subscriptions table.
 * This is the one place the app decides what someone has paid for; never trust a
 * value sent by the browser. No subscription, or one that has ended, means Free.
 */
export async function getEffectivePlan(userId: string): Promise<PlanId> {
    // Prefer the service role; without it, the user's own session can read their row (RLS allows it).
    const client = createSupabaseAdminClient() ?? await createSupabaseServerClient();
    if (!client) return 'free';
    const { data, error } = await client
        .from('subscriptions')
        .select('razorpay_plan_id, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) console.error('[plans] Could not read subscription:', error.message);
    if (!hasPaidAccess(data ?? null)) return 'free';
    const plan = planForRazorpayId(await getCatalog(), data?.razorpay_plan_id ?? null);
    if (plan) return plan;
    // A paying customer on a Razorpay plan we don't recognise keeps Creator rather than losing access.
    console.warn('[plans] Paid subscription with an unknown razorpay_plan_id:', data?.razorpay_plan_id);
    return 'creator';
}

/** Plan details for showing in the UI and enforcing limits. */
export async function getPlanSummary(userId: string) {
    const limits = await getCatalogPlan(await getEffectivePlan(userId));
    return { plan: limits.id, name: limits.name, isPaid: isPaidPlan(limits), limits };
}

/* ------------------------------- usage ------------------------------- */

export type UsageResult =
    | { ok: true; plan: PlanId; charged: number }
    | { ok: false; plan: PlanId; usedMinutes: number; limitMinutes: number };

/** Adds usage if it stays within the plan's monthly limit. The database does the check atomically. */
export async function consumeAiSeconds(userId: string, kind: AiKind, seconds: number): Promise<UsageResult> {
    const plan = await getEffectivePlan(userId);
    const limitMinutes = await limitMinutesFor(plan, kind);
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
