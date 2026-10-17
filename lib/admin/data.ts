import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isPaidPlan, type CatalogPlan, type PlanId } from '@/components/pricing/planLimits';
import { hasPaidAccess } from '@/lib/plans/entitlement';
import { getCatalog, planForRazorpayId } from '@/lib/plans/catalog';

// Everything the admin dashboard shows, read with the service role and summed up
// here. Counts and usage only: no video contents, form answers or secrets.

/** Gemini rates used for the cost estimate (see components/pricing/planLimits.ts). */
const COST_PER_MINUTE = { transcription: 0.04, voiceover: 0.018 };

export interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    plan: PlanId;
    videos: number;
    removedVideos: number;
    storageBytes: number;
    plays30d: number;
    aiTranscriptionMin: number;
    aiVoiceoverMin: number;
    ban: { reason: string; at: string } | null;
}

export interface AdminOverview {
    users: AdminUser[];
    totals: {
        users: number;
        new7d: number;
        new30d: number;
        /** Paying customers per paid plan, in plan order. */
        paying: Array<{ plan: PlanId; name: string; count: number }>;
        /** Monthly revenue at list prices, in each currency's own price (not converted). */
        mrr: { usd: number; inr: number };
        videos: number;
        storageBytes: number;
        plays7d: number;
        plays30d: number;
        aiTranscriptionMin: number;
        aiVoiceoverMin: number;
        aiCostUsd: number;
        openReports: number;
        urgentReports: number;
        bannedUsers: number;
    };
    /** Sign-ups per day for the last 30 days, oldest first. */
    signups: Array<{ day: string; count: number }>;
}

const DAY = 24 * 3600 * 1000;
const currentPeriod = () => `${new Date().toISOString().slice(0, 7)}-01`;

async function allAuthUsers(db: SupabaseClient) {
    const users: User[] = [];
    for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        users.push(...data.users);
        if (data.users.length < 1000) break;
    }
    return users;
}

export async function loadAdminOverview(db: SupabaseClient): Promise<AdminOverview> {
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const [authUsers, profiles, subscriptions, videos, sessions, usage, bans, reports] = await Promise.all([
        allAuthUsers(db),
        db.from('profiles').select('id,display_name').limit(20000),
        db.from('subscriptions').select('user_id,razorpay_plan_id,status,current_period_end').limit(20000),
        db.from('videos').select('id,owner_id,size_bytes,banned_at').limit(50000),
        db.from('view_sessions').select('video_id,started_at,watched_ms').gt('started_at', since30).gte('watched_ms', 1000).limit(100000),
        db.from('ai_minutes_usage').select('user_id,transcription_seconds,voiceover_seconds').eq('period', currentPeriod()).limit(20000),
        db.from('account_bans').select('user_id,reason,banned_at').limit(20000),
        db.from('content_reports').select('urgent').eq('status', 'open').limit(5000),
    ]);

    const names = new Map((profiles.data ?? []).map((row) => [row.id as string, row.display_name as string | null]));
    const catalog = await getCatalog();
    // Same rule as the app: paid access, then which package the Razorpay plan belongs to.
    const plans = new Map((subscriptions.data ?? []).map((row) => [row.user_id as string, hasPaidAccess(row) ? planForRazorpayId(catalog, row.razorpay_plan_id) ?? 'creator' : 'free']));
    const banMap = new Map((bans.data ?? []).map((row) => [row.user_id as string, { reason: row.reason as string, at: row.banned_at as string }]));
    const ai = new Map((usage.data ?? []).map((row) => [row.user_id as string, { t: Math.round((row.transcription_seconds ?? 0) / 60), v: Math.round((row.voiceover_seconds ?? 0) / 60) }]));

    const ownerOf = new Map<string, string>();
    const perOwner = new Map<string, { videos: number; removed: number; bytes: number; plays: number }>();
    const bucket = (owner: string) => {
        let entry = perOwner.get(owner);
        if (!entry) perOwner.set(owner, entry = { videos: 0, removed: 0, bytes: 0, plays: 0 });
        return entry;
    };
    for (const video of videos.data ?? []) {
        ownerOf.set(video.id, video.owner_id);
        const entry = bucket(video.owner_id);
        entry.videos += 1;
        if (video.banned_at) entry.removed += 1;
        entry.bytes += Number(video.size_bytes ?? 0);
    }
    const weekAgo = Date.now() - 7 * DAY;
    let plays7d = 0;
    for (const session of sessions.data ?? []) {
        const owner = ownerOf.get(session.video_id);
        if (owner) bucket(owner).plays += 1;
        if (new Date(session.started_at).getTime() > weekAgo) plays7d += 1;
    }

    const users: AdminUser[] = authUsers.map((user) => {
        const stats = perOwner.get(user.id);
        const minutes = ai.get(user.id);
        return {
            id: user.id,
            email: user.email ?? '(no email)',
            name: names.get(user.id) ?? null,
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            plan: plans.get(user.id) ?? 'free',
            videos: stats?.videos ?? 0,
            removedVideos: stats?.removed ?? 0,
            storageBytes: stats?.bytes ?? 0,
            plays30d: stats?.plays ?? 0,
            aiTranscriptionMin: minutes?.t ?? 0,
            aiVoiceoverMin: minutes?.v ?? 0,
            ban: banMap.get(user.id) ?? null,
        };
    });

    const priceOf = new Map<string, CatalogPlan>(catalog.map((plan) => [plan.id, plan]));
    const paying = catalog.filter(isPaidPlan)
        .map((plan) => ({ plan: plan.id, name: plan.name, count: users.filter((user) => user.plan === plan.id).length }))
        .filter((row) => row.count > 0 || !priceOf.get(row.plan)?.archived);
    const aiTranscriptionMin = users.reduce((sum, user) => sum + user.aiTranscriptionMin, 0);
    const aiVoiceoverMin = users.reduce((sum, user) => sum + user.aiVoiceoverMin, 0);
    const age = (user: AdminUser) => Date.now() - new Date(user.createdAt).getTime();

    const signups = Array.from({ length: 30 }, (_, index) => {
        const day = new Date(Date.now() - (29 - index) * DAY).toISOString().slice(0, 10);
        return { day, count: users.filter((user) => user.createdAt.slice(0, 10) === day).length };
    });

    return {
        users,
        totals: {
            users: users.length,
            new7d: users.filter((user) => age(user) < 7 * DAY).length,
            new30d: users.filter((user) => age(user) < 30 * DAY).length,
            paying,
            mrr: {
                usd: paying.reduce((sum, row) => sum + row.count * (priceOf.get(row.plan)?.priceUsd ?? 0), 0),
                inr: paying.reduce((sum, row) => sum + row.count * (priceOf.get(row.plan)?.priceInr ?? 0), 0),
            },
            videos: (videos.data ?? []).length,
            storageBytes: users.reduce((sum, user) => sum + user.storageBytes, 0),
            plays7d,
            plays30d: (sessions.data ?? []).length,
            aiTranscriptionMin,
            aiVoiceoverMin,
            aiCostUsd: Math.round((aiTranscriptionMin * COST_PER_MINUTE.transcription + aiVoiceoverMin * COST_PER_MINUTE.voiceover) * 100) / 100,
            openReports: (reports.data ?? []).length,
            urgentReports: (reports.data ?? []).filter((report) => report.urgent).length,
            bannedUsers: banMap.size,
        },
        signups,
    };
}

export interface AdminReport {
    id: string;
    reason: string;
    details: string | null;
    reporterEmail: string | null;
    urgent: boolean;
    status: 'open' | 'actioned' | 'dismissed';
    resolution: string | null;
    createdAt: string;
    resolvedAt: string | null;
    video: { id: string; title: string; ownerId: string; ownerEmail: string | null; removed: boolean; createdAt: string } | null;
    /** Other reports about the same video, so repeat offenders stand out. */
    sameVideoCount: number;
}

export async function loadReports(db: SupabaseClient, status: 'open' | 'closed'): Promise<AdminReport[]> {
    let query = db.from('content_reports').select('id,video_id,reason,details,reporter_email,urgent,status,resolution,created_at,resolved_at');
    query = status === 'open' ? query.eq('status', 'open').order('urgent', { ascending: false }).order('created_at', { ascending: true }) : query.neq('status', 'open').order('resolved_at', { ascending: false });
    const { data: reports, error } = await query.limit(300);
    if (error) throw error;
    const videoIds = [...new Set((reports ?? []).map((report) => report.video_id as string))];
    const { data: videos } = videoIds.length ? await db.from('videos').select('id,title,owner_id,banned_at,created_at').in('id', videoIds) : { data: [] };
    const owners = [...new Set((videos ?? []).map((video) => video.owner_id as string))];
    const emails = new Map<string, string | null>();
    await Promise.all(owners.map(async (owner) => {
        const { data } = await db.auth.admin.getUserById(owner);
        emails.set(owner, data.user?.email ?? null);
    }));
    const counts = new Map<string, number>();
    for (const report of reports ?? []) counts.set(report.video_id, (counts.get(report.video_id) ?? 0) + 1);

    return (reports ?? []).map((report) => {
        const video = (videos ?? []).find((item) => item.id === report.video_id);
        return {
            id: report.id,
            reason: report.reason,
            details: report.details,
            reporterEmail: report.reporter_email,
            urgent: report.urgent,
            status: report.status,
            resolution: report.resolution,
            createdAt: report.created_at,
            resolvedAt: report.resolved_at,
            video: video ? { id: video.id, title: video.title, ownerId: video.owner_id, ownerEmail: emails.get(video.owner_id) ?? null, removed: Boolean(video.banned_at), createdAt: video.created_at } : null,
            sameVideoCount: counts.get(report.video_id) ?? 1,
        };
    });
}

export async function loadAuditLog(db: SupabaseClient) {
    const { data, error } = await db.from('admin_audit_log').select('id,admin_email,action,target_type,target_id,details,created_at').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return data ?? [];
}
