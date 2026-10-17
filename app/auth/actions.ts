'use server';

import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createDemoSessionToken, DEMO_SESSION_COOKIE, DEMO_SESSION_MAX_AGE, isDemoAuthEnabled, verifyDemoCredentials } from '@/lib/auth/demo';
import { razorpayApi } from '@/lib/billing/razorpay';
import { deleteObject, isR2Configured } from '@/lib/storage/r2';

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
    if (!/^\d{8}$/.test(token)) return { error: 'Enter the 8-digit code from your email.' };

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

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: name,
            },
            emailRedirectTo: `${origin}/auth/callback?next=/studio`,
        },
    });

    if (error) return { error: getAuthErrorMessage(error, 'We could not create your account. Check the details and try again.') };
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

/**
 * Applies a change to the signed-in user's profile row, creating the row first if
 * sign-up never did (the database trigger can miss accounts made before it existed).
 * Users can't insert profiles themselves, so the missing row is created with the
 * service role, always for the user's own id from their session.
 */
async function saveOwnProfile(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string, change: Record<string, unknown>, fallbackName: string) {
    const update = { ...change, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('profiles').update(update).eq('id', userId).select('id').maybeSingle();
    if (error || data) return { error };

    const admin = createSupabaseAdminClient();
    if (!admin) return { error: { message: 'missing profile row and no service role key' } };
    const { error: insertError } = await admin.from('profiles').insert({ id: userId, display_name: fallbackName, ...update });
    return { error: insertError };
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

    const { error } = await saveOwnProfile(supabase, user.id, { display_name: safeDisplayName, username: safeUsername || null }, safeDisplayName);
    if ((error as { code?: string } | null)?.code === '23505') return { error: 'That username is already taken. Choose another one.' };
    if (error) {
        console.error('Could not save profile:', error);
        return { error: 'Could not save your profile. Please try again.' };
    }
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

    const { error } = await saveOwnProfile(supabase, user.id, { avatar_path: path }, (user.email ?? 'Creator').split('@')[0]);
    if (error) {
        console.error('Could not save profile picture:', error);
        return { error: 'Could not save your profile picture. Please try again.' };
    }
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

export async function deleteAccountAction(): Promise<{ error?: string }> {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { error: 'Supabase Auth is not configured.' };

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Sign in again to delete your account.' };

    const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { cookies: { getAll: () => [], setAll: () => { } } })
        : null;

    if (!supabaseAdmin) {
        return { error: 'Server configuration error: Service role key required for account deletion.' };
    }

    // Stop billing first, so a deleted account is never charged again.
    const { data: subscription } = await supabaseAdmin.from('subscriptions')
        .select('razorpay_subscription_id,status').eq('user_id', user.id).maybeSingle();
    if (subscription?.razorpay_subscription_id && !['cancelled', 'completed', 'expired'].includes(subscription.status)) {
        try {
            await razorpayApi(`subscriptions/${subscription.razorpay_subscription_id}/cancel`, { cancel_at_cycle_end: 0 });
        } catch (error) {
            console.error('Could not cancel subscription during account deletion:', error);
            return { error: 'Could not cancel your subscription, so the account wasn’t deleted. Please try again or contact support.' };
        }
    }

    // Delete hosted video files and the profile photo; database rows go with the user below.
    const { data: videos } = await supabaseAdmin.from('videos').select('storage_key,poster_key').eq('owner_id', user.id);
    if (videos?.length && isR2Configured()) {
        for (const video of videos) {
            await deleteObject(video.storage_key).catch((error) => console.error('Could not delete video file:', error));
            if (video.poster_key) await deleteObject(video.poster_key).catch((error) => console.error('Could not delete poster:', error));
        }
    }
    const { data: profile } = await supabaseAdmin.from('profiles').select('avatar_path').eq('id', user.id).maybeSingle();
    if (profile?.avatar_path) await supabaseAdmin.storage.from('profile-avatars').remove([profile.avatar_path]);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) return { error: 'Could not delete your account. Please try again.' };

    const cookieStore = await cookies();
    cookieStore.delete(DEMO_SESSION_COOKIE);
    await supabase.auth.signOut();
    redirect('/');
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