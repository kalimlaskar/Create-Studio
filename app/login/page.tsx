import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { AuthForm } from '@/components/auth/AuthForm';
import { getTemporaryAuthUsername, isDemoAuthEnabled } from '@/lib/auth/demo';
import { ArrowLeft, Captions, Languages, MonitorSmartphone, ShieldCheck } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata = { title: 'Sign in | Cliprame Studio' };

type LoginPageProps = { searchParams: Promise<{ next?: string; notice?: string; error?: string }> };

/* ---------- Palette (same as landing page) ----------
   ink     #14121F   text, dark surfaces
   paper   #F7F6FB   page background
   violet  #6A4CFF   primary accent
   pink    #FF3D81   secondary accent / REC
   yellow  #FFE347   caption highlight (captions only)
*/

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const captionWords = ['Aaj', 'chalo', 'Hyderabad', 'ghoomte', 'hain'];

const perks = [
    { icon: Languages, text: 'AI scripts in 7 languages' },
    { icon: Captions, text: 'Word-by-word captions' },
    { icon: MonitorSmartphone, text: 'No install, runs in your browser' },
];

const css = `
.cap{display:inline-block;padding:.02em .22em;border-radius:.3em;animation:capHit 4.5s infinite;animation-delay:calc(var(--i)*.9s)}
@keyframes capHit{0%,18%{background:#FFE347;color:#14121F;transform:translateY(-2px) scale(1.06)}24%,100%{background:rgba(255,227,71,0);color:#fff;transform:none}}
@keyframes bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.bar{transform-origin:center;animation:bar 1s ease-in-out infinite;animation-delay:calc(var(--i)*.12s)}
@keyframes float{0%,100%{transform:translateY(0) rotate(2.5deg)}50%{transform:translateY(-10px) rotate(2.5deg)}}
.float{animation:float 7s ease-in-out infinite}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
.grain{background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:22px 22px}
@media (prefers-reduced-motion:reduce){.cap,.bar,.float{animation:none}.rise{animation:none;opacity:1}}
`;

function Wordmark({ dark = false }: { dark?: boolean }) {
    return (
        <Link
            href="/"
            aria-label="Cliprame home"
            className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full font-semibold tracking-tight ${dark ? 'text-white' : 'text-[#14121F]'} ${focus}`}
        >
            <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
            <span className={`${D} text-lg font-bold`}>Cliprame</span>
        </Link>
    );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = await searchParams;
    const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/studio';
    const supabaseConfigured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );

    return (
        <main
            className={`${display.variable} ${body.variable} relative min-h-dvh overflow-x-clip bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}
        >
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <a
                href="#signin"
                className="sr-only z-[60] rounded-full bg-[#14121F] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
            >
                Skip to sign in
            </a>

            <div className="mx-auto grid min-h-dvh max-w-[1500px] gap-0 p-3 sm:p-4 lg:h-dvh lg:grid-cols-[1.05fr_.95fr] lg:gap-4">
                {/* ============ Brand / product panel (desktop) ============ */}
                <aside
                    aria-hidden="true"
                    className="relative hidden overflow-hidden rounded-[2.5rem] bg-[#14121F] text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12"
                >
                    <div className="grain pointer-events-none absolute inset-0" />
                    <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#6A4CFF]/45 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-[#FF3D81]/35 blur-3xl" />

                    <div className="relative">
                        <Wordmark dark />
                    </div>

                    <div className="relative grid items-center gap-6 xl:grid-cols-[1fr_auto]">
                        <div className="max-w-md">
                            <h2
                                className={`rise ${D} text-5xl font-extrabold leading-[0.98] tracking-[-0.035em] xl:text-6xl`}
                                style={{ '--d': 1 } as CSSProperties}
                            >
                                Your next reel is one login away.
                            </h2>
                            <ul className="rise mt-8 space-y-3" style={{ '--d': 3 } as CSSProperties}>
                                {perks.map(({ icon: Icon, text }) => (
                                    <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                                            <Icon className="h-4 w-4 text-[#FFE347]" />
                                        </span>
                                        {text}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Phone with live captions */}
                        <div className="rise relative mx-auto" style={{ '--d': 4 } as CSSProperties}>
                            <div className="float relative w-[230px] rounded-[2.4rem] bg-black/60 p-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15 xl:w-[250px]">
                                <div className="relative aspect-[9/18.5] overflow-hidden rounded-[1.95rem] bg-[linear-gradient(180deg,#ffb86b_0%,#ff6a8b_46%,#5b3df5_100%)]">
                                    <div className="absolute left-1/2 top-[28%] h-20 w-20 -translate-x-1/2 rounded-full bg-[#FFE9A8]" />
                                    <div className="absolute -bottom-10 -left-10 h-44 w-64 rounded-[50%] bg-[#2a1a5e]" />
                                    <div className="absolute -bottom-14 -right-12 h-48 w-64 rounded-[50%] bg-[#1b1040]" />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(transparent,rgba(20,18,31,0.55))]" />
                                    <div className="absolute inset-x-3 top-9 flex items-center justify-between text-[10px] font-semibold text-white">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 backdrop-blur">
                                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D81]" />
                                            REC 00:24
                                        </span>
                                        <span className="rounded-full bg-black/35 px-2 py-1 backdrop-blur">9:16</span>
                                    </div>
                                    <div className="absolute inset-x-3 bottom-9 text-center">
                                        <p className={`${D} text-[1.4rem] font-extrabold leading-snug text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]`}>
                                            {captionWords.map((w, i) => (
                                                <span key={w}>
                                                    <span className="cap" style={{ '--i': i } as CSSProperties}>{w}</span>{' '}
                                                </span>
                                            ))}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute left-1/2 top-[16px] h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
                            </div>

                            <div className="absolute -left-16 top-[42%] flex items-center gap-3 rounded-2xl border border-white/20 bg-white/90 px-3.5 py-2.5 text-[#14121F] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                                <span className="flex h-7 items-center gap-[3px]">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <span key={i} className="bar block h-5 w-1 rounded-full bg-[#6A4CFF]" style={{ '--i': i } as CSSProperties} />
                                    ))}
                                </span>
                                <span>
                                    <span className="block text-xs font-semibold">Captions ready</span>
                                    <span className="block text-[11px] text-[#14121F]/55">Hinglish, in sync</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="relative flex items-center gap-2 text-sm text-white/55">
                        <ShieldCheck className="h-4 w-4" /> Drafts stay on your device. Free to start.
                    </p>
                </aside>

                {/* ============ Form panel ============ */}
                <section className="relative flex min-h-0 flex-col px-2 pb-2 pt-1 sm:px-6 lg:px-10">
                    <div className="pointer-events-none absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full bg-[#6A4CFF]/15 blur-3xl" />
                    <div className="pointer-events-none absolute -left-16 bottom-10 -z-10 h-72 w-72 rounded-full bg-[#FFE347]/25 blur-3xl" />

                    <header className="flex justify-end py-2">
                        <Link
                            href="/"
                            className={`group inline-flex items-center gap-1.5 rounded-full border border-[#14121F]/10 bg-white/70 px-4 py-2 text-xs font-semibold text-[#14121F]/75 backdrop-blur transition hover:border-[#6A4CFF]/30 hover:bg-white hover:text-[#14121F] ${focus}`}
                        >
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back home
                        </Link>
                    </header>

                    <div id="signin" className="mx-auto my-auto w-full max-w-[420px] scroll-mt-8 py-2">
                        <h1 className="sr-only">Sign in to Cliprame Studio</h1>

                        {/* AuthForm (variant="embedded") renders its own heading and fields, styled for this dark card. */}
                        <div className="rise relative" style={{ '--d': 1 } as CSSProperties}>
                            <div className="pointer-events-none absolute -inset-3 rounded-[2.8rem] bg-gradient-to-br from-[#6A4CFF]/45 via-[#FF3D81]/25 to-[#FFE347]/30 blur-2xl" />
                            <div className="relative overflow-y-auto rounded-[2rem] bg-[#14121F] p-6 text-white shadow-[0_30px_70px_-25px_rgba(20,18,31,0.55)] ring-1 ring-white/10 sm:p-7 [scrollbar-width:none] lg:max-h-[calc(100dvh-9rem)] [&::-webkit-scrollbar]:hidden">
                                <AuthForm
                                    mode="login"
                                    variant="embedded"
                                    next={next}
                                    setup={!supabaseConfigured}
                                    demoMode={isDemoAuthEnabled()}
                                    demoUsername={getTemporaryAuthUsername()}
                                    supabaseConfigured={supabaseConfigured}
                                    error={params.error}
                                    notice={params.notice}
                                />
                            </div>
                        </div>

                        <p className="rise mt-5 flex items-center justify-center gap-2 text-center text-xs text-[#14121F]/55 [@media(max-height:760px)]:hidden" style={{ '--d': 3 } as CSSProperties}>
                            <ShieldCheck className="h-3.5 w-3.5 text-[#6A4CFF]" /> Secure sign in. Free to start.
                        </p>
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#14121F]/10 pt-3 text-xs text-[#14121F]/55 [@media(max-height:680px)]:hidden">
                        <p className="font-medium">Record. Edit. Share your story.</p>
                        <div className="flex items-center gap-5">
                            <Link href="/pricing" className="transition hover:text-[#14121F]">Pricing</Link>
                            <Link href="/" className="transition hover:text-[#14121F]">Home</Link>
                        </div>
                    </footer>
                </section>
            </div>
        </main>
    );
}