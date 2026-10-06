import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const FADE_AFTER_MS = 3000;
const FADE_DURATION_MS = 700;
const CLEAR_HOLD_MS = 1000;
const UNDO_HOLD_MS = 250;
const HAND_LOST_MS = 300;
export const PERFORMANCE_DETECTION_INTERVAL_MS = 100;

export type HandGesture = 'point' | 'pinch' | 'palm' | 'fist' | 'none';

export interface AirDrawingOptions {
    color: string;
    size: number; // 1-40, relative to a 720px frame
    glow: number; // 0-100
    fade: boolean;
    performanceMode: boolean;
}

export interface FrameMapping {
    videoWidth: number;
    videoHeight: number;
    crop: { x: number; y: number; width: number; height: number };
    mirror: boolean;
}

interface Point { x: number; y: number }
interface Stroke {
    points: Point[];
    color: string;
    size: number;
    glow: number;
    endedAt: number | null;
}

type Landmark = { x: number; y: number };

/* ------------------------------ One Euro filter ----------------------------- */

class LowPass {
    private last: number | null = null;
    filter(value: number, alpha: number) {
        this.last = this.last === null ? value : alpha * value + (1 - alpha) * this.last;
        return this.last;
    }
    get value() { return this.last; }
}

class OneEuro {
    private x = new LowPass();
    private dx = new LowPass();
    private lastTime: number | null = null;
    constructor(private minCutoff: number, private beta: number, private dCutoff = 1) {}

    private static alpha(cutoff: number, dt: number) {
        const tau = 1 / (2 * Math.PI * cutoff);
        return 1 / (1 + tau / dt);
    }

    filter(value: number, timeMs: number) {
        if (this.lastTime === null) {
            this.lastTime = timeMs;
            this.x.filter(value, 1);
            this.dx.filter(0, 1);
            return value;
        }
        const dt = Math.max((timeMs - this.lastTime) / 1000, 1e-3);
        this.lastTime = timeMs;
        const prev = this.x.value ?? value;
        const speed = this.dx.filter((value - prev) / dt, OneEuro.alpha(this.dCutoff, dt));
        const cutoff = this.minCutoff + this.beta * Math.abs(speed);
        return this.x.filter(value, OneEuro.alpha(cutoff, dt));
    }
}

/* ------------------------------ Gesture logic ------------------------------- */

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/** Classifies one hand from the 21 MediaPipe landmarks; rotation-invariant (uses distances to the wrist). */
export function classifyGesture(lm: Landmark[]): HandGesture {
    const wrist = lm[0];
    const palmSize = dist(wrist, lm[9]) || 1;
    const extended = (tip: number, pip: number) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.12;

    const index = extended(8, 6);
    const middle = extended(12, 10);
    const ring = extended(16, 14);
    const pinky = extended(20, 18);
    const thumb = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.05 && dist(lm[4], lm[5]) > palmSize * 0.45;

    if (dist(lm[4], lm[8]) < palmSize * 0.28 && !(!index && !middle && !ring && !pinky)) return 'pinch';
    if (index && middle && ring && pinky && thumb) return 'palm';
    if (index && !middle && !ring && !pinky) return 'point';
    if (!index && !middle && !ring && !pinky) return 'fist';
    return 'none';
}

/* --------------------------------- Engine ----------------------------------- */

export class AirDrawingEngine {
    private landmarker: HandLandmarker | null = null;
    private disposed = false;
    private strokes: Stroke[] = [];
    private active: Stroke | null = null;
    private filterX = new OneEuro(1.2, 8);
    private filterY = new OneEuro(1.2, 8);

    private lastDetectAt = -Infinity;
    private lastVideoTime = -1;
    private lastTimestamp = 0;
    private lastHandAt = -Infinity;

    private candidate: HandGesture = 'none';
    private candidateSince = 0;
    private candidateCount = 0;
    private actionFired = false;
    private cursor: (Point & { gesture: HandGesture }) | null = null;
    private clearProgress = 0;

    async load() {
        const vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
        const create = (delegate: 'GPU' | 'CPU') => HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numHands: 1,
        });
        let landmarker: HandLandmarker;
        try {
            landmarker = await create('GPU');
        } catch (error) {
            console.warn('GPU hand tracking failed, falling back to CPU:', error);
            landmarker = await create('CPU');
        }
        if (this.disposed) { landmarker.close(); return; }
        this.landmarker = landmarker;
    }

    dispose() {
        this.disposed = true;
        this.landmarker?.close();
        this.landmarker = null;
        this.strokes = [];
        this.active = null;
    }

    /** Runs hand detection (throttled in performance mode) and updates strokes. */
    update(video: HTMLVideoElement, now: number, opts: AirDrawingOptions, map: FrameMapping) {
        if (!this.landmarker) return;
        const interval = opts.performanceMode ? PERFORMANCE_DETECTION_INTERVAL_MS : 0;
        if (now - this.lastDetectAt < interval) return;
        if (video.currentTime === this.lastVideoTime) return;
        this.lastVideoTime = video.currentTime;
        this.lastDetectAt = now;

        // MediaPipe requires strictly increasing timestamps.
        const timestamp = Math.max(now, this.lastTimestamp + 1);
        this.lastTimestamp = timestamp;

        const hand = this.landmarker.detectForVideo(video, timestamp).landmarks?.[0];
        if (!hand) {
            this.cursor = null;
            this.clearProgress = 0;
            this.candidate = 'none';
            this.candidateCount = 0;
            if (now - this.lastHandAt > HAND_LOST_MS) this.endStroke(now);
            return;
        }
        this.lastHandAt = now;

        const raw = classifyGesture(hand);
        if (raw !== this.candidate) {
            this.candidate = raw;
            this.candidateSince = now;
            this.candidateCount = 1;
            this.actionFired = false;
        } else {
            this.candidateCount++;
        }
        const stable = this.candidateCount >= 2;
        const held = now - this.candidateSince;

        // Map the fingertip into output-frame space (accounts for crop and mirroring).
        const tip = hand[8];
        let nx = (tip.x * map.videoWidth - map.crop.x) / map.crop.width;
        const ny = (tip.y * map.videoHeight - map.crop.y) / map.crop.height;
        if (map.mirror) nx = 1 - nx;

        this.clearProgress = raw === 'palm' ? Math.min(1, held / CLEAR_HOLD_MS) : 0;

        // Starting a stroke needs a stable pose; continuing only needs the raw pose,
        // so a closing hand doesn't add a stray tail.
        const drawing = raw === 'point' && (this.active !== null || stable);
        if (drawing) {
            if (!this.active) {
                this.filterX = new OneEuro(1.2, 8);
                this.filterY = new OneEuro(1.2, 8);
                this.active = { points: [], color: opts.color, size: opts.size, glow: opts.glow, endedAt: null };
                this.strokes.push(this.active);
            }
            const sx = this.filterX.filter(nx, now);
            const sy = this.filterY.filter(ny, now);
            this.active.points.push({ x: sx, y: sy });
            this.cursor = { x: sx, y: sy, gesture: raw };
            return;
        }

        this.endStroke(now);
        this.cursor = { x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)), gesture: raw };

        if (!stable || this.actionFired) return;
        if (raw === 'palm' && held >= CLEAR_HOLD_MS) {
            this.strokes = [];
            this.actionFired = true;
        } else if (raw === 'fist' && held >= UNDO_HOLD_MS) {
            this.strokes.pop();
            this.actionFired = true;
        }
    }

    private endStroke(now: number) {
        const stroke = this.active;
        if (!stroke) return;
        stroke.endedAt = now;
        this.active = null;
        if (stroke.points.length < 2) this.strokes = this.strokes.filter((s) => s !== stroke);
    }

    /** Draws all strokes on a transparent layer and composites it over ctx. */
    render(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, now: number, opts: AirDrawingOptions, showCursor: boolean) {
        const { width, height } = layer;
        const lctx = layer.getContext('2d');
        if (!lctx) return;
        lctx.clearRect(0, 0, width, height);

        if (opts.fade) {
            this.strokes = this.strokes.filter((s) => s.endedAt === null || now - s.endedAt < FADE_AFTER_MS);
        }

        const scale = Math.min(width, height) / 720;
        for (const stroke of this.strokes) {
            let alpha = 1;
            if (opts.fade && stroke.endedAt !== null) {
                const age = now - stroke.endedAt;
                alpha = Math.min(1, Math.max(0, (FADE_AFTER_MS - age) / FADE_DURATION_MS));
            }
            drawNeonStroke(lctx, stroke, width, height, scale, alpha);
        }

        if (showCursor && this.cursor) this.drawCursor(lctx, width, height, scale, opts.color);
        ctx.drawImage(layer, 0, 0);
    }

    private drawCursor(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number, color: string) {
        const c = this.cursor!;
        const x = c.x * width;
        const y = c.y * height;
        ctx.save();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = c.gesture === 'point' ? color : 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(x, y, 9 * scale, 0, Math.PI * 2);
        ctx.stroke();
        if (this.clearProgress > 0) {
            ctx.strokeStyle = '#ff5577';
            ctx.lineWidth = 4 * scale;
            ctx.beginPath();
            ctx.arc(x, y, 18 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.clearProgress);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function tracePath(ctx: CanvasRenderingContext2D, points: Point[], width: number, height: number) {
    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);
    // Quadratic curves through midpoints give a smooth line from the filtered samples.
    for (let i = 1; i < points.length - 1; i++) {
        const mx = ((points[i].x + points[i + 1].x) / 2) * width;
        const my = ((points[i].y + points[i + 1].y) / 2) * height;
        ctx.quadraticCurveTo(points[i].x * width, points[i].y * height, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
}

function drawNeonStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number,
    scale: number,
    alpha: number
) {
    const { points } = stroke;
    if (points.length < 2 || alpha <= 0) return;
    const lineWidth = Math.max(1, stroke.size * scale);
    const glowAmount = stroke.glow / 100;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (glowAmount > 0) {
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = lineWidth * (1 + 4 * glowAmount);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = lineWidth * 1.4;
        tracePath(ctx, points, width, height);
        ctx.stroke();
    }

    ctx.shadowBlur = glowAmount > 0 ? lineWidth * 0.8 * glowAmount : 0;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = lineWidth;
    tracePath(ctx, points, width, height);
    ctx.stroke();

    // Bright core makes the line read as a light source.
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * (0.35 + 0.5 * glowAmount);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, lineWidth * 0.35);
    tracePath(ctx, points, width, height);
    ctx.stroke();
    ctx.restore();
}
