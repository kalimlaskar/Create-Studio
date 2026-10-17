import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashInviteToken, inWorkspace, workspaceErrorMessage } from '@/lib/workspaces/server';

describe('workspaceErrorMessage', () => {
    it('turns messages raised by the workspace functions into sentences', () => {
        expect(workspaceErrorMessage({ code: '54000', message: 'every seat in this workspace is taken' }, 'x')).toBe('Every seat in this workspace is taken.');
        expect(workspaceErrorMessage({ code: '42501', message: 'this invite was sent to a different email address' }, 'x')).toBe('This invite was sent to a different email address.');
    });

    it('hides database internals behind the fallback', () => {
        expect(workspaceErrorMessage({ code: '42501', message: 'new row violates row-level security policy for table "videos"' }, 'Nope.')).toBe('Nope.');
        expect(workspaceErrorMessage({ code: '42501', message: 'permission denied for table workspaces' }, 'Nope.')).toBe('Nope.');
        expect(workspaceErrorMessage({ code: '08006', message: 'connection failure' }, 'Nope.')).toBe('Nope.');
        expect(workspaceErrorMessage(null, 'Nope.')).toBe('Nope.');
    });
});

describe('invite tokens', () => {
    it('hashes the same way as the database (sha256, hex)', () => {
        const token = crypto.randomBytes(24).toString('hex');
        expect(hashInviteToken(token)).toBe(crypto.createHash('sha256').update(token).digest('hex'));
        expect(hashInviteToken(token)).toHaveLength(64);
    });
});

describe('inWorkspace', () => {
    const query = () => {
        const calls: Array<[string, string]> = [];
        const builder = { calls, eq(column: string, value: string) { calls.push([column, value]); return builder; } };
        return builder;
    };

    it('filters by workspace when there is one', () => {
        expect(inWorkspace(query(), 'ws-1').calls).toEqual([['workspace_id', 'ws-1']]);
    });

    it('leaves the query alone before the migration (no workspace)', () => {
        expect(inWorkspace(query(), null).calls).toEqual([]);
    });
});
