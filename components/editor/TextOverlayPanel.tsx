'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { OverlayClip } from '@/types/editor';

interface TextOverlayPanelProps {
    overlays: OverlayClip[];
    durationMs: number;
    playheadMs: number;
    onAdd: (clip: Omit<OverlayClip, 'id'>) => void;
    onUpdate: (id: string, patch: Partial<OverlayClip>) => void;
    onRemove: (id: string) => void;
}

export function TextOverlayPanel({ overlays, durationMs, playheadMs, onAdd, onUpdate, onRemove }: TextOverlayPanelProps) {
    const [draft, setDraft] = useState('');

    const handleAdd = () => {
        if (!draft.trim() || durationMs === 0) return;
        const startMs = playheadMs;
        const endMs = Math.min(durationMs, startMs + 3000); // defaults to a 3s duration
        onAdd({
            type: 'text',
            content: draft.trim(),
            startMs,
            endMs,
            x: 0.5,
            y: 0.85,
            fontSize: 32,
            color: '#ffffff',
        });
        setDraft('');
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">
                    Add text at {(playheadMs / 1000).toFixed(1)}s
                </label>
                <div className="flex gap-2">
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Your text..."
                        className="flex-1 bg-neutral-800 border border-neutral-700 text-sm rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        onClick={handleAdd}
                        className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {overlays.length === 0 && (
                    <p className="text-xs text-neutral-500">No text added yet.</p>
                )}
                {overlays.map((clip) => (
                    <div key={clip.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <input
                                value={clip.content}
                                onChange={(e) => onUpdate(clip.id, { content: e.target.value })}
                                className="flex-1 bg-transparent text-sm text-neutral-200 focus:outline-none border-b border-transparent focus:border-neutral-700"
                            />
                            <button onClick={() => onRemove(clip.id)} className="text-neutral-500 hover:text-red-400 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span>{(clip.startMs / 1000).toFixed(1)}s – {(clip.endMs / 1000).toFixed(1)}s</span>
                            <input
                                type="range"
                                min={0}
                                max={durationMs}
                                value={clip.endMs}
                                onChange={(e) => onUpdate(clip.id, { endMs: Math.max(clip.startMs + 200, Number(e.target.value)) })}
                                className="flex-1 accent-indigo-500 h-1"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}