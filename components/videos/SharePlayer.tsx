'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MousePointerClick, Play } from 'lucide-react';
import { formatClock, type Chapter } from '@/lib/videos/types';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';
const FLUSH_MS = 5000;

interface Props {
    slug: string;
    title: string;
    playbackUrl: string;
    posterUrl: string | null;
    chapters: Chapter[];
    durationMs: number;
    ctaLabel: string | null;
    ctaUrl: string | null;
}

type TrackEvent = { type: 'play' | 'pause' | 'seek' | 'ended' | 'chapter' | 'cta'; positionMs: number; detail?: string };

function viewerKey() {
    try {
        const saved = localStorage.getItem('cliprame-viewer');
        if (saved && /^[\w-]{8,64}$/.test(saved)) return saved;
        const fresh = crypto.randomUUID().replace(/-/g, '');
        localStorage.setItem('cliprame-viewer', fresh);
        return fresh;
    } catch {
        return crypto.randomUUID().replace(/-/g, '');
    }
}

/** Viewers who turned on Global Privacy Control or Do Not Track aren't tracked at all. */
const viewerOptedOut = () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1';

const deviceType = () => (/iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop');

/**
 * Reports viewing to /api/track: which seconds were played (and how often),
 * plus play, pause, seek, chapter and button events. Reports are batched every
 * few seconds and sent with sendBeacon when the page is hidden or closed.
 */
function useViewTracking(slug: string) {
    const key = useRef('');
    const sessionId = useRef<string | null>(null);
    const seconds = useRef(new Map<number, number>());
    const events = useRef<TrackEvent[]>([]);
    const position = useRef(0);
    const completed = useRef(false);
    const chain = useRef<Promise<void>>(Promise.resolve());
    const enabled = useRef(false);

    const payload = useCallback(() => {
        const body = {
            slug,
            viewerKey: key.current,
            sessionId: sessionId.current,
            device: deviceType(),
            positionMs: Math.round(position.current),
            completed: completed.current,
            seconds: [...seconds.current.entries()],
            events: events.current.splice(0),
        };
        seconds.current.clear();
        return body;
    }, [slug]);

    const flush = useCallback((force = false) => {
        if (!enabled.current) return;
        if (!force && !seconds.current.size && !events.current.length) return;
        // Reports run one after another so the first one can create the session.
        chain.current = chain.current.then(async () => {
            const body = payload();
            try {
                const response = await fetch('/api/track', { method: 'POST', body: JSON.stringify(body), keepalive: true });
                const data = await response.json().catch(() => ({})) as { sessionId?: string };
                if (data.sessionId) sessionId.current = data.sessionId;
            } catch { /* analytics never interrupt playback */ }
        });
    }, [payload]);

    useEffect(() => {
        if (viewerOptedOut()) return;
        enabled.current = true;
        key.current = viewerKey();
        flush(true); // counts the page open
        const timer = window.setInterval(() => flush(), FLUSH_MS);
        const onHide = () => {
            if (!enabled.current || document.visibilityState !== 'hidden' || (!seconds.current.size && !events.current.length)) return;
            const blob = new Blob([JSON.stringify(payload())], { type: 'text/plain' });
            navigator.sendBeacon('/api/track', blob);
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onHide);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', onHide);
        };
    }, [flush, payload]);

    return {
        countSecond(second: number) { seconds.current.set(second, (seconds.current.get(second) ?? 0) + 1); },
        event(event: TrackEvent) { events.current.push(event); if (event.type !== 'pause') flush(); },
        setPosition(ms: number) { position.current = Math.max(position.current, ms); },
        complete() { completed.current = true; },
        flush,
    };
}

export function SharePlayer({ slug, title, playbackUrl, posterUrl, chapters, durationMs, ctaLabel, ctaUrl }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastSecond = useRef<number | null>(null);
    const [currentMs, setCurrentMs] = useState(0);
    const [started, setStarted] = useState(false);
    const tracking = useViewTracking(slug);

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
