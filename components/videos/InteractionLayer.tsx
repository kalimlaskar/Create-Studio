'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { CalendarCheck, Check, ExternalLink, MousePointerClick, Play, X } from 'lucide-react';
import type { PublicInteraction } from '@/lib/videos/interactions';
import { LeadForm, type HostPage } from './LeadForm';

// Forms, buttons and booking embeds that appear while the video plays or when it
// ends. The player pauses for them; a form the creator made required has to be
// filled in before the video carries on.

interface Props {
    videoRef: RefObject<HTMLVideoElement | null>;
    /** Everything except the gate form, which is handled before the player loads. */
    interactions: PublicInteraction[];
    slug: string;
    source: 'share' | 'embed';
    host?: HostPage | null;
    accessToken?: string | null;
    prefillEmail?: string | null;
    /** Reports what the viewer did, for analytics. */
    onEvent: (type: 'cta' | 'form' | 'booking', detail: string) => void;
}

/** Calendly only tells the page about bookings when it knows it's embedded. */
function bookingSrc(url: string, email: string | null) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.endsWith('calendly.com')) {
            parsed.searchParams.set('embed_domain', window.location.hostname);
            parsed.searchParams.set('embed_type', 'Inline');
            if (email) parsed.searchParams.set('email', email);
        }
        return parsed.href;
    } catch {
        return url;
    }
}

export function InteractionLayer({ videoRef, interactions, slug, source, host = null, accessToken = null, prefillEmail = null, onEvent }: Props) {
    const [active, setActive] = useState<PublicInteraction | null>(null);
    const [booked, setBooked] = useState(false);
    const done = useRef(new Set<string>());
    const activeRef = useRef<PublicInteraction | null>(null);
    useEffect(() => { activeRef.current = active; }, [active]);

    const timed = interactions.filter((item) => item.placement === 'time').sort((a, b) => (a.atMs ?? 0) - (b.atMs ?? 0));
    const atEnd = interactions.filter((item) => item.placement === 'end');

    const show = (item: PublicInteraction) => {
        activeRef.current = item;
        videoRef.current?.pause();
        setBooked(false);
        setActive(item);
    };

    const close = (resume: boolean) => {
        const item = activeRef.current;
        if (!item) return;
        done.current.add(item.id);
        setActive(null);
        if (item.placement === 'end') {
            const next = atEnd.find((candidate) => !done.current.has(candidate.id));
            if (next) window.setTimeout(() => show(next), 150);
        } else if (resume) {
            void videoRef.current?.play().catch(() => {});
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !interactions.length) return;
        const onTime = () => {
            if (activeRef.current) return;
            const ms = video.currentTime * 1000;
            const due = timed.find((item) => !done.current.has(item.id) && (item.atMs ?? 0) <= ms);
            if (due) show(due);
        };
        const onEnded = () => {
            const first = atEnd.find((item) => !done.current.has(item.id));
            if (first) show(first);
        };
        // A required form can't be played past.
        const onPlay = () => {
            const current = activeRef.current;
            if (current && current.type === 'form' && !current.skippable) video.pause();
        };
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('ended', onEnded);
        video.addEventListener('play', onPlay);
        return () => {
            video.removeEventListener('timeupdate', onTime);
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('play', onPlay);
        };
        // The lists are derived from props that don't change while the page is open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef, interactions]);

    // Calendly posts a message to the page when a meeting is booked.
    useEffect(() => {
        if (!active || active.type !== 'booking') return;
        const onMessage = (event: MessageEvent) => {
            const data = event.data as { event?: string } | null;
            let host = '';
            try { host = new URL(event.origin).hostname; } catch { return; }
            if (!/(^|\.)calendly\.com$/.test(host) || data?.event !== 'calendly.event_scheduled') return;
            setBooked(true);
            onEvent('booking', active.title || 'Booking');
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [active, onEvent]);

    if (!active) return null;

    const isBooking = active.type === 'booking';
    const canSkip = active.type !== 'form' || active.skippable;
    const continueLabel = active.placement === 'end' ? 'Close' : 'Keep watching';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={active.title || (active.type === 'button' ? active.label : 'Form')}
            className={`z-40 flex items-center justify-center bg-[#0B0A10]/85 p-4 backdrop-blur-md ${isBooking ? 'fixed inset-0' : 'fixed inset-0 sm:absolute'}`}
        >
            <div className={`relative max-h-full w-full overflow-y-auto rounded-3xl bg-white p-6 text-[#14121F] shadow-2xl ${isBooking ? 'flex h-[min(46rem,94dvh)] max-w-3xl flex-col' : 'max-w-lg'}`}>
                {canSkip && (
                    <button type="button" onClick={() => close(true)} aria-label={continueLabel} className="absolute right-3 top-3 rounded-full p-1.5 text-[#14121F]/45 hover:bg-[#14121F]/[0.06] hover:text-[#14121F]">
                        <X className="h-4 w-4" />
                    </button>
                )}

                {active.type === 'form' && (
                    <LeadForm
                        form={active}
                        slug={slug}
                        source={source}
                        host={host}
                        accessToken={accessToken}
                        tone="light"
                        prefillEmail={prefillEmail}
                        onDone={() => { onEvent('form', active.title || 'Form'); close(true); }}
                        onSkip={active.skippable ? () => close(true) : undefined}
                    />
                )}

                {active.type === 'button' && (
                    <div className="pr-6">
                        {active.title && <h2 className="text-lg font-semibold">{active.title}</h2>}
                        {active.text && <p className="mt-1 text-sm leading-6 text-[#14121F]/60">{active.text}</p>}
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <a
                                href={active.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => { onEvent('cta', active.label); close(false); }}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#6A4CFF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5839e0]"
                            >
                                <MousePointerClick className="h-4 w-4" /> {active.label}
                            </a>
                            <button type="button" onClick={() => close(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#14121F]/55 hover:text-[#14121F]">
                                {active.placement === 'end' ? 'No thanks' : <><Play className="h-3.5 w-3.5" /> Keep watching</>}
                            </button>
                        </div>
                    </div>
                )}

                {isBooking && (
                    <>
                        <div className="flex items-start justify-between gap-3 pr-8">
                            <div>
                                <h2 className="text-lg font-semibold">{active.title || 'Book a time'}</h2>
                                {active.text && <p className="mt-0.5 text-sm text-[#14121F]/60">{active.text}</p>}
                            </div>
                            <a href={active.url} target="_blank" rel="noopener noreferrer" onClick={() => onEvent('cta', active.title || 'Booking page')} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#6A4CFF] hover:underline">
                                Open in a new tab <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                        {booked ? (
                            <div className="flex flex-1 flex-col items-center justify-center text-center">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white"><CalendarCheck className="h-7 w-7" /></span>
                                <p className="mt-4 text-lg font-semibold">You’re booked in</p>
                                <p className="mt-1 text-sm text-[#14121F]/60">Check your inbox for the invite.</p>
                                <button type="button" onClick={() => close(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#14121F] px-4 py-2 text-sm font-semibold text-white"><Check className="h-4 w-4" /> {continueLabel}</button>
                            </div>
                        ) : (
                            <iframe
                                src={bookingSrc(active.url, prefillEmail)}
                                title={active.title || 'Booking'}
                                className="mt-4 min-h-0 w-full flex-1 rounded-2xl border border-[#14121F]/10"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
