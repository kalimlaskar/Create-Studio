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
}

type FaceLandmarkerLike = {
    detectForVideo: (video: HTMLVideoElement, timestampMs: number) => { faceLandmarks?: FaceLandmarkPoint[][] };
    close: () => void;
};
type FrameCrop = ReturnType<typeof getFrameCrop>;

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
const FACE_MODEL_ASSET_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Wrapped so the render-purity lint rule doesn't flag per-frame clock reads inside the render loop helpers.
const clockMs = () => performance.now();

const SEGMENTATION_MODES = ['green', 'blur', 'image', 'transparent'];

// display:none can make browsers suspend video decoding, so hidden <video>
// sources used for canvas capture are kept rendered but invisible instead.
const OFFSCREEN_VIDEO_CLASS =
    'pointer-events-none fixed left-0 top-0 z-[-1] h-px w-px opacity-[0.01]';

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

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

/** Draws a source horizontally mirrored, cropped, with an optional CSS filter. Leaves ctx state untouched. */
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

/**
 * Crop region of the video, scaled into mask pixel space. The mask is usually a
 * different resolution than the raw video frame, so it must be scaled
 * proportionally or the two will misalign.
 */
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

/**
 * Screen share fitted into the frame, with a floating camera card (captured into the canvas, not a DOM overlay).
 * When `frame` is provided and its style is not 'off', the screen is drawn inside a styled window
 * on a gradient background instead of a plain letterboxed rectangle.
 */
function drawScreenShareFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    screen: HTMLVideoElement,
    camera: HTMLVideoElement,
    cameraFilter: string,
    mirror = true,
    frame?: ScreenFrameOptions
) {
    const { width, height } = canvas;

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, width, height);

    let framed: ReturnType<typeof drawScreenFrame> = null;
    if (frame && frame.style !== 'off') {
        try {
            framed = drawScreenFrame(ctx, screen, screen.videoWidth, screen.videoHeight, width, height, frame);
        } catch (error) {
            // Never let a styling problem blank the recording: fall back to the plain screen layout.
            console.error('Screen frame failed, drawing the plain layout instead:', error);
        }
    }

    if (!framed) {
        const scale = Math.min(width / screen.videoWidth, height / screen.videoHeight);
        const sw = screen.videoWidth * scale;
        const sh = screen.videoHeight * scale;
        ctx.drawImage(screen, (width - sw) / 2, (height - sh) / 2, sw, sh);
    }

    if (camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && camera.videoWidth > 0) {
        const cardWidth = Math.round(width * 0.25);
        const cardHeight = Math.round(cardWidth * 0.66);
        const inset = Math.max(18, Math.round(width * 0.018));
        const cardX = width - cardWidth - inset;
        const cardY = height - cardHeight - inset;
        const radius = Math.max(14, Math.round(cardWidth * 0.06));
        const crop = getFrameCrop(camera.videoWidth, camera.videoHeight, '16:9');

        // Camera image (clipped, mirrored, shadowed)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = Math.max(12, Math.round(width * 0.012));
        ctx.shadowOffsetY = Math.max(4, Math.round(width * 0.004));
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

        // Border
        ctx.lineWidth = Math.max(3, width * 0.002);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, radius);
        ctx.stroke();

        // "YOU" label
        ctx.font = `600 ${Math.max(12, Math.round(width * 0.012))}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const pad = Math.max(8, Math.round(cardWidth * 0.035));
        const labelHeight = Math.max(22, Math.round(cardHeight * 0.15));
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.beginPath();
        ctx.roundRect(cardX + pad, cardY + pad, Math.max(48, cardWidth * 0.2), labelHeight, labelHeight / 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('YOU', cardX + pad * 2, cardY + pad + labelHeight / 2);
    }

    ctx.restore();
}

/**
 * Drives a callback at a fixed rate from a Worker. Worker timers are not
 * throttled in background tabs the way main-thread timers and rAF are.
 * Falls back to a main-thread interval if a Worker can't be created (e.g. strict CSP).
 */
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
        console.warn('Worker ticker unavailable, using main-thread interval:', error);
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

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

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
    // Time (performance.now) at which the framed screen layout first rendered; drives the entry animation.
    const screenFrameStartRef = useRef<number | null>(null);

    // Reused offscreen buffers (avoid allocating canvases every frame)
    const prevMaskRef = useRef<Float32Array | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const softMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const personCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const hologramPersonRef = useRef<HTMLCanvasElement | null>(null);
    const hologramRendererRef = useRef<HologramRenderer | null>(null);
    const airDrawingRef = useRef<AirDrawingEngine | null>(null);
    const airLayerRef = useRef<HTMLCanvasElement | null>(null);
    const isPausedRef = useRef(isRecordingPaused);
    // Recorded (un-paused) time base, used to timestamp annotation snapshots for screen-share exports.
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

    /* ----------------------------- ref syncing ----------------------------- */

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

    /* ------------------------------ assets --------------------------------- */

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

    /* --------------------------- screen share ------------------------------ */

    useEffect(() => {
        screenShareStreamRef.current = screenShareStream;
        // A new share (or stopping one) restarts the frame's entry animation.
        screenFrameStartRef.current = null;
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

    /* ----------------------------- ML models ------------------------------- */

    // ImageSegmenter: GPU -> CPU fallback, pinned model/fileset versions.
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
                console.error('GPU segmenter init failed, falling back to CPU:', err);
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
            // Null the ref so the render loop never calls a closed segmenter.
            const segmenter = segmenterRef.current;
            segmenterRef.current = null;
            segmenter?.close();
        };
    }, [settings.backgroundMode, settings.hologramEnabled]);

    // The WebGL hologram pass only exists while the effect is on.
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

    // Hand tracking only exists while Air Drawing is on; turning it off drops the strokes.
    useEffect(() => {
        if (!settings.airDrawingEnabled) return;
        const engine = new AirDrawingEngine({
            recognize: (request, onStatus) => getHandwritingService().recognize(request, onStatus),
            onStatus: setAirStatus,
        });
        airDrawingRef.current = engine;
        engine.load().catch((error) => console.error('Hand Landmarker could not be initialized:', error));
        return () => {
            if (airDrawingRef.current === engine) airDrawingRef.current = null;
            engine.dispose();
            setAirStatus(null);
            setEditing(null);
        };
    }, [settings.airDrawingEnabled]);

    /* ------------------------------ rendering ------------------------------ */

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
        };
    };

    // Screen-share annotations are normalised to the shared screen's rectangle so they stay
    // pinned to the screen content; camera annotations use the whole frame.
    // When the screen is drawn inside a styled window, that rectangle is the window's content area.
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

        // Screen-share recordings are composed from the raw tracks, so log the layer separately.
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

    const updateAirDrawing = (video: HTMLVideoElement) => {
        const engine = airDrawingRef.current;
        const current = settingsRef.current;
        if (!engine || !current.airDrawingEnabled || video.videoWidth === 0) return;
        const canvas = visibleCanvasRef.current;
        if (!canvas) return;
        const { space } = getAirSpace(canvas);
        engine.update(video, clockMs(), getAirOptions(), {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            // On a shared screen the whole camera view maps onto the screen, not the cropped output frame.
            crop: space === 'screen'
                ? { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }
                : getFrameCrop(video.videoWidth, video.videoHeight, current.aspectRatio),
            mirror: current.cameraFacing !== 'environment',
        }, space);
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

    /** Common end-of-frame work: artistic effect (camera only) + free-tier watermark. */
    const finishFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, withEffect: boolean) => {
        if (withEffect) {
            applyArtisticEffect(canvas, settingsRef.current.cameraArtEffect as CameraArtEffect);
        }
        drawAirStrokes(ctx, canvas);
        if (isRecordingRef.current) drawFreeTierWatermark(ctx, canvas.width, canvas.height);
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

    const renderFrame = (result?: ImageSegmenterResult) => {
        const video = videoRef.current;
        const canvas = visibleCanvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
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

        // 1) Screen share layout (screen inside a styled window frame, camera card on top)
        if (isScreenFrameReady()) {
            if (screenFrameStartRef.current === null) screenFrameStartRef.current = clockMs();
            drawScreenShareFrame(ctx, canvas, screenVideoRef.current!, video, filter, mirror, {
                style: current.screenFrameStyle ?? 'browser',
                background: current.screenFrameBackground ?? 'aurora',
                label: current.screenFrameLabel || 'Screen share',
                progress: getFrameProgress(clockMs(), screenFrameStartRef.current),
            });
            finishFrame(ctx, canvas, false);
            return;
        }

        const crop = getFrameCrop(vWidth, vHeight, current.aspectRatio);
        const mask = result?.confidenceMasks?.[0];

        // 2) Plain camera (no segmentation result)
        if (!mask) {
            ctx.clearRect(0, 0, width, height);
            drawMirrored(ctx, video, crop, width, height, filter, mirror);
            finishFrame(ctx, canvas, true);
            return;
        }

        // 3) Camera with background segmentation
        const maskFloat = mask.getAsFloat32Array();
        const maskWidth = mask.width;
        const maskHeight = mask.height;
        mask.close(); // release GPU/WASM memory now that data is copied out

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
                ctx.fillStyle = '#02060d';
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = 0.15;
                drawMirrored(ctx, video, crop, width, height, 'none', mirror);
                ctx.globalAlpha = 1;
            }

            // The shader runs at reduced resolution; the glow is soft so it upscales cleanly.
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
            // Background layer
            if (mode === 'green') {
                ctx.fillStyle = '#00FF00';
                ctx.fillRect(0, 0, width, height);
            } else if (mode === 'blur') {
                drawMirrored(ctx, video, crop, width, height, 'blur(16px)', mirror);
            } else if (bgImageRef.current?.complete) {
                drawImageCover(ctx, bgImageRef.current, width, height);
            } else {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, width, height);
            }

            // Person layer: mirrored video, masked with the same transform/crop math
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

    /* ----------------------------- render loop ----------------------------- */

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
                if (isRecordingRef.current) drawFreeTierWatermark(context, canvas.width, canvas.height);
            } else if (current.cameraArtEffect === 'avatar') {
                const landmarks = faceLandmarkerRef.current?.detectForVideo(video, performance.now()).faceLandmarks?.[0];
                const context = canvas.getContext('2d');
                if (!context) return;
                drawTrackedAvatar(context, canvas.width, canvas.height, landmarks);
                drawAirStrokes(context, canvas);
                if (isRecordingRef.current) drawFreeTierWatermark(context, canvas.width, canvas.height);
            } else if (segmenterRef.current) {
                renderFrame(segmenterRef.current.segmentForVideo(video, performance.now()));
            } else {
                renderFrame();
            }
        };

        // One bad frame must never kill the loop, so errors are caught per tick.
        const tick = () => {
            if (cancelled) return;
            try {
                processFrame();
            } catch (error) {
                console.error('Frame render failed:', error);
            }
            // rAF drives visible tabs; while the Worker ticker is active it drives itself.
            if (!cancelled && !stopTicker) rafId = requestAnimationFrame(tick);
        };

        // rAF and main-thread timers are throttled/paused in hidden tabs, which freezes
        // the canvas (audio keeps going because it's a separate track). While the tab is
        // hidden and we are recording or sharing, drive the loop from a Worker instead.
        const syncLoop = () => {
            cancelAnimationFrame(rafId);
            stopTicker?.();
            stopTicker = null;

            const needsBackgroundLoop = isRecordingRef.current || Boolean(screenShareStreamRef.current);
            if (document.hidden && needsBackgroundLoop) {
                stopTicker = createBackgroundTicker(tick, RECORDING_FRAME_RATE);
            } else {
                rafId = requestAnimationFrame(tick);
            }
        };

        document.addEventListener('visibilitychange', syncLoop);
        syncLoop();

        if (canvas.captureStream) {
            canvasStreamRef.current = canvas.captureStream(RECORDING_FRAME_RATE);
        }

        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
            stopTicker?.();
            stopTicker = null;
            document.removeEventListener('visibilitychange', syncLoop);
        };
        // renderFrame and helpers only read refs, so the loop is created once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef, canvasStreamRef, microphoneLevelRef]);

    /* -------------------------------- JSX ---------------------------------- */

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
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-neutral-950 p-2 sm:p-4">
            {countdown !== null && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <span className="animate-pulse text-8xl font-black text-indigo-500">{countdown}</span>
                </div>
            )}

            {/* Camera + screen sources: rendered off-screen, never display:none */}
            <video ref={videoRef} autoPlay playsInline muted aria-hidden="true" className={OFFSCREEN_VIDEO_CLASS} />
            <video ref={screenVideoRef} autoPlay playsInline muted aria-hidden="true" className={OFFSCREEN_VIDEO_CLASS} />

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
                className={`relative h-full max-h-full max-w-full shrink-0 overflow-hidden rounded-2xl border-2 border-neutral-800 bg-black shadow-2xl transition-all duration-300 ${getAspectRatioClass(settings.aspectRatio)} ${isPhotoAvatarEditable ? 'cursor-crosshair' : ''}`}
            >
                <canvas
                    ref={visibleCanvasRef}
                    onClick={handleCanvasTap}
                    className={`h-full w-full object-cover ${settings.airDrawingEnabled ? 'cursor-pointer' : ''}`}
                />

                {airStatus && (
                    <div role="status" className="pointer-events-none absolute left-1/2 top-3 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1.5 text-center text-[11px] font-medium text-neutral-100 shadow-lg">
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
                        className="absolute z-40 w-56 -translate-x-1/2 space-y-2 rounded-xl border border-neutral-700 bg-neutral-900/95 p-2.5 shadow-2xl"
                        style={{ left: `${Math.min(80, Math.max(20, editing.left * 100))}%`, top: `${Math.min(75, editing.top * 100 + 4)}%` }}
                    >
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-400" htmlFor="air-text-edit">Correct text</label>
                        <input
                            id="air-text-edit"
                            autoFocus
                            value={editing.draft}
                            onChange={(event) => setEditing({ ...editing, draft: event.target.value })}
                            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-white outline-none focus:border-fuchsia-400"
                        />
                        <div className="flex gap-1.5 text-[11px]">
                            <button type="submit" className="flex-1 rounded-md bg-fuchsia-500 px-2 py-1.5 font-semibold text-white">Save</button>
                            {editing.status === 'done' && (
                                <button
                                    type="button"
                                    onClick={() => applyEdit((engine, id) => engine.setShowOriginal(id, !editing.showOriginal))}
                                    className="flex-1 rounded-md border border-neutral-600 px-2 py-1.5 text-neutral-200">
                                    {editing.showOriginal ? 'Use typed' : 'My writing'}
                                </button>
                            )}
                            <button type="button" aria-label="Delete word" onClick={() => applyEdit((engine, id) => engine.removeItem(id))} className="rounded-md border border-neutral-600 px-2 py-1.5 text-red-300">Delete</button>
                        </div>
                    </form>
                )}

                {isPhotoAvatarEditable && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${settings.cameraAvatarMouthX * 100}%`, top: `${settings.cameraAvatarMouthY * 100}%` }}
                    >
                        <span className="block h-5 w-5 rounded-full border-2 border-fuchsia-300 bg-fuchsia-500/35 shadow-[0_0_12px_rgba(217,70,239,.85)]" />
                        <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-white/90" />
                        <span className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-white/90" />
                    </div>
                )}

                {!screenShareStream && <TeleprompterOverlay scriptText={settings.scriptText} />}

                {isRecording && (
                    <div className={`absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-lg sm:left-4 sm:top-4 ${isRecordingPaused ? 'bg-amber-500/90' : 'bg-red-600/90'}`}>
                        <span className={`h-2 w-2 rounded-full bg-white ${isRecordingPaused ? '' : 'animate-pulse'}`} />
                        {isRecordingPaused ? 'PAUSED' : 'RECORDING'} · FREE PLAN
                    </div>
                )}
            </div>
        </div>
    );
}