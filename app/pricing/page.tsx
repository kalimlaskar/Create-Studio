import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Check, EyeOff, Hand, HelpCircle, Images, Layers, Mic, ScreenShare, Scissors, Sparkles, Type } from 'lucide-react';
import { PricingPlans } from '@/components/pricing/PricingPlans';
import { PLAN_LIMITS, exportLabel, watermarkLabel } from '@/components/pricing/planLimits';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
    title: 'Pricing | Cliprame',
    description: 'Start free with every Cliprame tool. Upgrade for longer exports, no watermark and more AI requests.',
};

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const css = `
html{scroll-behavior:smooth}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
.grain{background-image:radial-gradient(rgba(20,18,31,.04) 1px,transparent 1px);background-size:24px 24px}
details summary::-webkit-details-marker{display:none}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.rise{animation:none;opacity:1}}
`;

const included = [
    { icon: ScreenShare, title: 'Screen + camera in one take', text: 'Share your screen with a floating camera card, in browser, macOS or minimal frames.' },
    { icon: EyeOff, title: 'Private teleprompter', text: 'Read your script on screen. It never appears in the recording.' },
    { icon: Scissors, title: 'Edit by text', text: 'Delete words from the transcript to cut the video. Trim, split and restore anything.' },
    { icon: Hand, title: 'Hand-tracked drawing', text: 'Draw, write and erase with your hand, with rough shapes snapping clean.' },
    { icon: Images, title: 'Photo + video reels', text: 'Product templates, 3D depth photos, sci-fi transitions, music and effects.' },
    { icon: Type, title: 'Captions that follow your voice', text: 'Word-by-word captions in English, Hindi and Hinglish.' },
    { icon: Mic, title: 'AI scripts and voiceover', text: 'Scripts in seven languages and voiceover in English, Hindi, Bengali, Tamil and Telugu.' },
    { icon: Layers, title: 'Backgrounds and looks', text: 'Blur, green screen, cutout, hologram and cartoon looks, with no setup.' },
    { icon: Sparkles, title: 'Your brand on every video', text: 'Add your logo, badges and colors to reels and showcase videos.' },
];

const { free, creator, studio } = PLAN_LIMITS;

const limitRows: Array<{ label: string; free: string; creator: string; studio: string }> = [
    { label: 'All studio tools', free: 'Included', creator: 'Included', studio: 'Included' },
    { label: 'Export length', free: `Up to ${exportLabel(free)}`, creator: `Up to ${exportLabel(creator)}`, studio: `Up to ${exportLabel(studio)}` },
    { label: 'Watermark', free: watermarkLabel(free), creator: watermarkLabel(creator), studio: watermarkLabel(studio) },
    { label: 'Transcription per month', free: `${free.transcriptionMinutes} min`, creator: `${creator.transcriptionMinutes} min`, studio: `${studio.transcriptionMinutes} min` },
    { label: 'AI voiceover per month', free: `${free.voiceoverMinutes} min`, creator: `${creator.voiceoverMinutes} min`, studio: `${studio.voiceoverMinutes} min` },
    { label: 'Drafts', free: 'In your browser', creator: 'In your browser', studio: 'In your browser' },
];

const faqs = [
    { q: 'Is the free plan really free?', a: 'Yes. You can record, edit by text, make reels and use every tool without paying. Free exports are shorter and carry a small Cliprame watermark.' },
    { q: 'What changes when I upgrade?', a: 'Your exports can be longer, the watermark goes away and you get far more AI requests each day. The tools themselves are the same on every plan.' },
    { q: 'How does billing work?', a: 'Paid plans are monthly subscriptions in INR, processed securely by Razorpay. You can read the full terms in our refund and cancellation policy.' },
    { q: 'Where are my videos and drafts stored?', a: 'On your device, in your browser. Audio is only sent for processing when you ask for captions, a transcript or AI features.' },
    { q: 'Do I need to install anything?', a: 'No. Cliprame runs entirely in your browser tab.' },
];

function Wordmark() {
    return (
        <Link href="/" aria-label="Cliprame home" className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full font-semibold tracking-tight text-[#14121F] ${focus}`}>
            <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
            <span className={`${D} text-lg font-bold`}>Cliprame</span>
        </Link>
    );
}

const navLink = `rounded-full px-4 py-2 text-sm font-medium text-[#14121F]/65 transition-colors hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`;
const mobileNavLink = 'shrink-0 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#14121F]/70 backdrop-blur transition-colors hover:text-[#14121F]';

export default function PricingPage() {
    const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const available = {
        creator: razorpayReady && Boolean(process.env.RAZORPAY_PLAN_ID_CREATOR || process.env.RAZORPAY_PLAN_ID),
        studio: razorpayReady && Boolean(process.env.RAZORPAY_PLAN_ID_STUDIO),
    };

    return (
        <main className={`${display.variable} ${body.variable} relative min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="grain pointer-events-none absolute inset-0 -z-10" />

            <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
                    <Wordmark />
                    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
                        <Link href="/" className={navLink}>Home</Link>
                        <a href="#plans" className={navLink}>Plans</a>
                        <a href="#included" className={navLink}>What&apos;s included</a>
                        <a href="#faq" className={navLink}>FAQ</a>
                    </nav>
                    <div className="flex shrink-0 items-center gap-1">
                        <Link href="/login" className={`rounded-full px-3 py-2 text-sm font-medium text-[#14121F]/75 transition-colors hover:text-[#14121F] sm:px-4 ${focus}`}>Log in</Link>
                        <Link href="/login?setup=1" className={`inline-flex items-center gap-1.5 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] sm:px-5 ${focus}`}>
                            Try the studio <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                </div>
                <nav aria-label="Mobile main navigation" className="mx-auto mt-2 flex max-w-5xl gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                    <Link href="/" className={mobileNavLink}>Home</Link>
                    <a href="#plans" className={mobileNavLink}>Plans</a>
                    <a href="#included" className={mobileNavLink}>What&apos;s included</a>
                    <a href="#faq" className={mobileNavLink}>FAQ</a>
                </nav>
            </header>

            {/* Hero */}
            <section className="relative mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-8 sm:pt-16 lg:px-12">
                <div className="absolute -left-20 -top-10 -z-10 h-72 w-72 rounded-full bg-[#6A4CFF]/15 blur-3xl" />
                <div className="absolute -right-20 top-10 -z-10 h-72 w-72 rounded-full bg-[#FF3D81]/10 blur-3xl" />

                <div className="rise" style={{ '--d': 0 } as CSSProperties}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3.5 py-1 text-xs font-semibold text-[#6A4CFF]">
                        <Sparkles className="h-3.5 w-3.5" /> Plans &amp; pricing
                    </span>
                </div>

                <div className="rise mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" style={{ '--d': 1 } as CSSProperties}>
                    <div>
                        <h1 className={`${D} text-4xl font-extrabold tracking-[-0.03em] text-[#14121F] sm:text-5xl`}>Simple pricing. Every tool included.</h1>
                        <p className="mt-3 max-w-xl text-base leading-7 text-[#14121F]/65">Start free. Upgrade when you need longer videos, no watermark and more AI.</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#14121F]/10 bg-white px-3.5 py-2 text-xs font-semibold text-[#14121F]/80 shadow-sm">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Free plan available
                    </span>
                </div>
            </section>

            {/* Plans */}
            <div id="plans" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-12 sm:px-8 lg:px-12">
                <div className="rise" style={{ '--d': 2 } as CSSProperties}>
                    <PricingPlans available={available} supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL} />
                </div>
            </div>

            {/* Compare */}
            <section className="relative mx-auto max-w-5xl px-5 pb-20 sm:px-8 lg:px-12">
                <div className="overflow-hidden rounded-[2rem] border border-[#14121F]/10 bg-white shadow-[0_15px_40px_-15px_rgba(20,18,31,0.06)]">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-left text-sm">
                            <caption className="sr-only">Compare Cliprame plans</caption>
                            <thead>
                                <tr className="border-b border-[#14121F]/10 bg-[#F7F6FB] text-xs font-bold uppercase tracking-wider text-[#14121F]/60">
                                    <th scope="col" className="px-6 py-4">Compare plans</th>
                                    <th scope="col" className="px-4 py-4">Free</th>
                                    <th scope="col" className="px-4 py-4">Creator</th>
                                    <th scope="col" className="px-4 py-4">Studio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#14121F]/10">
                                {limitRows.map((row) => (
                                    <tr key={row.label}>
                                        <th scope="row" className="px-6 py-4 font-semibold text-[#14121F]">{row.label}</th>
                                        <td className="px-4 py-4 text-[#14121F]/70">{row.free}</td>
                                        <td className="px-4 py-4 text-[#14121F]/70">{row.creator}</td>
                                        <td className="px-4 py-4 text-[#14121F]/70">{row.studio}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Included in every plan */}
            <section id="included" className="relative mx-auto max-w-7xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12">
                <div className="mb-10 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3.5 py-1 text-xs font-semibold text-[#6A4CFF]">
                        <Layers className="h-3.5 w-3.5" /> In every plan
                    </span>
                    <h2 className={`${D} mt-3 text-3xl font-bold tracking-tight text-[#14121F] sm:text-4xl`}>The whole studio, from day one.</h2>
                    <p className="mt-2 text-sm leading-6 text-[#14121F]/65">No locked features. Paid plans only change how long you can export, the watermark and your daily AI requests.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {included.map((item) => (
                        <article key={item.title} className="rounded-[2rem] border border-[#14121F]/10 bg-white p-6 shadow-[0_15px_40px_-20px_rgba(20,18,31,0.12)] transition hover:-translate-y-1">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><item.icon className="h-5 w-5" /></span>
                            <h3 className={`${D} mt-5 text-lg font-bold tracking-tight`}>{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-[#14121F]/65">{item.text}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="relative mx-auto max-w-4xl scroll-mt-28 px-5 pb-24 sm:px-8 lg:px-12">
                <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3D81]/10 px-3 py-1 text-xs font-semibold text-[#FF3D81]">
                        <HelpCircle className="h-3.5 w-3.5" /> Common questions
                    </span>
                    <h2 className={`${D} mt-3 text-3xl font-bold tracking-tight sm:text-4xl`}>Good to know.</h2>
                </div>
                <div className="mt-10 space-y-3">
                    {faqs.map((faq) => (
                        <details key={faq.q} className="group rounded-3xl border border-[#14121F]/10 bg-white px-6 py-5 shadow-[0_15px_40px_-25px_rgba(20,18,31,0.15)]">
                            <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-base font-semibold ${focus}`}>
                                {faq.q}
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/10 text-[#6A4CFF] transition-transform group-open:rotate-45">
                                    <Check className="hidden" />+
                                </span>
                            </summary>
                            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#14121F]/65">{faq.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* Closing CTA */}
            <section className="relative mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12">
                <div className="relative overflow-hidden rounded-[2.5rem] border border-[#14121F]/10 bg-[linear-gradient(135deg,#ede9ff,#ffe6f0_55%,#fff6c9)] px-6 py-14 text-center sm:px-12 sm:py-20">
                    <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#6A4CFF]/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-[#FF3D81]/25 blur-3xl" />
                    <div className="relative">
                        <h2 className={`${D} mx-auto max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl`}>Start free. Upgrade when you&apos;re ready.</h2>
                        <Link href="/login?setup=1" className={`group mt-8 inline-flex items-center gap-2 rounded-full bg-[#14121F] px-7 py-4 text-sm font-semibold text-white shadow-[0_14px_34px_-10px_rgba(20,18,31,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2c2742] ${focus}`}>
                            Try the studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="relative border-t border-[#14121F]/10 bg-white/40 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#14121F]/55 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
                    <Wordmark />
                    <p className="font-medium">Record. Edit. Share your story.</p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Link href="/" className="transition hover:text-[#14121F]">Home</Link>
                        <Link href="/terms" className="transition hover:text-[#14121F]">Terms</Link>
                        <Link href="/privacy" className="transition hover:text-[#14121F]">Privacy</Link>
                        <Link href="/refunds" className="transition hover:text-[#14121F]">Refunds</Link>
                        <Link href="/login" className="transition hover:text-[#14121F]">Log in</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}