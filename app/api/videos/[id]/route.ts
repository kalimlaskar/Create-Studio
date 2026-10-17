import { deleteObject } from '@/lib/storage/r2';
import { getStudioUser, toVideoRecord, VIDEO_COLUMNS, type VideoRow } from '@/lib/videos/server';
import { accessSecretProblem, ACCESS_MODES, normalizeAccessEmails, normalizeChapters, normalizeCtaUrl, normalizeEmbedDomains, type AccessMode } from '@/lib/videos/types';
import { hashSecret, isEmailConfigured } from '@/lib/videos/access';
import { normalizeInteractions } from '@/lib/videos/interactions';
import { publicHttpsUrl } from '@/lib/integrations/server';
import { getPlanSummary } from '@/lib/plans/server';

const fail = (error: string, status: number) => Response.json({ error }, { status });

/** Updates the title, chapters, call to action, embedding and who can watch. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);

    const { data: row } = await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle();
    if (!row) return fail('Video not found.', 404);
    const video = row as VideoRow;

    const body = await request.json().catch(() => null) as { title?: unknown; chapters?: unknown; ctaLabel?: unknown; ctaUrl?: unknown; embedEnabled?: unknown; embedDomains?: unknown; accessMode?: unknown; accessSecret?: unknown; accessEmails?: unknown; interactions?: unknown } | null;
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

    if (body?.embedEnabled !== undefined) {
        if (typeof body.embedEnabled !== 'boolean') return fail('Say whether embedding is on or off.', 400);
        update.embed_enabled = body.embedEnabled;
    }
    if (body?.embedDomains !== undefined) {
        const domains = normalizeEmbedDomains(body.embedDomains);
        if (!domains) return fail('Enter website addresses like acme.com or *.acme.com, up to 20.', 400);
        // Limiting embeds to your own websites is a paid feature.
        if (domains.length && !(await getPlanSummary(user.id)).isPaid) {
            return Response.json({ error: 'Limiting embeds to your websites is available on Creator and Studio plans.', upgradeUrl: '/pricing' }, { status: 403 });
        }
        update.embed_domains = domains;
    }

    if (body?.accessMode !== undefined || body?.accessSecret !== undefined || body?.accessEmails !== undefined) {
        const mode = (body?.accessMode ?? video.access_mode) as AccessMode;
        if (!ACCESS_MODES.includes(mode)) return fail('Choose who can watch the video.', 400);
        if (mode === 'pin' || mode === 'password') {
            const secret = body?.accessSecret;
            // Keeping the same mode without a new value keeps the current PIN or password.
            if (secret === undefined || secret === '') {
                if (video.access_mode !== mode) return fail(mode === 'pin' ? 'Set a PIN for viewers to enter.' : 'Set a password for viewers to enter.', 400);
            } else {
                const problem = accessSecretProblem(mode, secret);
                if (problem) return fail(problem, 400);
                update.access_secret_hash = await hashSecret(secret as string);
            }
        } else {
            update.access_secret_hash = null;
        }
        if (mode === 'email' && video.access_mode !== 'email' && !isEmailConfigured()) {
            return fail('Email codes need an email service. Add RESEND_API_KEY and ACCESS_EMAIL_FROM on the server.', 400);
        }
        if (body?.accessEmails !== undefined) {
            const emails = normalizeAccessEmails(body.accessEmails);
            if (!emails) return fail('Enter email addresses like ana@acme.com, or whole companies like @acme.com.', 400);
            update.access_emails = emails;
        }
        update.access_mode = mode;
        // Any change to the protection signs out viewers who unlocked before.
        update.access_version = video.access_version + 1;
    }

    if (body?.interactions !== undefined) {
        const result = normalizeInteractions(body.interactions, video.duration_ms);
        if (!result.ok) return fail(result.error, 400);
        // Forms may post to the creator's own backend, but never to a private network address.
        for (const item of result.interactions) {
            if (item.type === 'form' && item.destination.kind === 'url' && !publicHttpsUrl(item.destination.url)) {
                return fail(`“${item.title}” posts to an address that isn’t a public https:// website.`, 400);
            }
        }
        update.interactions = result.interactions;
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
