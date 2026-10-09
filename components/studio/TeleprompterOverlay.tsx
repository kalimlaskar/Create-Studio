'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Grip, Pause, Play, RotateCcw } from 'lucide-react';

interface TeleprompterOverlayProps {
    scriptText: string;
}

interface OverlayPosition {
    x: number;
    y: number;
}

// Size as a fraction of the preview (0-1)
interface OverlaySize {
    w: number;
    h: number;
}

interface DragState {
    pointerId: number;
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
}

interface ResizeState {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startW: number;
    startH: number;
    left: number; // fixed top-left corner, as fractions
    top: number;
}

const POSITION_STORAGE_KEY = 'cliprame-teleprompter-position-v1';
const SIZE_STORAGE_KEY = 'cliprame-teleprompter-size-v1';
const LOOK_STORAGE_KEY = 'cliprame-teleprompter-look-v1';
const DEFAULT_POSITION: OverlayPosition = { x: 0.5, y: 0.76 };
const DEFAULT_SIZE: OverlaySize = { w: 0.94, h: 0.24 };
const DEFAULT_OPACITY = 0.5;
const DEFAULT_FONT_SIZE = 20;
const MIN_W = 0.35;
const MAX_W = 1;
const MIN_H = 0.12;
const MAX_H = 0.8;
const MIN_FONT = 14;
const MAX_FONT = 44;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function TeleprompterOverlay({ scriptText }: TeleprompterOverlayProps) {
    const [isScrolling, setIsScrolling] = useState(false);
    const [isAtEnd, setIsAtEnd] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [prevScriptText, setPrevScriptText] = useState(scriptText);
    const [position, setPosition] = useState(DEFAULT_POSITION);
    const [size, setSize] = useState(DEFAULT_SIZE);
    const [bgOpacity, setBgOpacity] = useState(DEFAULT_OPACITY);
    const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
    const [positionLoaded, setPositionLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const resizeRef = useRef<ResizeState | null>(null);

    // Load saved position, size and look
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            try {
                const savedPosition = window.localStorage.getItem(POSITION_STORAGE_KEY);
                if (savedPosition) {
                    const parsed = JSON.parse(savedPosition) as Partial<OverlayPosition>;
                    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                        setPosition({ x: clamp(parsed.x, 0, 1), y: clamp(parsed.y, 0, 1) });
                    }
                }
                const savedSize = window.localStorage.getItem(SIZE_STORAGE_KEY);
                if (savedSize) {
                    const parsed = JSON.parse(savedSize) as Partial<OverlaySize>;
                    if (typeof parsed.w === 'number' && typeof parsed.h === 'number') {
                        setSize({ w: clamp(parsed.w, MIN_W, MAX_W), h: clamp(parsed.h, MIN_H, MAX_H) });
                    }
                }
                const savedLook = window.localStorage.getItem(LOOK_STORAGE_KEY);
                if (savedLook) {
                    const parsed = JSON.parse(savedLook) as { bgOpacity?: number; fontSize?: number };
                    if (typeof parsed.bgOpacity === 'number') setBgOpacity(clamp(parsed.bgOpacity, 0.2, 0.9));
                    if (typeof parsed.fontSize === 'number') setFontSize(clamp(parsed.fontSize, MIN_FONT, MAX_FONT));
                }
            } catch {
                try {
                    window.localStorage.removeItem(POSITION_STORAGE_KEY);
                    window.localStorage.removeItem(SIZE_STORAGE_KEY);
                    window.localStorage.removeItem(LOOK_STORAGE_KEY);
                } catch { }
            }
            setPositionLoaded(true);
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!positionLoaded) return;
        try {
            window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
        } catch { }
    }, [position, positionLoaded]);

    useEffect(() => {
        if (!positionLoaded) return;
        try {
            window.localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
        } catch { }
    }, [size, positionLoaded]);

    useEffect(() => {
        if (!positionLoaded) return;
        try {
            window.localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify({ bgOpacity, fontSize }));
        } catch { }
    }, [bgOpacity, fontSize, positionLoaded]);

    useEffect(() => {
        const container = containerRef.current;
        const panel = panelRef.current;
        if (!container || !panel) return;

        const keepPanelInBounds = () => {
            const containerRect = container.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            if (!containerRect.width || !containerRect.height) return;
            const minX = panelRect.width / (2 * containerRect.width);
            const minY = panelRect.height / (2 * containerRect.height);
            setPosition((current) => ({
                x: Math.min(1 - minX, Math.max(minX, current.x)),
                y: Math.min(1 - minY, Math.max(minY, current.y)),
            }));
        };

        const observer = new ResizeObserver(keepPanelInBounds);
        observer.observe(container);
        observer.observe(panel);
        keepPanelInBounds();
        return () => observer.disconnect();
    }, [isVisible]);

    if (scriptText !== prevScriptText) {
        setPrevScriptText(scriptText);
        setIsAtEnd(false);
    }

    useEffect(() => {
        if (!isScrolling) return;

        const interval = window.setInterval(() => {
            const scrollArea = scrollRef.current;
            if (!scrollArea) return;

            const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
            if (scrollArea.scrollTop >= maxScroll) {
                setIsScrolling(false);
                setIsAtEnd(true);
                return;
            }

            scrollArea.scrollTop += 1;
        }, 30);

        return () => window.clearInterval(interval);
    }, [isScrolling]);

    if (!scriptText.trim()) return null;

    const toggleScroll = () => {
        if (isScrolling) {
            setIsScrolling(false);
            return;
        }

        if (isAtEnd && scrollRef.current) {
            scrollRef.current.scrollTop = 0;
            setIsAtEnd(false);
        }
        setIsScrolling(true);
    };

    // Move
    const startDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const container = containerRef.current;
        const panel = panelRef.current;
        if (!container || !panel) return;

        const containerRect = container.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            centerX: panelRect.left - containerRect.left + panelRect.width / 2,
            centerY: panelRect.top - containerRect.top + panelRect.height / 2,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
        event.stopPropagation();
    };

    const movePanel = (event: React.PointerEvent<HTMLButtonElement>) => {
        const drag = dragRef.current;
        const container = containerRef.current;
        const panel = panelRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !container || !panel) return;

        const containerRect = container.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const minX = panelRect.width / 2;
        const minY = panelRect.height / 2;
        const x = Math.min(containerRect.width - minX, Math.max(minX, drag.centerX + event.clientX - drag.startX));
        const y = Math.min(containerRect.height - minY, Math.max(minY, drag.centerY + event.clientY - drag.startY));
        setPosition({ x: x / containerRect.width, y: y / containerRect.height });
        event.stopPropagation();
    };

    const stopDragging = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        event.stopPropagation();
    };

    const nudgePanel = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        const step = event.shiftKey ? 0.05 : 0.02;
        const adjustments: Record<string, OverlayPosition> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
        };
        const adjustment = adjustments[event.key];
        if (!adjustment) return;
        event.preventDefault();
        const container = containerRef.current;
        const panel = panelRef.current;
        if (!container || !panel) return;
        const containerRect = container.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const minX = panelRect.width / (2 * containerRect.width);
        const minY = panelRect.height / (2 * containerRect.height);
        setPosition((current) => ({
            x: Math.min(1 - minX, Math.max(minX, current.x + adjustment.x)),
            y: Math.min(1 - minY, Math.max(minY, current.y + adjustment.y)),
        }));
    };

    // Resize: the top-left corner stays put, the bottom-right follows the pointer
    const startResizing = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        resizeRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startW: size.w,
            startH: size.h,
            left: position.x - size.w / 2,
            top: position.y - size.h / 2,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsResizing(true);
        event.stopPropagation();
    };

    const resizePanel = (event: React.PointerEvent<HTMLButtonElement>) => {
        const resize = resizeRef.current;
        const container = containerRef.current;
        if (!resize || resize.pointerId !== event.pointerId || !container) return;

        const containerRect = container.getBoundingClientRect();
        if (!containerRect.width || !containerRect.height) return;
        const w = clamp(resize.startW + (event.clientX - resize.startClientX) / containerRect.width, MIN_W, Math.min(MAX_W, 1 - resize.left));
        const h = clamp(resize.startH + (event.clientY - resize.startClientY) / containerRect.height, MIN_H, Math.min(MAX_H, 1 - resize.top));
        setSize({ w, h });
        setPosition({ x: resize.left + w / 2, y: resize.top + h / 2 });
        event.stopPropagation();
    };

    const stopResizing = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (resizeRef.current?.pointerId !== event.pointerId) return;
        resizeRef.current = null;
        setIsResizing(false);
        event.stopPropagation();
    };

    const resizeWithKeys = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        const step = event.shiftKey ? 0.06 : 0.03;
        const changes: Record<string, OverlaySize> = {
            ArrowLeft: { w: -step, h: 0 },
            ArrowRight: { w: step, h: 0 },
            ArrowUp: { w: 0, h: -step },
            ArrowDown: { w: 0, h: step },
        };
        const change = changes[event.key];
        if (!change) return;
        event.preventDefault();
        const left = position.x - size.w / 2;
        const top = position.y - size.h / 2;
        const w = clamp(size.w + change.w, MIN_W, Math.min(MAX_W, 1 - left));
        const h = clamp(size.h + change.h, MIN_H, Math.min(MAX_H, 1 - top));
        setSize({ w, h });
        setPosition({ x: left + w / 2, y: top + h / 2 });
    };

    const resetSize = () => {
        setSize(DEFAULT_SIZE);
    };

    return (
        <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20 font-[family-name:var(--font-body)] text-white">
            <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    if (isVisible) setIsScrolling(false);
                    setIsVisible(!isVisible);
                }}
                aria-expanded={isVisible}
                className="pointer-events-auto absolute right-3 top-16 rounded-full border border-white/20 bg-[#14121F]/60 px-3.5 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-[#14121F]/80 sm:right-4 sm:top-4"
            >
                {isVisible ? 'Hide prompter' : 'Show prompter'}
            </button>

            {isVisible && (
                <section
                    ref={panelRef}
                    aria-label="Teleprompter overlay"
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                        left: `${position.x * 100}%`,
                        top: `${position.y * 100}%`,
                        width: `${size.w * 100}%`,
                        height: `${size.h * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: `rgba(20, 18, 31, ${bgOpacity})`,
                    }}
                    className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-white/15 text-white shadow-2xl backdrop-blur-md ${isDragging || isResizing ? 'ring-2 ring-[#6A4CFF]/80' : ''}`}
                >
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <button
                                type="button"
                                aria-label="Move teleprompter"
                                title="Drag to move · use arrow keys to reposition"
                                onPointerDown={startDragging}
                                onPointerMove={movePanel}
                                onPointerUp={stopDragging}
                                onPointerCancel={stopDragging}
                                onLostPointerCapture={() => { dragRef.current = null; setIsDragging(false); }}
                                onKeyDown={nudgePanel}
                                className="touch-none cursor-move rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]"
                            >
                                <Grip className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Smaller text"
                                onClick={() => setFontSize((current) => Math.max(MIN_FONT, current - 2))}
                                className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
                            >
                                A−
                            </button>
                            <button
                                type="button"
                                aria-label="Bigger text"
                                onClick={() => setFontSize((current) => Math.min(MAX_FONT, current + 2))}
                                className="rounded-md px-1.5 py-0.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
                            >
                                A+
                            </button>
                            <input
                                type="range"
                                min={0.2}
                                max={0.9}
                                step={0.05}
                                value={bgOpacity}
                                aria-label="Background opacity"
                                title="Background opacity"
                                onChange={(event) => setBgOpacity(Number(event.target.value))}
                                className="hidden h-1 w-16 accent-[#6A4CFF] sm:block"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={toggleScroll}
                            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#6A4CFF] px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#5839e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            aria-label={isScrolling ? 'Pause teleprompter' : isAtEnd ? 'Restart teleprompter' : 'Start teleprompter scrolling'}
                        >
                            {isScrolling ? <><Pause className="h-3.5 w-3.5" /> Pause</> : isAtEnd ? <><RotateCcw className="h-3.5 w-3.5" /> Restart</> : <><Play className="h-3.5 w-3.5" /> Scroll</>}
                        </button>
                    </div>

                    <div
                        ref={scrollRef}
                        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4"
                        style={{
                            maskImage: 'linear-gradient(to bottom, transparent 0, black 14%, black 86%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 14%, black 86%, transparent 100%)',
                        }}
                    >
                        <p
                            className="whitespace-pre-wrap text-center font-semibold leading-relaxed text-white"
                            style={{ fontSize, textShadow: '0 1px 4px rgba(0,0,0,0.75)' }}
                        >
                            {scriptText}
                        </p>
                    </div>

                    {/* Resize handle, bottom-right corner */}
                    <button
                        type="button"
                        aria-label="Resize teleprompter"
                        title="Drag to resize · double-click to reset · arrow keys also work"
                        onPointerDown={startResizing}
                        onPointerMove={resizePanel}
                        onPointerUp={stopResizing}
                        onPointerCancel={stopResizing}
                        onLostPointerCapture={() => { resizeRef.current = null; setIsResizing(false); }}
                        onDoubleClick={resetSize}
                        onKeyDown={resizeWithKeys}
                        className="absolute bottom-0 right-0 flex h-7 w-7 touch-none cursor-nwse-resize items-end justify-end rounded-tl-xl p-1 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]"
                    >
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                            <path d="M11 4L4 11M11 8L8 11" />
                        </svg>
                    </button>
                </section>
            )}
        </div>
    );
}