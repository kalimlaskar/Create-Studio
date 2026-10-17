// Turns raw viewer sessions into the numbers on a video's analytics page.
// Kept free of database code so it can be unit-tested with plain objects.
import type { Chapter, ChapterStats, HeatmapBucket, VideoAnalytics, ViewerEvent, ViewerSummary } from './types';

export interface SessionInput {
    id: string;
    share_link_id: string | null;
    viewer_key: string;
    started_at: string;
    last_seen_at: string;
    watched_ms: number;
    max_position_ms: number;
    seconds_watched: number[] | null;
    completed: boolean;
    cta_clicked: boolean;
    device: string | null;
    country: string | null;
    /** Missing on sessions recorded before embeds existed. */
    source?: 'share' | 'embed' | null;
    referrer_host?: string | null;
    /** Set when the viewer unlocked a protected video with an email code. */
    viewer_email?: string | null;
}

export interface LinkInput {
    id: string;
    recipient_name: string | null;
    recipient_email: string | null;
    recipient_company: string | null;
}

export interface EventInput {
    session_id: string;
    type: ViewerEvent['type'];
    position_ms: number;
    detail: string | null;
    created_at: string;
}

/** A session counts as a play once at least a second has been watched. */
const PLAY_THRESHOLD_MS = 1000;
const RETENTION_POINTS = 100;
/** Fewer, wider cells than the retention line so each one stays readable on a phone. */
const HEATMAP_BUCKETS = 50;
/** A chapter counts as watched by a viewer when they played most of it. */
const CHAPTER_WATCHED = 0.6;

const countWatched = (seconds: number[], from: number, to: number) => {
    let watched = 0;
    for (let second = from; second < to; second += 1) if ((seconds[second] ?? 0) > 0) watched += 1;
    return watched;
};

const anyRewatched = (seconds: number[], from: number, to: number) => {
    for (let second = from; second < to; second += 1) if ((seconds[second] ?? 0) > 1) return true;
    return false;
};

const lastPlayedSecond = (seconds: number[]) => {
    for (let second = seconds.length - 1; second >= 0; second -= 1) if ((seconds[second] ?? 0) > 0) return second;
    return -1;
};

/**
 * Where plays re-watched, skipped ahead or stopped, in equal slices of the video.
 * Read from each play's per-second counts, so it needs no extra tracking:
 * - re-watched: some second in the slice was played more than once;
 * - skipped: nothing in the slice was played, but something after it was;
 * - dropped off: the play's last watched second is in the slice and it didn't finish.
 */
export function computeHeatmap(durationSec: number, plays: SessionInput[]): HeatmapBucket[] {
    const buckets = Math.min(HEATMAP_BUCKETS, durationSec);
    const sessions = plays.map((session) => ({
        seconds: session.seconds_watched ?? [],
        last: Math.min(durationSec - 1, lastPlayedSecond(session.seconds_watched ?? [])),
        // Playing up to the final second counts as finishing, even if the "ended" event was lost.
        finished: session.completed || lastPlayedSecond(session.seconds_watched ?? []) >= durationSec - 1,
    }));
    const result: HeatmapBucket[] = [];
    for (let bucket = 0; bucket < buckets; bucket += 1) {
        const from = Math.floor((bucket / buckets) * durationSec);
        const to = Math.max(from + 1, Math.floor(((bucket + 1) / buckets) * durationSec));
        let rewatched = 0;
        let skipped = 0;
        let droppedOff = 0;
        for (const session of sessions) {
            if (anyRewatched(session.seconds, from, to)) rewatched += 1;
            if (session.last >= to && countWatched(session.seconds, from, to) === 0) skipped += 1;
            if (!session.finished && session.last >= from && session.last < to) droppedOff += 1;
        }
        const share = (count: number) => (sessions.length ? count / sessions.length : 0);
        result.push({ startMs: from * 1000, endMs: to * 1000, rewatched: share(rewatched), skipped: share(skipped), droppedOff: share(droppedOff) });
    }
    return result;
}

function chapterRanges(chapters: Chapter[], durationSec: number) {
    return chapters.map((chapter, index) => {
        const start = Math.floor(chapter.startMs / 1000);
        const end = Math.max(start + 1, Math.min(durationSec, Math.floor((chapters[index + 1]?.startMs ?? durationSec * 1000) / 1000)));
        return { ...chapter, start, end };
    });
}

/** Adds up per-second play counts from several sessions. */
function mergeSeconds(sessions: SessionInput[], durationSec: number) {
    const total = new Array<number>(durationSec).fill(0);
    for (const session of sessions) {
        (session.seconds_watched ?? []).forEach((count, second) => {
            if (second < durationSec) total[second] += count ?? 0;
        });
    }
    return total;
}

export function computeAnalytics(durationMs: number, chapters: Chapter[], sessions: SessionInput[], links: LinkInput[], events: EventInput[]): VideoAnalytics {
    const durationSec = Math.max(1, Math.ceil(durationMs / 1000));
    const plays = sessions.filter((session) => session.watched_ms >= PLAY_THRESHOLD_MS);
    const share = (session: SessionInput) => countWatched(session.seconds_watched ?? [], 0, durationSec) / durationSec;
    const ranges = chapterRanges(chapters, durationSec);

    // Retention: for each point in the video, the share of plays that watched it.
    const points = Math.min(RETENTION_POINTS, durationSec);
    const retention: Array<[number, number]> = [];
    for (let point = 0; point < points; point += 1) {
        const from = Math.floor((point / points) * durationSec);
        const to = Math.max(from + 1, Math.floor(((point + 1) / points) * durationSec));
        const watching = plays.filter((session) => countWatched(session.seconds_watched ?? [], from, to) > 0).length;
        retention.push([from * 1000, plays.length ? watching / plays.length : 0]);
    }

    const chapterStats: ChapterStats[] = ranges.map((range) => {
        const length = range.end - range.start;
        const reached = plays.filter((session) => countWatched(session.seconds_watched ?? [], range.start, range.end) > 0).length;
        const watched = plays.reduce((sum, session) => sum + countWatched(session.seconds_watched ?? [], range.start, range.end) / length, 0);
        const rewatched = plays.filter((session) => anyRewatched(session.seconds_watched ?? [], range.start, range.end)).length;
        return {
            title: range.title,
            startMs: range.start * 1000,
            endMs: range.end * 1000,
            reached: plays.length ? reached / plays.length : 0,
            watched: plays.length ? watched / plays.length : 0,
            rewatched: plays.length ? rewatched / plays.length : 0,
        };
    });

    // Viewers: one row per personal link recipient, otherwise one per browser.
    const linkById = new Map(links.map((link) => [link.id, link]));
    const eventsBySession = new Map<string, EventInput[]>();
    for (const event of events) {
        const list = eventsBySession.get(event.session_id) ?? [];
        list.push(event);
        eventsBySession.set(event.session_id, list);
    }

    const groups = new Map<string, SessionInput[]>();
    for (const session of sessions) {
        const link = session.share_link_id ? linkById.get(session.share_link_id) : undefined;
        const key = link && (link.recipient_email || link.recipient_name) ? `link:${link.id}` : session.viewer_email ? `email:${session.viewer_email}` : `viewer:${session.viewer_key}`;
        groups.set(key, [...(groups.get(key) ?? []), session]);
    }

    const viewers: ViewerSummary[] = [...groups.entries()].map(([key, group]) => {
        const link = group[0].share_link_id ? linkById.get(group[0].share_link_id) : undefined;
        const personal = key.startsWith('link:') ? link : undefined;
        const verifiedEmail = group.find((session) => session.viewer_email)?.viewer_email ?? null;
        const seconds = mergeSeconds(group, durationSec);
        const furthest = Math.max(...group.map((session) => session.max_position_ms));
        const latest = group.reduce((a, b) => (a.last_seen_at > b.last_seen_at ? a : b));
        const chaptersWatched: string[] = [];
        const chaptersSkipped: string[] = [];
        for (const range of ranges) {
            const watched = countWatched(seconds, range.start, range.end) / (range.end - range.start);
            if (watched >= CHAPTER_WATCHED) chaptersWatched.push(range.title);
            else if (watched < 0.1 && furthest >= range.end * 1000) chaptersSkipped.push(range.title);
        }
        const timeline = group
            .flatMap((session) => eventsBySession.get(session.id) ?? [])
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .slice(-60)
            .map((event) => ({ type: event.type, positionMs: event.position_ms, detail: event.detail, at: event.created_at }));

        return {
            key,
            name: personal?.recipient_name || personal?.recipient_email || verifiedEmail || `Viewer ${group[0].viewer_key.slice(0, 4)}`,
            email: personal?.recipient_email ?? verifiedEmail,
            company: personal?.recipient_company ?? null,
            linkId: personal?.id ?? null,
            sessions: group.filter((session) => session.watched_ms >= PLAY_THRESHOLD_MS).length,
            lastSeenAt: latest.last_seen_at,
            watchedShare: countWatched(seconds, 0, durationSec) / durationSec,
            rewatched: seconds.some((count) => count > 1),
            ctaClicked: group.some((session) => session.cta_clicked),
            device: latest.device,
            country: latest.country,
            embedHosts: [...new Set(group.filter((session) => session.source === 'embed' && session.referrer_host).map((session) => session.referrer_host as string))],
            chaptersWatched,
            chaptersSkipped,
            timeline,
        };
    }).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

    // Where plays happened: the share page, or each website the video is embedded on.
    const sourceCounts = new Map<string, { label: string; kind: 'share' | 'embed'; plays: number }>();
    for (const session of plays) {
        const kind = session.source === 'embed' ? 'embed' : 'share';
        const label = kind === 'embed' ? session.referrer_host || 'Embedded (unknown site)' : 'Share link';
        const entry = sourceCounts.get(`${kind}:${label}`) ?? { label, kind, plays: 0 };
        entry.plays += 1;
        sourceCounts.set(`${kind}:${label}`, entry);
    }

    return {
        opens: sessions.length,
        plays: plays.length,
        uniqueViewers: new Set(plays.map((session) => session.viewer_key)).size,
        averageWatched: plays.length ? plays.reduce((sum, session) => sum + share(session), 0) / plays.length : 0,
        completionRate: plays.length ? plays.filter((session) => session.completed).length / plays.length : 0,
        ctaClicks: sessions.filter((session) => session.cta_clicked).length,
        totalWatchMs: sessions.reduce((sum, session) => sum + session.watched_ms, 0),
        retention,
        heatmap: computeHeatmap(durationSec, plays),
        chapters: chapterStats,
        sources: [...sourceCounts.values()].sort((a, b) => b.plays - a.plays),
        viewers: viewers.slice(0, 200),
        leads: [],
    };
}
