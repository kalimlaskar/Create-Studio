import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/proxy';
import { DEMO_SESSION_COOKIE, isDemoAuthEnabled, verifyDemoSessionToken } from '@/lib/auth/demo';

const protectedPaths = ['/studio'];
const authPaths = ['/login', '/signup'];
const supabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function redirectWithSessionCookies(request: NextRequest, sessionResponse: NextResponse, destination: URL) {
    const redirectResponse = NextResponse.redirect(destination);
    sessionResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    for (const header of ['cache-control', 'expires', 'pragma']) {
        const value = sessionResponse.headers.get(header);
        if (value) redirectResponse.headers.set(header, value);
    }
    return redirectResponse;
}

export async function proxy(request: NextRequest) {
    if (isDemoAuthEnabled() || !supabaseConfigured()) {
        const isDemoSignedIn = isDemoAuthEnabled() && verifyDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
        const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));
        if (isProtectedPath && !isDemoSignedIn) {
            return NextResponse.redirect(new URL('/login?setup=1', request.url));
        }
        if (authPaths.includes(request.nextUrl.pathname) && isDemoSignedIn) return NextResponse.redirect(new URL('/studio', request.url));
        return NextResponse.next();
    }

    const { response, isAuthenticated } = await updateSupabaseSession(request);
    const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`));
    const isAuthPath = authPaths.includes(request.nextUrl.pathname);

    if (isProtectedPath && !isAuthenticated) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
        return redirectWithSessionCookies(request, response, loginUrl);
    }

    if (isAuthPath && isAuthenticated) {
        return redirectWithSessionCookies(request, response, new URL('/studio', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
