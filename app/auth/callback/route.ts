import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function safeNext(value: string | null) {
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/studio';
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const destination = new URL(safeNext(searchParams.get('next')), origin);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!code || !url || !key) {
        destination.pathname = '/login';
        destination.searchParams.set('error', 'The confirmation link is invalid or expired. Please request a new one.');
        return NextResponse.redirect(destination);
    }

    const response = NextResponse.redirect(destination);
    const supabase = createServerClient(url, key, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet, cacheHeaders) => {
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                Object.entries(cacheHeaders ?? {}).forEach(([name, value]) => response.headers.set(name, value));
            },
        },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        const login = new URL('/login', origin);
        login.searchParams.set('error', 'That confirmation link could not be verified. Try signing in or request a fresh link.');
        return NextResponse.redirect(login);
    }

    return response;
}
