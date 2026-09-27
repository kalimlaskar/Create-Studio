'use client';

import React, { useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface TimelineProps {
    durationMs: number;
    playheadMs: number;
    isPlaying: boolean;
    onSeek: (ms: number) => void;
    onTogglePlay: () => void;
}

function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Timeline({ durationMs, playheadMs, isPlaying, onSeek, onTogglePlay }: TimelineProps) {
    const trackRef = useRef<HTMLDivElement>(null);

    const handleScrub = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track || durationMs === 0) return;
        const rect = track.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onSeek(fraction * durationMs);
    }, [durationMs, onSeek]);

    const progress = durationMs > 0 ? (playheadMs / durationMs) * 100 : 0;

    return (
        <div className="bg-neutral-900 border-t border-neutral-800 p-4">
            <div className="flex items-center gap-4 mb-3">
                <button
                    onClick={onTogglePlay}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <span className="text-xs text-neutral-400 font-mono tabular-nums">
                    {formatTime(playheadMs)} / {formatTime(durationMs)}
                </span>
            </div>

            {/* Scrub bar — future overlay/caption/audio tracks render as rows below this */}
            <div
                ref={trackRef}
                onMouseDown={(e) => handleScrub(e.clientX)}
                onMouseMove={(e) => { if (e.buttons === 1) handleScrub(e.clientX); }}
                className="relative h-3 bg-neutral-800 rounded-full cursor-pointer group">
                <div
                    className="absolute top-0 left-0 h-full bg-indigo-600 rounded-full pointer-events-none"
                    style={{ width: `${progress}%` }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow pointer-events-none transition-transform group-hover:scale-110"
                    style={{ left: `calc(${progress}% - 7px)` }}
                />
            </div>
        </div>
    );
}