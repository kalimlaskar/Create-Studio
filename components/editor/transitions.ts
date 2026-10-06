import type { ClipTransition, EditorProject, TransitionType } from '@/types/editor';
import { getFrameCrop } from '@/components/recordingQuality';
import { buildColorGradeFilter } from './colorGrade';
import { getZoomScale } from './zoom';
import type { TransitionRenderer } from './transitionRenderer';

export const MIN_TRANSITION_MS = 500;
export const MAX_TRANSITION_MS = 2000;
export const DEFAULT_TRANSITION_MS = 1000;

export const TRANSITION_OPTIONS: { type: TransitionType; label: string; short: string; hint: string }[] = [
    { type: 'particles', label: 'Particle dissolve', short: 'Particles', hint: 'The frame shatters into particles that reform as the next scene.' },
    { type: 'portal', label: 'Portal ring', short: 'Portal', hint: 'A glowing ring expands and reveals the next scene through it.' },
    { type: 'warp', label: 'Warp jump', short: 'Warp', hint: 'A light-speed jump with star streaks and a flash.' },
];

export function clampTransitionMs(durationMs: number) {
    return Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, Math.round(durationMs / 50) * 50));
}

/** A transition may not run past the next split or the trim end. */
export function getEffectiveTransitionMs(transition: ClipTransition, splitPointsMs: number[], trimEndMs: number) {
    const limit = splitPointsMs.filter((point) => point > transition.atMs).reduce((min, point) => Math.min(min, point), trimEndMs);
    return Math.max(100, Math.min(transition.durationMs, limit - transition.atMs));
}

export function getActiveTransition(project: EditorProject, ms: number) {
    const { transitions, splitPointsMs, trimStartMs, trimEndMs } = project.videoEdit;
    if (!transitions?.length) return null;
    for (const transition of transitions) {
        if (transition.atMs < trimStartMs || !splitPointsMs.includes(transition.atMs)) continue;
        const duration = getEffectiveTransitionMs(transition, splitPointsMs, trimEndMs);
        if (ms >= transition.atMs && ms < transition.atMs + duration) {
            return { transition, progress: (ms - transition.atMs) / duration };
        }
    }
    return null;
}

const PERFORMANCE_KEY = 'cliprame:transition-performance-mode';

export function getInitialPerformanceMode() {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(PERFORMANCE_KEY);
    if (stored !== null) return stored === '1';
    const weakDevice = (navigator.hardwareConcurrency ?? 8) <= 4 || /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
    return weakDevice;
}

export function storePerformanceMode(enabled: boolean) {
    try { window.localStorage.setItem(PERFORMANCE_KEY, enabled ? '1' : '0'); } catch { /* storage unavailable */ }
}

export interface Snapshot {
    key: string;
    canvas: HTMLCanvasElement;
}

/**
 * Captures the outgoing frame (the picture at the split point) so a transition can
 * play it against the live video. Uses its own hidden video element, so the editor's
 * playback is never disturbed.
 */
export class TransitionSnapshots {
    private video: HTMLVideoElement | null = null;
    private sourceUrl = '';
    private snapshots = new Map<number, Snapshot>();
    private queue: Promise<unknown> = Promise.resolve();

    private getVideo(sourceUrl: string) {
        if (!this.video || this.sourceUrl !== sourceUrl) {
            this.video = document.createElement('video');
            this.video.muted = true;
            this.video.playsInline = true;
            this.video.preload = 'auto';
            this.video.src = sourceUrl;
            this.sourceUrl = sourceUrl;
            this.snapshots.clear();
        }
        return this.video;
    }

    private keyFor(project: EditorProject, atMs: number, width: number, height: number) {
        return JSON.stringify([project.sourceVideoUrl, atMs, width, height, project.aspectRatio, project.colorGrade, project.tracks.zoom]);
    }

    /** Returns the snapshot if it is ready for the current project settings. */
    get(project: EditorProject, atMs: number, width: number, height: number) {
        const snapshot = this.snapshots.get(atMs);
        return snapshot && snapshot.key === this.keyFor(project, atMs, width, height) ? snapshot : null;
    }

    /** Captures (or refreshes) the snapshots for every transition. Calls are serialised. */
    prepare(project: EditorProject, width: number, height: number) {
        const transitions = project.videoEdit.transitions ?? [];
        this.queue = this.queue.then(async () => {
            for (const transition of transitions) {
                if (this.get(project, transition.atMs, width, height)) continue;
                await this.capture(project, transition.atMs, width, height).catch((error) => console.error('Transition snapshot failed:', error));
            }
        });
        return this.queue;
    }

    private async capture(project: EditorProject, atMs: number, width: number, height: number) {
        const video = this.getVideo(project.sourceVideoUrl);
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
            await new Promise<void>((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error('Video metadata did not load.')), 8000);
                video.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
            });
        }
        const targetTime = atMs / 1000;
        if (Math.abs(video.currentTime - targetTime) > 0.001 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            await new Promise<void>((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error('Could not seek for the transition snapshot.')), 8000);
                video.addEventListener('seeked', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                video.currentTime = targetTime;
            });
        }
        if (video.videoWidth === 0) return;

        const canvas = this.snapshots.get(atMs)?.canvas ?? document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const crop = getFrameCrop(video.videoWidth, video.videoHeight, project.aspectRatio);
        const zoom = getZoomScale(project.tracks.zoom, atMs);
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-width / 2, -height / 2);
        ctx.filter = buildColorGradeFilter(project.colorGrade);
        ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        ctx.restore();
        this.snapshots.set(atMs, { key: this.keyFor(project, atMs, width, height), canvas });
    }

    dispose() {
        this.video?.removeAttribute('src');
        this.video?.load();
        this.video = null;
        this.snapshots.clear();
    }
}

/**
 * Replaces the canvas content with the transition frame when the playhead is inside a transition.
 * Call after the scene is drawn and before overlays/captions. Returns whether a transition was drawn.
 */
export function drawTransitionFrame(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    project: EditorProject,
    currentMs: number,
    snapshots: TransitionSnapshots,
    renderer: TransitionRenderer | null,
    performanceMode: boolean,
) {
    if (!renderer) return false;
    const active = getActiveTransition(project, currentMs);
    if (!active) return false;
    const snapshot = snapshots.get(project, active.transition.atMs, canvas.width, canvas.height);
    if (!snapshot) return false;
    const layer = renderer.render({
        type: active.transition.type,
        from: snapshot.canvas,
        fromKey: snapshot.key,
        to: canvas,
        progress: active.progress,
        timeSeconds: performance.now() / 1000,
        performanceMode,
    });
    if (!layer) return false;
    ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
    return true;
}
