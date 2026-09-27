'use client';

import React, { RefObject, useEffect, useRef } from 'react';
import { EditorProject } from '@/types/editor';
import { buildColorGradeFilter } from './colorGrade';

interface PreviewCanvasProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    project: EditorProject;
    playheadMs: number;
}

function getZoomScale(zoomKeyframes: EditorProject['tracks']['zoom'], currentMs: number): number {
    if (zoomKeyframes.length === 0) return 1;
    if (currentMs <= zoomKeyframes[0].atMs) return zoomKeyframes[0].scale;
    if (currentMs >= zoomKeyframes[zoomKeyframes.length - 1].atMs) {
        return zoomKeyframes[zoomKeyframes.length - 1].scale;
    }
    for (let i = 0; i < zoomKeyframes.length - 1; i++) {
        const a = zoomKeyframes[i];
        const b = zoomKeyframes[i + 1];
        if (currentMs >= a.atMs && currentMs <= b.atMs) {
            const t = (currentMs - a.atMs) / (b.atMs - a.atMs);
            return a.scale + (b.scale - a.scale) * t; // linear interpolation
        }
    }
    return 1;
}

export function PreviewCanvas({ videoRef, project, playheadMs }: PreviewCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        let animationFrameId: number;

        const drawFrame = () => {
            const ctx = canvas.getContext('2d');
            if (ctx && video.videoWidth > 0) {
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const currentMs = video.currentTime * 1000;
                const zoomScale = getZoomScale(project.tracks.zoom, currentMs);

                ctx.save();
                // Center the zoom so it scales outward from the middle of the frame
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.scale(zoomScale, zoomScale);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);

                ctx.filter = buildColorGradeFilter(project.colorGrade);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.filter = 'none';

                ctx.restore(); // overlays drawn AFTER restore, so text stays fixed size/position, not zoomed

                for (const overlay of project.tracks.overlays) {
                    if (currentMs < overlay.startMs || currentMs > overlay.endMs) continue;
                    if (overlay.type === 'text') {
                        const fontSize = overlay.fontSize ?? 32;
                        ctx.font = `bold ${fontSize}px sans-serif`;
                        ctx.fillStyle = overlay.color ?? '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                        ctx.lineWidth = fontSize * 0.12;
                        const x = overlay.x * canvas.width;
                        const y = overlay.y * canvas.height;
                        ctx.strokeText(overlay.content, x, y);
                        ctx.fillText(overlay.content, x, y);
                    }
                }
            }
            animationFrameId = requestAnimationFrame(drawFrame);
        };

        drawFrame();
        return () => cancelAnimationFrame(animationFrameId);
    }, [videoRef, project]);

    return (
        <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden">
            <canvas ref={canvasRef} className="max-w-full max-h-full" />
        </div>
    );
}