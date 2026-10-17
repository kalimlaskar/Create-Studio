'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SidebarAccount } from '@/components/videos/StudioSidebar';
import { AccountMenu } from '@/components/account/AccountMenu';
import { Video, Pause, Play, Square, FolderOpen, Trash2, LoaderCircle, SlidersHorizontal, SwitchCamera, ArrowLeft, X } from 'lucide-react';
import { SidebarControls } from '@/components/studio/SidebarControls';
import { VideoCanvas } from '@/components/studio/VideoCanvas';
import { ExportModal } from '@/components/studio/ExportModal';
import { EditorShell } from '@/components/editor/EditorShell';
import { useStudioSession } from '@/hooks/useStudioSession';
import { deleteEditorDraft, DraftSummary, LoadedDraft, listEditorDrafts, loadEditorDraft } from '@/components/editor/drafts';
import { PhotoReelStudio } from '@/components/studio/PhotoReelStudio';
import { StudioHome } from '@/components/studio/StudioHome';
import { PLAN_LIMITS, type PlanId } from '@/components/pricing/planLimits';
import { useDocumentPip } from './useDocumentPip';
import { FloatingStudioPip } from './FloatingStudioPip';
import { ScreenShareControls } from '@/components/studio/Screensharecontrols';


function getFallbackDisplayName(userEmail: string) {
    const accountName = userEmail.split(' · ')[0]?.split('@')[0] ?? '';
    const words = accountName.replace(/[._-]+/g, ' ').trim();
    return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'My creator space';
}

export function CreatorStudioDashboard({
    userEmail,
    initialDisplayName = '',
    initialUsername = '',
    initialAvatarUrl = '',
    profilePersistenceEnabled = false,
    isPro = false,
    userPlan = 'Free',
    planId = 'free',
    sidebar,
}: {
    sidebar?: { account: SidebarAccount | null; collapsed: boolean };
    userEmail: string;
    initialDisplayName?: string;
    initialUsername?: string;
    initialAvatarUrl?: string;
    profilePersistenceEnabled?: boolean;
    isPro?: boolean;
    userPlan?: string;
    /** Decided on the server from the subscription record. */
    planId?: PlanId;
}) {
    // Longest export this plan allows. The server checks it again on upload.
    const exportLimitMs = PLAN_LIMITS[planId].exportSeconds * 1000;

    const [creationMode, setCreationMode] = useState<'choose' | 'record' | 'photos'>('choose');
    const [view, setView] = useState<'record' | 'edit'>('record');
    const [reelDraftId, setReelDraftId] = useState<string | null>(null);
    // A tab recording handed over by the Cliprame Recorder extension.
    const [importedDurationMs, setImportedDurationMs] = useState<number | null>(null);
    const [importNotice, setImportNotice] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
    const [screenShareSurface, setScreenShareSurface] = useState<string | null>(null);
    const [isScreenTrackMuted, setIsScreenTrackMuted] = useState(false);
    const [screenFramesReceived, setScreenFramesReceived] = useState(0);
    const [screenShareError, setScreenShareError] = useState<string | null>(null);
    const [studioWasBackgrounded, setStudioWasBackgrounded] = useState(false);
    const screenShareStreamRef = React.useRef<MediaStream | null>(null);
    const lastScreenFrameReportRef = useRef(0);
    const lastScreenFingerprintRef = useRef<number | null>(null);
    const screenProbeCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const reportScreenFrame = useCallback((video: HTMLVideoElement) => {
        const now = Date.now();
        if (now - lastScreenFrameReportRef.current < 1000) return;
        lastScreenFrameReportRef.current = now;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
        const canvas = screenProbeCanvasRef.current ?? document.createElement('canvas');
        screenProbeCanvasRef.current = canvas;
        canvas.width = 16;
        canvas.height = 9;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let fingerprint = 0;
            for (let index = 0; index < pixels.length; index += 16) fingerprint = (fingerprint * 31 + pixels[index] * 3 + pixels[index + 1] * 5 + pixels[index + 2] * 7) | 0;
            if (lastScreenFingerprintRef.current === null) {
                lastScreenFingerprintRef.current = fingerprint;
                setScreenFramesReceived(1);
            } else if (lastScreenFingerprintRef.current !== fingerprint) {
                lastScreenFingerprintRef.current = fingerprint;
                setScreenFramesReceived((changes) => changes + 1);
            }
        } catch (error) {
            console.warn('Could not inspect the incoming screen-share frame:', error);
        }
    }, []);

    const {
        settings,
        updateSettings,
        getCameraStream,
        microphoneLevelRef,
        startAvatarAudioMeter,
        stopAvatarAudioMeter,
        videoRef,
        canvasStreamRef,
        isRecording,
        isRecordingPaused,
        countdown,
        recordedVideoUrl,
        recordedVideoMimeType,
        recordedDurationMs,
        recordingSeconds,
        freeRecordingLimitSeconds,
        isFinalizingScreenRecording,
        startRecordingSequence,
        stopRecording,
        pauseRecording,
        resumeRecording,
        resetRecording,
        cameraError,
    } = useStudioSession(creationMode === 'record' && view === 'record', screenShareStream);
    const getPreviewStream = useCallback(() => canvasStreamRef.current, [canvasStreamRef]);

    const [floatingEnabled, setFloatingEnabled] = useState(true);
    const pip = useDocumentPip(Boolean(screenShareStream) && floatingEnabled);
    const closePip = pip.close;

    useEffect(() => { screenShareStreamRef.current = screenShareStream; }, [screenShareStream]);

    useEffect(() => {
        if (!screenShareStream) return;
        const noteBackgrounding = () => {
            if (document.hidden) setStudioWasBackgrounded(true);
        };
        document.addEventListener('visibilitychange', noteBackgrounding);
        return () => document.removeEventListener('visibilitychange', noteBackgrounding);
    }, [screenShareStream]);

    const stopScreenShare = React.useCallback(() => {
        screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenShareStreamRef.current = null;
        setScreenShareStream(null);
        setScreenShareSurface(null);
        setIsScreenTrackMuted(false);
        closePip();
    }, [closePip]);

    useEffect(() => {
        if (creationMode !== 'record' || view !== 'record' || recordedVideoUrl) {
            const cleanupFrame = window.requestAnimationFrame(stopScreenShare);
            return () => window.cancelAnimationFrame(cleanupFrame);
        }
    }, [creationMode, view, recordedVideoUrl, stopScreenShare]);

    useEffect(() => () => {
        screenShareStreamRef.current?.getTracks().forEach((track) => track.stop());
    }, []);

    const startScreenShare = async () => {
        setScreenShareError(null);
        setStudioWasBackgrounded(false);
        setScreenShareSurface(null);
        setIsScreenTrackMuted(false);
        setScreenFramesReceived(0);
        lastScreenFrameReportRef.current = 0;
        lastScreenFingerprintRef.current = null;
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setScreenShareError('Screen sharing is not supported in this browser. Use a recent desktop version of Chrome, Edge, Firefox, or Safari.');
            return;
        }
        if (floatingEnabled && pip.isSupported) await pip.open();
        try {
            const captureOptions = {
                video: { displaySurface: 'window', width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 30 } },
                audio: false,
                surfaceSwitching: 'include',
                selfBrowserSurface: 'exclude',
            } as DisplayMediaStreamOptions & {
                video: MediaTrackConstraints & { displaySurface: 'window' };
                surfaceSwitching: 'include';
                selfBrowserSurface: 'exclude';
            };
            const stream = await navigator.mediaDevices.getDisplayMedia(captureOptions);
            const displayTrack = stream.getVideoTracks()[0];
            if (!displayTrack) {
                stream.getTracks().forEach((track) => track.stop());
                closePip();
                setScreenShareError('The browser did not provide a screen video track. Choose a screen, window, or tab and try again.');
                return;
            }
            displayTrack.contentHint = 'motion';
            const surface = displayTrack.getSettings().displaySurface;
            setScreenShareSurface(surface === 'browser' ? 'Chrome tab' : surface === 'window' ? 'Browser window' : surface === 'monitor' ? 'Entire screen' : 'Unknown capture source');
            if (surface === 'monitor') closePip();
            setIsScreenTrackMuted(displayTrack.muted);
            displayTrack.addEventListener('mute', () => setIsScreenTrackMuted(true));
            displayTrack.addEventListener('unmute', () => setIsScreenTrackMuted(false));
            displayTrack.addEventListener('ended', () => {
                setScreenShareStream((current) => current === stream ? null : current);
                if (screenShareStreamRef.current === stream) screenShareStreamRef.current = null;
                setScreenShareSurface(null);
                setIsScreenTrackMuted(false);
                closePip();
            }, { once: true });
            screenShareStreamRef.current = stream;
            setScreenShareStream(stream);
        } catch (error) {
            closePip();
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) return;
            setScreenShareError(error instanceof Error ? error.message : 'Could not start screen sharing. Check browser permissions and try again.');
        }
    };

    const router = useRouter();
    const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
    const [restoredDraft, setRestoredDraft] = useState<LoadedDraft | null>(null);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [creatorName, setCreatorName] = useState(initialDisplayName || getFallbackDisplayName(userEmail));
    const profileUsername = initialUsername;
    // Profile edits happen on /studio/account; this page shows what was saved.
    const profileAvatarUrl = initialAvatarUrl;
    const creatorNameInitializedRef = useRef(false);

    const refreshDrafts = async () => {
        try {
            setSavedDrafts(await listEditorDrafts());
        } catch (error) {
            console.error('Could not load saved drafts:', error);
        }
    };

    useEffect(() => {
        let cancelled = false;
        listEditorDrafts().then((drafts) => {
            if (!cancelled) setSavedDrafts(drafts);
        }).catch((error) => console.error('Could not load saved drafts:', error));
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            if (creationMode === 'record' && !window.localStorage.getItem('creator-studio-first-run-v1')) setShowWelcome(true);
            if (!creatorNameInitializedRef.current) {
                creatorNameInitializedRef.current = true;
                const storedName = window.localStorage.getItem('creator-studio-creator-name');
                const profileName = initialDisplayName.trim();
                const name = profileName || storedName || getFallbackDisplayName(userEmail);
                setCreatorName(name);
                window.localStorage.setItem('creator-studio-creator-name', name);
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [creationMode, initialDisplayName, userEmail]);

    const dismissWelcome = (useSample: boolean) => {
        window.localStorage.setItem('creator-studio-first-run-v1', 'complete');
        setShowWelcome(false);
        if (useSample) {
            updateSettings({
                scriptLanguage: 'hinglish',
                aspectRatio: '9:16',
                scriptText: 'Hey, creator! Aaj main share karunga ek simple idea jo aapke next video ko instantly better bana sakta hai.\n\nPehla step: apni opening line ko clear rakho. Doosra: ek useful example dikhao. Aur end mein, audience se ek simple sawaal poochho.\n\nTry this in your next reel, and tell me what you think!',
            });
        }
    };

    const removeDraft = async (id: string) => {
        try {
            await deleteEditorDraft(id);
            await refreshDrafts();
        } catch (error) {
            console.error('Could not delete saved project:', error);
        }
    };

    const setCameraArtEffect = (cameraArtEffect: typeof settings.cameraArtEffect) => {
        updateSettings({ cameraArtEffect });
        if (cameraArtEffect === 'photo-avatar') startAvatarAudioMeter();
        else stopAvatarAudioMeter();
    };

    const openDraft = async (id: string) => {
        setIsLoadingDraft(true);
        try {
            const draft = await loadEditorDraft(id);
            setRestoredDraft(draft);
            setView('edit');
        } catch (error) {
            console.error('Could not open saved draft:', error);
            window.alert('Could not open this draft. It may have been removed or its media is unavailable.');
        } finally {
            setIsLoadingDraft(false);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (settings.inputMode === 'upload' && settings.uploadedVideoUrl) {
            video.srcObject = null;
            video.src = settings.uploadedVideoUrl;
            video.loop = true;
            video.play().catch((err) => console.error('Error playing uploaded video:', err));
        }
    }, [settings.inputMode, settings.uploadedVideoUrl, videoRef]);

    // Receives a recording from the Cliprame Recorder extension (/studio?import=extension&recording=<id>).
    // The extension's bridge frame answers "import-ready" with the video file.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const recordingId = params.get('recording');
        if (params.get('import') !== 'extension' || !recordingId) return;

        let settled = false;
        const finish = (notice: string) => {
            settled = true;
            window.clearInterval(askTimer);
            window.clearTimeout(giveUpTimer);
            window.history.replaceState(null, '', window.location.pathname);
            setImportNotice(notice);
        };
        const onMessage = (event: MessageEvent) => {
            const data = event.data as { source?: string; type?: string; id?: string; blob?: unknown; durationMs?: unknown } | null;
            if (settled || !event.origin.startsWith('chrome-extension://') || data?.source !== 'cliprame-extension' || data.id !== recordingId) return;
            if (data.type === 'recording' && data.blob instanceof Blob) {
                finish('');
                setImportedDurationMs(typeof data.durationMs === 'number' && data.durationMs > 0 ? data.durationMs : null);
                updateSettings({ inputMode: 'upload', uploadedVideoUrl: URL.createObjectURL(data.blob) });
                setView('record');
                setCreationMode('record');
            } else {
                finish('That recording is no longer in the extension. Record again, or download it from the extension and upload it here.');
            }
        };
        const askForRecording = () => window.postMessage({ source: 'cliprame-app', type: 'import-ready', id: recordingId }, window.location.origin);

        window.addEventListener('message', onMessage);
        askForRecording();
        const askTimer = window.setInterval(askForRecording, 500);
        const giveUpTimer = window.setTimeout(() => {
            if (!settled) finish('Could not get the recording from the Cliprame Recorder extension. Check that it is installed and enabled, then choose "Edit in Cliprame" again.');
        }, 8000);
        return () => {
            window.removeEventListener('message', onMessage);
            window.clearInterval(askTimer);
            window.clearTimeout(giveUpTimer);
        };
    }, [updateSettings]);

    const activeVideoUrl = restoredDraft?.project.sourceVideoUrl || recordedVideoUrl || settings.uploadedVideoUrl;
    const isEditorOpen = Boolean(activeVideoUrl && (view === 'edit' || (settings.inputMode === 'upload' && settings.uploadedVideoUrl)));

    useEffect(() => {
        if (isEditorOpen) stopAvatarAudioMeter();
        else if (settings.cameraArtEffect === 'photo-avatar') startAvatarAudioMeter();
    }, [isEditorOpen, settings.cameraArtEffect, startAvatarAudioMeter, stopAvatarAudioMeter]);

    if (creationMode === 'photos') return <PhotoReelStudio exportLimitMs={exportLimitMs} isPro={isPro} initialDraftId={reelDraftId} onBack={() => { setReelDraftId(null); setCreationMode('choose'); }} />;

    const profileMenu = <AccountMenu name={creatorName} email={userEmail} avatarUrl={profileAvatarUrl} planName={userPlan} />;
    const profileMenuDark = <AccountMenu name={creatorName} email={userEmail} avatarUrl={profileAvatarUrl} planName={userPlan} tone="dark" />;

    if ((view === 'edit' || (settings.inputMode === 'upload' && Boolean(settings.uploadedVideoUrl))) && activeVideoUrl) {
        return (
            <EditorShell
                exportLimitMs={exportLimitMs}
                isPro={isPro}
                sourceVideoUrl={activeVideoUrl}
                aspectRatio={restoredDraft?.project.aspectRatio ?? settings.aspectRatio}
                initialScript={settings.scriptText}
                initialScriptLanguage={settings.scriptLanguage}
                creatorName={creatorName}
                sourceDurationMs={restoredDraft?.project.durationMs ?? recordedDurationMs ?? importedDurationMs ?? undefined}
                initialCameraArtEffect={restoredDraft?.project.cameraArtEffect ?? (recordedVideoUrl || settings.cameraArtEffect === 'photo-avatar' || settings.cameraArtEffect === 'avatar' ? 'none' : settings.cameraArtEffect)}
                initialProject={restoredDraft?.project}
                onDraftSaved={() => { void refreshDrafts(); }}
                onBack={() => {
                    if (restoredDraft) URL.revokeObjectURL(restoredDraft.project.sourceVideoUrl);
                    restoredDraft?.project.tracks.audio.forEach((track) => URL.revokeObjectURL(track.url));
                    setRestoredDraft(null);
                    resetRecording();
                    updateSettings({ uploadedVideoUrl: undefined });
                    setImportedDurationMs(null);
                    setView('record');
                    stopScreenShare();
                }}
            />
        );
    }

    if (creationMode === 'choose') {
        return (
            <StudioHome
                creatorName={creatorName}
                avatarUrl={profileAvatarUrl}
                username={profileUsername}
                userPlan={userPlan}
                isPro={isPro}
                showUpgrade={!isPro && profilePersistenceEnabled}
                videoDrafts={savedDrafts}
                isLoadingDraft={isLoadingDraft}
                profileMenu={profileMenu}
                notice={importNotice}
                onDismissNotice={() => setImportNotice('')}
                onRecord={() => { updateSettings({ inputMode: 'camera', uploadedVideoUrl: undefined }); setView('record'); setCreationMode('record'); }}
                onUpload={(file) => { updateSettings({ inputMode: 'upload', uploadedVideoUrl: URL.createObjectURL(file) }); setView('record'); setCreationMode('record'); }}
                onReel={(draftId) => { setReelDraftId(draftId ?? null); setCreationMode('photos'); }}
                onOpenVideoDraft={(id) => void openDraft(id)}
                onDeleteVideoDraft={(id) => void removeDraft(id)}
                onEditProfile={() => router.push('/studio/account')}
                sidebar={sidebar}
            />
        );
    }

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-neutral-950 font-sans text-neutral-100 md:flex-row">
            {showSettings && <button type="button" aria-label="Close settings" onClick={() => setShowSettings(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" />}
            <div className={`fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] flex-col overflow-hidden rounded-t-3xl border-t border-neutral-700 bg-neutral-900 shadow-2xl md:static md:z-auto md:flex md:max-h-full md:rounded-none md:border-t-0 md:shadow-none ${showSettings ? 'flex' : 'hidden'}`}>
                <div className="flex items-center justify-between px-4 pt-3 md:hidden">
                    <span className="text-sm font-semibold">Studio settings</span>
                    <button type="button" onClick={() => setShowSettings(false)} className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white"><X className="h-3.5 w-3.5" /> Done</button>
                </div>
                <SidebarControls settings={settings} onUpdateSettings={updateSettings} onCameraArtEffectChange={setCameraArtEffect} cameraSwitchDisabled={countdown !== null || (isRecording && Boolean(screenShareStream))} />
            </div>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:pt-14">
                <button type="button" onClick={() => { setShowWelcome(false); setCreationMode('choose'); }} aria-label="Back to home" className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-neutral-950/80 text-neutral-100 backdrop-blur-md md:hidden"><ArrowLeft className="h-5 w-5" /></button>
                <div className="absolute right-3 top-3 z-40 flex items-start gap-2 md:right-4">
                    <button type="button" onClick={() => { setShowWelcome(false); setCreationMode('choose'); }} className="hidden items-center rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs font-semibold text-neutral-200 shadow-lg hover:bg-neutral-800 md:flex">Home</button>
                    {profileMenuDark}
                    <details className="relative">
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs font-semibold text-neutral-200 shadow-lg hover:bg-neutral-800"><FolderOpen className="h-4 w-4" /> Projects ({savedDrafts.length})</summary>
                        <div className="absolute right-0 mt-2 max-h-[60dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
                            {savedDrafts.map((draft) => <div key={draft.id} className="flex items-center gap-1 rounded-lg hover:bg-neutral-800"><button onClick={() => void openDraft(draft.id)} disabled={isLoadingDraft} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-xs text-neutral-200 disabled:opacity-50"><span className="block truncate font-semibold">{draft.title || 'Untitled creator project'}</span><span className="mt-1 block text-neutral-500">{draft.creatorName} · {Math.round(draft.durationMs / 1000)} sec · {new Date(draft.savedAt).toLocaleDateString()}</span></button><button onClick={() => void removeDraft(draft.id)} aria-label={`Delete ${draft.title}`} className="rounded-md p-2 text-neutral-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></div>)}
                            {savedDrafts.length === 0 && <p className="px-3 py-2 text-xs text-neutral-400">Your saved edits will appear here.</p>}
                            {isLoadingDraft && <p className="px-3 py-2 text-xs text-neutral-400">Opening project…</p>}
                            <div className="mx-2 mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3"><span className="text-xs font-semibold text-neutral-200">{userPlan} Plan</span><p className="mt-1 text-[10px] leading-relaxed text-neutral-500">Active subscription package loaded from your database account.</p></div>
                        </div>
                    </details>
                </div>
                {cameraError && <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-lg bg-red-600/90 px-4 py-2 text-sm text-white shadow-lg">{cameraError}</div>}
                <VideoCanvas videoRef={videoRef} canvasStreamRef={canvasStreamRef} settings={settings} onAvatarMouthPositionChange={(cameraAvatarMouthX, cameraAvatarMouthY) => updateSettings({ cameraAvatarMouthX, cameraAvatarMouthY })} microphoneLevelRef={microphoneLevelRef} isRecording={isRecording} isRecordingPaused={isRecordingPaused} countdown={countdown} screenShareStream={screenShareStream} onScreenFrame={reportScreenFrame} isProUser />
                {isFinalizingScreenRecording && <div role="status" aria-live="polite" className="absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border border-indigo-300/20 bg-neutral-950/95 px-5 py-4 text-sm font-medium text-white shadow-2xl backdrop-blur"><LoaderCircle className="h-5 w-5 animate-spin text-indigo-300" />Preparing your screen recording and camera card…</div>}
                <ScreenShareControls
                    isSharing={Boolean(screenShareStream)}
                    isRecording={isRecording}
                    countdown={countdown}
                    surface={screenShareSurface}
                    isTrackPaused={isScreenTrackMuted}
                    framesReceived={screenFramesReceived}
                    wasBackgrounded={studioWasBackgrounded}
                    floatingEnabled={floatingEnabled}
                    pipSupported={pip.isSupported}
                    pipOpen={pip.isOpen}
                    pipError={pip.error}
                    shareError={screenShareError}
                    showCamera={settings.screenShareShowCamera}
                    onToggleShare={() => (screenShareStream ? (isRecording ? stopRecording() : stopScreenShare()) : void startScreenShare())}
                    onFloatingChange={(enabled) => { setFloatingEnabled(enabled); if (!enabled) closePip(); }}
                    onShowCameraChange={(show) => updateSettings({ screenShareShowCamera: show })}
                    onOpenPip={() => void pip.open()}
                />
                <button type="button" onClick={() => setShowSettings(true)} aria-label="Open studio settings" className="absolute bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+3.75rem)] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-neutral-950/80 text-neutral-100 shadow-lg backdrop-blur-md md:hidden"><SlidersHorizontal className="h-5 w-5" /></button>
                <button type="button" onClick={() => updateSettings({ cameraFacing: settings.cameraFacing === 'user' ? 'environment' : 'user' })} disabled={countdown !== null || (isRecording && Boolean(screenShareStream))} aria-label={settings.cameraFacing === 'user' ? 'Switch to back camera' : 'Switch to selfie camera'} title="Flip camera" className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-neutral-950/80 text-neutral-100 shadow-lg backdrop-blur-md transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 md:bottom-6"><SwitchCamera className="h-5 w-5" /></button>
                <div className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 md:bottom-6">
                    {!isRecording ? <button onClick={startRecordingSequence} disabled={countdown !== null || isFinalizingScreenRecording} className="pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-full border border-red-400/50 bg-red-600/95 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(220,38,38,.35)] backdrop-blur-md transition-all hover:bg-red-500 active:scale-95 disabled:opacity-70 sm:px-6"><Video className="h-4 w-4" />{isFinalizingScreenRecording ? 'Preparing recording…' : countdown !== null ? `Starting in ${countdown}…` : 'Record'}</button> : <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-950/85 p-1.5 text-white shadow-[0_8px_32px_rgba(0,0,0,.42)] backdrop-blur-xl sm:gap-2 sm:p-2"><span className={`ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${isRecordingPaused ? 'bg-amber-400' : 'animate-pulse bg-red-500'}`} /><span className="min-w-[4.4rem] px-1 font-mono text-xs tabular-nums sm:min-w-20 sm:text-sm">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}<span className="ml-1 text-[9px] text-neutral-400 sm:text-[10px]"> / {Math.floor(freeRecordingLimitSeconds / 60)}:00</span></span><span className="hidden h-6 w-px bg-white/15 sm:block" /><button type="button" onClick={isRecordingPaused ? resumeRecording : pauseRecording} aria-label={isRecordingPaused ? 'Resume recording' : 'Pause recording'} title={isRecordingPaused ? 'Resume recording' : 'Pause recording'} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:h-10 sm:w-10">{isRecordingPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}</button><button type="button" onClick={stopRecording} aria-label="Stop recording" title="Stop recording" className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-md shadow-red-950/40 transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:h-10 sm:w-10"><Square className="h-3.5 w-3.5 fill-current" /></button></div>}
                </div>
                {recordedVideoUrl && <ExportModal videoUrl={recordedVideoUrl} mimeType={recordedVideoMimeType ?? 'video/webm'} scriptText={settings.scriptText} onReset={resetRecording} onEdit={() => setView('edit')} />}
            </div>
            <FloatingStudioPip
                pipWindow={pip.pipWindow}
                getCameraStream={getCameraStream}
                scriptText={settings.scriptText}
                mirror={settings.cameraFacing !== 'environment'}
                countdown={countdown}
                isRecording={isRecording}
                isPaused={isRecordingPaused}
                recordingSeconds={recordingSeconds}
                onStart={startRecordingSequence}
                onStop={stopRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
                getPreviewStream={getPreviewStream}
                airDrawing={settings}
                onAirDrawingChange={updateSettings}
            />
            {showWelcome && <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="w-full max-w-lg rounded-3xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl sm:p-8"><div className="mb-4 inline-flex rounded-2xl bg-indigo-500/15 p-3 text-indigo-300"><FolderOpen className="h-6 w-6" /></div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Your creator workspace</p><h2 id="welcome-title" className="mt-2 text-2xl font-bold text-white">Let’s make your first video.</h2><p className="mt-3 text-sm leading-relaxed text-neutral-400">Start with a ready-to-read Hinglish reel script, or jump straight into the studio. You can edit the script and language any time.</p><div className="mt-6 flex flex-col gap-2 sm:flex-row"><button onClick={() => dismissWelcome(true)} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500">Try the sample template</button><button onClick={() => dismissWelcome(false)} className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800">Start with my own script</button></div></section></div>}
        </div>
    );
}