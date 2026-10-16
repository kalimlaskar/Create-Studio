import { getStudioUser, loadAnalytics, VIDEO_COLUMNS, type VideoRow } from '@/lib/videos/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getStudioUser();
    if (!user) return Response.json({ error: 'Sign in again.' }, { status: 401 });

    const { data: row } = await user.supabase.from('videos').select(VIDEO_COLUMNS).eq('id', id).maybeSingle();
    if (!row) return Response.json({ error: 'Video not found.' }, { status: 404 });
    try {
        const analytics = await loadAnalytics(user.supabase, row as VideoRow);
        return Response.json({ analytics }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Could not load analytics:', error);
        return Response.json({ error: 'Could not load analytics.' }, { status: 500 });
    }
}
