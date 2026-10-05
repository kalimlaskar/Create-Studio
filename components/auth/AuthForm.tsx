'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';
import { signInAction, signUpAction, type AuthFormState } from '@/app/auth/actions';

const initialState: AuthFormState = {};

export function AuthForm({ mode, next = '/studio', setup = false, demoMode = false, showDemoCredentials = false, demoUsername = '', isProduction = false, notice, error: initialError }: {
    mode: 'login' | 'signup';
    next?: string;
    setup?: boolean;
    demoMode?: boolean;
    showDemoCredentials?: boolean;
    demoUsername?: string;
    isProduction?: boolean;
    notice?: string;
    error?: string;
}) {
    const action = mode === 'signup' ? signUpAction : signInAction;
    const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, initialState);
    const isSignup = mode === 'signup';
    const authUnavailable = isProduction && setup && !demoMode;

    return (
        <div className="w-full max-w-md">
            <div className="mb-8 text-center">
                <Link href="/" className="mx-auto mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"><Sparkles className="h-5 w-5" /></span>
                    CreatorStudio
                </Link>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">{isSignup ? 'Create your free workspace' : 'Welcome back'}</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">{isSignup ? 'Make something worth sharing.' : 'Sign in to your studio.'}</h1>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{isSignup ? 'Start creating classroom lessons and social-ready reels.' : 'Your next lesson, story, or reel is waiting.'}</p>
            </div>

            {setup && <div role="status" className={`mb-4 rounded-xl border p-3 text-xs leading-relaxed ${demoMode ? 'border-indigo-400/25 bg-indigo-400/10 text-indigo-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
                {demoMode ? <><strong>{showDemoCredentials ? 'Temporary local preview' : 'Temporary tester access'}</strong>{showDemoCredentials ? <p className="mt-1">Username: <code className="rounded bg-black/25 px-1.5 py-0.5">teacher</code> · Password: <code className="rounded bg-black/25 px-1.5 py-0.5">lesson-demo-2026</code></p> : <p className="mt-1">Use the private test username and password shared by the site owner.</p>}<p className="mt-1 text-[11px] opacity-80">Temporary shared tester access. It is not a personal account and should be disabled when testing ends.</p></> : isProduction ? <><strong>This deployment has no sign-in provider configured.</strong><p className="mt-1">To enable a temporary tester login, the site owner must add <code>TEMP_AUTH_ENABLED</code>, <code>TEMP_AUTH_USERNAME</code>, <code>TEMP_AUTH_PASSWORD</code>, and a private 32+ character <code>TEMP_AUTH_SECRET</code> in Vercel → Project Settings → Environment Variables, then redeploy. Remove Supabase variables while using this temporary mode.</p><p className="mt-1 text-[11px] opacity-80">Never put the password or session secret in source code or share them in this page.</p></> : <><strong>One-time setup:</strong> Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev server. Find these in your Supabase project’s Connect/API settings.</>}
            </div>}
            {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-relaxed text-emerald-100">{notice}</p>}
            {initialError && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-relaxed text-red-200">{initialError}</p>}

            {authUnavailable ? <div role="status" className="rounded-3xl border border-amber-300/15 bg-amber-300/5 p-5 text-sm leading-relaxed text-neutral-300 shadow-2xl shadow-black/20 sm:p-7"><p className="font-semibold text-white">Login isn’t enabled on this deployment yet.</p><p className="mt-2 text-neutral-400">The site owner needs to add the temporary tester environment variables in Vercel and redeploy. Until then, no username or email can sign in here.</p></div> : isSignup && demoMode ? <div className="rounded-3xl border border-white/10 bg-white/4 p-5 text-sm leading-relaxed text-neutral-300 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7"><p className="font-semibold text-white">Sign-up is paused in temporary tester mode.</p><p className="mt-2 text-neutral-400">Use the shared tester login. Connect Supabase later to enable real individual accounts.</p><Link href="/login?setup=1" className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">Go to sign in</Link></div> : <form action={formAction} className="space-y-4 rounded-3xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
                <input type="hidden" name="next" value={next} />
                {isSignup && <label className="block text-sm font-medium text-neutral-200">Your name<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} placeholder="Alex Morgan" className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" /></label>}
                <label className="block text-sm font-medium text-neutral-200">{demoMode ? 'Tester username' : 'Email'}<input name="email" type={demoMode ? 'text' : 'email'} autoComplete={demoMode ? 'username' : 'email'} required maxLength={254} placeholder={showDemoCredentials ? 'teacher' : demoUsername || 'Tester username'} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" /></label>
                <label className="block text-sm font-medium text-neutral-200">Password<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} placeholder="At least 8 characters" className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" /></label>
                {state.error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{state.error}</p>}
                {state.message && <p role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-200">{state.message}</p>}
                <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60">
                    {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                    {pending ? 'Please wait…' : isSignup ? 'Create free account' : 'Sign in'}
                    {!pending && <ArrowRight className="ml-auto h-4 w-4" />}
                </button>
                <p className="text-center text-xs leading-relaxed text-neutral-500">By continuing, you agree to use only content and media you have permission to use.</p>
            </form>}
            <p className="mt-6 text-center text-sm text-neutral-400">{isSignup ? 'Already have an account?' : 'New to CreatorStudio?'}{' '}<Link href={`${isSignup ? '/login' : '/signup'}${next !== '/studio' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-indigo-300 hover:text-indigo-200">{isSignup ? 'Sign in' : 'Create a free account'}</Link></p>
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-600"><LockKeyhole className="h-3.5 w-3.5" />{demoMode ? 'Temporary shared tester access · no individual account' : 'Authentication securely handled by Supabase.'}</p>
        </div>
    );
}
