import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PricingPlans } from '@/components/pricing/PricingPlans';

export const metadata: Metadata = {
    title: 'Pricing | CreatorStudio',
    description: 'See what CreatorStudio includes today and what is still in development. No paid subscription is currently available.',
};

export default function PricingPage() {
    return (
        <main className="relative min-h-dvh overflow-hidden bg-[#080a12] text-white selection:bg-indigo-400/30">
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(79,70,229,0.15),transparent_36%),radial-gradient(ellipse_at_85%_55%,rgba(56,189,248,0.08),transparent_32%)]" />
            <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
                <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-white"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/40"><Sparkles className="h-5 w-5" /></span><span>Creator<span className="text-indigo-300">Studio</span></span></Link>
                <div className="flex items-center gap-2 sm:gap-3"><Link href="/" className="hidden rounded-xl px-3 py-2 text-sm text-neutral-400 transition hover:text-white sm:inline-flex">Home</Link><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-neutral-300 transition hover:text-white sm:px-4">Log in</Link><Link href="/login?setup=1" className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-100 sm:px-5">Try the studio</Link></div>
            </header>

            <section className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-12 text-center sm:px-8 sm:pt-20">
                <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-medium text-neutral-500 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back to CreatorStudio</Link>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">Plans for every kind of creator</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Pick your way to<br /><span className="bg-linear-to-r from-indigo-300 via-sky-200 to-fuchsia-300 bg-clip-text text-transparent">make more.</span></h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">Choose a use case to see a suggested package. Start with the current preview; proposed subscriptions are clearly marked and cannot be purchased yet.</p>
            </section>

            <PricingPlans />

            <footer className="relative z-10 border-t border-white/[0.07]"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-neutral-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><Link href="/" className="font-semibold text-white">Creator<span className="text-indigo-300">Studio</span></Link><p>Early access · No paid plans are live.</p><div className="flex items-center gap-5"><Link href="/" className="transition hover:text-white">Home</Link><Link href="/login" className="transition hover:text-white">Log in</Link></div></div></footer>
        </main>
    );
}
