import { getStudioUser } from '@/lib/videos/server';
import { siteUrlFor } from '@/lib/integrations/notify';
import { isInviteEmailConfigured, listInvites, sendInviteEmail, syncSeatLimit, workspaceErrorMessage } from '@/lib/workspaces/server';

const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Invites someone by email. The database checks the caller is an admin and that a seat
 * is free. The link is returned too, so it can be shared another way if email is down.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return fail('Sign in again.', 401);
    const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body?.role === 'admin' ? 'admin' : 'member';
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return fail('Enter a valid email address.');

    // The owner may have changed plan since the workspace was made.
    await syncSeatLimit(id);
    const { data: token, error } = await user.supabase.rpc('create_workspace_invite', { p_workspace: id, p_email: email, p_role: role });
    if (error || typeof token !== 'string') {
        if (error?.code === '54000') return Response.json({ error: workspaceErrorMessage(error, ''), upgradeUrl: '/pricing' }, { status: 403 });
        if (!error || !['42501', '22023', '23505'].includes(error.code)) console.error('Could not create invite:', error);
        return fail(workspaceErrorMessage(error, 'Could not create the invite.'), error?.code === '42501' ? 403 : error?.code === '23505' ? 409 : 400);
    }

    const inviteUrl = `${siteUrlFor(request)}/invite/${token}`;
    let emailSent = false;
    if (isInviteEmailConfigured()) {
        const [{ data: workspace }, { data: profile }] = await Promise.all([
            user.supabase.from('workspaces').select('name').eq('id', id).maybeSingle(),
            user.supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
        ]);
        try {
            await sendInviteEmail({ to: email, inviter: profile?.display_name?.trim() || null, workspaceName: workspace?.name ?? 'your team', url: inviteUrl });
            emailSent = true;
        } catch (sendError) {
            console.error('Could not email invite:', sendError);
        }
    }

    return Response.json({ invites: await listInvites(user.supabase, id), inviteUrl, emailSent });
}
