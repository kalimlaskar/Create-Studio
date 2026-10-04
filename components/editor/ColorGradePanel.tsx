'use client';

import React from 'react';
import { ColorGradeSettings } from '@/types/editor';
import { buildColorGradeFilter } from './colorGrade';

interface Preset {
    name: string;
    values: ColorGradeSettings;
}

// Instagram-style presets — each is just a named combination of the same sliders
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
        <div className="space-y-5">
            <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 block">Filters</label>
                <div className="grid grid-cols-3 gap-2">
                    {FILTER_PRESETS.map((preset) => (
                        <button
                            key={preset.name}
                            onClick={() => onChange(preset.values)}
                            className="overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800/50 text-[11px] text-neutral-300 transition-colors hover:border-indigo-500 hover:text-white">
                            <span className="relative block h-14 overflow-hidden" aria-hidden="true">
                                <span className="absolute inset-0" style={{ filter: buildColorGradeFilter(preset.values), background: 'linear-gradient(145deg, #38bdf8 0%, #a3e635 35%, #f97316 70%, #7c3aed 100%)' }} />
                                <span className="absolute -right-1 top-1 h-8 w-8 rounded-full bg-amber-100/80 shadow-lg" />
                                <span className="absolute bottom-0 left-1/2 h-8 w-6 -translate-x-1/2 rounded-t-full bg-neutral-950/80" />
                            </span>
                            <span className="block px-1.5 py-1.5 text-center">{preset.name}</span>
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
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>{label}</span><span>{value}{unit}</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-neutral-800 h-1 rounded cursor-pointer"
            />
        </div>
    );
}