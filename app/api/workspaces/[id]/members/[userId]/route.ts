import { getStudioUser } from '@/lib/videos/server';
import { workspaceErrorMessage } from '@/lib/workspaces/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Makes a member an admin or back. Only the owner can (checked by the database). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
    const { id, userId } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { role?: unknown } | null;
    if (body?.role !== 'admin' && body?.role !== 'member') return fail('Choose admin or member.');

    const { error } = await user.supabase.rpc('set_workspace_member_role', { p_workspace: id, p_user: userId, p_role: body.role });
    if (error) return fail(workspaceErrorMessage(error, 'Could not change the role.'), error.code === '42501' ? 403 : 400);
    return Response.json({ ok: true });
}

/**
 * Removes someone from the workspace, or leaves it when it's the caller. The videos they
 * made stay with the team. Admins can remove members and admins; nobody removes the owner.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
    const { id, userId } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const { data, error } = await user.supabase.from('workspace_members').delete().eq('workspace_id', id).eq('user_id', userId).select('user_id');
    if (error) {
        console.error('Could not remove member:', error);
        return fail('Could not remove them from the workspace.', 500);
    }
    if (!data?.length) {
        return fail(userId === user.id ? 'The owner can’t leave their own workspace.' : 'Only the owner and admins can remove people, and the owner can’t be removed.', 403);
    }
    return Response.json({ ok: true, left: userId === user.id });
}
