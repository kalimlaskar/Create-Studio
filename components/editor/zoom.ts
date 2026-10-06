import type { EditorProject } from '@/types/editor';

export function getZoomScale(zoomKeyframes: EditorProject['tracks']['zoom'], currentMs: number) {
    if (zoomKeyframes.length === 0) return 1;
    if (currentMs <= zoomKeyframes[0].atMs) return zoomKeyframes[0].scale;
    if (currentMs >= zoomKeyframes[zoomKeyframes.length - 1].atMs) return zoomKeyframes[zoomKeyframes.length - 1].scale;
    for (let index = 0; index < zoomKeyframes.length - 1; index++) {
        const start = zoomKeyframes[index];
        const end = zoomKeyframes[index + 1];
        if (currentMs >= start.atMs && currentMs <= end.atMs) {
            const progress = (currentMs - start.atMs) / (end.atMs - start.atMs);
            return start.scale + (end.scale - start.scale) * progress;
        }
    }
    return 1;
}
