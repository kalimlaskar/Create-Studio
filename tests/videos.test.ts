import { describe, expect, it } from 'vitest';
import { computeAnalytics, type SessionInput } from '@/lib/videos/analytics';
import { normalizeChapters, normalizeCtaUrl, parseClock } from '@/lib/videos/types';

describe('chapters', () => {
    it('sorts chapters and starts the first at 0', () => {
        expect(normalizeChapters([{ title: 'Pricing', startMs: 30_000 }, { title: 'Intro', startMs: 2_000 }], 60_000))
            .toEqual([{ title: 'Intro', startMs: 0 }, { title: 'Pricing', startMs: 30_000 }]);
    });

    it('rejects duplicates, empty titles and times past the end', () => {
        expect(normalizeChapters([{ title: 'A', startMs: 0 }, { title: 'B', startMs: 0 }], 60_000)).toBeNull();
        expect(normalizeChapters([{ title: '', startMs: 0 }], 60_000)).toBeNull();
        expect(normalizeChapters([{ title: 'Late', startMs: 90_000 }], 60_000)).toBeNull();
    });

    it('parses clock times', () => {
        expect(parseClock('1:05')).toBe(65_000);
        expect(parseClock('1:02:03')).toBe(3_723_000);
        expect(parseClock('abc')).toBeNull();
    });

    it('only allows http(s) button links', () => {
        expect(normalizeCtaUrl('https://cal.com/demo')).toBe('https://cal.com/demo');
        expect(normalizeCtaUrl('javascript:alert(1)')).toBeNull();
    });
});

describe('analytics', () => {
    const seconds = (from: number, to: number, times = 1) => {
        const list = new Array(60).fill(0);
        for (let second = from; second < to; second += 1) list[second] += times;
        return list;
    };
    const session = (id: string, viewer: string, watched: number[], extra: Partial<SessionInput> = {}): SessionInput => ({
        id, share_link_id: null, viewer_key: viewer, started_at: '2026-10-17T10:00:00Z', last_seen_at: '2026-10-17T10:05:00Z',
        watched_ms: watched.filter(Boolean).length * 1000, max_position_ms: 60_000, seconds_watched: watched,
        completed: false, cta_clicked: false, device: 'desktop', country: 'IN', ...extra,
    });

    it('computes plays, completion and retention', () => {
        const result = computeAnalytics(60_000, [{ title: 'Intro', startMs: 0 }, { title: 'Pricing', startMs: 30_000 }], [
            session('a', 'viewer-a', seconds(0, 60), { completed: true, cta_clicked: true }),
            session('b', 'viewer-b', seconds(0, 30)),
            session('c', 'viewer-c', []),
        ], [], []);
        expect(result.opens).toBe(3);
        expect(result.plays).toBe(2);
        expect(result.completionRate).toBe(0.5);
        expect(result.ctaClicks).toBe(1);
        expect(result.retention[0][1]).toBe(1);
        expect(result.retention[45][1]).toBe(0.5);
        expect(result.chapters[1].reached).toBe(0.5);
    });

    it('finds re-watches, skips and drop-offs', () => {
        const rewatcher = seconds(0, 60);
        for (let second = 10; second < 15; second += 1) rewatcher[second] = 2;
        const skipper = seconds(0, 20);
        for (let second = 40; second < 60; second += 1) skipper[second] = 1;
        const { heatmap } = computeAnalytics(60_000, [], [
            session('a', 'viewer-a', rewatcher),
            session('b', 'viewer-b', skipper),
            session('c', 'viewer-c', seconds(0, 30)),
            session('d', 'viewer-d', seconds(0, 60)),
        ], [], []);
        // 60 seconds → 50 slices; find the slice holding a given second.
        const at = (second: number) => heatmap.find((bucket) => second * 1000 >= bucket.startMs && second * 1000 < bucket.endMs)!;
        expect(heatmap).toHaveLength(50);
        expect(at(12).rewatched).toBe(0.25);
        expect(at(30).skipped).toBe(0.25);
        expect(at(30).droppedOff).toBe(0);
        expect(at(29).droppedOff).toBe(0.25);
        // Watching to the last second is finishing, not dropping off.
        expect(at(59).droppedOff).toBe(0);
        expect(heatmap.reduce((sum, bucket) => sum + bucket.droppedOff, 0)).toBe(0.25);
    });
});

describe('time slices', () => {
    it('never repeats or skips a slice, for any video length', () => {
        for (let seconds = 1; seconds <= 600; seconds += 1) {
            const { heatmap, retention } = computeAnalytics(seconds * 1000, [], [], [], []);
            for (const starts of [heatmap.map((bucket) => bucket.startMs), retention.map(([ms]) => ms)]) {
                expect(starts[0], `${seconds}s`).toBe(0);
                for (let i = 1; i < starts.length; i += 1) expect(starts[i], `${seconds}s, slice ${i}`).toBeGreaterThan(starts[i - 1]);
            }
            // Heatmap slices tile the whole video with no gaps.
            heatmap.forEach((bucket, i) => { if (i) expect(bucket.startMs).toBe(heatmap[i - 1].endMs); });
            expect(heatmap[heatmap.length - 1].endMs).toBe(seconds * 1000);
        }
    });
});

describe('embed websites', () => {
    it('cleans website lists', async () => {
        const { normalizeEmbedDomains } = await import('@/lib/videos/types');
        expect(normalizeEmbedDomains(['https://Acme.com/pricing', '*.acme.com', 'acme.com', ''])).toEqual(['acme.com', '*.acme.com']);
        expect(normalizeEmbedDomains(['not a domain!'])).toBeNull();
    });

    it('matches allowed websites', async () => {
        const { hostAllowed } = await import('@/lib/videos/types');
        expect(hostAllowed('acme.com', ['acme.com'])).toBe(true);
        expect(hostAllowed('www.acme.com', ['acme.com'])).toBe(true);
        expect(hostAllowed('docs.acme.com', ['*.acme.com'])).toBe(true);
        expect(hostAllowed('acme.com', ['*.acme.com'])).toBe(true);
        expect(hostAllowed('evil-acme.com', ['*.acme.com'])).toBe(false);
        expect(hostAllowed('acme.com.evil.io', ['acme.com'])).toBe(false);
    });
});
