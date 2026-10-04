'use client';

import React, { useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
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
    const [hookDraft, setHookDraft] = useState('');

    const useHook = () => {
        const content = hookDraft.trim();
        if (!content || durationMs === 0) return;
        const startMs = Math.max(0, Math.min(playheadMs, durationMs - 250));
        onAdd({ type: 'text', content, startMs, endMs: Math.min(durationMs, startMs + 3500), x: 0.5, y: 0.2, fontSize: 42, color: '#ffffff' });
        setHookDraft('');
    };

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
                <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-300" /><h3 className="text-sm font-semibold text-neutral-100">Hook builder</h3></div>
                <p className="mb-2 text-[11px] leading-relaxed text-neutral-500">Write the opening line that earns the next few seconds of attention.</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                    {['Stop scrolling if you want to…', '3 things I wish I knew about…', 'Here’s the easiest way to…'].map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setHookDraft(suggestion)} className="rounded-full border border-neutral-700 px-2 py-1 text-[10px] text-neutral-400 hover:border-indigo-500 hover:text-neutral-200">{suggestion}</button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={hookDraft} onChange={(event) => setHookDraft(event.target.value)} placeholder="Your hook or opening line…"
                        className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none" />
                    <button type="button" onClick={useHook} disabled={!hookDraft.trim()} title="Add hook as an opening overlay"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"><Plus className="h-4 w-4" /> Use hook</button>
                </div>
            </div>

            <div className="border-t border-neutral-800 pt-4">
                <h3 className="mb-1 text-sm font-semibold text-neutral-100">Timed text overlays</h3>
                <p className="mb-2 text-[11px] text-neutral-500">Add text at the playhead ({(playheadMs / 1000).toFixed(1)}s) and adjust its on-screen duration.</p>
                <div className="flex gap-2">
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type a callout or label…"
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