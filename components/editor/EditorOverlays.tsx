'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/* ------------------------- timeline resize handle ----------------------- */
export function TimelineSplitter({ onMouseDown }: { onMouseDown: (event: React.MouseEvent) => void }) {
    return (
        <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize the timeline"
            title="Drag to resize timeline"
            onMouseDown={onMouseDown}
            className="group relative z-30 my-1 flex h-3 w-full shrink-0 cursor-row-resize select-none items-center justify-center">
            <span className="h-1 w-14 rounded-full bg-[#14121F]/15 transition-all group-hover:w-24 group-hover:bg-[#6A4CFF] group-active:bg-[#5839e0]" />
        </div>
    );
}

/* ------------------------------ empty states ---------------------------- */
export function EditorLoading() {
    return (
        <div className="flex flex-1 flex-col gap-3" role="status" aria-label="Loading video">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-[#14121F]/8 bg-white">
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#6A4CFF]/6 via-transparent to-[#FF3D81]/6" />
                <div className="relative flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6A4CFF]/10 text-[#6A4CFF]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </span>
                    <div>
                        <p className="text-sm font-bold text-[#14121F]">Opening your video…</p>
                        <p className="mt-0.5 text-xs text-[#14121F]/50">Reading the video details</p>
                    </div>
                </div>
            </div>
            <div className="h-40 animate-pulse rounded-3xl border border-[#14121F]/8 bg-white" />
        </div>
    );
}

export function EditorError({ message, onBack }: { message: string; onBack: () => void }) {
    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <div role="alert" className="w-full max-w-md rounded-[2rem] border border-[#14121F]/8 bg-white p-7 text-center shadow-[0_20px_60px_-24px_rgba(20,18,31,0.25)]">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-[family-name:var(--font-display)] text-base font-bold text-[#14121F]">This video could not be opened</h2>
                <p className="mt-2 text-xs leading-relaxed text-[#14121F]/60">{message}</p>
                <button type="button" onClick={onBack} className="mt-5 rounded-2xl bg-[#6A4CFF] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#6A4CFF]/25 transition hover:bg-[#5839e0]">
                    Back to studio
                </button>
            </div>
        </div>
    );
}