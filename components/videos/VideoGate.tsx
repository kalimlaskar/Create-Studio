'use client';

import { useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Lock, Mail } from 'lucide-react';
import { formatClock, type AccessMode } from '@/lib/videos/types';
import type { PublicFormInteraction } from '@/lib/videos/interactions';
import { LeadForm, type HostPage } from './LeadForm';
import { SharePlayer } from './SharePlayer';
import { EmbedPlayer } from './EmbedPlayer';

// What stands before a protected video: the lock (PIN, password or email code) and/or
// a gate form, in that order. The player, and the video's address, only appear once
// /api/unlock and /api/leads have both said yes.

export interface Unlock {
    playbackUrl: string;
    posterUrl: string | null;
    accessToken: string | null;
}

interface Props {
    slug: string;
    /** The lock, or null when the video is only behind a form. */
    mode: Exclude<AccessMode, 'public'> | null;
    /** The gate form, if any. */
    form?: PublicFormInteraction | null;
    source?: 'share' | 'embed';
    host?: HostPage | null;
    title: string;
    durationMs: number;
    tone: 'light' | 'dark';
    /** Pre-filled email, for personal links sent to one person. */
    recipientEmail?: string | null;
    children: (unlock: Unlock) => ReactNode;
}

const COPY = {
    pin: { heading: 'Enter the PIN to watch', hint: 'The sender shared a PIN with you along with this link.', icon: KeyRound },
    password: { heading: 'Enter the password to watch', hint: 'The sender shared a password with you along with this link.', icon: Lock },
    email: { heading: 'Confirm your email to watch', hint: 'We’ll send a 6-digit code to your inbox.', icon: Mail },
};

export function VideoGate({ slug, mode, form = null, source = 'share', host = null, title, durationMs, tone, recipientEmail = null, children }: Props) {
    const [unlock, setUnlock] = useState<Unlock | null>(null);
    const [step, setStep] = useState<'access' | 'form'>(mode ? 'access' : 'form');
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [secret, setSecret] = useState('');
    const [email, setEmail] = useState(recipientEmail ?? '');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    if (unlock) return <>{children(unlock)}</>;

    const call = async (payload: Record<string, string>) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, ...payload }) });
            const data = await response.json().catch(() => ({})) as Partial<Unlock> & { error?: string; sent?: boolean };
            if (!response.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); return null; }
            return data;
        } catch {
            setError('Couldn’t reach the server. Check your connection and try again.');
            return null;
        } finally {
            setBusy(false);
        }
    };

    const finish = (data: (Partial<Unlock> & { next?: string }) | null) => {
        // Unlocked, but the gate form comes next.
        if (data?.next === 'form' && form) {
            setAccessToken(data.accessToken ?? null);
            setStep('form');
            return;
        }
        if (data?.playbackUrl) setUnlock({ playbackUrl: data.playbackUrl, posterUrl: data.posterUrl ?? null, accessToken: data.accessToken ?? null });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (mode !== 'email') return finish(await call({ action: 'secret', secret }));
        if (!codeSent) {
            const data = await call({ action: 'send-code', email });
            if (data?.sent) { setCodeSent(true); setNotice(`Code sent to ${email.trim()}.`); }
            return;
        }
        finish(await call({ action: 'verify-code', email, code }));
    };

    const resend = async () => {
        const data = await call({ action: 'send-code', email });
        if (data?.sent) setNotice('A new code is on its way.');
    };

    const dark = tone === 'dark';

    if (step === 'form' && form) {
        return (
            <div className={`flex w-full items-center justify-center ${dark ? 'h-full overflow-y-auto bg-[#0B0A10] px-5 py-6 text-white' : 'min-h-[360px] rounded-3xl bg-[linear-gradient(135deg,#1B1730,#3b2d8f)] px-5 py-10 shadow-[0_30px_60px_-30px_rgba(20,18,31,0.6)] sm:aspect-video sm:py-6'}`}>
                <div className={`w-full max-w-lg ${dark ? '' : 'max-h-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl'}`}>
                    <p className={`mb-3 truncate text-xs ${dark ? 'text-white/50' : 'text-[#14121F]/45'}`}>{title} · {formatClock(durationMs)}</p>
                    <LeadForm
                        form={form}
                        slug={slug}
                        source={source}
                        host={host}
                        accessToken={accessToken}
                        tone={tone}
                        prefillEmail={recipientEmail}
                        onDone={(result) => { if (result.playbackUrl) setUnlock({ playbackUrl: result.playbackUrl, posterUrl: result.posterUrl ?? null, accessToken }); }}
                    />
                </div>
            </div>
        );
    }
    if (!mode) return null;

    const { heading, hint, icon: Icon } = COPY[mode];
    const input = `w-full rounded-xl border px-3.5 py-2.5 text-[15px] outline-none transition ${dark ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:border-white/50' : 'border-[#14121F]/12 bg-[#F7F6FB] focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10'}`;
    const muted = dark ? 'text-white/60' : 'text-[#14121F]/55';
    const link = `text-xs font-semibold hover:underline ${dark ? 'text-white/80' : 'text-[#6A4CFF]'}`;

    return (
        <div className={`flex w-full items-center justify-center ${dark ? 'h-full bg-[#0B0A10] px-5 text-white' : 'aspect-video min-h-[360px] rounded-3xl bg-[linear-gradient(135deg,#1B1730,#3b2d8f)] px-5 shadow-[0_30px_60px_-30px_rgba(20,18,31,0.6)]'}`}>
            <form onSubmit={submit} className={`w-full max-w-sm ${dark ? '' : 'rounded-3xl bg-white p-6 text-[#14121F] shadow-2xl'}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-full ${dark ? 'bg-white/10' : 'bg-[#6A4CFF]/10 text-[#6A4CFF]'}`}><Icon className="h-5 w-5" /></span>
                <h2 className="mt-3 text-lg font-semibold">{heading}</h2>
                <p className={`mt-0.5 text-sm ${muted}`}>{codeSent ? 'Enter the code from the email.' : hint}</p>
                <p className={`mt-0.5 truncate text-xs ${muted}`}>{title} · {formatClock(durationMs)}</p>

                <div className="mt-4 space-y-2.5">
                    {mode === 'pin' && (
                        <input value={secret} onChange={(event) => setSecret(event.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" placeholder="PIN" aria-label="PIN" autoFocus className={`${input} tracking-[0.3em]`} />
                    )}
                    {mode === 'password' && (
                        <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="current-password" placeholder="Password" aria-label="Password" autoFocus className={input} />
                    )}
                    {mode === 'email' && !codeSent && (
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.com" aria-label="Email address" autoFocus required className={input} />
                    )}
                    {mode === 'email' && codeSent && (
                        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="Code from the email" autoFocus className={`${input} tracking-[0.3em]`} />
                    )}
                    <button type="submit" disabled={busy} className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${dark ? 'bg-white text-[#14121F] hover:bg-white/90' : 'bg-[#6A4CFF] text-white hover:bg-[#5839e0]'}`}>
                        {busy ? 'Checking…' : mode === 'email' && !codeSent ? 'Send code' : 'Watch video'}
                    </button>
                </div>

                {error && <p role="alert" className={`mt-3 text-sm font-medium ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>}
                {notice && !error && <p role="status" className={`mt-3 text-sm ${muted}`}>{notice}</p>}
                {mode === 'email' && codeSent && (
                    <div className="mt-3 flex gap-4">
                        <button type="button" onClick={() => void resend()} disabled={busy} className={link}>Send a new code</button>
                        <button type="button" onClick={() => { setCodeSent(false); setCode(''); setNotice(''); setError(''); }} className={link}>Use a different email</button>
                    </div>
                )}
            </form>
        </div>
    );
}

type Locked<P> = Omit<P, 'playbackUrl' | 'posterUrl' | 'accessToken'> & {
    mode: Exclude<AccessMode, 'public'> | null;
    gate?: PublicFormInteraction | null;
    recipientEmail?: string | null;
};

/** The share page player behind the lock and/or gate form. */
export function GatedSharePlayer({ mode, gate = null, recipientEmail, ...player }: Locked<ComponentProps<typeof SharePlayer>>) {
    return (
        <VideoGate slug={player.slug} mode={mode} form={gate} source="share" title={player.title} durationMs={player.durationMs} tone="light" recipientEmail={recipientEmail}>
            {(unlock) => <SharePlayer {...player} {...unlock} />}
        </VideoGate>
    );
}

/** The embedded player behind the lock and/or gate form. */
export function GatedEmbedPlayer({ mode, gate = null, recipientEmail, ...player }: Locked<ComponentProps<typeof EmbedPlayer>>) {
    return (
        <div className="h-dvh w-full">
            <VideoGate slug={player.slug} mode={mode} form={gate} source="embed" host={player.host} title={player.title} durationMs={player.durationMs} tone="dark" recipientEmail={recipientEmail}>
                {(unlock) => <EmbedPlayer {...player} {...unlock} />}
            </VideoGate>
        </div>
    );
}
