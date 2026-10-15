'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { ExportStage } from './EditorTopBar';

/* ----------------------------- export status ---------------------------- */
interface ExportStatusCardProps {
    stage: ExportStage;
    progress: number;
    error: string | null;
    isExporting: boolean;
    onCancel: () => void;
    onDismiss: () => void;
}

export function ExportStatusCard({ stage, progress, error, isExporting, onCancel, onDismiss }: ExportStatusCardProps) {
    if (!isExporting && stage !== 'complete' && !error) return null;

    const done = stage === 'complete' && !error;
    const headline = error
        ? 'Export failed'
        : done
            ? 'Export complete'
            : stage === 'preparing' ? 'Preparing export…'
                : stage === 'rendering' ? 'Rendering video'
                    : stage === 'converting' ? 'Encoding MP4'
                        : 'Saving file…';
    const detail = error ?? (done ? 'Your video was downloaded.' : stage === 'rendering' ? 'Keep this tab open while it renders.' : stage === 'converting' ? 'Almost there. Converting for wide compatibility.' : 'This only takes a moment.');
    const barColor = error ? 'bg-red-500' : done ? 'bg-emerald-500' : 'bg-[#6A4CFF]';

    return (
        <div
            role="status"
            aria-live="polite"
            className="absolute bottom-5 left-1/2 z-50 w-[min(92%,26rem)] -translate-x-1/2 rounded-3xl border border-[#14121F]/10 bg-white/95 p-4 shadow-[0_20px_60px_-20px_rgba(20,18,31,0.4)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${error ? 'bg-red-50 text-red-600' : done ? 'bg-emerald-50 text-emerald-600' : 'bg-[#6A4CFF]/10 text-[#6A4CFF]'}`}>
                    {error ? <AlertTriangle className="h-4 w-4" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#14121F]">{headline}</p>
                        {!error && !done && (stage === 'rendering' || stage === 'converting') && (
                            <span className="font-mono text-xs font-bold text-[#6A4CFF]">{progress}%</span>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-[#14121F]/55">{detail}</p>
                </div>
                {(done || error) && (
                    <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded-lg p-1 text-[#14121F]/40 transition hover:bg-[#14121F]/5 hover:text-[#14121F]">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#14121F]/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Video export progress">
                <div className={`h-full rounded-full transition-[width] duration-200 ${barColor}`} style={{ width: `${error ? 100 : progress}%` }} />
            </div>

            {isExporting && stage === 'rendering' && (
                <div className="mt-3 flex justify-end">
                    <button type="button" onClick={onCancel} className="rounded-full border border-[#14121F]/12 px-3 py-1 text-xs font-semibold text-[#14121F]/70 transition hover:bg-[#14121F] hover:text-white">
                        Cancel export
                    </button>
                </div>
            )}
        </div>
    );
}

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