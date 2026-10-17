import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { loadAdminOverview } from '@/lib/admin/data';
import { adminMoney } from '@/lib/admin/money';
import { formatBytes } from '@/lib/studio/overviewTypes';
import { D, PLAN_STYLE, PanelTitle, Stat, card, timeAgo } from '@/components/admin/ui';

export default async function AdminOverviewPage() {
    const admin = await requireAdmin();
    const [{ users, totals, signups }, { money, price }] = await Promise.all([loadAdminOverview(admin.db), adminMoney()]);
    const payingTotal = totals.paying.reduce((sum, row) => sum + row.count, 0);
    const newest = [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    const engaged = [...users].filter((user) => user.plays30d > 0 || user.videos > 0).sort((a, b) => b.plays30d - a.plays30d || b.videos - a.videos).slice(0, 8);
    const peak = Math.max(1, ...signups.map((day) => day.count));

    return (
        <div className="space-y-6">
            <h1 className={`${D} text-3xl font-bold tracking-tight`}>Overview</h1>

            {totals.urgentReports > 0 && (
                <Link href="/admin/reports" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 hover:bg-red-100">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span><strong>{totals.urgentReports} urgent {totals.urgentReports === 1 ? 'report needs' : 'reports need'} review.</strong> Intimate content shared without consent should come down within 24 hours of a complaint.</span>
                </Link>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <Stat label="Users" value={totals.users.toLocaleString('en-IN')} hint={`+${totals.new7d} this week · +${totals.new30d} in 30 days`} />
                <Stat label="Paying customers" value={payingTotal.toLocaleString('en-IN')} hint={totals.paying.map((row) => `${row.count} ${row.name}`).join(' · ')} />
                <Stat label="Monthly revenue" value={price(totals.mrr)} hint="At list prices" />
                <Stat label="Videos hosted" value={totals.videos.toLocaleString('en-IN')} hint={`${formatBytes(totals.storageBytes)} stored`} />
                <Stat label="Plays" value={totals.plays7d.toLocaleString('en-IN')} hint={`This week · ${totals.plays30d.toLocaleString('en-IN')} in 30 days`} />
                <Stat label="AI this month" value={`${(totals.aiTranscriptionMin + totals.aiVoiceoverMin).toLocaleString('en-IN')} min`} hint={`≈ ${money(totals.aiCostUsd)} in Gemini costs`} />
                <Stat label="Open reports" value={totals.openReports} hint={totals.urgentReports ? `${totals.urgentReports} urgent` : 'None urgent'} tone={totals.urgentReports ? 'alert' : undefined} />
                <Stat label="Banned accounts" value={totals.bannedUsers} />
            </div>

            <div className={`${card} p-5`}>
                <PanelTitle title="Sign-ups, last 30 days" />
                <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label={`Sign-ups per day over the last 30 days. ${totals.new30d} in total.`}>
                    {signups.map((day) => (
                        <div key={day.day} className="group relative flex-1">
                            <div className={`rounded-t-[3px] ${day.count ? 'bg-[#6A4CFF]' : 'bg-[#14121F]/[0.06]'}`} style={{ height: `${day.count ? Math.max(8, (day.count / peak) * 100) : 4}%`, minHeight: day.count ? 6 : 3 }} />
                            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#14121F] px-2 py-1 text-[11px] text-white group-hover:block">{new Date(day.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: {day.count}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-[#14121F]/40"><span>30 days ago</span><span>Today</span></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className={`${card} p-5`}>
                    <PanelTitle title="Newest customers" href="/admin/users?sort=newest" link="All users" />
                    <ul className="mt-3 divide-y divide-[#14121F]/[0.06]">
                        {newest.map((user) => (
                            <li key={user.id} className="flex items-center gap-3 py-2.5 text-sm">
                                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{user.name || user.email}</span><span className="block truncate text-xs text-[#14121F]/50">{user.email}</span></span>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PLAN_STYLE[user.plan]}`}>{user.plan}</span>
                                <span className="w-20 text-right text-xs text-[#14121F]/50">{timeAgo(user.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className={`${card} p-5`}>
                    <PanelTitle title="Most engaged, last 30 days" href="/admin/users?sort=plays" link="See all" />
                    {engaged.length === 0 ? <p className="mt-3 text-sm text-[#14121F]/50">No plays yet.</p> : (
                        <ul className="mt-3 divide-y divide-[#14121F]/[0.06]">
                            {engaged.map((user) => (
                                <li key={user.id} className="flex items-center gap-3 py-2.5 text-sm">
                                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{user.name || user.email}</span><span className="block truncate text-xs text-[#14121F]/50">{user.videos} videos · last active {timeAgo(user.lastSignInAt)}</span></span>
                                    <span className="text-right text-sm font-semibold tabular-nums">{user.plays30d}<span className="ml-1 text-xs font-normal text-[#14121F]/45">plays</span></span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
