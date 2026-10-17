'use client';

import { useEffect, useRef, useState } from 'react';
import { ListVideo, MousePointerClick, Play, RotateCcw, X } from 'lucide-react';
import { formatClock, type Chapter } from '@/lib/videos/types';
import { useViewTracking } from '@/lib/videos/useViewTracking';
import type { PublicInteraction } from '@/lib/videos/interactions';
import { InteractionLayer } from './InteractionLayer';
import type { HostPage } from './LeadForm';

interface Props {
    slug: string;
    title: string;
    playbackUrl: string;
    posterUrl: string | null;
    chapters: Chapter[];
    durationMs: number;
    ctaLabel: string | null;
    ctaUrl: string | null;
    showBadge: boolean;
    autoplay: boolean;
    referrerHost: string | null;
    /** Unlock token for protected videos, sent with analytics. */
    accessToken?: string | null;
    interactions?: PublicInteraction[];
    recipientEmail?: string | null;
    /** The page the video is embedded on (from embed.js), for form hidden fields. */
    host?: HostPage | null;
}

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80';

/** Full-size player for embeds: chapters menu, end screen with the button, and the same tracking as share pages. */
export function EmbedPlayer({ slug, title, playbackUrl, posterUrl, chapters, durationMs, ctaLabel, ctaUrl, showBadge, autoplay, referrerHost, accessToken = null, interactions = [], recipientEmail = null, host = null }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastSecond = useRef<number | null>(null);
    const [started, setStarted] = useState(false);
    const [ended, setEnded] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [chaptersOpen, setChaptersOpen] = useState(false);
    const [currentMs, setCurrentMs] = useState(0);
    const tracking = useViewTracking(slug, { source: 'embed', referrerHost, accessToken });
    const hasCta = Boolean(ctaLabel && ctaUrl);

    // Popups open with ?autoplay=1. Browsers may block sound; then the play button stays.
    useEffect(() => {
        if (autoplay) void videoRef.current?.play().catch(() => {});
    }, [autoplay]);

    const play = () => void videoRef.current?.play().catch(() => {});

    const jumpTo = (chapter: Chapter) => {
        const video = videoRef.current;
        if (!video) return;
        tracking.event({ type: 'chapter', positionMs: chapter.startMs, detail: chapter.title });
        video.currentTime = chapter.startMs / 1000;
        setChaptersOpen(false);
        play();
    };

    const clickCta = () => tracking.event({ type: 'cta', positionMs: (videoRef.current?.currentTime ?? 0) * 1000, detail: ctaLabel ?? '' });
    const currentChapter = [...chapters].reverse().find((chapter) => currentMs >= chapter.startMs);

    return (
        <main className="relative h-dvh w-full overflow-hidden bg-[#0B0A10] font-sans text-white">
            <video
                ref={videoRef}
                src={playbackUrl}
                poster={posterUrl ?? undefined}
                controls={started && !ended}
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
                aria-label={title}
                onLoadedMetadata={(event) => {
                    // Tell embed.js the video's shape so the frame fits portrait and square videos too.
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth && videoHeight && window.parent !== window) {
                        window.parent.postMessage({ type: 'cliprame:resize', slug, ratio: videoWidth / videoHeight }, '*');
                    }
                }}
                onPlay={(event) => { setStarted(true); setEnded(false); setPlaying(true); tracking.event({ type: 'play', positionMs: event.currentTarget.currentTime * 1000 }); }}
                onPause={(event) => { setPlaying(false); if (!event.currentTarget.ended) tracking.event({ type: 'pause', positionMs: event.currentTarget.currentTime * 1000 }); }}
                onSeeked={(event) => { lastSecond.current = null; tracking.event({ type: 'seek', positionMs: event.currentTarget.currentTime * 1000 }); }}
                onEnded={(event) => { setEnded(true); setPlaying(false); tracking.complete(); tracking.event({ type: 'ended', positionMs: event.currentTarget.currentTime * 1000 }); }}
                onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    setCurrentMs(video.currentTime * 1000);
                    tracking.setPosition(video.currentTime * 1000);
                    if (video.paused || video.seeking) return;
                    const second = Math.floor(video.currentTime);
                    if (second !== lastSecond.current) {
                        tracking.countSecond(second);
                        lastSecond.current = second;
                    }
                }}
            />

            {/* Before the first play: poster with a big play button. */}
            {!started && (
                <button type="button" onClick={play} aria-label={`Play ${title}`} className={`group absolute inset-0 grid place-items-center bg-[linear-gradient(to_top,rgba(11,10,16,0.65),transparent_50%)] ${focus}`}>
                    <span className="flex h-[min(18vmin,84px)] w-[min(18vmin,84px)] items-center justify-center rounded-full bg-white/95 text-[#14121F] shadow-2xl transition group-hover:scale-105"><Play className="ml-[6%] h-1/3 w-1/3 fill-current" /></span>
                    <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-left">
                        <span className="line-clamp-2 text-sm font-semibold drop-shadow sm:text-base">{title}</span>
                        <span className="shrink-0 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{formatClock(durationMs)}</span>
                    </span>
                </button>
            )}

            {/* After the end: replay and the call to action. */}
            {ended && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B0A10]/80 px-6 text-center backdrop-blur-sm">
                    {hasCta && (
                        <a href={ctaUrl as string} target="_blank" rel="noopener noreferrer" onClick={clickCta} className={`inline-flex items-center gap-2 rounded-full bg-[#6A4CFF] px-6 py-3 text-sm font-bold shadow-[0_12px_28px_-10px_rgba(106,76,255,0.9)] transition hover:bg-[#5839e0] ${focus}`}>
                            <MousePointerClick className="h-4 w-4" /> {ctaLabel}
                        </a>
                    )}
                    <button type="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; play(); }} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 ${focus}`}>
                        <RotateCcw className="h-3.5 w-3.5" /> Watch again
                    </button>
                </div>
            )}

            {/* Top bar while paused: chapters and the button. */}
            {started && !ended && !playing && (chapters.length > 0 || hasCta) && (
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {chapters.length > 0 ? (
                        <button type="button" onClick={() => setChaptersOpen(true)} className={`inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-black/75 ${focus}`}>
                            <ListVideo className="h-3.5 w-3.5" /> {currentChapter?.title ?? 'Chapters'}
                        </button>
                    ) : <span />}
                    {hasCta && (
                        <a href={ctaUrl as string} target="_blank" rel="noopener noreferrer" onClick={clickCta} className={`inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF] px-3.5 py-1.5 text-xs font-bold hover:bg-[#5839e0] ${focus}`}>
                            <MousePointerClick className="h-3.5 w-3.5" /> {ctaLabel}
                        </a>
                    )}
                </div>
            )}

            {chaptersOpen && (
                <div role="dialog" aria-label="Chapters" className="absolute inset-0 overflow-y-auto bg-[#0B0A10]/90 p-4 backdrop-blur-md">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60">Chapters</p>
                        <button type="button" onClick={() => setChaptersOpen(false)} aria-label="Close chapters" className={`rounded-full p-1.5 text-white/70 hover:bg-white/10 ${focus}`}><X className="h-4 w-4" /></button>
                    </div>
                    <ol className="space-y-1">
                        {chapters.map((chapter) => (
                            <li key={chapter.startMs}>
                                <button type="button" onClick={() => jumpTo(chapter)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10 ${currentChapter === chapter ? 'bg-white/10 font-semibold' : ''} ${focus}`}>
                                    <span className="w-10 shrink-0 text-xs tabular-nums text-white/55">{formatClock(chapter.startMs)}</span>{chapter.title}
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {showBadge && (
                <a href="https://www.cliprame.com/?ref=embed" target="_blank" rel="noopener" className={`absolute ${started && !ended ? 'bottom-14' : 'bottom-3'} right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur transition hover:bg-black/75 ${focus} ${!started ? 'hidden' : ''}`}>
                    Powered by Cliprame
                </a>
            )}
            <InteractionLayer
                videoRef={videoRef}
                interactions={interactions}
                slug={slug}
                source="embed"
                host={host}
                accessToken={accessToken}
                prefillEmail={recipientEmail}
                onEvent={(type, detail) => tracking.event({ type, positionMs: (videoRef.current?.currentTime ?? 0) * 1000, detail })}
            />
        </main>
    );
}
