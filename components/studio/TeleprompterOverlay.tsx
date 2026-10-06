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

interface DragState {
    pointerId: number;
    startX: number;
    startY: number;
    centerX: number;
    centerY: number;
}

const POSITION_STORAGE_KEY = 'cliprame-teleprompter-position-v1';
const DEFAULT_POSITION: OverlayPosition = { x: 0.5, y: 0.76 };

export function TeleprompterOverlay({ scriptText }: TeleprompterOverlayProps) {
    const [isScrolling, setIsScrolling] = useState(false);
    const [isAtEnd, setIsAtEnd] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [prevScriptText, setPrevScriptText] = useState(scriptText);
    const [position, setPosition] = useState(DEFAULT_POSITION);
    const [positionLoaded, setPositionLoaded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLElement>(null);
    const dragRef = useRef<DragState | null>(null);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            try {
                const savedPosition = window.localStorage.getItem(POSITION_STORAGE_KEY);
                if (savedPosition) {
                    const parsed = JSON.parse(savedPosition) as Partial<OverlayPosition>;
                    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                        setPosition({ x: Math.min(1, Math.max(0, parsed.x)), y: Math.min(1, Math.max(0, parsed.y)) });
                    }
                }
            } catch {
                try {
                    window.localStorage.removeItem(POSITION_STORAGE_KEY);
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

    // Reset isAtEnd safely during render when scriptText changes (replaces the bad useEffect)
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

    return (
        <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20">
            <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    if (isVisible) setIsScrolling(false);
                    setIsVisible(!isVisible);
                }}
                aria-expanded={isVisible}
                className="pointer-events-auto absolute right-3 top-3 rounded-full border border-white/20 bg-neutral-950/70 px-3 py-2 text-[11px] font-semibold text-white/90 shadow backdrop-blur hover:bg-neutral-900/90 sm:right-4 sm:top-4"
            >
                {isVisible ? 'Hide prompter' : 'Show prompter'}
            </button>

            {isVisible && (
                <section
                    ref={panelRef}
                    aria-label="Teleprompter overlay"
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, transform: 'translate(-50%, -50%)' }}
                    className={`pointer-events-auto absolute flex h-[24%] w-[calc(100%-1.5rem)] max-w-3xl flex-col overflow-hidden rounded-xl border border-white/20 bg-neutral-950/75 text-white shadow-2xl backdrop-blur-md sm:h-[22%] ${isDragging ? 'ring-1 ring-indigo-400/70' : ''}`}
                >
                    <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
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
                                className="touch-none cursor-move rounded p-1 text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                                <Grip className="h-3.5 w-3.5" />
                            </button>
                            <span className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">Teleprompter</span>
                        </div>
                        <button
                            type="button"
                            onClick={toggleScroll}
                            className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            aria-label={isScrolling ? 'Pause teleprompter' : isAtEnd ? 'Restart teleprompter' : 'Start teleprompter scrolling'}
                        >
                            {isScrolling ? <><Pause className="h-3 w-3" /> Pause</> : isAtEnd ? <><RotateCcw className="h-3 w-3" /> Restart</> : <><Play className="h-3 w-3" /> Scroll</>}
                        </button>
                    </div>
                    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
                        <p className="whitespace-pre-wrap text-center text-xs font-medium leading-relaxed drop-shadow-md sm:text-sm md:text-base">{scriptText}</p>
                    </div>
                </section>
            )}
        </div>
    );
}