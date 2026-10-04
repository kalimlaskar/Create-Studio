'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';
import { signInAction, signUpAction, type AuthFormState } from '@/app/auth/actions';

const initialState: AuthFormState = {};

export function AuthForm({ mode, next = '/studio', setup = false, demoMode = false, notice, error: initialError }: {
    mode: 'login' | 'signup';
    next?: string;
    setup?: boolean;
    demoMode?: boolean;
    notice?: string;
    error?: string;
}) {
    const action = mode === 'signup' ? signUpAction : signInAction;
    const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, initialState);
    const isSignup = mode === 'signup';

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
                {demoMode ? <><strong>Temporary local demo mode</strong><p className="mt-1">Username: <code className="rounded bg-black/25 px-1.5 py-0.5">teacher</code> · Password: <code className="rounded bg-black/25 px-1.5 py-0.5">lesson-demo-2026</code></p><p className="mt-1 text-[11px] opacity-80">Development only. This shared sample account is not private; real user accounts are enabled when Supabase is connected.</p></> : <><strong>One-time setup:</strong> Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the dev server. Find these in your Supabase project’s Connect/API settings.</>}
            </div>}
            {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-relaxed text-emerald-100">{notice}</p>}
            {initialError && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm leading-relaxed text-red-200">{initialError}</p>}

            {isSignup && demoMode ? <div className="rounded-3xl border border-white/10 bg-white/4 p-5 text-sm leading-relaxed text-neutral-300 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7"><p className="font-semibold text-white">Sign-up is paused in temporary demo mode.</p><p className="mt-2 text-neutral-400">Use the sample account to explore locally. Connect Supabase later to enable real account registration and email confirmation.</p><Link href="/login?setup=1" className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">Continue to demo sign-in</Link></div> : <form action={formAction} className="space-y-4 rounded-3xl border border-white/10 bg-white/4 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
                <input type="hidden" name="next" value={next} />
                {isSignup && <label className="block text-sm font-medium text-neutral-200">Your name<input name="name" type="text" autoComplete="name" required minLength={2} maxLength={80} placeholder="Alex Morgan" className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" /></label>}
                <label className="block text-sm font-medium text-neutral-200">{demoMode ? 'Username' : 'Email'}<input name="email" type={demoMode ? 'text' : 'email'} autoComplete={demoMode ? 'username' : 'email'} required maxLength={254} placeholder={demoMode ? 'teacher' : 'you@example.com'} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" /></label>
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
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-600"><LockKeyhole className="h-3.5 w-3.5" />{demoMode ? 'Temporary development demo · no cloud account' : 'Authentication securely handled by Supabase.'}</p>
        </div>
    );
}
