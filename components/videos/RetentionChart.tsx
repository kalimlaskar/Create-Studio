'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock, formatPercent, type ChapterStats } from '@/lib/videos/types';

// Single series (share of plays still watching), so no legend: the title names it.
// Violet #6A4CFF passes the palette validator against the white card (contrast ≥ 3:1).
const SERIES = '#6A4CFF';
const HEIGHT = 240;
const MARGIN = { top: 28, right: 16, bottom: 30, left: 44 };
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

interface Props {
    retention: Array<[number, number]>;
    durationMs: number;
    chapters: ChapterStats[];
}

export function RetentionChart({ retention, durationMs, chapters }: Props) {
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

    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const total = Math.max(1, durationMs);
    const x = (ms: number) => MARGIN.left + (ms / total) * plotWidth;
    const y = (share: number) => MARGIN.top + (1 - share) * plotHeight;

    const { line, area } = useMemo(() => {
        if (!retention.length) return { line: '', area: '' };
        // Extend the last point to the end of the video so the line spans the full width.
        const points = [...retention, [total, retention[retention.length - 1][1]] as [number, number]];
        const path = points.map(([ms, share], index) => `${index ? 'L' : 'M'}${x(ms).toFixed(1)},${y(share).toFixed(1)}`).join('');
        return { line: path, area: `${path}L${x(total).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [retention, width, total]);

    const xTicks = useMemo(() => {
        const count = width < 480 ? 3 : 5;
        return Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * total));
    }, [width, total]);

    const chapterAt = (ms: number) => [...chapters].reverse().find((chapter) => ms >= chapter.startMs)?.title ?? null;

    const pickFromPointer = (clientX: number) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect || !retention.length) return;
        const ms = ((clientX - rect.left - MARGIN.left) / plotWidth) * total;
        let nearest = 0;
        retention.forEach(([pointMs], index) => { if (Math.abs(pointMs - ms) < Math.abs(retention[nearest][0] - ms)) nearest = index; });
        setActive(nearest);
    };

    const point = active !== null ? retention[active] : null;
    const tableRows = useMemo(() => {
        const step = Math.max(1, Math.floor(retention.length / 10));
        return retention.filter((_, index) => index % step === 0);
    }, [retention]);

    return (
        <div>
            <div ref={wrapRef} className="relative">
                <svg width={width} height={HEIGHT} role="img" aria-label={`Audience retention. ${retention.length ? `${formatPercent(retention[0][1])} at the start, ${formatPercent(retention[retention.length - 1][1])} by the end.` : 'No plays yet.'}`} className="block overflow-visible">
                    {Y_TICKS.map((tick) => (
                        <g key={tick}>
                            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="#14121F" strokeOpacity={tick === 0 ? 0.16 : 0.07} strokeWidth={1} />
                            <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[#14121F]/50 text-[11px] tabular-nums">{formatPercent(tick)}</text>
                        </g>
                    ))}
                    {xTicks.map((ms, index) => (
                        <text key={ms} x={x(ms)} y={HEIGHT - 8} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'} className="fill-[#14121F]/50 text-[11px] tabular-nums">{formatClock(ms)}</text>
                    ))}

                    {/* Chapter boundaries and names, in text ink so they never compete with the data. */}
                    {chapters.map((chapter, index) => {
                        const start = x(chapter.startMs);
                        const end = x(chapter.endMs);
                        const room = end - start - 8;
                        const maxChars = Math.floor(room / 6.2);
                        const label = maxChars >= 4 ? (chapter.title.length > maxChars ? `${chapter.title.slice(0, maxChars - 1)}…` : chapter.title) : null;
                        return (
                            <g key={`${chapter.startMs}-${chapter.title}`}>
                                {index > 0 && <line x1={start} x2={start} y1={MARGIN.top - 18} y2={y(0)} stroke="#14121F" strokeOpacity={0.14} strokeWidth={1} />}
                                {label && <text x={start + 5} y={MARGIN.top - 10} className="fill-[#14121F]/60 text-[11px] font-medium">{label}</text>}
                            </g>
                        );
                    })}

                    {line && <path d={area} fill={SERIES} fillOpacity={0.1} />}
                    {line && <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

                    {point && (
                        <g pointerEvents="none">
                            <line x1={x(point[0])} x2={x(point[0])} y1={MARGIN.top} y2={y(0)} stroke="#14121F" strokeOpacity={0.3} strokeWidth={1} />
                            <circle cx={x(point[0])} cy={y(point[1])} r={5} fill={SERIES} stroke="#FFFFFF" strokeWidth={2} />
                        </g>
                    )}

                    {/* Hit area: the whole plot, so readers aim at a time, not at the line. */}
                    <rect
                        x={MARGIN.left}
                        y={MARGIN.top}
                        width={plotWidth}
                        height={plotHeight}
                        fill="transparent"
                        tabIndex={retention.length ? 0 : -1}
                        aria-label="Retention by time. Use the arrow keys to read each point."
                        className="cursor-crosshair outline-none focus-visible:stroke-[#6A4CFF] focus-visible:stroke-2"
                        onPointerMove={(event) => pickFromPointer(event.clientX)}
                        onPointerLeave={() => setActive(null)}
                        onFocus={() => setActive((current) => current ?? 0)}
                        onBlur={() => setActive(null)}
                        onKeyDown={(event) => {
                            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                            event.preventDefault();
                            setActive((current) => Math.min(retention.length - 1, Math.max(0, (current ?? 0) + (event.key === 'ArrowRight' ? 1 : -1))));
                        }}
                    />
                </svg>

                {point && (
                    <div role="status" className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-[#14121F]/10 bg-white px-3 py-2 shadow-[0_12px_28px_-14px_rgba(20,18,31,0.45)]" style={{ left: Math.min(Math.max(x(point[0]) + 12, 0), width - 160), top: Math.max(4, y(point[1]) - 58) }}>
                        <p className="flex items-center gap-2 text-base font-semibold"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: SERIES }} />{formatPercent(point[1])} <span className="text-xs font-medium text-[#14121F]/55">still watching</span></p>
                        <p className="mt-0.5 text-xs text-[#14121F]/60">at {formatClock(point[0])}{chapterAt(point[0]) ? ` · ${chapterAt(point[0])}` : ''}</p>
                    </div>
                )}
            </div>

            <button type="button" onClick={() => setShowTable((value) => !value)} className="mt-2 text-xs font-semibold text-[#6A4CFF] hover:underline">
                {showTable ? 'Hide table' : 'View as table'}
            </button>
            {showTable && (
                <table className="mt-2 w-full text-left text-sm">
                    <thead className="text-xs text-[#14121F]/55"><tr><th className="py-1.5 font-semibold">Time</th><th className="py-1.5 font-semibold">Chapter</th><th className="py-1.5 text-right font-semibold">Still watching</th></tr></thead>
                    <tbody className="tabular-nums">
                        {tableRows.map(([ms, share]) => (
                            <tr key={ms} className="border-t border-[#14121F]/6"><td className="py-1.5">{formatClock(ms)}</td><td className="py-1.5 text-[#14121F]/65">{chapterAt(ms) ?? '—'}</td><td className="py-1.5 text-right font-medium">{formatPercent(share)}</td></tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
