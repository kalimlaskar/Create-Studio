'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { CURRENCY_COOKIE } from '@/lib/admin/money';
import { audit, getAdmin } from '@/lib/admin/auth';
import { adminEmailList } from '@/lib/admin/emails';
import { r2Url } from '@/lib/storage/r2';

// Every admin action re-checks admin access on the server, then writes the audit log.

type Result = { error?: string };
/** About 100 years: Supabase's way of saying "until we lift it". */
const FOREVER = '876000h';

const clean = (reason: unknown, fallback: string) => (typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 300) : fallback);

/** Closes every open report about these videos. */
async function closeReports(db: NonNullable<Awaited<ReturnType<typeof getAdmin>>>['db'], adminId: string, videoIds: string[], resolution: string) {
    if (!videoIds.length) return;
    await db.from('content_reports')
        .update({ status: 'actioned', resolution, resolved_by: adminId, resolved_at: new Date().toISOString() })
        .in('video_id', videoIds).eq('status', 'open');
}

export async function banUserAction(userId: string, reason: string): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    if (userId === admin.id) return { error: 'You can’t ban yourself.' };
    const { data: target } = await admin.db.auth.admin.getUserById(userId);
    if (!target.user) return { error: 'User not found.' };
    if (target.user.email && adminEmailList().includes(target.user.email.toLowerCase())) return { error: 'You can’t ban another admin.' };

    const why = clean(reason, 'Broke the terms of service');
    const { error } = await admin.db.from('account_bans').upsert({ user_id: userId, reason: why, banned_by: admin.id, banned_at: new Date().toISOString() });
    if (error) return { error: 'Could not save the ban.' };
    // Blocks sign-in and signs them out when their session next refreshes.
    const { error: authError } = await admin.db.auth.admin.updateUserById(userId, { ban_duration: FOREVER });
    if (authError) console.error('Could not ban the user in Supabase Auth:', authError);

    const { data: videos } = await admin.db.from('videos').select('id').eq('owner_id', userId);
    await closeReports(admin.db, admin.id, (videos ?? []).map((video) => video.id), 'Uploader banned');
    await audit(admin, 'user.banned', { type: 'user', id: userId }, { email: target.user.email, reason: why });
    revalidatePath('/admin', 'layout');
    return {};
}

export async function unbanUserAction(userId: string): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const { error } = await admin.db.from('account_bans').delete().eq('user_id', userId);
    if (error) return { error: 'Could not lift the ban.' };
    const { error: authError } = await admin.db.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    if (authError) console.error('Could not unban the user in Supabase Auth:', authError);
    await audit(admin, 'user.unbanned', { type: 'user', id: userId });
    revalidatePath('/admin', 'layout');
    return {};
}

export async function takeDownVideoAction(videoId: string, reason: string): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const why = clean(reason, 'Broke the content rules');
    const { data, error } = await admin.db.from('videos').update({ banned_at: new Date().toISOString(), banned_reason: why }).eq('id', videoId).select('title,owner_id').maybeSingle();
    if (error || !data) return { error: 'Could not take the video down.' };
    await closeReports(admin.db, admin.id, [videoId], `Video taken down: ${why}`);
    await audit(admin, 'video.taken_down', { type: 'video', id: videoId }, { title: data.title, owner: data.owner_id, reason: why });
    revalidatePath('/admin', 'layout');
    return {};
}

export async function restoreVideoAction(videoId: string): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const { error } = await admin.db.from('videos').update({ banned_at: null, banned_reason: null }).eq('id', videoId);
    if (error) return { error: 'Could not restore the video.' };
    await audit(admin, 'video.restored', { type: 'video', id: videoId });
    revalidatePath('/admin', 'layout');
    return {};
}

export async function dismissReportAction(reportId: string, note: string): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const resolution = clean(note, 'No violation found');
    const { error } = await admin.db.from('content_reports').update({ status: 'dismissed', resolution, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq('id', reportId);
    if (error) return { error: 'Could not dismiss the report.' };
    await audit(admin, 'report.dismissed', { type: 'report', id: reportId }, { resolution });
    revalidatePath('/admin', 'layout');
    return {};
}

/** A short-lived link to a reported video, so it can be judged. Logged every time. */
export async function reviewReportedVideoAction(reportId: string): Promise<{ url?: string; error?: string }> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    const { data: report } = await admin.db.from('content_reports').select('video_id').eq('id', reportId).maybeSingle();
    if (!report) return { error: 'Report not found.' };
    const { data: video } = await admin.db.from('videos').select('storage_key,title').eq('id', report.video_id).maybeSingle();
    if (!video) return { error: 'The video has been deleted.' };
    await audit(admin, 'video.reviewed', { type: 'video', id: report.video_id }, { report: reportId, title: video.title });
    // 15 minutes: enough to judge it, too short to pass around.
    return { url: r2Url('GET', video.storage_key, 15 * 60) };
}

/** Remembers whether money is shown in dollars or rupees on the admin dashboard. */
export async function setAdminCurrencyAction(currency: 'usd' | 'inr'): Promise<Result> {
    const admin = await getAdmin();
    if (!admin) return { error: 'Not allowed.' };
    (await cookies()).set(CURRENCY_COOKIE, currency === 'inr' ? 'inr' : 'usd', { path: '/admin', maxAge: 31536000, sameSite: 'lax', httpOnly: true });
    revalidatePath('/admin', 'layout');
    return {};
}
