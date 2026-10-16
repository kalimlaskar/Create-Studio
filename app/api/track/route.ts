import crypto from 'node:crypto';
import { findShare } from '@/lib/videos/public';
import { getStudioUser } from '@/lib/videos/server';
import { capPlayedSeconds, isAutomatedAgent, NEW_SESSIONS_PER_IP_PER_HOUR, SESSION_REUSE_MS } from '@/lib/videos/tracking';

// Public endpoint the share page reports viewing to. It never trusts the page for
// identity: the session is tied to the share link and to a random per-browser key.

const EVENT_TYPES = new Set(['play', 'pause', 'seek', 'ended', 'chapter', 'cta']);
const MAX_EVENTS = 50;
const MAX_SECONDS = 900;

interface TrackBody {
    slug?: unknown;
    viewerKey?: unknown;
    sessionId?: unknown;
    device?: unknown;
    positionMs?: unknown;
    completed?: unknown;
    /** [second, timesPlayed] pairs since the last report. */
    seconds?: unknown;
    events?: unknown;
}

const ok = (body: Record<string, unknown> = {}) => Response.json({ ok: true, ...body });

/** Salted hash of the viewer's network address, for rate limiting only. */
function ipHash(request: Request) {
    const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '').split(',')[0].trim();
    if (!ip) return null;
    const salt = process.env.ANALYTICS_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'cliprame';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(request: Request) {
    // sendBeacon posts text/plain, so read the body as text.
    const body = await request.text().then((text) => JSON.parse(text) as TrackBody).catch(() => null);
    if (!body || typeof body.slug !== 'string' || typeof body.viewerKey !== 'string' || !/^[\w-]{8,64}$/.test(body.viewerKey)) return bad('Bad request.');

    if (isAutomatedAgent(request.headers.get('user-agent'))) return ok({ ignored: true });

    const share = await findShare(body.slug);
    if (!share) return bad('Not found.', 404);
    const { admin, link, video } = share;

    // The creator watching their own link doesn't count as a view.
    const user = await getStudioUser().catch(() => null);
    if (user?.id === video.owner_id) return ok({ ignored: true });

    const durationSec = Math.max(1, Math.ceil(video.duration_ms / 1000));
    const positionMs = Math.min(Math.max(0, Math.round(Number(body.positionMs) || 0)), video.duration_ms || Number.MAX_SAFE_INTEGER);

    let sessionId = typeof body.sessionId === 'string' && /^[0-9a-f-]{36}$/.test(body.sessionId) ? body.sessionId : null;
    type SessionRow = { id: string; seconds_watched: number[] | null; watched_ms: number; max_position_ms: number; completed: boolean; cta_clicked: boolean; last_seen_at: string };
    const columns = 'id,seconds_watched,watched_ms,max_position_ms,completed,cta_clicked,last_seen_at';
    let session: SessionRow | null = null;

    if (sessionId) {
        const { data } = await admin.from('view_sessions').select(columns)
            .eq('id', sessionId).eq('video_id', video.id).eq('viewer_key', body.viewerKey).maybeSingle();
        session = data;
        if (!session) sessionId = null;
    }

    // Reopening the same video soon after continues the same session, so reloads don't count as new views.
    if (!session) {
        const { data } = await admin.from('view_sessions').select(columns)
            .eq('video_id', video.id).eq('viewer_key', body.viewerKey)
            .gt('last_seen_at', new Date(Date.now() - SESSION_REUSE_MS).toISOString())
            .order('last_seen_at', { ascending: false }).limit(1).maybeSingle();
        if (data) {
            session = data;
            sessionId = data.id;
        }
    }

    if (!session) {
        // Limit how many new sessions one network can create, so views can't be inflated by a script.
        const hashed = ipHash(request);
        if (hashed) {
            const { count } = await admin.from('view_sessions').select('id', { count: 'exact', head: true })
                .eq('ip_hash', hashed).gt('started_at', new Date(Date.now() - 3600_000).toISOString());
            if ((count ?? 0) >= NEW_SESSIONS_PER_IP_PER_HOUR) return Response.json({ ok: true, ignored: true, reason: 'rate_limited' }, { status: 429 });
        }
        const device = typeof body.device === 'string' && ['mobile', 'tablet', 'desktop'].includes(body.device) ? body.device : null;
        const country = (request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? '').slice(0, 2).toUpperCase() || null;
        const { data, error } = await admin.from('view_sessions').insert({
            video_id: video.id,
            share_link_id: link.id,
            viewer_key: body.viewerKey,
            device,
            country,
            ip_hash: hashed,
        }).select(columns).single();
        if (error || !data) {
            console.error('Could not start view session:', error);
            return bad('Could not record the view.', 500);
        }
        session = data;
        sessionId = data.id;
    }

    // Merge per-second play counts.
    const seconds = [...(session.seconds_watched ?? [])];
    let addedMs = 0;
    if (Array.isArray(body.seconds)) {
        const pairs: Array<[number, number]> = [];
        for (const pair of body.seconds.slice(0, MAX_SECONDS)) {
            const second = Math.floor(Number(Array.isArray(pair) ? pair[0] : NaN));
            const times = Math.min(5, Math.max(0, Math.floor(Number(Array.isArray(pair) ? pair[1] : 0))));
            if (!Number.isFinite(second) || second < 0 || second >= durationSec || !times) continue;
            pairs.push([second, times]);
        }
        // Only as much watching as could really have happened since the last report.
        for (const [second, times] of capPlayedSeconds(pairs, Date.now() - new Date(session.last_seen_at).getTime())) {
            while (seconds.length <= second) seconds.push(0);
            seconds[second] += times;
            addedMs += times * 1000;
        }
    }

    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS).flatMap((event) => {
        const type = typeof event?.type === 'string' && EVENT_TYPES.has(event.type) ? event.type : null;
        if (!type) return [];
        const position = Math.max(0, Math.round(Number(event.positionMs) || 0));
        const detail = typeof event.detail === 'string' ? event.detail.slice(0, 120) : null;
        return [{ session_id: sessionId, video_id: video.id, type, position_ms: position, detail }];
    }) : [];
    if (events.length) {
        const { error } = await admin.from('view_events').insert(events);
        if (error) console.error('Could not save view events:', error);
    }

    const { error } = await admin.from('view_sessions').update({
        seconds_watched: seconds,
        watched_ms: session.watched_ms + addedMs,
        max_position_ms: Math.max(session.max_position_ms, positionMs),
        completed: session.completed || body.completed === true || events.some((event) => event.type === 'ended'),
        cta_clicked: session.cta_clicked || events.some((event) => event.type === 'cta'),
        last_seen_at: new Date().toISOString(),
    }).eq('id', sessionId);
    if (error) console.error('Could not update view session:', error);

    return ok({ sessionId });
}
