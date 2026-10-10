import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { AirDrawingTool, AirWritingFont, AirWritingLanguage } from '@/types/studio';
import type { HandwritingRequest, HandwritingResult } from './handwriting';
import { recognizeShape } from './airShapes';

const WASM_FILESET_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const FADE_AFTER_MS = 3000;
const FADE_DURATION_MS = 700;
const CLEAR_HOLD_MS = 1000;
const UNDO_HOLD_MS = 250;
const HAND_LOST_MS = 300;
const WORD_GAP_MS = 800;
const POP_IN_MS = 380;
const ERASE_RADIUS = 0.05; // fraction of the smaller frame side
export const PERFORMANCE_DETECTION_INTERVAL_MS = 100;

export type HandGesture = 'point' | 'pinch' | 'palm' | 'fist' | 'peace' | 'none';
/** 'camera' strokes live in the full output frame; 'screen' strokes live in the shared-screen rectangle. */
export type AnnotationSpace = 'camera' | 'screen';

export const AIR_FONTS: { value: AirWritingFont; label: string; stack: string }[] = [
    { value: 'marker', label: 'Marker', stack: '"Marker Felt", "Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive' },
    { value: 'sans', label: 'Clean sans', stack: 'Inter, "Helvetica Neue", Arial, system-ui, sans-serif' },
    { value: 'rounded', label: 'Rounded', stack: '"Arial Rounded MT Bold", Nunito, "Helvetica Neue", sans-serif' },
    { value: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
    { value: 'mono', label: 'Mono', stack: 'ui-monospace, Menlo, Consolas, monospace' },
];

export interface AirDrawingOptions {
    tool: AirDrawingTool;
    color: string;
    size: number; // 2-30, relative to a 720px frame
    glow: number; // 0-100
    fade: boolean;
    performanceMode: boolean;
    writeMode: boolean;
    writeFont: AirWritingFont;
    writeColor: string;
    language: AirWritingLanguage;
    snapShapes?: boolean;
    rainbow?: boolean;
}

export interface FrameMapping {
    videoWidth: number;
    videoHeight: number;
    crop: { x: number; y: number; width: number; height: number };
    mirror: boolean;
}

/** Rectangle (output-canvas pixels) that annotation coordinates are normalised to. */
export interface TargetRect { x: number; y: number; width: number; height: number }

/** Where the shared screen sits inside the output frame (letterboxed, centred). */
export function getScreenRect(width: number, height: number, screenWidth: number, screenHeight: number): TargetRect {
    const scale = Math.min(width / screenWidth, height / screenHeight);
    const w = screenWidth * scale;
    const h = screenHeight * scale;
    return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

interface Point { x: number; y: number }
type StrokeTool = 'pen' | 'highlighter' | 'arrow' | 'ink';

interface Stroke {
    kind: 'stroke';
    id: number;
    space: AnnotationSpace;
    tool: StrokeTool;
    points: Point[];
    color: string;
    size: number;
    glow: number;
    endedAt: number | null;
    /** True once the stroke was snapped to a clean shape, so it is drawn with straight segments. */
    straight?: boolean;
}

interface TextItem {
    kind: 'text';
    id: number;
    space: AnnotationSpace;
    strokes: Stroke[];
    box: { x: number; y: number; w: number; h: number };
    text: string;
    status: 'pending' | 'done' | 'failed';
    showOriginal: boolean;
    manual: boolean;
    font: AirWritingFont;
    color: string;
    doneAt: number;
}

type Item = Stroke | TextItem;

export interface TextItemInfo {
    id: number;
    text: string;
    status: TextItem['status'];
    showOriginal: boolean;
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
    constructor(private minCutoff: number, private beta: number, private dCutoff = 1) { }

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

    // A curled index tip falls back toward the palm; a pinch keeps it out, which separates pinch from fist.
    const indexCurledIn = dist(lm[8], wrist) < dist(lm[6], wrist) * 0.85;
    if (dist(lm[4], lm[8]) < palmSize * 0.3 && !indexCurledIn) return 'pinch';
    if (index && middle && ring && pinky && thumb) return 'palm';
    if (index && middle && !ring && !pinky) return 'peace';
    if (index && !middle && !ring && !pinky) return 'point';
    if (!index && !middle && !ring && !pinky) return 'fist';
    return 'none';
}

/* --------------------------------- Engine ----------------------------------- */

export interface AirDrawingEngineOptions {
    recognize: (request: HandwritingRequest, onStatus?: (message: string) => void) => Promise<HandwritingResult>;
    onStatus?: (message: string | null) => void;
}

export class AirDrawingEngine {
    private landmarker: HandLandmarker | null = null;
    private disposed = false;
    private items: Item[] = [];
    private active: Stroke | null = null;
    private nextId = 1;
    private revision = 0;
    private filterX = new OneEuro(1.2, 8);
    private filterY = new OneEuro(1.2, 8);
    private snapShapes = false;
    private rainbow = false;

    private lastDetectAt = -Infinity;
    private lastVideoTime = -1;
    private lastTimestamp = 0;
    private lastHandAt = -Infinity;
    private lastInkEnd: number | null = null;

    private candidate: HandGesture = 'none';
    private candidateSince = 0;
    private candidateCount = 0;
    private actionFired = false;
    private cursor: (Point & { gesture: HandGesture; space: AnnotationSpace }) | null = null;
    private clearProgress = 0;
    private layout: { width: number; height: number; rect: TargetRect; space: AnnotationSpace } | null = null;

    constructor(private readonly hooks: AirDrawingEngineOptions) { }

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
        this.items = [];
        this.active = null;
    }

    /* ------------------------------ detection ------------------------------ */

    /** Runs hand detection (throttled in performance mode) and updates annotations. */
    update(video: HTMLVideoElement, now: number, opts: AirDrawingOptions, map: FrameMapping, space: AnnotationSpace) {
        this.snapShapes = Boolean(opts.snapShapes);
        this.rainbow = Boolean(opts.rainbow);
        this.maybeFinalizeWord(now, opts, space);
        if (!this.landmarker) return;
        const interval = opts.performanceMode ? PERFORMANCE_DETECTION_INTERVAL_MS : 0;
        if (now - this.lastDetectAt < interval) return;
        if (video.currentTime === this.lastVideoTime) return;
        this.lastVideoTime = video.currentTime;
        this.lastDetectAt = now;

        // MediaPipe requires strictly increasing timestamps.
        const timestamp = Math.max(now, this.lastTimestamp + 1);
        this.lastTimestamp = timestamp;

        const writing = opts.writeMode;
        const wantedTool: StrokeTool | 'laser' = writing ? 'ink' : opts.tool;
        if (this.active && this.active.tool !== wantedTool) this.endStroke(now);

        const hand = this.landmarker.detectForVideo(video, timestamp).landmarks?.[0];
        if (!hand) {
            if (this.cursor) this.revision++;
            this.cursor = null;
            this.clearProgress = 0;
            this.candidate = 'none';
            this.candidateCount = 0;
            if (now - this.lastHandAt > HAND_LOST_MS) {
                this.endStroke(now);
                this.resetFilters();
            }
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

        // Write mode tracks the pinch point (between thumb and index); other modes track the index tip.
        const tip = writing
            ? { x: (hand[4].x + hand[8].x) / 2, y: (hand[4].y + hand[8].y) / 2 }
            : hand[8];
        // Map into the target space (crop and mirroring included).
        let nx = (tip.x * map.videoWidth - map.crop.x) / map.crop.width;
        const ny = (tip.y * map.videoHeight - map.crop.y) / map.crop.height;
        if (map.mirror) nx = 1 - nx;

        this.clearProgress = raw === 'palm' ? Math.min(1, held / CLEAR_HOLD_MS) : 0;

        const isLaser = !writing && opts.tool === 'laser';
        const drawPose: HandGesture = writing ? 'pinch' : 'point';

        if (isLaser) {
            this.endStroke(now);
            if (raw === 'point') {
                const sx = this.filterX.filter(nx, now);
                const sy = this.filterY.filter(ny, now);
                this.cursor = { x: sx, y: sy, gesture: raw, space };
                this.revision++;
                return;
            }
            this.resetFilters();
        } else {
            // Starting a stroke needs a stable pose; continuing only needs the raw pose,
            // so a closing hand doesn't add a stray tail.
            const drawing = raw === drawPose && (this.active !== null || stable);
            if (drawing) {
                if (!this.active) {
                    this.resetFilters();
                    this.active = {
                        kind: 'stroke',
                        id: this.nextId++,
                        space,
                        tool: wantedTool as StrokeTool,
                        points: [],
                        color: writing
                            ? opts.writeColor
                            : this.rainbow ? `hsl(${(this.nextId * 47) % 360} 100% 60%)` : opts.color,
                        size: writing ? Math.max(4, opts.size * 0.6) : opts.size,
                        glow: writing ? 50 : opts.glow,
                        endedAt: null,
                    };
                    this.items.push(this.active);
                    this.lastInkEnd = null;
                }
                const sx = this.filterX.filter(nx, now);
                const sy = this.filterY.filter(ny, now);
                this.active.points.push({ x: sx, y: sy });
                this.cursor = { x: sx, y: sy, gesture: raw, space };
                this.revision++;
                return;
            }
            this.endStroke(now);
        }

        this.cursor = { x: Math.min(1, Math.max(0, nx)), y: Math.min(1, Math.max(0, ny)), gesture: raw, space };
        if (isLaser) this.revision++;

        // Two fingers up: erase anything the fingertip touches
        if (raw === 'peace' && stable && !writing) {
            this.eraseAt(nx, ny, space);
            this.revision++;
            return;
        }

        if (!stable || this.actionFired) return;
        if (raw === 'palm' && held >= CLEAR_HOLD_MS) {
            this.items = [];
            this.lastInkEnd = null;
            this.revision++;
            this.actionFired = true;
        } else if (raw === 'fist' && held >= UNDO_HOLD_MS) {
            this.undo(space);
            this.actionFired = true;
        }
    }

    private resetFilters() {
        this.filterX = new OneEuro(1.2, 8);
        this.filterY = new OneEuro(1.2, 8);
    }

    private undo(space: AnnotationSpace) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (this.items[i].space === space) {
                this.items.splice(i, 1);
                this.revision++;
                return;
            }
        }
    }

    private eraseAt(nx: number, ny: number, space: AnnotationSpace) {
        const rect = this.layout?.rect ?? { x: 0, y: 0, width: 1280, height: 720 };
        const radius = Math.min(rect.width, rect.height) * ERASE_RADIUS;
        this.items = this.items.filter((item) => {
            if (item.space !== space) return true;
            const pts = item.kind === 'stroke' ? item.points : item.strokes.flatMap((s) => s.points);
            return !pts.some((p) => Math.hypot((p.x - nx) * rect.width, (p.y - ny) * rect.height) < radius);
        });
    }

    private endStroke(now: number) {
        const stroke = this.active;
        if (!stroke) return;
        stroke.endedAt = now;
        this.active = null;
        if (stroke.points.length < 2) {
            this.items = this.items.filter((item) => item !== stroke);
        } else if (stroke.tool === 'ink') {
            this.lastInkEnd = now;
        } else if (this.snapShapes && (stroke.tool === 'pen' || stroke.tool === 'highlighter')) {
            const rect = this.layout?.rect ?? { x: 0, y: 0, width: 1280, height: 720 };
            const snapped = recognizeShape(stroke.points, rect.width, rect.height);
            if (snapped) {
                stroke.points = snapped;
                stroke.straight = true;
            }
        }
        this.revision++;
    }

    /* ----------------------------- air-writing ----------------------------- */

    /** Groups pending ink into a word once the pen has been up for WORD_GAP_MS, then recognises it. */
    private maybeFinalizeWord(now: number, opts: AirDrawingOptions, space: AnnotationSpace) {
        if (this.active || this.lastInkEnd === null || now - this.lastInkEnd < WORD_GAP_MS) return;
        this.lastInkEnd = null;

        const ink = this.items.filter((item): item is Stroke => item.kind === 'stroke' && item.tool === 'ink' && item.space === space);
        if (ink.length === 0) return;

        const all = ink.flatMap((stroke) => stroke.points);
        const minX = Math.min(...all.map((p) => p.x));
        const maxX = Math.max(...all.map((p) => p.x));
        const minY = Math.min(...all.map((p) => p.y));
        const maxY = Math.max(...all.map((p) => p.y));

        const word: TextItem = {
            kind: 'text',
            id: this.nextId++,
            space,
            strokes: ink,
            box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
            text: '',
            status: 'pending',
            showOriginal: false,
            manual: false,
            font: opts.writeFont,
            color: opts.writeColor,
            doneAt: now,
        };
        const firstIndex = this.items.indexOf(ink[0]);
        this.items = this.items.filter((item) => !ink.includes(item as Stroke));
        this.items.splice(Math.min(firstIndex, this.items.length), 0, word);
        this.revision++;

        const rect = this.layout?.rect ?? { x: 0, y: 0, width: 1280, height: 720 };
        const request: HandwritingRequest = {
            strokes: ink.map((stroke) => stroke.points.map((p) => ({ x: p.x * rect.width, y: p.y * rect.height }))),
            language: opts.language,
        };
        this.hooks.onStatus?.('Reading handwriting…');
        void this.hooks.recognize(request, (message) => this.hooks.onStatus?.(message)).then((result) => {
            if (!this.items.includes(word) || word.manual) { this.hooks.onStatus?.(null); return; }
            word.doneAt = performance.now();
            if (result.text) {
                word.text = result.text;
                word.status = 'done';
                this.hooks.onStatus?.(null);
            } else {
                word.status = 'failed';
                this.hooks.onStatus?.(result.error ?? 'Could not read that word — tap it to type it.');
            }
            this.revision++;
        });
    }

    /* ------------------------- editing typed text -------------------------- */

    /** Finds the typed word under a point given as fractions of the output canvas. */
    hitTest(fx: number, fy: number): TextItemInfo | null {
        const layout = this.layout;
        if (!layout) return null;
        const nx = (fx * layout.width - layout.rect.x) / layout.rect.width;
        const ny = (fy * layout.height - layout.rect.y) / layout.rect.height;
        const padX = 0.02;
        const padY = 0.03;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.kind !== 'text' || item.space !== layout.space) continue;
            const { x, y, w, h } = item.box;
            if (nx >= x - padX && nx <= x + w + padX && ny >= y - padY && ny <= y + h + padY) {
                return { id: item.id, text: item.text, status: item.status, showOriginal: item.showOriginal };
            }
        }
        return null;
    }

    private findText(id: number) {
        return this.items.find((item): item is TextItem => item.kind === 'text' && item.id === id);
    }

    setText(id: number, text: string) {
        const item = this.findText(id);
        const trimmed = text.trim();
        if (!item || !trimmed) return;
        item.text = trimmed;
        item.status = 'done';
        item.manual = true;
        item.showOriginal = false;
        item.doneAt = performance.now();
        this.revision++;
    }

    setShowOriginal(id: number, showOriginal: boolean) {
        const item = this.findText(id);
        if (!item) return;
        item.showOriginal = showOriginal;
        item.doneAt = performance.now();
        this.revision++;
    }

    removeItem(id: number) {
        this.items = this.items.filter((item) => item.id !== id);
        this.revision++;
    }

    /* ------------------------------ rendering ------------------------------ */

    hasContent(space: AnnotationSpace, opts: AirDrawingOptions) {
        if (this.items.some((item) => item.space === space)) return true;
        return Boolean(!opts.writeMode && opts.tool === 'laser' && this.cursor?.gesture === 'point' && this.cursor.space === space);
    }

    /** Changes whenever the rendered layer would look different; used to skip identical recording snapshots. */
    signature(now: number, opts: AirDrawingOptions, space: AnnotationSpace) {
        const popping = this.items.some((item) => item.kind === 'text' && item.space === space && now - item.doneAt < POP_IN_MS);
        const fading = opts.fade && this.items.some((item) => item.space === space && this.fadeStart(item) !== null);
        return `${this.revision}:${space}:${popping || fading ? Math.floor(now / 100) : 0}`;
    }

    private fadeStart(item: Item): number | null {
        if (item.kind === 'text') return item.status === 'pending' ? null : item.doneAt;
        return item.tool === 'ink' ? null : item.endedAt;
    }

    /** Draws annotations for `space` onto a transparent layer, then composites it over ctx. */
    render(
        ctx: CanvasRenderingContext2D,
        layer: HTMLCanvasElement,
        now: number,
        opts: AirDrawingOptions,
        showCursor: boolean,
        space: AnnotationSpace,
        rect: TargetRect
    ) {
        const { width, height } = layer;
        this.layout = { width, height, rect, space };
        const lctx = layer.getContext('2d');
        if (!lctx) return;
        lctx.clearRect(0, 0, width, height);

        if (opts.fade) {
            this.items = this.items.filter((item) => {
                const start = this.fadeStart(item);
                return start === null || now - start < FADE_AFTER_MS;
            });
        }

        const scale = Math.min(width, height) / 720;
        for (const item of this.items) {
            if (item.space !== space) continue;
            const start = this.fadeStart(item);
            const alpha = opts.fade && start !== null
                ? Math.min(1, Math.max(0, (FADE_AFTER_MS - (now - start)) / FADE_DURATION_MS))
                : 1;
            if (item.kind === 'stroke') {
                drawStroke(lctx, item, rect, scale, alpha);
            } else if (item.status === 'done' && !item.showOriginal) {
                drawTypedText(lctx, item, rect, scale, alpha, now);
            } else {
                for (const stroke of item.strokes) drawStroke(lctx, stroke, rect, scale, alpha);
            }
        }

        const cursor = this.cursor;
        if (cursor && cursor.space === space) {
            const x = rect.x + cursor.x * rect.width;
            const y = rect.y + cursor.y * rect.height;
            if (!opts.writeMode && opts.tool === 'laser') {
                if (cursor.gesture === 'point') drawLaserDot(lctx, x, y, opts.color, opts.size, scale);
            } else if (showCursor) {
                this.drawCursorRing(lctx, x, y, scale, opts, cursor.gesture);
            }
        }
        ctx.drawImage(layer, 0, 0);
    }

    private drawCursorRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opts: AirDrawingOptions, gesture: HandGesture) {
        // Eraser: dashed ring showing exactly what will be erased
        if (gesture === 'peace' && !opts.writeMode) {
            const rect = this.layout?.rect ?? { width: 1280, height: 720 };
            ctx.save();
            ctx.lineWidth = 3 * scale;
            ctx.strokeStyle = 'rgba(255,85,119,0.95)';
            ctx.setLineDash([6 * scale, 5 * scale]);
            ctx.beginPath();
            ctx.arc(x, y, Math.min(rect.width, rect.height) * ERASE_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        const drawPose = opts.writeMode ? 'pinch' : 'point';
        ctx.save();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = gesture === drawPose ? (opts.writeMode ? opts.writeColor : opts.color) : 'rgba(255,255,255,0.6)';
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

/* -------------------------------- Drawing ----------------------------------- */

function toPixels(points: Point[], rect: TargetRect): Point[] {
    return points.map((p) => ({ x: rect.x + p.x * rect.width, y: rect.y + p.y * rect.height }));
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
    ctx.moveTo(pts[0].x, pts[0].y);
    // Quadratic curves through midpoints give a smooth line from the filtered samples.
    for (let i = 1; i < pts.length - 1; i++) {
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

// Straight segments, used for snapped shapes so box corners stay sharp
function polyPath(ctx: CanvasRenderingContext2D, pts: Point[]) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

function arrowPath(ctx: CanvasRenderingContext2D, pts: Point[], lineWidth: number) {
    const from = pts[0];
    const to = pts[pts.length - 1];
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < lineWidth * 3) return;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = Math.min(length * 0.5, Math.max(lineWidth * 4.5, 16));
    for (const side of [-1, 1]) {
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - head * Math.cos(angle + side * 0.45), to.y - head * Math.sin(angle + side * 0.45));
    }
}

function neonPass(
    ctx: CanvasRenderingContext2D,
    path: () => void,
    color: string,
    lineWidth: number,
    glow: number,
    alpha: number
) {
    const glowAmount = glow / 100;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (glowAmount > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = lineWidth * (1 + 4 * glowAmount);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth * 1.4;
        ctx.beginPath();
        path();
        ctx.stroke();
    }

    ctx.shadowBlur = glowAmount > 0 ? lineWidth * 0.8 * glowAmount : 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    path();
    ctx.stroke();

    // Bright core makes the line read as a light source.
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * (0.35 + 0.5 * glowAmount);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, lineWidth * 0.35);
    ctx.beginPath();
    path();
    ctx.stroke();
    ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, rect: TargetRect, scale: number, alpha: number) {
    if (stroke.points.length < 2 || alpha <= 0) return;
    const pts = toPixels(stroke.points, rect);
    const lineWidth = Math.max(1, stroke.size * scale);
    const trace = () => (stroke.straight ? polyPath(ctx, pts) : smoothPath(ctx, pts));

    if (stroke.tool === 'highlighter') {
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = lineWidth * 3.5;
        ctx.beginPath();
        trace();
        ctx.stroke();
        ctx.restore();
    } else if (stroke.tool === 'arrow') {
        neonPass(ctx, () => arrowPath(ctx, pts, lineWidth), stroke.color, lineWidth, stroke.glow, alpha);
    } else {
        neonPass(ctx, trace, stroke.color, lineWidth, stroke.glow, alpha);
    }
}

function drawLaserDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number, scale: number) {
    const radius = (5 + size * 0.5) * scale;
    ctx.save();
    const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
    halo.addColorStop(0, color);
    halo.addColorStop(0.25, color);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function drawTypedText(ctx: CanvasRenderingContext2D, item: TextItem, rect: TargetRect, scale: number, alpha: number, now: number) {
    const stack = AIR_FONTS.find((font) => font.value === item.font)?.stack ?? AIR_FONTS[0].stack;
    const t = Math.min(1, Math.max(0, (now - item.doneAt) / POP_IN_MS));
    const popScale = 0.5 + 0.5 * easeOutBack(t);
    const popAlpha = Math.min(1, t * 2.5);

    let fontSize = Math.min(Math.max(item.box.h * rect.height * 0.95, 26 * scale), rect.height * 0.25);
    ctx.save();
    ctx.font = `600 ${fontSize}px ${stack}`;
    const measured = ctx.measureText(item.text).width;
    const maxWidth = rect.width * 0.92;
    if (measured > maxWidth) {
        fontSize *= maxWidth / measured;
        ctx.font = `600 ${fontSize}px ${stack}`;
    }

    const cx = rect.x + (item.box.x + item.box.w / 2) * rect.width;
    const cy = rect.y + (item.box.y + item.box.h / 2) * rect.height;
    ctx.translate(cx, cy);
    ctx.scale(popScale, popScale);
    ctx.globalAlpha = alpha * popAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, fontSize * 0.09);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(item.text, 0, 0);
    ctx.shadowColor = item.color;
    ctx.shadowBlur = fontSize * 0.2;
    ctx.fillStyle = item.color;
    ctx.fillText(item.text, 0, 0);
    ctx.restore();
}