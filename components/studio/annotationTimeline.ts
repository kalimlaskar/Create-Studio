export interface AnnotationFrame {
    /** Seconds of recorded (un-paused) time at which this frame becomes visible. */
    t: number;
    blob: Blob;
}

interface PendingFrame {
    t: number;
    hasContent: boolean;
    blob: Promise<Blob | null>;
}

const MIN_FRAME_INTERVAL_S = 0.1;

/**
 * Screen-share recordings store the raw screen and camera tracks and compose them
 * afterwards, so the canvas annotations are logged here as transparent PNG snapshots
 * and overlaid during that composition step.
 */
class AnnotationTimeline {
    private frames: PendingFrame[] = [];
    private lastSignature: string | null = null;

    begin() {
        this.frames = [];
        this.lastSignature = null;
    }

    capture(layer: HTMLCanvasElement, t: number, signature: string, hasContent: boolean) {
        const last = this.frames[this.frames.length - 1];
        if (last) {
            if (signature === this.lastSignature) return;
            if (!hasContent && !last.hasContent) return;
            if (t - last.t < MIN_FRAME_INTERVAL_S) return;
        }
        this.lastSignature = signature;
        this.frames.push({
            t: last ? t : 0,
            hasContent,
            blob: new Promise<Blob | null>((resolve) => layer.toBlob(resolve, 'image/png')),
        });
    }

    /** Resolves all snapshots, or null when nothing was ever annotated. */
    async collect(): Promise<AnnotationFrame[] | null> {
        const frames = this.frames;
        if (!frames.some((frame) => frame.hasContent)) return null;
        const resolved: AnnotationFrame[] = [];
        for (const frame of frames) {
            const blob = await frame.blob;
            if (blob) resolved.push({ t: frame.t, blob });
        }
        return resolved.length > 0 ? resolved : null;
    }
}

export const annotationTimeline = new AnnotationTimeline();
