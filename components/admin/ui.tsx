import Link from 'next/link';
import type { ReactNode } from 'react';

// Small pieces shared by the admin pages.

export const D = 'font-[family-name:var(--font-display)]';
export const card = 'rounded-2xl border border-[#14121F]/8 bg-white';

export function timeAgo(iso: string | null) {
    if (!iso) return 'never';
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days < 45 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const dateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'alert' }) {
    return (
        <div className={`${card} p-4 ${tone === 'alert' ? 'border-red-200 bg-red-50/60' : ''}`}>
            <p className={`text-xs font-medium ${tone === 'alert' ? 'text-red-700' : 'text-[#14121F]/55'}`}>{label}</p>
            <p className={`mt-1 ${D} text-2xl font-bold tracking-tight tabular-nums ${tone === 'alert' ? 'text-red-700' : ''}`}>{value}</p>
            {hint && <p className="mt-0.5 text-[11px] text-[#14121F]/45">{hint}</p>}
        </div>
    );
}

export function PanelTitle({ title, href, link }: { title: string; href?: string; link?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{title}</h2>
            {href && <Link href={href} className="text-xs font-semibold text-[#6A4CFF] hover:underline">{link}</Link>}
        </div>
    );
}

export const PLAN_STYLE: Record<string, string> = {
    free: 'bg-[#14121F]/[0.06] text-[#14121F]/60',
    creator: 'bg-[#6A4CFF]/10 text-[#4B30D9]',
    studio: 'bg-amber-100 text-amber-800',
};
