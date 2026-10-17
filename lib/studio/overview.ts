import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlanSummary, getUsageThisMonth } from '@/lib/plans/server';
import { maxUploadBytes } from '@/components/pricing/planLimits';
import type { AccountOverview } from './overviewTypes';
import { isAdminEmail } from '@/lib/admin/emails';

/** Everything the account page and menu show about plan and usage. */
export async function loadAccountOverview(supabase: SupabaseClient, userId: string): Promise<AccountOverview> {
    const [plan, usage, videos, subscription, { data: claims }] = await Promise.all([
        getPlanSummary(userId),
        getUsageThisMonth(userId).catch(() => ({ transcriptionMinutes: 0, voiceoverMinutes: 0 })),
        supabase.from('videos').select('size_bytes').eq('owner_id', userId).limit(1000),
        supabase.from('subscriptions').select('status,current_period_end,cancel_at_period_end').eq('user_id', userId).maybeSingle(),
        supabase.auth.getClaims(),
    ]);
    const rows = (videos.data ?? []) as Array<{ size_bytes: number | string | null }>;
    const now = new Date();
    return {
        plan: { id: plan.plan, name: plan.name, isPaid: plan.isPaid, priceUsd: plan.limits.priceUsd, priceInr: plan.limits.priceInr },
        billing: plan.isPaid && subscription.data ? {
            status: subscription.data.status as string,
            periodEnd: subscription.data.current_period_end as string | null,
            cancelAtPeriodEnd: Boolean(subscription.data.cancel_at_period_end),
        } : null,
        ai: {
            transcription: { used: usage.transcriptionMinutes, limit: plan.limits.transcriptionMinutes },
            voiceover: { used: usage.voiceoverMinutes, limit: plan.limits.voiceoverMinutes },
            // Monthly minutes reset on the first of next month (UTC).
            resetsOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
        },
        videos: { used: rows.length, limit: plan.limits.hostedVideos },
        storage: {
            usedBytes: rows.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0),
            maxVideoBytes: maxUploadBytes(plan.limits),
            maxVideoSeconds: plan.limits.exportSeconds,
        },
        isAdmin: isAdminEmail(typeof claims?.claims?.email === 'string' ? claims.claims.email : null, true),
    };
}
