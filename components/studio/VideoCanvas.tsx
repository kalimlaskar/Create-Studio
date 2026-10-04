'use client';

import React, { RefObject, useEffect, useRef } from 'react';
import { AspectRatioType, StudioSettings } from '@/types/studio';
import { FilesetResolver, ImageSegmenter, ImageSegmenterResult } from '@mediapipe/tasks-vision';
import { TeleprompterOverlay } from './TeleprompterOverlay';
import { getFrameCrop, getRecordingDimensions, RECORDING_FRAME_RATE } from '@/components/recordingQuality';
import { drawFreeTierWatermark } from '@/components/freeTier';
import { applyArtisticEffect, CameraArtEffect, drawPhotoAvatar, drawTrackedAvatar, FaceLandmarkPoint } from './artisticEffects';

interface VideoCanvasProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    canvasStreamRef: React.MutableRefObject<MediaStream | null>;
    settings: StudioSettings;
    microphoneLevelRef: React.MutableRefObject<number>;
    onAvatarMouthPositionChange: (x: number, y: number) => void;
    isRecording: boolean;
    isRecordingPaused: boolean;
    countdown: number | null;
}

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
const FACE_MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

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

export function VideoCanvas({ videoRef, canvasStreamRef, settings, microphoneLevelRef, onAvatarMouthPositionChange, isRecording, isRecordingPaused, countdown }: VideoCanvasProps) {
    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const segmenterRef = useRef<ImageSegmenter | null>(null);
    const faceLandmarkerRef = useRef<{ detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { faceLandmarks?: FaceLandmarkPoint[][] }; close: () => void } | null>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const avatarImageRef = useRef<HTMLImageElement | null>(null);
    const settingsRef = useRef(settings);
    const isRecordingRef = useRef(isRecording);

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

    useEffect(() => {
        avatarImageRef.current = null;
        if (!settings.cameraAvatarImageUrl) return;
        const image = new Image();
        image.onload = () => { avatarImageRef.current = image; };
        image.src = settings.cameraAvatarImageUrl;
        return () => { avatarImageRef.current = null; };
    }, [settings.cameraAvatarImageUrl]);

    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

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
        const needsSegmentation = ['green', 'blur', 'image', 'transparent'].includes(settings.backgroundMode);
        if (!needsSegmentation) {
            segmenterRef.current?.close();
            segmenterRef.current = null;
            prevMaskRef.current = null;
            return;
        }
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
    }, [settings.backgroundMode]);

    useEffect(() => {
        if (settings.cameraArtEffect !== 'avatar') {
            faceLandmarkerRef.current?.close();
            faceLandmarkerRef.current = null;
            return;
        }
        let cancelled = false;
        let landmarker: { detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { faceLandmarks?: FaceLandmarkPoint[][] }; close: () => void } | null = null;

        const initialize = async () => {
            try {
                const visionModule = await import('@mediapipe/tasks-vision');
                const visionApi = visionModule as unknown as {
                    FaceLandmarker: {
                        createFromOptions: (resolver: unknown, options: Record<string, unknown>) => Promise<typeof landmarker>;
                    };
                };
                const resolver = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
                landmarker = await visionApi.FaceLandmarker.createFromOptions(resolver, {
                    baseOptions: { modelAssetPath: FACE_MODEL_ASSET_URL, delegate: 'GPU' },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    outputFaceBlendshapes: false,
                });
                if (cancelled) landmarker?.close();
                else faceLandmarkerRef.current = landmarker;
            } catch (error) {
                console.error('Face Landmarker could not be initialized:', error);
            }
        };
        void initialize();
        return () => {
            cancelled = true;
            landmarker?.close();
            faceLandmarkerRef.current = null;
        };
    }, [settings.cameraArtEffect]);

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

    const renderFrame = (result?: ImageSegmenterResult) => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const currentSettings = settingsRef.current;
        const videoFilter = getVideoFilter(currentSettings);
        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;
        const { width: outputWidth, height: outputHeight } = getRecordingDimensions(currentSettings.aspectRatio);
        if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
            canvas.width = outputWidth;
            canvas.height = outputHeight;
        }
        const sourceCrop = getFrameCrop(vWidth, vHeight, currentSettings.aspectRatio);

        if (!result?.confidenceMasks?.[0]) {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.filter = videoFilter;
            ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            applyArtisticEffect(canvas, currentSettings.cameraArtEffect as CameraArtEffect);
            if (isRecordingRef.current) drawFreeTierWatermark(ctx, canvas.width, canvas.height);
            return;
        }

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
            sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height
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
                ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
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
                tempCtx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, tempCanvas.width, tempCanvas.height);

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
            ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);

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
            ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        ctx.restore();
        applyArtisticEffect(canvas, currentSettings.cameraArtEffect as CameraArtEffect);
        if (isRecordingRef.current) {
            drawFreeTierWatermark(ctx, canvas.width, canvas.height);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        let animationFrameId: number;

        const processFrame = () => {
            const currentSettings = settingsRef.current;
            const { width, height } = getRecordingDimensions(currentSettings.aspectRatio);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            if (video.readyState >= video.HAVE_CURRENT_DATA && currentSettings.cameraArtEffect === 'photo-avatar') {
                const context = canvas.getContext('2d');
                if (context) {
                    drawPhotoAvatar(
                        context,
                        canvas.width,
                        canvas.height,
                        avatarImageRef.current,
                        microphoneLevelRef.current,
                        currentSettings.cameraAvatarMouthX,
                        currentSettings.cameraAvatarMouthY,
                        currentSettings.cameraAvatarMouthWidth
                    );
                    if (isRecordingRef.current) drawFreeTierWatermark(context, canvas.width, canvas.height);
                }
            } else if (video.readyState >= video.HAVE_CURRENT_DATA && currentSettings.cameraArtEffect === 'avatar') {
                try {
                    const landmarks = faceLandmarkerRef.current?.detectForVideo(video, performance.now()).faceLandmarks?.[0];
                    const context = canvas.getContext('2d');
                    if (context) {
                        drawTrackedAvatar(context, canvas.width, canvas.height, landmarks);
                        if (isRecordingRef.current) drawFreeTierWatermark(context, canvas.width, canvas.height);
                    }
                } catch (error) {
                    console.error('Face tracking frame failed:', error);
                }
            } else if (video.readyState >= video.HAVE_CURRENT_DATA) {
                if (segmenterRef.current) {
                    const result = segmenterRef.current.segmentForVideo(video, performance.now());
                    renderFrame(result);
                } else {
                    renderFrame();
                }
            }
            animationFrameId = requestAnimationFrame(processFrame);
        };

        processFrame();

        if (canvas.captureStream) {
            canvasStreamRef.current = canvas.captureStream(RECORDING_FRAME_RATE);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [videoRef, canvasStreamRef, microphoneLevelRef]);

    const getAspectRatioClass = (ratio: AspectRatioType) => {
        switch (ratio) {
            case '9:16': return 'aspect-[9/16]';
            case '1:1': return 'aspect-square';
            case '16:9': default: return 'aspect-video';
        }
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-neutral-950 p-2 sm:p-4">
            {countdown !== null && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center">
                    <span className="text-8xl font-black text-indigo-500 animate-pulse">{countdown}</span>
                </div>
            )}

            <video ref={videoRef} autoPlay playsInline muted className="hidden" />

            <div
                style={{ aspectRatio: settings.aspectRatio.replace(':', ' / ') }}
                onPointerDown={(event) => {
                    if (settings.cameraArtEffect !== 'photo-avatar' || !settings.cameraAvatarImageUrl) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    onAvatarMouthPositionChange(
                        Math.max(0.15, Math.min(0.85, (event.clientX - rect.left) / rect.width)),
                        Math.max(0.35, Math.min(0.9, (event.clientY - rect.top) / rect.height))
                    );
                }}
                className={`relative h-full max-h-full max-w-full shrink-0 overflow-hidden rounded-2xl border-2 border-neutral-800 bg-black shadow-2xl transition-all duration-300 ${getAspectRatioClass(settings.aspectRatio)} ${settings.cameraArtEffect === 'photo-avatar' && settings.cameraAvatarImageUrl ? 'cursor-crosshair' : ''}`}>
                <canvas ref={visibleCanvasRef} className="w-full h-full object-cover" />
                {settings.cameraArtEffect === 'photo-avatar' && settings.cameraAvatarImageUrl && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${settings.cameraAvatarMouthX * 100}%`, top: `${settings.cameraAvatarMouthY * 100}%` }}>
                        <span className="block h-5 w-5 rounded-full border-2 border-fuchsia-300 bg-fuchsia-500/35 shadow-[0_0_12px_rgba(217,70,239,.85)]" />
                        <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-white/90" />
                        <span className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-white/90" />
                    </div>
                )}
                <TeleprompterOverlay scriptText={settings.scriptText} />

                {isRecording && (
                    <div className={`absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:left-4 sm:top-4 ${isRecordingPaused ? 'bg-amber-500/90' : 'bg-red-600/90'}`}>
                        <span className={`h-2 w-2 rounded-full bg-white ${isRecordingPaused ? '' : 'animate-pulse'}`} /> {isRecordingPaused ? 'PAUSED' : 'RECORDING'} · FREE PLAN
                    </div>
                )}
            </div>
        </div>
    );
}