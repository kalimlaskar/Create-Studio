'use client';

import React, { RefObject, useEffect, useRef, useState } from 'react';
import { AspectRatioType, StudioSettings } from '@/types/studio';
import { FilesetResolver, ImageSegmenter, ImageSegmenterResult } from '@mediapipe/tasks-vision';
import { TeleprompterOverlay } from './TeleprompterOverlay';
import { getFrameCrop, getRecordingDimensions, RECORDING_FRAME_RATE } from '@/components/recordingQuality';
import { drawFreeTierWatermark } from '@/components/freeTier';
import { createHologramRenderer, HologramRenderer } from './hologramRenderer';
import { AirDrawingEngine, AirDrawingOptions, AnnotationSpace, getScreenRect, TargetRect, TextItemInfo } from './airDrawing';
import { getHandwritingService } from './handwriting';
import { annotationTimeline } from './annotationTimeline';
import { applyArtisticEffect, CameraArtEffect, drawPhotoAvatar, drawTrackedAvatar, FaceLandmarkPoint } from './artisticEffects';
import { computeScreenFrameLayout, drawScreenFrame, getFrameProgress, ScreenFrameOptions } from './screenFrame';
import { Sparkles, Radio } from 'lucide-react';

interface VideoCanvasProps {
    videoRef: RefObject<HTMLVideoElement | null>;
    canvasStreamRef: React.MutableRefObject<MediaStream | null>;
    settings: StudioSettings;
    microphoneLevelRef: React.MutableRefObject<number>;
    onAvatarMouthPositionChange: (x: number, y: number) => void;
    isRecording: boolean;
    isRecordingPaused: boolean;
    countdown: number | null;
    screenShareStream: MediaStream | null;
    onScreenFrame?: (video: HTMLVideoElement) => void;
    isProUser: boolean;
}

type FaceLandmarkerLike = {
    detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { faceLandmarks?: FaceLandmarkPoint[][] };
    close: () => void;
};
type FrameCrop = ReturnType<typeof getFrameCrop>;
type ZoomState = { scale: number; x: number; y: number };
type PixelRect = { x: number; y: number; width: number; height: number };

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
const FACE_MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const clockMs = () => performance.now();

const SEGMENTATION_MODES = ['green', 'blur', 'image', 'transparent'];

const OFFSCREEN_VIDEO_CLASS =
    'pointer-events-none fixed left-0 top-0 z-[-1] h-px w-px opacity-[0.01]';

const DEFAULT_ZOOM: ZoomState = { scale: 1, x: 0.5, y: 0.5 };
const DEFAULT_MAX_ZOOM = 3;

function getVideoFilter(settings: StudioSettings) {
    const neutral = settings.brightness === 100 && settings.contrast === 100 && settings.filterPreset === 'none';
    if (neutral) return 'none';
    const preset = settings.filterPreset === 'cinematic'
        ? 'saturate(120%) sepia(20%)'
        : settings.filterPreset === 'mono'
            ? 'grayscale(100%)'
            : settings.filterPreset === 'warm'
                ? 'sepia(40%) saturate(140%)'
                : '';

    return `brightness(${settings.brightness}%) contrast(${settings.contrast}%) ${preset}`.trim();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
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
}

function drawMirrored(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    crop: FrameCrop,
    width: number,
    height: number,
    filter: string,
    mirror = true
) {
    ctx.save();
    if (mirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
    }
    ctx.filter = filter;
    ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    ctx.restore();
}

function getMaskCropRect(
    maskWidth: number,
    maskHeight: number,
    videoWidth: number,
    videoHeight: number,
    crop: FrameCrop
) {
    const scaleX = maskWidth / videoWidth;
    const scaleY = maskHeight / videoHeight;
    return {
        sx: crop.x * scaleX,
        sy: crop.y * scaleY,
        sw: crop.width * scaleX,
        sh: crop.height * scaleY,
    };
}

function drawZoomedScreen(ctx: CanvasRenderingContext2D, screen: HTMLVideoElement, rect: PixelRect, zoom: ZoomState) {
    if (zoom.scale < 1.02) return;
    const sw = screen.videoWidth / zoom.scale;
    const sh = screen.videoHeight / zoom.scale;
    const sx = Math.min(screen.videoWidth - sw, Math.max(0, zoom.x * screen.videoWidth - sw / 2));
    const sy = Math.min(screen.videoHeight - sh, Math.max(0, zoom.y * screen.videoHeight - sh / 2));
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    ctx.drawImage(screen, sx, sy, sw, sh, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}

function drawScreenShareFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    screen: HTMLVideoElement,
    camera: HTMLVideoElement,
    cameraFilter: string,
    mirror = true,
    frame?: ScreenFrameOptions,
    showCamera = true,
    zoom?: ZoomState,
    zoomRect?: PixelRect
) {
    const { width, height } = canvas;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0B0A10';
    ctx.fillRect(0, 0, width, height);

    let framed: ReturnType<typeof drawScreenFrame> = null;
    if (frame && frame.style !== 'off') {
        try {
            framed = drawScreenFrame(ctx, screen, screen.videoWidth, screen.videoHeight, width, height, frame);
        } catch (error) {
            console.error('Screen frame failed, drawing the plain layout instead:', error);
        }
    }

    if (!framed) {
        const scale = Math.min(width / screen.videoWidth, height / screen.videoHeight);
        const sw = screen.videoWidth * scale;
        const sh = screen.videoHeight * scale;
        ctx.drawImage(screen, (width - sw) / 2, (height - sh) / 2, sw, sh);
    }

    if (zoom && zoomRect) drawZoomedScreen(ctx, screen, zoomRect, zoom);

    if (showCamera && camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && camera.videoWidth > 0) {
        const cardWidth = Math.round(width * 0.24);
        const cardHeight = Math.round(cardWidth * 0.62);
        const inset = Math.max(20, Math.round(width * 0.02));
        const cardX = width - cardWidth - inset;
        const cardY = height - cardHeight - inset;
        const radius = Math.max(20, Math.round(cardWidth * 0.09));
        const crop = getFrameCrop(camera.videoWidth, camera.videoHeight, '16:9');

        // Futuristic Glow Backdrop for Camera PIP
        ctx.save();
        ctx.shadowColor = 'rgba(106,76,255,0.4)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = 'rgba(20, 18, 31, 0.85)';
        ctx.beginPath();
        ctx.roundRect(cardX - 4, cardY - 4, cardWidth + 8, cardHeight + 8, radius + 4);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
        ctx.clip();
        if (mirror) {
            ctx.translate(cardX + cardWidth, cardY);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(cardX, cardY);
        }
        ctx.filter = cameraFilter;
        ctx.drawImage(camera, crop.x, crop.y, crop.width, crop.height, 0, 0, cardWidth, cardHeight);
        ctx.restore();

        // High-end cyber border stroke
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
        ctx.stroke();

        // LIVE Telemetry Pill inside camera view
        const pad = Math.max(10, Math.round(cardWidth * 0.04));
        const labelHeight = Math.max(20, Math.round(cardHeight * 0.14));
        ctx.fillStyle = 'rgba(10, 9, 15, 0.8)';
        ctx.beginPath();
        ctx.roundRect(cardX + pad, cardY + pad, Math.max(54, cardWidth * 0.26), labelHeight, labelHeight / 2);
        ctx.fill();

        ctx.font = `700 ${Math.max(10, Math.round(width * 0.011))}px sans-serif`;
        ctx.fillStyle = '#A78BFA';
        ctx.textBaseline = 'middle';
        ctx.fillText('● LIVE FEED', cardX + pad + 8, cardY + pad + labelHeight / 2);
    }

    ctx.restore();
}

function createBackgroundTicker(onTick: () => void, fps: number) {
    const intervalMs = 1000 / fps;
    try {
        const source = 'let t;onmessage=e=>{clearInterval(t);t=setInterval(()=>postMessage(1),e.data)}';
        const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        const worker = new Worker(url);
        worker.onmessage = () => onTick();
        worker.postMessage(intervalMs);
        return () => {
            worker.terminate();
            URL.revokeObjectURL(url);
        };
    } catch (error) {
        const id = window.setInterval(onTick, intervalMs);
        return () => window.clearInterval(id);
    }
}

function getAspectRatioClass(ratio: AspectRatioType) {
    switch (ratio) {
        case '9:16': return 'aspect-[9/16]';
        case '1:1': return 'aspect-square';
        case '16:9': default: return 'aspect-video';
    }
}

export function VideoCanvas({
    videoRef,
    canvasStreamRef,
    settings,
    microphoneLevelRef,
    onAvatarMouthPositionChange,
    isRecording,
    isRecordingPaused,
    countdown,
    screenShareStream,
    onScreenFrame,
    isProUser,
}: VideoCanvasProps) {
    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const screenShareStreamRef = useRef<MediaStream | null>(screenShareStream);
    const segmenterRef = useRef<ImageSegmenter | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarkerLike | null>(null);
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const avatarImageRef = useRef<HTMLImageElement | null>(null);
    const settingsRef = useRef(settings);
    const isRecordingRef = useRef(isRecording);
    const screenFrameStartRef = useRef<number | null>(null);
    const zoomRef = useRef<ZoomState>({ ...DEFAULT_ZOOM });

    const prevMaskRef = useRef<Float32Array | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const softMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const personCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const hologramPersonRef = useRef<HTMLCanvasElement | null>(null);
    const hologramRendererRef = useRef<HologramRenderer | null>(null);
    const airDrawingRef = useRef<AirDrawingEngine | null>(null);
    const airLayerRef = useRef<HTMLCanvasElement | null>(null);
    const isPausedRef = useRef(isRecordingPaused);
    const recordingClockRef = useRef({ startedAt: 0, pausedTotal: 0, pausedAt: null as number | null });
    const [airStatus, setAirStatus] = useState<string | null>(null);
    const [editing, setEditing] = useState<(TextItemInfo & { left: number; top: number; draft: string }) | null>(null);

    const getBuffer = (ref: React.MutableRefObject<HTMLCanvasElement | null>, width: number, height: number) => {
        if (!ref.current) ref.current = document.createElement('canvas');
        if (ref.current.width !== width || ref.current.height !== height) {
            ref.current.width = width;
            ref.current.height = height;
        }
        return ref.current;
    };

    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    useEffect(() => {
        isPausedRef.current = isRecordingPaused;
        const clock = recordingClockRef.current;
        const now = performance.now();
        if (isRecordingPaused && clock.pausedAt === null) clock.pausedAt = now;
        if (!isRecordingPaused && clock.pausedAt !== null) {
            clock.pausedTotal += now - clock.pausedAt;
            clock.pausedAt = null;
        }
    }, [isRecordingPaused]);
    useEffect(() => {
        if (!isRecording) return;
        recordingClockRef.current = { startedAt: performance.now(), pausedTotal: 0, pausedAt: null };
        annotationTimeline.begin();
    }, [isRecording]);

    useEffect(() => {
        avatarImageRef.current = null;
        if (!settings.cameraAvatarImageUrl) return;
        const image = new Image();
        image.onload = () => { avatarImageRef.current = image; };
        image.src = settings.cameraAvatarImageUrl;
        return () => { avatarImageRef.current = null; };
    }, [settings.cameraAvatarImageUrl]);

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

    useEffect(() => {
        screenShareStreamRef.current = screenShareStream;
        screenFrameStartRef.current = null;
        zoomRef.current = { ...DEFAULT_ZOOM };
        const screenVideo = screenVideoRef.current;
        if (!screenVideo) return;
        if (!screenShareStream) {
            screenVideo.pause();
            screenVideo.srcObject = null;
            return;
        }
        screenVideo.srcObject = screenShareStream;
        screenVideo.play().catch((error) => console.warn('Screen share preview could not start:', error));
    }, [screenShareStream]);

    useEffect(() => {
        const video = screenVideoRef.current;
        if (!screenShareStream || !video || !onScreenFrame) return;
        let frameCallbackId = 0;
        let cancelled = false;
        const reportFrame = () => {
            if (cancelled) return;
            onScreenFrame(video);
            frameCallbackId = video.requestVideoFrameCallback(reportFrame);
        };
        if (typeof video.requestVideoFrameCallback === 'function') {
            frameCallbackId = video.requestVideoFrameCallback(reportFrame);
        }
        return () => {
            cancelled = true;
            if (frameCallbackId && typeof video.cancelVideoFrameCallback === 'function') {
                video.cancelVideoFrameCallback(frameCallbackId);
            }
        };
    }, [screenShareStream, onScreenFrame]);

    useEffect(() => {
        if (!SEGMENTATION_MODES.includes(settings.backgroundMode) && !settings.hologramEnabled) {
            segmenterRef.current?.close();
            segmenterRef.current = null;
            prevMaskRef.current = null;
            return;
        }
        let cancelled = false;

        const createSegmenter = async (delegate: 'GPU' | 'CPU') => {
            const vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
            return ImageSegmenter.createFromOptions(vision, {
                baseOptions: { modelAssetPath: MODEL_ASSET_URL, delegate },
                runningMode: 'VIDEO',
                outputCategoryMask: false,
                outputConfidenceMasks: true,
            });
        };

        const init = async () => {
            try {
                const segmenter = await createSegmenter('GPU');
                if (cancelled) { segmenter.close(); return; }
                segmenterRef.current = segmenter;
            } catch (err) {
                try {
                    const segmenter = await createSegmenter('CPU');
                    if (cancelled) { segmenter.close(); return; }
                    segmenterRef.current = segmenter;
                } catch (err2) {
                    console.error('CPU segmenter fallback also failed:', err2);
                }
            }
        };

        void init();
        return () => {
            cancelled = true;
            const segmenter = segmenterRef.current;
            segmenterRef.current = null;
            segmenter?.close();
        };
    }, [settings.backgroundMode, settings.hologramEnabled]);

    useEffect(() => {
        if (!settings.hologramEnabled) return;
        hologramRendererRef.current = createHologramRenderer();
        return () => {
            hologramRendererRef.current?.dispose();
            hologramRendererRef.current = null;
        };
    }, [settings.hologramEnabled]);

    useEffect(() => {
        if (settings.cameraArtEffect !== 'avatar') {
            faceLandmarkerRef.current?.close();
            faceLandmarkerRef.current = null;
            return;
        }
        let cancelled = false;

        const initialize = async () => {
            try {
                const visionModule = await import('@mediapipe/tasks-vision');
                const visionApi = visionModule as unknown as {
                    FaceLandmarker: {
                        createFromOptions: (resolver: unknown, options: Record<string, unknown>) => Promise<FaceLandmarkerLike>;
                    };
                };
                const resolver = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
                const landmarker = await visionApi.FaceLandmarker.createFromOptions(resolver, {
                    baseOptions: { modelAssetPath: FACE_MODEL_ASSET_URL, delegate: 'GPU' },
                    runningMode: 'VIDEO',
                    numFaces: 1,
                    outputFaceBlendshapes: false,
                });
                if (cancelled) landmarker.close();
                else faceLandmarkerRef.current = landmarker;
            } catch (error) {
                console.error('Face Landmarker could not be initialized:', error);
            }
        };

        void initialize();
        return () => {
            cancelled = true;
            const landmarker = faceLandmarkerRef.current;
            faceLandmarkerRef.current = null;
            landmarker?.close();
        };
    }, [settings.cameraArtEffect]);

    useEffect(() => {
        if (!settings.airDrawingEnabled) return;
        const engine = new AirDrawingEngine({
            recognize: (request, onStatus) => getHandwritingService().recognize(request, onStatus),
            onStatus: setAirStatus,
        });
        airDrawingRef.current = engine;
        engine.load().catch((error) => console.error('Hand Landmarker initialization failed:', error));
        return () => {
            if (airDrawingRef.current === engine) airDrawingRef.current = null;
            engine.dispose();
            setAirStatus(null);
            setEditing(null);
        };
    }, [settings.airDrawingEnabled]);

    const getAirOptions = (): AirDrawingOptions => {
        const s = settingsRef.current;
        return {
            color: s.airDrawingColor,
            size: s.airDrawingSize,
            glow: s.airDrawingGlow,
            fade: s.airDrawingFade,
            performanceMode: s.airDrawingPerformanceMode,
            tool: s.airDrawingTool,
            writeMode: s.airWriteMode,
            writeFont: s.airWriteFont,
            writeColor: s.airWriteColor,
            language: s.airWriteLanguage,
            snapShapes: s.airDrawingSnapShapes,
            rainbow: s.airDrawingRainbow,
            zoomEnabled: s.airZoomEnabled,
        };
    };

    const isScreenFrameReady = () => {
        const screen = screenVideoRef.current;
        return Boolean(
            screenShareStreamRef.current
            && screen
            && screen.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            && screen.videoWidth > 0
        );
    };

    const getAirSpace = (canvas: HTMLCanvasElement): { space: AnnotationSpace; rect: TargetRect } => {
        const screen = screenVideoRef.current;
        if (isScreenFrameReady() && screen) {
            const frameStyle = settingsRef.current.screenFrameStyle ?? 'browser';
            if (frameStyle !== 'off') {
                const content = computeScreenFrameLayout(canvas.width, canvas.height, screen.videoWidth, screen.videoHeight, frameStyle).content;
                return { space: 'screen', rect: { x: content.x, y: content.y, width: content.w, height: content.h } };
            }
            return { space: 'screen', rect: getScreenRect(canvas.width, canvas.height, screen.videoWidth, screen.videoHeight) };
        }
        return { space: 'camera', rect: { x: 0, y: 0, width: canvas.width, height: canvas.height } };
    };

    const drawAirStrokes = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const engine = airDrawingRef.current;
        if (!engine || !settingsRef.current.airDrawingEnabled) return;
        const layer = getBuffer(airLayerRef, canvas.width, canvas.height);
        const opts = getAirOptions();
        const now = clockMs();
        const { space, rect } = getAirSpace(canvas);
        engine.render(ctx, layer, now, opts, !isRecordingRef.current, space, rect);

        if (space === 'screen' && isRecordingRef.current && !isPausedRef.current) {
            const clock = recordingClockRef.current;
            annotationTimeline.capture(
                layer,
                (now - clock.startedAt - clock.pausedTotal) / 1000,
                engine.signature(now, opts, space),
                engine.hasContent(space, opts)
            );
        }
    };

    const updateZoom = (engine: AirDrawingEngine | null, enabled: boolean, maxScale: number) => {
        const z = zoomRef.current;
        const input = enabled && engine ? engine.getZoomInput() : null;
        if (input) {
            if (input.active) {
                const k = Math.min(1, Math.max(0, (input.ratio - 0.3) / 0.9));
                const target = 1 + k * (maxScale - 1);
                z.scale += (target - z.scale) * 0.2;
                z.x += (input.x - z.x) * 0.2;
                z.y += (input.y - z.y) * 0.2;
            }
        } else {
            z.scale += (1 - z.scale) * 0.1;
        }
    };

    const updateAirDrawing = (video: HTMLVideoElement) => {
        const engine = airDrawingRef.current;
        const current = settingsRef.current;
        if (!engine || !current.airDrawingEnabled || video.videoWidth === 0) {
            updateZoom(null, false, 1);
            return;
        }
        const canvas = visibleCanvasRef.current;
        if (!canvas) return;
        const { space } = getAirSpace(canvas);

        engine.update(video, clockMs(), getAirOptions(), {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            crop: space === 'screen'
                ? { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }
                : getFrameCrop(video.videoWidth, video.videoHeight, current.aspectRatio),
            mirror: current.cameraFacing !== 'environment',
        }, space);

        updateZoom(engine, Boolean(current.airZoomEnabled), current.airZoomScale ?? DEFAULT_MAX_ZOOM);
    };

    const buildSmoothedMaskCanvas = (confidenceMask: Float32Array, width: number, height: number) => {
        const prev = prevMaskRef.current;
        const usePrev = prev && prev.length === confidenceMask.length;
        const smoothed = new Float32Array(confidenceMask.length);
        const smoothingFactor = 0.6;

        for (let i = 0; i < confidenceMask.length; i++) {
            const current = confidenceMask[i];
            const previous = usePrev ? prev![i] : current;
            smoothed[i] = previous * smoothingFactor + current * (1 - smoothingFactor);
        }
        prevMaskRef.current = smoothed;

        const maskCanvas = getBuffer(maskCanvasRef, width, height);
        const maskCtx = maskCanvas.getContext('2d')!;
        const imageData = maskCtx.createImageData(width, height);
        for (let i = 0; i < smoothed.length; i++) {
            imageData.data[i * 4 + 3] = Math.round(smoothed[i] * 255);
        }
        maskCtx.putImageData(imageData, 0, 0);

        const softened = getBuffer(softMaskCanvasRef, width, height);
        const softCtx = softened.getContext('2d')!;
        softCtx.clearRect(0, 0, width, height);
        softCtx.filter = 'blur(1.5px)';
        softCtx.drawImage(maskCanvas, 0, 0);
        softCtx.filter = 'none';

        return softened;
    };

    const finishFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, withEffect: boolean) => {
        if (withEffect) {
            applyArtisticEffect(canvas, settingsRef.current.cameraArtEffect as CameraArtEffect);
        }
        drawAirStrokes(ctx, canvas);

        if (isRecordingRef.current && !isProUser) {
            drawFreeTierWatermark(ctx, canvas.width, canvas.height);
        }
    };

    const renderFrame = (result?: ImageSegmenterResult) => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const current = settingsRef.current;
        const filter = getVideoFilter(current);
        const mirror = current.cameraFacing !== 'environment';
        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;
        const { width: outW, height: outH } = getRecordingDimensions(current.aspectRatio);
        if (canvas.width !== outW || canvas.height !== outH) {
            canvas.width = outW;
            canvas.height = outH;
        }
        const { width, height } = canvas;

        if (isScreenFrameReady()) {
            if (screenFrameStartRef.current === null) screenFrameStartRef.current = clockMs();
            drawScreenShareFrame(
                ctx,
                canvas,
                screenVideoRef.current!,
                video,
                filter,
                mirror,
                {
                    style: current.screenFrameStyle ?? 'browser',
                    background: current.screenFrameBackground ?? 'aurora',
                    label: current.screenFrameLabel || 'Screen share',
                    progress: getFrameProgress(clockMs(), screenFrameStartRef.current),
                },
                current.screenShareShowCamera !== false,
                zoomRef.current,
                getAirSpace(canvas).rect
            );
            finishFrame(ctx, canvas, false);
            return;
        }

        const crop = getFrameCrop(vWidth, vHeight, current.aspectRatio);
        const mask = result?.confidenceMasks?.[0];

        if (!mask) {
            ctx.clearRect(0, 0, width, height);
            drawMirrored(ctx, video, crop, width, height, filter, mirror);
            finishFrame(ctx, canvas, true);
            return;
        }

        const maskFloat = mask.getAsFloat32Array();
        const maskWidth = mask.width;
        const maskHeight = mask.height;
        mask.close();

        const smoothedMask = buildSmoothedMaskCanvas(maskFloat, maskWidth, maskHeight);
        const maskCrop = getMaskCropRect(maskWidth, maskHeight, vWidth, vHeight, crop);

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        const mode = current.backgroundMode;
        const hologramActive = current.hologramEnabled && Boolean(hologramRendererRef.current);

        if (hologramActive) {
            if (mode === 'green') {
                ctx.fillStyle = '#00FF00';
                ctx.fillRect(0, 0, width, height);
            } else if (mode === 'blur') {
                drawMirrored(ctx, video, crop, width, height, 'blur(16px) brightness(0.45)', mirror);
            } else if (mode === 'image' && bgImageRef.current?.complete) {
                drawImageCover(ctx, bgImageRef.current, width, height);
            } else if (mode !== 'transparent') {
                ctx.fillStyle = '#0B0A10';
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = 0.15;
                drawMirrored(ctx, video, crop, width, height, 'none', mirror);
                ctx.globalAlpha = 1;
            }

            const holoScale = Math.min(1, 540 / Math.min(width, height));
            const pw = Math.max(2, Math.round(width * holoScale));
            const ph = Math.max(2, Math.round(height * holoScale));
            const person = getBuffer(hologramPersonRef, pw, ph);
            const personCtx = person.getContext('2d');
            if (personCtx) {
                personCtx.clearRect(0, 0, pw, ph);
                personCtx.save();
                if (mirror) {
                    personCtx.translate(pw, 0);
                    personCtx.scale(-1, 1);
                }
                personCtx.filter = filter;
                personCtx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, pw, ph);
                personCtx.filter = 'none';
                personCtx.globalCompositeOperation = 'destination-in';
                personCtx.drawImage(smoothedMask, maskCrop.sx, maskCrop.sy, maskCrop.sw, maskCrop.sh, 0, 0, pw, ph);
                personCtx.restore();
                const layer = hologramRendererRef.current!.render(person, {
                    color: current.hologramColor,
                    intensity: current.hologramIntensity / 100,
                    flicker: current.hologramFlicker / 100,
                    timeSeconds: performance.now() / 1000,
                    outputHeight: height,
                });
                ctx.drawImage(layer ?? person, 0, 0, width, height);
            }
        } else if (mode === 'green' || mode === 'blur' || mode === 'image') {
            if (mode === 'green') {
                ctx.fillStyle = '#00FF00';
                ctx.fillRect(0, 0, width, height);
            } else if (mode === 'blur') {
                drawMirrored(ctx, video, crop, width, height, 'blur(16px)', mirror);
            } else if (bgImageRef.current?.complete) {
                drawImageCover(ctx, bgImageRef.current, width, height);
            } else {
                ctx.fillStyle = '#0B0A10';
                ctx.fillRect(0, 0, width, height);
            }

            const person = getBuffer(personCanvasRef, width, height);
            const personCtx = person.getContext('2d', { willReadFrequently: true });
            if (personCtx) {
                personCtx.clearRect(0, 0, width, height);
                personCtx.save();
                if (mirror) {
                    personCtx.translate(width, 0);
                    personCtx.scale(-1, 1);
                }
                personCtx.filter = filter;
                personCtx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
                personCtx.filter = 'none';
                personCtx.globalCompositeOperation = 'destination-in';
                personCtx.drawImage(smoothedMask, maskCrop.sx, maskCrop.sy, maskCrop.sw, maskCrop.sh, 0, 0, width, height);
                personCtx.restore();
                ctx.drawImage(person, 0, 0);
            }
        } else if (mode === 'transparent') {
            ctx.save();
            if (mirror) {
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
            }
            ctx.filter = filter;
            ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(smoothedMask, maskCrop.sx, maskCrop.sy, maskCrop.sw, maskCrop.sh, 0, 0, width, height);
            ctx.restore();
        } else {
            drawMirrored(ctx, video, crop, width, height, filter, mirror);
        }

        ctx.restore();
        finishFrame(ctx, canvas, true);
    };

    useEffect(() => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        let rafId = 0;
        let stopTicker: (() => void) | null = null;
        let cancelled = false;

        const processFrame = () => {
            const current = settingsRef.current;
            const { width, height } = getRecordingDimensions(current.aspectRatio);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }

            if (isScreenFrameReady()) {
                if (video.readyState >= video.HAVE_CURRENT_DATA) updateAirDrawing(video);
                renderFrame();
                return;
            }

            if (video.readyState < video.HAVE_CURRENT_DATA) return;
            updateAirDrawing(video);

            if (current.cameraArtEffect === 'photo-avatar') {
                const context = canvas.getContext('2d');
                if (!context) return;
                drawPhotoAvatar(
                    context,
                    canvas.width,
                    canvas.height,
                    avatarImageRef.current,
                    microphoneLevelRef.current,
                    current.cameraAvatarMouthX,
                    current.cameraAvatarMouthY,
                    current.cameraAvatarMouthWidth
                );
                drawAirStrokes(context, canvas);
                if (isRecordingRef.current && !isProUser) drawFreeTierWatermark(context, canvas.width, canvas.height);
            } else if (current.cameraArtEffect === 'avatar') {
                const landmarks = faceLandmarkerRef.current?.detectForVideo(video, performance.now()).faceLandmarks?.[0];
                const context = canvas.getContext('2d');
                if (!context) return;
                drawTrackedAvatar(context, canvas.width, canvas.height, landmarks);
                drawAirStrokes(context, canvas);
                if (isRecordingRef.current && !isProUser) drawFreeTierWatermark(context, canvas.width, canvas.height);
            } else if (segmenterRef.current) {
                renderFrame(segmenterRef.current.segmentForVideo(video, performance.now()));
            } else {
                renderFrame();
            }
        };
        const TARGET_FPS = Math.min(RECORDING_FRAME_RATE, 30);
        const MIN_FRAME_GAP_MS = 1000 / TARGET_FPS - 2;
        let lastFrameAt = 0;
        const tick = () => {
            if (cancelled) return;
            const now = performance.now();
            if (now - lastFrameAt >= MIN_FRAME_GAP_MS) {
                lastFrameAt = now;
                try {
                    processFrame();
                } catch (error) {
                    console.error('Frame render failed:', error);
                }
            }
            if (!cancelled && !stopTicker) rafId = requestAnimationFrame(tick);
        };

        const syncLoop = () => {
            cancelAnimationFrame(rafId);
            stopTicker?.();
            stopTicker = null;

            const needsBackgroundLoop = isRecordingRef.current || Boolean(screenShareStreamRef.current);
            if (document.hidden && needsBackgroundLoop) {
                stopTicker = createBackgroundTicker(tick, TARGET_FPS);
            } else {
                rafId = requestAnimationFrame(tick);
            }
        };

        document.addEventListener('visibilitychange', syncLoop);
        syncLoop();

        if (canvas.captureStream) {
            canvasStreamRef.current = canvas.captureStream(TARGET_FPS);
        }

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            stopTicker?.();
            stopTicker = null;
            document.removeEventListener('visibilitychange', syncLoop);
        };
    }, [videoRef, canvasStreamRef, microphoneLevelRef, isProUser]);

    const handleCanvasTap = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const engine = airDrawingRef.current;
        if (!engine || !settingsRef.current.airDrawingEnabled) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const fx = (event.clientX - bounds.left) / bounds.width;
        const fy = (event.clientY - bounds.top) / bounds.height;
        const hit = engine.hitTest(fx, fy);
        setEditing(hit ? { ...hit, left: fx, top: fy, draft: hit.text } : null);
    };

    const applyEdit = (action: (engine: AirDrawingEngine, id: number) => void) => {
        const engine = airDrawingRef.current;
        if (engine && editing) action(engine, editing.id);
        setEditing(null);
    };

    const isPhotoAvatarEditable = settings.cameraArtEffect === 'photo-avatar' && Boolean(settings.cameraAvatarImageUrl);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B0A10] via-[#14121F] to-[#1A162B] p-4 sm:p-8">
            {countdown !== null && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0B0A10]/85 backdrop-blur-xl">
                    <span className="animate-bounce text-8xl font-black text-[#8B5CF6] font-[family-name:var(--font-display)] drop-shadow-[0_0_40px_rgba(139,92,246,0.6)]">{countdown}</span>
                </div>
            )}

            <video ref={videoRef} autoPlay playsInline muted aria-hidden="true" className={OFFSCREEN_VIDEO_CLASS} />
            <video ref={screenVideoRef} autoPlay playsInline muted aria-hidden="true" className={OFFSCREEN_VIDEO_CLASS} />

            {/* Futuristic Holographic Stage Wrapper */}
            <div
                style={{ aspectRatio: settings.aspectRatio.replace(':', ' / ') }}
                onPointerDown={(event) => {
                    if (!isPhotoAvatarEditable) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    onAvatarMouthPositionChange(
                        Math.max(0.15, Math.min(0.85, (event.clientX - rect.left) / rect.width)),
                        Math.max(0.35, Math.min(0.9, (event.clientY - rect.top) / rect.height))
                    );
                }}
                className={`relative h-full max-h-full max-w-full shrink-0 overflow-hidden rounded-[2.5rem] border border-white/20 bg-[#0B0A10] shadow-[0_25px_70px_-15px_rgba(106,76,255,0.25)] ring-1 ring-white/10 transition-all duration-300 ${getAspectRatioClass(settings.aspectRatio)} ${isPhotoAvatarEditable ? 'cursor-crosshair' : ''}`}
            >
                <canvas
                    ref={visibleCanvasRef}
                    onClick={handleCanvasTap}
                    className={`h-full w-full object-cover ${settings.airDrawingEnabled ? 'cursor-pointer' : ''}`}
                />

                {airStatus && (
                    <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-30 max-w-[90%] -translate-x-1/2 rounded-full border border-white/15 bg-[#14121F]/90 px-4 py-2 text-center text-xs font-semibold text-white shadow-xl backdrop-blur-xl">
                        {airStatus}
                    </div>
                )}

                {editing && (
                    <form
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={(event) => {
                            event.preventDefault();
                            applyEdit((engine, id) => engine.setText(id, editing.draft));
                        }}
                        className="absolute z-40 w-64 -translate-x-1/2 space-y-2.5 rounded-3xl border border-white/15 bg-[#14121F]/95 p-4 shadow-2xl text-white backdrop-blur-2xl"
                        style={{ left: `${Math.min(80, Math.max(20, editing.left * 100))}%`, top: `${Math.min(75, editing.top * 100 + 4)}%` }}
                    >
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-white/70" htmlFor="air-text-edit">Correct text</label>
                        <input
                            id="air-text-edit"
                            autoFocus
                            value={editing.draft}
                            onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
                            className="w-full rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8B5CF6] focus:bg-white/20"
                        />
                        <div className="flex gap-2 text-xs font-semibold">
                            <button type="submit" className="flex-1 rounded-full bg-[#8B5CF6] px-3 py-2 text-white shadow-lg shadow-purple-500/30 hover:bg-[#7c4dff] transition">Save</button>
                            {editing.status === 'done' && (
                                <button
                                    type="button"
                                    onClick={() => applyEdit((engine, id) => engine.setShowOriginal(id, !editing.showOriginal))}
                                    className="flex-1 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white hover:bg-white/20 transition">
                                    {editing.showOriginal ? 'Use typed' : 'My writing'}
                                </button>
                            )}
                            <button type="button" aria-label="Delete word" onClick={() => applyEdit((engine, id) => engine.removeItem(id))} className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-2 text-red-300 hover:bg-red-500 hover:text-white transition">Delete</button>
                        </div>
                    </form>
                )}

                {isPhotoAvatarEditable && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${settings.cameraAvatarMouthX * 100}%`, top: `${settings.cameraAvatarMouthY * 100}%` }}
                    >
                        <span className="block h-6 w-6 rounded-full border-2 border-white bg-[#8B5CF6]/50 shadow-[0_0_20px_rgba(139,92,246,.9)] animate-pulse" />
                        <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-white" />
                        <span className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-white" />
                    </div>
                )}

                {!screenShareStream && <TeleprompterOverlay scriptText={settings.scriptText} />}

                {/* Futuristic Recording Badge / Telemetry Status */}
                {isRecording && (
                    <div className={`absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-xl sm:left-5 sm:top-5 border border-white/15 ${isRecordingPaused ? 'bg-amber-500/90' : isProUser ? 'bg-[#8B5CF6]/90 shadow-[0_4px_25px_rgba(139,92,246,0.5)]' : 'bg-[#EC4899]/90 shadow-[0_4px_25px_rgba(236,72,153,0.5)]'}`}>
                        <span className={`h-2.5 w-2.5 rounded-full bg-white ${isRecordingPaused ? '' : 'animate-ping'}`} />
                        {isRecordingPaused ? 'PAUSED' : 'RECORDING'} · {isProUser ? 'CLIPRAME PRO' : 'FREE'}
                    </div>
                )}
            </div>
        </div>
    );
}