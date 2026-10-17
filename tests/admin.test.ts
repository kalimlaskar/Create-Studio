import { describe, expect, it } from 'vitest';
import { adminEmailList, isAdminEmail, reportReason } from '@/lib/admin/emails';

describe('super admins', () => {
    const list = adminEmailList(' Kalim007mailbox@gmail.com , not-an-email, ops@cliprame.com ');

    it('reads the list from the setting, ignoring junk', () => {
        expect(list).toEqual(['kalim007mailbox@gmail.com', 'ops@cliprame.com']);
        expect(adminEmailList('')).toEqual([]);
        // Quotes pasted into the hosting dashboard's value box are ignored.
        expect(adminEmailList('"ops@cliprame.com"')).toEqual(['ops@cliprame.com']);
    });

    it('only lets in a confirmed, listed email', () => {
        expect(isAdminEmail('KALIM007MAILBOX@gmail.com', true, list)).toBe(true);
        // Signing up with the admin's address but never confirming it gets nothing.
        expect(isAdminEmail('kalim007mailbox@gmail.com', false, list)).toBe(false);
        expect(isAdminEmail('someone@gmail.com', true, list)).toBe(false);
        expect(isAdminEmail(null, true, list)).toBe(false);
    });
});

describe('reports', () => {
    it('marks consent and child safety reports as urgent', () => {
        expect(reportReason('nonconsensual')?.urgent).toBe(true);
        expect(reportReason('child_safety')?.urgent).toBe(true);
        expect(reportReason('spam')?.urgent).toBe(false);
        expect(reportReason('made-up')).toBeNull();
    });
});
