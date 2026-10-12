'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, MonitorUp, TriangleAlert, X } from 'lucide-react';

/* Capture panel for the recording studio (top-left of the canvas).
   Purely presentational: all state and handlers stay in CreatorStudioDashboard. */

type ScreenShareControlsProps = {
    isSharing: boolean;
    isRecording: boolean;
    countdown: number | null;
    /** 'Browser window' | 'Chrome tab' | 'Entire screen' | 'Unknown capture source' | null */
    surface: string | null;
    isTrackPaused: boolean;
    framesReceived: number;
    wasBackgrounded: boolean;
    floatingEnabled: boolean;
    pipSupported: boolean;
    pipOpen: boolean;
    pipError?: string | null;
    shareError?: string | null;
    showCamera: boolean;
    onToggleShare: () => void;
    onFloatingChange: (enabled: boolean) => void;
    onShowCameraChange: (show: boolean) => void;
    onOpenPip: () => void;
};

const ring =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A85FF] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950';

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (next: boolean) => void; label: string; hint: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] ${ring}`}
        >
            <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-5 text-white">{label}</span>
                <span className="block text-[11px] leading-4 text-white/50">{hint}</span>
            </span>
            <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#6A4CFF]' : 'bg-white/20'}`}>
                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
            </span>
        </button>
    );
}

function Alert({ tone, children }: { tone: 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
    const styles = {
        warn: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
        error: 'border-red-400/30 bg-red-500/10 text-red-200',
        ok: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    }[tone];
    return (
        <p role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-xl border px-3 py-2 text-[11px] leading-4 ${styles}`}>
            {tone !== 'ok' && <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span>{children}</span>
        </p>
    );
}

const pickerTips = [
    { ok: true, name: 'Window', note: 'Recommended. Every tab in that window is recorded.' },
    { ok: false, name: 'Chrome tab', note: 'Records one tab only.' },
    { ok: false, name: 'Entire screen', note: 'Would record the floating camera too.' },
];

export function ScreenShareControls({
    isSharing,
    isRecording,
    countdown,
    surface,
    isTrackPaused,
    framesReceived,
    wasBackgrounded,
    floatingEnabled,
    pipSupported,
    pipOpen,
    pipError,
    shareError,
    showCamera,
    onToggleShare,
    onFloatingChange,
    onShowCameraChange,
    onOpenPip,
}: ScreenShareControlsProps) {
    const [collapsed, setCollapsed] = useState(false);

    // Get out of the way of the video once recording starts.
    useEffect(() => {
        if (isRecording) setCollapsed(true);
    }, [isRecording]);

    const entireScreen = surface === 'Entire screen';
    const buttonLabel = isSharing ? (isRecording ? 'Stop recording' : 'Stop sharing') : 'Share screen';

    return (
        <section
            aria-label="Screen capture"
            className="absolute left-4 top-3 z-30 hidden w-[18rem] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/75 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:block"
        >
            {/* header */}
            <div className="flex items-center gap-2.5 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#6A4CFF]/20 text-[#B9A9FF]">
                    <MonitorUp className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-4">Screen capture</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-white/55">
                        {isSharing ? (
                            <>
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                                <span className="truncate">Live · {surface ?? 'checking source…'}{isTrackPaused ? ' · paused' : ''}</span>
                            </>
                        ) : (
                            'Not sharing'
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setCollapsed((value) => !value)}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? 'Expand screen capture panel' : 'Collapse screen capture panel'}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white ${ring}`}
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                </button>
            </div>

            {!collapsed && (
                <div className="space-y-3 border-t border-white/10 p-3">
                    {/* primary action */}
                    <button
                        type="button"
                        onClick={onToggleShare}
                        disabled={countdown !== null}
                        aria-pressed={isSharing}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${ring} ${isSharing
                                ? 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15'
                                : 'bg-[#6A4CFF] text-white shadow-[0_10px_28px_-10px_rgba(106,76,255,0.9)] hover:bg-[#5839e0]'
                            }`}
                    >
                        <MonitorUp className="h-4 w-4" aria-hidden="true" />
                        {buttonLabel}
                    </button>

                    {/* options */}
                    <div className="space-y-0.5">
                        <Switch checked={floatingEnabled} onChange={onFloatingChange} label="Floating camera & teleprompter" hint="Stays outside the recording" />
                        <Switch checked={showCamera} onChange={onShowCameraChange} label="Show my camera in the video" hint="Adds your camera card to the recording" />
                    </div>

                    {/* before sharing: what to pick */}
                    {!isSharing && (
                        <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">In Chrome’s picker, choose</p>
                            <ul className="mt-2 space-y-2">
                                {pickerTips.map((tip) => (
                                    <li key={tip.name} className="flex items-start gap-2.5">
                                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${tip.ok ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-white/45'}`}>
                                            {tip.ok ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : <X className="h-2.5 w-2.5" aria-hidden="true" />}
                                        </span>
                                        <span className="text-[12px] leading-4 text-white/60">
                                            <strong className={`font-semibold ${tip.ok ? 'text-white' : 'text-white/80'}`}>{tip.name}</strong>
                                            <span className="block text-[11px] text-white/45">{tip.note}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* while sharing: status + gentle warnings */}
                    {isSharing && (
                        <div className="space-y-2">
                            <p className="text-[11px] leading-4 text-white/50">Keep Cliprame open in this tab and browse in the shared window.</p>
                            {wasBackgrounded && <Alert tone="ok">Studio is in another tab. The screen recording keeps going.</Alert>}
                            {entireScreen && floatingEnabled && (
                                <Alert tone="warn">Entire screen would show the floating camera, so it was closed. Pick Window to keep it.</Alert>
                            )}
                            {floatingEnabled && !entireScreen && pipSupported && !pipOpen && (
                                <button
                                    type="button"
                                    onClick={onOpenPip}
                                    className={`w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/10 ${ring}`}
                                >
                                    Show floating camera
                                </button>
                            )}
                            <details className="group rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                                <summary className={`flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-[11px] font-semibold text-white/60 hover:text-white ${ring}`}>
                                    Capture check
                                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                                </summary>
                                <div className="space-y-1.5 px-3 pb-3 text-[11px] leading-4 text-white/55">
                                    <p>
                                        Screen changes detected: <strong className="font-semibold text-white">{framesReceived}</strong>
                                    </p>
                                    <p>Switch to the page you want to record for a few seconds. The count should go up when the picture changes. If it stays at 1, Chrome isn’t sending the new page from this source.</p>
                                </div>
                            </details>
                        </div>
                    )}

                    {pipError && <Alert tone="error">{pipError}</Alert>}
                    {shareError && <Alert tone="error">{shareError}</Alert>}
                </div>
            )}
        </section>
    );
}