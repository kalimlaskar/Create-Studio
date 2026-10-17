import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BellRing, EyeOff, Link2, Plus, Repeat, ScreenShare, Scissors, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { PricingPlans } from '@/components/pricing/PricingPlans';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { getMarketingSession } from '@/components/marketing/session';
import { D as DISPLAY, focus as FOCUS, label, serif } from '@/components/marketing/theme';
import { PLAN_LIMITS, exportLabel, watermarkLabel } from '@/components/pricing/planLimits';


export const metadata: Metadata = {
    title: 'Pricing | Cliprame',
    description: 'Start free with tracked links, viewer analytics, protection and Slack/HubSpot alerts. Upgrade to host more videos, send longer walkthroughs and remove the watermark.',
};



const included = [
    { icon: Link2, title: 'Personal tracked links', text: 'A link per prospect, with their name on the page and their views attributed to them.' },
    { icon: UserRound, title: 'Who watched, and how much', text: 'Every viewer with how far they got, their device and a timeline of what they did.' },
    { icon: Repeat, title: 'Drop-off heatmaps', text: 'See where people rewatched, skipped or stopped, and which chapters they cared about.' },
    { icon: ShieldCheck, title: 'PIN, password and email codes', text: 'Lock confidential pitches and limit them to named people or company domains.' },
    { icon: BellRing, title: 'Slack, HubSpot and webhooks', text: 'Alerts when someone starts, finishes or clicks, sent where your team already works.' },
    { icon: EyeOff, title: 'Private teleprompter', text: 'Read your talking points on screen. They never appear in the recording.' },
    { icon: ScreenShare, title: 'Screen + camera in one take', text: 'A floating camera card next to your product, deck or proposal.' },
    { icon: Scissors, title: 'Edit by text', text: 'Delete words from the transcript to cut the video. Restore anything you removed.' },
    { icon: Sparkles, title: 'AI talking points', text: 'Scripts in seven languages, plus captions that follow your voice.' },
];

const { free, creator, studio } = PLAN_LIMITS;

const limitRows: Array<{ label: string; free: string; creator: string; studio: string }> = [
    { label: 'Videos hosted with tracked links', free: `${free.hostedVideos}`, creator: `${creator.hostedVideos}`, studio: `${studio.hostedVideos}` },
    { label: 'Viewer analytics, protection and alerts', free: 'Included', creator: 'Included', studio: 'Included' },
    { label: 'Limit embeds to your websites', free: '—', creator: 'Included', studio: 'Included' },
    { label: 'Video length', free: `Up to ${exportLabel(free)}`, creator: `Up to ${exportLabel(creator)}`, studio: `Up to ${exportLabel(studio)}` },
    { label: 'Watermark', free: watermarkLabel(free), creator: watermarkLabel(creator), studio: watermarkLabel(studio) },
    { label: 'Transcription per month', free: `${free.transcriptionMinutes} min`, creator: `${creator.transcriptionMinutes} min`, studio: `${studio.transcriptionMinutes} min` },
    { label: 'AI voiceover per month', free: `${free.voiceoverMinutes} min`, creator: `${creator.voiceoverMinutes} min`, studio: `${studio.voiceoverMinutes} min` },
];

const faqs = [
    { q: 'Is the free plan really free?', a: 'Yes. You can record, send tracked links, see full analytics, lock videos and connect Slack or HubSpot without paying. Free hosts fewer videos, keeps them shorter and adds a small Cliprame watermark.' },
    { q: 'What changes when I upgrade?', a: 'You can host more videos, send longer walkthroughs, remove the watermark, limit embeds to your own websites and get more AI minutes. Tracking, analytics, protection and alerts are on every plan.' },
    { q: 'What counts as a hosted video?', a: 'Each video you upload for sharing counts once, however many personal links you make for it. Delete a video to free up a slot.' },
    { q: 'Do my prospects need an account?', a: 'No. They open the link and press play, or unlock it with a PIN, password or email code if you’ve locked it.' },
    { q: 'How does billing work?', a: 'Paid plans are monthly subscriptions, processed securely by Razorpay. You can read the full terms in our refund and cancellation policy.' },
];

export default async function PricingPage() {
    const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const available = {
        creator: razorpayReady && Boolean(process.env.RAZORPAY_PLAN_ID_CREATOR || process.env.RAZORPAY_PLAN_ID),
        studio: razorpayReady && Boolean(process.env.RAZORPAY_PLAN_ID_STUDIO),
    };
    const session = await getMarketingSession();

    return (
        <MarketingShell current="pricing" session={session}>
            <section className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 sm:pt-20">
                <p className={label}>Pricing</p>
                <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
                    <h1 className={`${DISPLAY} text-[2.9rem] font-bold leading-[0.96] tracking-[-0.045em] sm:text-7xl`}>
                        Know who watched, <span className={`${serif} text-[#5B3DF5]`}>on every plan.</span>
                    </h1>
                    <p className="text-[17px] leading-7 text-[#15120F]/62 lg:pb-2">Tracking, analytics, forms, protection and alerts are always included. Upgrade when you send more videos, or longer ones.</p>
                </div>
            </section>

            <div id="plans" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20 sm:px-8">
                <PricingPlans available={available} supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL} />
            </div>

            {/* Compare */}
            <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
                <div className="mb-8 flex items-center gap-4"><span className={label}>Compare plans</span><span className="h-px flex-1 bg-[#15120F]/10" /></div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-[15px]">
                        <caption className="sr-only">Compare Cliprame plans</caption>
                        <thead>
                            <tr className="text-[12px] uppercase tracking-[0.12em] text-[#15120F]/45">
                                <th scope="col" className="pb-4 font-semibold"><span className="sr-only">Feature</span></th>
                                <th scope="col" className="pb-4 font-semibold">Free</th>
                                <th scope="col" className="pb-4 font-semibold">Creator</th>
                                <th scope="col" className="pb-4 font-semibold">Studio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
                            {limitRows.map((row) => (
                                <tr key={row.label}>
                                    <th scope="row" className="py-4 pr-6 font-medium">{row.label}</th>
                                    <td className="py-4 pr-4 text-[#15120F]/65">{row.free}</td>
                                    <td className="py-4 pr-4 text-[#15120F]/65">{row.creator}</td>
                                    <td className="py-4 text-[#15120F]/65">{row.studio}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Included */}
            <section id="included" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-24 sm:px-8">
                <div className="mb-10 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
                    <h2 className={`${DISPLAY} text-4xl font-bold leading-[1.04] tracking-[-0.035em] sm:text-5xl`}>In every plan, <span className={`${serif} text-[#5B3DF5]`}>from day one.</span></h2>
                    <p className="text-[16px] leading-7 text-[#15120F]/62 lg:pt-3">Paid plans change how many videos you host, how long they can be, the watermark and your AI minutes. Everything that tells you who watched is the same on Free.</p>
                </div>
                <dl className="grid gap-x-10 border-t border-[#15120F]/10 sm:grid-cols-2 lg:grid-cols-3">
                    {included.map((item) => (
                        <div key={item.title} className="border-b border-[#15120F]/10 py-6">
                            <dt className="flex items-center gap-2.5 font-semibold"><item.icon className="h-[18px] w-[18px] text-[#5B3DF5]" strokeWidth={1.8} />{item.title}</dt>
                            <dd className="mt-2 text-[15px] leading-7 text-[#15120F]/62">{item.text}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {/* FAQ */}
            <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-24 gap-10 px-5 pb-24 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
                <h2 className={`${DISPLAY} text-4xl font-bold leading-[1.04] tracking-[-0.035em] sm:text-5xl`}>Good to <span className={`${serif} text-[#5B3DF5]`}>know.</span></h2>
                <div className="divide-y divide-[#15120F]/10 border-y border-[#15120F]/10">
                    {faqs.map((faq) => (
                        <details key={faq.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                            <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded ${DISPLAY} text-lg font-bold tracking-tight ${FOCUS}`}>
                                {faq.q}
                                <Plus className="h-5 w-5 shrink-0 text-[#15120F]/40 transition group-open:rotate-45" />
                            </summary>
                            <p className="mt-3 max-w-2xl text-[15.5px] leading-7 text-[#15120F]/62">{faq.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
                <div className="flex flex-col gap-8 rounded-2xl bg-[#15120F] px-7 py-14 text-[#F6F4EF] sm:px-14 lg:flex-row lg:items-end lg:justify-between">
                    <h2 className={`${DISPLAY} max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-5xl`}>Your next follow-up <span className={`${serif} text-[#B6A6FF]`}>starts free.</span></h2>
                    <Link href={session.isLoggedIn ? '/studio' : '/signup'} className={`inline-flex w-fit items-center gap-2 rounded-xl bg-[#F6F4EF] px-5 py-3 text-[15px] font-semibold text-[#15120F] hover:bg-white ${FOCUS}`}>
                        {session.isLoggedIn ? 'Open your studio' : 'Start free'} <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </section>
        </MarketingShell>
    );
}
