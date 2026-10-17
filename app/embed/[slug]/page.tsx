import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { EmbedPlayer } from '@/components/videos/EmbedPlayer';
import { GatedEmbedPlayer } from '@/components/videos/VideoGate';
import { findShare } from '@/lib/videos/public';
import { getStudioUser, playbackUrl, posterUrl } from '@/lib/videos/server';
import { resolveGate } from '@/lib/videos/gating';
import { getEffectivePlan } from '@/lib/plans/server';
import { hostAllowed } from '@/lib/videos/types';

// The player shown inside other websites, via /embed.js or an iframe.
// Framing is allowed for this route only (see next.config.ts).

export const metadata: Metadata = { title: 'Cliprame video', robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ autoplay?: string; ctx?: string; page?: string; ref?: string }> };

function Unavailable({ message }: { message: string }) {
    return (
        <main className="grid h-dvh place-items-center bg-[#0B0A10] px-6 text-center text-white">
            <div>
                <p className="text-sm font-semibold">This video can’t be played here</p>
                <p className="mt-1 text-xs text-white/60">{message}</p>
            </div>
        </main>
    );
}

export default async function EmbedPage({ params, searchParams }: Props) {
    const [{ slug }, { autoplay, ctx, page, ref }] = await Promise.all([params, searchParams]);
    const share = await findShare(slug);
    if (!share) return <Unavailable message="The link may have been turned off or the video deleted." />;
    const { video } = share;
    if (!video.embed_enabled) return <Unavailable message="The owner hasn’t allowed this video to be embedded." />;

    // The website embedding us, from the browser's Referer header (origin only by default).
    const requestHeaders = await headers();
    let embeddingHost: string | null = null;
    try {
        const referer = requestHeaders.get('referer');
        if (referer) embeddingHost = new URL(referer).hostname.toLowerCase();
    } catch { /* no usable referrer */ }
    const ownHost = (requestHeaders.get('host') ?? '').split(':')[0].toLowerCase();
    const onOwnSite = embeddingHost === ownHost;

    const allowed = video.embed_domains ?? [];
    if (allowed.length && !onOwnSite && (!embeddingHost || !hostAllowed(embeddingHost, allowed))) {
        return <Unavailable message="The owner only allows this video on their own website." />;
    }

    const [plan, viewer] = await Promise.all([
        getEffectivePlan(video.owner_id).catch(() => 'free' as const),
        getStudioUser().catch(() => null),
    ]);
    // Protected videos: no video address in the page until the viewer unlocks it.
    const access = await resolveGate(video, viewer?.id ?? null);
    const player = {
        slug,
        title: video.title,
        chapters: Array.isArray(video.chapters) ? video.chapters : [],
        durationMs: video.duration_ms,
        ctaLabel: video.cta_label,
        ctaUrl: video.cta_url,
        showBadge: plan === 'free',
        autoplay: autoplay === '1',
        referrerHost: onOwnSite ? null : embeddingHost,
        interactions: access.interactions,
        recipientEmail: share.link.recipient_email,
        // The host page's link parameters and address, passed by embed.js, for form hidden fields.
        host: page ? { query: (ctx ?? '').slice(0, 1000), pageUrl: page.slice(0, 500), referrer: (ref ?? '').slice(0, 500) } : null,
    };

    if (!access.open) return <GatedEmbedPlayer {...player} mode={access.mode} gate={access.gate} />;
    return <EmbedPlayer {...player} playbackUrl={playbackUrl(video)} posterUrl={posterUrl(video, 6 * 3600)} accessToken={access.token} />;
}
