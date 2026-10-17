import { getStudioUser } from '@/lib/videos/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** Renames a workspace. Row-level security lets only its owner and admins do this. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { name?: unknown } | null;
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : '';
    if (!name) return fail('Give the workspace a name.');

    const { data, error } = await user.supabase.from('workspaces').update({ name, updated_at: new Date().toISOString() }).eq('id', id).select('id,name').maybeSingle();
    if (error) {
        console.error('Could not rename workspace:', error);
        return fail('Could not rename the workspace.', 500);
    }
    if (!data) return fail('Only the owner and admins can rename this workspace.', 403);
    return Response.json({ workspace: data });
}
