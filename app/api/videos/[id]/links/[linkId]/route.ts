import { getStudioUser, LINK_COLUMNS, toShareLink, type ShareLinkRow } from '@/lib/videos/server';

/** Turns a link off or back on. Turned-off links show "This video isn't available". */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; linkId: string }> }) {
    const { id, linkId } = await params;
    const user = await getStudioUser();
    if (!user) return Response.json({ error: 'Sign in again.' }, { status: 401 });

    const body = await request.json().catch(() => null) as { active?: unknown } | null;
    if (typeof body?.active !== 'boolean') return Response.json({ error: 'Say whether the link should be active.' }, { status: 400 });

    const { data, error } = await user.supabase.from('share_links')
        .update({ revoked_at: body.active ? null : new Date().toISOString() })
        .eq('id', linkId).eq('video_id', id).select(LINK_COLUMNS).single();
    if (error || !data) return Response.json({ error: 'Could not update the link.' }, { status: 500 });
    return Response.json({ link: toShareLink(data as ShareLinkRow) });
}
