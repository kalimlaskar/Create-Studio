import { deleteObject, headObject, isR2Configured, r2Url, readObjectRange } from '@/lib/storage/r2';
import { getStudioUser, posterUrl, toVideoRecord, VIDEO_COLUMNS, type VideoRow } from '@/lib/videos/server';

// A custom thumbnail. The browser turns the chosen frame or image into a JPEG, uploads it
// straight to R2 (POST gives the upload URL), then PUT checks it and makes it the poster.
// Each thumbnail gets a new file name, so link previews and inboxes don't keep the old one.

const fail = (error: string, status: number) => Response.json({ error }, { status });
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

async function ownVideo(id: string) {
    const user = await getStudioUser();
    if (!user) return { error: fail('Sign in again.', 401) };
    if (!isR2Configured()) return { error: fail('Video hosting isn’t set up on this server.', 503) };
    const { data: row } = /^[0-9a-f-]{36}$/.test(id) ? await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle() : { data: null };
    if (!row) return { error: fail('Video not found.', 404) };
    const video = row as VideoRow;
    if (video.banned_at) return { error: fail('This video was taken down, so it can’t be changed.', 403) };
    return { user, video };
}

/** Where the browser should upload the new thumbnail. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const found = await ownVideo(id);
    if ('error' in found) return found.error;
    const key = `videos/${found.video.owner_id}/${found.video.id}/poster-${Date.now().toString(36)}.jpg`;
    return Response.json({ key, uploadUrl: r2Url('PUT', key, 600) }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Checks the uploaded thumbnail and switches the video to it. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const found = await ownVideo(id);
    if ('error' in found) return found.error;
    const { user, video } = found;

    const body = await request.json().catch(() => null) as { key?: unknown } | null;
    const key = typeof body?.key === 'string' ? body.key : '';
    // Only a file uploaded for this video, through POST above.
    if (!new RegExp(`^videos/${video.owner_id}/${video.id}/poster-[a-z0-9]{1,12}\\.jpg$`).test(key)) return fail('That thumbnail upload isn’t valid. Try again.', 400);
    if (key === video.poster_key) return Response.json({ video: toVideoRecord(video), posterUrl: posterUrl(video, 6 * 3600) });

    const object = await headObject(key).catch(() => null);
    if (!object) return fail('The thumbnail didn’t finish uploading. Try again.', 409);
    // Check it's really a JPEG of a sensible size, whatever the browser claimed.
    const start = object.size > 0 && object.size <= MAX_POSTER_BYTES ? await readObjectRange(key, 'bytes=0-2').catch(() => null) : null;
    if (!start || start[0] !== 0xff || start[1] !== 0xd8 || start[2] !== 0xff) {
        await deleteObject(key).catch(() => {});
        return fail('That image couldn’t be used. Try a JPG or PNG under 2 MB.', 400);
    }

    const { data: updated, error } = await user.supabase.from('videos').update({ poster_key: key, updated_at: new Date().toISOString() }).eq('id', video.id).select(VIDEO_COLUMNS).single();
    if (error || !updated) {
        await deleteObject(key).catch(() => {});
        return fail('Could not save the thumbnail. Try again.', 500);
    }
    if (video.poster_key) await deleteObject(video.poster_key).catch((problem) => console.error('Could not delete the old thumbnail:', problem));
    const row = updated as VideoRow;
    return Response.json({ video: toVideoRecord(row), posterUrl: posterUrl(row, 6 * 3600) }, { headers: { 'Cache-Control': 'no-store' } });
}
