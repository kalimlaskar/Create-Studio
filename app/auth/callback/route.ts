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
        if (process.env.NODE_ENV === 'development') {
            console.error('Supabase confirmation exchange failed:', { status: error.status, code: error.code, message: error.message });
        }
        const login = new URL('/login', origin);
        login.searchParams.set('error', 'This link may have expired or already been used. Open a fresh confirmation link in the same browser you used to sign up. If you already confirmed your email, sign in instead.');
        return NextResponse.redirect(login);
    }

    return response;
}
