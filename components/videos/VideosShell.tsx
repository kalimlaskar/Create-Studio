import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { loadSidebar } from '@/lib/studio/account';
import { D, focus } from './ui';
import { MobileTabBar, StudioSidebar } from './StudioSidebar';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

/**
 * Page frame for the studio's videos and integrations pages. `active` is no longer
 * needed (the sidebar reads the URL) but is kept so existing pages still compile.
 */
export async function VideosShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; active?: string; children: ReactNode }) {
    const { account, collapsed } = await loadSidebar();

    return (
        <main className={`${display.variable} ${body.variable} flex min-h-dvh bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <StudioSidebar account={account} initialCollapsed={collapsed} />

            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#14121F]/[0.07] bg-[#F7F6FB]/80 px-4 backdrop-blur-xl sm:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link href="/studio" aria-label="Studio home" className={`rounded-full md:hidden ${focus}`}>
                            <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                        </Link>
                        <h1 className={`${D} truncate text-xl font-bold tracking-tight`}>{title}</h1>
                    </div>
                    {actions}
                </header>
                {/* Extra bottom space on phones so the tab bar never covers content. */}
                <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-8 md:pb-10">{children}</div>
            </div>

            <MobileTabBar />
        </main>
    );
}
