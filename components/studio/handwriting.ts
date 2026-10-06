import type { AirWritingLanguage } from '@/types/studio';

export interface InkPoint { x: number; y: number }

export interface HandwritingRequest {
    /** Strokes in pixel units (aspect ratio preserved). */
    strokes: InkPoint[][];
    language: AirWritingLanguage;
}

export interface HandwritingResult {
    text: string | null;
    provider?: string;
    error?: string;
}

/** Swap or add recognizers by implementing this and passing them to HandwritingService. */
export interface HandwritingRecognizer {
    readonly id: string;
    readonly label: string;
    supports(language: AirWritingLanguage): Promise<boolean>;
    recognize(request: HandwritingRequest, onStatus?: (message: string) => void): Promise<string | null>;
}

export const WRITING_LANGUAGES: { value: AirWritingLanguage; label: string; experimental: boolean }[] = [
    { value: 'en', label: 'English', experimental: false },
    { value: 'hi', label: 'हिन्दी (Hindi)', experimental: true },
];

const LANGUAGE_NAMES: Record<AirWritingLanguage, string> = { en: 'English', hi: 'Hindi' };

/** Tries each recognizer in order and uses the first one that supports the language. */
export class HandwritingService {
    constructor(private readonly recognizers: HandwritingRecognizer[]) {}

    async recognize(request: HandwritingRequest, onStatus?: (message: string) => void): Promise<HandwritingResult> {
        let lastError: string | undefined;
        for (const recognizer of this.recognizers) {
            try {
                if (!(await recognizer.supports(request.language))) continue;
                const text = await recognizer.recognize(request, onStatus);
                if (text && text.trim()) return { text: text.trim(), provider: recognizer.id };
                lastError = 'Could not read that word — tap it to type it.';
            } catch (error) {
                console.warn(`Handwriting recognizer "${recognizer.id}" failed:`, error);
                lastError = `${recognizer.label} failed — tap the word to type it.`;
            }
        }
        const experimental = request.language === 'hi' ? ' (experimental)' : '';
        return {
            text: null,
            error: lastError ?? `${LANGUAGE_NAMES[request.language]} handwriting recognition${experimental} isn't available in this browser. Tap a word to type it instead.`,
        };
    }
}

/* ------------------- Browser Handwriting Recognition API ------------------- */

interface BrowserHandwritingStroke { addPoint(point: { x: number; y: number; t?: number }): void }
interface BrowserHandwritingDrawing {
    addStroke(stroke: BrowserHandwritingStroke): void;
    getPrediction(): Promise<{ text: string }[]>;
    clear(): void;
}
interface BrowserHandwritingRecognizer {
    startDrawing(hints?: Record<string, unknown>): BrowserHandwritingDrawing;
    finish(): void;
}
type BrowserHandwritingNavigator = Navigator & {
    queryHandwritingRecognizerSupport?: (query: { languages: string[] }) => Promise<{ languages?: boolean }>;
    createHandwritingRecognizer?: (constraint: { languages: string[] }) => Promise<BrowserHandwritingRecognizer>;
};
type HandwritingStrokeCtor = new () => BrowserHandwritingStroke;

export class BrowserHandwritingRecognizerProvider implements HandwritingRecognizer {
    readonly id = 'browser';
    readonly label = 'Browser handwriting recognition';
    private readonly sessions = new Map<AirWritingLanguage, Promise<BrowserHandwritingRecognizer>>();

    async supports(language: AirWritingLanguage) {
        if (typeof navigator === 'undefined') return false;
        const nav = navigator as BrowserHandwritingNavigator;
        const strokeCtor = (globalThis as { HandwritingStroke?: HandwritingStrokeCtor }).HandwritingStroke;
        if (!nav.createHandwritingRecognizer || !nav.queryHandwritingRecognizerSupport || !strokeCtor) return false;
        try {
            const result = await nav.queryHandwritingRecognizerSupport({ languages: [language] });
            return Boolean(result?.languages);
        } catch {
            return false;
        }
    }

    async recognize(request: HandwritingRequest) {
        const nav = navigator as BrowserHandwritingNavigator;
        const StrokeCtor = (globalThis as { HandwritingStroke?: HandwritingStrokeCtor }).HandwritingStroke!;
        let session = this.sessions.get(request.language);
        if (!session) {
            session = nav.createHandwritingRecognizer!({ languages: [request.language] });
            session.catch(() => this.sessions.delete(request.language));
            this.sessions.set(request.language, session);
        }
        const recognizer = await session;
        const drawing = recognizer.startDrawing({ recognitionType: 'text', inputType: 'touch', textContext: '', alternatives: 3 });
        try {
            let t = 0;
            for (const points of request.strokes) {
                const stroke = new StrokeCtor();
                for (const point of points) stroke.addPoint({ x: point.x, y: point.y, t: (t += 16) });
                drawing.addStroke(stroke);
            }
            const predictions = await drawing.getPrediction();
            return predictions?.[0]?.text ?? null;
        } finally {
            drawing.clear();
        }
    }
}

/* ----------------- Client-side model fallback (TrOCR, English) -------------- */

const TROCR_MODEL_ID = 'Xenova/trocr-small-handwritten';
type ImageToText = (input: string) => Promise<{ generated_text?: string }[] | { generated_text?: string }>;

let trocrPromise: Promise<ImageToText> | null = null;

function loadTrOcr(onStatus?: (message: string) => void) {
    if (!trocrPromise) {
        onStatus?.('Loading handwriting model (first use only)…');
        trocrPromise = (async () => {
            const { pipeline, env } = await import('@huggingface/transformers');
            env.allowLocalModels = false;
            return (await pipeline('image-to-text', TROCR_MODEL_ID)) as unknown as ImageToText;
        })();
        trocrPromise.catch(() => { trocrPromise = null; });
    }
    return trocrPromise;
}

/** Rasterises strokes as dark ink on white, shaped like the text-line images TrOCR expects. */
function rasterizeStrokes(strokes: InkPoint[][]) {
    const all = strokes.flat();
    const minX = Math.min(...all.map((p) => p.x));
    const maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y));
    const maxY = Math.max(...all.map((p) => p.y));
    const boxW = Math.max(maxX - minX, 1);
    const boxH = Math.max(maxY - minY, boxW * 0.12, 1);

    const height = 160;
    const unit = (height * 0.62) / boxH;
    const width = Math.max(Math.round(boxW * unit + height * 0.8), height * 3);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = height * 0.06;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const offsetX = (width - boxW * unit) / 2 - minX * unit;
    const offsetY = (height - boxH * unit) / 2 - minY * unit;
    for (const stroke of strokes) {
        ctx.beginPath();
        stroke.forEach((p, i) => {
            const x = p.x * unit + offsetX;
            const y = p.y * unit + offsetY;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        if (stroke.length === 1) ctx.lineTo(stroke[0].x * unit + offsetX + 0.1, stroke[0].y * unit + offsetY);
        ctx.stroke();
    }
    return canvas;
}

export class TrOcrHandwritingRecognizer implements HandwritingRecognizer {
    readonly id = 'trocr';
    readonly label = 'On-device handwriting model';

    async supports(language: AirWritingLanguage) {
        return language === 'en';
    }

    async recognize(request: HandwritingRequest, onStatus?: (message: string) => void) {
        const strokes = request.strokes.filter((s) => s.length > 0);
        if (strokes.length === 0) return null;
        const model = await loadTrOcr(onStatus);
        const canvas = rasterizeStrokes(strokes);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        try {
            const output = await model(url);
            const first = Array.isArray(output) ? output[0] : output;
            return first?.generated_text ?? null;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}

let defaultService: HandwritingService | null = null;

/** Browser API first (also the only route to Hindi where available), then the on-device model. */
export function getHandwritingService() {
    if (!defaultService) {
        defaultService = new HandwritingService([
            new BrowserHandwritingRecognizerProvider(),
            new TrOcrHandwritingRecognizer(),
        ]);
    }
    return defaultService;
}
