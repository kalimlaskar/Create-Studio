import crypto from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { deleteObject, isR2Configured } from '@/lib/storage/r2';

// Daily housekeeping, run by Vercel Cron (vercel.json) or any scheduler that sends
// "Authorization: Bearer <CRON_SECRET>".
//   - Uploads that never finished (status "uploading" for over a day): files and rows deleted.
//   - Razorpay webhook event IDs older than 90 days: deleted (only needed to skip retries).
//   - Protected-video email codes and wrong-PIN records older than a day: deleted.
//   - Records of sent viewing notifications older than 90 days: deleted.

export const maxDuration = 60;
const STALE_UPLOAD_MS = 24 * 3600 * 1000;
const BATCH = 200;

function authorized(request: Request) {
    const secret = process.env.CRON_SECRET;
    const header = request.headers.get('authorization') ?? '';
    if (!secret || !header.startsWith('Bearer ')) return false;
    const given = Buffer.from(header.slice(7));
    const expected = Buffer.from(secret);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
    if (!process.env.CRON_SECRET) return Response.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
    if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    const admin = createSupabaseAdminClient();
    if (!admin) return Response.json({ error: 'Supabase service role is not configured.' }, { status: 503 });

    const cutoff = new Date(Date.now() - STALE_UPLOAD_MS).toISOString();
    const { data: stale, error } = await admin.from('videos').select('id,storage_key,poster_key')
        .eq('status', 'uploading').lt('created_at', cutoff).limit(BATCH);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    let removed = 0;
    const failed: string[] = [];
    for (const video of stale ?? []) {
        try {
            if (isR2Configured()) {
                await deleteObject(video.storage_key);
                if (video.poster_key) await deleteObject(video.poster_key);
            }
            const { error: deleteError } = await admin.from('videos').delete().eq('id', video.id);
            if (deleteError) throw deleteError;
            removed += 1;
        } catch (cause) {
            console.error('[cleanup] Could not remove unfinished upload', video.id, cause);
            failed.push(video.id);
        }
    }

    const { count: prunedEvents } = await admin.from('razorpay_events')
        .delete({ count: 'exact' })
        .lt('received_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: prunedCodes }, { count: prunedFailures }, { count: prunedNotifications }] = await Promise.all([
        admin.from('video_access_codes').delete({ count: 'exact' }).lt('created_at', dayAgo),
        admin.from('video_access_failures').delete({ count: 'exact' }).lt('created_at', dayAgo),
        admin.from('notification_events').delete({ count: 'exact' }).lt('created_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()),
    ]);

    return Response.json({ removedUploads: removed, failedUploads: failed, prunedWebhookEvents: prunedEvents ?? 0, prunedAccessCodes: prunedCodes ?? 0, prunedAccessFailures: prunedFailures ?? 0, prunedNotifications: prunedNotifications ?? 0, more: (stale?.length ?? 0) === BATCH });
}
