'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Check, GraduationCap, UserRound } from 'lucide-react';

type Audience = 'creator' | 'business' | 'educator';

const audiences: Array<{ id: Audience; label: string; icon: typeof UserRound }> = [
    { id: 'creator', label: 'Creator', icon: UserRound },
    { id: 'business', label: 'Business', icon: BriefcaseBusiness },
    { id: 'educator', label: 'Educator', icon: GraduationCap },
];

const audienceCopy: Record<Audience, { title: string; description: string; recommendation: 'creator' | 'studio' }> = {
    creator: { title: 'For creators', description: 'Make short-form videos, photo reels, and personal stories.', recommendation: 'creator' },
    business: { title: 'For businesses', description: 'Create product explainers, social posts, and brand videos.', recommendation: 'studio' },
    educator: { title: 'For educators', description: 'Record lessons, presentations, and clear explainers.', recommendation: 'creator' },
};

const plans = [
    {
        id: 'preview',
        name: 'Preview',
        price: '₹0',
        period: 'while in early access',
        summary: 'Try the core studio with the current preview limits.',
        features: ['Record and edit videos', 'Create photo + video reels', '2 AI requests per day', '60-second recording and export limit', 'Cliprame watermark', 'Drafts stored in this browser'],
        status: 'Available now',
        action: 'Try the preview',
        href: '/login?setup=1',
    },
    {
        id: 'creator',
        name: 'Creator',
        price: '₹499',
        period: 'per month',
        summary: 'For regular publishing and longer-form creative work.',
        features: ['Everything in Preview', 'Proposed exports up to 5 minutes', 'Proposed watermark-free exports', 'Pro AI limits (fair use, 200 requests/day)', 'Cloud project sync planned'],
        status: 'Proposed · not available yet',
        action: 'Planned for launch',
        href: '/login?setup=1',
    },
    {
        id: 'studio',
        name: 'Studio',
        price: '₹1,499',
        period: 'per month · proposed',
        summary: 'For teams and high-volume publishing workflows.',
        features: ['Everything in Creator', 'Proposed exports up to 15 minutes', 'Proposed larger AI usage allowance', 'Brand kits and reusable assets planned', 'Team tools and shared projects planned'],
        status: 'Proposed · not available yet',
        action: 'Planned for launch',
        href: '/login?setup=1',
    },
];

export function PricingPlans({ billingEnabled = false }: { billingEnabled?: boolean }) {
    const [audience, setAudience] = useState<Audience>('creator');
    const recommendedPlan = audienceCopy[audience].recommendation;

    return (
        <>
            <section aria-labelledby="audience-title" className="relative z-10 mx-auto max-w-7xl px-5 pb-8 sm:px-8 lg:px-12">
                <div className="border-b border-neutral-800 pb-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Plan selector</p>
                            <h2 id="audience-title" className="mt-2 text-xl font-semibold text-white">Choose a starting point</h2>
                            <p className="mt-1 text-sm text-neutral-400">Pick the closest fit. You can use every tool in the preview.</p>
                        </div>
                        <div role="group" aria-label="Choose your use case" className="grid grid-cols-3 gap-2">
                            {audiences.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={audience === id} onClick={() => setAudience(id)} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2.5 text-xs font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${audience === id ? 'border-neutral-600 bg-neutral-800 text-white' : 'border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" />{label}</button>)}
                        </div>
                    </div>
                    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-400"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" /><span><span className="font-semibold text-neutral-200">{audienceCopy[audience].title}:</span> {audienceCopy[audience].description} Suggested plan: <span className="font-semibold text-indigo-200">{recommendedPlan === 'creator' ? 'Creator' : 'Studio'}</span>.</span></p>
                </div>
            </section>

            <section aria-label="Cliprame packages" className="relative z-10 mx-auto grid max-w-7xl gap-3 px-5 pb-12 sm:px-8 lg:grid-cols-3 lg:px-12">
                {plans.map((plan) => {
                    const recommended = plan.id === recommendedPlan;
                    const available = plan.id === 'preview';
                    const purchasable = plan.id === 'creator' && billingEnabled;
                    return <article key={plan.id} className={`flex flex-col rounded-xl border p-5 sm:p-6 ${recommended ? 'border-indigo-400/45 bg-[#11141f]' : 'border-neutral-800 bg-neutral-900/70'}`}>
                        {recommended && <span className="mb-3 inline-flex w-fit rounded-md border border-indigo-400/20 bg-indigo-400/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Suggested for you</span>}
                        <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold text-white">{plan.name}</p><p className="mt-2 min-h-12 text-sm leading-5 text-neutral-400">{plan.summary}</p></div><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${available || purchasable ? 'bg-emerald-400/10 text-emerald-200' : 'bg-neutral-800 text-neutral-400'}`}>{purchasable ? 'Available now' : plan.status}</span></div>
                        <div className="mt-6 flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-tight text-white">{plan.price}</span><span className="text-xs text-neutral-500">{plan.period}</span></div>
                        <div className="my-6 h-px bg-white/10" />
                        <ul className="flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-neutral-300"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${available ? 'text-emerald-300' : 'text-indigo-300'}`} />{feature}</li>)}</ul>
                        {purchasable ? <div className="mt-8"><UpgradeButton className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">Upgrade to Creator</UpgradeButton></div> : <Link href={plan.href} className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${available ? 'bg-linear-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 text-white hover:brightness-110' : 'border border-neutral-700 bg-neutral-800/70 text-neutral-300 hover:border-neutral-600 hover:text-white'}`}>{plan.action}{available && <ArrowRight className="h-4 w-4" />}</Link>}
                    </article>;
                })}
            </section>

            <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
                <div className="border-t border-neutral-800 pt-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-amber-200">About proposed plans</h2><p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-500">Creator and Studio prices and future features are planning estimates, not offers. We’ll validate production, storage, payment, and AI-provider costs before enabling subscriptions. AI usage is not included in a paid package until an allowance and provider billing are configured. Creator checkout is available when payments are enabled; Studio is not yet on sale.</p></div>
            </section>
        </>
    );
}
