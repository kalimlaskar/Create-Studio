'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Upload, X, Music, Sparkles, Loader2, Volume2 } from 'lucide-react';
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
        <div className="space-y-4">
            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">Audio & dubbing</label>

            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />

            {current ? (
                <div className="border border-neutral-800 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-neutral-300">
                            <Music className="w-4 h-4" /> Track added
                        </span>
                        <button onClick={clear} className="text-neutral-500 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Volume</span><span>{Math.round(current.volume * 100)}%</span>
                        </div>
                        <input
                            type="range" min={0} max={100} value={current.volume * 100}
                            onChange={(e) => onSet([{ ...current, volume: Number(e.target.value) / 100 }])}
                            className="w-full accent-indigo-500 h-1"
                        />
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-700 rounded-lg py-3 text-xs text-neutral-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Upload background music
                </button>
            )}

            <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
                        <Sparkles className="h-4 w-4" /> Dub English script
                    </span>
                    <div className="flex gap-1.5">
                        <select
                            aria-label="Dub language"
                            value={targetLanguage}
                            onChange={(event) => setTargetLanguage(event.target.value as ScriptLanguage)}
                            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
                        >
                            {DUB_LANGUAGES.map(([language, label]) => <option key={language} value={language}>{label}</option>)}
                        </select>
                        <select
                            aria-label="Voice gender"
                            value={voiceGender}
                            onChange={(event) => setVoiceGender(event.target.value as 'female' | 'male')}
                            className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
                        >
                            <option value="female">Female voice</option>
                            <option value="male">Male voice</option>
                        </select>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void generateDub()}
                    disabled={isGeneratingDub}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isGeneratingDub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    {isGeneratingDub ? 'Generating voiceover…' : 'Generate dubbed audio'}
                </button>
                <p className="text-[10px] leading-relaxed text-neutral-500">Uses the English teleprompter script and Gemini free-tier limits. Adding the dub mutes the original audio to avoid overlapping voices; you can unmute it from the top toolbar.</p>
                {dubError && <p role="alert" className="text-xs text-red-300">{dubError}</p>}
                {dubAudioUrl && (
                    <div className="space-y-2">
                        <audio controls src={dubAudioUrl} className="w-full" />
                        <div className="flex gap-2">
                            <button type="button" onClick={addDubToProject} className="flex-1 rounded-md bg-emerald-700 px-2 py-2 text-xs font-semibold text-white hover:bg-emerald-600">
                                {current ? 'Replace track with dub' : 'Add dub to project'}
                            </button>
                            <a href={dubAudioUrl} download={`dubbed-audio-${targetLanguage}.wav`} className="rounded-md border border-neutral-700 px-2 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800">Download WAV</a>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}