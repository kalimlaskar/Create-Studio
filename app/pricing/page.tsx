import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Sparkles, HelpCircle } from 'lucide-react';
import { PricingPlans } from '@/components/pricing/PricingPlans';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
    title: 'Pricing | Cliprame',
    description: 'See what Cliprame includes today and what is still in development. No paid subscription is currently available.',
};

/* ---------- Palette matching landing/login pages ----------
   ink     #14121F   text, dark surfaces
   paper   #F7F6FB   page background
   violet  #6A4CFF   primary accent
   pink    #FF3D81   secondary accent / REC
   yellow  #FFE347   caption highlight
*/

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const css = `
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
.grain{background-image:radial-gradient(rgba(20,18,31,.04) 1px,transparent 1px);background-size:24px 24px}
@media (prefers-reduced-motion:reduce){.rise{animation:none;opacity:1}}
`;

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
    const billingEnabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_PLAN_ID && process.env.SUPABASE_SERVICE_ROLE_KEY);

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <div className="grain pointer-events-none absolute inset-0 -z-10" />

            {/* Floating glass nav identical to the landing page */}
            <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
                    <Wordmark />
                    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
                        <Link href="/" className={navLink}>Home</Link>
                        <a href="#plans" className={navLink}>Plans</a>
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
                    <a href="#faq" className={mobileNavLink}>FAQ</a>
                </nav>
            </header>

            {/* Header section perfectly aligned to max-w-7xl matching the pricing component grid */}
            <section className="relative mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-8 sm:pt-16 lg:px-12">
                <div className="absolute -left-20 -top-10 -z-10 h-72 w-72 rounded-full bg-[#6A4CFF]/15 blur-3xl" />
                <div className="absolute -right-20 top-10 -z-10 h-72 w-72 rounded-full bg-[#FF3D81]/10 blur-3xl" />

                <div className="rise" style={{ '--d': 0 } as CSSProperties}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3.5 py-1 text-xs font-semibold text-[#6A4CFF]">
                        <Sparkles className="h-3.5 w-3.5" /> Workspace / Plan Access
                    </span>
                </div>

                <div className="rise mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" style={{ '--d': 1 } as CSSProperties}>
                    <div>
                        <h1 className={`${D} text-4xl font-extrabold tracking-[-0.03em] text-[#14121F] sm:text-5xl`}>
                            Plans &amp; access
                        </h1>
                        <p className="mt-3 max-w-xl text-base leading-7 text-[#14121F]/65">
                            Start with the free preview. Paid subscription plans are currently in development.
                        </p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#14121F]/10 bg-white px-3.5 py-2 text-xs font-semibold text-[#14121F]/80 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-[#6A4CFF] animate-pulse" /> Preview available
                    </span>
                </div>
            </section>

            {/* Pricing cards component with ID for scrolling */}
            <div id="plans" className="scroll-mt-28">
                <section className="relative mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
                    <div className="rise" style={{ '--d': 2 } as CSSProperties}>
                        <PricingPlans billingEnabled={billingEnabled} />
                    </div>
                </section>
            </div>

            {/* Additional FAQ / Details Section for Scrolling, matched with container padding & max-w-7xl */}
            <section id="faq" className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12 scroll-mt-28">
                <div className="rounded-[2.5rem] border border-[#14121F]/10 bg-white p-8 shadow-[0_20px_50px_-15px_rgba(20,18,31,0.06)] sm:p-12">
                    <div className="max-w-xl">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3D81]/10 px-3 py-1 text-xs font-semibold text-[#FF3D81]">
                            <HelpCircle className="h-3.5 w-3.5" /> Common Questions
                        </span>
                        <h2 className={`${D} mt-3 text-3xl font-bold tracking-tight text-[#14121F]`}>
                            Everything you need to know about early access.
                        </h2>
                    </div>

                    <div className="mt-10 grid gap-8 sm:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className={`${D} text-lg font-bold text-[#14121F]`}>Is the preview completely free?</h3>
                            <p className="text-sm leading-relaxed text-[#14121F]/65">
                                Yes! You can record, test AI scriptwriting, and export reels using your browser during early access without paying anything.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className={`${D} text-lg font-bold text-[#14121F]`}>Where are my drafts saved?</h3>
                            <p className="text-sm leading-relaxed text-[#14121F]/65">
                                All draft videos and clips remain locally on your device for maximum privacy and fast performance until cloud project sync launches.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className={`${D} text-lg font-bold text-[#14121F]`}>When will paid plans become active?</h3>
                            <p className="text-sm leading-relaxed text-[#14121F]/65">
                                Paid tiers like Creator and Studio are currently in planning. We are testing provider costs and infrastructure before charging subscriptions.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h3 className={`${D} text-lg font-bold text-[#14121F]`}>Do I need to install software?</h3>
                            <p className="text-sm leading-relaxed text-[#14121F]/65">
                                No installation required. Cliprame runs entirely inside your browser tab with teleprompter and real-time caption sync.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer matching landing page */}
            <footer className="relative border-t border-[#14121F]/10 bg-white/40 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#14121F]/55 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
                    <Wordmark />
                    <p className="font-medium">Early access · No paid plans are live.</p>
                    <div className="flex items-center gap-5">
                        <Link href="/" className="transition hover:text-[#14121F]">Home</Link>
                        <a href="#plans" className="transition hover:text-[#14121F]">Plans</a>
                        <a href="#faq" className="transition hover:text-[#14121F]">FAQ</a>
                        <Link href="/login" className="transition hover:text-[#14121F]">Log in</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}