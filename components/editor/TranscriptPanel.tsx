'use client';

import React, { useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { TimeRange } from '@/types/editor';

export interface TranscriptWord {
    text: string;
    startMs: number;
    endMs: number;
}

interface TranscriptPanelProps {
    words: TranscriptWord[];
    playheadMs: number;
    deleted: TimeRange[];
    onSeek: (ms: number) => void;
    onDelete: (range: TimeRange) => void;
    onRestore: (atMs: number) => void;
}

// Word timestamps from transcription are approximate, so pad the cut a little
const CUT_PAD_MS = 30;

export function TranscriptPanel({ words, playheadMs, deleted, onSeek, onDelete, onRestore }: TranscriptPanelProps) {
    // Selected words as [firstIndex, lastIndex]
    const [selection, setSelection] = useState<[number, number] | null>(null);
    const [anchor, setAnchor] = useState<number | null>(null);

    const isDeleted = (word: TranscriptWord) =>
        deleted.some((range) => word.startMs >= range.startMs - 1 && word.endMs <= range.endMs + 1);

    const activeIndex = useMemo(
        () => words.findIndex((word) => playheadMs >= word.startMs && playheadMs < word.endMs),
        [words, playheadMs],
    );

    const handleWordClick = (index: number, event: React.MouseEvent) => {
        const word = words[index];

        // Click a struck-through word to bring it back
        if (isDeleted(word)) {
            onRestore(word.startMs + 1);
            setSelection(null);
            setAnchor(null);
            return;
        }

        // Shift-click extends the selection from the first clicked word
        if (event.shiftKey && anchor !== null) {
            setSelection([Math.min(anchor, index), Math.max(anchor, index)]);
            return;
        }

        // Plain click: jump the video to this word and start a selection
        setAnchor(index);
        setSelection([index, index]);
        onSeek(word.startMs);
    };

    const clearSelection = () => {
        setSelection(null);
        setAnchor(null);
    };

    const deleteSelection = () => {
        if (!selection) return;
        const first = words[selection[0]];
        const last = words[selection[1]];
        onDelete({
            startMs: Math.max(0, first.startMs - CUT_PAD_MS),
            endMs: last.endMs + CUT_PAD_MS,
        });
        clearSelection();
    };

    if (words.length === 0) return null;

    return (
        <div className="rounded-3xl border border-[#14121F]/10 bg-white p-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70">Script</span>
                <div className="flex items-center gap-2">
                    {selection && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            aria-label="Clear selection"
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#14121F]/15 text-[#14121F]/60 transition hover:bg-[#14121F] hover:text-white">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={deleteSelection}
                        disabled={!selection}
                        className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" /> Delete selected
                    </button>
                </div>
            </div>

            <p className="text-sm leading-8">
                {words.map((word, index) => {
                    const gone = isDeleted(word);
                    const selected = selection !== null && index >= selection[0] && index <= selection[1];
                    const active = index === activeIndex;
                    return (
                        <span
                            key={`${word.startMs}-${index}`}
                            role="button"
                            tabIndex={0}
                            onClick={(event) => handleWordClick(index, event)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleWordClick(index, event as unknown as React.MouseEvent);
                                }
                            }}
                            title={gone ? 'Removed · click to restore' : 'Click to jump here · Shift-click to select a range'}
                            className={`cursor-pointer rounded px-0.5 transition-colors ${gone
                                    ? 'text-red-400/70 line-through hover:bg-red-50'
                                    : selected
                                        ? 'bg-[#6A4CFF]/25'
                                        : active
                                            ? 'bg-[#FFE347]'
                                            : 'hover:bg-[#6A4CFF]/10'
                                }`}>
                            {word.text}{' '}
                        </span>
                    );
                })}
            </p>

            <p className="mt-2 text-[11px] text-[#14121F]/50">
                Click a word to jump to it · Shift-click to select a range · click a struck-through word to restore
            </p>
        </div>
    );
}