import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif } from 'next/font/google';
import { SiteHeader, Wordmark, type NavKey } from './SiteHeader';
import type { MarketingSession } from './session';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const serifFont = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const fontVariables = `${display.variable} ${body.variable} ${serifFont.variable}`;

const FOOTER = [
    { title: 'Product', links: [['How it works', '/#how-it-works'], ['Features', '/features'], ['Demo', '/demo'], ['Pricing', '/pricing']] },
    { title: 'For', links: [['Sales follow-ups', '/features#analytics'], ['Proposals', '/features#protect'], ['Lead capture', '/features#send'], ['Slack & HubSpot', '/features#connect']] },
    { title: 'Company', links: [['Privacy', '/privacy'], ['Terms', '/terms'], ['Data processing', '/dpa'], ['Log in', '/login']] },
];

export function MarketingShell({ current, session, children }: { current: NavKey; session: MarketingSession; children: ReactNode }) {
    return (
        <main className={`${fontVariables} mk-paper relative min-h-dvh overflow-x-clip font-[family-name:var(--font-body)] text-[#15120F] antialiased selection:bg-[#5B3DF5]/20`}>
            <SiteHeader current={current} session={session} />
            {children}

            <footer className="border-t border-[#15120F]/10">
                <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_repeat(3,1fr)]">
                    <div>
                        <Wordmark />
                        <p className="mt-4 max-w-xs text-sm leading-6 text-[#15120F]/55">Personal video for people who follow up. Record it once, send one link, know when it lands.</p>
                    </div>
                    {FOOTER.map((column) => (
                        <nav key={column.title} aria-label={column.title}>
                            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#15120F]/40">{column.title}</p>
                            <ul className="mt-4 space-y-2.5">
                                {column.links.map(([text, href]) => (
                                    <li key={text}><Link href={href} className="text-sm text-[#15120F]/65 transition hover:text-[#15120F]">{text}</Link></li>
                                ))}
                            </ul>
                        </nav>
                    ))}
                </div>
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-[#15120F]/[0.07] px-5 py-6 text-xs text-[#15120F]/40 sm:px-8">
                    <p>© {new Date().getFullYear()} Cliprame</p>
                    <p>Made for people who follow up.</p>
                </div>
            </footer>
        </main>
    );
}
