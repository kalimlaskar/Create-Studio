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
        const endMs = Math.min(durationMs, startMs + 3000);
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
        <div className="space-y-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div>
                <div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#6A4CFF]" /><h3 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Hook builder</h3></div>
                <p className="mb-2.5 text-xs leading-relaxed text-[#14121F]/60">Write the opening line that earns the next few seconds of attention.</p>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {['Stop scrolling if you want to…', '3 things I wish I knew about…', 'Here’s the easiest way to…'].map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setHookDraft(suggestion)} className="rounded-full border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-1 text-xs font-semibold text-[#14121F]/80 hover:bg-[#14121F] hover:text-white transition">{suggestion}</button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input value={hookDraft} onChange={(event) => setHookDraft(event.target.value)} placeholder="Your hook or opening line…"
                        className="min-w-0 flex-1 rounded-xl border border-[#14121F]/15 bg-white px-3.5 py-2.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none" />
                    <button type="button" onClick={useHook} disabled={!hookDraft.trim()} title="Add hook as an opening overlay"
                        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5839e0] disabled:opacity-40 shadow-sm"><Plus className="h-4 w-4" /> Use hook</button>
                </div>
            </div>

            <div className="border-t border-[#14121F]/10 pt-4">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Timed text overlays</h3>
                <p className="mb-2 text-xs leading-relaxed text-[#14121F]/60">Add text at the playhead ({(playheadMs / 1000).toFixed(1)}s) and adjust its on-screen duration.</p>
                <label className="mb-1.5 block text-xs font-semibold text-[#14121F]/80" htmlFor="overlay-text-style">Text design</label>
                <select id="overlay-text-style" value={textStyle} onChange={(event) => setTextStyle(event.target.value as TextOverlayStyle)} className="mb-2.5 w-full rounded-xl border border-[#14121F]/15 bg-white px-3.5 py-2.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none">
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
                        className="flex-1 bg-white border border-[#14121F]/15 text-xs font-medium rounded-xl px-3.5 py-2.5 text-[#14121F] focus:outline-none focus:border-[#6A4CFF]"
                    />
                    <button
                        onClick={handleAdd}
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#6A4CFF] hover:bg-[#5839e0] text-white shrink-0 shadow-sm">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="border-t border-[#14121F]/10 pt-4">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Images & stickers</h3>
                <p className="mb-2.5 text-xs leading-relaxed text-[#14121F]/60">Add a PNG, JPG, or WebP image at the playhead. It will appear for four seconds by default.</p>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#14121F]/20 px-3.5 py-3.5 text-xs font-semibold text-[#14121F]/70 transition-colors hover:border-[#6A4CFF] hover:text-[#6A4CFF] hover:bg-[#6A4CFF]/5">
                    <ImagePlus className="h-4 w-4" /> Choose image
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={addImage} className="sr-only" />
                </label>
                {imageError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{imageError}</p>}
            </div>

            <div className="space-y-2.5">
                {overlays.length === 0 && (
                    <p className="text-xs text-[#14121F]/50">No overlays added yet.</p>
                )}
                {overlays.map((clip) => (
                    <div key={clip.id} className="border border-[#14121F]/10 rounded-2xl bg-[#F7F6FB] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <input
                                value={clip.type === 'image' ? 'Image overlay' : clip.content}
                                readOnly={clip.type === 'image'}
                                onChange={(e) => onUpdate(clip.id, { content: e.target.value })}
                                className="flex-1 bg-transparent text-xs font-semibold text-[#14121F] focus:outline-none border-b border-transparent focus:border-[#14121F]/20"
                            />
                            <button onClick={() => onRemove(clip.id)} className="text-[#14121F]/40 hover:text-red-600 shrink-0 transition">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#14121F]/60 font-mono">
                            <span>{(clip.startMs / 1000).toFixed(1)}s – {(clip.endMs / 1000).toFixed(1)}s</span>
                            <input
                                type="range"
                                min={0}
                                max={Math.max(clip.startMs + 250, durationMs)}
                                value={Math.min(durationMs, clip.endMs)}
                                onChange={(e) => onUpdate(clip.id, { endMs: Math.min(durationMs, Math.max(clip.startMs + 200, Number(e.target.value))) })}
                                className="flex-1 accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full"
                            />
                        </div>
                        {clip.type === 'image' ? (
                            <label className="block text-xs font-medium text-[#14121F]/70">Image size · {Math.round((clip.width ?? 0.32) * 100)}%
                                <input type="range" min={10} max={80} value={(clip.width ?? 0.32) * 100} onChange={(event) => onUpdate(clip.id, { width: Number(event.target.value) / 100 })} className="mt-1 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full" />
                            </label>
                        ) : clip.type === 'text' ? (
                            <div className="grid grid-cols-2 gap-2.5">
                                <label className="text-xs font-medium text-[#14121F]/70">Design
                                    <select value={clip.textStyle ?? 'classic'} onChange={(event) => onUpdate(clip.id, { textStyle: event.target.value as TextOverlayStyle })} className="mt-1 w-full rounded-xl border border-[#14121F]/15 bg-white px-2.5 py-2 text-xs font-medium text-[#14121F]">
                                        <option value="classic">Classic</option><option value="banner">Banner</option><option value="highlight">Highlight</option><option value="outline">Outline</option>
                                    </select>
                                </label>
                                <label className="text-xs font-medium text-[#14121F]/70">Text color
                                    <input type="color" value={clip.color ?? '#ffffff'} onChange={(event) => onUpdate(clip.id, { color: event.target.value })} className="mt-1 h-9 w-full cursor-pointer rounded-xl border border-[#14121F]/15 bg-white p-1 shadow-sm" />
                                </label>
                                <label className="col-span-2 text-xs font-medium text-[#14121F]/70">Position · horizontal {Math.round(clip.x * 100)}%
                                    <input type="range" min={5} max={95} value={clip.x * 100} onChange={(event) => onUpdate(clip.id, { x: Number(event.target.value) / 100 })} className="mt-1 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full" />
                                </label>
                                <label className="col-span-2 text-xs font-medium text-[#14121F]/70">Position · vertical {Math.round(clip.y * 100)}%
                                    <input type="range" min={5} max={95} value={clip.y * 100} onChange={(event) => onUpdate(clip.id, { y: Number(event.target.value) / 100 })} className="mt-1 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full" />
                                </label>
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}