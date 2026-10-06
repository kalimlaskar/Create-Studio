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
    particles: 'rgba(56,189,248,.65)',
    portal: 'rgba(168,85,247,.65)',
    warp: 'rgba(250,250,250,.6)',
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
        <div className="bg-neutral-900 border-t border-neutral-800 p-3 md:p-4">
            <div className="flex items-center gap-4 mb-3">
                <button
                    onClick={onTogglePlay}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button type="button" aria-label="Back 5 seconds" onClick={() => onSeek(Math.max(videoEdit.trimStartMs, playheadMs - 5000))} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700"><SkipBack className="h-4 w-4" /></button>
                <button type="button" aria-label="Forward 5 seconds" onClick={() => onSeek(Math.min(videoEdit.trimEndMs, playheadMs + 5000))} className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700"><SkipForward className="h-4 w-4" /></button>
                <span className="ml-auto text-xs text-neutral-400 font-mono tabular-nums">
                    {formatTime(playheadMs)} / {hasDuration ? formatTime(durationMs) : 'Loading duration…'}
                </span>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Drag the purple handles to trim</span>
                <button type="button" onClick={onSplit} disabled={!hasDuration || playheadMs <= videoEdit.trimStartMs + 100 || playheadMs >= videoEdit.trimEndMs - 100}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-indigo-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    <Scissors className="h-3.5 w-3.5" /> Split at playhead
                </button>
            </div>
            <div className="relative mb-1 h-10 select-none overflow-hidden md:h-8 rounded-lg border border-neutral-800 bg-neutral-950">
                <div className="absolute inset-y-0 bg-neutral-800/70" style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, trimEndPercent - trimStartPercent)}%` }} />
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
                            className={`absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-pointer border-x ${selectedSplit === point ? 'border-white bg-amber-300/80' : 'border-amber-300 bg-amber-300/20 hover:bg-amber-300/70'}`} style={{ left: `${(point / durationMs) * 100}%` }} title={`Split at ${formatTime(point)} · click to add a transition`}>
                            {hasTransition && <Sparkles className="absolute left-1/2 top-0.5 h-3 w-3 -translate-x-1/2 text-white drop-shadow" />}
                        </button>
                    );
                })}
                <button type="button" className="absolute inset-y-0 z-20 w-6 touch-none -translate-x-1/2 cursor-ew-resize rounded-md border-x-4 border-indigo-400 bg-indigo-400/40 shadow-[0_0_10px_rgba(99,102,241,.7)]" style={{ left: `${trimStartPercent}%` }}
                    aria-label="Trim start" title={`Trim in: ${formatTime(videoEdit.trimStartMs)}`} onPointerDown={(event) => { onTrimStart(); event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => {
                        if (event.buttons !== 1 || !trackRef.current || !hasDuration) return;
                        const rect = trackRef.current.getBoundingClientRect();
                        const time = Math.max(0, Math.min(videoEdit.trimEndMs - 250, ((event.clientX - rect.left) / rect.width) * durationMs));
                        onTrimChange({ trimStartMs: Math.round(time) });
                    }} />
                <button type="button" className="absolute inset-y-0 z-20 w-6 touch-none -translate-x-1/2 cursor-ew-resize rounded-md border-x-4 border-indigo-400 bg-indigo-400/40 shadow-[0_0_10px_rgba(99,102,241,.7)]" style={{ left: `${trimEndPercent}%` }}
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
                className="relative h-4 touch-none rounded-full bg-neutral-800 cursor-pointer group my-2">
                <div
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full pointer-events-none"
                    style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, Math.min(progress, trimEndPercent) - trimStartPercent)}%` }}
                />
                <div className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow pointer-events-none transition-transform group-hover:scale-110" style={{ left: `calc(${progress}% - 10px)` }} />
            </div>
            {visibleSplits.length > 0 && selectedSplit === null && (
                <p className="mt-1 text-[11px] text-neutral-500">Tap a yellow split marker to add a sci-fi transition.</p>
            )}
            {selectedSplit !== null && (
                <div className="mt-2 max-h-[34dvh] space-y-2 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-2.5" role="group" aria-label={`Transition at ${formatTime(selectedSplit)}`}>
                    <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200"><Sparkles className="h-3.5 w-3.5 text-indigo-300" /> Transition · {formatTime(selectedSplit)}</span>
                        <button type="button" onClick={() => { onRemoveSplit(selectedSplit); setSelectedSplitMs(null); }} className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-red-900/60 hover:text-red-300">
                            <Trash2 className="h-3 w-3" /> Remove split
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        <button type="button" onClick={() => onSetTransition(selectedSplit, null)} aria-pressed={!selectedTransition}
                            className={`rounded-lg px-1 py-2 text-xs font-medium transition-colors ${!selectedTransition ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>None</button>
                        {TRANSITION_OPTIONS.map((option) => (
                            <button type="button" key={option.type} title={`${option.label}: ${option.hint}`} aria-label={option.label} onClick={() => onSetTransition(selectedSplit, option.type, selectedTransition?.durationMs ?? DEFAULT_TRANSITION_MS)} aria-pressed={selectedTransition?.type === option.type}
                                className={`rounded-lg px-1 py-2 text-xs font-medium transition-colors ${selectedTransition?.type === option.type ? 'bg-indigo-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>{option.short}</button>
                        ))}
                    </div>
                    {selectedTransition && (
                        <>
                            <p className="hidden text-[11px] text-neutral-500 md:block">{TRANSITION_OPTIONS.find((option) => option.type === selectedTransition.type)?.hint} Plays from the split for the duration below.</p>
                            <div className="flex items-center gap-2">
                                <label className="min-w-0 flex-1 text-xs text-neutral-400">
                                    <span className="flex justify-between"><span>Duration</span><span className="font-mono text-neutral-200">{(selectedTransition.durationMs / 1000).toFixed(1)}s</span></span>
                                    <input type="range" min={MIN_TRANSITION_MS} max={MAX_TRANSITION_MS} step={100} value={selectedTransition.durationMs} aria-label="Transition duration"
                                        onChange={(event) => onSetTransition(selectedSplit, selectedTransition.type, clampTransitionMs(Number(event.target.value)))} className="w-full accent-indigo-500" />
                                </label>
                                <button type="button" onClick={() => onPreviewTransition(selectedSplit)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
                                    <Play className="h-3.5 w-3.5" /> Preview
                                </button>
                            </div>
                        </>
                    )}
                    <label className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <input type="checkbox" checked={performanceMode} onChange={(event) => onPerformanceModeChange(event.target.checked)} className="accent-indigo-500" />
                        Performance mode (fewer particles, lighter render)
                    </label>
                </div>
            )}
            <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
                <span>IN {formatTime(videoEdit.trimStartMs)}</span>
                <span>{videoEdit.splitPointsMs.filter(Number.isFinite).length} split{videoEdit.splitPointsMs.filter(Number.isFinite).length === 1 ? '' : 's'}</span>
                <span>OUT {formatTime(videoEdit.trimEndMs)}</span>
            </div>
        </div>
    );
}