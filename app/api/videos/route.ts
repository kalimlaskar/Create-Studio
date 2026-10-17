import { isR2Configured, r2Url } from '@/lib/storage/r2';
import { describeDbError, getStudioUser, isMissingColumn, isMissingTable, listVideos, MISSING_COLUMNS_MESSAGE, MISSING_TABLES_MESSAGE, posterObjectKey, toVideoRecord, VIDEO_COLUMNS, videoObjectKey, type VideoRow } from '@/lib/videos/server';
import { MAX_UPLOAD_BYTES, SHARE_CONTENT_TYPES } from '@/lib/videos/types';
import { getPlanSummary } from '@/lib/plans/server';
import { maxUploadBytes } from '@/components/pricing/planLimits';

const fail = (error: string, status: number) => Response.json({ error }, { status });
const planLimit = (error: string) => Response.json({ error, upgradeUrl: '/pricing' }, { status: 403 });
const describeSeconds = (seconds: number) => (seconds >= 60 ? `${Math.round(seconds / 60)} minute${seconds >= 120 ? 's' : ''}` : `${seconds} seconds`);

export async function GET() {
    const user = await getStudioUser();
    if (!user) return fail('Sign in to see your videos.', 401);
    try {
        return Response.json({ videos: await listVideos(user.supabase) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Could not list videos:', describeDbError(error));
        return fail(isMissingTable(error) ? MISSING_TABLES_MESSAGE : isMissingColumn(error) ? MISSING_COLUMNS_MESSAGE : 'Could not load your videos.', 500);
    }
}

/** Creates a video and returns presigned URLs the browser uploads the file and poster to. */
export async function POST(request: Request) {
    const user = await getStudioUser();
    if (!user) return fail('Sign in to upload videos.', 401);
    if (!isR2Configured()) return fail('Video hosting isn’t set up on this server yet (R2 storage is not configured).', 503);

    const body = await request.json().catch(() => null) as { title?: unknown; contentType?: unknown; sizeBytes?: unknown; durationMs?: unknown; hasPoster?: unknown } | null;
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 160) : 'Untitled video';
    const contentType = SHARE_CONTENT_TYPES.find((type) => type === body?.contentType);
    const sizeBytes = Number(body?.sizeBytes);
    const durationMs = Math.max(0, Math.round(Number(body?.durationMs) || 0));
    // The app converts everything to MP4 before uploading, which lets the server read the real length.
    if (contentType !== 'video/mp4') return fail('Upload an MP4 video.', 400);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return fail('The video file is empty.', 400);
    if (sizeBytes > MAX_UPLOAD_BYTES) return fail('Videos can be up to 2 GB.', 413);

    // Plan limits are checked here, on the server, not only in the browser.
    const { plan, limits } = await getPlanSummary(user.id);
    if (durationMs > limits.exportSeconds * 1000 + 2000) {
        return planLimit(`Your ${limits.name} plan allows videos up to ${describeSeconds(limits.exportSeconds)}. Trim it, or upgrade for longer videos.`);
    }
    if (sizeBytes > maxUploadBytes(limits)) {
        return planLimit(`This file is larger than your ${limits.name} plan allows for a ${describeSeconds(limits.exportSeconds)} video. Export it at 720p or trim it.`);
    }
    const { count } = await user.supabase.from('videos').select('id', { count: 'exact', head: true });
    if ((count ?? 0) >= limits.hostedVideos) {
        return planLimit(`Your ${limits.name} plan can host ${limits.hostedVideos} videos. Delete one in Videos${plan === 'studio' ? '' : ', or upgrade for more'}.`);
    }

    const id = crypto.randomUUID();
    const storageKey = videoObjectKey(user.id, id, contentType);
    const posterKey = body?.hasPoster ? posterObjectKey(user.id, id) : null;
    const { data, error } = await user.supabase.from('videos').insert({
        id,
        owner_id: user.id,
        title,
        content_type: contentType,
        size_bytes: sizeBytes,
        duration_ms: durationMs,
        storage_key: storageKey,
        poster_key: posterKey,
    }).select(VIDEO_COLUMNS).single();
    if (error || !data) {
        console.error('Could not create video:', describeDbError(error));
        return fail(isMissingTable(error) ? MISSING_TABLES_MESSAGE : isMissingColumn(error) ? MISSING_COLUMNS_MESSAGE : 'Could not start the upload.', 500);
    }

    return Response.json({
        video: toVideoRecord(data as VideoRow),
        uploadUrl: r2Url('PUT', storageKey, 3600),
        posterUploadUrl: posterKey ? r2Url('PUT', posterKey, 3600) : null,
    });
}
