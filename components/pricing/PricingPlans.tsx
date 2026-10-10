'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Check, GraduationCap, UserRound } from 'lucide-react';
import { PLAN_LIMITS, PLAN_ORDER, PlanId, PlanLimit, exportLabel, formatUsd } from './planLimits';

type Audience = 'creator' | 'business' | 'educator';

const audiences: Array<{ id: Audience; label: string; icon: typeof UserRound }> = [
    { id: 'creator', label: 'Creator', icon: UserRound },
    { id: 'business', label: 'Business', icon: BriefcaseBusiness },
    { id: 'educator', label: 'Educator', icon: GraduationCap },
];

const audienceCopy: Record<Audience, { title: string; description: string; recommendation: PlanId }> = {
    creator: { title: 'For creators', description: 'Make short-form videos, photo reels and personal stories.', recommendation: 'creator' },
    business: { title: 'For businesses', description: 'Create product demos, showcase reels and brand videos.', recommendation: 'studio' },
    educator: { title: 'For educators', description: 'Record lessons, presentations and clear explainers.', recommendation: 'creator' },
};

const planCopy: Record<PlanId, { badge: string; period: string; summary: string }> = {
    free: { badge: 'No card needed', period: 'to get started', summary: 'Every tool in the studio, with limits that suit trying it out.' },
    creator: { badge: 'For regular publishing', period: 'per month', summary: 'Longer videos, clean exports and plenty of AI for your weekly content.' },
    studio: { badge: 'For high-volume work', period: 'per month', summary: 'The most room for brands and creators who publish a lot.' },
};

const aiFeatures = (plan: PlanLimit) => [
    `${plan.transcriptionMinutes} min of transcription per month (captions and edit by text)`,
    `${plan.voiceoverMinutes} min of AI voiceover per month`,
];

const planFeatures: Record<PlanId, string[]> = {
    free: [
        'Record with camera or screen share',
        'Floating camera card and private teleprompter',
        'Edit by text, trim and split',
        'Photo + video reels with product templates',
        'Captions, backgrounds and visual effects',
        'AI script writing (fair use)',
        ...aiFeatures(PLAN_LIMITS.free),
        `Exports up to ${exportLabel(PLAN_LIMITS.free)}, with a Cliprame watermark`,
        'Drafts saved in your browser',
    ],
    creator: [
        'Everything in Free',
        `Exports up to ${exportLabel(PLAN_LIMITS.creator)}`,
        'No watermark on your videos',
        ...aiFeatures(PLAN_LIMITS.creator),
    ],
    studio: [
        'Everything in Creator',
        `Exports up to ${exportLabel(PLAN_LIMITS.studio)}`,
        ...aiFeatures(PLAN_LIMITS.studio),
    ],
};

interface PricingPlansProps {
    available: { creator: boolean; studio: boolean };
    supportEmail?: string;
}

const primaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#14121F] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#14121F]/20 transition hover:bg-[#2c2742] disabled:opacity-60';
const secondaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#14121F]/15 bg-[#F7F6FB] px-5 py-3.5 text-sm font-semibold text-[#14121F]/75 transition hover:border-[#14121F] hover:bg-[#14121F] hover:text-white';

export function PricingPlans({ available, supportEmail }: PricingPlansProps) {
    const [audience, setAudience] = useState<Audience>('creator');
    const recommendedPlan = audienceCopy[audience].recommendation;

    return (
        <>
            {/* Audience selector */}
            <section aria-labelledby="audience-title" className="relative z-10 mx-auto pb-8">
                <div className="rounded-[2rem] border border-[#14121F]/10 bg-white p-6 shadow-[0_15px_40px_-15px_rgba(20,18,31,0.06)] sm:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3 py-1 text-xs font-semibold text-[#6A4CFF]">Plan finder</span>
                            <h2 id="audience-title" className="mt-2.5 text-2xl font-bold tracking-tight text-[#14121F]">Find your plan</h2>
                            <p className="mt-1 text-sm text-[#14121F]/65">Every plan includes every tool. Pick the one that fits how much you publish.</p>
                        </div>
                        <div role="group" aria-label="Choose your use case" className="grid grid-cols-3 gap-2 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] p-1.5">
                            {audiences.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={audience === id}
                                    onClick={() => setAudience(id)}
                                    className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all sm:gap-2 sm:px-4 sm:text-sm ${audience === id ? 'bg-[#14121F] text-white shadow-md' : 'text-[#14121F]/70 hover:bg-white hover:text-[#14121F]'}`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#6A4CFF]/15 bg-[#6A4CFF]/5 px-4 py-3 text-xs leading-5 text-[#14121F]/80">
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#6A4CFF]" />
                        <span>
                            <strong className="font-bold text-[#14121F]">{audienceCopy[audience].title}:</strong> {audienceCopy[audience].description} Suggested plan:{' '}
                            <strong className="font-bold text-[#6A4CFF]">{PLAN_LIMITS[recommendedPlan].name}</strong>.
                        </span>
                    </div>
                </div>
            </section>

            {/* Plans */}
            <section aria-label="Cliprame plans" className="relative z-10 mx-auto grid max-w-7xl gap-6 pb-8 lg:grid-cols-3">
                {PLAN_ORDER.map((id) => {
                    const limits = PLAN_LIMITS[id];
                    const copy = planCopy[id];
                    const recommended = id === recommendedPlan;
                    const canCheckout = id === 'creator' ? available.creator : id === 'studio' ? available.studio : false;
                    const contactHref = supportEmail ? `mailto:${supportEmail}?subject=${encodeURIComponent(`Cliprame ${limits.name} plan`)}` : '/login';

                    return (
                        <article
                            key={id}
                            className={`relative flex flex-col justify-between rounded-[2.2rem] p-7 transition-all duration-300 sm:p-8 ${recommended
                                ? 'border-2 border-[#6A4CFF] bg-white shadow-[0_20px_50px_-15px_rgba(106,76,255,0.15)] ring-4 ring-[#6A4CFF]/10'
                                : 'border border-[#14121F]/10 bg-white shadow-[0_15px_40px_-15px_rgba(20,18,31,0.06)] hover:border-[#14121F]/20'}`}
                        >
                            {recommended && (
                                <span className="absolute -top-3.5 left-7 inline-flex items-center gap-1 rounded-full bg-[#6A4CFF] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                                    Suggested for you
                                </span>
                            )}

                            <div>
                                <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                                    <h3 className="text-xl font-bold tracking-tight text-[#14121F]">{limits.name}</h3>
                                    <span className="shrink-0 rounded-full border border-[#14121F]/10 bg-[#14121F]/5 px-3 py-1 text-xs font-semibold text-[#14121F]/65">{copy.badge}</span>
                                </div>

                                <p className="mt-2 min-h-12 text-sm leading-6 text-[#14121F]/65">{copy.summary}</p>

                                <div className="mt-6 flex items-baseline gap-2">
                                    <span className="text-4xl font-extrabold tracking-tight text-[#14121F]">{formatUsd(limits.priceUsd)}</span>
                                    <span className="text-xs font-medium text-[#14121F]/50">{copy.period}</span>
                                </div>

                                <div className="my-6 h-px bg-[#14121F]/10" />

                                <ul className="space-y-3.5">
                                    {planFeatures[id].map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-sm font-medium leading-5 text-[#14121F]/80">
                                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/10 text-[#6A4CFF]"><Check className="h-3.5 w-3.5" /></span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-8 pt-4">
                                {id === 'free' ? (
                                    <Link href="/login?setup=1" className={primaryButton}>
                                        Start free <ArrowRight className="h-4 w-4" />
                                    </Link>
                                ) : canCheckout ? (
                                    /* Pass plan as props if UpgradeButton accepts it, or handle via children/attributes matching your component definition */
                                    <UpgradeButton {...({ plan: id } as any)} className={recommended ? primaryButton : secondaryButton}>
                                        Upgrade to {limits.name}
                                    </UpgradeButton>
                                ) : (
                                    <a href={contactHref} className={secondaryButton}>Contact us to upgrade</a>
                                )}
                            </div>
                        </article>
                    );
                })}
            </section>

            <p className="relative z-10 mx-auto pb-10 text-center text-xs leading-6 text-[#14121F]/55">
                Prices are in USD and billed monthly. AI minutes reset every month. Payments are processed securely. Read our{' '}
                <Link href="/refunds" className="font-semibold text-[#14121F]/75 underline underline-offset-2 hover:text-[#14121F]">refund &amp; cancellation policy</Link>.
            </p>
        </>
    );
}