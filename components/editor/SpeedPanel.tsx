'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SpeedSegment } from '@/types/editor';

interface SpeedPanelProps {
    segments: SpeedSegment[];
    durationMs: number;
    playheadMs: number;
    onAdd: (segment: Omit<SpeedSegment, 'id'>) => void;
    onUpdate: (id: string, patch: Partial<SpeedSegment>) => void;
    onRemove: (id: string) => void;
}

export function SpeedPanel({ segments, durationMs, playheadMs, onAdd, onUpdate, onRemove }: SpeedPanelProps) {
    const addSlowMotion = () => {
        const startMs = Math.min(playheadMs, durationMs);
        const endMs = Math.min(durationMs, startMs + 3000);
        if (endMs <= startMs) return;
        onAdd({ startMs, endMs, rate: 0.5 });
    };

    return (
        <div className="space-y-3">
            <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">Slow Motion</label>
                <p className="text-xs text-neutral-500 mb-3">Add a 3-second slow-motion segment starting at the playhead, then adjust its timing and speed.</p>
                <button onClick={addSlowMotion} className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
                    <Plus className="h-3.5 w-3.5" /> Add at {(playheadMs / 1000).toFixed(1)}s
                </button>
            </div>
            {segments.map((segment) => (
                <div key={segment.id} className="space-y-3 rounded-lg border border-neutral-800 p-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>{(segment.startMs / 1000).toFixed(1)}s – {(segment.endMs / 1000).toFixed(1)}s</span>
                        <button onClick={() => onRemove(segment.id)} aria-label="Remove slow-motion segment" className="text-neutral-500 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <label className="block text-xs text-neutral-400">
                        Start
                        <input type="range" min={0} max={durationMs} value={segment.startMs}
                            onChange={(event) => onUpdate(segment.id, { startMs: Math.min(Number(event.target.value), segment.endMs - 200) })}
                            className="mt-1 w-full accent-indigo-500" />
                    </label>
                    <label className="block text-xs text-neutral-400">
                        End
                        <input type="range" min={segment.startMs + 200} max={durationMs} value={segment.endMs}
                            onChange={(event) => onUpdate(segment.id, { endMs: Number(event.target.value) })}
                            className="mt-1 w-full accent-indigo-500" />
                    </label>
                    <label className="block text-xs text-neutral-400">
                        Speed: {segment.rate}×
                        <select value={segment.rate} onChange={(event) => onUpdate(segment.id, { rate: Number(event.target.value) })}
                            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-neutral-200">
                            <option value={0.25}>0.25×</option>
                            <option value={0.5}>0.5×</option>
                            <option value={0.75}>0.75×</option>
                        </select>
                    </label>
                </div>
            ))}
        </div>
    );
}
