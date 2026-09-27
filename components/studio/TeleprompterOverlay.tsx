'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface TeleprompterOverlayProps {
    scriptText: string;
}

export function TeleprompterOverlay({ scriptText }: TeleprompterOverlayProps) {
    const [isScrolling, setIsScrolling] = useState(false);
    const [isAtEnd, setIsAtEnd] = useState(false);
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
        <section
            aria-label="Teleprompter overlay"
            className="absolute left-1/2 top-4 z-20 flex h-[60%] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/20 bg-neutral-950/65 text-white shadow-2xl backdrop-blur-md"
        >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Teleprompter</span>
                <button
                    type="button"
                    onClick={toggleScroll}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    aria-label={isScrolling ? 'Pause teleprompter' : isAtEnd ? 'Restart teleprompter' : 'Start teleprompter scrolling'}
                >
                    {isScrolling ? (
                        <><Pause className="h-3.5 w-3.5" /> Pause</>
                    ) : isAtEnd ? (
                        <><RotateCcw className="h-3.5 w-3.5" /> Restart</>
                    ) : (
                        <><Play className="h-3.5 w-3.5" /> Scroll</>
                    )}
                </button>
            </div>
            <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto px-5 py-3 scrollbar-thin"
            >
                <p className="whitespace-pre-wrap text-center text-sm font-medium leading-[1.7] drop-shadow-md sm:text-lg md:text-xl">
                    {scriptText}
                </p>
            </div>
        </section>
    );
}