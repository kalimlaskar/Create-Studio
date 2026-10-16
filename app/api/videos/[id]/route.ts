import { deleteObject } from '@/lib/storage/r2';
import { getStudioUser, toVideoRecord, VIDEO_COLUMNS, type VideoRow } from '@/lib/videos/server';
import { normalizeChapters, normalizeCtaUrl } from '@/lib/videos/types';

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Updates the title, chapters and call to action. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);

    const { data: row } = await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle();
    if (!row) return fail('Video not found.', 404);
    const video = row as VideoRow;

    const body = await request.json().catch(() => null) as { title?: unknown; chapters?: unknown; ctaLabel?: unknown; ctaUrl?: unknown } | null;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body?.title !== undefined) {
        const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
        if (!title) return fail('Give the video a title.', 400);
        update.title = title;
    }
    if (body?.chapters !== undefined) {
        const chapters = normalizeChapters(body.chapters, video.duration_ms);
        if (!chapters) return fail('Each chapter needs a title and a start time inside the video, and no two can start at the same time.', 400);
        update.chapters = chapters;
    }
    if (body?.ctaLabel !== undefined || body?.ctaUrl !== undefined) {
        const label = typeof body?.ctaLabel === 'string' ? body.ctaLabel.trim().slice(0, 40) : '';
        const url = normalizeCtaUrl(body?.ctaUrl);
        if (label && !url) return fail('Enter a full link for the button, starting with https://', 400);
        update.cta_label = label && url ? label : null;
        update.cta_url = label && url ? url : null;
    }

    const { data, error } = await user.supabase.from('videos').update(update).eq('id', id).select(VIDEO_COLUMNS).single();
    if (error || !data) return fail('Could not save your changes.', 500);
    return Response.json({ video: toVideoRecord(data as VideoRow) });
}

/** Deletes the video, its files in R2, its links and its analytics. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);

    const { data: row } = await user.supabase.from('videos').select('storage_key,poster_key').eq('id', id).maybeSingle();
    if (!row) return fail('Video not found.', 404);
    try {
        await deleteObject(row.storage_key);
        if (row.poster_key) await deleteObject(row.poster_key);
    } catch (error) {
        console.error('Could not delete video files:', error);
        return fail('Could not delete the video file. Please try again.', 502);
    }
    const { error } = await user.supabase.from('videos').delete().eq('id', id);
    if (error) return fail('Could not delete the video.', 500);
    return Response.json({ ok: true });
}
