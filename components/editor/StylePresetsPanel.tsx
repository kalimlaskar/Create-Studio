'use client';

import React from 'react';
import { WandSparkles } from 'lucide-react';
import { COMPOSITE_STYLE_PRESETS } from './stylePresets';

interface StylePresetsPanelProps {
    onApply: (presetId: string) => void;
}

const SAMPLE_ART: Record<string, string> = {
    'creator-clean': 'linear-gradient(135deg, #fbbf24 0%, #fb7185 45%, #4338ca 100%)',
    'warm-story': 'linear-gradient(135deg, #fde68a 0%, #fb923c 48%, #9f1239 100%)',
    'punchy-shorts': 'linear-gradient(135deg, #bef264 0%, #06b6d4 45%, #7c3aed 100%)',
    'noir-focus': 'linear-gradient(135deg, #f8fafc 0%, #64748b 45%, #0f172a 100%)',
};

export function StylePresetsPanel({ onApply }: StylePresetsPanelProps) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-neutral-100">One-click styles</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">Each style updates the color grade, caption look, and framing together.</p>
            </div>
            <div className="space-y-2">
                {COMPOSITE_STYLE_PRESETS.map((preset) => (
                    <button
                        type="button"
                        key={preset.id}
                        onClick={() => onApply(preset.id)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 p-2 text-left transition-colors hover:border-indigo-500 hover:bg-neutral-800">
                        <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: SAMPLE_ART[preset.id] }}>
                            <span className="absolute -right-1 top-1 h-10 w-10 rounded-full bg-amber-100/70 blur-[1px]" />
                            <span className="absolute bottom-0 left-1/2 h-10 w-7 -translate-x-1/2 rounded-t-full bg-neutral-950/75" />
                            <span className="absolute bottom-2 left-1/2 w-10 -translate-x-1/2 rounded bg-black/60 px-1 py-0.5 text-center text-[6px] font-black uppercase text-white">{preset.captionStyle}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-100">
                                {preset.name}
                                <WandSparkles className="h-3 w-3 text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-neutral-500">{preset.description}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
