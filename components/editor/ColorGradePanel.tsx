'use client';

import React from 'react';
import { ColorGradeSettings } from '@/types/editor';
import { buildColorGradeFilter } from './colorGrade';

interface Preset {
    name: string;
    values: ColorGradeSettings;
}

export const FILTER_PRESETS: Preset[] = [
    { name: 'Original', values: { brightness: 100, contrast: 100, saturation: 100, temperature: 0 } },
    { name: 'Vivid', values: { brightness: 105, contrast: 115, saturation: 130, temperature: 5 } },
    { name: 'Warm', values: { brightness: 105, contrast: 100, saturation: 110, temperature: 35 } },
    { name: 'Cool', values: { brightness: 100, contrast: 105, saturation: 95, temperature: -35 } },
    { name: 'Mono', values: { brightness: 100, contrast: 110, saturation: 0, temperature: 0 } },
    { name: 'Fade', values: { brightness: 110, contrast: 85, saturation: 80, temperature: 10 } },
];

interface ColorGradePanelProps {
    colorGrade: ColorGradeSettings;
    onChange: (patch: Partial<ColorGradeSettings>) => void;
}

export function ColorGradePanel({ colorGrade, onChange }: ColorGradePanelProps) {
    return (
        <div className="space-y-5 font-[family-name:var(--font-body)] text-[#14121F]">
            <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/70 mb-2.5 block">Filters</label>
                <div className="grid grid-cols-3 gap-2.5">
                    {FILTER_PRESETS.map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => onChange(preset.values)}
                            className="overflow-hidden rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] text-xs font-semibold text-[#14121F]/80 transition-all hover:border-[#6A4CFF] hover:bg-white hover:shadow-md">
                            <span className="relative block h-16 overflow-hidden rounded-t-2xl" aria-hidden="true">
                                <span className="absolute inset-0" style={{ filter: buildColorGradeFilter(preset.values), background: 'linear-gradient(145deg, #FFE347 0%, #FF3D81 35%, #6A4CFF 70%, #14121F 100%)' }} />
                                <span className="absolute -right-1 top-1 h-8 w-8 rounded-full bg-white/40 blur-[2px]" />
                                <span className="absolute bottom-0 left-1/2 h-8 w-6 -translate-x-1/2 rounded-t-full bg-[#14121F]/80" />
                            </span>
                            <span className="block px-2 py-2 text-center">{preset.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            <Slider label="Brightness" value={colorGrade.brightness} min={50} max={150} unit="%"
                onChange={(v) => onChange({ brightness: v })} />
            <Slider label="Contrast" value={colorGrade.contrast} min={50} max={150} unit="%"
                onChange={(v) => onChange({ contrast: v })} />
            <Slider label="Saturation" value={colorGrade.saturation} min={0} max={200} unit="%"
                onChange={(v) => onChange({ saturation: v })} />
            <Slider label="Temperature" value={colorGrade.temperature} min={-100} max={100} unit=""
                onChange={(v) => onChange({ temperature: v })} />
        </div>
    );
}

function Slider({ label, value, min, max, unit, onChange }: {
    label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
    return (
        <div>
            <div className="flex justify-between text-xs font-medium text-[#14121F]/70 mb-1.5">
                <span>{label}</span><span className="font-mono text-[#14121F] font-semibold">{value}{unit}</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full cursor-pointer"
            />
        </div>
    );
}