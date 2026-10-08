'use client';

import React from 'react';
import { Plus, Trash2, ZoomIn } from 'lucide-react';
import { ZoomKeyframe } from '@/types/editor';

interface ZoomPanelProps {
    keyframes: ZoomKeyframe[];
    playheadMs: number;
    onAdd: (atMs: number, scale: number) => void;
    onUpdate: (id: string, patch: Partial<ZoomKeyframe>) => void;
    onRemove: (id: string) => void;
}

export function ZoomPanel({ keyframes, playheadMs, onAdd, onUpdate, onRemove }: ZoomPanelProps) {
    return (
        <div className="space-y-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70 mb-2 block">
                    Zoom at {(playheadMs / 1000).toFixed(1)}s
                </label>
                <p className="text-xs leading-relaxed text-[#14121F]/60 mb-3">
                    Add a zoom point at the current playhead. The video smoothly scales between points as it plays.
                </p>
                <button
                    onClick={() => onAdd(playheadMs, 1.3)}
                    className="w-full flex items-center justify-center gap-2 bg-[#6A4CFF] hover:bg-[#5839e0] text-white text-xs py-2.5 rounded-xl font-semibold shadow-sm transition-colors">
                    <Plus className="w-4 h-4" /> Add Zoom Point Here
                </button>
            </div>

            <div className="space-y-2.5">
                {keyframes.length === 0 && (
                    <p className="text-xs text-[#14121F]/50">No zoom points yet — video stays at 100%.</p>
                )}
                {keyframes.map((kf) => (
                    <div key={kf.id} className="border border-[#14121F]/10 rounded-2xl bg-[#F7F6FB] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-xs font-semibold text-[#14121F]">
                                <ZoomIn className="w-4 h-4 text-[#6A4CFF]" /> {(kf.atMs / 1000).toFixed(1)}s
                            </span>
                            <button onClick={() => onRemove(kf.id)} aria-label="Remove zoom keyframe" className="text-[#14121F]/40 hover:text-red-600 transition">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-medium text-[#14121F]/70 mb-1">
                                <span>Scale</span><span className="font-mono text-[#14121F] font-semibold">{Math.round(kf.scale * 100)}%</span>
                            </div>
                            <input
                                type="range" min={100} max={250} value={kf.scale * 100}
                                onChange={(e) => onUpdate(kf.id, { scale: Number(e.target.value) / 100 })}
                                className="w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}