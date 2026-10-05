'use client';

import { useState } from 'react';
import Link from 'next/link';
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
        features: ['Record and edit videos', 'Create photo + video reels', '60-second recording and export limit', 'CreatorStudio watermark', 'Drafts stored in this browser'],
        status: 'Available now',
        action: 'Try the preview',
        href: '/login?setup=1',
    },
    {
        id: 'creator',
        name: 'Creator',
        price: '₹499',
        period: 'per month · proposed',
        summary: 'For regular publishing and longer-form creative work.',
        features: ['Everything in Preview', 'Proposed exports up to 5 minutes', 'Proposed watermark-free exports', 'Proposed monthly AI usage allowance', 'Cloud project sync planned'],
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

export function PricingPlans() {
    const [audience, setAudience] = useState<Audience>('creator');
    const recommendedPlan = audienceCopy[audience].recommendation;

    return (
        <>
            <section aria-labelledby="audience-title" className="relative z-10 mx-auto max-w-6xl px-5 pb-10 sm:px-8 lg:px-12">
                <div className="rounded-3xl border border-white/10 bg-white/3 p-5 sm:p-7">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Find your fit</p>
                            <h2 id="audience-title" className="mt-2 text-xl font-semibold text-white">What are you making?</h2>
                            <p className="mt-1 text-sm text-neutral-400">We’ll suggest a starting point. Your choice won’t lock you out of any tools.</p>
                        </div>
                        <div role="group" aria-label="Choose your use case" className="grid grid-cols-3 gap-2">
                            {audiences.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={audience === id} onClick={() => setAudience(id)} className={`flex min-w-24 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${audience === id ? 'border-indigo-300/50 bg-indigo-400/15 text-white' : 'border-white/10 bg-black/10 text-neutral-400 hover:border-white/20 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}
                        </div>
                    </div>
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-indigo-300/10 bg-indigo-300/5 px-3.5 py-3 text-sm text-neutral-300"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" /><p><span className="font-semibold text-white">{audienceCopy[audience].title}:</span> {audienceCopy[audience].description} Suggested package: <span className="font-semibold text-indigo-200">{recommendedPlan === 'creator' ? 'Creator' : 'Studio'}</span>. Packages are based on usage; audience profiles only tailor recommendations.</p></div>
                </div>
            </section>

            <section aria-label="CreatorStudio packages" className="relative z-10 mx-auto grid max-w-7xl gap-4 px-5 pb-16 sm:px-8 lg:grid-cols-3 lg:px-12">
                {plans.map((plan) => {
                    const recommended = plan.id === recommendedPlan;
                    const available = plan.id === 'preview';
                    return <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 sm:p-7 ${recommended ? 'border-indigo-300/45 bg-[#111522] shadow-xl shadow-indigo-950/20' : 'border-white/10 bg-white/2.5'}`}>
                        {recommended && <span className="absolute -top-3 left-6 rounded-full border border-indigo-300/25 bg-[#1a1b35] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">Suggested for you</span>}
                        <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold text-white">{plan.name}</p><p className="mt-2 min-h-12 text-sm leading-5 text-neutral-400">{plan.summary}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${available ? 'bg-emerald-300/10 text-emerald-200' : 'bg-white/5 text-neutral-400'}`}>{plan.status}</span></div>
                        <div className="mt-6 flex items-baseline gap-2"><span className="text-4xl font-semibold tracking-tight text-white">{plan.price}</span><span className="text-xs text-neutral-500">{plan.period}</span></div>
                        <div className="my-6 h-px bg-white/10" />
                        <ul className="flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-neutral-300"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${available ? 'text-emerald-300' : 'text-indigo-300'}`} />{feature}</li>)}</ul>
                        <Link href={plan.href} className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${available ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'border border-white/10 bg-white/4 text-neutral-300 hover:border-white/20 hover:text-white'}`}>{plan.action}{available && <ArrowRight className="h-4 w-4" />}</Link>
                    </article>;
                })}
            </section>

            <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-12">
                <div className="rounded-3xl border border-amber-300/15 bg-amber-300/4 p-5 sm:p-6"><h2 className="text-sm font-semibold text-amber-100">A note about proposed prices</h2><p className="mt-2 text-sm leading-6 text-amber-100/70">Creator and Studio prices and future features are planning estimates, not offers. We’ll validate production, storage, payment, and AI-provider costs before enabling subscriptions. AI usage is not included in a paid package until an allowance and provider billing are configured. There is no checkout today.</p></div>
            </section>
        </>
    );
}
