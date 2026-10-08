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
        <div className="space-y-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70 mb-2 block">Slow Motion</label>
                <p className="text-xs leading-relaxed text-[#14121F]/60 mb-3">Add a 3-second slow-motion segment starting at the playhead, then adjust its timing and speed.</p>
                <button onClick={addSlowMotion} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] py-2.5 text-xs font-semibold text-white hover:bg-[#5839e0] shadow-sm transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add at {(playheadMs / 1000).toFixed(1)}s
                </button>
            </div>
            {segments.map((segment) => (
                <div key={segment.id} className="space-y-3 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#14121F]/80">
                        <span>{(segment.startMs / 1000).toFixed(1)}s – {(segment.endMs / 1000).toFixed(1)}s</span>
                        <button onClick={() => onRemove(segment.id)} aria-label="Remove slow-motion segment" className="text-[#14121F]/40 hover:text-red-600 transition">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    <label className="block text-xs font-medium text-[#14121F]/70">
                        Start
                        <input type="range" min={0} max={durationMs} value={segment.startMs}
                            onChange={(event) => onUpdate(segment.id, { startMs: Math.min(Number(event.target.value), segment.endMs - 200) })}
                            className="mt-1 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full" />
                    </label>
                    <label className="block text-xs font-medium text-[#14121F]/70">
                        End
                        <input type="range" min={segment.startMs + 200} max={durationMs} value={segment.endMs}
                            onChange={(event) => onUpdate(segment.id, { endMs: Number(event.target.value) })}
                            className="mt-1 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full" />
                    </label>
                    <label className="block text-xs font-medium text-[#14121F]/70">
                        Speed: {segment.rate}×
                        <select value={segment.rate} onChange={(event) => onUpdate(segment.id, { rate: Number(event.target.value) })}
                            className="mt-1.5 w-full rounded-xl border border-[#14121F]/10 bg-white p-2.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none">
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