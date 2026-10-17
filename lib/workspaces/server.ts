import 'server-only';
import crypto from 'node:crypto';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPlanSummary } from '@/lib/plans/server';
import { getStudioUser } from '@/lib/videos/server';
import type { TeamInvite, TeamMember, WorkspaceRole, WorkspaceSummary } from './types';

// Teams (supabase/migrations/20261018000000_workspaces.sql). Membership and roles are
// enforced by row-level security and the database functions; this file only reads
// what the signed-in user may already see, plus a few lookups that need the service role.

type MembershipRow = { workspace_id: string; role: WorkspaceRole; created_at: string; workspaces: { name: string; seat_limit: number } | null };

/**
 * The signed-in user's workspaces and the one they're working in. Cached for the
 * request, so the sidebar and the page share one lookup. Null when signed out.
 */
export const getWorkspaceContext = cache(async () => {
    const user = await getStudioUser();
    if (!user) return null;
    const [{ data: memberships, error }, { data: profile }] = await Promise.all([
        user.supabase.from('workspace_members').select('workspace_id,role,created_at,workspaces(name,seat_limit)').eq('user_id', user.id).order('created_at'),
        user.supabase.from('profiles').select('active_workspace_id').eq('id', user.id).maybeSingle(),
    ]);
    if (error) {
        // Before the workspaces migration: everything still works per account.
        if (error.code !== 'PGRST205' && error.code !== '42703') console.error('Could not load workspaces:', error.message);
        return { user, workspaces: [] as WorkspaceSummary[], active: null };
    }
    const workspaces: WorkspaceSummary[] = ((memberships ?? []) as unknown as MembershipRow[]).map((row) => ({
        id: row.workspace_id,
        name: row.workspaces?.name ?? 'Workspace',
        role: row.role,
        seatLimit: row.workspaces?.seat_limit ?? 1,
    }));
    // Matches public.default_workspace_id: the chosen one if still a member, else the first one they own.
    const active = workspaces.find((workspace) => workspace.id === profile?.active_workspace_id)
        ?? workspaces.find((workspace) => workspace.role === 'owner')
        ?? workspaces[0]
        ?? null;
    return { user, workspaces, active };
});

/** Narrows a query to the active workspace. Before the migration there's no workspace, so nothing is filtered. */
export function inWorkspace<Q>(query: Q, workspaceId: string | null | undefined): Q {
    // Typed loosely on purpose: Supabase's query builder types are too deep to constrain here.
    return workspaceId ? (query as unknown as { eq: (column: string, value: string) => Q }).eq('workspace_id', workspaceId) : query;
}

export const canManageTeam = (role: WorkspaceRole | null | undefined) => role === 'owner' || role === 'admin';

/**
 * Brings the workspace's seat limit in line with its owner's plan. Seats belong to the
 * plan of whoever owns the workspace; users can't change seat_limit themselves.
 */
export async function syncSeatLimit(workspaceId: string) {
    const admin = createSupabaseAdminClient();
    if (!admin) return null;
    const [{ data: owner }, { data: workspace }] = await Promise.all([
        admin.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('role', 'owner').maybeSingle(),
        admin.from('workspaces').select('seat_limit').eq('id', workspaceId).maybeSingle(),
    ]);
    if (!owner || !workspace) return null;
    const seats = Math.max(1, Math.min(1000, (await getPlanSummary(owner.user_id)).limits.seats ?? 1));
    if (seats !== workspace.seat_limit) {
        const { error } = await admin.from('workspaces').update({ seat_limit: seats, updated_at: new Date().toISOString() }).eq('id', workspaceId);
        if (error) console.error('Could not update seat limit:', error.message);
    }
    return seats;
}

/** Everyone in a workspace with their names and emails. The caller must already be a member. */
export async function listMembers(supabase: SupabaseClient, workspaceId: string): Promise<TeamMember[]> {
    // Row-level security only returns these rows to members, which is the access check.
    const { data, error } = await supabase.from('workspace_members').select('user_id,role,created_at').eq('workspace_id', workspaceId).order('created_at');
    if (error) throw error;
    const rows = (data ?? []) as Array<{ user_id: string; role: WorkspaceRole; created_at: string }>;
    if (!rows.length) return [];

    // Profiles are private to each user, so teammates' names come through the service role.
    const admin = createSupabaseAdminClient();
    const ids = rows.map((row) => row.user_id);
    const [profiles, emails] = await Promise.all([
        admin ? admin.from('profiles').select('id,display_name,avatar_path').in('id', ids).then(({ data: list }) => list ?? []) : Promise.resolve([]),
        admin ? Promise.all(ids.map((id) => admin.auth.admin.getUserById(id).then(({ data: found }) => [id, found.user?.email ?? null] as const))) : Promise.resolve([]),
    ]);
    const profileOf = new Map(profiles.map((profile) => [profile.id as string, profile]));
    const emailOf = new Map(emails);

    return rows.map((row) => {
        const profile = profileOf.get(row.user_id);
        const email = emailOf.get(row.user_id) ?? null;
        return {
            userId: row.user_id,
            role: row.role,
            name: profile?.display_name?.trim() || email?.split('@')[0] || 'Teammate',
            email,
            avatarUrl: profile?.avatar_path && admin ? admin.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl : null,
            joinedAt: row.created_at,
        };
    });
}

/** Pending invites. Row-level security returns them only to owners and admins. */
export async function listInvites(supabase: SupabaseClient, workspaceId: string): Promise<TeamInvite[]> {
    const { data } = await supabase.from('workspace_invites').select('id,email,role,expires_at,created_at')
        .eq('workspace_id', workspaceId).is('accepted_at', null).order('created_at', { ascending: false });
    return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        expired: new Date(row.expires_at).getTime() < Date.now(),
    }));
}

export const hashInviteToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** What the invite page shows before someone accepts: who invited them, to what, and for which email. */
export async function findInvite(token: string) {
    if (!/^[0-9a-f]{48}$/.test(token)) return null;
    const admin = createSupabaseAdminClient();
    if (!admin) return null;
    const { data } = await admin.from('workspace_invites').select('id,email,role,expires_at,accepted_at,invited_by,workspaces(name)')
        .eq('token_hash', hashInviteToken(token)).maybeSingle();
    if (!data) return null;
    const row = data as unknown as { email: string; role: WorkspaceRole; expires_at: string; accepted_at: string | null; invited_by: string | null; workspaces: { name: string } | null };
    const { data: inviter } = row.invited_by ? await admin.from('profiles').select('display_name').eq('id', row.invited_by).maybeSingle() : { data: null };
    return {
        email: row.email,
        role: row.role,
        workspaceName: row.workspaces?.name ?? 'a workspace',
        inviterName: inviter?.display_name?.trim() || null,
        usable: !row.accepted_at && new Date(row.expires_at).getTime() > Date.now(),
    };
}

/**
 * Turns an error raised by the workspace database functions into a sentence for the
 * person. Those functions raise readable messages; anything else gets the fallback.
 */
export function workspaceErrorMessage(error: unknown, fallback: string) {
    const { code, message } = (error ?? {}) as { code?: string; message?: string };
    if (!message || !code || !['42501', '22023', '23505', '54000', 'P0002'].includes(code)) return fallback;
    // RLS refusals ("new row violates row-level security…") aren't meant for people.
    if (/row-level security|permission denied/i.test(message)) return fallback;
    const sentence = message.charAt(0).toUpperCase() + message.slice(1);
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/* --------------------------------- Email -------------------------------- */

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export const isInviteEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ACCESS_EMAIL_FROM);

/** Sends the invite link through Resend's HTTP API (the same sender as video access codes). */
export async function sendInviteEmail({ to, inviter, workspaceName, url }: { to: string; inviter: string | null; workspaceName: string; url: string }) {
    const from = inviter ? `${inviter} via Cliprame` : 'Cliprame';
    const who = inviter ?? 'A teammate';
    const subject = `${who} invited you to ${workspaceName.slice(0, 80)} on Cliprame`;
    const text = `${who} invited you to join ${workspaceName} on Cliprame, to share videos, viewer analytics and leads with the team.\n\nJoin here: ${url}\n\nThe link works for 7 days, for ${to} only. If you weren’t expecting this, you can ignore this email.`;
    const html = `<div style="font-family:system-ui,sans-serif;color:#14121F;max-width:440px">
<p style="font-size:15px"><strong>${escapeHtml(who)}</strong> invited you to join <strong>${escapeHtml(workspaceName)}</strong> on Cliprame, to share videos, viewer analytics and leads with the team.</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#14121F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px">Join the workspace</a></p>
<p style="font-size:13px;color:#6b6878">The link works for 7 days, for ${escapeHtml(to)} only. If you weren’t expecting this, you can ignore this email.</p></div>`;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${from.replace(/[<>"]/g, '')} <${process.env.ACCESS_EMAIL_FROM}>`, to: [to], subject, text, html }),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}: ${(await response.text()).slice(0, 200)}`);
}
