import { requireAdmin } from '@/lib/admin/auth';
import { loadAdminOverview } from '@/lib/admin/data';
import { adminMoney } from '@/lib/admin/money';
import { getCatalog } from '@/lib/plans/catalog';
import { D, PLAN_STYLE, Stat, card } from '@/components/admin/ui';

export default async function AdminAiPage() {
    const admin = await requireAdmin();
    const [{ users, totals }, { money, currency, rate }, catalog] = await Promise.all([loadAdminOverview(admin.db), adminMoney(), getCatalog()]);
    const planById = new Map(catalog.map((plan) => [plan.id, plan]));
    const rows = users.filter((user) => user.aiTranscriptionMin + user.aiVoiceoverMin > 0).sort((a, b) => (b.aiTranscriptionMin + b.aiVoiceoverMin) - (a.aiTranscriptionMin + a.aiVoiceoverMin));
    const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div>
                <h1 className={`${D} text-3xl font-bold tracking-tight`}>AI usage</h1>
                <p className="mt-1 text-sm text-[#14121F]/55">{month}. Minutes reset on the 1st. Costs are estimates at {money(0.04)}/min transcription and {money(0.018)}/min voiceover{currency === 'inr' ? ` ($1 = ₹${rate.inrPerUsd.toFixed(2)})` : ''}.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Transcription" value={`${totals.aiTranscriptionMin.toLocaleString('en-IN')} min`} hint="Captions and edit by text" />
                <Stat label="AI voiceover" value={`${totals.aiVoiceoverMin.toLocaleString('en-IN')} min`} />
                <Stat label="Estimated cost" value={money(totals.aiCostUsd)} hint="Gemini, this month" />
                <Stat label="People using AI" value={rows.length} hint={`of ${totals.users} users`} />
            </div>
            <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="border-b border-[#14121F]/[0.07] text-[11px] uppercase tracking-wider text-[#14121F]/45">
                        <tr><th className="px-4 py-3 font-semibold">User</th><th className="px-3 py-3 font-semibold">Plan</th><th className="px-3 py-3 font-semibold">Transcription</th><th className="px-3 py-3 font-semibold">Voiceover</th><th className="px-4 py-3 text-right font-semibold">Est. cost</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#14121F]/[0.06]">
                        {rows.map((user) => {
                            const limits = planById.get(user.plan) ?? catalog[0];
                            const bar = (used: number, limit: number) => (
                                <div className="flex items-center gap-2.5">
                                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#14121F]/[0.07]"><span className={`block h-full rounded-full ${used >= limit ? 'bg-red-500' : used >= limit * 0.8 ? 'bg-amber-500' : 'bg-[#6A4CFF]'}`} style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} /></span>
                                    <span className="text-xs tabular-nums text-[#14121F]/65">{used} / {limit}</span>
                                </div>
                            );
                            return (
                                <tr key={user.id}>
                                    <td className="max-w-[16rem] px-4 py-3"><p className="truncate font-medium">{user.name || user.email}</p><p className="truncate text-xs text-[#14121F]/50">{user.email}</p></td>
                                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PLAN_STYLE[user.plan]}`}>{user.plan}</span></td>
                                    <td className="px-3 py-3">{bar(user.aiTranscriptionMin, limits.transcriptionMinutes)}</td>
                                    <td className="px-3 py-3">{bar(user.aiVoiceoverMin, limits.voiceoverMinutes)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{money(user.aiTranscriptionMin * 0.04 + user.aiVoiceoverMin * 0.018)}</td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#14121F]/50">Nobody has used AI features this month.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
