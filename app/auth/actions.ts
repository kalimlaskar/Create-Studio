'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createDemoSessionToken, DEMO_SESSION_COOKIE, DEMO_SESSION_MAX_AGE, isDemoAuthEnabled, verifyDemoCredentials } from '@/lib/auth/demo';

export interface AuthFormState {
    error?: string;
    message?: string;
    email?: string;
    otpSent?: boolean;
}

function getSafeNext(value: FormDataEntryValue | null) {
    const next = typeof value === 'string' ? value : '/studio';
    return next.startsWith('/') && !next.startsWith('//') ? next : '/studio';
}

function getAuthErrorMessage(error: { status?: number; message: string }, fallback: string) {
    if (error.status === 429) return 'Supabase temporarily rate-limited email requests. Stop retrying for now; configure custom SMTP in Supabase Auth before testing signups and OTP with regular user addresses.';
    const message = error.message.toLowerCase();
    if (message.includes('email address not authorized') || message.includes('not authorized to send')) {
        return 'Supabase’s default email service only sends to project team addresses. Configure custom SMTP to email users.';
    }
    if (message.includes('redirect') && (message.includes('allow') || message.includes('whitelist'))) {
        return 'Add this app’s /auth/callback URL to Supabase Authentication redirect URLs.';
    }
    return process.env.NODE_ENV === 'development' ? error.message : fallback;
}

export async function signInAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const next = getSafeNext(formData.get('next'));
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

    if (isDemoAuthEnabled()) {
        if (!verifyDemoCredentials(email, password)) return { error: 'That tester username or password is not correct.' };
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

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured. Add the project URL and publishable key to enable sign-in.' };

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'We could not sign you in with those details. Check your email and password, then try again.' };
    redirect(next);
}

export async function requestSignInOtpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.', email };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Email code sign-in is unavailable. Configure Supabase to continue.', email };

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
    });
    if (error) {
        const errorMessage = error.message.toLowerCase().includes('signups not allowed for otp')
            ? 'We couldn’t send a code. This email may not have a Cliprame account yet. Create an account first, then sign in with email code.'
            : getAuthErrorMessage(error, 'We could not send a sign-in code. Check the email address and try again.');
        return {
            error: errorMessage,
            email,
        };
    }

    return { email, otpSent: true, message: 'If an account exists for this email, a sign-in code is on its way.' };
}

export async function verifySignInOtpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const token = String(formData.get('token') ?? '').trim();
    const next = getSafeNext(formData.get('next'));
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
    if (!/^\d{6}$/.test(token)) return { error: 'Enter the 6-digit code from your email.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Email code sign-in is unavailable. Configure Supabase to continue.' };

    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { error: 'That code is invalid or expired. Request a new one and try again.' };
    redirect(next);
}

export async function signUpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
    const name = String(formData.get('name') ?? '').trim().slice(0, 80);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (name.length < 2) return { error: 'Enter your name (at least 2 characters).' };
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email address.' };
    if (password.length < 8) return { error: 'Use a password with at least 8 characters.' };
    if (password !== confirmPassword) return { error: 'Passwords do not match.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
        if (isDemoAuthEnabled()) return { message: 'Account creation is disabled in temporary tester mode. Configure Supabase to create real accounts.' };
        return { error: 'Supabase Auth is not configured. Add the project URL and publishable key to enable sign-up.' };
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
    if (error) return { error: getAuthErrorMessage(error, 'We could not create your account. Check the details and try again.') };
    if (data.session) redirect('/studio');
    return { message: 'Check your inbox for a confirmation link. After confirming your email, you can sign in.' };
}

export async function checkUsernameAvailabilityAction(username: string): Promise<{ available?: boolean; error?: string }> {
    const safeUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(safeUsername)) {
        return { error: 'Usernames must be 3–20 characters using lowercase letters, numbers, or underscores.' };
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured.' };
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Sign in again to check username availability.' };

    const { data, error } = await supabase.rpc('is_profile_username_available', { requested_username: safeUsername });
    if (error) return { error: 'Could not check username availability. Apply the latest profile migration and try again.' };
    return { available: data === true };
}

export async function updateProfileAction(displayName: string, username: string): Promise<{ error?: string }> {
    const safeDisplayName = displayName.trim();
    const safeUsername = username.trim().toLowerCase();
    if (safeDisplayName.length < 2 || safeDisplayName.length > 80) {
        return { error: 'Profile name must be between 2 and 80 characters.' };
    }
    if (safeUsername && !/^[a-z0-9_]{3,20}$/.test(safeUsername)) {
        return { error: 'Usernames must be 3–20 characters using lowercase letters, numbers, or underscores.' };
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured.' };

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Sign in again to update your profile.' };

    const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: safeDisplayName, username: safeUsername || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

    if (error?.code === '23505') return { error: 'That username is already taken. Choose another one.' };
    if (error || !data) return { error: 'Could not save your profile. Check that the profiles migration has been applied.' };
    return {};
}

export async function updateProfileAvatarAction(path: string): Promise<{ error?: string }> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured.' };

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Sign in again to update your profile picture.' };

    if (!new RegExp(`^${user.id}/avatar-[a-f0-9-]+\\.(?:jpg|png|webp)$`).test(path)) {
        return { error: 'That profile picture path is not valid.' };
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_path: path, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();
    if (error || !data) return { error: 'Could not save your profile picture. Check that the latest profile migration has been applied.' };
    return {};
}

export async function changePasswordAction(password: string, confirmPassword: string): Promise<{ error?: string }> {
    if (password.length < 8) return { error: 'Use a password with at least 8 characters.' };
    if (password.length > 128) return { error: 'Password must be 128 characters or fewer.' };
    if (password !== confirmPassword) return { error: 'Passwords do not match.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured.' };
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Sign in again to change your password.' };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: 'Could not update your password. Please try again.' };
    return {};
}

export async function signOutAction() {
    const cookieStore = await cookies();
    cookieStore.delete(DEMO_SESSION_COOKIE);
    if (!isDemoAuthEnabled()) {
        const supabase = await createSupabaseServerClient();
        if (supabase) await supabase.auth.signOut();
    }
    redirect('/');
}