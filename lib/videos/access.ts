import 'server-only';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import type { VideoRow } from './server';

// Viewer verification for protected videos (PIN, password or email code).
// A viewer who passes gets a signed token, kept in a cookie and sent with
// analytics reports. It names the video and its access_version, so changing the
// protection signs everyone out.

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const UNLOCK_TTL_S = 7 * 24 * 3600;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
/** Wrong PINs/passwords allowed per network per video, and per video overall, before a pause. */
export const FAILURES_PER_IP = 8;
export const FAILURES_PER_IP_WINDOW_MS = 15 * 60 * 1000;
export const FAILURES_PER_VIDEO_PER_HOUR = 100;
/** Codes sent per address per video, and per network overall. */
export const CODES_PER_EMAIL_PER_10_MIN = 3;
export const CODES_PER_IP_PER_HOUR = 10;

type AccessVideo = Pick<VideoRow, 'id' | 'access_mode' | 'access_version'>;

/** Secret for signing unlock tokens. Without one, protected videos stay locked. */
function signingKey() {
    return process.env.VIDEO_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export async function hashSecret(secret: string) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(secret, salt, 32);
    return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifySecret(secret: string, stored: string | null) {
    const [kind, salt, hash] = (stored ?? '').split('$');
    if (kind !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64url');
    const actual = await scrypt(secret, Buffer.from(salt, 'base64url'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

const hmac = (key: string, value: string) => crypto.createHmac('sha256', key).update(value).digest('base64url');

/** Codes are stored hashed, so a database leak doesn't reveal live codes. */
export const hashCode = (videoId: string, email: string, code: string) => hmac(signingKey() ?? 'cliprame', `${videoId}:${email}:${code}`);

export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export function signUnlock(video: AccessVideo, email: string | null, now = Date.now()) {
    const key = signingKey();
    if (!key) return null;
    const payload = Buffer.from(JSON.stringify({ v: video.id, n: video.access_version, e: email, x: Math.floor(now / 1000) + UNLOCK_TTL_S })).toString('base64url');
    return `${payload}.${hmac(key, payload)}`;
}

/** The viewer's unlock for this video, or null if the token is missing, forged, expired or out of date. */
export function readUnlock(token: unknown, video: AccessVideo, now = Date.now()): { email: string | null } | null {
    const key = signingKey();
    if (!key || typeof token !== 'string' || token.length > 1000) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(hmac(key, payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { v?: string; n?: number; e?: string | null; x?: number };
        if (data.v !== video.id || data.n !== video.access_version || !data.x || data.x * 1000 < now) return null;
        return { email: typeof data.e === 'string' ? data.e : null };
    } catch {
        return null;
    }
}

/* ------------------------------- Lead gate ------------------------------ */

export const leadCookieName = (videoId: string) => `cliprame_lead_${videoId.replace(/-/g, '')}`;

/** Proof the viewer filled in this video's gate form. Tied to the form, so a new gate form asks again. */
export function signLead(videoId: string, formId: string, email: string | null, now = Date.now()) {
    const key = signingKey();
    if (!key) return null;
    const payload = Buffer.from(JSON.stringify({ k: 'lead', v: videoId, f: formId, e: email, x: Math.floor(now / 1000) + UNLOCK_TTL_S })).toString('base64url');
    return `${payload}.${hmac(key, payload)}`;
}

export function readLead(token: unknown, videoId: string, formId: string, now = Date.now()): { email: string | null } | null {
    const key = signingKey();
    if (!key || typeof token !== 'string' || token.length > 1000) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(hmac(key, payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { k?: string; v?: string; f?: string; e?: string | null; x?: number };
        if (data.k !== 'lead' || data.v !== videoId || data.f !== formId || !data.x || data.x * 1000 < now) return null;
        return { email: typeof data.e === 'string' ? data.e : null };
    } catch {
        return null;
    }
}

/** The viewer's lead pass for this video's gate form, from their cookie. */
export async function leadFromCookie(videoId: string, formId: string) {
    return readLead((await cookies()).get(leadCookieName(videoId))?.value, videoId, formId);
}

export const unlockCookieName = (videoId: string) => `cliprame_unlock_${videoId.replace(/-/g, '')}`;

/** Cookie settings. SameSite=None lets an unlock inside an embed survive a reload where the browser allows it. */
export const unlockCookieOptions = () => {
    const secure = process.env.NODE_ENV === 'production';
    return { httpOnly: true, secure, sameSite: secure ? 'none' as const : 'lax' as const, path: '/', maxAge: UNLOCK_TTL_S, partitioned: secure };
};

/** For share and embed pages: the token to play with, or null while the viewer still has to unlock. */
export async function pageUnlock(video: AccessVideo & Pick<VideoRow, 'owner_id'>, viewerId: string | null) {
    if (video.access_mode === 'public') return { token: null };
    // The creator previewing their own link isn't asked for the PIN.
    if (viewerId === video.owner_id) return { token: signUnlock(video, null) };
    const token = (await cookies()).get(unlockCookieName(video.id))?.value;
    return token && readUnlock(token, video) ? { token } : null;
}

/* --------------------------------- Email -------------------------------- */

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ACCESS_EMAIL_FROM);

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Sends the one-time code through Resend's HTTP API. */
export async function sendAccessCode({ to, code, videoTitle, sender }: { to: string; code: string; videoTitle: string; sender: string | null }) {
    const from = sender ? `${sender} via Cliprame` : 'Cliprame';
    const subject = `${code} is your code to watch “${videoTitle.slice(0, 80)}”`;
    const text = `Your code is ${code}\n\nEnter it to watch “${videoTitle}”${sender ? `, shared by ${sender}` : ''}. It works for 10 minutes.\n\nIf you didn’t ask for this, you can ignore this email.`;
    const html = `<div style="font-family:system-ui,sans-serif;color:#14121F;max-width:440px">
<p style="font-size:15px">Enter this code to watch <strong>${escapeHtml(videoTitle)}</strong>${sender ? ` from ${escapeHtml(sender)}` : ''}:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
<p style="font-size:13px;color:#6b6878">It works for 10 minutes. If you didn’t ask for this, you can ignore this email.</p></div>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${from.replace(/[<>"]/g, '')} <${process.env.ACCESS_EMAIL_FROM}>`, to: [to], subject, text, html }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
}
