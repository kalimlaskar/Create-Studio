'use client';

import { useRef, useState } from 'react';
import { MousePointerClick, Play } from 'lucide-react';
import { formatClock, type Chapter } from '@/lib/videos/types';
import { useViewTracking } from '@/lib/videos/useViewTracking';
import type { PublicInteraction } from '@/lib/videos/interactions';
import { InteractionLayer } from './InteractionLayer';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

interface Props {
    slug: string;
    title: string;
    playbackUrl: string;
    posterUrl: string | null;
    chapters: Chapter[];
    durationMs: number;
    ctaLabel: string | null;
    ctaUrl: string | null;
    /** Unlock token for protected videos, sent with analytics. */
    accessToken?: string | null;
    /** In-video forms, buttons and booking embeds (not the gate form). */
    interactions?: PublicInteraction[];
    /** The personal link's email, to pre-fill forms. */
    recipientEmail?: string | null;
}

export function SharePlayer({ slug, title, playbackUrl, posterUrl, chapters, durationMs, ctaLabel, ctaUrl, accessToken = null, interactions = [], recipientEmail = null }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastSecond = useRef<number | null>(null);
    const [currentMs, setCurrentMs] = useState(0);
    const [started, setStarted] = useState(false);
    const tracking = useViewTracking(slug, { source: 'share', accessToken });

    const currentChapter = [...chapters].reverse().find((chapter) => currentMs >= chapter.startMs);

    const jumpTo = (chapter: Chapter) => {
        const video = videoRef.current;
        if (!video) return;
        tracking.event({ type: 'chapter', positionMs: chapter.startMs, detail: chapter.title });
        video.currentTime = chapter.startMs / 1000;
        void video.play().catch(() => {});
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
                <div className="relative overflow-hidden rounded-3xl bg-[#0B0A10] shadow-[0_30px_60px_-30px_rgba(20,18,31,0.6)]">
                    <video
                        ref={videoRef}
                        src={playbackUrl}
                        poster={posterUrl ?? undefined}
                        controls={started}
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full"
                        onPlay={(event) => { setStarted(true); tracking.event({ type: 'play', positionMs: event.currentTarget.currentTime * 1000 }); }}
                        onPause={(event) => { if (!event.currentTarget.ended) tracking.event({ type: 'pause', positionMs: event.currentTarget.currentTime * 1000 }); }}
                        onSeeked={(event) => { lastSecond.current = null; tracking.event({ type: 'seek', positionMs: event.currentTarget.currentTime * 1000 }); }}
                        onEnded={(event) => { tracking.complete(); tracking.event({ type: 'ended', positionMs: event.currentTarget.currentTime * 1000 }); }}
                        onTimeUpdate={(event) => {
                            const video = event.currentTarget;
                            const ms = video.currentTime * 1000;
                            setCurrentMs(ms);
                            tracking.setPosition(ms);
                            if (video.paused || video.seeking) return;
                            // Count each second once per pass; seeking back and replaying counts it again.
                            const second = Math.floor(video.currentTime);
                            if (second !== lastSecond.current) {
                                tracking.countSecond(second);
                                lastSecond.current = second;
                            }
                        }}
                    />
                    <InteractionLayer
                        videoRef={videoRef}
                        interactions={interactions}
                        slug={slug}
                        source="share"
                        accessToken={accessToken}
                        prefillEmail={recipientEmail}
                        onEvent={(type, detail) => tracking.event({ type, positionMs: (videoRef.current?.currentTime ?? 0) * 1000, detail })}
                    />
                    {!started && (
                        <button type="button" onClick={() => void videoRef.current?.play()} aria-label={`Play ${title}`} className={`group absolute inset-0 grid place-items-center bg-[linear-gradient(to_top,rgba(11,10,16,0.55),transparent_45%)] ${focus}`}>
                            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-[#14121F] shadow-2xl transition group-hover:scale-105"><Play className="ml-1 h-8 w-8 fill-current" /></span>
                            <span className="absolute bottom-4 right-4 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold tabular-nums text-white">{formatClock(durationMs)}</span>
                        </button>
                    )}
                </div>

                {ctaLabel && ctaUrl && (
                    <a
                        href={ctaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => tracking.event({ type: 'cta', positionMs: (videoRef.current?.currentTime ?? 0) * 1000, detail: ctaLabel })}
                        className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#6A4CFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(106,76,255,0.8)] transition hover:bg-[#5839e0] ${focus}`}>
                        <MousePointerClick className="h-4 w-4" /> {ctaLabel}
                    </a>
                )}
            </div>

            {chapters.length > 0 && (
                <aside aria-label="Chapters" className="self-start rounded-3xl border border-[#14121F]/8 bg-white p-3">
                    <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-[#14121F]/50">Chapters</p>
                    <ol className="space-y-1">
                        {chapters.map((chapter) => {
                            const active = started && currentChapter === chapter;
                            return (
                                <li key={chapter.startMs}>
                                    <button type="button" onClick={() => jumpTo(chapter)} aria-current={active ? 'true' : undefined} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${active ? 'bg-[#6A4CFF]/10 font-semibold text-[#14121F]' : 'hover:bg-[#F7F6FB]'} ${focus}`}>
                                        <span className={`w-11 shrink-0 text-xs tabular-nums ${active ? 'text-[#6A4CFF]' : 'text-[#14121F]/45'}`}>{formatClock(chapter.startMs)}</span>
                                        <span className="min-w-0 flex-1">{chapter.title}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </aside>
            )}
        </div>
    );
}
