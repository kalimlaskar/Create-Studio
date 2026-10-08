'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Pencil, Sparkles, Loader2, Volume2, ChevronDown } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#14121F]/80 backdrop-blur-md grain">
            <div className="flex min-h-full items-center justify-center p-3 sm:p-6 font-[family-name:var(--font-body)] text-[#14121F]">
                <div className="bg-[#F7F6FB] border border-[#14121F]/10 p-5 sm:p-7 rounded-3xl max-w-xl w-full flex flex-col items-center shadow-2xl rise">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#14121F] mb-4">Your Video is Ready! 🎉</h2>
                    <video src={videoUrl} controls className="w-full rounded-2xl mb-6 max-h-[40dvh] object-contain bg-black shadow-md" />
                    <div className="w-full rounded-2xl border border-[#14121F]/10 bg-white p-4 sm:p-5 mb-5 shadow-xs">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#6A4CFF]">
                                <Sparkles className="w-4 h-4" /> English voiceover dubbing
                            </div>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <select
                                        aria-label="Dub language"
                                        value={targetLanguage}
                                        onChange={(event) => setTargetLanguage(event.target.value as ScriptLanguage)}
                                        className="appearance-none rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] pl-3 pr-8 py-2 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none cursor-pointer shadow-xs"
                                    >
                                        {DUBBING_OPTIONS.map(([language, label]) => (
                                            <option key={language} value={language}>{label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                                </div>
                                <div className="relative">
                                    <select
                                        aria-label="Voice gender"
                                        value={voiceGender}
                                        onChange={(event) => setVoiceGender(event.target.value as 'female' | 'male')}
                                        className="appearance-none rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] pl-3 pr-8 py-2 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none cursor-pointer shadow-xs"
                                    >
                                        <option value="female">Female voice</option>
                                        <option value="male">Male voice</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => void generateDubbedAudio()}
                            disabled={isGeneratingDub}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#5839e0] disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                        >
                            {isGeneratingDub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                            {isGeneratingDub ? 'Generating dubbed audio…' : 'Generate dubbed audio'}
                        </button>
                        <p className="mt-2.5 text-xs leading-relaxed text-[#14121F]/60">
                            Translates your English script into the selected language and creates a separate WAV voiceover with Gemini. The original recording audio is unchanged. Free-tier limits apply.
                        </p>
                        {dubError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-600">{dubError}</p>}
                        {dubAudioUrl && (
                            <div className="mt-3.5 space-y-2.5">
                                <audio controls src={dubAudioUrl} className="w-full" />
                                <div className="flex gap-2">
                                    <a
                                        href={dubAudioUrl}
                                        download={`dubbed-audio-${targetLanguage}.wav`}
                                        className="flex-1 rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3.5 py-2.5 text-center text-xs font-semibold text-[#14121F] hover:bg-white transition shadow-xs"
                                    >
                                        Download WAV
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-xs font-medium text-[#14121F]/60 text-center mb-5">
                        To include filters and text overlays, open Edit Video and download from the editor.
                    </p>
                    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
                        <button
                            onClick={onEdit}
                            className="flex items-center justify-center gap-2 bg-[#6A4CFF] hover:bg-[#5839e0] text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-[#6A4CFF]/20">
                            <Pencil className="w-4 h-4" /> Edit Video (filters & text)
                        </button>
                        <a
                            href={videoUrl}
                            download={`creator-studio-recording.${extension}`}
                            className="flex items-center justify-center gap-2 bg-white border border-[#14121F]/15 hover:bg-[#14121F]/5 text-[#14121F] px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-xs">
                            <Download className="w-4 h-4 text-[#6A4CFF]" /> Download Original (Unedited)
                        </a>
                        <button
                            onClick={onReset}
                            className="flex items-center justify-center gap-2 bg-white border border-[#14121F]/15 hover:bg-[#14121F]/5 text-[#14121F] px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-xs">
                            <RefreshCw className="w-4 h-4 text-[#14121F]/60" /> Record Again
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}