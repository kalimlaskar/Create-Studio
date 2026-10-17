// Rules that keep viewer analytics honest. Pure functions so they can be tested.
import crypto from 'node:crypto';

/** Salted hash of the viewer's network address, for rate limiting only. The address itself is never stored. */
export function ipHash(request: Request) {
    const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '').split(',')[0].trim();
    if (!ip) return null;
    const salt = process.env.ANALYTICS_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'cliprame';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Link previews, crawlers and headless browsers open share links without anyone watching. */
const NOT_A_VIEWER = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|skype|embedly|headless|lighthouse|pingdom|uptime/i;

export const isAutomatedAgent = (userAgent: string | null) => !userAgent || NOT_A_VIEWER.test(userAgent);

/** Opening the same video again within this window continues the same session. */
export const SESSION_REUSE_MS = 30 * 60 * 1000;
/** New sessions allowed per network (hashed IP) per hour, across all videos. */
export const NEW_SESSIONS_PER_IP_PER_HOUR = 60;

/**
 * Accepts at most as many played seconds as could really have been watched since
 * the last report (allowing 2x playback speed and a little slack), so a script
 * can't add hours of watch time in one request.
 */
export function capPlayedSeconds(pairs: Array<[number, number]>, elapsedMs: number) {
    let budget = Math.ceil(Math.max(0, elapsedMs) / 1000) * 2 + 8;
    const accepted: Array<[number, number]> = [];
    for (const [second, times] of pairs) {
        if (budget <= 0) break;
        const take = Math.min(times, budget);
        accepted.push([second, take]);
        budget -= take;
    }
    return accepted;
}
