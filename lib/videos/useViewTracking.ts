'use client';

import { useCallback, useEffect, useRef } from 'react';

// Reports viewing of a shared or embedded video to /api/track (see that route for
// the server-side limits). Used by the share page and the embed player.

const FLUSH_MS = 5000;

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
export function useViewTracking(slug: string, { source, referrerHost = null }: { source: 'share' | 'embed'; referrerHost?: string | null }) {
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
            source,
            referrerHost,
            positionMs: Math.round(position.current),
            completed: completed.current,
            seconds: [...seconds.current.entries()],
            events: events.current.splice(0),
        };
        seconds.current.clear();
        return body;
    }, [slug, source, referrerHost]);

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
