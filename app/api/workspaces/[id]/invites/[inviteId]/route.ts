import { getStudioUser } from '@/lib/videos/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Cancels a pending invite, which frees its seat. Owners and admins only (row-level security). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
    const { id, inviteId } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data, error } = await user.supabase.from('workspace_invites').delete().eq('id', inviteId).eq('workspace_id', id).select('id');
    if (error) {
        console.error('Could not cancel invite:', error);
        return fail('Could not cancel the invite.', 500);
    }
    if (!data?.length) return fail('Invite not found.', 404);
    return Response.json({ ok: true });
}
