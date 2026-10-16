'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, Check, Cloud, Copy, Download, ExternalLink, Link2, Loader2, Mail, RotateCcw, Sparkles, X } from 'lucide-react';
import { uploadVideo } from '@/lib/videos/upload';
import { copyEmailSnippet, shareUrlFor } from '@/lib/videos/shareClipboard';
import { formatClock } from '@/lib/videos/types';
import { track } from '@/lib/analytics';

// One guided flow for exporting: choose where the video goes, watch a single
// progress view (render, upload, link), and finish on a screen with the share link.
// Used by the video editor and the reel studio.

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const PREF_KEY = 'cliprame-export-destinations';

export interface RenderResult {
    blob: Blob;
    extension: string;
}

interface Props {
    open: boolean;
    kind: 'video' | 'reel';
    defaultTitle: string;
    durationMs: number;
    /** Small facts shown as chips, e.g. "16:9", "Free plan". */
    facts: string[];
    /** Optional quality/format controls (editor only). */
    settings?: ReactNode;
    notice?: string | null;
    /** Renders the video. Should not download it; the dialog does that. */
    render: (options: { forCloud: boolean }) => Promise<RenderResult>;
    /** Live progress of the render, 0–100, and what it's doing. */
    renderProgress: number;
    renderLabel: string;
    onCancelRender?: () => void;
    onClose: () => void;
}

type Phase = 'setup' | 'working' | 'done' | 'error';
type Step = 'render' | 'upload' | 'link';
interface CloudStatus { ready: boolean; reason?: string }

const safeFileName = (title: string) => (title.trim() || 'cliprame-video').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'cliprame-video';

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function readPrefs(): { share: boolean; download: boolean } {
    try {
        const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null') as { share?: boolean; download?: boolean } | null;
        if (saved && (saved.share || saved.download)) return { share: Boolean(saved.share), download: Boolean(saved.download) };
    } catch { /* first export */ }
    return { share: true, download: false };
}

export function ExportDialog(props: Props) {
    if (!props.open) return null;
    return <ExportDialogBody {...props} />;
}

function ExportDialogBody({ kind, defaultTitle, durationMs, facts, settings, notice, render, renderProgress, renderLabel, onCancelRender, onClose }: Props) {
    const [phase, setPhase] = useState<Phase>('setup');
    const [step, setStep] = useState<Step>('render');
    const [title, setTitle] = useState(defaultTitle);
    const [destinations, setDestinations] = useState(readPrefs);
    const [cloud, setCloud] = useState<CloudStatus | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ blob: Blob; fileName: string; videoId?: string; slug?: string | null } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [stepStartedAt, setStepStartedAt] = useState(0);
    const [now, setNow] = useState(0);
    const noun = kind === 'reel' ? 'reel' : 'video';

    // Can "Share link" work? Checked once when the dialog opens.
    useEffect(() => {
        let cancelled = false;
        fetch('/api/videos/status', { cache: 'no-store' })
            .then((response) => response.json() as Promise<CloudStatus>)
            .then((status) => { if (!cancelled) setCloud(status); })
            .catch(() => { if (!cancelled) setCloud({ ready: false, reason: 'Couldn’t reach Cliprame to check cloud saving.' }); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (phase !== 'working') return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [phase]);

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && phase !== 'working') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [phase, onClose]);

    const shareOn = destinations.share && Boolean(cloud?.ready);
    const downloadOn = destinations.download || !shareOn;

    const toggle = (key: 'share' | 'download') => {
        setDestinations((current) => {
            const next = { ...current, [key]: !current[key] };
            if (!next.share && !next.download) return current; // keep at least one
            try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* not important */ }
            return next;
        });
    };

    const beginStep = (next: Step) => {
        const time = Date.now();
        setStepStartedAt(time);
        setNow(time);
        setStep(next);
    };

    const upload = async (blob: Blob, fileName: string) => {
        beginStep('upload');
        setUploadProgress(0);
        const controller = new AbortController();
        abortRef.current = controller;
        const { video, slug } = await uploadVideo(blob, title.trim() || `Untitled ${noun}`, {
            signal: controller.signal,
            onStage: (stage) => { if (stage === 'finishing') beginStep('link'); },
            onProgress: (progress) => setUploadProgress(progress),
        });
        setResult({ blob, fileName, videoId: video.id, slug });
    };

    const start = async () => {
        setError('');
        setPhase('working');
        beginStep('render');
        let rendered: RenderResult | null = null;
        try {
            rendered = await render({ forCloud: shareOn });
            const fileName = `${safeFileName(title)}.${rendered.extension}`;
            setPreviewUrl(URL.createObjectURL(rendered.blob));
            setResult({ blob: rendered.blob, fileName });
            if (downloadOn) download(rendered.blob, fileName);
            if (shareOn) await upload(rendered.blob, fileName);
            track('export_completed', { kind, shared: shareOn, downloaded: downloadOn });
            if (shareOn) track('video_shared', { kind });
            setPhase('done');
        } catch (cause) {
            const message = (cause as Error).message || `The ${noun} couldn’t be exported.`;
            if ((cause as Error).name === 'AbortError' || /cancel/i.test(message)) {
                // Cancelled during upload: the file is ready, so offer to retry or download.
                setPhase(rendered ? 'error' : 'setup');
                if (rendered) setError('Upload cancelled. Your file is still ready.');
                return;
            }
            setError(message);
            setPhase('error');
        }
    };

    const retryUpload = async () => {
        if (!result) return start();
        setError('');
        setPhase('working');
        try {
            await upload(result.blob, result.fileName);
            setPhase('done');
        } catch (cause) {
            setError((cause as Error).message);
            setPhase('error');
        }
    };

    const flash = (key: string) => {
        setCopied(key);
        window.setTimeout(() => setCopied((value) => (value === key ? null : value)), 1800);
    };

    // One number for the whole job: rendering is most of the work, uploading the rest.
    const overall = useMemo(() => {
        const renderShare = shareOn ? 0.7 : 1;
        if (step === 'render') return (renderProgress / 100) * renderShare;
        if (step === 'upload') return renderShare + uploadProgress * (1 - renderShare) * 0.95;
        return 0.98;
    }, [step, renderProgress, uploadProgress, shareOn]);

    const stepProgress = step === 'render' ? renderProgress / 100 : step === 'upload' ? uploadProgress : 0.9;
    const elapsed = Math.max(0, now - stepStartedAt) / 1000;
    const secondsLeft = stepProgress > 0.08 && elapsed > 3 ? Math.round((elapsed / stepProgress) * (1 - stepProgress)) : null;

    const steps: Array<{ id: Step; label: string; detail: string }> = [
        { id: 'render', label: `Rendering your ${noun}`, detail: renderLabel || 'Applying your edits frame by frame' },
        ...(shareOn ? [
            { id: 'upload' as const, label: 'Uploading to the cloud', detail: 'Securely, straight to your storage' },
            { id: 'link' as const, label: 'Creating your share link', detail: 'With chapters and analytics' },
        ] : []),
    ];
    const order: Step[] = steps.map((item) => item.id);

    const cta = shareOn && downloadOn ? 'Export, download & get link' : shareOn ? 'Export & get link' : 'Export & download';

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#14121F]/35 p-0 backdrop-blur-md sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && phase !== 'working') onClose(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="export-title" className="relative max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] border border-white/70 bg-white text-[#14121F] shadow-[0_40px_120px_-30px_rgba(20,18,31,0.55)] sm:rounded-[28px]">
                {/* Soft brand glow */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_15%_0%,rgba(106,76,255,0.14),transparent_70%),radial-gradient(50%_90%_at_95%_0%,rgba(255,61,129,0.10),transparent_70%)]" />

                <header className="relative flex items-start justify-between gap-4 px-6 pb-2 pt-6">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6A4CFF,#8B5CF6_55%,#FF3D81)] text-white shadow-[0_10px_24px_-10px_rgba(106,76,255,0.9)]">
                            {phase === 'done' ? <Check className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                        </span>
                        <div>
                            <h2 id="export-title" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
                                {phase === 'done' ? (result?.slug ? 'Your link is ready' : `Your ${noun} is ready`) : phase === 'error' ? 'Something went wrong' : phase === 'working' ? `Exporting your ${noun}` : `Export ${noun}`}
                            </h2>
                            <p className="text-xs text-[#14121F]/55">{formatClock(durationMs)} · {facts.join(' · ')}</p>
                        </div>
                    </div>
                    {phase !== 'working' && (
                        <button type="button" onClick={onClose} aria-label="Close" className={`rounded-full p-2 text-[#14121F]/40 transition hover:bg-[#14121F]/5 hover:text-[#14121F] ${focus}`}><X className="h-4 w-4" /></button>
                    )}
                </header>

                {/* ------------------------------ setup ------------------------------ */}
                {phase === 'setup' && (
                    <div className="relative space-y-5 px-6 pb-6 pt-3">
                        <label className="block">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/45">Name</span>
                            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className="mt-1.5 w-full rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] px-4 py-3 text-[15px] font-semibold outline-none transition focus:border-[#6A4CFF] focus:bg-white focus:ring-4 focus:ring-[#6A4CFF]/10" />
                        </label>

                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#14121F]/45">Where should it go?</p>
                            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                                <DestinationCard
                                    selected={shareOn}
                                    disabled={cloud !== null && !cloud.ready}
                                    loading={cloud === null}
                                    icon={<Link2 className="h-4 w-4" />}
                                    title="Share link"
                                    badge="Recommended"
                                    text={cloud && !cloud.ready ? cloud.reason ?? 'Unavailable' : 'Saved to the cloud with a link, chapters and viewer analytics.'}
                                    onClick={() => toggle('share')}
                                />
                                <DestinationCard
                                    selected={downloadOn}
                                    icon={<Download className="h-4 w-4" />}
                                    title="Download"
                                    text="Save the file to this device."
                                    onClick={() => toggle('download')}
                                />
                            </div>
                        </div>

                        {settings && <div className="rounded-2xl border border-[#14121F]/8 p-3.5">{settings}</div>}
                        {shareOn && <p className="-mt-2 text-[11px] text-[#14121F]/45">Shared {noun}s are saved as MP4 so they play on every device.</p>}
                        {notice && <p className="rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">{notice}</p>}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-3 text-sm font-semibold text-[#14121F]/60 transition hover:bg-[#F7F6FB] hover:text-[#14121F] ${focus}`}>Cancel</button>
                            <button type="button" onClick={() => void start()} disabled={cloud === null && destinations.share && !destinations.download} className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6A4CFF,#7C5CFF)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_-12px_rgba(106,76,255,0.9)] transition hover:brightness-110 disabled:opacity-50 ${focus}`}>
                                {shareOn ? <Cloud className="h-4 w-4" /> : <Download className="h-4 w-4" />} {cta}
                            </button>
                        </div>
                    </div>
                )}

                {/* ----------------------------- working ----------------------------- */}
                {phase === 'working' && (
                    <div className="relative px-6 pb-6 pt-4" aria-live="polite">
                        <div className="flex flex-col items-center">
                            <ProgressRing value={overall} />
                            <p className="mt-3 text-sm font-semibold">{steps.find((item) => item.id === step)?.label ?? 'Working…'}</p>
                            <p className="mt-0.5 text-xs text-[#14121F]/50">{secondsLeft !== null ? `About ${secondsLeft < 60 ? `${Math.max(1, secondsLeft)} sec` : `${Math.ceil(secondsLeft / 60)} min`} left` : 'Getting started…'}</p>
                        </div>

                        <ol className="mt-6 space-y-1.5">
                            {steps.map((item) => {
                                const index = order.indexOf(item.id);
                                const current = order.indexOf(step);
                                const state = index < current ? 'done' : index === current ? 'active' : 'pending';
                                return (
                                    <li key={item.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${state === 'active' ? 'bg-[#6A4CFF]/[0.06]' : ''}`}>
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-white text-[#6A4CFF] ring-2 ring-[#6A4CFF]/30' : 'bg-[#14121F]/[0.05] text-[#14121F]/30'}`}>
                                            {state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-sm font-semibold ${state === 'pending' ? 'text-[#14121F]/40' : ''}`}>{item.label}</span>
                                            <span className="block truncate text-xs text-[#14121F]/50">{item.detail}</span>
                                        </span>
                                        {state === 'active' && item.id !== 'link' && <span className="text-xs font-bold tabular-nums text-[#6A4CFF]">{Math.round(stepProgress * 100)}%</span>}
                                    </li>
                                );
                            })}
                        </ol>

                        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#F7F6FB] px-4 py-3">
                            <p className="text-xs leading-relaxed text-[#14121F]/55">{step === 'render' ? 'Keep this tab open and visible while it renders.' : 'You can keep working. Just don’t close this tab.'}</p>
                            {(step === 'upload' || (step === 'render' && onCancelRender)) && (
                                <button type="button" onClick={() => (step === 'upload' ? abortRef.current?.abort() : onCancelRender?.())} className={`shrink-0 rounded-full border border-[#14121F]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#14121F]/70 transition hover:border-[#14121F]/30 ${focus}`}>Cancel</button>
                            )}
                        </div>
                    </div>
                )}

                {/* ------------------------------- done ------------------------------ */}
                {phase === 'done' && result && (
                    <div className="relative space-y-4 px-6 pb-6 pt-3">
                        {previewUrl && (
                            <div className="overflow-hidden rounded-2xl bg-[#0B0A10] ring-1 ring-[#14121F]/10">
                                <video src={previewUrl} controls playsInline preload="metadata" className="max-h-64 w-full" />
                            </div>
                        )}

                        {result.slug ? (
                            <>
                                <div className="flex items-center gap-2 rounded-2xl border border-[#6A4CFF]/25 bg-[#6A4CFF]/[0.04] p-1.5 pl-4">
                                    <Link2 className="h-4 w-4 shrink-0 text-[#6A4CFF]" />
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#14121F]/75">{shareUrlFor(result.slug)}</span>
                                    <button type="button" onClick={async () => { await navigator.clipboard.writeText(shareUrlFor(result.slug as string)); flash('link'); }} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#6A4CFF] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#5839e0] ${focus}`}>
                                        {copied === 'link' ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
                                    </button>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <ActionButton onClick={async () => { await copyEmailSnippet({ slug: result.slug as string, title: title.trim() || `Untitled ${noun}`, durationMs }); flash('email'); }} icon={copied === 'email' ? <Check className="h-4 w-4" /> : <Mail className="h-4 w-4" />} label={copied === 'email' ? 'Copied' : 'Copy for email'} />
                                    <ActionLink href={`/v/${result.slug}`} icon={<ExternalLink className="h-4 w-4" />} label="Open share page" />
                                    <ActionLink href={`/studio/videos/${result.videoId}`} icon={<BarChart3 className="h-4 w-4" />} label="Analytics" />
                                </div>
                            </>
                        ) : null}

                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F6FB] px-4 py-3">
                            <p className="min-w-0 truncate text-xs text-[#14121F]/60">
                                {downloadOn ? <>Downloaded as <span className="font-semibold text-[#14121F]">{result.fileName}</span></> : 'Not downloaded to this device.'}
                            </p>
                            <button type="button" onClick={() => download(result.blob, result.fileName)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#14121F]/12 bg-white px-3 py-1.5 text-xs font-semibold text-[#14121F]/70 transition hover:border-[#14121F]/30 ${focus}`}>
                                <Download className="h-3.5 w-3.5" /> {downloadOn ? 'Download again' : 'Download'}
                            </button>
                        </div>

                        <button type="button" onClick={onClose} className={`w-full rounded-2xl bg-[#14121F] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#2c2742] ${focus}`}>Done</button>
                    </div>
                )}

                {/* ------------------------------ error ------------------------------ */}
                {phase === 'error' && (
                    <div className="relative space-y-4 px-6 pb-6 pt-3">
                        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700">{error}</p>
                        {result && <p className="text-xs text-[#14121F]/55">Your {noun} rendered fine, so trying again only repeats the upload.</p>}
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            {result && (
                                <button type="button" onClick={() => { download(result.blob, result.fileName); onClose(); }} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[#14121F]/70 transition hover:bg-[#F7F6FB] ${focus}`}><Download className="h-4 w-4" /> Download instead</button>
                            )}
                            <button type="button" onClick={() => void (result ? retryUpload() : start())} className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[#14121F] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2c2742] ${focus}`}><RotateCcw className="h-4 w-4" /> Try again</button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

function DestinationCard({ selected, disabled = false, loading = false, icon, title, badge, text, onClick }: { selected: boolean; disabled?: boolean; loading?: boolean; icon: ReactNode; title: string; badge?: string; text: string; onClick: () => void }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            disabled={disabled || loading}
            onClick={onClick}
            className={`relative flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.05] shadow-[0_0_0_4px_rgba(106,76,255,0.10)]' : 'border-[#14121F]/10 hover:border-[#14121F]/25'} disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}>
            <span className="flex w-full items-center justify-between gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${selected ? 'bg-[#6A4CFF] text-white' : 'bg-[#14121F]/[0.05] text-[#14121F]/60'}`}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF] text-white' : 'border-[#14121F]/20 bg-white'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
            </span>
            <span className="flex items-center gap-2 text-sm font-bold">{title}{badge && !disabled && <span className="rounded-full bg-[#FF3D81]/10 px-2 py-0.5 text-[10px] font-bold text-[#E11D6B]">{badge}</span>}</span>
            <span className="text-xs leading-relaxed text-[#14121F]/55">{text}</span>
        </button>
    );
}

function ProgressRing({ value }: { value: number }) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(1, Math.max(0, value));
    return (
        <div className="relative h-36 w-36" role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                <circle cx="64" cy="64" r={radius} fill="none" stroke="#14121F" strokeOpacity="0.06" strokeWidth="10" />
                <circle cx="64" cy="64" r={radius} fill="none" stroke="#6A4CFF" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)} className="transition-[stroke-dashoffset] duration-500 ease-out" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">{Math.round(clamped * 100)}<span className="text-base text-[#14121F]/40">%</span></span>
        </div>
    );
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
    return (
        <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[#14121F]/10 bg-white px-3 py-3 text-xs font-semibold text-[#14121F]/75 transition hover:border-[#6A4CFF]/40 hover:text-[#6A4CFF] ${focus}`}>{icon}{label}</button>
    );
}

function ActionLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
    return (
        <Link href={href} target="_blank" className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[#14121F]/10 bg-white px-3 py-3 text-xs font-semibold text-[#14121F]/75 transition hover:border-[#6A4CFF]/40 hover:text-[#6A4CFF] ${focus}`}>{icon}{label}</Link>
    );
}
