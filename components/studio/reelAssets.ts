import type { ReelImage } from './reelTypes';

/**
 * Owns every decoded / cached media object (images, video elements, poster frames, depth maps)
 * so the preview, the export and the draft loader all read from the same place.
 * `onChange` is called whenever something finishes loading so the preview can redraw.
 */
export class ReelAssets {
    onChange: (() => void) | null = null;

    readonly posters = new Map<string, HTMLCanvasElement>();
    readonly depthMaps = new Map<string, HTMLCanvasElement>();
    /** Keeps the in-flight promise so callers (e.g. the export) can really wait for the depth map. */
    readonly depthJobs = new Map<string, { key: string; promise: Promise<void> }>();

    private images = new Map<string, HTMLImageElement>();
    private videos = new Map<string, HTMLVideoElement>();

    getImage(clip: ReelImage): HTMLImageElement {
        let element = this.images.get(clip.id);
        if (!element) {
            element = new Image();
            element.onload = () => this.onChange?.();
            element.src = clip.url;
            this.images.set(clip.id, element);
        }
        return element;
    }

    getVideo(clip: ReelImage): HTMLVideoElement {
        let element = this.videos.get(clip.id);
        if (!element) {
            element = document.createElement('video');
            element.preload = 'auto';
            element.muted = true;
            element.playsInline = true;
            element.src = clip.url;
            this.videos.set(clip.id, element);
        }
        return element;
    }

    forEachVideo(callback: (video: HTMLVideoElement, id: string) => void) {
        this.videos.forEach(callback);
    }

    pauseAllVideos(exceptId?: string) {
        this.videos.forEach((video, id) => {
            if (id !== exceptId) video.pause();
        });
    }

    forget(id: string) {
        this.images.delete(id);
        this.posters.delete(id);
        this.depthMaps.delete(id);
        this.depthJobs.delete(id);
        const video = this.videos.get(id);
        if (video) {
            video.pause();
            video.src = '';
            this.videos.delete(id);
        }
    }

    reset() {
        this.videos.forEach((video) => {
            video.pause();
            video.src = '';
        });
        this.videos.clear();
        this.images.clear();
        this.posters.clear();
        this.depthMaps.clear();
        this.depthJobs.clear();
    }

    dispose() {
        this.onChange = null;
        this.reset();
    }
}
