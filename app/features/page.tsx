import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Sparkles, Mic2, Wand2, Sliders, Share2 } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlanSummary } from '@/lib/plans/server';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const css = `
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
.dots{background-image:radial-gradient(rgba(20,18,31,.1) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%);mask-image:radial-gradient(ellipse at 50% 35%,#000 25%,transparent 70%)}
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

function Eyebrow({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'pink' }) {
    const styles = tone === 'pink' ? 'bg-[#FF3D81]/10 text-[#FF3D81]' : 'bg-[#6A4CFF]/10 text-[#6A4CFF]';
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

const navLink = `rounded-full px-4 py-2 text-sm font-medium text-[#14121F]/65 transition-colors hover:bg-[#14121F]/[0.06] hover:text-[#14121F] ${focus}`;
const mobileNavLink = 'shrink-0 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#14121F]/70 backdrop-blur transition-colors hover:text-[#14121F]';
const card = 'rounded-[2rem] border border-[#14121F]/10 bg-white shadow-[0_1px_0_rgba(20,18,31,0.04),0_24px_48px_-28px_rgba(20,18,31,0.28)]';
const gradientText = 'bg-gradient-to-r from-[#6A4CFF] via-[#9a4cff] to-[#FF3D81] bg-clip-text text-transparent';

const featuresList = [
    {
        icon: Mic2,
        title: 'Smart Teleprompter & Camera Studio',
        text: 'Record directly in your browser with a floating teleprompter that scrolls at your natural reading speed while matching your camera framing, completely hidden from viewers.',
        badge: 'Recording',
        accent: 'bg-[#6A4CFF]/10 text-[#6A4CFF]',
    },
    {
        icon: Wand2,
        title: 'AI Script Assistant',
        text: 'Generate engaging hooks, educational modules, or punchy social video scripts in seconds across multiple languages.',
        badge: 'AI Powered',
        accent: 'bg-[#FF3D81]/10 text-[#FF3D81]',
    },
    {
        icon: Sliders,
        title: 'Photo & Video Reels Studio',
        text: 'Mix high-resolution images, video clips, and background music tracks to output polished vertical reels instantly with depth and transitions.',
        badge: 'Reels',
        accent: 'bg-[#6A4CFF]/10 text-[#6A4CFF]',
    },
    {
        icon: Share2,
        title: 'Zero Installs & Instant Export',
        text: 'Everything runs client-side inside your browser with optimized encoding. Export directly in 9:16 or 16:9 ready for social platforms.',
        badge: 'Export',
        accent: 'bg-[#FF3D81]/10 text-[#FF3D81]',
    },
];

export default async function FeaturesPage() {
    let userPlan = '';
    let isLoggedIn = false;
    let displayName = 'User';

    try {
        const supabase = await createSupabaseServerClient();
        if (supabase) {
            const { data: authData } = await supabase.auth.getClaims();
            if (authData?.claims?.sub) {
                isLoggedIn = true;
                const userId = authData.claims.sub;

                const [profileRes, plan] = await Promise.all([
                    supabase.from('profiles').select('display_name,username').eq('id', userId).maybeSingle(),
                    // Plan comes only from the subscription record on the server.
                    getPlanSummary(userId).catch(() => null),
                ]);

                if (profileRes.data?.display_name) {
                    displayName = profileRes.data.display_name;
                } else if (authData.claims.email) {
                    displayName = String(authData.claims.email).split('@')[0];
                }

                if (plan?.isPaid) {
                    userPlan = plan.name;
                }
            }
        }
    } catch (err) {
        console.error('Failed to resolve session on features page:', err);
    }

    const initialLetter = displayName.charAt(0).toUpperCase();

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            {/* Floating glass nav */}
            <header className="sticky top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 rounded-full border border-white/70 bg-white/70 pl-4 pr-2 shadow-[0_10px_30px_-10px_rgba(20,18,31,0.18)] backdrop-blur-xl sm:h-16 sm:pl-5">
                    <Wordmark />
                    <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
                        <Link href="/" className={navLink}>Home</Link>
                        <Link href="/demo" className={navLink}>Demos</Link>
                        <span aria-current="page" className="rounded-full bg-[#14121F]/[0.08] px-4 py-2 text-sm font-semibold text-[#14121F]">Features</span>
                        <Link href="/pricing" className={navLink}>Pricing</Link>
                    </nav>

                    <div className="flex shrink-0 items-center gap-2">
                        {isLoggedIn ? (
                            <>
                                {userPlan ? (
                                    <span className="rounded-full bg-[#6A4CFF]/10 px-4 py-1.5 text-xs font-bold text-[#6A4CFF]">
                                        {userPlan}
                                    </span>
                                ) : (
                                    <Link href="/pricing" className="inline-flex items-center gap-1 rounded-full border border-[#14121F]/10 bg-[#F7F6FB] px-3 py-1.5 text-xs font-semibold text-[#14121F]/70 transition hover:bg-[#14121F]/10">
                                        Free Tier · Upgrade
                                    </Link>
                                )}

                                <Link
                                    href="/studio"
                                    className={`inline-flex items-center gap-2 rounded-full border border-[#14121F]/10 bg-white py-1.5 pl-2 pr-4 text-sm font-semibold text-[#14121F] shadow-sm transition hover:border-[#6A4CFF]/40 hover:shadow-md ${focus}`}
                                >
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#6A4CFF] text-xs font-bold text-white shadow-xs">
                                        {initialLetter}
                                    </span>
                                    <span className="max-w-[100px] truncate">{displayName}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-[#14121F]/40" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className={`rounded-full px-3 py-2 text-sm font-medium text-[#14121F]/75 transition-colors hover:text-[#14121F] sm:px-4 ${focus}`}>Log in</Link>
                                <Link href="/login?setup=1" className={`inline-flex items-center gap-1.5 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] sm:px-5 ${focus}`}>
                                    Try the studio <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
                <nav aria-label="Mobile main navigation" className="mx-auto mt-2 flex max-w-5xl gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                    <Link href="/" className={mobileNavLink}>Home</Link>
                    <Link href="/demo" className={mobileNavLink}>Demos</Link>
                    <span className="shrink-0 rounded-full bg-[#14121F] px-3.5 py-1.5 text-xs font-medium text-white">Features</span>
                    <Link href="/pricing" className={mobileNavLink}>Pricing</Link>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="relative mx-auto max-w-5xl px-5 pb-16 pt-16 text-center sm:px-8">
                <div className="dots pointer-events-none absolute inset-x-0 top-0 -z-0 h-[400px]" aria-hidden="true" />
                <div className="rise" style={{ '--d': 0 } as CSSProperties}>
                    <Eyebrow><Sparkles className="h-3.5 w-3.5" /> Built for modern creators</Eyebrow>
                </div>
                <h1 className="rise mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl" style={{ '--d': 1 } as CSSProperties}>
                    Powerful Features for <span className={gradientText}>Creators &amp; Teams</span>
                </h1>
                <p className="rise mx-auto mt-4 max-w-2xl text-base text-[#14121F]/65 sm:text-lg" style={{ '--d': 2 } as CSSProperties}>
                    Explore the complete browser studio toolkit designed to make recording, editing, and sharing professional videos effortless.
                </p>
            </section>

            {/* Features Grid */}
            <section className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
                <div className="grid gap-8 md:grid-cols-2">
                    {featuresList.map((f, i) => (
                        <div key={f.title} className={`${card} rise p-8 sm:p-10`} style={{ '--d': i + 3 } as CSSProperties}>
                            <div className="flex items-center justify-between mb-6">
                                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${f.accent}`}>
                                    <f.icon className="h-7 w-7" />
                                </span>
                                <span className="rounded-full bg-[#14121F]/5 px-3 py-1 text-xs font-semibold text-[#14121F]/70">
                                    {f.badge}
                                </span>
                            </div>
                            <h3 className={`${D} text-2xl font-bold tracking-tight text-[#14121F]`}>{f.title}</h3>
                            <p className="mt-3 text-base leading-7 text-[#14121F]/65">{f.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="relative border-t border-[#14121F]/10">
                <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-[#14121F]/55 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
                    <Wordmark />
                    <p>Record. Edit. Share your story.</p>
                    <div className="flex items-center gap-5">
                        <Link href="/pricing" className="transition hover:text-[#14121F]">Pricing</Link>
                        {!isLoggedIn ? (
                            <Link href="/login" className="transition hover:text-[#14121F]">Log in</Link>
                        ) : null}
                        <Link href="/studio" className="transition hover:text-[#14121F]">Go to Studio</Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}