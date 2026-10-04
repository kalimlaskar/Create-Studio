'use client';

import React, { useState } from 'react';
import { ImagePlus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { OverlayClip, TextOverlayStyle } from '@/types/editor';

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
    const [textStyle, setTextStyle] = useState<TextOverlayStyle>('classic');
    const [imageError, setImageError] = useState<string | null>(null);

    const addImage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        setImageError(null);
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setImageError('Choose an image file.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError('Choose an image smaller than 5 MB.');
            return;
        }
        if (durationMs < 250) {
            setImageError('The video is too short to add an image overlay.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result !== 'string') return;
            const startMs = Math.max(0, Math.min(playheadMs, durationMs - 250));
            onAdd({ type: 'image', content: reader.result, startMs, endMs: Math.min(durationMs, startMs + 4000), x: 0.5, y: 0.5, width: 0.32 });
        };
        reader.onerror = () => setImageError('Could not read that image. Try another file.');
        reader.readAsDataURL(file);
    };

    const useHook = () => {
        const content = hookDraft.trim();
        if (!content || durationMs === 0) return;
        const startMs = Math.max(0, Math.min(playheadMs, durationMs - 250));
        onAdd({ type: 'text', content, startMs, endMs: Math.min(durationMs, startMs + 3500), x: 0.5, y: 0.2, fontSize: 42, color: '#ffffff', textStyle });
        setHookDraft('');
    };

    const handleAdd = () => {
        if (!draft.trim() || durationMs < 250) return;
        const startMs = Math.max(0, Math.min(playheadMs, durationMs - 250));
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
            textStyle,
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
                <label className="mb-2 block text-[11px] text-neutral-400" htmlFor="overlay-text-style">Text design</label>
                <select id="overlay-text-style" value={textStyle} onChange={(event) => setTextStyle(event.target.value as TextOverlayStyle)} className="mb-2 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none">
                    <option value="classic">Classic outlined</option>
                    <option value="banner">Bold banner</option>
                    <option value="highlight">Highlight box</option>
                    <option value="outline">Outline only</option>
                </select>
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

            <div className="border-t border-neutral-800 pt-4">
                <h3 className="mb-1 text-sm font-semibold text-neutral-100">Images & stickers</h3>
                <p className="mb-2 text-[11px] text-neutral-500">Add a PNG, JPG, or WebP image at the playhead. It will appear for four seconds by default.</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 px-3 py-3 text-xs text-neutral-300 transition-colors hover:border-indigo-500 hover:text-indigo-300">
                    <ImagePlus className="h-4 w-4" /> Choose image
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={addImage} className="sr-only" />
                </label>
                {imageError && <p role="alert" className="mt-2 text-xs text-red-300">{imageError}</p>}
            </div>

            <div className="space-y-2">
                {overlays.length === 0 && (
                    <p className="text-xs text-neutral-500">No overlays added yet.</p>
                )}
                {overlays.map((clip) => (
                    <div key={clip.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <input
                                value={clip.type === 'image' ? 'Image overlay' : clip.content}
                                readOnly={clip.type === 'image'}
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
                                max={Math.max(clip.startMs + 250, durationMs)}
                                value={Math.min(durationMs, clip.endMs)}
                                onChange={(e) => onUpdate(clip.id, { endMs: Math.min(durationMs, Math.max(clip.startMs + 200, Number(e.target.value))) })}
                                className="flex-1 accent-indigo-500 h-1"
                            />
                        </div>
                        {clip.type === 'image' ? (
                            <label className="block text-[11px] text-neutral-400">Image size · {Math.round((clip.width ?? 0.32) * 100)}%
                                <input type="range" min={10} max={80} value={(clip.width ?? 0.32) * 100} onChange={(event) => onUpdate(clip.id, { width: Number(event.target.value) / 100 })} className="mt-1 w-full accent-indigo-500" />
                            </label>
                        ) : clip.type === 'text' ? (
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-[11px] text-neutral-400">Design
                                    <select value={clip.textStyle ?? 'classic'} onChange={(event) => onUpdate(clip.id, { textStyle: event.target.value as TextOverlayStyle })} className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-200">
                                        <option value="classic">Classic</option><option value="banner">Banner</option><option value="highlight">Highlight</option><option value="outline">Outline</option>
                                    </select>
                                </label>
                                <label className="text-[11px] text-neutral-400">Text color
                                    <input type="color" value={clip.color ?? '#ffffff'} onChange={(event) => onUpdate(clip.id, { color: event.target.value })} className="mt-1 h-8 w-full cursor-pointer rounded border border-neutral-700 bg-neutral-800 p-1" />
                                </label>
                                <label className="col-span-2 text-[11px] text-neutral-400">Position · horizontal {Math.round(clip.x * 100)}%
                                    <input type="range" min={5} max={95} value={clip.x * 100} onChange={(event) => onUpdate(clip.id, { x: Number(event.target.value) / 100 })} className="mt-1 w-full accent-indigo-500" />
                                </label>
                                <label className="col-span-2 text-[11px] text-neutral-400">Position · vertical {Math.round(clip.y * 100)}%
                                    <input type="range" min={5} max={95} value={clip.y * 100} onChange={(event) => onUpdate(clip.id, { y: Number(event.target.value) / 100 })} className="mt-1 w-full accent-indigo-500" />
                                </label>
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}