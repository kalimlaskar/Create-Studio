import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isR2Configured, r2Url, readObjectRange } from '@/lib/storage/r2';
import { mp4DurationMs } from './mp4';
import type { Chapter, ShareLink, VideoListItem, VideoRecord } from './types';
import { computeAnalytics } from './analytics';

export interface VideoRow {
    id: string;
    owner_id: string;
    title: string;
    status: 'uploading' | 'ready';
    storage_key: string;
    poster_key: string | null;
    content_type: 'video/mp4' | 'video/webm';
    size_bytes: number;
    duration_ms: number;
    chapters: Chapter[] | null;
    cta_label: string | null;
    cta_url: string | null;
    embed_enabled: boolean;
    embed_domains: string[] | null;
    created_at: string;
}

export interface ShareLinkRow {
    id: string;
    video_id: string;
    slug: string;
    recipient_name: string | null;
    recipient_email: string | null;
    recipient_company: string | null;
    is_default: boolean;
    revoked_at: string | null;
    created_at: string;
}

export const VIDEO_COLUMNS = 'id,owner_id,title,status,storage_key,poster_key,content_type,size_bytes,duration_ms,chapters,cta_label,cta_url,embed_enabled,embed_domains,created_at';
export const LINK_COLUMNS = 'id,video_id,slug,recipient_name,recipient_email,recipient_company,is_default,revoked_at,created_at';

/** The signed-in creator and a Supabase client that acts as them (row-level security applies). */
export async function getStudioUser(): Promise<{ id: string; supabase: SupabaseClient } | null> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getClaims();
    const id = data?.claims?.sub;
    return !error && id ? { id, supabase } : null;
}

export const newSlug = () => crypto.randomBytes(12).toString('base64url');

/** PostgREST's "table not found": the video sharing migration hasn't been applied. */
export const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === 'PGRST205';
export const MISSING_TABLES_MESSAGE = 'Video sharing isn’t set up in the database yet. Run supabase/migrations/20261017000000_video_sharing.sql in the Supabase SQL Editor.';

/** Supabase errors print as {} because their fields aren't enumerable; this keeps the useful parts. */
export const describeDbError = (error: unknown) => {
    const { code, message, hint } = (error ?? {}) as { code?: string; message?: string; hint?: string };
    return [code, message, hint].filter(Boolean).join(' · ') || String(error);
};

export const videoObjectKey = (ownerId: string, videoId: string, contentType: string) =>
    `videos/${ownerId}/${videoId}/video.${contentType === 'video/webm' ? 'webm' : 'mp4'}`;
export const posterObjectKey = (ownerId: string, videoId: string) => `videos/${ownerId}/${videoId}/poster.jpg`;

export function toVideoRecord(row: VideoRow): VideoRecord {
    return {
        id: row.id,
        title: row.title,
        status: row.status,
        contentType: row.content_type,
        sizeBytes: Number(row.size_bytes),
        durationMs: row.duration_ms,
        chapters: Array.isArray(row.chapters) ? row.chapters : [],
        ctaLabel: row.cta_label,
        ctaUrl: row.cta_url,
        embedEnabled: row.embed_enabled ?? true,
        embedDomains: row.embed_domains ?? [],
        createdAt: row.created_at,
    };
}

export function toShareLink(row: ShareLinkRow): ShareLink {
    return {
        id: row.id,
        slug: row.slug,
        recipientName: row.recipient_name,
        recipientEmail: row.recipient_email,
        recipientCompany: row.recipient_company,
        isDefault: row.is_default,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
    };
}

/** Short-lived playback URLs. Plays keep working after expiry once the file has started loading. */
export const playbackUrl = (row: Pick<VideoRow, 'storage_key'>) => r2Url('GET', row.storage_key, 6 * 3600);
export const posterUrl = (row: Pick<VideoRow, 'poster_key'>, expiresIn = 3600) => (row.poster_key && isR2Configured() ? r2Url('GET', row.poster_key, expiresIn) : null);

/** The creator's library, newest first, with view counts. */
export async function listVideos(supabase: SupabaseClient): Promise<VideoListItem[]> {
    const { data: videos, error } = await supabase.from('videos').select(VIDEO_COLUMNS).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const rows = (videos ?? []) as VideoRow[];
    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    const [{ data: links }, { data: sessions }] = await Promise.all([
        supabase.from('share_links').select('video_id,slug').in('video_id', ids).eq('is_default', true),
        supabase.from('view_sessions').select('video_id,viewer_key,watched_ms,last_seen_at').in('video_id', ids).limit(20000),
    ]);

    return rows.map((row) => {
        const own = (sessions ?? []).filter((session) => session.video_id === row.id && session.watched_ms >= 1000);
        const lastViewedAt = own.reduce<string | null>((latest, session) => (!latest || session.last_seen_at > latest ? session.last_seen_at : latest), null);
        return {
            ...toVideoRecord(row),
            posterUrl: posterUrl(row),
            views: own.length,
            uniqueViewers: new Set(own.map((session) => session.viewer_key)).size,
            lastViewedAt,
            defaultSlug: (links ?? []).find((link) => link.video_id === row.id)?.slug ?? null,
        };
    });
}

/** Loads sessions, links and events for one video and computes its analytics. */
export async function loadAnalytics(supabase: SupabaseClient, video: Pick<VideoRow, 'id' | 'duration_ms' | 'chapters'>) {
    const [sessions, links, events] = await Promise.all([
        supabase.from('view_sessions')
            .select('id,share_link_id,viewer_key,started_at,last_seen_at,watched_ms,max_position_ms,seconds_watched,completed,cta_clicked,device,country,source,referrer_host')
            .eq('video_id', video.id).order('started_at', { ascending: false }).limit(5000),
        supabase.from('share_links').select('id,recipient_name,recipient_email,recipient_company').eq('video_id', video.id),
        supabase.from('view_events').select('session_id,type,position_ms,detail,created_at')
            .eq('video_id', video.id).order('created_at', { ascending: false }).limit(5000),
    ]);
    if (sessions.error) throw sessions.error;
    return computeAnalytics(video.duration_ms, Array.isArray(video.chapters) ? video.chapters : [], sessions.data ?? [], links.data ?? [], events.data ?? []);
}

/** The real length of an uploaded MP4, read from its header at either end of the file. Null if it doesn't say. */
export async function readUploadedDurationMs(key: string, sizeBytes: number) {
    const head = await readObjectRange(key, 'bytes=0-524287');
    const fromHead = mp4DurationMs(head);
    if (fromHead !== null || sizeBytes <= head.length) return fromHead;
    return mp4DurationMs(await readObjectRange(key, 'bytes=-2097152'));
}
