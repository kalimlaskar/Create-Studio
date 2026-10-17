'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeButton } from '@/components/billing/UpgradeButton';
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Check, Rocket } from 'lucide-react';
import { exportLabel, formatUsd, isPaidPlan, type CatalogPlan } from './planLimits';

type Audience = 'founder' | 'sales' | 'agency';

const audiences: Array<{ id: Audience; label: string; icon: typeof Rocket }> = [
    { id: 'founder', label: 'Founder', icon: Rocket },
    { id: 'sales', label: 'Sales', icon: BriefcaseBusiness },
    { id: 'agency', label: 'Agency', icon: Building2 },
];

/** Which paid package to suggest: the first one, or the biggest for sales teams. */
const audienceCopy: Record<Audience, { description: string; pick: 'first' | 'last' }> = {
    founder: { description: 'Send personal demos and investor updates, and follow up when they watch.', pick: 'first' },
    sales: { description: 'Send a video to every prospect and get alerts in Slack or HubSpot when they watch.', pick: 'last' },
    agency: { description: 'Walk clients through proposals, lock them with a password, and see what they reread.', pick: 'first' },
};

/** Words for the built-in packages until an admin writes a description. */
const DEFAULT_SUMMARY: Record<string, string> = {
    free: 'Record, send and track your first videos, with the full analytics.',
    creator: 'Room for a video to every prospect, longer walkthroughs and no watermark.',
    studio: 'The most videos and the longest walkthroughs, for people who send every day.',
};

/** What a package includes, in words, from its limits. Later packages list only what's better. */
function featuresFor(plan: CatalogPlan, previous: CatalogPlan | null) {
    const lines: string[] = [];
    const differs = <K extends keyof CatalogPlan>(key: K) => !previous || previous[key] !== plan[key];
    if (previous) lines.push(`Everything in ${previous.name}`);
    if (differs('hostedVideos')) lines.push(`${plan.hostedVideos.toLocaleString('en-IN')} videos hosted with tracked links`);
    if (!previous) lines.push('Personal links, viewer analytics and drop-off heatmaps');
    if (plan.protection && (!previous || !previous.protection)) lines.push('PIN, password and email-code protection');
    if (plan.forms && (!previous || !previous.forms)) lines.push('Lead forms, buttons and booking embeds in videos');
    if (plan.maxIntegrations > 0 && differs('maxIntegrations')) lines.push(plan.maxIntegrations >= 20 ? 'Slack, HubSpot and webhook alerts' : `Up to ${plan.maxIntegrations} Slack, HubSpot or webhook ${plan.maxIntegrations === 1 ? 'connection' : 'connections'}`);
    if (!previous) lines.push('Private teleprompter, screen + camera, edit by text');
    if (differs('exportSeconds') || differs('watermark')) lines.push(`Videos up to ${exportLabel(plan)}${plan.watermark ? ', with a Cliprame watermark' : ''}`);
    if (previous?.watermark && !plan.watermark) lines.push('No watermark');
    if (plan.embedDomains && (!previous || !previous.embedDomains)) lines.push('Limit embeds to your own websites');
    if (differs('transcriptionMinutes')) lines.push(`${plan.transcriptionMinutes} min of transcription per month (captions and edit by text)`);
    if (differs('voiceoverMinutes')) lines.push(`${plan.voiceoverMinutes} min of AI voiceover per month`);
    return lines;
}

interface PricingPlansProps {
    /** Packages on sale, in order. */
    plans: CatalogPlan[];
    /** Which packages can be bought right now (Razorpay is set up for them). */
    available: Record<string, boolean>;
    supportEmail?: string;
}

const primaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#15120F] px-5 py-3 text-[15px] font-semibold text-[#F6F4EF] transition hover:bg-[#2B2722] disabled:opacity-60';
const secondaryButton = 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#15120F]/15 px-5 py-3 text-[15px] font-semibold text-[#15120F] transition hover:border-[#15120F]/40 hover:bg-[#15120F]/[0.03]';
const serif = 'font-[family-name:var(--font-serif)] font-normal italic';

export function PricingPlans({ plans, available, supportEmail }: PricingPlansProps) {
    const [audience, setAudience] = useState<Audience>('founder');
    const paid = plans.filter(isPaidPlan);
    const suggested = (audienceCopy[audience].pick === 'last' ? paid[paid.length - 1] : paid[0]) ?? plans[0];
    const recommendedPlan = suggested?.id;

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
                    <span>{audienceCopy[audience].description} We’d suggest <strong className="font-semibold text-[#15120F]">{suggested?.name}</strong>.</span>
                </p>
            </section>

            {/* Plans */}
            <section aria-label="Cliprame plans" className={`mt-10 grid gap-5 ${plans.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
                {plans.map((limits, index) => {
                    const id = limits.id;
                    const free = !isPaidPlan(limits);
                    const copy = { badge: free ? 'No card needed' : '', period: free ? 'to get started' : 'per month', summary: limits.description || DEFAULT_SUMMARY[id] || '' };
                    const features = featuresFor(limits, index > 0 ? plans[index - 1] : null);
                    const recommended = id === recommendedPlan;
                    const canCheckout = Boolean(available[id]);
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
                                {free ? (
                                    <Link href="/signup" className={recommended ? primaryButton : secondaryButton}>Start free <ArrowRight className="h-4 w-4" /></Link>
                                ) : canCheckout ? (
                                    <UpgradeButton plan={id} className={recommended ? primaryButton : secondaryButton}>Upgrade to {limits.name}</UpgradeButton>
                                ) : (
                                    <a href={contactHref} className={secondaryButton}>Contact us to upgrade</a>
                                )}
                            </div>

                            <ul className="mt-7 space-y-3 border-t border-[#15120F]/10 pt-6">
                                {features.map((feature) => (
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
