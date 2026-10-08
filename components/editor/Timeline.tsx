'use client';

import React, { useRef, useCallback, useState } from 'react';
import { Play, Pause, Scissors, SkipBack, SkipForward, Sparkles, Trash2 } from 'lucide-react';
import { TransitionType, VideoEditState } from '@/types/editor';
import { clampTransitionMs, DEFAULT_TRANSITION_MS, getEffectiveTransitionMs, MAX_TRANSITION_MS, MIN_TRANSITION_MS, TRANSITION_OPTIONS } from './transitions';

interface TimelineProps {
    durationMs: number;
    playheadMs: number;
    isPlaying: boolean;
    onSeek: (ms: number) => void;
    onTogglePlay: () => void;
    videoEdit: VideoEditState;
    onTrimChange: (patch: Partial<VideoEditState>) => void;
    onTrimStart: () => void;
    onSplit: () => void;
    onRemoveSplit: (timeMs: number) => void;
    onSetTransition: (atMs: number, type: TransitionType | null, durationMs?: number) => void;
    onPreviewTransition: (atMs: number) => void;
    performanceMode: boolean;
    onPerformanceModeChange: (enabled: boolean) => void;
}

const TRANSITION_COLORS: Record<TransitionType, string> = {
    particles: 'rgba(106,76,255,.65)',
    portal: 'rgba(255,61,129,.65)',
    warp: 'rgba(20,18,31,.6)',
};

function formatTime(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Timeline({ durationMs, playheadMs, isPlaying, onSeek, onTogglePlay, videoEdit, onTrimChange, onTrimStart, onSplit, onRemoveSplit, onSetTransition, onPreviewTransition, performanceMode, onPerformanceModeChange }: TimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [selectedSplitMs, setSelectedSplitMs] = useState<number | null>(null);

    const handleScrub = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track || durationMs === 0) return;
        const rect = track.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onSeek(fraction * durationMs);
    }, [durationMs, onSeek]);

    const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
    const progress = hasDuration && Number.isFinite(playheadMs) ? (playheadMs / durationMs) * 100 : 0;
    const trimStartPercent = hasDuration && Number.isFinite(videoEdit.trimStartMs) ? (videoEdit.trimStartMs / durationMs) * 100 : 0;
    const trimEndPercent = hasDuration && Number.isFinite(videoEdit.trimEndMs) ? (videoEdit.trimEndMs / durationMs) * 100 : 100;

    const visibleSplits = hasDuration ? videoEdit.splitPointsMs.filter((point) => Number.isFinite(point) && point > videoEdit.trimStartMs && point < videoEdit.trimEndMs) : [];
    const selectedSplit = selectedSplitMs !== null && visibleSplits.includes(selectedSplitMs) ? selectedSplitMs : null;
    const selectedTransition = selectedSplit !== null ? videoEdit.transitions?.find((transition) => transition.atMs === selectedSplit) : undefined;

    return (
        <div className="bg-white border-t border-[#14121F]/10 p-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div className="flex items-center gap-3 mb-3">
                <button
                    onClick={onTogglePlay}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-[#6A4CFF] hover:bg-[#5839e0] text-white shadow-sm transition-colors">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button type="button" aria-label="Back 5 seconds" onClick={() => onSeek(Math.max(videoEdit.trimStartMs, playheadMs - 5000))} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#14121F]/15 bg-[#F7F6FB] text-[#14121F] hover:bg-[#14121F] hover:text-white transition"><SkipBack className="h-4 w-4" /></button>
                <button type="button" aria-label="Forward 5 seconds" onClick={() => onSeek(Math.min(videoEdit.trimEndMs, playheadMs + 5000))} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#14121F]/15 bg-[#F7F6FB] text-[#14121F] hover:bg-[#14121F] hover:text-white transition"><SkipForward className="h-4 w-4" /></button>
                <span className="ml-auto text-xs font-semibold text-[#14121F]/60 font-mono tabular-nums">
                    {formatTime(playheadMs)} / {hasDuration ? formatTime(durationMs) : 'Loading duration…'}
                </span>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70">Drag the handles to trim</span>
                <button type="button" onClick={onSplit} disabled={!hasDuration || playheadMs <= videoEdit.trimStartMs + 100 || playheadMs >= videoEdit.trimEndMs - 100}
                    className="flex items-center gap-1.5 rounded-full border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold text-[#14121F] transition-colors hover:bg-[#14121F] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    <Scissors className="h-3.5 w-3.5" /> Split at playhead
                </button>
            </div>
            <div className="relative mb-2 h-10 select-none overflow-hidden md:h-9 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB]">
                <div className="absolute inset-y-0 bg-[#14121F]/5" style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, trimEndPercent - trimStartPercent)}%` }} />
                {(videoEdit.transitions ?? []).filter((transition) => visibleSplits.includes(transition.atMs)).map((transition) => (
                    <div key={`t-${transition.atMs}`} className="pointer-events-none absolute bottom-0 h-2 rounded-r-full" style={{
                        left: `${(transition.atMs / durationMs) * 100}%`,
                        width: `${(getEffectiveTransitionMs(transition, videoEdit.splitPointsMs, videoEdit.trimEndMs) / durationMs) * 100}%`,
                        background: `linear-gradient(90deg, ${TRANSITION_COLORS[transition.type]}, transparent)`,
                    }} />
                ))}
                {visibleSplits.map((point) => {
                    const hasTransition = videoEdit.transitions?.some((transition) => transition.atMs === point);
                    return (
                        <button type="button" key={point} onClick={() => setSelectedSplitMs((current) => current === point ? null : point)} aria-label={`Split at ${formatTime(point)}${hasTransition ? ' with transition' : ''}. Click to add a transition`} aria-pressed={selectedSplit === point}
                            className={`absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-pointer border-x ${selectedSplit === point ? 'border-[#14121F] bg-[#FFE347]' : 'border-[#FFE347] bg-[#FFE347]/40 hover:bg-[#FFE347]'}`} style={{ left: `${(point / durationMs) * 100}%` }} title={`Split at ${formatTime(point)} · click to add a transition`}>
                            {hasTransition && <Sparkles className="absolute left-1/2 top-0.5 h-3 w-3 -translate-x-1/2 text-[#14121F] drop-shadow" />}
                        </button>
                    );
                })}
                <button type="button" className="absolute inset-y-0 z-20 w-6 touch-none -translate-x-1/2 cursor-ew-resize rounded-xl border-x-4 border-[#6A4CFF] bg-[#6A4CFF]/30 shadow-md" style={{ left: `${trimStartPercent}%` }}
                    aria-label="Trim start" title={`Trim in: ${formatTime(videoEdit.trimStartMs)}`} onPointerDown={(event) => { onTrimStart(); event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => {
                        if (event.buttons !== 1 || !trackRef.current || !hasDuration) return;
                        const rect = trackRef.current.getBoundingClientRect();
                        const time = Math.max(0, Math.min(videoEdit.trimEndMs - 250, ((event.clientX - rect.left) / rect.width) * durationMs));
                        onTrimChange({ trimStartMs: Math.round(time) });
                    }} />
                <button type="button" className="absolute inset-y-0 z-20 w-6 touch-none -translate-x-1/2 cursor-ew-resize rounded-xl border-x-4 border-[#6A4CFF] bg-[#6A4CFF]/30 shadow-md" style={{ left: `${trimEndPercent}%` }}
                    aria-label="Trim end" title={`Trim out: ${formatTime(videoEdit.trimEndMs)}`} onPointerDown={(event) => { onTrimStart(); event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => {
                        if (event.buttons !== 1 || !trackRef.current || !hasDuration) return;
                        const rect = trackRef.current.getBoundingClientRect();
                        const time = Math.min(durationMs, Math.max(videoEdit.trimStartMs + 250, ((event.clientX - rect.left) / rect.width) * durationMs));
                        onTrimChange({ trimEndMs: Math.round(time) });
                    }} />
            </div>
            <div
                ref={trackRef}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleScrub(e.clientX); }}
                onPointerMove={(e) => { if (e.buttons === 1) handleScrub(e.clientX); }}
                className="relative h-4 touch-none rounded-full bg-[#14121F]/10 cursor-pointer group my-2">
                <div
                    className="absolute top-0 left-0 h-full bg-[#6A4CFF] rounded-full pointer-events-none"
                    style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, Math.min(progress, trimEndPercent) - trimStartPercent)}%` }}
                />
                <div className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white border border-[#14121F]/15 shadow pointer-events-none transition-transform group-hover:scale-110" style={{ left: `calc(${progress}% - 10px)` }} />
            </div>
            {visibleSplits.length > 0 && selectedSplit === null && (
                <p className="mt-1 text-[11px] text-[#14121F]/50">Tap a split marker to add a sci-fi transition.</p>
            )}
            {selectedSplit !== null && (
                <div className="mt-2.5 max-h-[34dvh] space-y-3 overflow-y-auto rounded-3xl border border-[#14121F]/10 bg-[#F7F6FB] p-4" role="group" aria-label={`Transition at ${formatTime(selectedSplit)}`}>
                    <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#14121F]"><Sparkles className="h-3.5 w-3.5 text-[#6A4CFF]" /> Transition · {formatTime(selectedSplit)}</span>
                        <button type="button" onClick={() => { onRemoveSplit(selectedSplit); setSelectedSplitMs(null); }} className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-600 hover:text-white transition">
                            <Trash2 className="h-3 w-3" /> Remove split
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <button type="button" onClick={() => onSetTransition(selectedSplit, null)} aria-pressed={!selectedTransition}
                            className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${!selectedTransition ? 'bg-[#14121F] text-white shadow-sm' : 'border border-[#14121F]/10 bg-white text-[#14121F]/70 hover:bg-[#14121F]/5'}`}>None</button>
                        {TRANSITION_OPTIONS.map((option) => (
                            <button type="button" key={option.type} title={`${option.label}: ${option.hint}`} aria-label={option.label} onClick={() => onSetTransition(selectedSplit, option.type, selectedTransition?.durationMs ?? DEFAULT_TRANSITION_MS)} aria-pressed={selectedTransition?.type === option.type}
                                className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${selectedTransition?.type === option.type ? 'bg-[#6A4CFF] text-white shadow-sm' : 'border border-[#14121F]/10 bg-white text-[#14121F]/70 hover:bg-[#14121F]/5'}`}>{option.short}</button>
                        ))}
                    </div>
                    {selectedTransition && (
                        <>
                            <p className="hidden text-[11px] text-[#14121F]/60 md:block">{TRANSITION_OPTIONS.find((option) => option.type === selectedTransition.type)?.hint} Plays from the split for the duration below.</p>
                            <div className="flex items-center gap-3">
                                <label className="min-w-0 flex-1 text-xs font-medium text-[#14121F]/80">
                                    <span className="flex justify-between mb-1"><span>Duration</span><span className="font-mono text-[#14121F] font-semibold">{(selectedTransition.durationMs / 1000).toFixed(1)}s</span></span>
                                    <input type="range" min={MIN_TRANSITION_MS} max={MAX_TRANSITION_MS} step={100} value={selectedTransition.durationMs} aria-label="Transition duration"
                                        onChange={(event) => onSetTransition(selectedSplit, selectedTransition.type, clampTransitionMs(Number(event.target.value)))} className="w-full accent-[#6A4CFF]" />
                                </label>
                                <button type="button" onClick={() => onPreviewTransition(selectedSplit)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5839e0] shadow-sm">
                                    <Play className="h-3.5 w-3.5 fill-current" /> Preview
                                </button>
                            </div>
                        </>
                    )}
                    <label className="flex items-center gap-2 text-xs font-medium text-[#14121F]/80">
                        <input type="checkbox" checked={performanceMode} onChange={(event) => onPerformanceModeChange(event.target.checked)} className="accent-[#6A4CFF] rounded" />
                        Performance mode (fewer particles, lighter render)
                    </label>
                </div>
            )}
            <div className="mt-2.5 flex justify-between text-[11px] font-mono font-semibold text-[#14121F]/50">
                <span>IN {formatTime(videoEdit.trimStartMs)}</span>
                <span>{videoEdit.splitPointsMs.filter(Number.isFinite).length} split{videoEdit.splitPointsMs.filter(Number.isFinite).length === 1 ? '' : 's'}</span>
                <span>OUT {formatTime(videoEdit.trimEndMs)}</span>
            </div>
        </div>
    );
}