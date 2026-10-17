'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDown, ArrowUp, Archive, CheckCircle2, Eye, EyeOff, LoaderCircle, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import type { CatalogPlan } from '@/components/pricing/planLimits';
import { movePlanAction, savePlanAction, setPlanStatusAction } from '@/app/admin/plans/actions';
import { reducedLimits, normalizePlanInput } from '@/lib/plans/validate';

const input = 'w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3 py-2 text-sm outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10';
const small = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70';

const BLANK: CatalogPlan = {
    id: '', name: '', description: null, priceUsd: 0, priceInr: 0, isPublic: true, archived: false, sortOrder: 0,
    razorpayPlanId: null, legacyRazorpayPlanIds: [],
    exportSeconds: 600, watermark: false, transcriptionMinutes: 150, voiceoverMinutes: 50, hostedVideos: 250,
    aiDailyRequests: 200, embedDomains: true, protection: true, forms: true, maxIntegrations: 20, seats: 3,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs font-semibold text-[#14121F]/60">{label}</span>
            <span className="mt-1 block">{children}</span>
            {hint && <span className="mt-1 block text-[11px] leading-4 text-[#14121F]/45">{hint}</span>}
        </label>
    );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[#14121F]/8 px-3.5 py-3">
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-[#14121F]/50">{hint}</span>
            </span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#6A4CFF]" />
        </label>
    );
}

/** A short confirmation in the corner after saving; goes away by itself. */
function Toast({ message, setMessage }: { message: string; setMessage: (message: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => setMessage(''), 6000);
        return () => clearTimeout(timer);
    }, [message, setMessage]);
    return (
        <div role="status" className="animate-dialog-in fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-2xl bg-[#14121F] px-4 py-3 text-sm text-white shadow-xl">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <p className="min-w-0 flex-1">{message}</p>
            <button type="button" onClick={() => setMessage('')} aria-label="Dismiss" className="-mr-1 rounded-full p-0.5 text-white/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
    );
}

/** The create/edit form, in a dialog. */
function Editor({ plan, subscribers, razorpayReady, effectiveRazorpayId, onClose, onSaved }: { plan: CatalogPlan | null; subscribers: number; razorpayReady: boolean; effectiveRazorpayId: string | null; onClose: () => void; onSaved: (message: string) => void }) {
    const router = useRouter();
    const isNew = !plan;
    const isFree = plan?.id === 'free';
    const [draft, setDraft] = useState<CatalogPlan>(plan ?? BLANK);
    const [razorpayId, setRazorpayId] = useState(effectiveRazorpayId ?? '');
    const [error, setError] = useState('');
    const [pending, start] = useTransition();
    const set = <K extends keyof CatalogPlan>(key: K, value: CatalogPlan[K]) => { setError(''); setDraft((current) => ({ ...current, [key]: value })); };

    const payload = {
        name: draft.name, description: draft.description ?? '', priceUsd: draft.priceUsd, priceInr: draft.priceInr, isPublic: draft.isPublic,
        razorpayPlanId: razorpayId,
        limits: {
            exportSeconds: draft.exportSeconds, watermark: draft.watermark, transcriptionMinutes: draft.transcriptionMinutes, voiceoverMinutes: draft.voiceoverMinutes,
            hostedVideos: draft.hostedVideos, aiDailyRequests: draft.aiDailyRequests, embedDomains: draft.embedDomains, protection: draft.protection, forms: draft.forms, maxIntegrations: draft.maxIntegrations, seats: draft.seats,
        },
    };
    // Warn before taking anything away from people already paying for this package.
    const reductions = useMemo(() => {
        if (!plan) return [];
        const checked = normalizePlanInput(payload, { isFree });
        return checked.ok ? reducedLimits(plan, checked.plan.limits) : [];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft, plan, isFree]);
    const priceChanged = Boolean(plan && plan.priceInr !== draft.priceInr);

    const save = () => start(async () => {
        const result = await savePlanAction(plan?.id ?? null, payload);
        if (result.error) { setError(result.error); return; }
        router.refresh();
        onClose();
        const message = isNew ? `${draft.name.trim()} created.` : `${draft.name.trim()} saved.`;
        onSaved(result.notice && result.notice !== 'Saved.' ? `${message} ${result.notice}` : message);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#14121F]/55 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="plan-editor-title" className="animate-dialog-in flex w-full max-w-3xl flex-col overflow-hidden bg-white sm:max-h-[92vh] sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-[#14121F]/[0.07] px-6 py-4">
                    <h2 id="plan-editor-title" className="text-lg font-semibold">{isNew ? 'New package' : `Edit ${plan.name}`}</h2>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[#14121F]/50 hover:bg-[#14121F]/[0.06]"><X className="h-4 w-4" /></button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    <section className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name"><input value={draft.name} onChange={(event) => set('name', event.target.value)} maxLength={40} placeholder="e.g. Team" className={input} /></Field>
                        <Field label="Short description" hint="Shown on the pricing card.">
                            <input value={draft.description ?? ''} onChange={(event) => set('description', event.target.value)} maxLength={200} placeholder="e.g. For sales teams sending every day." className={input} />
                        </Field>
                        <Field label="Price per month (₹)" hint={isFree ? 'Free is always ₹0.' : 'What Razorpay charges.'}>
                            <input type="number" min={0} value={draft.priceInr} disabled={isFree} onChange={(event) => set('priceInr', Number(event.target.value))} className={input} />
                        </Field>
                        <Field label="Price per month ($)" hint="Shown on the pricing page and used for revenue in dollars.">
                            <input type="number" min={0} step="0.01" value={draft.priceUsd} disabled={isFree} onChange={(event) => set('priceUsd', Number(event.target.value))} className={input} />
                        </Field>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold">Limits</h3>
                        <div className="mt-3 grid gap-4 sm:grid-cols-3">
                            <Field label="Videos hosted"><input type="number" min={0} value={draft.hostedVideos} onChange={(event) => set('hostedVideos', Number(event.target.value))} className={input} /></Field>
                            <Field label="Longest video (minutes)"><input type="number" min={0.5} step="0.5" value={draft.exportSeconds / 60} onChange={(event) => set('exportSeconds', Math.round(Number(event.target.value) * 60))} className={input} /></Field>
                            <Field label="AI requests per day" hint="Scripts and reel captions."><input type="number" min={0} value={draft.aiDailyRequests} onChange={(event) => set('aiDailyRequests', Number(event.target.value))} className={input} /></Field>
                            <Field label="Transcription min / month" hint="Captions and edit by text."><input type="number" min={0} value={draft.transcriptionMinutes} onChange={(event) => set('transcriptionMinutes', Number(event.target.value))} className={input} /></Field>
                            <Field label="AI voiceover min / month"><input type="number" min={0} value={draft.voiceoverMinutes} onChange={(event) => set('voiceoverMinutes', Number(event.target.value))} className={input} /></Field>
                            <Field label="Integrations (0–20)" hint="Slack, HubSpot and webhooks."><input type="number" min={0} max={20} value={draft.maxIntegrations} onChange={(event) => set('maxIntegrations', Number(event.target.value))} className={input} /></Field>
                            <Field label="Team seats" hint="People per workspace, owner included."><input type="number" min={1} max={1000} value={draft.seats} onChange={(event) => set('seats', Number(event.target.value))} className={input} /></Field>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Toggle label="Cliprame watermark" hint="On exported and embedded videos." checked={draft.watermark} onChange={(value) => set('watermark', value)} />
                            <Toggle label="Video locks" hint="PIN, password and email codes." checked={draft.protection} onChange={(value) => set('protection', value)} />
                            <Toggle label="Lead forms" hint="Forms before, during or after videos." checked={draft.forms} onChange={(value) => set('forms', value)} />
                            <Toggle label="Limit embeds to own websites" hint="Restrict where videos can be embedded." checked={draft.embedDomains} onChange={(value) => set('embedDomains', value)} />
                        </div>
                    </section>

                    {!isFree && (
                        <section className="grid gap-4 sm:grid-cols-2">
                            <Toggle label="Show on the pricing page" hint="Hidden packages can still be assigned by linking a Razorpay plan." checked={draft.isPublic} onChange={(value) => set('isPublic', value)} />
                            <Field label="Razorpay plan ID" hint={razorpayReady ? 'Leave as is: saving creates or updates the Razorpay plan for you. Paste one only to link a plan you made in Razorpay.' : 'Razorpay keys aren’t set on this server, so paste the plan ID from your Razorpay dashboard to sell this package.'}>
                                <input value={razorpayId} onChange={(event) => setRazorpayId(event.target.value.trim())} placeholder="plan_…" className={`${input} font-mono text-[13px]`} />
                            </Field>
                        </section>
                    )}

                    {(reductions.length > 0 || priceChanged) && subscribers > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {subscribers} {subscribers === 1 ? 'customer is' : 'customers are'} on this package</p>
                            {reductions.length > 0 && <p className="mt-1">These limits get smaller for them straight away: {reductions.join(', ')}. Nothing they already made is deleted; they just can’t add more beyond the new limits.</p>}
                            {priceChanged && <p className="mt-1">The new price applies to new subscribers. Existing subscribers keep paying ₹{plan?.priceInr}.</p>}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-[#14121F]/[0.07] px-6 py-4">
                    {error && <p role="alert" className="min-w-0 flex-1 text-sm font-medium text-red-600">{error}</p>}
                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#14121F]/60 hover:text-[#14121F]">Cancel</button>
                        <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-[#14121F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742] disabled:opacity-50">
                            {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{isNew ? 'Create package' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function NewPlanButton({ razorpayReady }: { razorpayReady: boolean }) {
    const [open, setOpen] = useState(false);
    const [toast, setToast] = useState('');
    return (
        <>
            {toast && <Toast message={toast} setMessage={setToast} />}
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c2742]"><Plus className="h-4 w-4" /> New package</button>
            {open && <Editor plan={null} subscribers={0} razorpayReady={razorpayReady} effectiveRazorpayId={null} onClose={() => setOpen(false)} onSaved={setToast} />}
        </>
    );
}

export function PlanRowActions({ plan, subscribers, razorpayReady, effectiveRazorpayId, first, last }: { plan: CatalogPlan; subscribers: number; razorpayReady: boolean; effectiveRazorpayId: string | null; first: boolean; last: boolean }) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [pending, start] = useTransition();
    const run = (action: () => Promise<{ error?: string }>) => start(async () => { const result = await action(); if (result.error) setError(result.error); else router.refresh(); });
    const isFree = plan.id === 'free';

    return (
        <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setEditing(true)} className={`${small} bg-[#14121F] text-white hover:bg-[#2c2742]`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" disabled={pending || first} onClick={() => run(() => movePlanAction(plan.id, -1))} aria-label="Move earlier" className={`${small} text-[#14121F]/55 hover:bg-[#14121F]/[0.05]`}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={pending || last} onClick={() => run(() => movePlanAction(plan.id, 1))} aria-label="Move later" className={`${small} text-[#14121F]/55 hover:bg-[#14121F]/[0.05]`}><ArrowDown className="h-3.5 w-3.5" /></button>
            {!isFree && !plan.archived && (
                <button type="button" disabled={pending} onClick={() => run(() => setPlanStatusAction(plan.id, { isPublic: !plan.isPublic }))} className={`${small} text-[#14121F]/65 hover:bg-[#14121F]/[0.05]`}>
                    {plan.isPublic ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
                </button>
            )}
            {!isFree && (
                <button type="button" disabled={pending} onClick={() => { if (plan.archived || window.confirm(`Archive ${plan.name}? Nobody new can buy it. ${subscribers} existing ${subscribers === 1 ? 'customer keeps' : 'customers keep'} it until they cancel.`)) run(() => setPlanStatusAction(plan.id, { archived: !plan.archived })); }} className={`${small} ${plan.archived ? 'text-[#14121F]/65 hover:bg-[#14121F]/[0.05]' : 'text-red-600 hover:bg-red-50'}`}>
                    {plan.archived ? <><RotateCcw className="h-3.5 w-3.5" /> Restore</> : <><Archive className="h-3.5 w-3.5" /> Archive</>}
                </button>
            )}
            {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#14121F]/40" />}
            {error && <span role="alert" className="text-xs font-medium text-red-600">{error}</span>}
            {editing && <Editor plan={plan} subscribers={subscribers} razorpayReady={razorpayReady} effectiveRazorpayId={effectiveRazorpayId} onClose={() => setEditing(false)} onSaved={setToast} />}
            {toast && <Toast message={toast} setMessage={setToast} />}
        </div>
    );
}
