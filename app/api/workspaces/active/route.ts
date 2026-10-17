import { getStudioUser } from '@/lib/videos/server';
import { workspaceErrorMessage } from '@/lib/workspaces/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Switches the workspace the studio shows and new videos go into. */
export async function POST(request: Request) {
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { workspaceId?: unknown } | null;
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    if (!/^[0-9a-f-]{36}$/.test(workspaceId)) return fail('Choose a workspace.');

    const { error } = await user.supabase.rpc('set_active_workspace', { p_workspace: workspaceId });
    if (error) return fail(workspaceErrorMessage(error, 'Could not switch workspace.'), error.code === '42501' ? 403 : 500);
    return Response.json({ ok: true });
}
