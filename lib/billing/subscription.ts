import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function getCurrentUser() {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getClaims();
    const id = data?.claims?.sub;
    if (error || !id) return null;
    return { id, email: typeof data.claims.email === 'string' ? data.claims.email : undefined, supabase };
}

export function isEntitled(row: { status: string; current_period_end: string | null } | null) {
    if (!row) return false;
    if (row.status === 'active') return true;
    return (row.status === 'pending' || row.status === 'cancelled') && Boolean(row.current_period_end) && new Date(row.current_period_end as string) > new Date();
}
