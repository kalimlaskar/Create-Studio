import 'server-only';
import crypto from 'node:crypto';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShareLinkRow, VideoRow } from '@/lib/videos/server';
import { dispatchNotifications } from './server';
import type { NotificationPayload, NotificationType } from './types';

/** The parts of a viewing session that notifications describe. */
export interface SessionState {
    id: string;
    watched_ms: number;
    completed: boolean;
    cta_clicked: boolean;
    seconds_watched: number[] | null;
    device: string | null;
    country: string | null;
    source: 'share' | 'embed' | null;
    referrer_host: string | null;
    viewer_email: string | null;
}

/** Moments a report just crossed: first played second, reaching the end, clicking the button. */
export function crossedMoments(before: Pick<SessionState, 'watched_ms' | 'completed' | 'cta_clicked'>, now: Pick<SessionState, 'watched_ms' | 'completed' | 'cta_clicked'>) {
    const moments: NotificationType[] = [];
    if (before.watched_ms < 1000 && now.watched_ms >= 1000) moments.push('video.viewed');
    if (!before.completed && now.completed) moments.push('video.completed');
    if (!before.cta_clicked && now.cta_clicked) moments.push('cta.clicked');
    return moments;
}

export function buildPayload(type: NotificationType, { video, link, session, siteUrl, test = false }: {
    video: Pick<VideoRow, 'id' | 'title' | 'duration_ms'>;
    link: Pick<ShareLinkRow, 'slug' | 'recipient_name' | 'recipient_email' | 'recipient_company'>;
    session: Omit<SessionState, 'id'>;
    siteUrl: string;
    test?: boolean;
}): NotificationPayload {
    const durationSec = Math.max(1, Math.ceil(video.duration_ms / 1000));
    const watchedSeconds = (session.seconds_watched ?? []).filter((count) => count > 0).length;
    const email = link.recipient_email ?? session.viewer_email ?? null;
    return {
        id: `evt_${crypto.randomUUID().replace(/-/g, '')}`,
        type,
        createdAt: new Date().toISOString(),
        ...(test ? { test: true } : {}),
        video: { id: video.id, title: video.title, durationSeconds: durationSec, analyticsUrl: `${siteUrl}/studio/videos/${video.id}`, shareUrl: `${siteUrl}/v/${link.slug}` },
        viewer: {
            name: link.recipient_name ?? email,
            email,
            company: link.recipient_company,
            identified: Boolean(link.recipient_name || email),
            device: session.device,
            country: session.country,
            source: session.source === 'embed' ? 'embed' : 'share',
            website: session.source === 'embed' ? session.referrer_host : null,
        },
        watch: { percentWatched: Math.min(1, watchedSeconds / durationSec), watchedSeconds, completed: session.completed, ctaClicked: session.cta_clicked },
    };
}

export const siteUrlFor = (request: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');

/**
 * After the response is sent, records the moments this report crossed (once per
 * session, even if reports arrive twice) and notifies the owner's integrations.
 */
export function notifyViewing({ admin, request, video, link, before, now, extra = [] }: {
    admin: SupabaseClient;
    request: Request;
    video: Pick<VideoRow, 'id' | 'owner_id' | 'title' | 'duration_ms'>;
    link: Pick<ShareLinkRow, 'slug' | 'recipient_name' | 'recipient_email' | 'recipient_company'>;
    before: Pick<SessionState, 'watched_ms' | 'completed' | 'cta_clicked'>;
    now: SessionState;
    /** Moments reported directly by the player, e.g. a booking. */
    extra?: NotificationType[];
}) {
    const moments = [...crossedMoments(before, now), ...extra.filter((type) => !crossedMoments(before, now).includes(type))];
    if (!moments.length) return;
    const siteUrl = siteUrlFor(request);

    after(async () => {
        try {
            const { count } = await admin.from('integrations').select('id', { count: 'exact', head: true }).eq('owner_id', video.owner_id).eq('enabled', true);
            if (!count) return;
            const { data: fresh, error } = await admin.from('notification_events')
                .upsert(moments.map((type) => ({ owner_id: video.owner_id, video_id: video.id, session_id: now.id, type })), { onConflict: 'session_id,type', ignoreDuplicates: true })
                .select('type');
            if (error) throw error;
            const types = (fresh ?? []).map((row) => row.type as NotificationType);
            await dispatchNotifications(admin, video.owner_id, types.map((type) => buildPayload(type, { video, link, session: now, siteUrl })));
        } catch (error) {
            console.error('Could not send viewing notifications:', error);
        }
    });
}

/**
 * After the response is sent, tells the owner's integrations about a form submission.
 * Every submission is its own event, so there's no once-per-session check here.
 */
export function notifyLead({ admin, request, video, link, form, email, source }: {
    admin: SupabaseClient;
    request: Request;
    video: Pick<VideoRow, 'id' | 'owner_id' | 'title' | 'duration_ms'>;
    link: Pick<ShareLinkRow, 'slug' | 'recipient_name' | 'recipient_email' | 'recipient_company'>;
    form: { id: string; title: string; values: Record<string, string>; hidden: Record<string, string> };
    email: string | null;
    source: 'share' | 'embed';
}) {
    const siteUrl = siteUrlFor(request);
    after(async () => {
        try {
            // A name typed into the form beats the anonymous default.
            const typedName = [form.values.firstname ?? form.values.first_name, form.values.lastname ?? form.values.last_name].filter(Boolean).join(' ') || form.values.name || form.values.full_name || null;
            const company = form.values.company ?? link.recipient_company ?? null;
            const payload = buildPayload('form.submitted', {
                video,
                link: { ...link, recipient_name: link.recipient_name ?? typedName, recipient_company: company },
                session: { watched_ms: 0, completed: false, cta_clicked: false, seconds_watched: [], device: null, country: null, source, referrer_host: null, viewer_email: email },
                siteUrl,
            });
            await dispatchNotifications(admin, video.owner_id, [{ ...payload, form }]);
        } catch (error) {
            console.error('Could not send form notifications:', error);
        }
    });
}
