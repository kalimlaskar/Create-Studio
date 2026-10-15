import type { ReelImage } from './reelTypes';

export interface Timeline {
    starts: number[];
    durations: number[];
    total: number;
}

/** Photos use the global "seconds per photo" (divided by speed); videos carry their own length. */
export const clipDurationMs = (clip: ReelImage, secondsPerImage: number) =>
    clip.type === 'image' ? (secondsPerImage * 1000) / (clip.speed ?? 1) : clip.durationMs;

export const buildTimeline = (clips: ReelImage[], secondsPerImage: number): Timeline => {
    const starts: number[] = [];
    const durations: number[] = [];
    let total = 0;
    for (const clip of clips) {
        const duration = clipDurationMs(clip, secondsPerImage);
        starts.push(total);
        durations.push(duration);
        total += duration;
    }
    return { starts, durations, total };
};

export const indexAtTime = (timeline: Timeline, timeMs: number) => {
    for (let index = 0; index < timeline.starts.length; index += 1) {
        if (timeMs < timeline.starts[index] + timeline.durations[index]) return index;
    }
    return Math.max(0, timeline.starts.length - 1);
};
