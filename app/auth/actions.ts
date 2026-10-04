'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createDemoSessionToken, DEMO_SESSION_COOKIE, DEMO_SESSION_MAX_AGE, isDemoAuthEnabled, verifyDemoCredentials } from '@/lib/auth/demo';

export interface AuthFormState {
    error?: string;
    message?: string;
}

function getSafeNext(value: FormDataEntryValue | null) {
    const next = typeof value === 'string' ? value : '/studio';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
}

export async function signInAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const next = getSafeNext(formData.get('next'));
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
        if (!isDemoAuthEnabled()) return { error: 'Sign-in is unavailable. Configure Supabase or enable local demo authentication for development.' };
        if (!verifyDemoCredentials(email, password)) return { error: 'That demo username or password is not correct.' };
        const token = createDemoSessionToken();
        if (!token) return { error: 'Local demo sign-in is disabled.' };
        const cookieStore = await cookies();
        cookieStore.set(DEMO_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: DEMO_SESSION_MAX_AGE,
        });
        redirect(next);
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'We could not sign you in with those details. Check your email and password, then try again.' };
    redirect(next);
}

export async function signUpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const name = String(formData.get('name') ?? '').trim().slice(0, 80);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (name.length < 2) return { error: 'Enter your name (at least 2 characters).' };
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
    if (password.length < 8) return { error: 'Use a password with at least 8 characters.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
        if (isDemoAuthEnabled()) return { message: 'Account creation is disabled in temporary demo mode. Use the sample demo login shown above, or connect Supabase to enable real accounts.' };
        return { error: 'Sign-up is unavailable. Configure Supabase to create real accounts.' };
    }

    const requestHeaders = await headers();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get('origin') ?? 'http://localhost:3000';
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { display_name: name },
            emailRedirectTo: `${origin}/auth/callback?next=/studio`,
        },
    });
    if (error) return { error: 'We could not create your account. Check the details and try again.' };
    if (data.session) redirect('/studio');
    return { message: 'Check your inbox for a confirmation link. After confirming your email, you can sign in.' };
}

export async function signOutAction() {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
        await supabase.auth.signOut();
    } else {
        const cookieStore = await cookies();
        cookieStore.delete(DEMO_SESSION_COOKIE);
    }
    redirect('/');
}