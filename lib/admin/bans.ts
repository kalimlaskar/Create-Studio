import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/** Whether an admin has banned this account. Bans are only readable with the service role. */
export async function isAccountBanned(userId: string) {
    const admin = createSupabaseAdminClient();
    if (!admin) return false;
    const { data } = await admin.from('account_bans').select('user_id').eq('user_id', userId).maybeSingle();
    return Boolean(data);
}
