'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Pencil, Sparkles, Loader2, Volume2 } from 'lucide-react';
import { ScriptLanguage } from '@/types/studio';

interface ExportModalProps {
    videoUrl: string;
    mimeType: string;
    scriptText: string;
    onReset: () => void;
    onEdit: () => void;
}

const DUBBING_OPTIONS: Array<[ScriptLanguage, string]> = [
    ['hi', 'Hindi'],
    ['bn', 'Bengali'],
    ['ta', 'Tamil'],
    ['te', 'Telugu'],
];

export function ExportModal({ videoUrl, mimeType, scriptText, onReset, onEdit }: ExportModalProps) {
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const [targetLanguage, setTargetLanguage] = useState<ScriptLanguage>('hi');
    const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
    const [isGeneratingDub, setIsGeneratingDub] = useState(false);
    const [dubAudioUrl, setDubAudioUrl] = useState<string | null>(null);
    const [dubError, setDubError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (dubAudioUrl) URL.revokeObjectURL(dubAudioUrl);
        };
    }, [dubAudioUrl]);

    const generateDubbedAudio = async () => {
        const cleanScript = scriptText.trim();
        if (!cleanScript) {
            setDubError('Add a script or transcript before creating a dubbed track.');
            return;
        }

        setIsGeneratingDub(true);
        setDubError(null);

        try {
            const response = await fetch('/api/dub', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: cleanScript,
                    sourceLanguage: 'en',
                    targetLanguage,
                    voiceGender,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? 'The dubbing service could not generate an audio track.');
            }

            const audioBlob = await response.blob();
            const nextUrl = URL.createObjectURL(audioBlob);
            if (dubAudioUrl) URL.revokeObjectURL(dubAudioUrl);
            setDubAudioUrl(nextUrl);
        } catch (error) {
            setDubError(error instanceof Error ? error.message : 'The dubbing service could not generate an audio track.');
        } finally {
            setIsGeneratingDub(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-neutral-950/90 z-40 flex flex-col items-center justify-center p-6">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-xl w-full flex flex-col items-center shadow-2xl">
                <h2 className="text-lg font-bold mb-4">Your Video is Ready! 🎉</h2>
                <video src={videoUrl} controls className="w-full rounded-xl mb-6 max-h-75 object-cover" />
                <div className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 mb-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
                            <Sparkles className="w-4 h-4" /> English voiceover dubbing
                        </div>
                        <div className="flex gap-2">
                            <select
                                aria-label="Dub language"
                                value={targetLanguage}
                                onChange={(event) => setTargetLanguage(event.target.value as ScriptLanguage)}
                                className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
                            >
                                {DUBBING_OPTIONS.map(([language, label]) => (
                                    <option key={language} value={language}>{label}</option>
                                ))}
                            </select>
                            <select
                                aria-label="Voice gender"
                                value={voiceGender}
                                onChange={(event) => setVoiceGender(event.target.value as 'female' | 'male')}
                                className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-xs text-neutral-100 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="female">Female voice</option>
                                <option value="male">Male voice</option>
                            </select>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void generateDubbedAudio()}
                        disabled={isGeneratingDub}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGeneratingDub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                        {isGeneratingDub ? 'Generating dubbed audio…' : 'Generate dubbed audio'}
                    </button>
                    <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                        Translates your English script into the selected language and creates a separate WAV voiceover with Gemini. The original recording audio is unchanged. Free-tier limits apply.
                    </p>
                    {dubError && <p className="mt-2 text-xs text-red-300">{dubError}</p>}
                    {dubAudioUrl && (
                        <div className="mt-3 space-y-2">
                            <audio controls src={dubAudioUrl} className="w-full" />
                            <div className="flex gap-2">
                                <a
                                    href={dubAudioUrl}
                                    download={`dubbed-audio-${targetLanguage}.wav`}
                                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-center text-xs font-semibold text-neutral-100 hover:bg-neutral-700"
                                >
                                    Download WAV
                                </a>
                            </div>
                        </div>
                    )}
                </div>
                <p className="text-xs text-neutral-400 text-center mb-5">
                    To include filters and text overlays, open Edit Video and download from the editor.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-600/20">
                        <Pencil className="w-4 h-4" /> Edit Video (filters & text)
                    </button>
                    <a
                        href={videoUrl}
                        download={`creator-studio-recording.${extension}`}
                        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all">
                        <Download className="w-4 h-4" /> Download Original (Unedited)
                    </a>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all">
                        <RefreshCw className="w-4 h-4" /> Record Again
                    </button>
                </div>
            </div>
        </div>
    );
}