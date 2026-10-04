'use client';

import React, { useRef, useCallback } from 'react';
import { Play, Pause, Scissors } from 'lucide-react';
import { VideoEditState } from '@/types/editor';

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
}

function formatTime(ms: number) {
    if (!Number.isFinite(ms) || ms < 0) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Timeline({ durationMs, playheadMs, isPlaying, onSeek, onTogglePlay, videoEdit, onTrimChange, onTrimStart, onSplit, onRemoveSplit }: TimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className="bg-neutral-900 border-t border-neutral-800 p-4">
            <div className="flex items-center gap-4 mb-3">
                <button
                    onClick={onTogglePlay}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <span className="text-xs text-neutral-400 font-mono tabular-nums">
                    {formatTime(playheadMs)} / {hasDuration ? formatTime(durationMs) : 'Loading duration…'}
                </span>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Video · trim & split</span>
                <button type="button" onClick={onSplit} disabled={!hasDuration || playheadMs <= videoEdit.trimStartMs + 100 || playheadMs >= videoEdit.trimEndMs - 100}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-indigo-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                    <Scissors className="h-3.5 w-3.5" /> Split at playhead
                </button>
            </div>
            <div className="relative mb-1 h-8 select-none overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                <div className="absolute inset-y-0 bg-neutral-800/70" style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, trimEndPercent - trimStartPercent)}%` }} />
                {(hasDuration ? videoEdit.splitPointsMs.filter((point) => Number.isFinite(point) && point > videoEdit.trimStartMs && point < videoEdit.trimEndMs) : []).map((point) => (
                    <button type="button" key={point} onClick={() => onRemoveSplit(point)} aria-label={`Remove split at ${formatTime(point)}`} className="absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-pointer border-x border-amber-300 bg-amber-300/20 hover:bg-amber-300/70" style={{ left: `${(point / durationMs) * 100}%` }} title={`Split at ${formatTime(point)} · click to join`} />
                ))}
                <button type="button" className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,.7)]" style={{ left: `${trimStartPercent}%` }}
                    aria-label="Trim start" title={`Trim in: ${formatTime(videoEdit.trimStartMs)}`} onPointerDown={(event) => { onTrimStart(); event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={(event) => {
                        if (event.buttons !== 1 || !trackRef.current || !hasDuration) return;
                        const rect = trackRef.current.getBoundingClientRect();
                        const time = Math.max(0, Math.min(videoEdit.trimEndMs - 250, ((event.clientX - rect.left) / rect.width) * durationMs));
                        onTrimChange({ trimStartMs: Math.round(time) });
                    }} />
                <button type="button" className="absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize rounded-sm bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,.7)]" style={{ left: `${trimEndPercent}%` }}
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
                onMouseDown={(e) => handleScrub(e.clientX)}
                onMouseMove={(e) => { if (e.buttons === 1) handleScrub(e.clientX); }}
                className="relative h-2 rounded-full bg-neutral-800 cursor-pointer group">
                <div
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full pointer-events-none"
                    style={{ left: `${trimStartPercent}%`, width: `${Math.max(0, Math.min(progress, trimEndPercent) - trimStartPercent)}%` }}
                />
                <div className="absolute top-1/2 h-3 w-3.5 -translate-y-1/2 rounded-full bg-white shadow pointer-events-none transition-transform group-hover:scale-110" style={{ left: `calc(${progress}% - 7px)` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-neutral-500">
                <span>IN {formatTime(videoEdit.trimStartMs)}</span>
                <span>{videoEdit.splitPointsMs.filter(Number.isFinite).length} split{videoEdit.splitPointsMs.filter(Number.isFinite).length === 1 ? '' : 's'}</span>
                <span>OUT {formatTime(videoEdit.trimEndMs)}</span>
            </div>
        </div>
    );
}