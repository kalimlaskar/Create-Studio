import { deleteObject, headObject } from '@/lib/storage/r2';
import { getStudioUser, newSlug, readUploadedDurationMs, toVideoRecord, VIDEO_COLUMNS, type VideoRow } from '@/lib/videos/server';
import { getPlanSummary } from '@/lib/plans/server';
import { maxUploadBytes } from '@/components/pricing/planLimits';
import { MAX_UPLOAD_BYTES } from '@/lib/videos/types';

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Confirms the file reached R2, marks the video ready and creates its default share link. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);

    const { data: row } = await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle();
    if (!row) return fail('Video not found.', 404);
    const video = row as VideoRow;

    const object = await headObject(video.storage_key).catch(() => null);
    if (!object) return fail('The upload didn’t finish. Please try again.', 409);
    // Check the file that actually arrived, not what the browser said it would be.
    const { limits } = await getPlanSummary(user.id);
    const reject = async (message: string, status: number) => {
        await deleteObject(video.storage_key).catch(() => {});
        if (video.poster_key) await deleteObject(video.poster_key).catch(() => {});
        await user.supabase.from('videos').delete().eq('id', id);
        return Response.json({ error: message, upgradeUrl: '/pricing' }, { status });
    };
    if (object.size > Math.min(MAX_UPLOAD_BYTES, maxUploadBytes(limits))) {
        return reject(`This file is larger than your ${limits.name} plan allows.`, 413);
    }
    const realDurationMs = await readUploadedDurationMs(video.storage_key, object.size).catch(() => null);
    if (realDurationMs !== null && realDurationMs > limits.exportSeconds * 1000 + 2000) {
        return reject(`This video is longer than your ${limits.name} plan allows (${Math.round(limits.exportSeconds / 60) || 1} min).`, 403);
    }
    if (video.poster_key && !(await headObject(video.poster_key).catch(() => null))) {
        video.poster_key = null;
    }

    const { data: updated, error } = await user.supabase.from('videos')
        .update({ status: 'ready', size_bytes: object.size, poster_key: video.poster_key, duration_ms: realDurationMs ?? video.duration_ms, updated_at: new Date().toISOString() })
        .eq('id', id).select(VIDEO_COLUMNS).single();
    if (error || !updated) return fail('Could not finish the upload.', 500);

    const { data: existing } = await user.supabase.from('share_links').select('slug').eq('video_id', id).eq('is_default', true).maybeSingle();
    let slug = existing?.slug ?? null;
    if (!slug) {
        slug = newSlug();
        const { error: linkError } = await user.supabase.from('share_links').insert({ video_id: id, owner_id: user.id, slug, is_default: true });
        if (linkError) {
            console.error('Could not create share link:', linkError);
            slug = null;
        }
    }

    return Response.json({ video: toVideoRecord(updated as VideoRow), slug });
}
