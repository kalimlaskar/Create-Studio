'use client';

import React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export const ACCENT = '#6A4CFF';
export const PINK = '#FF3D81';

/* ------------------------------ Card ------------------------------ */
interface CardProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    accent?: string;
    action?: React.ReactNode;
    children?: React.ReactNode;
}

export function Card({ title, description, icon: Icon, accent = ACCENT, action, children }: CardProps) {
    return (
        <section className="rounded-3xl border border-[#14121F]/8 bg-white p-4 shadow-[0_1px_2px_rgba(20,18,31,0.04),0_8px_24px_-12px_rgba(20,18,31,0.08)]">
            <header className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                    {Icon && (
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}18`, color: accent }}>
                            <Icon className="h-3.5 w-3.5" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-[13px] font-bold leading-tight tracking-tight text-[#14121F]">{title}</h2>
                        {description && <p className="mt-0.5 text-[11px] leading-snug text-[#14121F]/50">{description}</p>}
                    </div>
                </div>
                {action}
            </header>
            {children && <div className="mt-3.5 space-y-3.5">{children}</div>}
        </section>
    );
}

/* ----------------------------- Toggle ----------------------------- */
interface ToggleProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    accent?: string;
}

export function Toggle({ checked, onChange, label, accent = ACCENT }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: checked ? accent : 'rgba(20,18,31,0.15)', outlineColor: accent }}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
    );
}

interface ToggleRowProps extends ToggleProps {
    title: string;
    description?: string;
}

export function ToggleRow({ title, description, ...toggle }: ToggleRowProps) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-semibold text-[#14121F]">{title}</p>
                {description && <p className="text-[11px] leading-snug text-[#14121F]/50">{description}</p>}
            </div>
            <Toggle {...toggle} />
        </div>
    );
}

/* ------------------------------ Slider ----------------------------- */
interface SliderProps {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    accent?: string;
    onChange: (value: number) => void;
}

export function Slider({ id, label, value, min, max, step = 1, suffix = '', accent = ACCENT, onChange }: SliderProps) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
                <label htmlFor={id} className="font-medium text-[#14121F]/70">{label}</label>
                <span className="rounded-md bg-[#14121F]/5 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#14121F]/70">{value}{suffix}</span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                style={{ '--accent': accent, background: `linear-gradient(to right, ${accent} ${pct}%, rgba(20,18,31,0.1) ${pct}%)` } as React.CSSProperties}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full
                    [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--accent)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                    [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--accent)] [&::-moz-range-thumb]:bg-white"
            />
        </div>
    );
}

/* ---------------------------- Segmented ---------------------------- */
interface SegmentedProps<T extends string> {
    ariaLabel: string;
    value: T;
    options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon; hint?: string }>;
    onChange: (value: T) => void;
    columns?: 2 | 3 | 4;
    accent?: string;
    disabled?: boolean;
}

const COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const;

export function Segmented<T extends string>({ ariaLabel, value, options, onChange, columns = 3, accent = ACCENT, disabled }: SegmentedProps<T>) {
    return (
        <div role="group" aria-label={ariaLabel} className={`grid gap-1 rounded-2xl bg-[#14121F]/5 p-1 ${COLS[columns]}`}>
            {options.map((option) => {
                const selected = option.value === value;
                const Icon = option.icon;
                return (
                    <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                        className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'bg-white text-[#14121F] shadow-sm' : 'text-[#14121F]/55 hover:text-[#14121F]'}`}>
                        {Icon && <Icon className="h-4 w-4" style={{ color: selected ? accent : undefined }} />}
                        <span>{option.label}</span>
                        {option.hint && <span className="text-[9px] font-medium text-[#14121F]/40">{option.hint}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/* ---------------------------- SelectField -------------------------- */
interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
    label?: string;
}

export function SelectField({ label, id, children, ...props }: SelectFieldProps) {
    return (
        <div>
            {label && <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[#14121F]/70">{label}</label>}
            <div className="relative">
                <select
                    id={id}
                    {...props}
                    className="w-full appearance-none rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] py-2.5 pl-3.5 pr-9 text-xs font-medium text-[#14121F] transition focus:border-[#6A4CFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6A4CFF]/10">
                    {children}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#14121F]/40" />
            </div>
        </div>
    );
}

/* ----------------------------- TextInput --------------------------- */
export function TextInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>) {
    return (
        <input
            {...props}
            className="w-full rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] px-3.5 py-2.5 text-xs font-medium text-[#14121F] transition placeholder:text-[#14121F]/35 focus:border-[#6A4CFF] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#6A4CFF]/10"
        />
    );
}

/* ------------------------------ Hint ------------------------------- */
export function Hint({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'info' | 'warn' }) {
    const tones = {
        muted: 'text-[#14121F]/50',
        info: 'rounded-xl border border-[#6A4CFF]/20 bg-[#6A4CFF]/5 px-3 py-2 text-[#14121F]/75',
        warn: 'rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700',
    } as const;
    return <p className={`text-[11px] leading-relaxed ${tones[tone]}`}>{children}</p>;
}