'use client';

import React from 'react';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ScriptLanguage } from '@/types/studio';

interface TeleprompterProps {
    scriptText: string;
    language: ScriptLanguage;
    onLanguageChange: (language: ScriptLanguage) => void;
    onScriptChange: (text: string) => void;
}

const LANGUAGE_OPTIONS: Array<[ScriptLanguage, string]> = [
    ['en', 'English'], ['hinglish', 'Hinglish'], ['hi', 'Hindi · हिन्दी'],
    ['bn', 'Bengali · বাংলা'], ['mr', 'Marathi · मराठी'], ['ta', 'Tamil · தமிழ்'], ['te', 'Telugu · తెలుగు'],
];

export function Teleprompter({ scriptText, language, onLanguageChange, onScriptChange }: TeleprompterProps) {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Warm and confident');
    const [seconds, setSeconds] = useState(30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateScript = async () => {
        if (!topic.trim() || isGenerating) return;
        setIsGenerating(true);
        setError(null);
        try {
            const response = await fetch('/api/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic.trim(), tone, seconds, language }),
            });
            const result = await response.json() as { script?: string; error?: string };
            if (!response.ok) throw new Error(result.error ?? 'Could not generate a script.');
            if (!result.script) throw new Error('The script generator returned an empty response.');
            onScriptChange(result.script);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not generate a script.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-3 pt-4 border-t border-[#14121F]/10">
            <div className="flex items-center justify-between gap-2">
                <label htmlFor="teleprompter-script" className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70">Teleprompter script</label>
                <select aria-label="Script language" value={language} onChange={(event) => onLanguageChange(event.target.value as ScriptLanguage)}
                    className="max-w-36 rounded-xl border border-[#14121F]/10 bg-[#F7F6FB] px-2.5 py-1.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none">
                    {LANGUAGE_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
            </div>
            <textarea
                value={scriptText}
                onChange={(e) => onScriptChange(e.target.value)}
                id="teleprompter-script"
                placeholder="Write, paste, or generate your script…"
                rows={7}
                className="w-full resize-y rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-3.5 text-sm leading-relaxed text-[#14121F] placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:bg-white focus:outline-none"
            />
            <details className="rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#6A4CFF]"><Sparkles className="h-3.5 w-3.5" /> AI script builder</summary>
                <div className="mt-3.5 space-y-3">
                    <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={240} placeholder="What is your video about?"
                        className="w-full rounded-xl border border-[#14121F]/10 bg-white px-3.5 py-2.5 text-xs text-[#14121F] placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                        <select value={tone} onChange={(event) => setTone(event.target.value)} aria-label="Script tone"
                            className="min-w-0 rounded-xl border border-[#14121F]/10 bg-white px-2.5 py-2 text-xs text-[#14121F] focus:border-[#6A4CFF] focus:outline-none">
                            <option>Warm and confident</option><option>Funny and casual</option><option>Educational</option><option>High-energy</option><option>Calm and thoughtful</option>
                        </select>
                        <select value={seconds} onChange={(event) => setSeconds(Number(event.target.value))} aria-label="Script duration"
                            className="min-w-0 rounded-xl border border-[#14121F]/10 bg-white px-2.5 py-2 text-xs text-[#14121F] focus:border-[#6A4CFF] focus:outline-none">
                            {[15, 30, 60, 90].map((value) => <option key={value} value={value}>{value} seconds</option>)}
                        </select>
                    </div>
                    <button type="button" onClick={() => void generateScript()} disabled={!topic.trim() || isGenerating}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#5839e0] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm">
                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {isGenerating ? 'Writing your script…' : 'Generate script'}
                    </button>
                    {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
                </div>
            </details>
            <p className="text-[11px] leading-relaxed text-[#14121F]/50">The script appears over the camera preview. Use the Scroll control on the prompter when you’re ready.</p>
        </div>
    );
}