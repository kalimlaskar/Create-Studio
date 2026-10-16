import { describe, expect, it } from 'vitest';
import { maxUploadBytes, PLAN_LIMITS } from '@/components/pricing/planLimits';
import { mp4DurationMs } from '@/lib/videos/mp4';

function mvhd(version: 0 | 1, timescale: number, duration: number) {
    const bytes = new Uint8Array(64);
    const view = new DataView(bytes.buffer);
    bytes.set([...'mvhd'].map((char) => char.charCodeAt(0)), 4);
    bytes[8] = version;
    if (version === 0) {
        view.setUint32(20, timescale);
        view.setUint32(24, duration);
    } else {
        view.setUint32(28, timescale);
        view.setUint32(32, Math.floor(duration / 2 ** 32));
        view.setUint32(36, duration % 2 ** 32);
    }
    return bytes;
}

describe('upload limits', () => {
    it('caps upload size by the plan length', () => {
        const free = maxUploadBytes(PLAN_LIMITS.free);
        expect(free).toBeGreaterThan(60 * 1024 * 1024);
        expect(free).toBeLessThan(100 * 1024 * 1024);
        expect(maxUploadBytes(PLAN_LIMITS.studio)).toBeGreaterThan(maxUploadBytes(PLAN_LIMITS.creator));
    });

    it('every plan allows at least one hosted video', () => {
        for (const plan of Object.values(PLAN_LIMITS)) expect(plan.hostedVideos).toBeGreaterThan(0);
    });
});

describe('MP4 length', () => {
    it('reads version 0 and version 1 movie headers', () => {
        expect(mp4DurationMs(mvhd(0, 1000, 42_000))).toBe(42_000);
        expect(mp4DurationMs(mvhd(1, 90_000, 90_000 * 125))).toBe(125_000);
    });

    it('returns null when the length is unknown or missing', () => {
        expect(mp4DurationMs(mvhd(0, 1000, 0))).toBeNull();
        expect(mp4DurationMs(new Uint8Array(256))).toBeNull();
    });
});
