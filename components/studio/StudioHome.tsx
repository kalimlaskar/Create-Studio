'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { ArrowRight, Check, FolderOpen, Images, LoaderCircle, MonitorUp, Sparkles, Trash2, Upload, UserRound, Video, X, Zap } from 'lucide-react';
import type { DraftSummary } from '@/components/editor/drafts';
import { deletePhotoReelDraft, listPhotoReelDrafts, PhotoReelDraftSummary } from './photoReelDrafts';
import { MobileTabBar, StudioSidebar, type CreateId, type SidebarAccount } from '@/components/videos/StudioSidebar';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const D = 'font-[family-name:var(--font-display)]';
const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6A4CFF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F6FB]';
const GUIDE_HIDDEN_KEY = 'cliprame-home-guide-hidden';

type StepId = 'video' | 'reel' | 'profile' | 'plans';
interface StudioHomeProps {
    creatorName: string;
    avatarUrl: string;
    username: string;
    userPlan: string;
    isPro: boolean;
    showUpgrade: boolean;
    videoDrafts: DraftSummary[];
    isLoadingDraft: boolean;
    profileMenu: React.ReactNode;
    notice?: string;
    onDismissNotice?: () => void;
    onRecord: () => void;
    onUpload: (file: File) => void;
    onReel: (draftId?: string) => void;
    onOpenVideoDraft: (id: string) => void;
    onDeleteVideoDraft: (id: string) => void;
    onEditProfile: () => void;
    /** The shared studio sidebar's account and collapsed state, loaded on the server. */
    sidebar?: { account: SidebarAccount | null; collapsed: boolean };
}

interface Project {
    id: string;
    kind: 'video' | 'reel';
    title: string;
    savedAt: number;
    meta: string;
}

const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
};

const formatDate = (time: number) => new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function StudioHome({
    creatorName, avatarUrl, username, userPlan, isPro, showUpgrade, videoDrafts, isLoadingDraft, profileMenu, notice, onDismissNotice,
    onRecord, onUpload, onReel, onOpenVideoDraft, onDeleteVideoDraft, onEditProfile, sidebar,
}: StudioHomeProps) {
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [reelDrafts, setReelDrafts] = useState<PhotoReelDraftSummary[]>([]);
    const [uploadPrompt, setUploadPrompt] = useState(false);
    const [guideHidden, setGuideHidden] = useState(true);
    const [selectedStep, setSelectedStep] = useState<StepId | null>(null);

    useEffect(() => {
        let cancelled = false;
        listPhotoReelDrafts()
            .then((drafts) => { if (!cancelled) setReelDrafts(drafts); })
            .catch((error) => console.error('Could not load reel drafts:', error));
        const frame = window.requestAnimationFrame(() => {
            try { setGuideHidden(window.localStorage.getItem(GUIDE_HIDDEN_KEY) === '1'); } catch { setGuideHidden(false); }
        });
        return () => { cancelled = true; window.cancelAnimationFrame(frame); };
    }, []);

    const firstName = creatorName.trim().split(/\s+/)[0] || 'creator';
    const initial = creatorName.trim().charAt(0).toUpperCase() || 'C';

    const steps = useMemo(() => [
        {
            id: 'video' as const, label: 'Make your first video', done: videoDrafts.length > 0,
            title: 'Record or upload your first video',
            text: 'Record with your camera, share your screen with a floating camera bubble, or upload a clip. Then trim it, add captions and save it as a project.',
            cta: 'Open recording studio', action: onRecord, tone: 'violet' as const,
        },
        {
            id: 'reel' as const, label: 'Turn photos into a reel', done: reelDrafts.length > 0,
            title: 'Turn your photos into a reel',
            text: 'Drop in photos and short clips, pick a template, and add music, captions and an AI voiceover. Save it to come back later.',
            cta: 'Make a reel', action: () => onReel(), tone: 'pink' as const,
        },
        {
            id: 'profile' as const, label: 'Add a profile photo and username', done: Boolean(avatarUrl && username),
            title: 'Make the studio yours',
            text: 'Add a profile photo and pick a username. Your name appears on the projects you save.',
            cta: 'Edit profile', action: onEditProfile, tone: 'violet' as const,
        },
        {
            id: 'plans' as const, label: 'Explore plans', done: isPro,
            title: 'Longer videos, no watermark',
            text: 'Creator and Studio plans export up to 5 or 15 minutes without a watermark, with more minutes of captions and AI voiceover each month.',
            cta: 'Explore plans', href: '/pricing', tone: 'pink' as const,
        },
    ], [videoDrafts.length, reelDrafts.length, avatarUrl, username, isPro, onRecord, onReel, onEditProfile]);

    const doneCount = steps.filter((step) => step.done).length;
    const progress = Math.round((doneCount / steps.length) * 100);
    const activeStep = steps.find((step) => step.id === selectedStep) ?? steps.find((step) => !step.done) ?? steps[0];

    const projects: Project[] = useMemo(() => [
        ...videoDrafts.map((draft) => ({ id: draft.id, kind: 'video' as const, title: draft.title || 'Untitled video', savedAt: draft.savedAt, meta: `Video · ${formatDuration(draft.durationMs)}` })),
        ...reelDrafts.map((draft) => ({ id: draft.id, kind: 'reel' as const, title: draft.title || 'Untitled reel', savedAt: draft.savedAt, meta: `Reel · ${draft.clipCount} ${draft.clipCount === 1 ? 'clip' : 'clips'}` })),
    ].sort((a, b) => b.savedAt - a.savedAt), [videoDrafts, reelDrafts]);

    const hideGuide = () => {
        setGuideHidden(true);
        try { window.localStorage.setItem(GUIDE_HIDDEN_KEY, '1'); } catch { /* the guide just reappears next visit */ }
    };

    const showGuide = () => {
        setGuideHidden(false);
        try { window.localStorage.removeItem(GUIDE_HIDDEN_KEY); } catch { /* nothing to clear */ }
    };

    const removeReelDraft = async (id: string) => {
        try {
            await deletePhotoReelDraft(id);
            setReelDrafts((drafts) => drafts.filter((draft) => draft.id !== id));
        } catch (error) {
            console.error('Could not delete reel draft:', error);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const create = params.get('create');
        const wantsProfile = params.get('profile') === '1';
        if (!create && !wantsProfile) return;
        params.delete('create');
        params.delete('profile');
        window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
        // A file picker can't open without a click on this page, so upload asks for one.
        if (create === 'record') onRecord();
        else if (create === 'reel') onReel();
        else if (create === 'upload') window.setTimeout(() => setUploadPrompt(true), 0);
        if (wantsProfile) onEditProfile();
        // Runs once, for the link that opened the page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The sidebar shows profile edits made on this page straight away.
    const sidebarAccount: SidebarAccount | null = sidebar?.account
        ? { ...sidebar.account, name: creatorName || sidebar.account.name, avatarUrl: avatarUrl || sidebar.account.avatarUrl, handle: username || sidebar.account.handle }
        : null;

    const runCreate = (id: CreateId) => {
        if (id === 'record') onRecord();
        else if (id === 'upload') uploadInputRef.current?.click();
        else onReel();
    };

    return (
        <main className={`${display.variable} ${body.variable} flex min-h-dvh bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] selection:bg-[#6A4CFF]/20`}>
            <input
                ref={uploadInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                aria-label="Upload a video"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) onUpload(file);
                }}
            />

            <StudioSidebar
                account={sidebarAccount}
                initialCollapsed={sidebar?.collapsed ?? false}
                onCreate={runCreate}
                onOpenProfile={onEditProfile}
                extraItems={[
                    { key: 'projects', label: 'Projects', icon: FolderOpen, href: '#projects' },
                    ...(guideHidden ? [{ key: 'guide', label: 'Getting started', icon: Sparkles, onClick: showGuide }] : []),
                ]}
            />

            {/* Main */}
            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#14121F]/8 bg-white/85 px-4 backdrop-blur-xl sm:px-8">
                    <Link href="/" aria-label="Cliprame home" className={`inline-flex items-center gap-2 rounded-full md:hidden ${focus}`}>
                        <Image src="/cliprame-icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
                        <span className={`${D} font-bold`}>Cliprame</span>
                    </Link>
                    <h1 className={`${D} hidden text-xl font-bold tracking-tight md:block`}>Home</h1>
                    {profileMenu}
                </header>

                <div className="mx-auto max-w-6xl space-y-10 px-4 pb-28 pt-8 sm:px-8 sm:pt-10 md:pb-10">
                    {uploadPrompt && (
                        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#6A4CFF]/25 bg-[#6A4CFF]/[0.06] px-4 py-3 text-sm">
                            <p className="font-medium">Choose the video you want to edit.</p>
                            <span className="flex items-center gap-2">
                                <button type="button" onClick={() => { setUploadPrompt(false); uploadInputRef.current?.click(); }} className={`rounded-full bg-[#6A4CFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#5839e0] ${focus}`}>Choose a video</button>
                                <button type="button" onClick={() => setUploadPrompt(false)} aria-label="Dismiss" className={`rounded-lg p-1 text-[#14121F]/50 hover:text-[#14121F] ${focus}`}><X className="h-4 w-4" /></button>
                            </span>
                        </div>
                    )}
                    {notice && (
                        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p>{notice}</p>
                            <button type="button" onClick={onDismissNotice} aria-label="Dismiss" className={`shrink-0 rounded-lg p-1 text-amber-900/60 hover:text-amber-900 ${focus}`}><X className="h-4 w-4" /></button>
                        </div>
                    )}
                    {/* Welcome */}
                    <section className="flex flex-wrap items-center justify-between gap-5">
                        <div className="flex min-w-0 items-center gap-4">
                            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#6A4CFF]/15 bg-cover bg-center text-2xl font-bold text-[#6A4CFF] ring-4 ring-white" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>{!avatarUrl && initial}</span>
                            <div className="min-w-0">
                                <h2 className={`${D} truncate text-2xl font-bold tracking-tight sm:text-3xl`}>Welcome back, {firstName}</h2>
                                <span className="mt-1.5 inline-flex rounded-full bg-[#14121F]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#14121F]/70">{userPlan} plan</span>
                            </div>
                        </div>
                        {showUpgrade && (
                            <Link href="/pricing" className={`inline-flex items-center gap-2 rounded-full border border-[#14121F]/15 bg-white px-4 py-2 text-sm font-semibold transition hover:border-[#6A4CFF]/50 hover:text-[#6A4CFF] ${focus}`}><Zap className="h-4 w-4" /> Explore plans</Link>
                        )}
                    </section>

                    {/* Create */}
                    <section aria-labelledby="create-title">
                        <h2 id="create-title" className={`${D} text-xl font-bold tracking-tight`}>Create something new</h2>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <button type="button" onClick={onRecord} className={`group rounded-3xl border border-[#14121F]/8 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#6A4CFF]/40 hover:shadow-[0_15px_40px_-20px_rgba(106,76,255,0.35)] ${focus}`}>
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6A4CFF]/10 text-[#6A4CFF]"><Video className="h-5 w-5" /></span>
                                <h3 className={`${D} mt-4 text-lg font-bold`}>Record a video</h3>
                                <p className="mt-1 text-sm leading-6 text-[#14121F]/60">Camera, teleprompter and screen sharing with a floating camera.</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6A4CFF]">Open studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                            </button>
                            <button type="button" onClick={() => runCreate('upload')} className={`group rounded-3xl border border-[#14121F]/8 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#6A4CFF]/40 hover:shadow-[0_15px_40px_-20px_rgba(106,76,255,0.35)] ${focus}`}>
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14121F]/[0.06] text-[#14121F]"><Upload className="h-5 w-5" /></span>
                                <h3 className={`${D} mt-4 text-lg font-bold`}>Upload a video</h3>
                                <p className="mt-1 text-sm leading-6 text-[#14121F]/60">Bring a clip you already have and edit it with captions and cuts.</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#14121F]">Choose a file <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                            </button>
                            <button type="button" onClick={() => onReel()} className={`group rounded-3xl border border-[#14121F]/8 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#FF3D81]/40 hover:shadow-[0_15px_40px_-20px_rgba(255,61,129,0.35)] ${focus}`}>
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF3D81]/10 text-[#FF3D81]"><Images className="h-5 w-5" /></span>
                                <h3 className={`${D} mt-4 text-lg font-bold`}>Photo + video reel</h3>
                                <p className="mt-1 text-sm leading-6 text-[#14121F]/60">Mix photos and clips with templates, music and AI voiceover.</p>
                                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF3D81]">Make a reel <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                            </button>
                        </div>
                    </section>

                    {/* Getting started */}
                    {!guideHidden && (
                        <section aria-labelledby="guide-title">
                            <div className="flex items-center justify-between gap-3">
                                <h2 id="guide-title" className={`${D} text-xl font-bold tracking-tight`}>Getting started</h2>
                                <button type="button" onClick={hideGuide} className={`rounded-full px-3 py-1.5 text-sm font-semibold text-[#6A4CFF] transition hover:bg-[#6A4CFF]/10 ${focus}`}>Hide</button>
                            </div>
                            <div className="mt-4 grid overflow-hidden rounded-3xl border border-[#14121F]/8 bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                                <div className="p-5 sm:p-6">
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-sm font-semibold">Cliprame basics</p>
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#14121F]/8" role="progressbar" aria-label="Getting started progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                                                <div className="h-full rounded-full bg-[#6A4CFF] transition-all" style={{ width: `${progress}%` }} />
                                            </div>
                                            <span className="text-xs font-semibold tabular-nums text-[#14121F]/60">{progress}%</span>
                                        </div>
                                    </div>
                                    <ol className="mt-5 space-y-2">
                                        {steps.map((step, index) => {
                                            const active = step.id === activeStep.id;
                                            return (
                                                <li key={step.id}>
                                                    <button
                                                        type="button"
                                                        aria-pressed={active}
                                                        onClick={() => setSelectedStep(step.id)}
                                                        className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left text-sm transition ${active ? 'border-[#6A4CFF] bg-[#6A4CFF]/[0.04]' : 'border-[#14121F]/8 hover:border-[#14121F]/20'} ${focus}`}>
                                                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.done ? 'bg-emerald-500/15 text-emerald-600' : 'border border-[#14121F]/20 text-[#14121F]/60'}`}>
                                                            {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                                                        </span>
                                                        <span className={step.done ? 'text-[#14121F]/45 line-through' : 'font-medium'}>{step.label}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>

                                <div className={`flex flex-col items-start justify-center gap-6 p-6 sm:flex-row sm:items-center sm:p-8 ${activeStep.tone === 'pink' ? 'bg-[#FF3D81]/[0.07]' : 'bg-[#6A4CFF]/[0.07]'}`}>
                                    <GuideArt step={activeStep.id} avatarUrl={avatarUrl} initial={initial} />
                                    <div className="max-w-sm">
                                        <h3 className={`${D} text-xl font-bold tracking-tight`}>{activeStep.title}</h3>
                                        <p className="mt-2 text-sm leading-6 text-[#14121F]/65">{activeStep.text}</p>
                                        {'href' in activeStep && activeStep.href ? (
                                            <Link href={activeStep.href} className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] ${focus}`}>{activeStep.cta} <ArrowRight className="h-4 w-4" /></Link>
                                        ) : (
                                            <button type="button" onClick={'action' in activeStep ? activeStep.action : undefined} className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#14121F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2c2742] ${focus}`}>{activeStep.cta} <ArrowRight className="h-4 w-4" /></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Projects */}
                    <section id="projects" aria-labelledby="projects-title" className="scroll-mt-24">
                        <div className="flex items-center justify-between gap-3">
                            <h2 id="projects-title" className={`${D} text-xl font-bold tracking-tight`}>Recent projects</h2>
                            {isLoadingDraft && <span role="status" className="inline-flex items-center gap-2 text-xs text-[#14121F]/60"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Opening project…</span>}
                        </div>
                        {projects.length === 0 ? (
                            <div className="mt-4 rounded-3xl border border-dashed border-[#14121F]/15 bg-white px-6 py-10 text-center">
                                <FolderOpen className="mx-auto h-6 w-6 text-[#14121F]/35" />
                                <p className="mt-3 text-sm font-semibold">No saved projects yet</p>
                                <p className="mt-1 text-sm text-[#14121F]/55">Videos and reels you save will show up here.</p>
                            </div>
                        ) : (
                            <ul className="mt-4 divide-y divide-[#14121F]/8 overflow-hidden rounded-3xl border border-[#14121F]/8 bg-white">
                                {projects.map((project) => (
                                    <li key={`${project.kind}-${project.id}`} className="flex items-center gap-2 pr-2 transition hover:bg-[#F7F6FB]">
                                        <button
                                            type="button"
                                            disabled={isLoadingDraft}
                                            onClick={() => (project.kind === 'video' ? onOpenVideoDraft(project.id) : onReel(project.id))}
                                            className={`flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3.5 text-left disabled:opacity-50 sm:px-5 ${focus}`}>
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${project.kind === 'video' ? 'bg-[#6A4CFF]/10 text-[#6A4CFF]' : 'bg-[#FF3D81]/10 text-[#FF3D81]'}`}>
                                                {project.kind === 'video' ? <Video className="h-4 w-4" /> : <Images className="h-4 w-4" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold">{project.title}</span>
                                                <span className="mt-0.5 block text-xs text-[#14121F]/55">{project.meta} · {formatDate(project.savedAt)}</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Delete ${project.title}`}
                                            onClick={() => {
                                                if (!window.confirm(`Delete "${project.title}"? This can't be undone.`)) return;
                                                if (project.kind === 'video') onDeleteVideoDraft(project.id);
                                                else void removeReelDraft(project.id);
                                            }}
                                            className={`rounded-lg p-2 text-[#14121F]/35 transition hover:bg-red-50 hover:text-red-600 ${focus}`}>
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-3 text-xs text-[#14121F]/45">Projects are saved in this browser on this device.</p>
                    </section>
                </div>
            </div>
            <MobileTabBar />
        </main>
    );
}

/** A small, light illustration for the selected getting-started step. */
function GuideArt({ step, avatarUrl, initial }: { step: StepId; avatarUrl: string; initial: string }) {
    if (step === 'reel') {
        return (
            <div aria-hidden="true" className="relative h-36 w-36 shrink-0">
                <div className="absolute left-2 top-4 h-28 w-[4.5rem] -rotate-6 rounded-2xl bg-[linear-gradient(170deg,#38BDF8,#6A4CFF)] shadow-lg" />
                <div className="absolute left-12 top-1 h-28 w-[4.5rem] rotate-3 rounded-2xl bg-[linear-gradient(170deg,#FFE347,#FF3D81)] shadow-xl ring-4 ring-white">
                    <span className="absolute inset-x-2 bottom-3 rounded-md bg-white/90 px-1.5 py-1 text-center text-[9px] font-bold text-[#14121F]">Weekend in Goa</span>
                </div>
            </div>
        );
    }
    if (step === 'profile') {
        return (
            <div aria-hidden="true" className="flex h-36 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl bg-white shadow-lg">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#6A4CFF]/15 bg-cover bg-center text-xl font-bold text-[#6A4CFF]" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>
                    {avatarUrl ? null : initial || <UserRound className="h-6 w-6" />}
                </span>
                <span className="h-2 w-16 rounded-full bg-[#14121F]/15" />
                <span className="h-2 w-10 rounded-full bg-[#14121F]/8" />
            </div>
        );
    }
    if (step === 'plans') {
        return (
            <div aria-hidden="true" className="flex h-36 w-36 shrink-0 flex-col justify-center gap-2 rounded-3xl bg-white p-4 shadow-lg">
                {['Free', 'Creator', 'Studio'].map((plan, index) => (
                    <span key={plan} className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-semibold ${index === 1 ? 'bg-[#6A4CFF] text-white' : 'bg-[#F7F6FB] text-[#14121F]/70'}`}>
                        {plan}<span>{['1m', '5m', '15m'][index]}</span>
                    </span>
                ))}
            </div>
        );
    }
    return (
        <div aria-hidden="true" className="relative h-36 w-44 shrink-0">
            <div className="absolute inset-x-0 top-2 overflow-hidden rounded-2xl bg-white shadow-lg">
                <div className="flex items-center gap-1 border-b border-[#14121F]/8 px-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF3D81]" /><span className="h-1.5 w-1.5 rounded-full bg-[#FFE347]" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex h-20 items-center justify-center bg-[linear-gradient(135deg,#c7d2fe,#fbcfe8)]">
                    <MonitorUp className="h-6 w-6 text-[#6A4CFF]" />
                </div>
            </div>
            <span className="absolute bottom-0 right-0 flex h-16 w-16 items-center justify-center rounded-full bg-[#6A4CFF] bg-cover bg-center text-xl font-bold text-white shadow-xl ring-4 ring-white" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>
                {!avatarUrl && initial}
            </span>
        </div>
    );
}
