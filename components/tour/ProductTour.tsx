'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

// A first-visit walkthrough: dims the page, spotlights one element at a time and
// explains it in a small card. Elements are found by their data-tour attribute.
// Each tour runs once per browser; "Take the tour" in the account menu replays it.

export interface TourStep {
    /** The data-tour value of the element to spotlight. Omit for a centred welcome card. */
    target?: string;
    title: string;
    body: string;
    /** Where the card sits relative to the element. Falls back when there's no room. */
    placement?: 'right' | 'bottom' | 'left' | 'top';
}

/** Fired by "Take the tour" to replay the tour on the current page. */
export const TOUR_EVENT = 'cliprame:tour';
export const startTour = () => window.dispatchEvent(new CustomEvent(TOUR_EVENT));

const storageKey = (id: string) => `cliprame-tour-${id}`;
const CARD_WIDTH = 340;
const GAP = 14;
const PAD = 8;

type Rect = { top: number; left: number; width: number; height: number };

const findTarget = (step: TourStep) => {
    if (!step.target) return null;
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? element : null;
};

export function ProductTour({ id, steps, delayMs = 700 }: { id: string; steps: TourStep[]; delayMs?: number }) {
    const [active, setActive] = useState<TourStep[] | null>(null);
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [card, setCard] = useState<{ top: number; left: number } | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const finish = useCallback(() => {
        try { localStorage.setItem(storageKey(id), 'done'); } catch { /* private mode: it shows again next time */ }
        setActive(null);
        setRect(null);
    }, [id]);

    const begin = useCallback(() => {
        // Only steps whose element is on screen right now (the sidebar is hidden on phones).
        const available = steps.filter((step) => !step.target || findTarget(step));
        if (!available.length) return;
        setIndex(0);
        setCard(null);
        setActive(available);
    }, [steps]);

    // First visit: start on its own. Later: only when asked.
    useEffect(() => {
        let seen = false;
        try { seen = localStorage.getItem(storageKey(id)) === 'done'; } catch { seen = true; }
        const timer = seen ? null : window.setTimeout(begin, delayMs);
        window.addEventListener(TOUR_EVENT, begin);
        return () => {
            if (timer) window.clearTimeout(timer);
            window.removeEventListener(TOUR_EVENT, begin);
        };
    }, [id, begin, delayMs]);

    const step = active?.[index] ?? null;

    // Measure the element and place the card; follow scrolling and resizing.
    const measure = useCallback(() => {
        if (!step) return;
        const element = findTarget(step);
        const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
        const cardHeight = cardRef.current?.offsetHeight ?? 200;
        if (!element) {
            setRect(null);
            setCard({ top: Math.max(16, (window.innerHeight - cardHeight) / 2), left: (window.innerWidth - width) / 2 });
            return;
        }
        const box = element.getBoundingClientRect();
        const spot = { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 };
        setRect(spot);

        const fits = {
            right: spot.left + spot.width + GAP + width <= window.innerWidth - 16,
            left: spot.left - GAP - width >= 16,
            bottom: spot.top + spot.height + GAP + cardHeight <= window.innerHeight - 16,
            top: spot.top - GAP - cardHeight >= 16,
        };
        const order = [step.placement ?? 'bottom', 'bottom', 'right', 'top', 'left'] as const;
        const side = order.find((option) => fits[option]) ?? 'bottom';
        const clampX = (x: number) => Math.min(Math.max(16, x), window.innerWidth - width - 16);
        const clampY = (y: number) => Math.min(Math.max(16, y), window.innerHeight - cardHeight - 16);
        const position = {
            right: { top: clampY(spot.top), left: spot.left + spot.width + GAP },
            left: { top: clampY(spot.top), left: spot.left - GAP - width },
            bottom: { top: spot.top + spot.height + GAP, left: clampX(spot.left) },
            top: { top: spot.top - GAP - cardHeight, left: clampX(spot.left) },
        }[side];
        setCard({ top: clampY(position.top), left: position.left });
    }, [step]);

    // Bring the element into view, then measure once scrolling settles.
    useLayoutEffect(() => {
        if (!step) return;
        const element = findTarget(step);
        const box = element?.getBoundingClientRect();
        if (element && box && (box.top < 80 || box.bottom > window.innerHeight - 40)) {
            element.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
        const frame = window.requestAnimationFrame(measure);
        const settle = window.setTimeout(measure, 380);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(settle);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [step, measure]);

    // Keyboard: arrows move, Escape skips. Focus the card for screen readers.
    useEffect(() => {
        if (!active) return;
        cardRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') finish();
            else if (event.key === 'ArrowRight') setIndex((value) => (value + 1 < active.length ? value + 1 : value));
            else if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, index, finish]);

    // Nothing until the first measurement, so the spotlight never flashes in the wrong place.
    if (!active || !step || !card) return null;

    const last = index === active.length - 1;
    const width = Math.min(CARD_WIDTH, typeof window === 'undefined' ? CARD_WIDTH : window.innerWidth - 32);
    const spotlight: CSSProperties = rect
        ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        : { top: '50%', left: '50%', width: 0, height: 0 };

    return (
        <div className="fixed inset-0 z-[80]" aria-live="polite">
            {/* The page, dimmed, with a hole cut around the element. Clicks are held so the tour isn't lost. */}
            <div
                aria-hidden="true"
                className="absolute rounded-2xl ring-2 ring-[#6A4CFF]/80 transition-all duration-300 ease-out motion-reduce:transition-none"
                style={{ ...spotlight, boxShadow: '0 0 0 9999px rgba(15, 13, 26, 0.58), 0 0 0 6px rgba(106, 76, 255, 0.18)' }}
            />
            <div className="absolute inset-0" onClick={(event) => event.stopPropagation()} />

            <div
                ref={cardRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tour-title"
                aria-describedby="tour-body"
                className="animate-dialog-in absolute rounded-2xl border border-[#14121F]/10 bg-white p-5 text-[#14121F] shadow-[0_30px_80px_-24px_rgba(15,13,26,0.55)] outline-none transition-[top,left] duration-300 ease-out motion-reduce:transition-none"
                style={{ width, top: card.top, left: card.left }}
            >
                <div className="flex items-start justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6A4CFF]">
                        {!step.target && <Sparkles className="h-3.5 w-3.5" />}
                        {step.target ? `Step ${index + 1} of ${active.length}` : 'Quick tour'}
                    </p>
                    <button type="button" onClick={finish} aria-label="Skip the tour" className="-mr-1.5 -mt-1.5 rounded-full p-1.5 text-[#14121F]/40 hover:bg-[#14121F]/[0.06] hover:text-[#14121F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <h2 id="tour-title" className="mt-1.5 text-lg font-semibold leading-snug">{step.title}</h2>
                <p id="tour-body" className="mt-1.5 text-sm leading-6 text-[#14121F]/65">{step.body}</p>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <div className="flex gap-1.5" aria-hidden="true">
                        {active.map((_, dot) => <span key={dot} className={`h-1.5 rounded-full transition-all duration-300 ${dot === index ? 'w-5 bg-[#6A4CFF]' : dot < index ? 'w-1.5 bg-[#6A4CFF]/40' : 'w-1.5 bg-[#14121F]/15'}`} />)}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {index === 0 ? (
                            <button type="button" onClick={finish} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#14121F]/50 hover:text-[#14121F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70">Skip</button>
                        ) : (
                            <button type="button" onClick={() => setIndex(index - 1)} aria-label="Previous step" className="rounded-lg p-2 text-[#14121F]/55 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70"><ArrowLeft className="h-4 w-4" /></button>
                        )}
                        <button
                            type="button"
                            onClick={() => (last ? finish() : setIndex(index + 1))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#14121F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2c2742] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2"
                        >
                            {last ? 'Got it' : index === 0 && !step.target ? 'Show me around' : 'Next'}{!last && <ArrowRight className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
