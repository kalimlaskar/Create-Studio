import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSupabaseSession(request: NextRequest) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    let response = NextResponse.next({ request });

    if (!url || !key) return { response, isAuthenticated: false };

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, cacheHeaders) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => response.headers.set(name, value));
            },
        },
    });

    const { data, error } = await supabase.auth.getClaims();
    return { response, isAuthenticated: !error && Boolean(data?.claims?.sub) };
}
