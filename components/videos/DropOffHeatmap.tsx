'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock, formatPercent, type ChapterStats, type HeatmapBucket } from '@/lib/videos/types';

// Three rows on the same time axis as the retention chart. Each row is its own
// measure, so each is shaded against its own peak (one violet hue, light → dark);
// exact shares are always in the tooltip and the table.
const RAMP = ['#E4DFFF', '#C2B6FF', '#9B88FF', '#6A4CFF', '#4128C9'];
const EMPTY = 'rgba(20,18,31,0.05)';
const ROW_HEIGHT = 28;
const ROW_GAP = 6;
const MARGIN = { top: 4, right: 16, bottom: 30, left: 92 };

type Metric = 'rewatched' | 'skipped' | 'droppedOff';
const ROWS: Array<{ key: Metric; label: string; verb: string }> = [
    { key: 'rewatched', label: 'Re-watched', verb: 're-watched' },
    { key: 'skipped', label: 'Skipped', verb: 'skipped' },
    { key: 'droppedOff', label: 'Dropped off', verb: 'left' },
];

interface Props {
    buckets: HeatmapBucket[];
    plays: number;
    durationMs: number;
    chapters: ChapterStats[];
    /** Jumps the preview player to a moment. */
    onSeek?: (ms: number) => void;
}

const shade = (value: number, peak: number) => {
    if (value <= 0 || peak <= 0) return EMPTY;
    return RAMP[Math.min(RAMP.length - 1, Math.floor((value / peak) * RAMP.length))];
};

export function DropOffHeatmap({ buckets, plays, durationMs, chapters, onSeek }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(640);
    const [active, setActive] = useState<number | null>(null);
    const [showTable, setShowTable] = useState(false);

    useEffect(() => {
        const element = wrapRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const height = MARGIN.top + ROWS.length * ROW_HEIGHT + (ROWS.length - 1) * ROW_GAP + MARGIN.bottom;
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotBottom = height - MARGIN.bottom;
    const total = Math.max(1, durationMs);
    const x = (ms: number) => MARGIN.left + (ms / total) * plotWidth;
    const rowY = (index: number) => MARGIN.top + index * (ROW_HEIGHT + ROW_GAP);
    const gap = plotWidth / Math.max(1, buckets.length) > 8 ? 2 : 1;

    const peaks = useMemo(() => Object.fromEntries(ROWS.map(({ key }) => [key, Math.max(0, ...buckets.map((bucket) => bucket[key]))])) as Record<Metric, number>, [buckets]);

    // The single biggest moment for each signal, as plain-language takeaways.
    const hotspots = useMemo(() => ROWS.flatMap((row) => {
        if (!peaks[row.key]) return [];
        const bucket = buckets.reduce((best, item) => (item[row.key] > best[row.key] ? item : best));
        return [{ ...row, bucket }];
    }), [buckets, peaks]);

    const xTicks = useMemo(() => {
        const count = width < 480 ? 3 : 5;
        return Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * total));
    }, [width, total]);

    const chapterAt = (ms: number) => [...chapters].reverse().find((chapter) => ms >= chapter.startMs)?.title ?? null;
    const viewers = (share: number) => Math.round(share * plays);

    const pickFromPointer = (clientX: number) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect || !buckets.length) return;
        const ms = ((clientX - rect.left - MARGIN.left) / plotWidth) * total;
        const index = buckets.findIndex((bucket) => ms < bucket.endMs);
        setActive(index === -1 ? buckets.length - 1 : Math.max(0, index));
    };

    const bucket = active !== null ? buckets[active] : null;

    return (
        <div>
            {hotspots.length > 0 && (
                <ul className="mb-4 grid gap-2 sm:grid-cols-3">
                    {hotspots.map(({ key, label, verb, bucket: spot }) => (
                        <li key={key}>
                            <button
                                type="button"
                                disabled={!onSeek}
                                onClick={() => onSeek?.(spot.startMs)}
                                className="w-full rounded-2xl bg-[#F7F6FB] px-3.5 py-3 text-left transition enabled:hover:bg-[#EFEDF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70"
                            >
                                <span className="block text-[11px] font-medium text-[#14121F]/55">Most {label.toLowerCase()}</span>
                                <span className="mt-0.5 block text-base font-semibold tabular-nums">{formatClock(spot.startMs)}–{formatClock(spot.endMs)}</span>
                                <span className="mt-0.5 block text-xs text-[#14121F]/60">
                                    {formatPercent(spot[key])} of plays {verb} here{chapterAt(spot.startMs) ? ` · ${chapterAt(spot.startMs)}` : ''}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div ref={wrapRef} className="relative">
                <svg width={width} height={height} role="img" aria-label={`Viewer behaviour heatmap. ${hotspots.map(({ label, bucket: spot }) => `Most ${label.toLowerCase()} at ${formatClock(spot.startMs)}`).join('. ') || 'No re-watches, skips or drop-offs yet.'}`} className="block">
                    {ROWS.map((row, rowIndex) => (
                        <g key={row.key}>
                            <text x={MARGIN.left - 10} y={rowY(rowIndex) + ROW_HEIGHT / 2} dy="0.32em" textAnchor="end" className="fill-[#14121F]/65 text-[12px] font-medium">{row.label}</text>
                            {buckets.map((item, index) => {
                                const left = x(item.startMs);
                                return (
                                    <rect
                                        key={item.startMs}
                                        x={left + gap / 2}
                                        y={rowY(rowIndex)}
                                        width={Math.max(1, x(item.endMs) - left - gap)}
                                        height={ROW_HEIGHT}
                                        rx={Math.min(4, (x(item.endMs) - left) / 3)}
                                        fill={shade(item[row.key], peaks[row.key])}
                                        stroke={active === index ? '#14121F' : 'none'}
                                        strokeOpacity={0.5}
                                    />
                                );
                            })}
                        </g>
                    ))}

                    {/* Chapter boundaries, in text ink so they never compete with the cells. */}
                    {chapters.slice(1).map((chapter) => (
                        <line key={chapter.startMs} x1={x(chapter.startMs)} x2={x(chapter.startMs)} y1={MARGIN.top - 2} y2={plotBottom + 2} stroke="#14121F" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3" />
                    ))}

                    {xTicks.map((ms, index) => (
                        <text key={ms} x={x(ms)} y={height - 8} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'} className="fill-[#14121F]/50 text-[11px] tabular-nums">{formatClock(ms)}</text>
                    ))}

                    {/* Hit area: the whole grid, so a moment reads across all three rows. */}
                    <rect
                        x={MARGIN.left}
                        y={MARGIN.top}
                        width={plotWidth}
                        height={plotBottom - MARGIN.top}
                        fill="transparent"
                        tabIndex={buckets.length ? 0 : -1}
                        aria-label="Heatmap by time. Use the arrow keys to move, Enter to play that moment."
                        className={`${onSeek ? 'cursor-pointer' : 'cursor-crosshair'} outline-none focus-visible:stroke-[#6A4CFF] focus-visible:stroke-2`}
                        onPointerMove={(event) => pickFromPointer(event.clientX)}
                        onPointerLeave={() => setActive(null)}
                        onClick={() => { if (bucket) onSeek?.(bucket.startMs); }}
                        onFocus={() => setActive((current) => current ?? 0)}
                        onBlur={() => setActive(null)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && bucket) { onSeek?.(bucket.startMs); return; }
                            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                            event.preventDefault();
                            setActive((current) => Math.min(buckets.length - 1, Math.max(0, (current ?? 0) + (event.key === 'ArrowRight' ? 1 : -1))));
                        }}
                    />
                </svg>

                {bucket && (
                    <div role="status" className="pointer-events-none absolute z-10 min-w-48 rounded-xl border border-[#14121F]/10 bg-white px-3 py-2 shadow-[0_12px_28px_-14px_rgba(20,18,31,0.45)]" style={{ left: Math.min(Math.max(x(bucket.endMs) + 8, 0), width - 200), top: plotBottom + 4 }}>
                        <p className="text-xs font-semibold tabular-nums">{formatClock(bucket.startMs)}–{formatClock(bucket.endMs)}{chapterAt(bucket.startMs) ? <span className="font-medium text-[#14121F]/55"> · {chapterAt(bucket.startMs)}</span> : null}</p>
                        <dl className="mt-1 space-y-0.5 text-xs">
                            {ROWS.map((row) => (
                                <div key={row.key} className="flex items-center justify-between gap-4">
                                    <dt className="flex items-center gap-1.5 text-[#14121F]/60"><span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: shade(bucket[row.key], peaks[row.key]) }} />{row.label}</dt>
                                    <dd className="font-semibold tabular-nums">{formatPercent(bucket[row.key])} <span className="font-normal text-[#14121F]/50">({viewers(bucket[row.key])})</span></dd>
                                </div>
                            ))}
                        </dl>
                        {onSeek && <p className="mt-1 text-[11px] text-[#14121F]/45">Click to play this moment</p>}
                    </div>
                )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setShowTable((value) => !value)} className="text-xs font-semibold text-[#6A4CFF] hover:underline">
                    {showTable ? 'Hide table' : 'View as table'}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-[#14121F]/50" aria-hidden="true">
                    <span>Less</span>
                    <span className="flex gap-0.5">{[EMPTY, ...RAMP].map((color) => <span key={color} className="inline-block h-2.5 w-3.5 rounded-[3px]" style={{ background: color }} />)}</span>
                    <span>More, per row</span>
                </div>
            </div>
            {showTable && (
                <div className="mt-2 max-h-72 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-white text-xs text-[#14121F]/55"><tr><th className="py-1.5 font-semibold">Time</th><th className="py-1.5 font-semibold">Chapter</th>{ROWS.map((row) => <th key={row.key} className="py-1.5 text-right font-semibold">{row.label}</th>)}</tr></thead>
                        <tbody className="tabular-nums">
                            {buckets.map((item) => (
                                <tr key={item.startMs} className="border-t border-[#14121F]/6">
                                    <td className="py-1.5">{formatClock(item.startMs)}</td>
                                    <td className="py-1.5 text-[#14121F]/65">{chapterAt(item.startMs) ?? '—'}</td>
                                    {ROWS.map((row) => <td key={row.key} className="py-1.5 text-right font-medium">{formatPercent(item[row.key])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
