'use client';

import React, { useRef, useState } from 'react';
import { GripHorizontal, Loader2, Sparkles } from 'lucide-react';
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

const MIN_HEIGHT = 96;
const MAX_HEIGHT = 520;
const DEFAULT_HEIGHT = 168;

export function Teleprompter({ scriptText, language, onLanguageChange, onScriptChange }: TeleprompterProps) {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('Warm and confident');
    const [seconds, setSeconds] = useState(30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

    const clampHeight = (value: number) => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, value));

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

            <div>
                <textarea
                    value={scriptText}
                    onChange={(e) => onScriptChange(e.target.value)}
                    id="teleprompter-script"
                    placeholder="Write, paste, or generate your script…"
                    style={{ height }}
                    className="block w-full resize-none rounded-t-2xl border border-b-0 border-[#14121F]/10 bg-[#F7F6FB] p-3.5 text-sm leading-relaxed text-[#14121F] placeholder:text-[#14121F]/40 focus:border-[#6A4CFF] focus:bg-white focus:outline-none"
                />
                {/* Drag handle: mouse and touch */}
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Drag to change script box height"
                    aria-valuemin={MIN_HEIGHT}
                    aria-valuemax={MAX_HEIGHT}
                    aria-valuenow={height}
                    tabIndex={0}
                    title="Drag up or down to resize"
                    onPointerDown={(event) => {
                        dragRef.current = { startY: event.clientY, startHeight: height };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                        if (!dragRef.current) return;
                        setHeight(clampHeight(dragRef.current.startHeight + (event.clientY - dragRef.current.startY)));
                    }}
                    onPointerUp={() => { dragRef.current = null; }}
                    onPointerCancel={() => { dragRef.current = null; }}
                    onDoubleClick={() => setHeight(DEFAULT_HEIGHT)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') { event.preventDefault(); setHeight((h) => clampHeight(h + 24)); }
                        if (event.key === 'ArrowUp') { event.preventDefault(); setHeight((h) => clampHeight(h - 24)); }
                    }}
                    className="flex h-5 w-full cursor-ns-resize touch-none items-center justify-center rounded-b-2xl border border-[#14121F]/10 bg-[#14121F]/5 text-[#14121F]/40 transition-colors hover:bg-[#6A4CFF]/15 hover:text-[#6A4CFF] focus:border-[#6A4CFF] focus:outline-none">
                    <GripHorizontal className="h-4 w-4" />
                </div>
            </div>

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