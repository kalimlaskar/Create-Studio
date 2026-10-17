'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Eye, LoaderCircle, RotateCcw, ShieldOff, Trash2, X } from 'lucide-react';
import { banUserAction, dismissReportAction, restoreVideoAction, reviewReportedVideoAction, takeDownVideoAction, unbanUserAction } from '@/app/admin/actions';

const small = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70';

/** A button that asks for a reason and a second click before doing something serious. */
function Confirmed({ label, icon: Icon, tone, placeholder, onConfirm }: { label: string; icon: typeof Ban; tone: 'danger' | 'neutral'; placeholder?: string; onConfirm: (reason: string) => Promise<{ error?: string }> }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [pending, start] = useTransition();
    const color = tone === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#14121F] text-white hover:bg-[#2c2742]';

    if (!open) {
        return <button type="button" onClick={() => setOpen(true)} className={`${small} ${tone === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-[#14121F]/65 hover:bg-[#14121F]/[0.05]'}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
    }
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {placeholder !== undefined && (
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={placeholder} maxLength={300} autoFocus className="w-56 rounded-lg border border-[#14121F]/15 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#6A4CFF]" />
            )}
            <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                    const result = await onConfirm(reason);
                    if (result.error) setError(result.error);
                    else { setOpen(false); setReason(''); router.refresh(); }
                })}
                className={`${small} ${color}`}
            >
                {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}Confirm
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(''); }} className={`${small} text-[#14121F]/50 hover:text-[#14121F]`}>Cancel</button>
            {error && <span role="alert" className="text-xs font-medium text-red-600">{error}</span>}
        </div>
    );
}

export function BanUserButton({ userId, banned }: { userId: string; banned: boolean }) {
    return banned
        ? <Confirmed label="Lift ban" icon={ShieldOff} tone="neutral" onConfirm={() => unbanUserAction(userId)} />
        : <Confirmed label="Ban" icon={Ban} tone="danger" placeholder="Reason (shown in the audit log)" onConfirm={(reason) => banUserAction(userId, reason)} />;
}

export function VideoTakedownButton({ videoId, removed }: { videoId: string; removed: boolean }) {
    return removed
        ? <Confirmed label="Restore video" icon={RotateCcw} tone="neutral" onConfirm={() => restoreVideoAction(videoId)} />
        : <Confirmed label="Take down video" icon={Trash2} tone="danger" placeholder="Reason, e.g. nudity" onConfirm={(reason) => takeDownVideoAction(videoId, reason)} />;
}

export function DismissReportButton({ reportId }: { reportId: string }) {
    return <Confirmed label="Dismiss" icon={X} tone="neutral" placeholder="Why (optional)" onConfirm={(note) => dismissReportAction(reportId, note)} />;
}

/** Opens a reported video in a short-lived player. Every opening is written to the audit log. */
export function ReviewVideoButton({ reportId }: { reportId: string }) {
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [pending, start] = useTransition();

    return (
        <>
            <button type="button" disabled={pending} onClick={() => start(async () => { const result = await reviewReportedVideoAction(reportId); if (result.url) setUrl(result.url); else setError(result.error ?? 'Could not open it.'); })} className={`${small} bg-[#6A4CFF]/10 text-[#4B30D9] hover:bg-[#6A4CFF]/15`}>
                {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}Review video
            </button>
            {error && <span role="alert" className="text-xs font-medium text-red-600">{error}</span>}
            {url && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14121F]/85 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setUrl(null); }}>
                    <div role="dialog" aria-modal="true" aria-label="Reported video" className="w-full max-w-4xl overflow-hidden rounded-2xl bg-black">
                        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-white/60">
                            <span>Reviewing a reported video. This viewing is logged.</span>
                            <button type="button" onClick={() => setUrl(null)} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                        <video src={url} controls autoPlay playsInline className="aspect-video w-full" />
                    </div>
                </div>
            )}
        </>
    );
}
