'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface TeleprompterOverlayProps {
    scriptText: string;
}

export function TeleprompterOverlay({ scriptText }: TeleprompterOverlayProps) {
    const [isScrolling, setIsScrolling] = useState(false);
    const [isAtEnd, setIsAtEnd] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [prevScriptText, setPrevScriptText] = useState(scriptText);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className="pointer-events-none absolute inset-0 z-20">
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
                    aria-label="Teleprompter overlay"
                    onPointerDown={(event) => event.stopPropagation()}
                    className="pointer-events-auto absolute bottom-3 left-1/2 flex h-[24%] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-white/20 bg-neutral-950/75 text-white shadow-2xl backdrop-blur-md sm:bottom-4 sm:h-[22%]"
                >
                    <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">Teleprompter</span>
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