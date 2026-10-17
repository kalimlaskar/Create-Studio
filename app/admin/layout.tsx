import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { CurrencyToggle } from '@/components/admin/CurrencyToggle';
import { adminMoney } from '@/lib/admin/money';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = { title: 'Admin | Cliprame', robots: { index: false, follow: false } };
// Always fresh: this is live operational data.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // Anyone who isn't a super admin gets a 404, so the dashboard's existence isn't revealed.
    const admin = await requireAdmin();
    const { currency, rate } = await adminMoney();
    const rateText = `$1 = ₹${rate.inrPerUsd.toFixed(2)}${rate.live && rate.date ? ` · ${new Date(rate.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ' · estimate'}`;
    const { count: open, error: setupError } = await admin.db.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
    // Before the admin migration runs, explain what to do instead of crashing.
    const notSetUp = setupError?.code === 'PGRST205' || setupError?.code === '42P01';
    const { count: urgent } = await admin.db.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('urgent', true);

    return (
        <main className={`${display.variable} ${body.variable} min-h-dvh bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F]`}>
            <header className="sticky top-0 z-30 border-b border-[#14121F]/[0.07] bg-white/85 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
                    <Link href="/admin" className="inline-flex items-center gap-2.5">
                        <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                        <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">Cliprame</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#14121F] px-2 py-0.5 text-[11px] font-semibold text-white"><ShieldCheck className="h-3 w-3" /> Admin</span>
                    </Link>
                    <AdminNav openReports={open ?? 0} urgentReports={urgent ?? 0} />
                    <div className="ml-auto flex items-center gap-4 text-xs text-[#14121F]/50">
                        <CurrencyToggle currency={currency} rateText={rateText} />
                        <span className="hidden sm:inline">{admin.email}</span>
                        <Link href="/studio" className="inline-flex items-center gap-1 font-semibold text-[#14121F]/65 hover:text-[#14121F]"><ArrowLeft className="h-3.5 w-3.5" /> Studio</Link>
                    </div>
                </div>
            </header>
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
                {notSetUp ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-amber-900">
                        <p className="font-semibold">The admin dashboard isn’t set up in the database yet.</p>
                        <p className="mt-1 text-sm">Run <code className="rounded bg-white/70 px-1.5 py-0.5">supabase/migrations/20261017000700_admin.sql</code> in the Supabase SQL Editor, then reload this page.</p>
                    </div>
                ) : children}
            </div>
        </main>
    );
}
