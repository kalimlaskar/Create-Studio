import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { PricingPlans } from '@/components/pricing/PricingPlans';

export const metadata: Metadata = {
    title: 'Pricing | Cliprame',
    description: 'See what Cliprame includes today and what is still in development. No paid subscription is currently available.',
};

export default function PricingPage() {
    return (
        <main className="min-h-dvh bg-neutral-950 text-neutral-100 selection:bg-indigo-400/30">
            <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-neutral-950/85 backdrop-blur-xl">
                <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8 lg:px-12">
                    <Link href="/" aria-label="Cliprame home" className="inline-flex shrink-0 items-center gap-2.5 font-semibold tracking-tight text-white"><Image src="/cliprame-icon.svg" alt="" width={40} height={40} className="h-10 w-10" /><span className="text-lg">Cliprame</span></Link>
                    <nav aria-label="Main navigation" className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] p-1 text-sm md:flex"><Link href="/" className="rounded-full px-4 py-2 text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-white">Home</Link><span aria-current="page" className="rounded-full bg-white/[0.08] px-4 py-2 font-medium text-white">Pricing</span></nav>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2"><Link href="/login" className="rounded-full px-2.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white sm:px-4 sm:text-sm">Log in</Link><Link href="/login?setup=1" className="rounded-full bg-linear-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 sm:px-5 sm:text-sm">Try the studio <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></div>
                </div>
            </header>

            <section className="mx-auto max-w-7xl px-5 pb-8 pt-10 sm:px-8 sm:pt-14 lg:px-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">Workspace / Plan access</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Plans &amp; access</h1><p className="mt-2 text-sm leading-6 text-neutral-400">Start with the free preview. Paid plans are still in development.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Preview available</span></div>
            </section>

            <PricingPlans />

            <footer className="border-t border-white/[0.07]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-neutral-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><Link href="/" className="inline-flex items-center gap-2 font-semibold text-white"><Image src="/cliprame-icon.svg" alt="" width={24} height={24} className="h-6 w-6" /><span>Cliprame</span></Link><p>Early access · No paid plans are live.</p><div className="flex items-center gap-5"><Link href="/" className="transition hover:text-white">Home</Link><Link href="/login" className="transition hover:text-white">Log in</Link></div></div></footer>
        </main>
    );
}
