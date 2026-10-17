import { cookies } from 'next/headers';
import { findShare } from '@/lib/videos/public';
import { getStudioUser, playbackUrl, posterUrl } from '@/lib/videos/server';
import { leadCookieName, readUnlock, signLead, unlockCookieName, unlockCookieOptions } from '@/lib/videos/access';
import { cleanQuery, emailFrom, readInteractions, resolveTemplate, validateAnswers, type FormInteraction } from '@/lib/videos/interactions';
import { forwardLead } from '@/lib/leads/forward';
import { notifyLead } from '@/lib/integrations/notify';
import { ipHash, isAutomatedAgent } from '@/lib/videos/tracking';

// Public endpoint behind every in-video form. The answers are checked against the
// creator's form, hidden values are filled in here (never in the browser), the lead
// is saved and forwarded, and a gate form hands back the video once it's done.

const SUBMISSIONS_PER_IP_PER_HOUR = 20;
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

interface Body {
    slug?: unknown;
    interactionId?: unknown;
    answers?: unknown;
    /** The page the viewer is on: its query (UTM tags), referrer and address. */
    context?: { query?: unknown; referrer?: unknown; pageUrl?: unknown; source?: unknown };
    viewerKey?: unknown;
    accessToken?: unknown;
    /** Honeypot: a field people never see. Bots fill it in. */
    website?: unknown;
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as Body | null;
    if (!body || typeof body.slug !== 'string' || typeof body.interactionId !== 'string') return fail('Bad request.');
    if (isAutomatedAgent(request.headers.get('user-agent'))) return fail('Bad request.');

    const share = await findShare(body.slug);
    if (!share) return fail('This video isn’t available.', 404);
    const { admin, link, video } = share;
    const form = readInteractions(video.interactions).find((item): item is FormInteraction => item.type === 'form' && item.id === body.interactionId);
    if (!form) return fail('This form is no longer available. Reload the page.', 404);

    // A locked video's forms are only for people who unlocked it.
    const cookieStore = await cookies();
    const viewer = await getStudioUser().catch(() => null);
    const isOwner = viewer?.id === video.owner_id;
    if (video.access_mode !== 'public' && !isOwner) {
        const unlock = readUnlock(body.accessToken, video) ?? readUnlock(cookieStore.get(unlockCookieName(video.id))?.value, video);
        if (!unlock) return fail('Unlock the video first.', 403);
    }

    const checked = validateAnswers(form, body.answers);
    if (!checked.ok) return fail(checked.error);
    const email = emailFrom(form, checked.values);
    const gate = form.placement === 'start';

    const grant = () => {
        if (!gate) return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
        const token = signLead(video.id, form.id, email);
        if (!token) return fail('Forms aren’t set up on this server.', 503);
        cookieStore.set(leadCookieName(video.id), token, unlockCookieOptions());
        return Response.json({ ok: true, playbackUrl: playbackUrl(video), posterUrl: posterUrl(video, 6 * 3600) }, { headers: { 'Cache-Control': 'no-store' } });
    };

    // Bots that fill in the invisible field get a normal-looking answer and nothing is saved.
    if (typeof body.website === 'string' && body.website.trim()) return grant();
    // The creator testing their own form isn't a lead.
    if (isOwner) return grant();

    const hashed = ipHash(request);
    if (hashed) {
        const { count } = await admin.from('lead_submissions').select('id', { count: 'exact', head: true })
            .eq('ip_hash', hashed).gt('created_at', new Date(Date.now() - 3600_000).toISOString());
        if ((count ?? 0) >= SUBMISSIONS_PER_IP_PER_HOUR) return fail('Too many submissions. Try again later.', 429);
    }

    const context = body.context ?? {};
    const source = context.source === 'embed' ? 'embed' : 'share';
    const pageUrl = typeof context.pageUrl === 'string' ? context.pageUrl.slice(0, 500) : '';
    const hidden: Record<string, string> = {};
    for (const field of form.hidden) {
        hidden[field.name] = resolveTemplate(field.value, {
            query: cleanQuery(context.query),
            referrer: typeof context.referrer === 'string' ? context.referrer.slice(0, 500) : '',
            pageUrl,
            videoTitle: video.title,
            videoId: video.id,
            linkName: link.recipient_name ?? '',
            linkEmail: link.recipient_email ?? '',
            linkCompany: link.recipient_company ?? '',
            source,
            now: new Date(),
        });
    }

    const forwarded = await forwardLead(form.destination, { ...checked.values, ...hidden }, { pageUrl: pageUrl || `${new URL(request.url).origin}/v/${link.slug}`, pageName: video.title });
    if (forwarded.status === 'failed') console.error('Could not forward lead:', forwarded.error);

    const { error } = await admin.from('lead_submissions').insert({
        video_id: video.id,
        owner_id: video.owner_id,
        share_link_id: link.id,
        interaction_id: form.id,
        form_title: form.title.slice(0, 120),
        fields: checked.values,
        hidden,
        email,
        viewer_key: typeof body.viewerKey === 'string' && /^[\w-]{8,64}$/.test(body.viewerKey) ? body.viewerKey : null,
        ip_hash: hashed,
        forward_status: forwarded.status,
        forward_error: forwarded.status === 'failed' ? forwarded.error : null,
    });
    if (error) {
        console.error('Could not save lead:', error);
        return fail('Could not send the form. Please try again.', 500);
    }

    notifyLead({ admin, request, video, link, form: { id: form.id, title: form.title, values: checked.values, hidden }, email, source });
    return grant();
}
