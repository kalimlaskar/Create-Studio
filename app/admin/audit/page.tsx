import { requireAdmin } from '@/lib/admin/auth';
import { loadAuditLog } from '@/lib/admin/data';
import { D, card, dateTime } from '@/components/admin/ui';

const ACTIONS: Record<string, string> = {
    'user.banned': 'Banned a user',
    'user.unbanned': 'Lifted a ban',
    'video.taken_down': 'Took down a video',
    'video.restored': 'Restored a video',
    'video.reviewed': 'Opened a reported video',
    'report.dismissed': 'Dismissed a report',
};

export default async function AdminAuditPage() {
    const admin = await requireAdmin();
    const entries = await loadAuditLog(admin.db);

    return (
        <div className="space-y-5">
            <div>
                <h1 className={`${D} text-3xl font-bold tracking-tight`}>Audit log</h1>
                <p className="mt-1 text-sm text-[#14121F]/55">Every admin action, newest first. Entries can’t be edited or deleted from here.</p>
            </div>
            <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="border-b border-[#14121F]/[0.07] text-[11px] uppercase tracking-wider text-[#14121F]/45">
                        <tr><th className="px-4 py-3 font-semibold">When</th><th className="px-3 py-3 font-semibold">Admin</th><th className="px-3 py-3 font-semibold">Action</th><th className="px-4 py-3 font-semibold">Details</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#14121F]/[0.06]">
                        {entries.map((entry) => {
                            const details = entry.details as Record<string, unknown>;
                            const summary = [details.title && `“${details.title}”`, details.email, details.reason && `reason: ${details.reason}`, details.resolution].filter(Boolean).join(' · ');
                            return (
                                <tr key={entry.id}>
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#14121F]/60">{dateTime(entry.created_at)}</td>
                                    <td className="px-3 py-3 text-xs">{entry.admin_email}</td>
                                    <td className="px-3 py-3 font-medium">{ACTIONS[entry.action] ?? entry.action}</td>
                                    <td className="max-w-md truncate px-4 py-3 text-xs text-[#14121F]/60" title={summary || entry.target_id || ''}>{summary || entry.target_id}</td>
                                </tr>
                            );
                        })}
                        {entries.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[#14121F]/50">No admin actions yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
