'use client';

import React, { useEffect, useRef } from 'react';
import { FONT_FAMILIES, ReelImage, TEXT_BASE_Y, clamp, getDefaultTextColor } from './reelTypes';

export const SELECT_CLASS = 'w-full appearance-none rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 pr-8 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none cursor-pointer shadow-xs';
export const RANGE_CLASS = 'mt-2 w-full accent-[#6A4CFF] bg-[#14121F]/10 h-1.5 rounded-full';
export const CARD_CLASS = 'space-y-3 rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs';
export const GHOST_BUTTON = 'rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]';

export function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
    return (
        <label className="block text-xs font-semibold text-[#14121F]">
            {label}
            <div className="relative mt-1.5">
                <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>{children}</select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#14121F]/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
            </div>
        </label>
    );
}

export function RangeField({ label, display, min, max, step, value, onChange }: { label: string; display: string; min: number; max: number; step?: number; value: number; onChange: (value: number) => void }) {
    return (
        <label className="block text-xs font-semibold text-[#14121F]">
            {label} · {display}
            <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={RANGE_CLASS} />
        </label>
    );
}

/** Compact slider used by the cursor / ripple panels. */
export function MiniSlider({ label, display, min, max, step, value, onChange }: { label: string; display: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-medium text-[#14121F]/60">
                <span>{label}</span>
                <span>{display}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(parseFloat(event.target.value))} className="h-1.5 w-full rounded-full bg-[#14121F]/10 accent-[#6A4CFF]" />
        </div>
    );
}

/**
 * The preview surface. It simply asks the shared renderer to draw into this canvas on every render,
 * so there is no second CSS/DOM implementation that can drift away from the exported video.
 */
export function PreviewCanvas({ width, height, draw }: { width: number; height: number; draw: (ctx: CanvasRenderingContext2D) => void }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = ref.current?.getContext('2d');
        if (!ctx) return;
        try { draw(ctx); } catch { /* a half-loaded asset must never crash the editor */ }
    });
    return <canvas ref={ref} width={width} height={height} className="h-full w-full object-contain" />;
}

/**
 * Invisible drag handle placed exactly where the caption is drawn on the canvas.
 * The visible caption is painted by the renderer (identical to export); this only handles dragging.
 */
export function CaptionDragHandle({ clip, onPointerDown, onPointerMove, onPointerUp }: {
    clip: ReelImage;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
    return (
        <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            title="Drag to move the caption"
            className="absolute cursor-move text-center font-bold leading-tight outline-1 outline-dashed outline-transparent hover:outline-white/70"
            style={{
                left: `${50 + (clip.textOffset?.x ?? 0)}%`,
                top: `${TEXT_BASE_Y[clip.textPosition] + (clip.textOffset?.y ?? 0)}%`,
                transform: 'translate(-50%, -50%)',
                width: 'max-content',
                maxWidth: '82%',
                fontSize: `${6.5 * (clip.textSize ?? 1)}cqw`,
                fontFamily: FONT_FAMILIES[clip.fontFamily ?? 'sans'],
                padding: '0.3em 0.42em',
                color: 'transparent',
                touchAction: 'none',
            }}
        >
            {clip.overlayText}
        </div>
    );
}

export function RipplePlacer({ x, y, color, label, frameRef, onChange }: {
    x: number; y: number; color: string; label: string;
    frameRef: React.RefObject<HTMLDivElement | null>;
    onChange: (x: number, y: number) => void;
}) {
    const dragging = useRef(false);
    const move = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging.current || !frameRef.current) return;
        const rect = frameRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        onChange(clamp((event.clientX - rect.left) / rect.width, 0.02, 0.98), clamp((event.clientY - rect.top) / rect.height, 0.02, 0.98));
    };
    const end = (event: React.PointerEvent<HTMLDivElement>) => {
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    return (
        <div
            title={label}
            onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); dragging.current = true; move(event); }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-dashed active:cursor-grabbing"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, borderColor: color, background: 'rgba(255,255,255,0.25)', touchAction: 'none' }}
        >
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        </div>
    );
}

export function UpgradeModal({ onUpgrade, onClose }: { onUpgrade: () => void; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md rounded-3xl border border-purple-500/35 bg-slate-900 p-6 text-center shadow-2xl">
                <h3 className="mb-2 text-2xl font-bold text-white">Unlock Pro Studio</h3>
                <p className="mb-6 text-sm text-slate-400">Get unlimited access to all 3D effects, AI tools, and 4K exports.</p>
                <button onClick={onUpgrade} className="mb-3 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 font-semibold text-white shadow-lg">
                    Upgrade to Pro ($9/month)
                </button>
                <button onClick={onClose} className="w-full rounded-2xl bg-slate-800 py-3 text-sm font-medium text-slate-300">Maybe Later</button>
            </div>
        </div>
    );
}

export { getDefaultTextColor };
