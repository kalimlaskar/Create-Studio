import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isR2Configured } from '@/lib/storage/r2';

// For uptime monitors and a status page (e.g. Better Stack or UptimeRobot): returns 200
// when the database answers and storage is configured, 503 otherwise. No secrets are exposed.
export const dynamic = 'force-dynamic';

export async function GET() {
    const started = Date.now();
    const admin = createSupabaseAdminClient();
    let database = false;
    if (admin) {
        const { error } = await admin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
        database = !error;
    }
    const storage = isR2Configured();
    const ok = database && storage;
    return Response.json(
        { status: ok ? 'ok' : 'degraded', checks: { database, storage }, responseMs: Date.now() - started },
        { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
}
