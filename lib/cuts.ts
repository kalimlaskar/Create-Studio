import { TimeRange } from '@/types/editor';

// Add a deleted range, merging any that overlap
export function addDeletedRange(ranges: TimeRange[], r: TimeRange): TimeRange[] {
    const all = [...ranges, r].sort((a, b) => a.startMs - b.startMs);
    const merged: TimeRange[] = [];
    for (const cur of all) {
        const last = merged[merged.length - 1];
        if (last && cur.startMs <= last.endMs) last.endMs = Math.max(last.endMs, cur.endMs);
        else merged.push({ ...cur });
    }
    return merged;
}

// Restore the deleted range that contains atMs
export function removeDeletedRange(ranges: TimeRange[], atMs: number): TimeRange[] {
    return ranges.filter((r) => !(atMs >= r.startMs && atMs <= r.endMs));
}

// The parts that survive, within trimStart..trimEnd
export function getKeepRanges(trimStartMs: number, trimEndMs: number, deleted: TimeRange[] = []): TimeRange[] {
    const keep: TimeRange[] = [];
    let cursor = trimStartMs;
    for (const d of deleted) {
        if (d.endMs <= cursor) continue;
        if (d.startMs >= trimEndMs) break;
        if (d.startMs > cursor) keep.push({ startMs: cursor, endMs: d.startMs });
        cursor = Math.max(cursor, d.endMs);
    }
    if (cursor < trimEndMs) keep.push({ startMs: cursor, endMs: trimEndMs });
    return keep;
}

// If ms is inside a deleted range, return where playback should jump to, else null
export function skipTarget(ms: number, deleted: TimeRange[] = []): number | null {
    const hit = deleted.find((d) => ms >= d.startMs && ms < d.endMs);
    return hit ? hit.endMs : null;
}

// Source time -> time in the joined video (for captions, export, output duration). null = inside a cut.
export function sourceToOutput(ms: number, keep: TimeRange[]): number | null {
    let out = 0;
    for (const k of keep) {
        if (ms >= k.startMs && ms <= k.endMs) return out + (ms - k.startMs);
        out += k.endMs - k.startMs;
    }
    return null;
}