import { isR2Configured } from '@/lib/storage/r2';
import { getStudioUser, isMissingTable, MISSING_TABLES_MESSAGE } from '@/lib/videos/server';

/** Tells the export dialog upfront whether "Share link" can work, and why not. */
export async function GET() {
    const headers = { 'Cache-Control': 'no-store' };
    const user = await getStudioUser();
    if (!user) return Response.json({ ready: false, reason: 'Sign in to save videos to the cloud.' }, { headers });
    if (!isR2Configured()) return Response.json({ ready: false, reason: 'Cloud storage isn’t set up on this server yet.' }, { headers });
    const { error } = await user.supabase.from('videos').select('id').limit(1);
    if (error) return Response.json({ ready: false, reason: isMissingTable(error) ? MISSING_TABLES_MESSAGE : 'Cloud saving is unavailable right now.' }, { headers });
    return Response.json({ ready: true }, { headers });
}
