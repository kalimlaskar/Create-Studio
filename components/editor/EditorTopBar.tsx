'use client';

import React from 'react';
import { ArrowLeft, Bookmark, Check, ChevronDown, Loader2, Share2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { CameraArtEffect } from '@/types/studio';

export type ExportStage = 'idle' | 'preparing' | 'rendering' | 'converting' | 'saving' | 'complete' | 'error';

interface EditorTopBarProps {
    title: string;
    aspectRatio: string;
    hasProject: boolean;
    isPro: boolean;
    isExporting: boolean;
    exportStage: ExportStage;
    exportProgress: number;
    isSourceMuted: boolean;
    isSavingDraft: boolean;
    draftSaved: boolean;
    cameraArtEffect: CameraArtEffect;
    onTitleChange: (title: string) => void;
    onBack: () => void;
    onToggleMute: () => void;
    onSaveDraft: () => void;
    onCameraArtEffectChange: (effect: CameraArtEffect) => void;
    onExport: () => void;
}

const BTN = 'flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#14121F]/10 bg-white px-2.5 text-xs font-semibold text-[#14121F]/80 shadow-xs transition hover:border-[#6A4CFF]/40 hover:text-[#14121F] disabled:cursor-not-allowed disabled:opacity-50';

const FILTERS: Array<{ value: CameraArtEffect; label: string }> = [
    { value: 'none', label: 'Original' },
    { value: 'comic', label: 'Comic' },
    { value: 'sketch', label: 'Sketch' },
    { value: 'pixel', label: 'Pixel' },
    { value: 'anime', label: 'Anime' },
];

export function Segmented<T extends string>({ label, value, options, onChange }: {
    label: string;
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
}) {
    return (
        <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#14121F]/50">{label}</p>
            <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-[#14121F]/5 p-1">
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onChange(option.value)}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${selected ? 'bg-white text-[#6A4CFF] shadow-sm' : 'text-[#14121F]/55 hover:text-[#14121F]'}`}>
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function FilterSelect({ id, value, disabled, onChange, className = '' }: {
    id: string;
    value: CameraArtEffect;
    disabled: boolean;
    onChange: (effect: CameraArtEffect) => void;
    className?: string;
}) {
    return (
        <div className={`relative ${className}`}>
            <label className="sr-only" htmlFor={id}>Cartoon filter</label>
            <Sparkles className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6A4CFF]" />
            <select
                id={id}
                value={value === 'avatar' ? 'none' : value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value as CameraArtEffect)}
                title="On-device cartoon and sketch effects"
                className="h-9 w-full cursor-pointer appearance-none rounded-xl border border-[#14121F]/10 bg-white pl-8 pr-8 text-xs font-semibold text-[#14121F]/80 shadow-xs transition hover:border-[#6A4CFF]/40 focus:border-[#6A4CFF] focus:outline-none disabled:opacity-50">
                {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#14121F]/40" />
        </div>
    );
}

export function EditorTopBar({
    title, aspectRatio, hasProject, isExporting, exportStage, exportProgress,
    isSourceMuted, isSavingDraft, draftSaved, cameraArtEffect,
    onTitleChange, onBack, onToggleMute, onSaveDraft, onCameraArtEffectChange, onExport,
}: EditorTopBarProps) {
    const exportLabel = exportStage === 'converting' ? 'Encoding' : exportStage === 'saving' ? 'Saving' : 'Rendering';

    return (
        <header className="relative z-40 mb-3 flex items-center justify-between gap-3 rounded-3xl border border-[#14121F]/8 bg-white/80 px-3 py-2.5 shadow-[0_1px_2px_rgba(20,18,31,0.04),0_10px_30px_-14px_rgba(20,18,31,0.15)] backdrop-blur-xl md:mb-4 md:px-4">
            {/* Left: back + project name */}
            <div className="flex min-w-0 items-center gap-2.5">
                <button type="button" onClick={onBack} disabled={isExporting} aria-label="Back to studio" title="Back to studio" className={`${BTN} w-9 px-0 md:w-auto md:px-3`}>
                    <ArrowLeft className="h-4 w-4 text-[#14121F]/60" />
                    <span className="hidden md:inline">Studio</span>
                </button>
                <span aria-hidden="true" className="h-6 w-px bg-[#14121F]/10" />
                <div className="min-w-0">
                    <input
                        value={title}
                        onChange={(event) => onTitleChange(event.target.value)}
                        aria-label="Project name"
                        maxLength={80}
                        disabled={!hasProject}
                        className="w-32 max-w-[36vw] truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-bold text-[#14121F] transition hover:border-[#14121F]/10 hover:bg-[#14121F]/[0.03] focus:border-[#6A4CFF] focus:bg-white focus:outline-none sm:w-52"
                    />
                    <p className="px-1 text-[10px] font-medium text-[#14121F]/45">{aspectRatio} frame</p>
                </div>
            </div>

            {/* Right: tools + export */}
            <div className="flex shrink-0 items-center gap-2">
                <FilterSelect id="editor-art-effect" value={cameraArtEffect} disabled={isExporting || !hasProject} onChange={onCameraArtEffectChange} className="w-24 sm:w-32" />

                <button
                    type="button"
                    onClick={onToggleMute}
                    disabled={isExporting}
                    aria-pressed={isSourceMuted}
                    aria-label={isSourceMuted ? 'Unmute original video audio' : 'Mute original video audio'}
                    title={isSourceMuted ? 'Unmute original audio' : 'Mute original audio'}
                    className={`${BTN} w-9 px-0`}>
                    {isSourceMuted ? <VolumeX className="h-4 w-4 text-[#14121F]/40" /> : <Volume2 className="h-4 w-4 text-[#6A4CFF]" />}
                </button>

                <button
                    type="button"
                    onClick={onSaveDraft}
                    disabled={!hasProject || isSavingDraft || isExporting}
                    aria-label="Save draft"
                    title="Save draft"
                    className={`${BTN} lg:px-3 ${draftSaved ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300' : ''}`}>
                    {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin text-[#6A4CFF]" /> : draftSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4 text-[#6A4CFF]" />}
                    <span className="hidden lg:inline">{isSavingDraft ? 'Saving…' : draftSaved ? 'Saved' : 'Save draft'}</span>
                </button>

                <button
                    type="button"
                    onClick={onExport}
                    disabled={isExporting || !hasProject}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#6A4CFF,#7C5CFF)] px-3.5 text-xs font-bold text-white shadow-md shadow-[#6A4CFF]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                    {isExporting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{exportLabel}{exportStage === 'rendering' || exportStage === 'converting' ? ` ${exportProgress}%` : '…'}</span>
                        </>
                    ) : (
                        <>
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Export &amp; share</span>
                        </>
                    )}
                </button>
            </div>
        </header>
    );
}