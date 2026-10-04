import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEMO_USERNAME = 'teacher';
export const DEMO_PASSWORD = 'lesson-demo-2026';
export const DEMO_SESSION_COOKIE = 'creator-studio-demo-session';
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

function hasSupabaseConfig() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isDemoAuthEnabled() {
    const explicitlyEnabled = process.env.TEMP_AUTH_ENABLED;
    return process.env.NODE_ENV !== 'production'
        && !hasSupabaseConfig()
        && explicitlyEnabled !== 'false';
}

function getDemoSecret() {
    return process.env.TEMP_AUTH_SECRET || 'local-development-only-demo-session-signing-secret';
}

function sign(payload: string) {
    return createHmac('sha256', getDemoSecret()).update(payload).digest('base64url');
}

export function verifyDemoCredentials(username: string, password: string) {
    if (!isDemoAuthEnabled()) return false;
    return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD;
}

export function createDemoSessionToken() {
    if (!isDemoAuthEnabled()) return null;
    const payload = Buffer.from(JSON.stringify({ sub: 'local-demo-admin', role: 'admin', username: DEMO_USERNAME, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifyDemoSessionToken(token: string | undefined | null) {
    if (!token || !isDemoAuthEnabled()) return false;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; role?: string; exp?: number };
        return session.sub === 'local-demo-admin' && session.role === 'admin' && typeof session.exp === 'number' && session.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

export const DEMO_SESSION_MAX_AGE = SESSION_LIFETIME_SECONDS;
