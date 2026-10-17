import 'server-only';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notificationSummary, type Integration, type IntegrationKind, type NotificationPayload, type NotificationType } from './types';

// Sends viewing notifications to webhooks, Slack and HubSpot. Targets (URLs and
// tokens) are encrypted at rest and only decrypted here, on the server.

export interface IntegrationRow {
    id: string;
    owner_id: string;
    kind: IntegrationKind;
    name: string;
    target_encrypted: string;
    target_hint: string;
    secret_encrypted: string | null;
    events: NotificationType[];
    identified_only: boolean;
    enabled: boolean;
    last_status: 'ok' | 'failed' | null;
    last_error: string | null;
    last_delivered_at: string | null;
    created_at: string;
}

/** Everything the settings page may see; never the encrypted columns. */
export const INTEGRATION_COLUMNS = 'id,kind,name,target_hint,events,identified_only,enabled,last_status,last_error,last_delivered_at,created_at';

export function toIntegration(row: Omit<IntegrationRow, 'owner_id' | 'target_encrypted' | 'secret_encrypted'>): Integration {
    return {
        id: row.id,
        kind: row.kind,
        name: row.name,
        targetHint: row.target_hint,
        events: row.events,
        identifiedOnly: row.identified_only,
        enabled: row.enabled,
        lastStatus: row.last_status,
        lastError: row.last_error,
        lastDeliveredAt: row.last_delivered_at,
        createdAt: row.created_at,
    };
}

/* ------------------------------ Encryption ------------------------------ */

function encryptionKey() {
    const secret = process.env.INTEGRATIONS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) throw new Error('Set INTEGRATIONS_SECRET to store integrations.');
    return crypto.createHash('sha256').update(`cliprame-integrations:${secret}`).digest();
}

export function encrypt(text: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}

export function decrypt(value: string) {
    const [version, iv, tag, data] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable integration secret.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/* ------------------------------ Validation ------------------------------ */

/** Addresses a webhook must never reach: this machine, private networks and cloud metadata. */
export function isPrivateAddress(address: string) {
    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
    }
    if (net.isIPv6(address)) {
        const clean = address.toLowerCase();
        if (clean.startsWith('::ffff:')) return isPrivateAddress(clean.slice(7));
        return clean === '::' || clean === '::1' || clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80');
    }
    return false;
}

export function publicHttpsUrl(value: string) {
    let url: URL;
    try { url = new URL(value.trim()); } catch { return null; }
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || isPrivateAddress(host)) return null;
    return url;
}

const hintFor = (url: URL) => `${url.hostname}/…/${url.pathname.replace(/\/+$/, '').slice(-4)}`;

/** Checks what the creator pasted. Returns the value to store and a safe preview, or an error message. */
export async function prepareTarget(kind: IntegrationKind, input: unknown): Promise<{ target: string; hint: string } | { error: string }> {
    const value = typeof input === 'string' ? input.trim() : '';
    if (!value || value.length > 2000) return { error: kind === 'hubspot' ? 'Paste your HubSpot access token.' : 'Paste the URL.' };

    if (kind === 'slack') {
        const url = publicHttpsUrl(value);
        if (!url || url.hostname !== 'hooks.slack.com' || !url.pathname.startsWith('/services/')) return { error: 'Paste a Slack incoming webhook URL. It starts with https://hooks.slack.com/services/' };
        return { target: url.href, hint: hintFor(url) };
    }
    if (kind === 'webhook') {
        const url = publicHttpsUrl(value);
        if (!url) return { error: 'Use a public https:// URL.' };
        return { target: url.href, hint: hintFor(url) };
    }

    if (!/^pat-[a-z0-9-]{10,200}$/i.test(value)) return { error: 'Paste the access token of a HubSpot private app. It starts with “pat-”.' };
    const check = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!check) return { error: 'Couldn’t reach HubSpot. Try again.' };
    if (check.status === 401) return { error: 'HubSpot didn’t accept that token.' };
    if (check.status === 403) return { error: 'The token needs the crm.objects.contacts.read and crm.objects.contacts.write scopes.' };
    if (!check.ok) return { error: `HubSpot answered ${check.status}. Try again.` };
    return { target: value, hint: `pat-…${value.slice(-4)}` };
}

/**
 * The owner's existing integration that already sends to this target, if any. Targets are
 * encrypted with a random IV, so they're compared after decrypting (an owner has at most 20).
 */
export async function findDuplicate(supabase: SupabaseClient, kind: IntegrationKind, target: string, exceptId?: string) {
    const { data } = await supabase.from('integrations').select('id,name,target_encrypted').eq('kind', kind);
    const same = (stored: string) => {
        try { return decrypt(stored) === target; } catch { return false; }
    };
    return (data ?? []).find((row) => row.id !== exceptId && same(row.target_encrypted)) as { id: string; name: string } | undefined;
}

export const newWebhookSecret = () => `whsec_${crypto.randomBytes(24).toString('base64url')}`;

/** "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${body}`>", the same scheme as Stripe. */
export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${signature}`;
}

/* ------------------------------- Delivery ------------------------------- */

type Result = { ok: true } | { ok: false; error: string; retry: boolean } | { skipped: string };

const TIMEOUT_MS = 8000;

/** Re-checks the address at send time, so a hostname can't later be pointed at a private network. */
export async function resolvesPublic(url: string) {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host)) return !isPrivateAddress(host);
    const addresses = await dns.lookup(host, { all: true }).catch(() => []);
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
}

async function post(url: string, body: string, headers: Record<string, string>): Promise<Result> {
    if (!(await resolvesPublic(url))) return { ok: false, error: 'The URL points to a private network address.', retry: false };
    try {
        const response = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Cliprame-Webhooks/1.0', ...headers }, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (response.ok) return { ok: true };
        return { ok: false, error: `Answered ${response.status} ${response.statusText}`.trim(), retry: response.status >= 500 || response.status === 429 };
    } catch (error) {
        return { ok: false, error: (error as Error).name === 'TimeoutError' ? 'Timed out after 8 seconds' : 'Couldn’t connect', retry: true };
    }
}

const slackEscape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function slackMessage(payload: NotificationPayload) {
    const { viewer, watch, video } = payload;
    const who = slackEscape(viewer.name || viewer.email || 'Someone') + (viewer.company ? ` (${slackEscape(viewer.company)})` : '');
    const title = `<${video.shareUrl}|${slackEscape(video.title)}>`;
    const action = payload.type === 'video.completed' ? `watched ${title} to the end`
        : payload.type === 'cta.clicked' ? `clicked the button on ${title}`
        : payload.type === 'form.submitted' ? `filled in *${slackEscape(payload.form?.title ?? 'a form')}* on ${title}`
        : payload.type === 'call.booked' ? `booked a call from ${title}`
        : `started watching ${title}`;
    const details = [
        `${Math.round(watch.percentWatched * 100)}% watched`,
        viewer.email && viewer.name !== viewer.email ? slackEscape(viewer.email) : null,
        viewer.device,
        viewer.country,
        viewer.source === 'embed' ? `on ${slackEscape(viewer.website ?? 'a website')}` : null,
        payload.test ? 'test message' : null,
    ].filter(Boolean).join(' · ');
    // Form answers as "label: value" lines (hidden fields stay out of the channel).
    const answers = payload.form ? Object.entries(payload.form.values).slice(0, 10).map(([key, value]) => `*${slackEscape(key)}:* ${slackEscape(value.slice(0, 200))}`).join('\n') : '';
    return {
        text: notificationSummary(payload),
        blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: `*${who}* ${action}` }, accessory: { type: 'button', text: { type: 'plain_text', text: 'View analytics' }, url: video.analyticsUrl } },
            ...(answers ? [{ type: 'section', text: { type: 'mrkdwn', text: answers } }] : []),
            { type: 'context', elements: [{ type: 'mrkdwn', text: details }] },
        ],
    };
}

async function hubspot(token: string, payload: NotificationPayload): Promise<Result> {
    const email = payload.viewer.email;
    if (!email) return { skipped: 'HubSpot only logs viewers with an email address.' };
    const call = async (path: string, body: unknown) => {
        const response = await fetch(`https://api.hubapi.com${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) throw Object.assign(new Error(`HubSpot answered ${response.status}`), { status: response.status });
        return response.json() as Promise<{ id?: string; results?: Array<{ id: string }> }>;
    };
    try {
        const found = await call('/crm/v3/objects/contacts/search', { filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], properties: ['email'], limit: 1 });
        let contactId = found.results?.[0]?.id;
        if (!contactId) {
            const [firstname, ...rest] = (payload.viewer.name && payload.viewer.name !== email ? payload.viewer.name : '').split(/\s+/);
            const created = await call('/crm/v3/objects/contacts', { properties: { email, ...(firstname ? { firstname } : {}), ...(rest.length ? { lastname: rest.join(' ') } : {}), ...(payload.viewer.company ? { company: payload.viewer.company } : {}) } });
            contactId = created.id;
        }
        const answers = payload.form
            ? `<ul>${Object.entries({ ...payload.form.values, ...payload.form.hidden }).slice(0, 25).map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value.slice(0, 300))}</li>`).join('')}</ul>`
            : '';
        const body = `<p><strong>${escapeHtml(notificationSummary(payload))}</strong></p>${answers}<p>${Math.round(payload.watch.percentWatched * 100)}% watched${payload.watch.ctaClicked ? ' · clicked the button' : ''}. <a href="${payload.video.analyticsUrl}">View analytics in Cliprame</a></p>`;
        // 202 is HubSpot's built-in "note to contact" association.
        await call('/crm/v3/objects/notes', {
            properties: { hs_timestamp: payload.createdAt, hs_note_body: body },
            associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
        });
        return { ok: true };
    } catch (error) {
        const status = (error as { status?: number }).status;
        return { ok: false, error: (error as Error).name === 'TimeoutError' ? 'HubSpot timed out' : (error as Error).message, retry: !status || status >= 500 || status === 429 };
    }
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

async function deliverOnce(row: IntegrationRow, payload: NotificationPayload): Promise<Result> {
    const target = decrypt(row.target_encrypted);
    if (row.kind === 'slack') return post(target, JSON.stringify(slackMessage(payload)), {});
    if (row.kind === 'hubspot') return hubspot(target, payload);
    const body = JSON.stringify(payload);
    const secret = row.secret_encrypted ? decrypt(row.secret_encrypted) : '';
    return post(target, body, { 'Cliprame-Event': payload.type, 'Cliprame-Delivery': payload.id, 'Cliprame-Signature': signWebhook(secret, body) });
}

/** Sends one notification to one integration (retrying once) and records how it went. */
export async function deliver(admin: SupabaseClient, row: IntegrationRow, payload: NotificationPayload): Promise<Result> {
    let result: Result;
    try {
        result = await deliverOnce(row, payload);
        if ('retry' in result && result.retry) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            result = await deliverOnce(row, payload);
        }
    } catch (error) {
        result = { ok: false, error: (error as Error).message.slice(0, 200), retry: false };
    }
    if (!('skipped' in result)) {
        await admin.from('integrations').update({
            last_status: result.ok ? 'ok' : 'failed',
            last_error: result.ok ? null : result.error.slice(0, 300),
            last_delivered_at: new Date().toISOString(),
        }).eq('id', row.id);
    }
    return result;
}

/** Sends notifications to every matching integration of the video's owner. */
export async function dispatchNotifications(admin: SupabaseClient, ownerId: string, payloads: NotificationPayload[]) {
    if (!payloads.length) return;
    const { data: rows } = await admin.from('integrations').select('*').eq('owner_id', ownerId).eq('enabled', true);
    const jobs = (rows as IntegrationRow[] | null ?? []).flatMap((row) => payloads
        .filter((payload) => row.events.includes(payload.type) && (!row.identified_only || payload.viewer.identified))
        .map((payload) => deliver(admin, row, payload)));
    const results = await Promise.allSettled(jobs);
    results.forEach((result) => { if (result.status === 'rejected') console.error('Integration delivery crashed:', result.reason); });
}
