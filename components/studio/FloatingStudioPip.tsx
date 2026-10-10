'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Circle, Pause, Play, Square } from 'lucide-react';
import { TeleprompterOverlay } from './TeleprompterOverlay';

interface FloatingStudioPipProps {
    pipWindow: Window | null;
    getCameraStream: () => MediaStream | null;
    scriptText: string;
    mirror: boolean;
    countdown: number | null;
    isRecording: boolean;
    isPaused: boolean;
    recordingSeconds: number;
    onStart: () => void;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
}

const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function FloatingStudioPip({
    pipWindow, getCameraStream, scriptText, mirror, countdown,
    isRecording, isPaused, recordingSeconds, onStart, onStop, onPause, onResume,
}: FloatingStudioPipProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!pipWindow || !video) return;
        video.srcObject = getCameraStream();
        void video.play().catch(() => undefined);
    }, [pipWindow, getCameraStream]);

    if (!pipWindow) return null;

    const badge = isRecording ? `${isPaused ? 'PAUSED' : 'REC'} · ${formatTime(recordingSeconds)}` : 'LIVE';
    const badgeColor = isRecording ? (isPaused ? 'bg-amber-500' : 'bg-[#FF3D81]') : 'bg-[#14121F]/75';

    return createPortal(
        <div className="flex h-screen w-screen flex-col bg-[#14121F] font-[family-name:var(--font-body)] text-white">
            <div className="relative aspect-video w-full shrink-0 bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
                />
                <span className={`absolute left-2 top-2 rounded-full px-3 py-1 text-[11px] font-bold ${badgeColor}`}>
                    {badge}
                </span>
                {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#14121F]/70">
                        <span className="animate-pulse text-7xl font-extrabold text-[#6A4CFF]">{countdown}</span>
                    </div>
                )}
            </div>

            <div className="relative min-h-0 flex-1">
                <TeleprompterOverlay scriptText={scriptText} variant="pip" />
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-[#1d1a2e] p-2">
                {!isRecording ? (
                    <button
                        type="button"
                        onClick={onStart}
                        className="flex items-center gap-1.5 rounded-full bg-[#FF3D81] px-4 py-2 text-xs font-bold hover:brightness-110"
                    >
                        <Circle className="h-3.5 w-3.5 fill-current" /> Record
                    </button>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={isPaused ? onResume : onPause}
                            className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-bold hover:bg-white/25"
                        >
                            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            type="button"
                            onClick={onStop}
                            className="flex items-center gap-1.5 rounded-full bg-[#FF3D81] px-4 py-2 text-xs font-bold hover:brightness-110"
                        >
                            <Square className="h-3.5 w-3.5 fill-current" /> Stop
                        </button>
                    </>
                )}
            </div>
        </div>,
        pipWindow.document.body
    );
}