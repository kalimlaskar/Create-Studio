'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Crown, Film, LogOut, Settings, ShieldCheck, Sparkles, Type } from 'lucide-react';
import { signOutAction } from '@/app/auth/actions';
import { startTour } from '@/components/tour/ProductTour';
import { share, type AccountOverview, type Meter } from '@/lib/studio/overviewTypes';

// The small menu behind your name in the top-right corner: who you are, how much
// of your plan you've used, and the way to your account settings.

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2';

function MiniMeter({ icon: Icon, label, meter, unit }: { icon: typeof Film; label: string; meter: Meter; unit: string }) {
    const ratio = share(meter);
    return (
        <div>
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-[#14121F]/70"><Icon className="h-3.5 w-3.5" />{label}</span>
                <span className="tabular-nums text-[#14121F]/55"><span className="font-semibold text-[#14121F]">{meter.used}</span> / {meter.limit} {unit}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#14121F]/[0.07]">
                <div className={`h-full rounded-full ${ratio >= 1 ? 'bg-red-500' : ratio >= 0.8 ? 'bg-amber-500' : 'bg-[#6A4CFF]'}`} style={{ width: `${Math.max(ratio > 0 ? 3 : 0, ratio * 100)}%` }} />
            </div>
        </div>
    );
}

export function AccountMenu({ name, email, avatarUrl, planName, tone = 'light' }: { name: string; email: string; avatarUrl: string; planName: string; tone?: 'light' | 'dark' }) {
    const [open, setOpen] = useState(false);
    const [overview, setOverview] = useState<AccountOverview | null>(null);
    const [failed, setFailed] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const loaded = useRef(false);

    useEffect(() => {
        if (!open) return;
        // Usage is fetched the first time the menu opens, then kept.
        if (!loaded.current) {
            loaded.current = true;
            fetch('/api/account')
                .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
                .then((data: { overview: AccountOverview }) => setOverview(data.overview))
                .catch(() => setFailed(true));
        }
        const onDown = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const initial = (name || email).charAt(0).toUpperCase();
    const avatar = (size: string) => (
        <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6A4CFF] to-[#C04CFF] bg-cover bg-center font-bold text-white ${size}`} style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>
            {!avatarUrl && initial}
        </span>
    );
    const item = `flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-[#14121F]/75 hover:bg-[#14121F]/[0.05] hover:text-[#14121F] ${focus}`;
    const nearLimit = overview && [overview.videos, overview.ai.transcription].some((meter) => share(meter) >= 0.8);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-sm font-semibold shadow-sm transition ${tone === 'dark' ? 'border-neutral-700 bg-neutral-900/95 text-neutral-100 hover:bg-neutral-800' : 'border-[#14121F]/10 bg-white text-[#14121F] hover:border-[#14121F]/25'} ${focus}`}
            >
                {avatar('h-7 w-7 text-xs')}
                <span className="hidden max-w-[9rem] truncate sm:inline">{name || email}</span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-50 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div role="menu" className="animate-dialog-in absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#14121F]/10 bg-white text-[#14121F] shadow-[0_24px_60px_-20px_rgba(20,18,31,0.45)]">
                    <div className="flex items-center gap-3 p-4">
                        {avatar('h-11 w-11 text-base')}
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{name || 'Your account'}</p>
                            <p className="truncate text-xs text-[#14121F]/55">{email}</p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#6A4CFF]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4B30D9]"><Crown className="h-3 w-3" />{overview?.plan.name ?? planName}</span>
                    </div>

                    <div className="space-y-3 border-y border-[#14121F]/[0.07] bg-[#F7F6FB]/70 px-4 py-3.5">
                        {overview ? (
                            <>
                                <MiniMeter icon={Film} label="Videos hosted" meter={overview.videos} unit="" />
                                <MiniMeter icon={Type} label="AI minutes this month" meter={overview.ai.transcription} unit="min" />
                                {nearLimit && !overview.plan.isPaid && (
                                    <Link href="/pricing" onClick={() => setOpen(false)} className={`flex items-center justify-center gap-1.5 rounded-xl bg-[#14121F] py-2 text-xs font-semibold text-white hover:bg-[#2c2742] ${focus}`}><Sparkles className="h-3.5 w-3.5" /> Upgrade for more room</Link>
                                )}
                            </>
                        ) : failed ? (
                            <p className="text-xs text-[#14121F]/55">Couldn’t load your usage. <Link href="/studio/account#plan" className="font-semibold text-[#6A4CFF] hover:underline">See it here</Link>.</p>
                        ) : (
                            <div className="space-y-3" aria-label="Loading usage">
                                {[0, 1].map((row) => <div key={row} className="space-y-1.5"><div className="h-3 w-2/3 animate-pulse rounded bg-[#14121F]/[0.07]" /><div className="h-1.5 animate-pulse rounded-full bg-[#14121F]/[0.07]" /></div>)}
                            </div>
                        )}
                    </div>

                    <div className="p-1.5">
                        <Link role="menuitem" href="/studio/account" onClick={() => setOpen(false)} className={item}><Settings className="h-4 w-4" /> Account settings</Link>
                        <Link role="menuitem" href="/studio/account#plan" onClick={() => setOpen(false)} className={item}><Crown className="h-4 w-4" /> Plan & usage</Link>
                        {overview?.isAdmin && <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={`${item} font-semibold text-[#14121F]`}><ShieldCheck className="h-4 w-4 text-[#6A4CFF]" /> Admin dashboard</Link>}
                        <button role="menuitem" type="button" onClick={() => { setOpen(false); startTour(); }} className={item}><Sparkles className="h-4 w-4" /> Take the tour</button>
                        <div className="my-1 h-px bg-[#14121F]/[0.07]" />
                        <form action={signOutAction}>
                            <button role="menuitem" type="submit" className={`${item} text-red-600 hover:bg-red-50 hover:text-red-700`}><LogOut className="h-4 w-4" /> Sign out</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
