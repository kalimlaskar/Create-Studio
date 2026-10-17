'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Check, Rocket } from 'lucide-react';
import { PLAN_LIMITS, PLAN_ORDER, PlanId, PlanLimit, exportLabel, formatUsd } from './planLimits';

type Audience = 'founder' | 'sales' | 'agency';

const audiences: Array<{ id: Audience; label: string; icon: typeof Rocket }> = [
    { id: 'founder', label: 'Founder', icon: Rocket },
    { id: 'sales', label: 'Sales', icon: BriefcaseBusiness },
    { id: 'agency', label: 'Agency', icon: Building2 },
];

const audienceCopy: Record<Audience, { title: string; description: string; recommendation: PlanId }> = {
    founder: { title: 'For founders', description: 'Send personal demos and investor updates, and follow up when they watch.', recommendation: 'creator' },
    sales: { title: 'For sales', description: 'Send a video to every prospect and get alerts in Slack or HubSpot when they watch.', recommendation: 'studio' },
    agency: { title: 'For agencies', description: 'Walk clients through proposals, lock them with a password, and see what they reread.', recommendation: 'creator' },
};

const planCopy: Record<PlanId, { badge: string; period: string; summary: string }> = {
    free: { badge: 'No card needed', period: 'to get started', summary: 'Record, send and track your first videos, with the full analytics.' },
    creator: { badge: 'For weekly outreach', period: 'per month', summary: 'Room for a video to every prospect, longer walkthroughs and no watermark.' },
    studio: { badge: 'For high-volume teams', period: 'per month', summary: 'The most videos and the longest walkthroughs, for people who send every day.' },
};

const hosted = (plan: PlanLimit) => `${plan.hostedVideos} videos hosted with tracked links`;
const aiFeatures = (plan: PlanLimit) => [
    `${plan.transcriptionMinutes} min of transcription per month (captions and edit by text)`,
    `${plan.voiceoverMinutes} min of AI voiceover per month`,
];

const planFeatures: Record<PlanId, string[]> = {
    free: [
        hosted(PLAN_LIMITS.free),
        'Personal links, viewer analytics and drop-off heatmaps',
        'PIN, password and email-code protection',
        'Slack, HubSpot and webhook alerts',
        'Private teleprompter, screen + camera, edit by text',
        `Videos up to ${exportLabel(PLAN_LIMITS.free)}, with a Cliprame watermark`,
        ...aiFeatures(PLAN_LIMITS.free),
    ],
    creator: [
        'Everything in Free',
        hosted(PLAN_LIMITS.creator),
        `Videos up to ${exportLabel(PLAN_LIMITS.creator)}`,
        'No watermark',
        'Limit embeds to your own websites',
        ...aiFeatures(PLAN_LIMITS.creator),
    ],
    studio: [
        'Everything in Creator',
        hosted(PLAN_LIMITS.studio),
        `Videos up to ${exportLabel(PLAN_LIMITS.studio)}`,
        ...aiFeatures(PLAN_LIMITS.studio),
    ],
};

interface PricingPlansProps {
    available: { creator: boolean; studio: boolean };
    supportEmail?: string;
}

const primaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#15120F] px-5 py-3 text-[15px] font-semibold text-[#F6F4EF] transition hover:bg-[#2B2722] disabled:opacity-60';
const secondaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#15120F]/15 px-5 py-3 text-[15px] font-semibold text-[#15120F] transition hover:border-[#15120F]/40 hover:bg-[#15120F]/[0.03]';
const serif = 'font-[family-name:var(--font-serif)] font-normal italic';

export function PricingPlans({ available, supportEmail }: PricingPlansProps) {
    const [audience, setAudience] = useState<Audience>('founder');
    const recommendedPlan = audienceCopy[audience].recommendation;

    return (
        <>
            {/* Who it's for */}
            <section aria-labelledby="audience-title" className="flex flex-col gap-4 border-y border-[#15120F]/10 py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <h2 id="audience-title" className="text-[15px] font-semibold">I’m a</h2>
                    <div role="group" aria-label="Choose your use case" className="flex gap-1">
                        {audiences.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={audience === id}
                                onClick={() => setAudience(id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${audience === id ? 'bg-[#15120F] text-[#F6F4EF]' : 'text-[#15120F]/55 hover:bg-[#15120F]/[0.05] hover:text-[#15120F]'}`}
                            >
                                <Icon className="h-4 w-4" />{label}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="flex items-start gap-2 text-sm text-[#15120F]/60 md:max-w-md md:text-right">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5B3DF5] md:hidden" />
                    <span>{audienceCopy[audience].description} We’d suggest <strong className="font-semibold text-[#15120F]">{PLAN_LIMITS[recommendedPlan].name}</strong>.</span>
                </p>
            </section>

            {/* Plans */}
            <section aria-label="Cliprame plans" className="mt-10 grid gap-5 lg:grid-cols-3">
                {PLAN_ORDER.map((id) => {
                    const limits = PLAN_LIMITS[id];
                    const copy = planCopy[id];
                    const recommended = id === recommendedPlan;
                    const canCheckout = id === 'creator' ? available.creator : id === 'studio' ? available.studio : false;
                    const contactHref = supportEmail ? `mailto:${supportEmail}?subject=${encodeURIComponent(`Cliprame ${limits.name} plan`)}` : '/login';

                    return (
                        <article
                            key={id}
                            className={`relative flex flex-col rounded-2xl p-7 transition-colors duration-300 ${recommended ? 'border-2 border-[#15120F] bg-white' : 'border border-[#15120F]/10 bg-white/60'}`}
                        >
                            {recommended && (
                                <span className="absolute -top-3 left-6 rounded-md bg-[#15120F] px-2.5 py-1 text-[11px] font-semibold text-[#F6F4EF]">Suggested for you</span>
                            )}
                            <div className="flex items-baseline justify-between gap-3">
                                <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">{limits.name}</h3>
                                <span className="text-xs text-[#15120F]/45">{copy.badge}</span>
                            </div>
                            <p className="mt-2 text-[15px] leading-6 text-[#15120F]/60 lg:min-h-[4.5rem]">{copy.summary}</p>

                            <p className="mt-6 flex items-baseline gap-2">
                                <span className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-[-0.04em]">{formatUsd(limits.priceUsd)}</span>
                                <span className={`${serif} text-lg text-[#15120F]/50`}>{copy.period}</span>
                            </p>

                            <div className="mt-6">
                                {id === 'free' ? (
                                    <Link href="/signup" className={recommended ? primaryButton : secondaryButton}>Start free <ArrowRight className="h-4 w-4" /></Link>
                                ) : canCheckout ? (
                                    <UpgradeButton plan={id} className={recommended ? primaryButton : secondaryButton}>Upgrade to {limits.name}</UpgradeButton>
                                ) : (
                                    <a href={contactHref} className={secondaryButton}>Contact us to upgrade</a>
                                )}
                            </div>

                            <ul className="mt-7 space-y-3 border-t border-[#15120F]/10 pt-6">
                                {planFeatures[id].map((feature) => (
                                    <li key={feature} className="flex items-start gap-2.5 text-[14.5px] leading-6 text-[#15120F]/75">
                                        <Check className="mt-1 h-4 w-4 shrink-0 text-[#5B3DF5]" strokeWidth={2.4} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </article>
                    );
                })}
            </section>

            <p className="mt-6 text-center text-xs leading-6 text-[#15120F]/50">
                Prices are in USD and billed monthly. AI minutes reset every month. Payments are processed securely. Read our{' '}
                <Link href="/refunds" className="font-semibold text-[#15120F]/75 underline underline-offset-2 hover:text-[#15120F]">refund &amp; cancellation policy</Link>.
            </p>
        </>
    );
}
