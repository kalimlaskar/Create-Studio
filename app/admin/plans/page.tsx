import { requireAdmin } from '@/lib/admin/auth';
import { loadAdminOverview } from '@/lib/admin/data';
import { getCatalog, invalidateCatalog, razorpayIdForPlan } from '@/lib/plans/catalog';
import { exportLabel, isPaidPlan } from '@/components/pricing/planLimits';
import { NewPlanButton, PlanRowActions } from '@/components/admin/PlanEditor';
import { D, card } from '@/components/admin/ui';

export default async function AdminPlansPage() {
    const admin = await requireAdmin();
    const { error: tableError } = await admin.db.from('plans').select('id', { count: 'exact', head: true });
    // Always show the latest saved packages here.
    invalidateCatalog();
    const [catalog, { users }] = await Promise.all([getCatalog(), loadAdminOverview(admin.db)]);
    const subscribers = (id: string) => users.filter((user) => user.plan === id && !user.ban).length;
    const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className={`${D} text-3xl font-bold tracking-tight`}>Packages</h1>
                    <p className="mt-1 max-w-2xl text-sm text-[#14121F]/55">What each package costs and allows. Changes apply across the app within a minute: the pricing page, limits, the account page and checkout.</p>
                </div>
                {!tableError && <NewPlanButton razorpayReady={razorpayReady} />}
            </div>

            {tableError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    These are the built-in packages. To edit them or add new ones, run <code className="rounded bg-white/70 px-1.5 py-0.5">supabase/migrations/20261017000800_plans.sql</code> in the Supabase SQL Editor.
                </div>
            )}

            <div className={`${card} overflow-x-auto`}>
                <table className="w-full min-w-[60rem] text-left text-sm">
                    <thead className="border-b border-[#14121F]/[0.07] text-[11px] uppercase tracking-wider text-[#14121F]/45">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Package</th>
                            <th className="px-3 py-3 font-semibold">Price</th>
                            <th className="px-3 py-3 font-semibold">Videos</th>
                            <th className="px-3 py-3 font-semibold">Length</th>
                            <th className="px-3 py-3 font-semibold">AI / month</th>
                            <th className="px-3 py-3 font-semibold">Features</th>
                            <th className="px-3 py-3 text-right font-semibold">Customers</th>
                            <th className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#14121F]/[0.06]">
                        {catalog.map((plan, index) => {
                            const effective = razorpayIdForPlan(plan);
                            const onSale = !isPaidPlan(plan) || Boolean(effective && razorpayReady);
                            return (
                                <tr key={plan.id} className={plan.archived ? 'opacity-55' : ''}>
                                    <td className="max-w-[16rem] px-4 py-3">
                                        <p className="font-semibold">{plan.name} <span className="font-mono text-[11px] font-normal text-[#14121F]/40">{plan.id}</span></p>
                                        <p className="mt-0.5 flex flex-wrap gap-1">
                                            {plan.archived && <span className="rounded-full bg-[#14121F]/[0.08] px-2 py-0.5 text-[10px] font-semibold">Archived</span>}
                                            {!plan.archived && !plan.isPublic && <span className="rounded-full bg-[#14121F]/[0.08] px-2 py-0.5 text-[10px] font-semibold">Hidden</span>}
                                            {!plan.archived && isPaidPlan(plan) && (onSale
                                                ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">On sale</span>
                                                : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="Link a Razorpay plan to sell it">Can’t be bought yet</span>)}
                                        </p>
                                    </td>
                                    <td className="px-3 py-3 tabular-nums">{isPaidPlan(plan) ? <>₹{plan.priceInr.toLocaleString('en-IN')}<span className="text-[#14121F]/45"> · ${plan.priceUsd}</span></> : 'Free'}</td>
                                    <td className="px-3 py-3 tabular-nums">{plan.hostedVideos.toLocaleString('en-IN')}</td>
                                    <td className="px-3 py-3">{exportLabel(plan)}{plan.watermark && <span className="block text-[11px] text-[#14121F]/45">watermark</span>}</td>
                                    <td className="px-3 py-3 text-xs text-[#14121F]/70">{plan.transcriptionMinutes} min captions<br />{plan.voiceoverMinutes} min voiceover<br />{plan.aiDailyRequests}/day scripts</td>
                                    <td className="px-3 py-3 text-xs text-[#14121F]/70">
                                        {[plan.protection && 'Locks', plan.forms && 'Forms', plan.maxIntegrations > 0 && `${plan.maxIntegrations} integrations`, plan.embedDomains && 'Embed limits'].filter(Boolean).join(' · ') || '—'}
                                    </td>
                                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{subscribers(plan.id)}</td>
                                    <td className="px-4 py-3">{!tableError && <PlanRowActions plan={plan} subscribers={subscribers(plan.id)} razorpayReady={razorpayReady} effectiveRazorpayId={effective} first={index === 0} last={index === catalog.length - 1} />}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul className="space-y-1.5 text-xs leading-5 text-[#14121F]/55">
                <li>• <strong className="text-[#14121F]/75">Changing limits</strong> applies to everyone on that package straight away. Nothing already made is deleted; videos already locked or with forms keep working.</li>
                <li>• <strong className="text-[#14121F]/75">Changing a price</strong> creates a new Razorpay plan for new subscribers. Existing subscribers keep their current price.</li>
                <li>• <strong className="text-[#14121F]/75">Archiving</strong> stops new purchases; existing customers keep the package until they cancel.</li>
            </ul>
        </div>
    );
}
