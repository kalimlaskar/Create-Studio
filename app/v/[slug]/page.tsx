import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { SharePlayer } from '@/components/videos/SharePlayer';
import { GatedSharePlayer } from '@/components/videos/VideoGate';
import { findShare, ownerDisplayName } from '@/lib/videos/public';
import { getStudioUser, playbackUrl, posterUrl } from '@/lib/videos/server';
import { resolveGate } from '@/lib/videos/gating';
import { formatClock } from '@/lib/videos/types';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const share = await findShare(slug);
    if (!share) return { title: 'Video not available | Cliprame', robots: { index: false } };
    const owner = await ownerDisplayName(share.video.owner_id);
    const description = owner ? `A ${formatClock(share.video.duration_ms)} video from ${owner}` : `A ${formatClock(share.video.duration_ms)} video`;
    return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
        title: `${share.video.title} | Cliprame`,
        description,
        robots: { index: false, follow: false },
        openGraph: { title: share.video.title, description, images: [{ url: `/v/${slug}/thumbnail`, width: 960, height: 540 }] },
    };
}

export default async function SharePage({ params }: Props) {
    const { slug } = await params;
    const share = await findShare(slug);
    if (!share) notFound();
    const { video, link } = share;
    const [owner, viewer] = await Promise.all([ownerDisplayName(video.owner_id), getStudioUser().catch(() => null)]);
    // Protected videos: no video address in the page until the viewer unlocks it.
    const access = await resolveGate(video, viewer?.id ?? null);
    const player = {
        slug,
        title: video.title,
        chapters: Array.isArray(video.chapters) ? video.chapters : [],
        durationMs: video.duration_ms,
        ctaLabel: video.cta_label,
        ctaUrl: video.cta_url,
        interactions: access.interactions,
        recipientEmail: link.recipient_email,
    };
    const firstName = link.recipient_name?.trim().split(/\s+/)[0];

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F]`}>
            <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
                <Link href="/" className="inline-flex items-center gap-2 rounded-full">
                    <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                    <span className="font-[family-name:var(--font-display)] font-bold">Cliprame</span>
                </Link>
                {owner && <span className="truncate text-sm text-[#14121F]/60">Shared by <span className="font-semibold text-[#14121F]">{owner}</span></span>}
            </header>

            <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
                {firstName && <p className="text-sm font-semibold text-[#6A4CFF]">Hi {firstName}, this video is for you</p>}
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight sm:text-4xl">{video.title}</h1>
                <div className="mt-6">
                    {access.open ? (
                        <SharePlayer {...player} playbackUrl={playbackUrl(video)} posterUrl={posterUrl(video, 6 * 3600)} accessToken={access.token} />
                    ) : (
                        <GatedSharePlayer {...player} mode={access.mode} gate={access.gate} recipientEmail={link.recipient_email} />
                    )}
                </div>
                <p className="mt-10 max-w-2xl text-xs leading-5 text-[#14121F]/45">
                    {owner ?? 'The sender'} can see how this video is watched, such as which parts were played and whether the button was clicked. You don’t need an account. To opt out, turn on Global Privacy Control or “Do Not Track” in your browser.
                    {' '}<Link href="/privacy" className="font-semibold text-[#14121F]/60 hover:underline">Privacy</Link>
                    {' · '}<Link href="/" className="font-semibold text-[#14121F]/60 hover:underline">Made with Cliprame</Link>
                </p>
            </div>
        </main>
    );
}
