'use client';

import React, { useState } from 'react';
import { Captions, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { CaptionCue, CaptionStyle } from '@/types/editor';

export type TranscriptionLanguage = 'auto' | 'en' | 'hi' | 'hinglish';

interface CaptionsPanelProps {
    captions: CaptionCue[];
    durationMs: number;
    playheadMs: number;
    captionStyle: CaptionStyle;
    isTranscribing: boolean;
    transcriptionProgress: number;
    error: string | null;
    onStyleChange: (style: CaptionStyle) => void;
    onAdd: (cue: Omit<CaptionCue, 'id'>) => void;
    onUpdate: (id: string, patch: Partial<CaptionCue>) => void;
    onRemove: (id: string) => void;
    onSeek: (timeMs: number) => void;
    onGenerate: (language: TranscriptionLanguage) => void;
}

const STYLE_PRESETS: Array<{ id: CaptionStyle; label: string; sample: string }> = [
    { id: 'classic', label: 'Classic', sample: 'Caption box' },
    { id: 'bold', label: 'Bold', sample: 'Karaoke' },
    { id: 'minimal', label: 'Minimal', sample: 'Clean' },
];

export function CaptionsPanel({
    captions, durationMs, playheadMs, captionStyle, isTranscribing, transcriptionProgress, error,
    onStyleChange, onAdd, onUpdate, onRemove, onSeek, onGenerate,
}: CaptionsPanelProps) {
    const [language, setLanguage] = useState<TranscriptionLanguage>('auto');

    const addCaption = () => {
        if (durationMs <= 0) return;
        const startMs = Math.max(0, Math.min(playheadMs, durationMs - 250));
        onAdd({ text: 'New caption', startMs, endMs: Math.min(durationMs, startMs + 1800) });
    };

    return (
        <div className="space-y-5 font-[family-name:var(--font-body)] text-[#14121F]">
            <section className="space-y-3">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Automatic captions</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#14121F]/60">
                        Audio is sent securely to the configured transcription service. Review the words before export.
                    </p>
                </div>
                <label className="block text-xs font-semibold text-[#14121F]/80" htmlFor="caption-language">Spoken language</label>
                <select
                    id="caption-language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as TranscriptionLanguage)}
                    disabled={isTranscribing}
                    className="w-full rounded-xl border border-[#14121F]/15 bg-white px-3.5 py-2.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none disabled:opacity-60">
                    <option value="auto">Auto detect</option>
                    <option value="en">English (including accents)</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish (Hindi + English)</option>
                </select>
                <button
                    type="button"
                    onClick={() => onGenerate(language)}
                    disabled={isTranscribing || durationMs <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#5839e0] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm">
                    {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isTranscribing ? transcriptionProgress > 0 && transcriptionProgress < 95 ? `Capturing audio… ${transcriptionProgress}%` : 'Transcribing audio…' : 'Generate auto-captions'}
                </button>
                {isTranscribing && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#14121F]/10" role="progressbar" aria-valuenow={transcriptionProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Caption generation progress">
                        <div className={`h-full rounded-full bg-[#6A4CFF] transition-[width] ${transcriptionProgress === 0 || transcriptionProgress >= 95 ? 'w-1/3 animate-pulse' : ''}`} style={transcriptionProgress > 0 && transcriptionProgress < 95 ? { width: `${transcriptionProgress}%` } : undefined} />
                    </div>
                )}
                {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600">{error}</p>}
            </section>

            <section className="space-y-3 border-t border-[#14121F]/10 pt-4">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Caption style</h3>
                    <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                        {STYLE_PRESETS.map((preset) => (
                            <button
                                type="button"
                                key={preset.id}
                                onClick={() => onStyleChange(preset.id)}
                                aria-pressed={captionStyle === preset.id}
                                className={`rounded-2xl border px-3 py-2.5 text-left transition-all ${captionStyle === preset.id ? 'border-[#6A4CFF] bg-[#6A4CFF]/10 text-[#14121F] shadow-sm' : 'border-[#14121F]/10 bg-[#F7F6FB] text-[#14121F]/80 hover:border-[#6A4CFF]/40 hover:bg-white'}`}>
                                <span className={`block text-xs ${preset.id === 'bold' ? 'font-black' : 'font-semibold'}`}>{preset.sample}</span>
                                <span className="mt-1 block text-[10px] text-[#14121F]/50 font-medium">{preset.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="space-y-2.5 border-t border-[#14121F]/10 pt-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14121F]/70">
                        <Captions className="h-4 w-4 text-[#6A4CFF]" /> Words ({captions.length})
                    </h3>
                    <button type="button" onClick={addCaption} className="flex items-center gap-1 rounded-full border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-1 text-xs font-semibold text-[#14121F] hover:bg-[#14121F] hover:text-white transition">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                </div>
                {captions.length === 0 ? (
                    <p className="text-xs text-[#14121F]/50">Generate captions or add one at the current playhead.</p>
                ) : (
                    <div className="max-h-[38vh] space-y-1.5 overflow-y-auto pr-1">
                        {captions.map((caption) => (
                            <div key={caption.id} className="group flex items-center gap-2 rounded-xl border border-transparent px-2.5 py-1.5 hover:border-[#14121F]/10 hover:bg-[#F7F6FB] transition">
                                <button
                                    type="button"
                                    onClick={() => onSeek(caption.startMs)}
                                    className="w-12 shrink-0 text-left font-mono text-[11px] font-semibold text-[#14121F]/50 hover:text-[#6A4CFF]"
                                    aria-label={`Seek to ${(caption.startMs / 1000).toFixed(1)} seconds`}>
                                    {(caption.startMs / 1000).toFixed(1)}s
                                </button>
                                <input
                                    value={caption.text}
                                    onFocus={() => onSeek(caption.startMs)}
                                    onChange={(event) => onUpdate(caption.id, { text: event.target.value })}
                                    aria-label={`Edit caption word at ${(caption.startMs / 1000).toFixed(1)} seconds`}
                                    className="min-w-0 flex-1 border-b border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemove(caption.id)}
                                    className="shrink-0 rounded-lg p-1 text-[#14121F]/40 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                                    aria-label={`Delete caption ${caption.text}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}