'use client';

import React, { RefObject, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Maximize, Minimize } from 'lucide-react';
import { EditorProject } from '@/types/editor';
import { buildColorGradeFilter } from './colorGrade';
import { getFrameCrop, getRecordingDimensions } from '@/components/recordingQuality';
import { drawActiveCaption } from './captionRendering';
import { drawFreeTierWatermark } from '@/components/freeTier';
import { applyArtisticEffect } from '@/components/studio/artisticEffects';
import { drawActiveOverlays } from './overlayRendering';
import { getZoomScale } from './zoom';
import { createTransitionRenderer, TransitionRenderer } from './transitionRenderer';
import { drawTransitionFrame, TransitionSnapshots } from './transitions';

interface PreviewCanvasProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    project: EditorProject;
    performanceMode: boolean;
    isPro?: boolean;
}

export function PreviewCanvas({ videoRef, project, performanceMode, isPro = false }: PreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showOriginal, setShowOriginal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const snapshotsRef = useRef<TransitionSnapshots | null>(null);
    const rendererRef = useRef<TransitionRenderer | null>(null);
    const hasTransitions = (project.videoEdit.transitions?.length ?? 0) > 0;

    useEffect(() => {
        if (!hasTransitions) return;
        snapshotsRef.current = snapshotsRef.current ?? new TransitionSnapshots();
        rendererRef.current = rendererRef.current ?? createTransitionRenderer();
    }, [hasTransitions]);

    useEffect(() => () => {
        rendererRef.current?.dispose();
        rendererRef.current = null;
        snapshotsRef.current?.dispose();
        snapshotsRef.current = null;
    }, []);

    useEffect(() => {
        const snapshots = snapshotsRef.current;
        if (!hasTransitions || !snapshots) return;
        const { width, height } = getRecordingDimensions(project.aspectRatio);
        const timer = window.setTimeout(() => { snapshots.prepare(project, width, height); }, 250);
        return () => window.clearTimeout(timer);
    }, [hasTransitions, project]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            container.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Shared render frame logic
    const renderSingleFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.videoWidth === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const outputDimensions = getRecordingDimensions(project.aspectRatio);
        if (canvas.width !== outputDimensions.width || canvas.height !== outputDimensions.height) {
            canvas.width = outputDimensions.width;
            canvas.height = outputDimensions.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const currentMs = video.currentTime * 1000;
        const zoomScale = showOriginal ? 1 : getZoomScale(project.tracks.zoom, currentMs);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);

        ctx.filter = showOriginal ? 'none' : buildColorGradeFilter(project.colorGrade);
        const sourceCrop = getFrameCrop(video.videoWidth, video.videoHeight, project.aspectRatio);
        ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';

        ctx.restore();

        if (!showOriginal && snapshotsRef.current) {
            drawTransitionFrame(ctx, canvas, project, currentMs, snapshotsRef.current, rendererRef.current, performanceMode);
        }

        if (!showOriginal) drawActiveOverlays(ctx, project.tracks.overlays, currentMs, canvas.width, canvas.height);
        if (!showOriginal) drawActiveCaption(ctx, project.tracks.captions, currentMs, project.captionStyle, canvas.width, canvas.height);
        if (!showOriginal) applyArtisticEffect(canvas, project.cameraArtEffect);

        if (!showOriginal && !isPro) {
            drawFreeTierWatermark(ctx, canvas.width, canvas.height);
        }
    };

    // Force drawing the first frame immediately when video loads metadata or seeks
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoaded = () => renderSingleFrame();
        video.addEventListener('loadeddata', handleLoaded);
        video.addEventListener('seeked', handleLoaded);

        // If video is already ready, draw immediately
        if (video.readyState >= 2) {
            renderSingleFrame();
        }

        return () => {
            video.removeEventListener('loadeddata', handleLoaded);
            video.removeEventListener('seeked', handleLoaded);
        };
    }, [videoRef, project, showOriginal, isPro]);

    // Continuous animation loop for playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let animationFrameId: number;

        const drawLoop = () => {
            renderSingleFrame();
            animationFrameId = requestAnimationFrame(drawLoop);
        };

        drawLoop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [videoRef, project, showOriginal, performanceMode, isPro]);

    return (
        <div
            ref={containerRef}
            className={`relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-white font-[family-name:var(--font-body)] transition-all ${isFullscreen
                    ? 'h-screen w-screen p-0 rounded-none'
                    : 'rounded-[2.2rem] border border-[#14121F]/10 p-4 shadow-[0_20px_50px_-15px_rgba(20,18,31,0.15)] sm:p-6'
                }`}
        >
            <canvas ref={canvasRef} className="h-full w-auto max-h-full max-w-full rounded-2xl object-contain shadow-md" />

            {/* Action Buttons Top Right */}
            <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label="Toggle Fullscreen"
                    className="flex items-center justify-center rounded-full border border-[#14121F]/15 bg-white/90 p-2.5 text-[#14121F] shadow-lg backdrop-blur-xl transition hover:bg-[#14121F] hover:text-white"
                >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>

                <button
                    type="button"
                    onClick={() => setShowOriginal((original) => !original)}
                    aria-pressed={showOriginal}
                    className="flex items-center gap-2 rounded-full border border-[#14121F]/15 bg-white/90 px-4 py-2.5 text-xs font-semibold text-[#14121F] shadow-lg backdrop-blur-xl transition hover:bg-[#14121F] hover:text-white"
                >
                    {showOriginal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showOriginal ? 'Viewing original · show edited' : 'Before / after'}
                </button>
            </div>
        </div>
    );
}