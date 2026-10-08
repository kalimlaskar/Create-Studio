'use client';

import React from 'react';
import { WandSparkles } from 'lucide-react';
import { COMPOSITE_STYLE_PRESETS } from './stylePresets';

interface StylePresetsPanelProps {
    onApply: (presetId: string) => void;
}

const SAMPLE_ART: Record<string, string> = {
    'creator-clean': 'linear-gradient(135deg, #FFE347 0%, #FF3D81 45%, #6A4CFF 100%)',
    'warm-story': 'linear-gradient(135deg, #FFE347 0%, #FF3D81 48%, #14121F 100%)',
    'punchy-shorts': 'linear-gradient(135deg, #FFE347 0%, #6A4CFF 45%, #FF3D81 100%)',
    'noir-focus': 'linear-gradient(135deg, #F7F6FB 0%, #6A4CFF 45%, #14121F 100%)',
};

export function StylePresetsPanel({ onApply }: StylePresetsPanelProps) {
    return (
        <div className="space-y-4 font-[family-name:var(--font-body)] text-[#14121F]">
            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">One-click styles</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#14121F]/60">Each style updates the color grade, caption look, and framing together.</p>
            </div>
            <div className="space-y-2.5">
                {COMPOSITE_STYLE_PRESETS.map((preset) => (
                    <button
                        type="button"
                        key={preset.id}
                        onClick={() => onApply(preset.id)}
                        className="group flex w-full items-center gap-3.5 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-3 text-left transition-all hover:border-[#6A4CFF] hover:bg-white hover:shadow-md">
                        <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl shadow-sm" style={{ background: SAMPLE_ART[preset.id] }}>
                            <span className="absolute -right-1 top-1 h-10 w-10 rounded-full bg-white/30 blur-[2px]" />
                            <span className="absolute bottom-0 left-1/2 h-10 w-7 -translate-x-1/2 rounded-t-full bg-[#14121F]/75" />
                            <span className="absolute bottom-2 left-1/2 w-10 -translate-x-1/2 rounded-md bg-[#14121F]/90 px-1 py-0.5 text-center text-[6px] font-extrabold uppercase text-white shadow">{preset.captionStyle}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#14121F]">
                                {preset.name}
                                <WandSparkles className="h-3.5 w-3.5 text-[#6A4CFF] opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-[#14121F]/60">{preset.description}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}