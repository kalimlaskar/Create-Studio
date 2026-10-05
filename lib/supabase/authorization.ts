import 'server-only';
import { cookies } from 'next/headers';
import { DEMO_SESSION_COOKIE, isDemoAuthEnabled, verifyDemoSessionToken } from '@/lib/auth/demo';
import { createSupabaseServerClient } from './server';

export async function hasAuthenticatedSupabaseUser() {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
        const cookieStore = await cookies();
        return isDemoAuthEnabled() && verifyDemoSessionToken(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
    }
    const { data, error } = await supabase.auth.getClaims();
    return !error && Boolean(data?.claims?.sub);
}
