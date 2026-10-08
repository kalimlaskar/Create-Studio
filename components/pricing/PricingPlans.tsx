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
            {/* Audience Selector Section */}
            <section aria-labelledby="audience-title" className="relative z-10 mx-auto pb-8 ">
                <div className="rounded-[2rem] border border-[#14121F]/10 bg-white p-6 shadow-[0_15px_40px_-15px_rgba(20,18,31,0.06)] sm:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3 py-1 text-xs font-semibold text-[#6A4CFF]">
                                Plan selector
                            </span>
                            <h2 id="audience-title" className="mt-2.5 text-2xl font-bold tracking-tight text-[#14121F]">
                                Choose a starting point
                            </h2>
                            <p className="mt-1 text-sm text-[#14121F]/65">
                                Pick the closest fit. You can use every tool in the preview.
                            </p>
                        </div>
                        <div role="group" aria-label="Choose your use case" className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F7F6FB] p-1.5 border border-[#14121F]/10">
                            {audiences.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={audience === id}
                                    onClick={() => setAudience(id)}
                                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all sm:gap-2 sm:px-4 sm:text-sm ${audience === id
                                        ? 'bg-[#14121F] text-white shadow-md'
                                        : 'text-[#14121F]/70 hover:bg-white hover:text-[#14121F]'
                                        }`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#6A4CFF]/5 border border-[#6A4CFF]/15 px-4 py-3 text-xs leading-5 text-[#14121F]/80">
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#6A4CFF]" />
                        <span>
                            <strong className="font-bold text-[#14121F]">{audienceCopy[audience].title}:</strong> {audienceCopy[audience].description} Suggested plan:{' '}
                            <strong className="font-bold text-[#6A4CFF]">{recommendedPlan === 'creator' ? 'Creator' : 'Studio'}</strong>.
                        </span>
                    </div>
                </div>
            </section>

            {/* Plans Grid */}
            <section aria-label="Cliprame packages" className="relative z-10 mx-auto grid max-w-7xl gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-3 lg:px-12">
                {plans.map((plan) => {
                    const recommended = plan.id === recommendedPlan;
                    const available = plan.id === 'preview';
                    const purchasable = plan.id === 'creator' && billingEnabled;

                    return (
                        <article
                            key={plan.id}
                            className={`relative flex flex-col rounded-[2.2rem] p-7 sm:p-8 transition-all duration-300 ${recommended
                                ? 'border-2 border-[#6A4CFF] bg-white shadow-[0_20px_50px_-15px_rgba(106,76,255,0.15)] ring-4 ring-[#6A4CFF]/10'
                                : 'border border-[#14121F]/10 bg-white shadow-[0_15px_40px_-15px_rgba(20,18,31,0.06)] hover:border-[#14121F]/20'
                                }`}
                        >
                            {recommended && (
                                <span className="absolute -top-3.5 left-7 inline-flex items-center gap-1 rounded-full bg-[#6A4CFF] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                                    Suggested for you
                                </span>
                            )}

                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-[#14121F]">{plan.name}</h3>
                                    <p className="mt-2 min-h-12 text-sm leading-6 text-[#14121F]/65">{plan.summary}</p>
                                </div>
                                <span
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${available || purchasable
                                        ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                        : 'bg-[#14121F]/5 text-[#14121F]/60'
                                        }`}
                                >
                                    {purchasable ? 'Available now' : plan.status}
                                </span>
                            </div>

                            <div className="mt-6 flex items-baseline gap-2">
                                <span className="text-4xl font-extrabold tracking-tight text-[#14121F]">{plan.price}</span>
                                <span className="text-xs font-medium text-[#14121F]/50">{plan.period}</span>
                            </div>

                            <div className="my-6 h-px bg-[#14121F]/10" />

                            <ul className="flex-1 space-y-3.5">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3 text-sm leading-5 text-[#14121F]/80 font-medium">
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${available ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[#6A4CFF]/10 text-[#6A4CFF]'}`}>
                                            <Check className="h-3.5 w-3.5" />
                                        </span>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {purchasable ? (
                                <div className="mt-8">
                                    <UpgradeButton className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#14121F] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#14121F]/20 transition hover:bg-[#2c2742] disabled:opacity-60">
                                        Upgrade to Creator
                                    </UpgradeButton>
                                </div>
                            ) : (
                                <Link
                                    href={plan.href}
                                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold transition ${available
                                        ? 'bg-[#14121F] text-white shadow-lg shadow-[#14121F]/20 hover:bg-[#2c2742]'
                                        : 'border border-[#14121F]/15 bg-[#F7F6FB] text-[#14121F]/75 hover:bg-[#14121F] hover:text-white hover:border-[#14121F]'
                                        }`}
                                >
                                    {plan.action}
                                    {available && <ArrowRight className="h-4 w-4" />}
                                </Link>
                            )}
                        </article>
                    );
                })}
            </section>

            {/* Disclaimer Footer Notice */}
            <section className="relative z-10 mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
                <div className="rounded-[2rem] border border-[#14121F]/10 bg-white/60 p-6 backdrop-blur-md sm:p-8">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">About proposed plans</h2>
                    <p className="mt-2 max-w-4xl text-xs leading-6 text-[#14121F]/55">
                        Creator and Studio prices and future features are planning estimates, not offers. We’ll validate production, storage, payment, and AI-provider costs before enabling subscriptions. AI usage is not included in a paid package until an allowance and provider billing are configured. Creator checkout is available when payments are enabled; Studio is not yet on sale.
                    </p>
                </div>
            </section>
        </>
    );
}