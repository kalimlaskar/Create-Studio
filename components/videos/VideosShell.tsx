import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { Compass, Film, Home, Tag } from 'lucide-react';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const D = 'font-[family-name:var(--font-display)]';
export const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';

const NAV = [
    { href: '/studio', label: 'Home', icon: Home },
    { href: '/studio/videos', label: 'Videos', icon: Film },
    { href: '/features', label: 'Features', icon: Compass },
    { href: '/pricing', label: 'Pricing', icon: Tag },
];

/** Page frame for the video library and video pages, matching the studio home. */
export function VideosShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
    return (
        <main className={`${display.variable} ${body.variable} flex min-h-dvh bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[#14121F]/8 bg-white px-4 py-5 md:flex">
                <Link href="/" aria-label="Cliprame home" className={`inline-flex items-center gap-2.5 rounded-full px-1 ${focus}`}>
                    <Image src="/cliprame-icon.svg" alt="" width={32} height={32} className="h-8 w-8" />
                    <span className={`${D} text-lg font-bold tracking-tight`}>Cliprame</span>
                </Link>
                <nav aria-label="Studio" className="mt-8 space-y-1">
                    {NAV.map(({ href, label, icon: Icon }) => {
                        const active = href === '/studio/videos';
                        return (
                            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-[#14121F]/[0.06] font-semibold' : 'font-medium text-[#14121F]/70 hover:bg-[#14121F]/[0.04] hover:text-[#14121F]'} ${focus}`}>
                                <Icon className="h-4 w-4" /> {label}
                            </Link>
                        );
                    })}
                </nav>
                <p className="mt-auto rounded-2xl bg-[#F7F6FB] p-4 text-xs leading-5 text-[#14121F]/60">
                    Share links show who watched, how much, and which chapters they cared about.
                </p>
            </aside>

            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#14121F]/8 bg-white/85 px-4 backdrop-blur-xl sm:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link href="/studio" aria-label="Studio home" className={`rounded-full md:hidden ${focus}`}>
                            <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                        </Link>
                        <h1 className={`${D} truncate text-xl font-bold tracking-tight`}>{title}</h1>
                    </div>
                    {actions}
                </header>
                <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
            </div>
        </main>
    );
}
