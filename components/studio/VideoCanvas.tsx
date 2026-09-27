'use client';

import React, { RefObject, useEffect, useRef } from 'react';
import { AspectRatioType, StudioSettings } from '@/types/studio';
import { FilesetResolver, ImageSegmenter, ImageSegmenterResult } from '@mediapipe/tasks-vision';
import { TeleprompterOverlay } from './TeleprompterOverlay';

interface VideoCanvasProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    canvasStreamRef: React.MutableRefObject<MediaStream | null>;
    settings: StudioSettings;
    isRecording: boolean;
    countdown: number | null;
}

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';

function getVideoFilter(settings: StudioSettings) {
    const preset = settings.filterPreset === 'cinematic'
        ? 'saturate(120%) sepia(20%)'
        : settings.filterPreset === 'mono'
            ? 'grayscale(100%)'
            : settings.filterPreset === 'warm'
                ? 'sepia(40%) saturate(140%)'
                : '';

    return `brightness(${settings.brightness}%) contrast(${settings.contrast}%) ${preset}`.trim();
}

export function VideoCanvas({ videoRef, canvasStreamRef, settings, isRecording, countdown }: VideoCanvasProps) {
    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const segmenterRef = useRef<ImageSegmenter | null>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const settingsRef = useRef(settings);

    const prevMaskRef = useRef<Float32Array | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // helper to lazily get-or-create it, browser-side only
    const getMaskCanvas = () => {
        if (!maskCanvasRef.current) {
            maskCanvasRef.current = document.createElement('canvas');
        }
        return maskCanvasRef.current;
    };

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const getCanvasDimensions = (videoWidth: number, videoHeight: number, ratio: AspectRatioType) => {
        if (ratio === '9:16') {
            const targetWidth = (videoHeight * 9) / 16;
            return { width: targetWidth, height: videoHeight };
        }
        if (ratio === '1:1') {
            const minDimension = Math.min(videoWidth, videoHeight);
            return { width: minDimension, height: minDimension };
        }
        return { width: videoWidth, height: videoHeight };
    };

    // Given the crop region used on the video (in video pixel space), compute
    // the equivalent crop region in mask pixel space. The mask is usually a
    // different resolution than the raw video frame, so this must be scaled
    // proportionally — not just reused as-is — or the two will misalign.
    const getMaskCropRect = (
        maskWidth: number,
        maskHeight: number,
        videoWidth: number,
        videoHeight: number,
        sourceX: number,
        sourceY: number,
        cropWidth: number,
        cropHeight: number
    ) => {
        const scaleX = maskWidth / videoWidth;
        const scaleY = maskHeight / videoHeight;
        return {
            sx: sourceX * scaleX,
            sy: sourceY * scaleY,
            sw: cropWidth * scaleX,
            sh: cropHeight * scaleY,
        };
    };

    // Load background image
    useEffect(() => {
        if (!settings.backgroundImageUrl) {
            bgImageRef.current = null;
            return;
        }
        const img = new Image();
        img.onload = () => { bgImageRef.current = img; };
        img.onerror = () => { bgImageRef.current = null; };
        img.src = settings.backgroundImageUrl;
        return () => { bgImageRef.current = null; };
    }, [settings.backgroundImageUrl]);

    // Init the Tasks Vision ImageSegmenter, with a GPU->CPU fallback and
    // pinned model/fileset versions (avoids silent 404s from "@latest" paths).
    useEffect(() => {
        let cancelled = false;

        const createSegmenter = async (delegate: 'GPU' | 'CPU') => {
            const vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
            return ImageSegmenter.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: MODEL_ASSET_URL,
                    delegate,
                },
                runningMode: 'VIDEO',
                outputCategoryMask: false,
                outputConfidenceMasks: true,
            });
        };

        const init = async () => {
            try {
                const segmenter = await createSegmenter('GPU');
                if (!cancelled) {
                    segmenterRef.current = segmenter;
                    console.log('Segmenter delegate: GPU');
                }
            } catch (err) {
                console.error('GPU segmenter init failed, falling back to CPU:', err);
                try {
                    const segmenter = await createSegmenter('CPU');
                    if (!cancelled) {
                        segmenterRef.current = segmenter;
                        console.log('Segmenter delegate: CPU (fallback)');
                    }
                } catch (err2) {
                    console.error('CPU segmenter fallback also failed:', err2);
                }
            }
        };

        init();
        return () => {
            cancelled = true;
            segmenterRef.current?.close();
        };
    }, []);

    const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = w / h;
        let sx = 0, sy = 0, sWidth = img.naturalWidth, sHeight = img.naturalHeight;
        if (imgRatio > canvasRatio) {
            sWidth = img.naturalHeight * canvasRatio;
            sx = (img.naturalWidth - sWidth) / 2;
        } else {
            sHeight = img.naturalWidth / canvasRatio;
            sy = (img.naturalHeight - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, w, h);
    };

    const buildSmoothedMaskCanvas = (confidenceMask: Float32Array, width: number, height: number) => {
        const prev = prevMaskRef.current;
        const smoothed = new Float32Array(confidenceMask.length);
        const smoothingFactor = 0.6;

        for (let i = 0; i < confidenceMask.length; i++) {
            const current = confidenceMask[i];
            const previous = prev ? prev[i] : current;
            smoothed[i] = previous * smoothingFactor + current * (1 - smoothingFactor);
        }
        prevMaskRef.current = smoothed;
        const maskCanvas = getMaskCanvas();
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d')!;
        const imageData = maskCtx.createImageData(width, height);

        for (let i = 0; i < smoothed.length; i++) {
            const alpha = Math.round(smoothed[i] * 255);
            imageData.data[i * 4 + 3] = alpha;
        }
        maskCtx.putImageData(imageData, 0, 0);

        const softened = document.createElement('canvas');
        softened.width = width;
        softened.height = height;
        const softCtx = softened.getContext('2d')!;
        softCtx.filter = 'blur(1.5px)';
        softCtx.drawImage(maskCanvas, 0, 0);

        return softened;
    };

    const renderFrame = (result: ImageSegmenterResult) => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas || !result.confidenceMasks?.[0]) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const currentSettings = settingsRef.current;
        const videoFilter = getVideoFilter(currentSettings);
        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;
        const { width: targetWidth, height: targetHeight } = getCanvasDimensions(vWidth, vHeight, currentSettings.aspectRatio);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const sourceX = (vWidth - targetWidth) / 2;
        const sourceY = (vHeight - targetHeight) / 2;

        const maskData = result.confidenceMasks[0]; // MPMask
        const maskFloat = maskData.getAsFloat32Array();
        const maskWidth = maskData.width;
        const maskHeight = maskData.height;
        maskData.close(); // release GPU/WASM memory now that data is copied out

        const smoothedMaskCanvas = buildSmoothedMaskCanvas(maskFloat, maskWidth, maskHeight);

        // The mask's crop rect, in the mask's own pixel space — proportional
        // to the same crop we're applying to the video.
        const maskCrop = getMaskCropRect(
            maskWidth, maskHeight,
            vWidth, vHeight,
            sourceX, sourceY, targetWidth, targetHeight
        );

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const mode = currentSettings.backgroundMode;

        if (mode === 'green' || mode === 'blur' || mode === 'image') {
            if (mode === 'green') {
                ctx.fillStyle = '#00FF00';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (mode === 'blur') {
                ctx.filter = 'blur(16px)';
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, sourceX, sourceY, targetWidth, targetHeight, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            } else if (mode === 'image') {
                if (bgImageRef.current?.complete) {
                    drawImageCover(ctx, bgImageRef.current, canvas.width, canvas.height);
                } else {
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            if (tempCtx) {
                // Draw the mirrored video AND apply the mask inside the SAME
                // transform, so both go through identical flip/crop math.
                tempCtx.save();
                tempCtx.translate(tempCanvas.width, 0);
                tempCtx.scale(-1, 1);
                tempCtx.filter = videoFilter;
                tempCtx.drawImage(video, sourceX, sourceY, targetWidth, targetHeight, 0, 0, tempCanvas.width, tempCanvas.height);

                tempCtx.filter = 'none';
                tempCtx.globalCompositeOperation = 'destination-in';
                tempCtx.drawImage(
                    smoothedMaskCanvas,
                    maskCrop.sx, maskCrop.sy, maskCrop.sw, maskCrop.sh,
                    0, 0, tempCanvas.width, tempCanvas.height
                );
                tempCtx.restore();

                ctx.drawImage(tempCanvas, 0, 0);
            }
        } else if (mode === 'transparent') {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.filter = videoFilter;
            ctx.drawImage(video, sourceX, sourceY, targetWidth, targetHeight, 0, 0, canvas.width, canvas.height);

            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(
                smoothedMaskCanvas,
                maskCrop.sx, maskCrop.sy, maskCrop.sw, maskCrop.sh,
                0, 0, canvas.width, canvas.height
            );
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.filter = videoFilter;
            ctx.drawImage(video, sourceX, sourceY, targetWidth, targetHeight, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        ctx.restore();
    };

    useEffect(() => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        let animationFrameId: number;

        const processFrame = () => {
            if (video.readyState >= video.HAVE_CURRENT_DATA && segmenterRef.current) {
                const result = segmenterRef.current.segmentForVideo(video, performance.now());
                renderFrame(result);
            }
            animationFrameId = requestAnimationFrame(processFrame);
        };

        processFrame();

        if (canvas.captureStream) {
            canvasStreamRef.current = canvas.captureStream(30);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [videoRef, canvasStreamRef]);

    const getAspectRatioClass = (ratio: AspectRatioType) => {
        switch (ratio) {
            case '9:16': return 'aspect-[9/16] max-w-md';
            case '1:1': return 'aspect-square max-w-lg';
            case '16:9': default: return 'aspect-video max-w-4xl';
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative bg-neutral-950">
            {countdown !== null && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center">
                    <span className="text-8xl font-black text-indigo-500 animate-pulse">{countdown}</span>
                </div>
            )}

            <video ref={videoRef} autoPlay playsInline muted className="hidden" />

            <div className={`relative rounded-2xl overflow-hidden border-2 border-neutral-800 shadow-2xl bg-black flex items-center justify-center w-full transition-all duration-300 ${getAspectRatioClass(settings.aspectRatio)}`}>
                <canvas ref={visibleCanvasRef} className="w-full h-full object-cover" />
                <TeleprompterOverlay scriptText={settings.scriptText} />

                {isRecording && (
                    <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-white"></span> RECORDING
                    </div>
                )}
            </div>
        </div>
    );
}