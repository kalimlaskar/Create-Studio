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
        <div className="space-y-5">
            <section className="space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-neutral-100">Automatic captions</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
                        Audio is sent securely to the configured transcription service. Review the words before export.
                    </p>
                </div>
                <label className="block text-xs text-neutral-400" htmlFor="caption-language">Spoken language</label>
                <select
                    id="caption-language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as TranscriptionLanguage)}
                    disabled={isTranscribing}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none disabled:opacity-60">
                    <option value="auto">Auto detect</option>
                    <option value="en">English (including accents)</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish (Hindi + English)</option>
                </select>
                <button
                    type="button"
                    onClick={() => onGenerate(language)}
                    disabled={isTranscribing || durationMs <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                    {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isTranscribing ? transcriptionProgress > 0 && transcriptionProgress < 95 ? `Capturing audio… ${transcriptionProgress}%` : 'Transcribing audio…' : 'Generate auto-captions'}
                </button>
                {isTranscribing && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-valuenow={transcriptionProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Caption generation progress">
                        <div className={`h-full rounded-full bg-indigo-500 transition-[width] ${transcriptionProgress === 0 || transcriptionProgress >= 95 ? 'w-1/3 animate-pulse' : ''}`} style={transcriptionProgress > 0 && transcriptionProgress < 95 ? { width: `${transcriptionProgress}%` } : undefined} />
                    </div>
                )}
                {error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/30 p-2 text-xs text-red-300">{error}</p>}
            </section>

            <section className="space-y-3 border-t border-neutral-800 pt-4">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Caption style</h3>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {STYLE_PRESETS.map((preset) => (
                            <button
                                type="button"
                                key={preset.id}
                                onClick={() => onStyleChange(preset.id)}
                                aria-pressed={captionStyle === preset.id}
                                className={`rounded-lg border px-2 py-2 text-left transition-colors ${captionStyle === preset.id ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'}`}>
                                <span className={`block text-xs ${preset.id === 'bold' ? 'font-black' : 'font-semibold'}`}>{preset.sample}</span>
                                <span className="mt-1 block text-[10px] text-neutral-500">{preset.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="space-y-2 border-t border-neutral-800 pt-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        <Captions className="h-4 w-4" /> Words ({captions.length})
                    </h3>
                    <button type="button" onClick={addCaption} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-500/10">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                </div>
                {captions.length === 0 ? (
                    <p className="text-xs text-neutral-500">Generate captions or add one at the current playhead.</p>
                ) : (
                    <div className="max-h-[38vh] space-y-1 overflow-y-auto pr-1">
                        {captions.map((caption) => (
                            <div key={caption.id} className="group flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 hover:border-neutral-800 hover:bg-neutral-800/50">
                                <button
                                    type="button"
                                    onClick={() => onSeek(caption.startMs)}
                                    className="w-11 shrink-0 text-left font-mono text-[10px] text-neutral-500 hover:text-indigo-300"
                                    aria-label={`Seek to ${(caption.startMs / 1000).toFixed(1)} seconds`}>
                                    {(caption.startMs / 1000).toFixed(1)}s
                                </button>
                                <input
                                    value={caption.text}
                                    onFocus={() => onSeek(caption.startMs)}
                                    onChange={(event) => onUpdate(caption.id, { text: event.target.value })}
                                    aria-label={`Edit caption word at ${(caption.startMs / 1000).toFixed(1)} seconds`}
                                    className="min-w-0 flex-1 border-b border-transparent bg-transparent px-1 py-1 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemove(caption.id)}
                                    className="shrink-0 rounded p-1 text-neutral-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
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
