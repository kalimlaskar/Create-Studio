import { redirect } from 'next/navigation';
import { VideosShell } from '@/components/videos/VideosShell';
import { TeamManager } from '@/components/team/TeamManager';
import { canManageTeam, getWorkspaceContext, isInviteEmailConfigured, listInvites, listMembers, syncSeatLimit } from '@/lib/workspaces/server';

export const metadata = { title: 'Team | Cliprame' };

const SETUP_MESSAGE = 'Team workspaces aren’t set up in the database yet. Run supabase/migrations/20261018000000_workspaces.sql in the Supabase SQL Editor.';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
    const [context, params] = await Promise.all([getWorkspaceContext(), searchParams]);
    if (!context) redirect('/login?next=/studio/team');
    const { user, workspaces, active } = context;

    if (!active) {
        return (
            <VideosShell title="Team">
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{SETUP_MESSAGE}</p>
            </VideosShell>
        );
    }

    // The seat limit follows the owner's plan, which may have changed since the last visit.
    const [seatLimit, members, invites] = await Promise.all([
        syncSeatLimit(active.id),
        listMembers(user.supabase, active.id),
        canManageTeam(active.role) ? listInvites(user.supabase, active.id) : Promise.resolve([]),
    ]);

    return (
        <VideosShell title="Team">
            <TeamManager
                workspace={{ ...active, seatLimit: seatLimit ?? active.seatLimit }}
                workspaces={workspaces}
                members={members}
                invites={invites}
                currentUserId={user.id}
                emailConfigured={isInviteEmailConfigured()}
                justJoined={params.joined === '1'}
            />
        </VideosShell>
    );
}
