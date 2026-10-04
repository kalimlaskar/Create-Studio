'use client';

import React, { useMemo } from 'react';
import { Activity, AudioLines, Scissors } from 'lucide-react';
import { CaptionCue } from '@/types/editor';

interface DeliveryCoachPanelProps {
    captions: CaptionCue[];
    durationMs: number;
    trimStartMs: number;
    trimEndMs: number;
    onTighten: (startMs: number, endMs: number) => void;
}

const FILLERS = new Set(['um', 'uh', 'erm', 'ah', 'like', 'basically', 'actually', 'literally', 'umm', 'hmm', 'matlab', 'toh', 'yaani', 'मतलब', 'तो', 'अच्छा']);

export function DeliveryCoachPanel({ captions, durationMs, trimStartMs, trimEndMs, onTighten }: DeliveryCoachPanelProps) {
    const analysis = useMemo(() => {
        const ordered = [...captions].filter((cue) => cue.text.trim()).sort((a, b) => a.startMs - b.startMs);
        const wordCount = ordered.reduce((sum, cue) => sum + cue.text.trim().split(/\s+/u).length, 0);
        const speechStart = ordered[0]?.startMs ?? 0;
        const speechEnd = ordered.at(-1)?.endMs ?? 0;
        const speechMinutes = Math.max((speechEnd - speechStart) / 60_000, 1 / 60);
        const pace = Math.round(wordCount / speechMinutes);
        const words = ordered.flatMap((cue) => cue.text.toLowerCase().replace(/[^\p{L}\p{N}'’]+/gu, ' ').split(/\s+/u).filter(Boolean));
        const transcriptText = words.join(' ');
        const youKnowCount = transcriptText.match(/\byou know\b/gu)?.length ?? 0;
        const fillerCount = words.filter((word) => FILLERS.has(word)).length + youKnowCount;
        const longPauses = ordered.slice(1).filter((cue, index) => cue.startMs - ordered[index].endMs > 1500).length;
        return { wordCount, speechStart, speechEnd, pace, fillerCount, longPauses, ordered };
    }, [captions]);

    const paceLabel = analysis.wordCount === 0 ? 'Need captions' : analysis.pace < 105 ? 'Slow & clear' : analysis.pace <= 165 ? 'Conversational' : 'A little fast';
    const trimDiffers = analysis.wordCount > 0 && (analysis.speechStart > trimStartMs + 500 || analysis.speechEnd < trimEndMs - 500);

    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-300" /><h3 className="text-sm font-semibold text-neutral-100">Delivery coach</h3></div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">Local estimates from your timestamped captions. Check the transcript for the best read.</p>
            </div>
            {analysis.wordCount === 0 ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3 text-xs leading-relaxed text-neutral-400">Generate captions in the Captions tab to see speaking pace, filler words, and pause checks.</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <Metric label="Speaking pace" value={`${analysis.pace} wpm`} hint={paceLabel} />
                        <Metric label="Filler words" value={`${analysis.fillerCount}`} hint="um · uh · matlab · like" />
                        <Metric label="Long pauses" value={`${analysis.longPauses}`} hint="over 1.5 seconds" />
                        <Metric label="Transcript" value={`${analysis.wordCount} words`} hint={`${Math.round((analysis.speechEnd - analysis.speechStart) / 1000)} sec`} />
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-200"><AudioLines className="h-3.5 w-3.5 text-indigo-300" /> Retake cleanup</div>
                        <p className="text-[11px] leading-relaxed text-neutral-500">Trim dead air before the first caption and after the last one. Review the suggested range before exporting.</p>
                        <p className="mt-2 font-mono text-[10px] text-neutral-400">{(analysis.speechStart / 1000).toFixed(1)}s → {(analysis.speechEnd / 1000).toFixed(1)}s of {(durationMs / 1000).toFixed(1)}s</p>
                        <button type="button" onClick={() => onTighten(analysis.speechStart, analysis.speechEnd)} disabled={!trimDiffers}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                            <Scissors className="h-3.5 w-3.5" /> Tighten to speech
                        </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-neutral-600">Pace and filler counts are estimates based on transcription, not a judgment of delivery. Accent and Hinglish recognition can vary.</p>
                </>
            )}
        </div>
    );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
    return <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3"><span className="block text-[10px] text-neutral-500">{label}</span><strong className="mt-1 block text-base text-neutral-100">{value}</strong><span className="mt-0.5 block text-[10px] text-neutral-500">{hint}</span></div>;
}
