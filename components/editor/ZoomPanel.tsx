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
        <div className="space-y-4">
            <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">
                    Zoom at {(playheadMs / 1000).toFixed(1)}s
                </label>
                <p className="text-xs text-neutral-500 mb-3">
                    Add a zoom point at the current playhead. The video smoothly scales between points as it plays.
                </p>
                <button
                    onClick={() => onAdd(playheadMs, 1.3)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2.5 rounded-lg font-medium transition-colors">
                    <Plus className="w-4 h-4" /> Add Zoom Point Here
                </button>
            </div>

            <div className="space-y-2">
                {keyframes.length === 0 && (
                    <p className="text-xs text-neutral-500">No zoom points yet — video stays at 100%.</p>
                )}
                {keyframes.map((kf) => (
                    <div key={kf.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-xs text-neutral-400">
                                <ZoomIn className="w-3.5 h-3.5" /> {(kf.atMs / 1000).toFixed(1)}s
                            </span>
                            <button onClick={() => onRemove(kf.id)} className="text-neutral-500 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-neutral-400 mb-1">
                                <span>Scale</span><span>{Math.round(kf.scale * 100)}%</span>
                            </div>
                            <input
                                type="range" min={100} max={250} value={kf.scale * 100}
                                onChange={(e) => onUpdate(kf.id, { scale: Number(e.target.value) / 100 })}
                                className="w-full accent-indigo-500 h-1"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}