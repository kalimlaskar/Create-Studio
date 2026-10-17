'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Menu, X } from 'lucide-react';
import type { MarketingSession } from './session';
import { D, focus } from './theme';

export type NavKey = 'home' | 'demo' | 'features' | 'pricing';

const NAV: Array<{ key: NavKey | null; href: string; label: string }> = [
    { key: null, href: '/#how-it-works', label: 'How it works' },
    { key: 'features', href: '/features', label: 'Features' },
    { key: 'demo', href: '/demo', label: 'Demo' },
    { key: 'pricing', href: '/pricing', label: 'Pricing' },
];

export function Wordmark() {
    return (
        <Link href="/" aria-label="Cliprame home" className={`inline-flex shrink-0 items-center gap-2 rounded-lg ${focus}`}>
            <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
            <span className={`${D} text-[17px] font-bold tracking-tight text-[#15120F]`}>Cliprame</span>
        </Link>
    );
}

export function SiteHeader({ current, session }: { current: NavKey; session: MarketingSession }) {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
    }, [open]);

    return (
        <>
        <header className={`sticky top-0 z-50 border-b transition-colors duration-200 ${scrolled ? 'border-[#15120F]/10 bg-[#F6F4EF]/90 backdrop-blur-md' : 'border-transparent'}`}>
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
                <Wordmark />

                <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
                    {NAV.map((item) => {
                        const active = item.key === current;
                        return (
                            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`rounded text-[14.5px] transition ${active ? 'font-semibold text-[#15120F] underline decoration-[#5B3DF5] decoration-2 underline-offset-[7px]' : 'text-[#15120F]/60 hover:text-[#15120F]'} ${focus}`}>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {session.isLoggedIn ? (
                        <Link href="/studio" className={`inline-flex items-center gap-2 rounded-xl bg-[#15120F] px-4 py-2.5 text-sm font-semibold text-[#F6F4EF] hover:bg-[#2B2722] ${focus}`}>
                            Open studio <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    ) : (
                        <>
                            <Link href="/login" className={`hidden rounded-lg px-3 py-2 text-[14.5px] text-[#15120F]/65 hover:text-[#15120F] sm:inline-flex ${focus}`}>Log in</Link>
                            <Link href="/signup" className={`inline-flex items-center gap-1.5 rounded-xl bg-[#15120F] px-4 py-2.5 text-sm font-semibold text-[#F6F4EF] hover:bg-[#2B2722] ${focus}`}>Start free</Link>
                        </>
                    )}
                    <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className={`rounded-lg p-2 text-[#15120F]/70 hover:bg-[#15120F]/5 md:hidden ${focus}`}>
                        <Menu className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </header>

            {/* Rendered outside <header>: its backdrop-filter would make it the containing block for this fixed overlay. */}
            {open && (
                <div role="dialog" aria-modal="true" aria-label="Menu" className="mk-paper fixed inset-0 z-60 overflow-y-auto px-5 pt-4 md:hidden">
                    <div className="flex h-12 items-center justify-between">
                        <Wordmark />
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className={`rounded-lg p-2 text-[#15120F]/70 hover:bg-[#15120F]/5 ${focus}`}><X className="h-5 w-5" /></button>
                    </div>
                    <nav aria-label="Main" className="mt-8 border-t border-[#15120F]/10">
                        {[{ key: 'home' as const, href: '/', label: 'Home' }, ...NAV].map((item, index) => (
                            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`mk-rise flex items-baseline justify-between border-b border-[#15120F]/10 py-4 ${D} text-3xl font-bold tracking-tight ${item.key === current ? 'text-[#15120F]' : 'text-[#15120F]/50'}`} style={{ '--d': index } as CSSProperties}>
                                {item.label}<span className="text-xs font-medium tabular-nums text-[#15120F]/35">0{index + 1}</span>
                            </Link>
                        ))}
                    </nav>
                    <div className="mt-8 grid gap-2.5">
                        {session.isLoggedIn ? (
                            <Link href="/studio" className="rounded-xl bg-[#15120F] py-3.5 text-center text-sm font-semibold text-[#F6F4EF]">Open studio</Link>
                        ) : (
                            <>
                                <Link href="/signup" className="rounded-xl bg-[#15120F] py-3.5 text-center text-sm font-semibold text-[#F6F4EF]">Start free</Link>
                                <Link href="/login" className="rounded-xl border border-[#15120F]/15 py-3.5 text-center text-sm font-semibold">Log in</Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
