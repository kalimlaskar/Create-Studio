import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/auth';
import { loadAdminOverview, type AdminUser } from '@/lib/admin/data';
import { formatBytes } from '@/lib/studio/overviewTypes';
import { BanUserButton } from '@/components/admin/AdminActions';
import { D, PLAN_STYLE, card, timeAgo } from '@/components/admin/ui';

const SORTS: Record<string, { label: string; by: (a: AdminUser, b: AdminUser) => number }> = {
    newest: { label: 'Newest', by: (a, b) => b.createdAt.localeCompare(a.createdAt) },
    active: { label: 'Recently active', by: (a, b) => (b.lastSignInAt ?? '').localeCompare(a.lastSignInAt ?? '') },
    plays: { label: 'Most plays', by: (a, b) => b.plays30d - a.plays30d },
    videos: { label: 'Most videos', by: (a, b) => b.videos - a.videos },
    storage: { label: 'Most storage', by: (a, b) => b.storageBytes - a.storageBytes },
    ai: { label: 'Most AI', by: (a, b) => (b.aiTranscriptionMin + b.aiVoiceoverMin) - (a.aiTranscriptionMin + a.aiVoiceoverMin) },
};

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; plan?: string }> }) {
    const admin = await requireAdmin();
    const params = await searchParams;
    const { users } = await loadAdminOverview(admin.db);
    const q = (params.q ?? '').trim().toLowerCase();
    const sort = SORTS[params.sort ?? ''] ? params.sort! : 'newest';
    const plan = ['free', 'creator', 'studio', 'banned'].includes(params.plan ?? '') ? params.plan! : '';
    const rows = users
        .filter((user) => !q || user.email.toLowerCase().includes(q) || (user.name ?? '').toLowerCase().includes(q))
        .filter((user) => !plan || (plan === 'banned' ? user.ban : user.plan === plan))
        .sort(SORTS[sort].by);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className={`${D} text-3xl font-bold tracking-tight`}>Users <span className="text-lg font-semibold text-[#14121F]/35">{rows.length}</span></h1>
                <form className="flex flex-wrap items-center gap-2" role="search">
                    <label className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#14121F]/35" />
                        <input name="q" defaultValue={params.q ?? ''} placeholder="Search email or name" aria-label="Search users" className="w-60 rounded-xl border border-[#14121F]/12 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#6A4CFF]" />
                    </label>
                    <select name="plan" defaultValue={plan} aria-label="Filter by plan" className="rounded-xl border border-[#14121F]/12 bg-white px-3 py-2 text-sm">
                        <option value="">All plans</option><option value="free">Free</option><option value="creator">Creator</option><option value="studio">Studio</option><option value="banned">Banned</option>
                    </select>
                    <select name="sort" defaultValue={sort} aria-label="Sort" className="rounded-xl border border-[#14121F]/12 bg-white px-3 py-2 text-sm">
                        {Object.entries(SORTS).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
                    </select>
                    <button type="submit" className="rounded-xl bg-[#14121F] px-4 py-2 text-sm font-semibold text-white">Apply</button>
                    {(q || plan) && <Link href="/admin/users" className="text-sm font-semibold text-[#14121F]/50 hover:text-[#14121F]">Clear</Link>}
                </form>
            </div>

            <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[60rem] text-left text-sm">
                    <thead className="border-b border-[#14121F]/[0.07] text-[11px] uppercase tracking-wider text-[#14121F]/45">
                        <tr>
                            <th className="px-4 py-3 font-semibold">User</th>
                            <th className="px-3 py-3 font-semibold">Plan</th>
                            <th className="px-3 py-3 font-semibold">Joined</th>
                            <th className="px-3 py-3 font-semibold">Last active</th>
                            <th className="px-3 py-3 text-right font-semibold">Videos</th>
                            <th className="px-3 py-3 text-right font-semibold">Storage</th>
                            <th className="px-3 py-3 text-right font-semibold">Plays (30d)</th>
                            <th className="px-3 py-3 text-right font-semibold">AI min</th>
                            <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#14121F]/[0.06]">
                        {rows.map((user) => (
                            <tr key={user.id} className={user.ban ? 'bg-red-50/50' : ''}>
                                <td className="max-w-[16rem] px-4 py-3">
                                    <p className="truncate font-medium">{user.name || '—'}</p>
                                    <p className="truncate text-xs text-[#14121F]/50">{user.email}</p>
                                    {user.ban && <p className="mt-0.5 truncate text-xs font-medium text-red-700">Banned {timeAgo(user.ban.at)}: {user.ban.reason}</p>}
                                </td>
                                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PLAN_STYLE[user.plan]}`}>{user.plan}</span></td>
                                <td className="px-3 py-3 text-xs text-[#14121F]/60">{timeAgo(user.createdAt)}</td>
                                <td className="px-3 py-3 text-xs text-[#14121F]/60">{timeAgo(user.lastSignInAt)}</td>
                                <td className="px-3 py-3 text-right tabular-nums">{user.videos}{user.removedVideos > 0 && <span className="ml-1 text-xs text-red-600">({user.removedVideos} removed)</span>}</td>
                                <td className="px-3 py-3 text-right tabular-nums text-[#14121F]/70">{formatBytes(user.storageBytes)}</td>
                                <td className="px-3 py-3 text-right font-semibold tabular-nums">{user.plays30d}</td>
                                <td className="px-3 py-3 text-right tabular-nums text-[#14121F]/70">{user.aiTranscriptionMin + user.aiVoiceoverMin}</td>
                                <td className="px-4 py-3 text-right">{user.id !== admin.id && <BanUserButton userId={user.id} banned={Boolean(user.ban)} />}</td>
                            </tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#14121F]/50">No users match.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
