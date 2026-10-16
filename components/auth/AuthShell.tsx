import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowLeft, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

/* ---------- Palette (same as the home page) ----------
   ink     #14121F   text, dark surfaces
   paper   #F7F6FB   page background
   violet  #6A4CFF   primary accent
   pink    #FF3D81   secondary accent / REC
   yellow  #FFE347   highlight (captions, selections)
*/

const D = 'font-[family-name:var(--font-display)]';
const focusDark =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const prompterLines = [
    'Hi everyone, welcome to the demo',
    'This is where your team sees',
    'every campaign in one place',
    'Let me show you how it works',
];
const chips = ['Product demos', 'Tutorials', 'Course lessons', 'Travel reels', 'Explainers'];

const copy = {
    login: { line1: 'Record the demo.', line2: 'Edit it like a doc.', secure: 'Secure sign in' },
    signup: { line1: 'Start creating reels', line2: 'in seconds.', secure: 'Secure sign up' },
} as const;

const css = `
@keyframes prompter{to{transform:translateY(-50%)}}
.prompter{animation:prompter 16s linear infinite}
.prompter-mask{-webkit-mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent);mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent)}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.rise{opacity:0;animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--d,0)*90ms)}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.floaty{animation:floaty 6s ease-in-out infinite;animation-delay:calc(var(--i,0)*-1.5s)}
@keyframes draw{0%{stroke-dashoffset:1}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:1}}
.draw{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 6s ease-in-out infinite;animation-delay:calc(var(--i,0)*.5s)}
@keyframes pulseSel{0%,100%{background:rgba(106,76,255,.18)}50%{background:rgba(106,76,255,.32)}}
.sel{animation:pulseSel 2.4s ease-in-out infinite}
.dots{background-image:radial-gradient(rgba(20,18,31,.1) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 25%,transparent 75%);mask-image:radial-gradient(ellipse at 50% 40%,#000 25%,transparent 75%)}
.auth-light{filter:invert(1) hue-rotate(180deg)}
.auth-light button[type="submit"]{filter:invert(1) hue-rotate(180deg)}
@media (prefers-reduced-motion:reduce){.prompter,.floaty,.sel{animation:none}.draw{animation:none;stroke-dashoffset:0}.rise{animation:none;opacity:1}}
`;

const gradientText = 'bg-gradient-to-r from-[#6A4CFF] via-[#9a4cff] to-[#FF3D81] bg-clip-text text-transparent';

function Wordmark() {
    return (
        <Link href="/" aria-label="Cliprame home" className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full font-semibold tracking-tight text-[#14121F] ${focusDark}`}>
            <Image src="/cliprame-icon.svg" alt="" width={36} height={36} className="h-9 w-9 transition-transform duration-200 group-hover:scale-105" />
            <span className={`${D} text-lg font-bold`}>Cliprame</span>
        </Link>
    );
}

type AuthShellProps = {
    mode: 'login' | 'signup';
    /** id used by the skip link and the form wrapper */
    anchorId: string;
    skipLabel: string;
    /** screen-reader h1 */
    title: string;
    children: ReactNode;
};

export function AuthShell({ mode, anchorId, skipLabel, title, children }: AuthShellProps) {
    const t = copy[mode];

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh overflow-x-clip bg-white lg:h-dvh lg:overflow-hidden font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <a
                href={`#${anchorId}`}
                className="sr-only z-[60] rounded-full bg-[#14121F] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
            >
                {skipLabel}
            </a>

            <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1.15fr_minmax(440px,.85fr)]">
                {/* ================= Left: form ================= */}
                <div className="flex min-h-dvh flex-col px-6 py-6 sm:px-12 lg:order-2 lg:h-dvh lg:overflow-y-auto lg:px-14 xl:px-20">
                    <header className="flex items-center justify-between">
                        <Wordmark />
                        <Link
                            href="/"
                            className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#14121F]/65 transition hover:text-[#14121F] ${focusDark}`}
                        >
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back home
                        </Link>
                    </header>

                    <div className="flex flex-1 items-center py-10">
                        <div id={anchorId} className="mx-auto w-full max-w-[400px] scroll-mt-8">
                            <h1 className="sr-only">{title}</h1>
                            {/* AuthForm (variant="embedded") is built for a dark surface; .auth-light flips its colours for this white side. */}
                            <div className="rise" style={{ '--d': 1 } as CSSProperties}>
                                <div className="auth-light">{children}</div>
                            </div>
                        </div>
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#14121F]/55">
                        <p className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" /> {t.secure} · Drafts stay in your browser
                        </p>
                        <span className="flex items-center gap-4">
                            <Link href="/pricing" className="transition hover:text-[#14121F]">Pricing</Link>
                            <Link href="/privacy" className="transition hover:text-[#14121F]">Privacy</Link>
                            <Link href="/terms" className="transition hover:text-[#14121F]">Terms</Link>
                        </span>
                    </footer>
                </div>

                {/* ================= Right: brand visual (desktop) ================= */}
                <aside aria-hidden="true" className="relative hidden overflow-hidden bg-[#F7F6FB] text-[#14121F] lg:order-1 lg:flex lg:h-dvh lg:border-r lg:border-[#14121F]/10 lg:items-center lg:justify-center lg:p-10 xl:p-12">
                    <div className="dots pointer-events-none absolute inset-0" />
                    <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#6A4CFF]/20 blur-3xl" />
                    <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-[#FF3D81]/15 blur-3xl" />

                    <div className="relative w-full max-w-[560px]">
                        <span className="rise inline-flex items-center gap-1.5 rounded-full bg-[#6A4CFF]/10 px-3 py-1 text-xs font-semibold text-[#6A4CFF]" style={{ '--d': 0 } as CSSProperties}>
                            <Sparkles className="h-3.5 w-3.5" /> New: edit your video by deleting words
                        </span>
                        <p className={`rise mt-4 ${D} font-extrabold leading-[0.98] tracking-[-0.04em]`} style={{ '--d': 1, fontSize: 'clamp(2.2rem, 6.2vh, 3.6rem)' } as CSSProperties}>
                            {t.line1}
                            <br />
                            <span className={gradientText}>{t.line2}</span>
                        </p>

                        {/* Product moment */}
                        <div className="rise relative mt-6 pb-10" style={{ '--d': 3, width: 'max(320px, min(100%, calc((100dvh - 24rem) * 1.6)))' } as CSSProperties}>
                            <div className="relative rounded-[1.6rem] border border-[#14121F]/10 bg-white p-2 shadow-[0_40px_80px_-30px_rgba(20,18,31,0.4)]">
                                <div className="flex items-center gap-2 px-3 py-2.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                                    <span className="mx-auto rounded-full bg-[#14121F]/[0.05] px-4 py-1 text-[10px] font-medium text-[#14121F]/50">yourproduct.com/dashboard</span>
                                </div>
                                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#F7F6FB]">
                                    <div className="absolute inset-y-0 left-0 w-[15%] space-y-2 border-r border-[#14121F]/5 bg-white p-2.5">
                                        <span className="block h-2 w-3/4 rounded bg-[#6A4CFF]" />
                                        <span className="block h-2 w-full rounded bg-[#14121F]/10" />
                                        <span className="block h-2 w-2/3 rounded bg-[#14121F]/10" />
                                        <span className="block h-2 w-5/6 rounded bg-[#14121F]/10" />
                                    </div>
                                    <div className="absolute inset-y-0 left-[15%] right-0 p-[3%]">
                                        <div className="flex h-[22%] gap-2">
                                            {['#6A4CFF', '#FF3D81', '#14121F'].map((c) => (
                                                <div key={c} className="flex-1 rounded-xl border border-[#14121F]/5 bg-white p-2">
                                                    <span className="block h-1.5 w-1/2 rounded bg-[#14121F]/15" />
                                                    <span className="mt-2 block h-3 w-3/4 rounded" style={{ background: c }} />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-[4%] flex h-[56%] items-end gap-[3%] rounded-xl border border-[#14121F]/5 bg-white p-[3%]">
                                            {[40, 65, 50, 80, 62, 90, 74, 98].map((h, i) => (
                                                <span key={i} className="flex-1 rounded-t-md bg-[linear-gradient(180deg,#6A4CFF,#a995ff)]" style={{ height: `${h}%` }} />
                                            ))}
                                        </div>
                                    </div>
                                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#14121F]/80 px-2.5 py-1 text-[10px] font-semibold text-white">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3D81]" />REC 02:14
                                    </span>
                                    <svg viewBox="0 0 400 250" className="pointer-events-none absolute inset-0 h-full w-full" fill="none">
                                        <ellipse className="draw" pathLength={1} cx="230" cy="40" rx="64" ry="33" stroke="#FF3D81" strokeWidth="4" strokeLinecap="round" />
                                        <path className="draw" pathLength={1} style={{ '--i': 1 } as CSSProperties} d="M318 118 C 296 108, 280 92, 268 76 M268 76 L 281 80 M268 76 L 270 90" stroke="#FF3D81" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>

                            <div className="floaty absolute -bottom-2 -right-4 w-[30%]" style={{ '--i': 1 } as CSSProperties}>
                                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#ffb86b,#ff6a8b_55%,#6A4CFF)] shadow-[0_20px_40px_-12px_rgba(20,18,31,0.45)] ring-4 ring-white">
                                    <span className="absolute left-1/2 top-[20%] h-[36%] w-[27%] -translate-x-1/2 rounded-full bg-[#FFE9A8]" />
                                    <span className="absolute -bottom-[20%] left-1/2 h-[54%] w-[74%] -translate-x-1/2 rounded-[50%] bg-[#2a1a5e]" />
                                    <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white">YOU</span>
                                </div>
                            </div>

                            <div className="floaty absolute -left-6 top-16 w-48" style={{ '--i': 0 } as CSSProperties}>
                                <div className="rounded-2xl bg-[#14121F]/90 p-3 text-white shadow-[0_24px_48px_-14px_rgba(20,18,31,0.5)] backdrop-blur-xl">
                                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-white/60">
                                        <span>Teleprompter</span>
                                        <span className="inline-flex items-center gap-1 text-[#FFE347]"><EyeOff className="h-2.5 w-2.5" />Only you</span>
                                    </div>
                                    <div className="prompter-mask h-[72px] overflow-hidden">
                                        <div className="prompter text-[12px] font-medium leading-4">
                                            {[...prompterLines, ...prompterLines].map((line, i) => (
                                                <p key={i} className="pb-1">{line}</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="floaty absolute -bottom-5 left-6" style={{ '--i': 2 } as CSSProperties}>
                                <div className="rounded-2xl border border-[#14121F]/10 bg-white px-3.5 py-3 text-[12px] font-medium shadow-[0_20px_40px_-14px_rgba(20,18,31,0.3)]">
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#14121F]/50">Transcript</p>
                                    <p>
                                        So <span className="rounded bg-red-50 px-1 text-red-500 line-through">um</span>{' '}
                                        <span className="sel rounded px-1">this is</span> the dashboard
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ul className="mt-3 flex flex-wrap gap-2 [@media(max-height:760px)]:hidden">
                            {chips.map((c) => (
                                <li key={c} className="flex items-center gap-2 rounded-full border border-[#14121F]/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#14121F]/75">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#6A4CFF]" />{c}
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>
        </main>
    );
}