'use client';

import { useActionState } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { requestSignInOtpAction, signInAction, signUpAction, verifySignInOtpAction, type AuthFormState } from '@/app/auth/actions';

const initialState: AuthFormState = {};

/* Shared styles, tuned for a dark (#14121F) surface and the Cliprame violet. */
const inputCls =
    'mt-2 w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#6A4CFF] focus:bg-white/[0.09] focus:ring-2 focus:ring-[#6A4CFF]/30';
const labelCls = 'block text-sm font-medium text-white/80';
const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-[#6A4CFF] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6A4CFF]/25 transition hover:bg-[#7B60FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14121F] disabled:cursor-wait disabled:opacity-60';
const linkBtn = 'w-full text-center text-xs font-medium text-white/55 transition hover:text-white';

export function AuthForm({ mode, next = '/studio', setup = false, demoMode = false, demoUsername = '', supabaseConfigured = false, notice, error: initialError, variant = 'card' }: {
    mode: 'login' | 'signup';
    next?: string;
    setup?: boolean;
    demoMode?: boolean;
    demoUsername?: string;
    supabaseConfigured?: boolean;
    notice?: string;
    error?: string;
    /** 'card' = original standalone look (signup page). 'embedded' = compact, no nested card, for use inside an existing card. */
    variant?: 'card' | 'embedded';
}) {
    const isSignup = mode === 'signup';
    const embedded = variant === 'embedded';
    const authUnavailable = !supabaseConfigured && !demoMode;
    const [loginMethod, setLoginMethod] = useState<'code' | 'password'>(demoMode ? 'password' : 'code');
    const [passwordState, passwordAction, passwordPending] = useActionState<AuthFormState, FormData>(signInAction, initialState);
    const [signupState, signupAction, signupPending] = useActionState<AuthFormState, FormData>(signUpAction, initialState);
    const [otpRequestState, requestOtpAction, otpRequestPending] = useActionState<AuthFormState, FormData>(requestSignInOtpAction, initialState);
    const [otpVerifyState, verifyOtpAction, otpVerifyPending] = useActionState<AuthFormState, FormData>(verifySignInOtpAction, initialState);
    const isOtpStep = !isSignup && loginMethod === 'code' && otpRequestState.otpSent;
    const showTabs = !isSignup && !demoMode && !authUnavailable && !isOtpStep;

    const panel = embedded
        ? 'space-y-4'
        : 'space-y-4 rounded-3xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7';

    return (
        <div className="w-full max-w-md">
            <div className={embedded ? 'mb-5' : 'mb-8 text-center'}>
                <Link href="/" className={`${embedded ? 'mb-4 lg:hidden' : 'mx-auto mb-5'} inline-flex items-center gap-2 text-sm font-semibold text-white`}>
                    <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9" />
                    <span>Cliprame</span>
                </Link>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">{isSignup ? 'Create your free workspace' : isOtpStep ? 'Verify your email' : 'Welcome back'}</p>
                <h1 className={`mt-2 font-bold tracking-tight text-white ${embedded ? 'text-2xl sm:text-[1.7rem]' : 'text-3xl'}`}>{isSignup ? 'Create your account.' : isOtpStep ? 'Check your inbox.' : 'Sign in to Cliprame.'}</h1>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{isSignup ? 'Start creating classroom lessons and social-ready reels.' : isOtpStep ? 'Enter the 6-digit code we emailed you to continue.' : 'Use a secure email code or sign in with your password.'}</p>
            </div>

            {setup && !authUnavailable && <div role="status" className={`mb-4 rounded-xl border p-3 text-xs leading-relaxed ${demoMode ? 'border-violet-400/25 bg-violet-400/10 text-violet-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
                {demoMode ? <><strong>Temporary tester mode is enabled.</strong><p className="mt-1">This shared account is for preview only and does not create individual user accounts.</p></> : <><strong>Connect Supabase to enable real accounts.</strong><p className="mt-1">Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev server.</p></>}
            </div>}
            {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-relaxed text-emerald-100">{notice}</p>}
            {initialError && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-relaxed text-red-200">{initialError}</p>}

            {showTabs && (
                <div role="tablist" aria-label="Sign-in method" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 text-xs font-semibold">
                    {(['code', 'password'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            role="tab"
                            aria-selected={loginMethod === m}
                            onClick={() => setLoginMethod(m)}
                            className={`rounded-lg px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/60 ${loginMethod === m ? 'bg-white text-[#14121F] shadow' : 'text-white/60 hover:text-white'}`}
                        >
                            {m === 'code' ? 'Email code' : 'Password'}
                        </button>
                    ))}
                </div>
            )}

            {authUnavailable ? <div role="status" className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-5 text-sm leading-relaxed text-white/70 shadow-2xl shadow-black/20 sm:p-7"><p className="font-semibold text-white">Supabase authentication isn’t configured.</p><p className="mt-2 text-white/55">Connect a Supabase project to enable individual accounts, email-code sign-in, and password sign-in.</p></div> : isSignup && demoMode ? <div className="rounded-3xl border border-white/10 bg-white/4 p-5 text-sm leading-relaxed text-white/70 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7"><p className="font-semibold text-white">Sign-up is paused in temporary tester mode.</p><p className="mt-2 text-white/55">Disable temporary auth or configure Supabase to enable individual accounts.</p><Link href="/login" className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#6A4CFF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7B60FF]">Go to sign in</Link></div> : isSignup ? <form action={signupAction} className={panel}>
                <input type="hidden" name="next" value={next} />
                <label className={labelCls}>Your name<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} placeholder="Alex Morgan" className={inputCls} /></label>
                <label className={labelCls}>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" className={inputCls} /></label>
                <label className={labelCls}>Password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="At least 8 characters" className={inputCls} /></label>
                <label className={labelCls}>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Re-enter your password" className={inputCls} /></label>
                {signupState.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{signupState.error}</p>}
                {signupState.message && <p role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-200">{signupState.message}</p>}
                <button type="submit" disabled={signupPending} className={primaryBtn}>
                    {signupPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                    {signupPending ? 'Creating account…' : 'Create free account'}
                    {!signupPending && <ArrowRight className="ml-auto h-4 w-4" />}
                </button>
                <p className="text-center text-xs leading-relaxed text-white/45">By continuing, you agree to use only content and media you have permission to use.</p>
            </form> : demoMode || loginMethod === 'password' ? <form action={passwordAction} className={panel}>
                <input type="hidden" name="next" value={next} />
                <label className={labelCls}>{demoMode ? 'Tester username' : 'Email'}<input name="email" type={demoMode ? 'text' : 'email'} autoComplete={demoMode ? 'username' : 'email'} required maxLength={254} placeholder={demoMode ? demoUsername || 'Tester username' : 'you@company.com'} className={inputCls} /></label>
                <label className={labelCls}>Password<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} placeholder="Your password" className={inputCls} /></label>
                {passwordState.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{passwordState.error}</p>}
                <button type="submit" disabled={passwordPending} className={primaryBtn}>
                    {passwordPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                    {passwordPending ? 'Signing in…' : 'Sign in with password'}
                    {!passwordPending && <ArrowRight className="ml-auto h-4 w-4" />}
                </button>
            </form> : isOtpStep ? <div className={panel}>
                <p role="status" className="text-sm leading-relaxed text-emerald-200">{otpRequestState.message} <span className="font-semibold">{otpRequestState.email}</span></p>
                <form action={verifyOtpAction} className="space-y-4">
                    <input type="hidden" name="next" value={next} />
                    <input type="hidden" name="email" value={otpRequestState.email ?? ''} />
                    <label className={labelCls}>6-digit code<input name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" className={`${inputCls} text-center font-mono text-lg tracking-[0.35em]`} /></label>
                    {otpVerifyState.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{otpVerifyState.error}</p>}
                    <button type="submit" disabled={otpVerifyPending} className={primaryBtn}>
                        {otpVerifyPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {otpVerifyPending ? 'Verifying code…' : 'Verify and sign in'}
                        {!otpVerifyPending && <ArrowRight className="ml-auto h-4 w-4" />}
                    </button>
                </form>
                <div className="flex items-center justify-between gap-3 text-xs">
                    <Link href={`/login${next !== '/studio' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-white/55 transition hover:text-white">Use a different email</Link>
                    <form action={requestOtpAction}><input type="hidden" name="email" value={otpRequestState.email ?? ''} /><input type="hidden" name="next" value={next} /><button type="submit" disabled={otpRequestPending} className="font-medium text-violet-300 transition hover:text-violet-200 disabled:opacity-50">{otpRequestPending ? 'Sending…' : 'Resend code'}</button></form>
                </div>
                <button type="button" onClick={() => setLoginMethod('password')} className={linkBtn}>Use password instead</button>
            </div> : <form action={requestOtpAction} className={panel}>
                <input type="hidden" name="next" value={next} />
                <label className={labelCls}>Work email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={otpRequestState.email ?? ''} placeholder="you@company.com" className={inputCls} /></label>
                {otpRequestState.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{otpRequestState.error}</p>}
                <button type="submit" disabled={otpRequestPending} className={primaryBtn}>
                    {otpRequestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {otpRequestPending ? 'Sending code…' : 'Continue with email code'}
                    {!otpRequestPending && <ArrowRight className="ml-auto h-4 w-4" />}
                </button>
                <p className="text-center text-xs leading-relaxed text-white/45">We’ll email a secure, single-use code. No password needed.</p>
            </form>}

            <p className={`${embedded ? 'mt-5' : 'mt-6'} text-center text-sm text-white/55`}>{isSignup ? 'Already have an account?' : 'New to Cliprame?'}{' '}<Link href={`${isSignup ? '/login' : '/signup'}${next !== '/studio' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-violet-300 hover:text-violet-200">{isSignup ? 'Sign in' : 'Create a free account'}</Link></p>
            {(!embedded || demoMode || !supabaseConfigured) && <p className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40"><LockKeyhole className="h-3.5 w-3.5" />{demoMode ? 'Temporary shared tester access · no individual account' : supabaseConfigured ? 'Authentication securely handled by Supabase.' : 'Connect Supabase to enable sign-in.'}</p>}
        </div>
    );
}