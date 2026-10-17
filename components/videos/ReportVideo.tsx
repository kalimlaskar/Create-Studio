'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Flag, LoaderCircle, X } from 'lucide-react';
import { REPORT_REASONS } from '@/lib/admin/emails';

// "Report this video" on share pages: anyone can tell us about harmful content.

export function ReportVideo({ slug }: { slug: string }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [email, setEmail] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, reason, details, email, website: honeypot }) });
            const data = await response.json().catch(() => ({})) as { error?: string };
            if (!response.ok) throw new Error(data.error ?? 'Could not send your report.');
            setSent(true);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const urgent = REPORT_REASONS.find((item) => item.id === reason)?.urgent;

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 font-semibold text-[#14121F]/60 hover:underline">
                <Flag className="h-3 w-3" /> Report this video
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#14121F]/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="animate-dialog-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 text-[#14121F] shadow-2xl sm:rounded-3xl">
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="report-title" className="text-lg font-semibold">{sent ? 'Thanks for telling us' : 'Report this video'}</h2>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-[#14121F]/45 hover:bg-[#14121F]/[0.06] hover:text-[#14121F]"><X className="h-4 w-4" /></button>
                        </div>

                        {sent ? (
                            <div className="mt-3">
                                <p className="flex items-start gap-2 text-sm leading-6 text-[#14121F]/70"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Our team will review it{urgent ? ' as a priority' : ''}. If it breaks our rules, we’ll take it down and may suspend the account.{email ? ' We’ll email you if we need anything else.' : ''}</p>
                                <button type="button" onClick={() => setOpen(false)} className="mt-5 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white">Close</button>
                            </div>
                        ) : (
                            <form onSubmit={submit} className="mt-4 space-y-4">
                                <fieldset>
                                    <legend className="text-xs font-semibold text-[#14121F]/60">What’s wrong with it?</legend>
                                    <div className="mt-2 space-y-1.5">
                                        {REPORT_REASONS.map((item) => (
                                            <label key={item.id} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${reason === item.id ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.05]' : 'border-[#14121F]/10 hover:border-[#14121F]/25'}`}>
                                                <input type="radio" name="reason" value={item.id} checked={reason === item.id} onChange={() => setReason(item.id)} className="mt-0.5 accent-[#6A4CFF]" required />
                                                {item.label}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                                {urgent && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800">We treat this as urgent and review it as fast as we can. If someone is in immediate danger, contact your local police.</p>}
                                <label className="block">
                                    <span className="text-xs font-semibold text-[#14121F]/60">Anything that helps us (optional)</span>
                                    <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} maxLength={1000} placeholder="For example, the moment in the video, or how you’re connected to it" className="mt-1.5 w-full resize-y rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3 py-2 text-sm outline-none focus:border-[#6A4CFF] focus:bg-white" />
                                </label>
                                <label className="block">
                                    <span className="text-xs font-semibold text-[#14121F]/60">Your email, if we can contact you (optional)</span>
                                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-[#14121F]/12 bg-[#F7F6FB] px-3 py-2 text-sm outline-none focus:border-[#6A4CFF] focus:bg-white" />
                                </label>
                                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
                                {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
                                <div className="flex items-center gap-3">
                                    <button type="submit" disabled={busy || !reason} className="inline-flex items-center gap-2 rounded-xl bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send report</button>
                                    <p className="text-xs text-[#14121F]/45">The sender isn’t told who reported it.</p>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
