import { beforeAll, describe, expect, it } from 'vitest';
import { hashSecret, readUnlock, signUnlock, UNLOCK_TTL_S, verifySecret } from '@/lib/videos/access';
import { accessSecretProblem, emailAllowed, normalizeAccessEmails } from '@/lib/videos/types';

beforeAll(() => { process.env.VIDEO_ACCESS_SECRET = 'test-secret-for-unlock-tokens'; });

const video = { id: '5b1f0f9e-6a59-4c55-9b51-0c2f3a7d1e01', access_mode: 'pin' as const, access_version: 3 };

describe('PINs and passwords', () => {
    it('stores a hash that only the right value matches', async () => {
        const stored = await hashSecret('482913');
        expect(stored).not.toContain('482913');
        expect(await verifySecret('482913', stored)).toBe(true);
        expect(await verifySecret('482914', stored)).toBe(false);
        expect(await verifySecret('482913', null)).toBe(false);
    });

    it('checks PIN and password rules', () => {
        expect(accessSecretProblem('pin', '1234')).not.toBeNull();
        expect(accessSecretProblem('pin', '12a456')).not.toBeNull();
        expect(accessSecretProblem('pin', '123456')).toBeNull();
        expect(accessSecretProblem('password', 'short')).not.toBeNull();
        expect(accessSecretProblem('password', 'long enough')).toBeNull();
    });
});

describe('unlock tokens', () => {
    it('unlocks the video it was issued for, with the verified email', () => {
        const token = signUnlock(video, 'ana@acme.com')!;
        expect(readUnlock(token, video)).toEqual({ email: 'ana@acme.com' });
    });

    it('rejects tokens for another video, an old version, after expiry, or tampered', () => {
        const token = signUnlock(video, null)!;
        expect(readUnlock(token, { ...video, id: '00000000-0000-4000-8000-000000000000' })).toBeNull();
        // Changing the protection bumps the version and signs everyone out.
        expect(readUnlock(token, { ...video, access_version: 4 })).toBeNull();
        expect(readUnlock(token, video, Date.now() + (UNLOCK_TTL_S + 60) * 1000)).toBeNull();
        const [payload, signature] = token.split('.');
        const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), e: 'mallory@evil.io' })).toString('base64url');
        expect(readUnlock(`${forged}.${signature}`, video)).toBeNull();
        expect(readUnlock('nonsense', video)).toBeNull();
        expect(readUnlock(undefined, video)).toBeNull();
    });
});

describe('email allow list', () => {
    it('cleans addresses and company domains', () => {
        expect(normalizeAccessEmails([' Ana@Acme.com ', '@acme.com', '', 'ana@acme.com'])).toEqual(['ana@acme.com', '@acme.com']);
        expect(normalizeAccessEmails(['not an email'])).toBeNull();
        expect(normalizeAccessEmails(['@nodot'])).toBeNull();
    });

    it('matches addresses and domains, and allows anyone when empty', () => {
        expect(emailAllowed('ana@acme.com', [])).toBe(true);
        expect(emailAllowed('Ana@Acme.com', ['ana@acme.com'])).toBe(true);
        expect(emailAllowed('bo@acme.com', ['@acme.com'])).toBe(true);
        expect(emailAllowed('bo@notacme.com', ['@acme.com'])).toBe(false);
        expect(emailAllowed('bo@other.com', ['ana@acme.com'])).toBe(false);
    });
});
