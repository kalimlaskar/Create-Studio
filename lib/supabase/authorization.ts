import 'server-only';
import { createSupabaseServerClient } from './server';

export async function hasAuthenticatedSupabaseUser() {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return false;
    const { data, error } = await supabase.auth.getClaims();
    return !error && Boolean(data?.claims?.sub);
}
