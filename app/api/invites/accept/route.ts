import { getStudioUser } from '@/lib/videos/server';
import { workspaceErrorMessage } from '@/lib/workspaces/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Joins the workspace an invite link is for, then switches to it. */
export async function POST(request: Request) {
    const user = await getStudioUser();
    if (!user) return fail('Sign in to accept the invite.', 401);
    const body = await request.json().catch(() => null) as { token?: unknown } | null;
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!/^[0-9a-f]{48}$/.test(token)) return fail('This invite link isn’t valid.');

    const { data: workspaceId, error } = await user.supabase.rpc('accept_workspace_invite', { p_token: token });
    if (error || !workspaceId) {
        if (!error || !['42501', '54000', 'P0002'].includes(error.code)) console.error('Could not accept invite:', error);
        return fail(workspaceErrorMessage(error, 'Could not accept the invite.'), error?.code === '42501' ? 403 : 400);
    }
    await user.supabase.rpc('set_active_workspace', { p_workspace: workspaceId });
    return Response.json({ workspaceId });
}
