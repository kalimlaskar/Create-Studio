import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { fontVariables } from '@/components/marketing/MarketingShell';
import { Wordmark } from '@/components/marketing/SiteHeader';
import { Heatmap, Note, SlackPanel } from '@/components/marketing/Scenes';
import { D, focus, label, serif } from '@/components/marketing/theme';

// The frame around the sign-in and sign-up forms, in the marketing site's style.
// The form itself (AuthForm) is unchanged.

const copy = {
    login: { kicker: 'Welcome back', line1: 'Let’s see', line2: 'who watched.', secure: 'Secure sign in' },
    signup: { kicker: 'Free to start', line1: 'Send a video.', line2: 'Know who watched.', secure: 'Secure sign up' },
} as const;

/* AuthForm (variant="embedded") is built for a dark surface; .auth-light flips it for this light side. */
const css = `
.auth-light{filter:invert(1) hue-rotate(180deg)}
.auth-light button[type="submit"]{filter:invert(1) hue-rotate(180deg)}
`;

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
        <main className={`${fontVariables} min-h-dvh overflow-x-clip bg-white font-[family-name:var(--font-body)] text-[#15120F] antialiased selection:bg-[#5B3DF5]/20 lg:h-dvh lg:overflow-hidden`}>
            <style dangerouslySetInnerHTML={{ __html: css }} />

            <a href={`#${anchorId}`} className="sr-only z-[60] rounded-lg bg-[#15120F] px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
                {skipLabel}
            </a>

            <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1.1fr_minmax(440px,.9fr)]">
                {/* Form */}
                <div className="flex min-h-dvh flex-col px-6 py-6 sm:px-12 lg:order-2 lg:h-dvh lg:overflow-y-auto lg:px-14 xl:px-20">
                    <header className="flex items-center justify-between">
                        <Wordmark />
                        <Link href="/" className={`group inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-[#15120F]/60 transition hover:text-[#15120F] ${focus}`}>
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back home
                        </Link>
                    </header>

                    <div className="flex flex-1 items-center py-10">
                        <div id={anchorId} className="mx-auto w-full max-w-[400px] scroll-mt-8">
                            <h1 className="sr-only">{title}</h1>
                            <div className="mk-rise" style={{ '--d': 1 } as CSSProperties}>
                                <div className="auth-light">{children}</div>
                            </div>
                        </div>
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#15120F]/[0.07] pt-5 text-xs text-[#15120F]/50">
                        <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t.secure}</p>
                        <span className="flex items-center gap-4">
                            <Link href="/pricing" className="transition hover:text-[#15120F]">Pricing</Link>
                            <Link href="/privacy" className="transition hover:text-[#15120F]">Privacy</Link>
                            <Link href="/terms" className="transition hover:text-[#15120F]">Terms</Link>
                        </span>
                    </footer>
                </div>

                {/* Story (desktop) */}
                <aside aria-hidden="true" className="mk-paper relative hidden overflow-hidden border-r border-[#15120F]/10 lg:order-1 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-12 xl:p-16">
                    <div>
                        <p className={label}>{t.kicker}</p>
                        <p className={`mk-rise mt-5 ${D} font-bold leading-[0.95] tracking-[-0.045em]`} style={{ '--d': 0, fontSize: 'clamp(2.6rem, 6.4vh, 4.4rem)' } as CSSProperties}>
                            {t.line1}
                            <br />
                            <span className={`${serif} text-[#5B3DF5]`}>{t.line2}</span>
                        </p>
                    </div>

                    <div className="relative mt-10 max-w-[30rem] [@media(max-height:720px)]:hidden">
                        <div className="mk-rise" style={{ '--d': 2 } as CSSProperties}><SlackPanel rows={3} /></div>
                        <div className="mk-rise mt-4 rounded-xl border border-[#15120F]/10 bg-white p-4" style={{ '--d': 3 } as CSSProperties}><Heatmap /></div>
                        <Note arrow="left" className="-right-6 top-10 translate-x-full">tomorrow, this could<br />be your prospect</Note>
                    </div>

                    <p className="mt-10 max-w-sm text-[15px] leading-7 text-[#15120F]/55">Record a personal video, send one link, and get a message the moment it’s watched.</p>
                </aside>
            </div>
        </main>
    );
}
