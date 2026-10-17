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

    // The person cancelled on Google's screen, or the provider refused.
    const providerError = searchParams.get('error');
    if (providerError) {
        const login = new URL('/login', origin);
        login.searchParams.set('error', providerError === 'access_denied'
            ? 'Sign-in was cancelled. Choose an account to continue, or use your email instead.'
            : 'We couldn’t sign you in with that account. Try again, or use your email instead.');
        if (process.env.NODE_ENV === 'development') console.error('OAuth sign-in failed:', providerError, searchParams.get('error_description'));
        return NextResponse.redirect(login);
    }

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Supabase confirmation exchange failed:', { status: error.status, code: error.code, message: error.message });
        }
        const login = new URL('/login', origin);
        login.searchParams.set('error', 'This link may have expired or already been used. Open a fresh confirmation link in the same browser you used to sign up. If you already confirmed your email, sign in instead.');
        return NextResponse.redirect(login);
    }

    // New Google accounts get a profile named after the email address; use their real name instead.
    const user = data.user;
    const fullName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim().slice(0, 80) : '';
    if (user?.email && fullName.length >= 2 && user.app_metadata?.provider !== 'email') {
        await supabase.from('profiles').update({ display_name: fullName }).eq('id', user.id).eq('display_name', user.email.split('@')[0]);
    }

    // Older versions stored the plan in a cookie. Plans now come only from the server; clear it.
    response.cookies.delete('cliprame_user_plan');

    return response;
}