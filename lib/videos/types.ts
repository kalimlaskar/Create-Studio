// Shared by the server, the studio pages and the public share page.

export interface Chapter {
    title: string;
    startMs: number;
}

export interface VideoRecord {
    id: string;
    title: string;
    status: 'uploading' | 'ready';
    contentType: 'video/mp4' | 'video/webm';
    sizeBytes: number;
    durationMs: number;
    chapters: Chapter[];
    ctaLabel: string | null;
    ctaUrl: string | null;
    createdAt: string;
}

export interface VideoListItem extends VideoRecord {
    posterUrl: string | null;
    views: number;
    uniqueViewers: number;
    lastViewedAt: string | null;
    defaultSlug: string | null;
}

export interface ShareLink {
    id: string;
    slug: string;
    recipientName: string | null;
    recipientEmail: string | null;
    recipientCompany: string | null;
    isDefault: boolean;
    revokedAt: string | null;
    createdAt: string;
}

export interface ViewerEvent {
    type: 'play' | 'pause' | 'seek' | 'ended' | 'chapter' | 'cta';
    positionMs: number;
    detail: string | null;
    at: string;
}

export interface ViewerSummary {
    key: string;
    /** Recipient name or email for personal links, otherwise "Viewer 3f9a". */
    name: string;
    email: string | null;
    company: string | null;
    linkId: string | null;
    sessions: number;
    lastSeenAt: string;
    /** Highest share of the video this viewer played, 0–1. */
    watchedShare: number;
    rewatched: boolean;
    ctaClicked: boolean;
    device: string | null;
    country: string | null;
    /** Chapters this viewer played most of, in video order. */
    chaptersWatched: string[];
    chaptersSkipped: string[];
    timeline: ViewerEvent[];
}

export interface ChapterStats {
    title: string;
    startMs: number;
    endMs: number;
    /** Share of plays that reached any part of the chapter. */
    reached: number;
    /** Average share of the chapter's seconds played, across plays. */
    watched: number;
    /** Share of plays that played some part of it more than once. */
    rewatched: number;
}

export interface VideoAnalytics {
    opens: number;
    plays: number;
    uniqueViewers: number;
    /** Average share of the video played per play, 0–1. */
    averageWatched: number;
    completionRate: number;
    ctaClicks: number;
    totalWatchMs: number;
    /** Share of plays still watching at each point: [positionMs, share]. */
    retention: Array<[number, number]>;
    chapters: ChapterStats[];
    viewers: ViewerSummary[];
}

export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
export const MAX_CHAPTERS = 40;
export const SHARE_CONTENT_TYPES = ['video/mp4', 'video/webm'] as const;

/**
 * Cleans chapters from a request: valid titles, sorted, within the video,
 * no duplicate start times, and the first chapter always starts at 0.
 */
export function normalizeChapters(input: unknown, durationMs: number): Chapter[] | null {
    if (!Array.isArray(input) || input.length > MAX_CHAPTERS) return null;
    const chapters: Chapter[] = [];
    for (const item of input) {
        const title = typeof item?.title === 'string' ? item.title.trim().slice(0, 80) : '';
        const startMs = Math.round(Number(item?.startMs));
        if (!title || !Number.isFinite(startMs) || startMs < 0) return null;
        if (durationMs > 0 && startMs >= durationMs) return null;
        chapters.push({ title, startMs });
    }
    chapters.sort((a, b) => a.startMs - b.startMs);
    if (chapters.some((chapter, index) => index > 0 && chapter.startMs === chapters[index - 1].startMs)) return null;
    if (chapters.length) chapters[0] = { ...chapters[0], startMs: 0 };
    return chapters;
}

/** Only http(s) links, so a CTA can never run script. */
export function normalizeCtaUrl(input: unknown): string | null {
    if (typeof input !== 'string' || !input.trim()) return null;
    try {
        const url = new URL(input.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href.slice(0, 500) : null;
    } catch {
        return null;
    }
}

export function formatClock(ms: number) {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Parses "1:05", "65" or "1:02:05" into milliseconds. */
export function parseClock(text: string): number | null {
    const parts = text.trim().split(':').map((part) => Number(part));
    if (!parts.length || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000);
}

export const formatPercent = (share: number) => `${Math.round(share * 100)}%`;
