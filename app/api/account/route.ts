import { getStudioUser } from '@/lib/videos/server';
import { loadAccountOverview } from '@/lib/studio/overview';

/** Plan and usage for the account menu. */
export async function GET() {
    const user = await getStudioUser();
    if (!user) return Response.json({ error: 'Sign in again.' }, { status: 401 });
    try {
        return Response.json({ overview: await loadAccountOverview(user.supabase, user.id) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Could not load the account overview:', error);
        return Response.json({ error: 'Could not load your usage.' }, { status: 500 });
    }
}
