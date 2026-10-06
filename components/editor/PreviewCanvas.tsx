'use client';

import React, { RefObject, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
}

export function PreviewCanvas({ videoRef, project, performanceMode }: PreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showOriginal, setShowOriginal] = useState(false);
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

    // Capture the outgoing frame of every transition so the preview can play them live.
    useEffect(() => {
        const snapshots = snapshotsRef.current;
        if (!hasTransitions || !snapshots) return;
        const { width, height } = getRecordingDimensions(project.aspectRatio);
        const timer = window.setTimeout(() => { snapshots.prepare(project, width, height); }, 250);
        return () => window.clearTimeout(timer);
    }, [hasTransitions, project]);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        let animationFrameId: number;

        const drawFrame = () => {
            const ctx = canvas.getContext('2d');
            if (ctx && video.videoWidth > 0) {
                const outputDimensions = getRecordingDimensions(project.aspectRatio);
                if (canvas.width !== outputDimensions.width || canvas.height !== outputDimensions.height) {
                    canvas.width = outputDimensions.width;
                    canvas.height = outputDimensions.height;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const currentMs = video.currentTime * 1000;
                const zoomScale = showOriginal ? 1 : getZoomScale(project.tracks.zoom, currentMs);

                ctx.save();
                // Center the zoom so it scales outward from the middle of the frame
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(zoomScale, zoomScale);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);

                ctx.filter = showOriginal ? 'none' : buildColorGradeFilter(project.colorGrade);
                const sourceCrop = getFrameCrop(video.videoWidth, video.videoHeight, project.aspectRatio);
                ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';

                ctx.restore(); // overlays drawn AFTER restore, so text stays fixed size/position, not zoomed

                if (!showOriginal && snapshotsRef.current) {
                    drawTransitionFrame(ctx, canvas, project, currentMs, snapshotsRef.current, rendererRef.current, performanceMode);
                }

                if (!showOriginal) drawActiveOverlays(ctx, project.tracks.overlays, currentMs, canvas.width, canvas.height);
                if (!showOriginal) drawActiveCaption(ctx, project.tracks.captions, currentMs, project.captionStyle, canvas.width, canvas.height);
                if (!showOriginal) applyArtisticEffect(canvas, project.cameraArtEffect);
                if (!showOriginal) drawFreeTierWatermark(ctx, canvas.width, canvas.height);
            }
            animationFrameId = requestAnimationFrame(drawFrame);
        };

        drawFrame();
        return () => cancelAnimationFrame(animationFrameId);
    }, [videoRef, project, showOriginal, performanceMode]);

    return (
        <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-3 sm:p-4">
            <canvas ref={canvasRef} className="h-full w-auto max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
            <button type="button" onClick={() => setShowOriginal((original) => !original)} aria-pressed={showOriginal}
                className="absolute right-5 top-5 z-10 flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-black/90">
                {showOriginal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showOriginal ? 'Viewing original · show edited' : 'Before / after'}
            </button>
        </div>
    );
}