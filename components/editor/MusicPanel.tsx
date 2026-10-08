'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Upload, X, Music, Sparkles, Loader2, Volume2, ChevronDown } from 'lucide-react';
import { AudioTrackClip } from '@/types/editor';
import { ScriptLanguage } from '@/types/studio';

interface MusicPanelProps {
    audioTracks: AudioTrackClip[];
    durationMs: number;
    scriptText: string;
    isSourceMuted: boolean;
    onMuteSourceAudio: () => void;
    onSet: (tracks: AudioTrackClip[]) => void;
}

const DUB_LANGUAGES: Array<[ScriptLanguage, string]> = [
    ['hi', 'Hindi'],
    ['bn', 'Bengali'],
    ['ta', 'Tamil'],
    ['te', 'Telugu'],
];

export function MusicPanel({ audioTracks, durationMs, scriptText, isSourceMuted, onMuteSourceAudio, onSet }: MusicPanelProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const current = audioTracks[0] ?? null;
    const [targetLanguage, setTargetLanguage] = useState<ScriptLanguage>('hi');
    const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
    const [isGeneratingDub, setIsGeneratingDub] = useState(false);
    const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
    const [dubError, setDubError] = useState<string | null>(null);
    const dubPreviewUrlRef = useRef<string | null>(null);
    const dubAddedToProjectRef = useRef(false);

    useEffect(() => () => {
        if (dubPreviewUrlRef.current && !dubAddedToProjectRef.current) {
            URL.revokeObjectURL(dubPreviewUrlRef.current);
        }
    }, []);

    const generateDub = async () => {
        const cleanScript = scriptText.trim();
        if (!cleanScript || cleanScript === 'Type or paste your script here...') {
            setDubError('Add an English script in the recording studio before generating a dub.');
            return;
        }

        setIsGeneratingDub(true);
        setDubError(null);
        try {
            const response = await fetch('/api/dub', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: cleanScript, sourceLanguage: 'en', targetLanguage, voiceGender }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? 'Could not generate the dubbed voiceover.');
            }

            const audioBlob = await response.blob();
            const nextUrl = URL.createObjectURL(audioBlob);
            if (dubPreviewUrlRef.current && !dubAddedToProjectRef.current) {
                URL.revokeObjectURL(dubPreviewUrlRef.current);
            }
            dubPreviewUrlRef.current = nextUrl;
            dubAddedToProjectRef.current = false;
            setDubAudioUrl(nextUrl);
        } catch (error) {
            setDubError(error instanceof Error ? error.message : 'Could not generate the dubbed voiceover.');
        } finally {
            setIsGeneratingDub(false);
        }
    };

    const addDubToProject = () => {
        if (!dubAudioUrl) return;
        if (current && current.url !== dubAudioUrl) URL.revokeObjectURL(current.url);
        dubAddedToProjectRef.current = true;
        onSet([{ id: 'bg-music', url: dubAudioUrl, startMs: 0, endMs: durationMs, volume: 1, loop: false }]);
        if (!isSourceMuted) onMuteSourceAudio();
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (current) URL.revokeObjectURL(current.url);
        const url = URL.createObjectURL(file);
        onSet([{
            id: 'bg-music',
            url,
            startMs: 0,
            endMs: durationMs,
            volume: 0.3,
        }]);
        e.target.value = '';
    };

    const clear = () => {
        if (current) URL.revokeObjectURL(current.url);
        onSet([]);
    };

    return (
        <div className="space-y-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70 block">Audio & dubbing</label>

            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />

            {current ? (
                <div className="border border-[#14121F]/10 rounded-2xl bg-[#F7F6FB] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-semibold text-[#14121F]">
                            <Music className="w-4 h-4 text-[#6A4CFF]" /> Track added
                        </span>
                        <button onClick={clear} className="text-[#14121F]/40 hover:text-red-600 transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-[#14121F]/60 mb-1">
                            <span>Volume</span><span>{Math.round(current.volume * 100)}%</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={current.volume * 100}
                            onChange={(e) => onSet([{ ...current, volume: Number(e.target.value) / 100 }])}
                            className="w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full"
                        />
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-[#14121F]/20 rounded-2xl py-3.5 text-xs font-semibold text-[#14121F]/70 hover:border-[#6A4CFF] hover:text-[#6A4CFF] hover:bg-[#6A4CFF]/5 transition-colors">
                    <Upload className="w-4 h-4" /> Upload background music
                </button>
            )}

            <section className="space-y-3 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-4">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-bold text-[#6A4CFF]">
                        <Sparkles className="h-4 w-4 shrink-0" /> Dub English script
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                        <select
                            aria-label="Dub language"
                            value={targetLanguage}
                            onChange={(event) => setTargetLanguage(event.target.value as ScriptLanguage)}
                            className="w-full appearance-none rounded-xl border border-[#14121F]/15 bg-white pl-3 pr-8 py-2 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none shadow-xs cursor-pointer"
                        >
                            {DUB_LANGUAGES.map(([language, label]) => <option key={language} value={language}>{label}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                    </div>
                    <div className="relative">
                        <select
                            aria-label="Voice gender"
                            value={voiceGender}
                            onChange={(event) => setVoiceGender(event.target.value as 'female' | 'male')}
                            className="w-full appearance-none rounded-xl border border-[#14121F]/15 bg-white pl-3 pr-8 py-2 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none shadow-xs cursor-pointer"
                        >
                            <option value="female">Female voice</option>
                            <option value="male">Male voice</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void generateDub()}
                    disabled={isGeneratingDub}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5839e0] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm transition-colors"
                >
                    {isGeneratingDub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    {isGeneratingDub ? 'Generating voiceover…' : 'Generate dubbed audio'}
                </button>
                <p className="text-[11px] leading-relaxed text-[#14121F]/50">Uses the English teleprompter script and Gemini free-tier limits. Adding the dub mutes the original audio to avoid overlapping voices; you can unmute it from the top toolbar.</p>
                {dubError && <p role="alert" className="text-xs font-medium text-red-600">{dubError}</p>}
                {dubAudioUrl && (
                    <div className="space-y-3 pt-2">
                        <audio controls src={dubAudioUrl} className="w-full accent-[#6A4CFF]" />
                        <div className="flex gap-2">
                            <button type="button" onClick={addDubToProject} className="flex-1 rounded-xl bg-[#14121F] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#2c2742] transition">
                                {current ? 'Replace track with dub' : 'Add dub to project'}
                            </button>
                            <a href={dubAudioUrl} download={`dubbed-audio-${targetLanguage}.wav`} className="rounded-xl border border-[#14121F]/15 bg-white px-3 py-2.5 text-xs font-semibold text-[#14121F] hover:bg-[#14121F] hover:text-white transition">Download WAV</a>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}