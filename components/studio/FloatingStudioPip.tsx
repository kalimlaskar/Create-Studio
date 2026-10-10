'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, Crosshair, Highlighter, MoveUpRight, Pause, Pencil, Play, Square } from 'lucide-react';
import { StudioSettings } from '@/types/studio';
import { TeleprompterOverlay } from './TeleprompterOverlay';

type AirSettings = Pick<
    StudioSettings,
    'airDrawingEnabled' | 'airDrawingTool' | 'airDrawingColor' | 'airDrawingFade' | 'airDrawingSnapShapes'
>;

interface FloatingStudioPipProps {
    pipWindow: Window | null;
    getCameraStream: () => MediaStream | null;
    /** The recording canvas stream, so the floating window can show your marks. */
    getPreviewStream?: () => MediaStream | null;
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
    /** Pass the studio settings and updateSettings to show the marker panel. */
    airDrawing?: AirSettings;
    onAirDrawingChange?: (patch: Partial<StudioSettings>) => void;
}

const AIR_TOOLS = [
    { id: 'pen', label: 'Draw', icon: Pencil },
    { id: 'highlighter', label: 'Marker', icon: Highlighter },
    { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
    { id: 'laser', label: 'Laser', icon: Crosshair },
] as const;

const AIR_COLORS = ['#FF3D81', '#FFE347', '#22d3ee', '#6A4CFF', '#22c55e', '#ffffff'];

const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function FloatingStudioPip({
    pipWindow, getCameraStream, getPreviewStream, scriptText, mirror, countdown,
    isRecording, isPaused, recordingSeconds, onStart, onStop, onPause, onResume,
    airDrawing, onAirDrawingChange,
}: FloatingStudioPipProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [view, setView] = useState<'camera' | 'canvas'>('camera');
    const canShowCanvas = Boolean(getPreviewStream);
    const showCanvas = view === 'canvas' && canShowCanvas;

    useEffect(() => {
        const video = videoRef.current;
        if (!pipWindow || !video) return;
        video.srcObject = showCanvas ? getPreviewStream?.() ?? null : getCameraStream();
        void video.play().catch(() => undefined);
    }, [pipWindow, getCameraStream, getPreviewStream, showCanvas]);

    if (!pipWindow) return null;

    const badge = isRecording ? `${isPaused ? 'PAUSED' : 'REC'} · ${formatTime(recordingSeconds)}` : 'LIVE';
    const badgeColor = isRecording ? (isPaused ? 'bg-amber-500' : 'bg-[#FF3D81]') : 'bg-[#14121F]/75';
    const showMarkerPanel = Boolean(airDrawing && onAirDrawingChange);

    return createPortal(
        <div className="flex h-screen w-screen flex-col bg-[#14121F] font-[family-name:var(--font-body)] text-white">
            <div className="relative aspect-video w-full shrink-0 bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                    style={{ transform: mirror && !showCanvas ? 'scaleX(-1)' : 'none' }}
                />
                <span className={`absolute left-2 top-2 rounded-full px-3 py-1 text-[11px] font-bold ${badgeColor}`}>
                    {badge}
                </span>
                {canShowCanvas && (
                    <div className="absolute right-2 top-2 flex rounded-full bg-black/60 p-0.5 text-[10px] font-bold backdrop-blur">
                        {(['camera', 'canvas'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setView(option)}
                                aria-pressed={view === option}
                                className={`rounded-full px-2.5 py-1 transition ${view === option ? 'bg-white text-[#14121F]' : 'text-white/75 hover:text-white'}`}
                            >
                                {option === 'camera' ? 'Camera' : 'Recording'}
                            </button>
                        ))}
                    </div>
                )}
                {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#14121F]/70">
                        <span className="animate-pulse text-7xl font-extrabold text-[#6A4CFF]">{countdown}</span>
                    </div>
                )}
            </div>

            {showMarkerPanel && airDrawing && onAirDrawingChange && (
                <div className="shrink-0 space-y-2.5 border-b border-white/10 bg-[#1d1a2e] px-3 py-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Marker</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={airDrawing.airDrawingEnabled}
                            aria-label="Air drawing"
                            onClick={() => onAirDrawingChange({ airDrawingEnabled: !airDrawing.airDrawingEnabled })}
                            className={`relative h-5 w-9 rounded-full transition-colors ${airDrawing.airDrawingEnabled ? 'bg-[#FF3D81]' : 'bg-white/25'}`}
                        >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${airDrawing.airDrawingEnabled ? 'left-[1.1rem]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    {airDrawing.airDrawingEnabled ? (
                        <>
                            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Drawing tool">
                                {AIR_TOOLS.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        aria-pressed={airDrawing.airDrawingTool === id}
                                        onClick={() => onAirDrawingChange({ airDrawingTool: id })}
                                        className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${airDrawing.airDrawingTool === id ? 'bg-[#6A4CFF] text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex gap-1.5" role="group" aria-label="Color">
                                    {AIR_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            aria-label={`Color ${color}`}
                                            aria-pressed={airDrawing.airDrawingColor === color}
                                            onClick={() => onAirDrawingChange({ airDrawingColor: color })}
                                            className={`h-5 w-5 rounded-full border-2 transition ${airDrawing.airDrawingColor === color ? 'scale-110 border-white' : 'border-transparent'}`}
                                            style={{ background: color }}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-3 text-[10px] font-semibold text-white/80">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={airDrawing.airDrawingFade}
                                            onChange={(event) => onAirDrawingChange({ airDrawingFade: event.target.checked })}
                                            className="h-3 w-3 accent-[#FF3D81]"
                                        />
                                        Fade 3s
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={airDrawing.airDrawingSnapShapes}
                                            onChange={(event) => onAirDrawingChange({ airDrawingSnapShapes: event.target.checked })}
                                            className="h-3 w-3 accent-[#FF3D81]"
                                        />
                                        Snap shapes
                                    </label>
                                </div>
                            </div>

                            <p className="text-[10px] leading-4 text-white/50">
                                ☝️ point to draw · ✌️ two fingers erase · ✊ undo · 🖐 hold 1s to clear
                            </p>
                        </>
                    ) : (
                        <p className="text-[10px] leading-4 text-white/50">Turn on to draw circles, arrows and highlights with your hand.</p>
                    )}
                </div>
            )}

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