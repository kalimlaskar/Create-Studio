import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEMO_SESSION_COOKIE = 'creator-studio-demo-session';
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const LOCAL_DEMO_USERNAME = 'teacher';
const LOCAL_DEMO_PASSWORD = 'lesson-demo-2026';

function hasSupabaseConfig() {
    return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isDemoAuthEnabled() {
    const explicitlyEnabled = process.env.TEMP_AUTH_ENABLED;
    if (hasSupabaseConfig() || explicitlyEnabled === 'false') return false;
    if (process.env.NODE_ENV !== 'production') return true;
    return explicitlyEnabled === 'true'
        && Boolean(process.env.TEMP_AUTH_USERNAME)
        && Boolean(process.env.TEMP_AUTH_PASSWORD)
        && Boolean(process.env.TEMP_AUTH_SECRET && process.env.TEMP_AUTH_SECRET.length >= 32);
}

export function shouldShowLocalDemoCredentials() {
    return process.env.NODE_ENV !== 'production'
        && isDemoAuthEnabled()
        && !process.env.TEMP_AUTH_USERNAME
        && !process.env.TEMP_AUTH_PASSWORD;
}

function getCredentials() {
    const localFallbackAllowed = process.env.NODE_ENV !== 'production';
    return {
        username: process.env.TEMP_AUTH_USERNAME ?? (localFallbackAllowed ? LOCAL_DEMO_USERNAME : ''),
        password: process.env.TEMP_AUTH_PASSWORD ?? (localFallbackAllowed ? LOCAL_DEMO_PASSWORD : ''),
    };
}

export function getTemporaryAuthUsername() {
    return getCredentials().username;
}

function getDemoSecret() {
    return process.env.TEMP_AUTH_SECRET || (process.env.NODE_ENV !== 'production' ? 'local-development-only-demo-session-signing-secret' : '');
}

function sign(payload: string) {
    return createHmac('sha256', getDemoSecret()).update(payload).digest('base64url');
}

export function verifyDemoCredentials(username: string, password: string) {
    if (!isDemoAuthEnabled()) return false;
    const credentials = getCredentials();
    return constantTimeEquals(username.trim(), credentials.username) && constantTimeEquals(password, credentials.password);
}

function constantTimeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createDemoSessionToken() {
    if (!isDemoAuthEnabled()) return null;
    const { username } = getCredentials();
    const payload = Buffer.from(JSON.stringify({ sub: 'temporary-tester', role: 'tester', username, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS })).toString('base64url');
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
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; role?: string; username?: string; exp?: number };
        const { username } = getCredentials();
        return session.sub === 'temporary-tester' && session.role === 'tester' && session.username === username && typeof session.exp === 'number' && session.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

export function getDemoSessionUsername(token: string | undefined | null) {
    if (!verifyDemoSessionToken(token)) return null;
    try {
        const payload = token!.split('.')[0];
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { username?: string };
        return session.username ?? null;
    } catch {
        return null;
    }
}

export const DEMO_SESSION_MAX_AGE = SESSION_LIFETIME_SECONDS;
