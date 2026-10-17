'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Camera, Check, Crown, Film, HardDrive, KeyRound, LoaderCircle, LogOut, Mic, ShieldAlert, Sparkles, Type, UserRound } from 'lucide-react';
import { changePasswordAction, checkUsernameAvailabilityAction, deleteAccountAction, signOutAction, updateProfileAction, updateProfileAvatarAction } from '@/app/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatBytes, share, type AccountOverview, type Meter } from '@/lib/studio/overviewTypes';
import { focus } from '@/components/videos/ui';

const D = 'font-[family-name:var(--font-display)]';
const card = 'rounded-3xl border border-[#14121F]/8 bg-white';
const inputClass = 'w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10';
const primary = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50 ${focus}`;

const SECTIONS = [
    { id: 'profile', label: 'Profile', icon: UserRound },
    { id: 'plan', label: 'Plan & usage', icon: Crown },
    { id: 'security', label: 'Security', icon: KeyRound },
    { id: 'danger', label: 'Delete account', icon: ShieldAlert },
];

const dateText = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

interface Props {
    profile: { name: string; username: string; email: string; avatarUrl: string | null };
    overview: AccountOverview;
}

export function AccountSettings({ profile, overview }: Props) {
    return (
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Account sections" className="lg:sticky lg:top-24 lg:self-start">
                <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
                    {SECTIONS.map(({ id, label, icon: Icon }) => (
                        <li key={id} className="shrink-0">
                            <a href={`#${id}`} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#14121F]/65 transition hover:bg-white hover:text-[#14121F] ${focus}`}>
                                <Icon className="h-4 w-4" />{label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="min-w-0 space-y-6">
                <ProfileSection profile={profile} />
                <PlanSection overview={overview} />
                <SecuritySection />
                <DangerSection />
            </div>
        </div>
    );
}

function Section({ id, title, hint, children, tone }: { id: string; title: string; hint?: string; children: ReactNode; tone?: 'danger' }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className={`${card} scroll-mt-24 p-6 sm:p-8 ${tone === 'danger' ? 'border-red-200' : ''}`}>
            <h2 id={`${id}-title`} className={`${D} text-xl font-bold tracking-tight ${tone === 'danger' ? 'text-red-700' : ''}`}>{title}</h2>
            {hint && <p className="mt-1 text-sm text-[#14121F]/55">{hint}</p>}
            <div className="mt-6">{children}</div>
        </section>
    );
}

function Status({ text, tone }: { text: string; tone: 'ok' | 'error' | 'info' }) {
    if (!text) return null;
    return <p role={tone === 'error' ? 'alert' : 'status'} className={`text-sm font-medium ${tone === 'ok' ? 'text-emerald-700' : tone === 'error' ? 'text-red-600' : 'text-[#14121F]/55'}`}>{text}</p>;
}

/* -------------------------------- Profile ------------------------------- */

function ProfileSection({ profile }: { profile: Props['profile'] }) {
    const [name, setName] = useState(profile.name);
    const [username, setUsername] = useState(profile.username);
    const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
    const [avatarState, setAvatarState] = useState<{ text: string; tone: 'ok' | 'error' | 'info' }>({ text: '', tone: 'info' });
    const [usernameState, setUsernameState] = useState<{ text: string; tone: 'ok' | 'error' | 'info' }>({ text: '', tone: 'info' });
    const [saveState, setSaveState] = useState<{ text: string; tone: 'ok' | 'error' | 'info' }>({ text: '', tone: 'info' });
    const [saving, setSaving] = useState(false);
    const changed = name.trim() !== profile.name || username.trim() !== profile.username;

    const checkUsername = async () => {
        setUsernameState({ text: 'Checking…', tone: 'info' });
        try {
            const result = await checkUsernameAvailabilityAction(username.trim().toLowerCase());
            setUsernameState(result.error ? { text: result.error, tone: 'error' } : result.available ? { text: 'Available', tone: 'ok' } : { text: 'That username is taken', tone: 'error' });
        } catch {
            setUsernameState({ text: 'Could not check. Try again.', tone: 'error' });
        }
    };

    const uploadAvatar = async (file: File | undefined) => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setAvatarState({ text: 'Choose a JPG, PNG or WebP image.', tone: 'error' });
        if (file.size > 5 * 1024 * 1024) return setAvatarState({ text: 'Pictures must be 5 MB or smaller.', tone: 'error' });
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return setAvatarState({ text: 'Picture upload isn’t set up.', tone: 'error' });
        setAvatarState({ text: 'Uploading…', tone: 'info' });
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return setAvatarState({ text: 'Sign in again to change your picture.', tone: 'error' });
            const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
            const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
            const { error } = await supabase.storage.from('profile-avatars').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
            if (error) return setAvatarState({ text: 'Could not upload your picture.', tone: 'error' });
            const result = await updateProfileAvatarAction(path);
            if (result.error) {
                await supabase.storage.from('profile-avatars').remove([path]);
                return setAvatarState({ text: result.error, tone: 'error' });
            }
            setAvatarUrl(supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl);
            setAvatarState({ text: 'Picture updated', tone: 'ok' });
        } catch {
            setAvatarState({ text: 'Could not update your picture. Try again.', tone: 'error' });
        }
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        const safeName = name.trim();
        const safeUsername = username.trim().toLowerCase();
        if (safeName.length < 2 || safeName.length > 80) return setSaveState({ text: 'Your name needs 2 to 80 characters.', tone: 'error' });
        if (safeUsername && !/^[a-z0-9_]{3,20}$/.test(safeUsername)) return setSaveState({ text: 'Usernames are 3–20 lowercase letters, numbers or underscores.', tone: 'error' });
        setSaving(true);
        try {
            const result = await updateProfileAction(safeName, safeUsername);
            if (result.error) return setSaveState({ text: result.error, tone: 'error' });
            // The studio home reads the name from here too.
            try { localStorage.setItem('creator-studio-creator-name', safeName); } catch { /* not important */ }
            setSaveState({ text: 'Saved', tone: 'ok' });
        } catch {
            setSaveState({ text: 'Could not save. Try again.', tone: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section id="profile" title="Profile" hint="How you appear on share pages and in emails to your viewers.">
            <div className="flex flex-wrap items-center gap-5">
                <label className={`group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full bg-gradient-to-br from-[#6A4CFF] to-[#C04CFF] bg-cover bg-center ring-4 ring-[#F7F6FB] has-[:focus-visible]:ring-[#6A4CFF]/60`} style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>
                    {!avatarUrl && <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">{(name || profile.email).charAt(0).toUpperCase()}</span>}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100"><Camera className="h-5 w-5" /></span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Change profile picture" onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.target.value = ''; }} />
                </label>
                <div>
                    <p className="font-semibold">{name || 'Your name'}</p>
                    <p className="text-sm text-[#14121F]/55">{profile.email}</p>
                    <p className="mt-1 text-xs text-[#14121F]/45">Click the picture to change it. JPG, PNG or WebP, up to 5 MB.</p>
                    <div className="mt-1"><Status {...avatarState} /></div>
                </div>
            </div>

            <form onSubmit={save} className="mt-7 grid gap-5 sm:grid-cols-2">
                <label className="block">
                    <span className="text-xs font-semibold text-[#14121F]/60">Name</span>
                    <input value={name} onChange={(event) => { setName(event.target.value); setSaveState({ text: '', tone: 'info' }); }} maxLength={80} autoComplete="name" className={`${inputClass} mt-1.5`} />
                </label>
                <div>
                    <label htmlFor="account-username" className="text-xs font-semibold text-[#14121F]/60">Username</label>
                    <div className="mt-1.5 flex gap-2">
                        <span className="relative flex-1">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#14121F]/40">@</span>
                            <input id="account-username" value={username} onChange={(event) => { setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)); setUsernameState({ text: '', tone: 'info' }); setSaveState({ text: '', tone: 'info' }); }} className={`${inputClass} pl-8`} />
                        </span>
                        <button type="button" onClick={() => void checkUsername()} disabled={username.length < 3} className={`rounded-xl border border-[#14121F]/12 px-3.5 text-sm font-semibold hover:border-[#14121F]/30 disabled:opacity-40 ${focus}`}>Check</button>
                    </div>
                    <div className="mt-1.5 min-h-5">{usernameState.text ? <Status {...usernameState} /> : <p className="text-xs text-[#14121F]/45">3–20 lowercase letters, numbers or underscores.</p>}</div>
                </div>
                <div className="flex items-center gap-4 sm:col-span-2">
                    <button type="submit" disabled={saving || !changed} className={primary}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Save profile</button>
                    <Status {...saveState} />
                </div>
            </form>
        </Section>
    );
}

/* ------------------------------ Plan & usage ----------------------------- */

function UsageMeter({ icon: Icon, title, meter, unit, hint }: { icon: typeof Mic; title: string; meter: Meter; unit: string; hint: string }) {
    const ratio = share(meter);
    const left = Math.max(0, meter.limit - meter.used);
    const unitFor = (count: number) => (count === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit);
    const tone = ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-[#6A4CFF]';
    return (
        <div className="rounded-2xl border border-[#14121F]/8 bg-[#F7F6FB]/60 p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-[#14121F]/50" />{title}</p>
                <p className="text-sm tabular-nums"><span className="font-semibold">{meter.used.toLocaleString('en-IN')}</span><span className="text-[#14121F]/45"> / {meter.limit.toLocaleString('en-IN')} {unit}</span></p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#14121F]/[0.07]" role="progressbar" aria-label={title} aria-valuenow={meter.used} aria-valuemin={0} aria-valuemax={meter.limit}>
                <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.max(ratio > 0 ? 2 : 0, ratio * 100)}%` }} />
            </div>
            <p className={`mt-2 text-xs ${ratio >= 1 ? 'font-medium text-red-600' : ratio >= 0.8 ? 'font-medium text-amber-700' : 'text-[#14121F]/50'}`}>
                {ratio >= 1 ? `You’ve used all of it. ${hint}` : ratio >= 0.8 ? `Almost full: ${left} ${unitFor(left)} left.` : `${left.toLocaleString('en-IN')} ${unitFor(left)} left.`}
            </p>
        </div>
    );
}

function PlanSection({ overview }: { overview: AccountOverview }) {
    const [billing, setBilling] = useState(overview.billing);
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const { plan, ai, videos, storage } = overview;
    const nearLimit = [videos, ai.transcription, ai.voiceover].some((meter) => share(meter) >= 0.8);

    const cancel = async () => {
        setCancelling(true);
        setError('');
        try {
            const response = await fetch('/api/billing/cancel', { method: 'POST' });
            const data = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(data.error ?? 'Could not cancel. Try again.');
            setBilling((current) => (current ? { ...current, cancelAtPeriodEnd: true } : current));
            setConfirming(false);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setCancelling(false);
        }
    };

    return (
        <Section id="plan" title="Plan & usage" hint={`AI minutes reset on ${dateText(ai.resetsOn)}.`}>
            <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 ${plan.isPaid ? 'bg-[linear-gradient(135deg,#FFF6E8,#FFE9F1)]' : 'bg-[#14121F] text-white'}`}>
                <div className="flex items-center gap-3.5">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${plan.isPaid ? 'bg-gradient-to-br from-[#FFB547] to-[#FF7A59] text-white' : 'bg-white/10 text-[#B6A6FF]'}`}>{plan.isPaid ? <Crown className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span>
                    <div>
                        <p className="font-semibold">{plan.name} plan{plan.isPaid && <span className="font-normal opacity-60"> · ${plan.priceUsd}/month</span>}</p>
                        <p className={`text-sm ${plan.isPaid ? 'text-[#14121F]/60' : 'text-white/60'}`}>
                            {!plan.isPaid ? 'Upgrade to host more videos, send longer ones and remove the watermark.'
                                : billing?.cancelAtPeriodEnd ? `Cancelled. You keep ${plan.name} until ${dateText(billing.periodEnd)}.`
                                    : billing?.periodEnd ? `Renews on ${dateText(billing.periodEnd)}.` : 'Active.'}
                        </p>
                    </div>
                </div>
                <Link href="/pricing" className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold ${plan.isPaid ? 'border border-[#14121F]/15 bg-white hover:border-[#14121F]/30' : 'bg-white text-[#14121F] hover:bg-white/90'} ${focus}`}>
                    {plan.isPaid ? 'Compare plans' : 'Upgrade'} <ArrowUpRight className="h-4 w-4" />
                </Link>
            </div>

            {nearLimit && !plan.isPaid && (
                <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />You’re close to a limit on the Free plan. Upgrading keeps your videos and links exactly as they are.</p>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
                <UsageMeter icon={Film} title="Videos hosted" meter={videos} unit="videos" hint="Delete a video or upgrade to share more." />
                <div className="rounded-2xl border border-[#14121F]/8 bg-[#F7F6FB]/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-semibold"><HardDrive className="h-4 w-4 text-[#14121F]/50" />Storage used</p>
                        <p className="text-sm font-semibold tabular-nums">{formatBytes(storage.usedBytes)}</p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#14121F]/50">No storage cap: your plan limits the number of videos, not their total size. Each video can be up to {Math.round(storage.maxVideoSeconds / 60)} {storage.maxVideoSeconds === 60 ? 'minute' : 'minutes'} ({formatBytes(storage.maxVideoBytes)}).</p>
                </div>
                <UsageMeter icon={Type} title="Transcription this month" meter={ai.transcription} unit="min" hint="Captions and edit-by-text pause until next month, or upgrade." />
                <UsageMeter icon={Mic} title="AI voiceover this month" meter={ai.voiceover} unit="min" hint="Voiceovers pause until next month, or upgrade." />
            </div>

            {plan.isPaid && billing && !billing.cancelAtPeriodEnd && billing.status === 'active' && (
                <div className="mt-6 border-t border-[#14121F]/[0.07] pt-5">
                    {confirming ? (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span>Cancel at the end of this period? You keep {plan.name} until {dateText(billing.periodEnd) || 'then'}.</span>
                            <button type="button" onClick={() => void cancel()} disabled={cancelling} className={`inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 font-semibold text-white disabled:opacity-50 ${focus}`}>{cancelling && <LoaderCircle className="h-4 w-4 animate-spin" />}Yes, cancel</button>
                            <button type="button" onClick={() => setConfirming(false)} className={`rounded-xl px-3 py-2 font-semibold text-[#14121F]/60 hover:text-[#14121F] ${focus}`}>Keep my plan</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setConfirming(true)} className={`text-sm font-semibold text-[#14121F]/50 underline-offset-4 hover:text-red-600 hover:underline ${focus}`}>Cancel subscription</button>
                    )}
                    {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
                </div>
            )}
        </Section>
    );
}

/* -------------------------------- Security ------------------------------- */

function SecuritySection() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [state, setState] = useState<{ text: string; tone: 'ok' | 'error' | 'info' }>({ text: '', tone: 'info' });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        try {
            const result = await changePasswordAction(password, confirm);
            if (result.error) setState({ text: result.error, tone: 'error' });
            else { setState({ text: 'Password updated', tone: 'ok' }); setPassword(''); setConfirm(''); }
        } catch {
            setState({ text: 'Could not update your password. Try again.', tone: 'error' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Section id="security" title="Security" hint="You can also sign in with a one-time email code, so a password is optional.">
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                    <span className="text-xs font-semibold text-[#14121F]/60">New password</span>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="block">
                    <span className="text-xs font-semibold text-[#14121F]/60">Confirm new password</span>
                    <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className={`${inputClass} mt-1.5`} />
                </label>
                <div className="flex items-center gap-4 sm:col-span-2">
                    <button type="submit" disabled={busy || !password || !confirm} className={primary}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Update password</button>
                    <Status {...state} />
                </div>
            </form>
            <form action={signOutAction} className="mt-6 border-t border-[#14121F]/[0.07] pt-5">
                <button type="submit" className={`inline-flex items-center gap-2 text-sm font-semibold text-[#14121F]/65 hover:text-[#14121F] ${focus}`}><LogOut className="h-4 w-4" /> Sign out of this device</button>
            </form>
        </Section>
    );
}

/* ------------------------------ Delete account --------------------------- */

function DangerSection() {
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (typed !== 'delete') return;
        setBusy(true);
        setError('');
        try {
            const result = await deleteAccountAction();
            if (result?.error) { setError(result.error); setBusy(false); }
        } catch {
            setError('Could not delete your account. Try again.');
            setBusy(false);
        }
    };

    return (
        <Section id="danger" title="Delete account" tone="danger" hint="Cancels any subscription and permanently deletes your profile, hosted videos, share links, analytics, leads and integrations. This can’t be undone.">
            <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
                <label className="block min-w-[14rem] flex-1">
                    <span className="text-xs font-semibold text-[#14121F]/60">Type <span className="font-mono text-red-600">delete</span> to confirm</span>
                    <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" className={`${inputClass} mt-1.5`} />
                </label>
                <button type="submit" disabled={typed !== 'delete' || busy} className={`inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 ${focus}`}>
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Delete my account
                </button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </Section>
    );
}
