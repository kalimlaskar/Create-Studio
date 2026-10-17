// Shared by the server, the studio pages and the public share page.
import type { Interaction } from './interactions';

export interface Chapter {
    title: string;
    startMs: number;
}

/** Who can play a shared or embedded video: anyone with the link, or only after a check. */
export type AccessMode = 'public' | 'pin' | 'password' | 'email';
export const ACCESS_MODES: AccessMode[] = ['public', 'pin', 'password', 'email'];

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
    embedEnabled: boolean;
    /** Websites allowed to embed the video (paid plans). Empty means anywhere. */
    embedDomains: string[];
    accessMode: AccessMode;
    /** For email codes: addresses or "@company.com" domains allowed in. Empty means any address. */
    accessEmails: string[];
    /** In-video forms, buttons and booking embeds (full settings; owners only). */
    interactions: Interaction[];
    /** Set when an admin took the video down for breaking the content rules. */
    removed: { at: string; reason: string | null } | null;
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
    /** Websites this viewer watched the embedded video on. */
    embedHosts: string[];
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

/** One slice of the video: the share of plays (0–1) that did each thing there. */
export interface HeatmapBucket {
    startMs: number;
    endMs: number;
    /** Played some part of the slice more than once. */
    rewatched: number;
    /** Played nothing in the slice but carried on watching after it. */
    skipped: number;
    /** Stopped watching for good in this slice, without finishing the video. */
    droppedOff: number;
}

/** One form submission from a viewer. */
export interface LeadRecord {
    id: string;
    formId: string;
    formTitle: string | null;
    fields: Record<string, string>;
    hidden: Record<string, string>;
    email: string | null;
    forwardStatus: 'ok' | 'failed' | 'skipped' | null;
    forwardError: string | null;
    createdAt: string;
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
    /** Re-watch, skip and drop-off rates across the video. */
    heatmap: HeatmapBucket[];
    chapters: ChapterStats[];
    /** Plays by where they happened: the share page or a website the video is embedded on. */
    sources: Array<{ label: string; kind: 'share' | 'embed'; plays: number }>;
    viewers: ViewerSummary[];
    /** Form submissions, newest first. */
    leads: LeadRecord[];
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

/** Cleans a list of websites for embed restrictions: bare host names, lower case, no duplicates. */
export function normalizeEmbedDomains(input: unknown): string[] | null {
    if (!Array.isArray(input) || input.length > 20) return null;
    const hosts = new Set<string>();
    for (const item of input) {
        if (typeof item !== 'string') return null;
        let host = item.trim().toLowerCase();
        if (!host) continue;
        host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
        if (!/^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) || host.length > 253) return null;
        hosts.add(host);
    }
    return [...hosts];
}

/** True when a host is allowed by a list like ["acme.com", "*.acme.com"]. */
export function hostAllowed(host: string, allowed: string[]) {
    const clean = host.toLowerCase();
    return allowed.some((rule) => (rule.startsWith('*.') ? clean === rule.slice(2) || clean.endsWith(rule.slice(1)) : clean === rule || clean === `www.${rule}`));
}

/* ------------------------------ Viewer access ---------------------------- */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (input: unknown) => {
    const email = typeof input === 'string' ? input.trim().toLowerCase() : '';
    return email.length <= 254 && EMAIL.test(email) ? email : null;
};

/** Why a PIN or password can't be used, or null when it's fine. */
export function accessSecretProblem(mode: 'pin' | 'password', secret: unknown): string | null {
    if (typeof secret !== 'string') return mode === 'pin' ? 'Enter a PIN.' : 'Enter a password.';
    if (mode === 'pin') return /^\d{6,8}$/.test(secret) ? null : 'A PIN is 6 to 8 digits.';
    return secret.length >= 8 && secret.length <= 128 ? null : 'Use a password of 8 to 128 characters.';
}

/** Cleans the list of people allowed to unlock with an email code: addresses or "@company.com" domains. */
export function normalizeAccessEmails(input: unknown): string[] | null {
    if (!Array.isArray(input) || input.length > 100) return null;
    const rules = new Set<string>();
    for (const item of input) {
        if (typeof item !== 'string') return null;
        const rule = item.trim().toLowerCase();
        if (!rule) continue;
        if (rule.startsWith('@')) {
            if (!/^@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(rule) || rule.length > 254) return null;
            rules.add(rule);
        } else {
            const email = normalizeEmail(rule);
            if (!email) return null;
            rules.add(email);
        }
    }
    return [...rules];
}

/** True when an address matches a rule list like ["ana@acme.com", "@acme.com"]. An empty list allows anyone. */
export function emailAllowed(email: string, rules: string[]) {
    if (!rules.length) return true;
    const clean = email.toLowerCase();
    return rules.some((rule) => (rule.startsWith('@') ? clean.endsWith(rule) : clean === rule));
}
