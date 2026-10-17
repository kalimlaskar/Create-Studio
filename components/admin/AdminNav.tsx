'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/ai', label: 'AI usage' },
    { href: '/admin/reports', label: 'Reports' },
    { href: '/admin/audit', label: 'Audit log' },
];

export function AdminNav({ openReports, urgentReports }: { openReports: number; urgentReports: number }) {
    const pathname = usePathname() ?? '';
    return (
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
                const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
                return (
                    <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 ${active ? 'bg-[#14121F] text-white' : 'text-[#14121F]/60 hover:bg-[#14121F]/[0.05] hover:text-[#14121F]'}`}>
                        {tab.label}
                        {tab.href === '/admin/reports' && openReports > 0 && (
                            <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${urgentReports ? 'bg-red-500 text-white' : active ? 'bg-white/20' : 'bg-[#14121F]/10'}`}>{openReports}</span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
