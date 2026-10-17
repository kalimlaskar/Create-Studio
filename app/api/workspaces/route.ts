import { getStudioUser } from '@/lib/videos/server';
import { syncSeatLimit, workspaceErrorMessage } from '@/lib/workspaces/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Creates a team workspace owned by the caller and switches to it. */
export async function POST(request: Request) {
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { name?: unknown } | null;
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!name) return fail('Give the workspace a name.');

    const { data: id, error } = await user.supabase.rpc('create_workspace', { p_name: name });
    if (error || !id) {
        console.error('Could not create workspace:', error);
        return fail(workspaceErrorMessage(error, 'Could not create the workspace.'), error?.code === '54000' ? 403 : 500);
    }
    await Promise.all([user.supabase.rpc('set_active_workspace', { p_workspace: id }), syncSeatLimit(id as string)]);
    return Response.json({ workspaceId: id });
}
