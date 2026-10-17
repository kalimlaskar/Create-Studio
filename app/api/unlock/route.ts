import { cookies } from 'next/headers';
import { findShare, ownerDisplayName } from '@/lib/videos/public';
import { playbackUrl, posterUrl } from '@/lib/videos/server';
import {
    CODE_MAX_ATTEMPTS, CODE_TTL_MS, CODES_PER_EMAIL_PER_10_MIN, CODES_PER_IP_PER_HOUR, FAILURES_PER_IP, FAILURES_PER_IP_WINDOW_MS, FAILURES_PER_VIDEO_PER_HOUR,
    hashCode, isEmailConfigured, leadFromCookie, newCode, sendAccessCode, signUnlock, unlockCookieName, unlockCookieOptions, verifySecret,
} from '@/lib/videos/access';
import { gateForm, readInteractions } from '@/lib/videos/interactions';
import { ipHash } from '@/lib/videos/tracking';
import { emailAllowed, normalizeEmail } from '@/lib/videos/types';

// Public endpoint behind the lock screen on protected share and embed pages.
//   { slug, action: 'secret', secret }      checks a PIN or password
//   { slug, action: 'send-code', email }    emails a one-time code
//   { slug, action: 'verify-code', email, code }
// On success it sets the unlock cookie and returns what the player needs.

const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as { slug?: unknown; action?: unknown; secret?: unknown; email?: unknown; code?: unknown } | null;
    if (!body || typeof body.slug !== 'string') return fail('Bad request.');
    const share = await findShare(body.slug);
    if (!share) return fail('This video isn’t available.', 404);
    const { admin, link, video } = share;
    const ip = ipHash(request);

    const unlocked = async (email: string | null) => {
        const token = signUnlock(video, email);
        if (!token) return fail('Protected videos aren’t set up on this server.', 503);
        (await cookies()).set(unlockCookieName(video.id), token, unlockCookieOptions());
        // A gate form still stands between the viewer and the video.
        const gate = gateForm(readInteractions(video.interactions));
        if (gate && !(await leadFromCookie(video.id, gate.id))) return Response.json({ accessToken: token, next: 'form' }, { headers: { 'Cache-Control': 'no-store' } });
        return Response.json({ playbackUrl: playbackUrl(video), posterUrl: posterUrl(video, 6 * 3600), accessToken: token }, { headers: { 'Cache-Control': 'no-store' } });
    };

    if (video.access_mode === 'public') return unlocked(null);

    if (body.action === 'secret') {
        if (video.access_mode !== 'pin' && video.access_mode !== 'password') return fail('This video uses a different check.');
        if (typeof body.secret !== 'string' || !body.secret || body.secret.length > 128) return fail(video.access_mode === 'pin' ? 'Enter the PIN.' : 'Enter the password.');

        const [perIp, perVideo] = await Promise.all([
            admin.from('video_access_failures').select('id', { count: 'exact', head: true }).eq('video_id', video.id).eq('ip_hash', ip ?? 'unknown').gt('created_at', since(FAILURES_PER_IP_WINDOW_MS)),
            admin.from('video_access_failures').select('id', { count: 'exact', head: true }).eq('video_id', video.id).gt('created_at', since(3600_000)),
        ]);
        if ((perIp.count ?? 0) >= FAILURES_PER_IP || (perVideo.count ?? 0) >= FAILURES_PER_VIDEO_PER_HOUR) return fail('Too many tries. Wait a few minutes and try again.', 429);

        const { data: secretRow } = await admin.from('videos').select('access_secret_hash').eq('id', video.id).single();
        if (await verifySecret(body.secret, secretRow?.access_secret_hash ?? null)) return unlocked(null);

        await admin.from('video_access_failures').insert({ video_id: video.id, ip_hash: ip ?? 'unknown' });
        return fail(video.access_mode === 'pin' ? 'That PIN isn’t right.' : 'That password isn’t right.', 401);
    }

    if (video.access_mode !== 'email') return fail('This video uses a different check.');
    const email = normalizeEmail(body.email);
    if (!email) return fail('Enter a valid email address.');

    if (body.action === 'send-code') {
        if (!isEmailConfigured()) return fail('Email codes aren’t set up on this server.', 503);
        // A personal link with an address only opens for that person (plus anyone the creator allowed).
        const allowed = link.recipient_email
            ? email === link.recipient_email.toLowerCase() || ((video.access_emails ?? []).length > 0 && emailAllowed(email, video.access_emails ?? []))
            : emailAllowed(email, video.access_emails ?? []);
        if (!allowed) return fail('This address doesn’t have access. Use the email the video was sent to, or ask the sender.', 403);

        const [perEmail, perIp] = await Promise.all([
            admin.from('video_access_codes').select('id', { count: 'exact', head: true }).eq('video_id', video.id).eq('email', email).gt('created_at', since(10 * 60_000)),
            admin.from('video_access_codes').select('id', { count: 'exact', head: true }).eq('ip_hash', ip ?? 'unknown').gt('created_at', since(3600_000)),
        ]);
        if ((perEmail.count ?? 0) >= CODES_PER_EMAIL_PER_10_MIN || (perIp.count ?? 0) >= CODES_PER_IP_PER_HOUR) return fail('Too many codes sent. Wait a few minutes and try again.', 429);

        const code = newCode();
        const { error } = await admin.from('video_access_codes').insert({
            video_id: video.id, email, code_hash: hashCode(video.id, email, code), expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(), ip_hash: ip ?? 'unknown',
        });
        if (error) {
            console.error('Could not save access code:', error);
            return fail('Could not send a code. Please try again.', 500);
        }
        try {
            await sendAccessCode({ to: email, code, videoTitle: video.title, sender: await ownerDisplayName(video.owner_id) });
        } catch (cause) {
            console.error('Could not email access code:', cause);
            return fail('Could not send the email. Please try again.', 502);
        }
        return Response.json({ sent: true });
    }

    if (body.action === 'verify-code') {
        const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';
        if (!/^\d{6}$/.test(code)) return fail('Enter the 6-digit code from the email.');
        const { data: row } = await admin.from('video_access_codes').select('id,code_hash,attempts')
            .eq('video_id', video.id).eq('email', email).is('used_at', null).gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!row || row.attempts >= CODE_MAX_ATTEMPTS) return fail('That code has expired. Send a new one.', 401);
        if (row.code_hash !== hashCode(video.id, email, code)) {
            await admin.from('video_access_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
            return fail('That code isn’t right.', 401);
        }
        await admin.from('video_access_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
        return unlocked(email);
    }

    return fail('Bad request.');
}
