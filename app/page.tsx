'use client';

import React, { useState, useEffect } from 'react';
import { Video, StopCircle, FolderOpen, Trash2 } from 'lucide-react';
import { SidebarControls } from '@/components/studio/SidebarControls';
import { VideoCanvas } from '@/components/studio/VideoCanvas';
import { ExportModal } from '@/components/studio/ExportModal';
import { EditorShell } from '@/components/editor/EditorShell';
import { useStudioSession } from '@/hooks/useStudioSession';
import { deleteEditorDraft, DraftSummary, LoadedDraft, listEditorDrafts, loadEditorDraft } from '@/components/editor/drafts';
import { FeedbackWidget } from '@/components/studio/FeedbackWidget';

export default function CreatorStudioDashboard() {
  const {
    settings,
    updateSettings,
    microphoneLevelRef,
    startAvatarAudioMeter,
    stopAvatarAudioMeter,
    videoRef,
    canvasStreamRef,
    isRecording,
    countdown,
    recordedVideoUrl,
    recordedVideoMimeType,
    recordedDurationMs,
    recordingSeconds,
    freeRecordingLimitSeconds,
    startRecordingSequence,
    stopRecording,
    resetRecording,
    cameraError,
  } = useStudioSession();

  const [view, setView] = useState<'record' | 'edit'>('record');
  const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
  const [restoredDraft, setRestoredDraft] = useState<LoadedDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [creatorName, setCreatorName] = useState('My creator space');

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
      if (!window.localStorage.getItem('creator-studio-first-run-v1')) setShowWelcome(true);
      setCreatorName(window.localStorage.getItem('creator-studio-creator-name') || 'My creator space');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const updateCreatorName = (name: string) => {
    const safeName = name.slice(0, 48);
    setCreatorName(safeName);
    window.localStorage.setItem('creator-studio-creator-name', safeName);
  };

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

  // Handle source switching for the video element if needed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (settings.inputMode === 'upload' && settings.uploadedVideoUrl) {
      video.srcObject = null;
      video.src = settings.uploadedVideoUrl;
      video.loop = true;
      video.play().catch((err) => console.error("Error playing uploaded video:", err));
    }
  }, [settings.inputMode, settings.uploadedVideoUrl, videoRef]);

  // Active Video URL to pass to the Editor (either freshly recorded or newly uploaded)
  const activeVideoUrl = restoredDraft?.project.sourceVideoUrl || recordedVideoUrl || settings.uploadedVideoUrl;
  const isEditorOpen = Boolean(activeVideoUrl && (view === 'edit' || (settings.inputMode === 'upload' && settings.uploadedVideoUrl)));

  useEffect(() => {
    if (isEditorOpen) stopAvatarAudioMeter();
    else if (settings.cameraArtEffect === 'photo-avatar') startAvatarAudioMeter();
  }, [isEditorOpen, settings.cameraArtEffect, startAvatarAudioMeter, stopAvatarAudioMeter]);

  // If we are in edit mode and have a video ready, render the dedicated editor shell
  if ((view === 'edit' || (settings.inputMode === 'upload' && Boolean(settings.uploadedVideoUrl))) && activeVideoUrl) {
    return (
      <EditorShell
        sourceVideoUrl={activeVideoUrl}
        aspectRatio={restoredDraft?.project.aspectRatio ?? settings.aspectRatio}
        initialScript={settings.scriptText}
        initialScriptLanguage={settings.scriptLanguage}
        creatorName={creatorName}
        sourceDurationMs={restoredDraft?.project.durationMs ?? recordedDurationMs ?? undefined}
        initialCameraArtEffect={restoredDraft?.project.cameraArtEffect ?? (recordedVideoUrl || settings.cameraArtEffect === 'photo-avatar' || settings.cameraArtEffect === 'avatar' ? 'none' : settings.cameraArtEffect)}
        initialProject={restoredDraft?.project}
        onDraftSaved={() => { void refreshDrafts(); }}
        onBack={() => {
          if (restoredDraft) URL.revokeObjectURL(restoredDraft.project.sourceVideoUrl);
          restoredDraft?.project.tracks.audio.forEach((track) => URL.revokeObjectURL(track.url));
          setRestoredDraft(null);
          resetRecording();
          updateSettings({ inputMode: 'camera', uploadedVideoUrl: undefined });
          setView('record');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100 font-sans md:h-dvh md:flex-row md:overflow-hidden">
      <SidebarControls settings={settings} onUpdateSettings={updateSettings} onCameraArtEffectChange={setCameraArtEffect} />

      <div className="relative flex min-h-[62dvh] min-w-0 flex-1 flex-col md:min-h-0">
        <details className="relative z-40 mx-3 mt-3 self-end md:absolute md:right-4 md:top-4 md:mx-0 md:mt-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs font-semibold text-neutral-200 shadow-lg hover:bg-neutral-800">
            <FolderOpen className="h-4 w-4" /> Projects ({savedDrafts.length})
          </summary>
          <div className="absolute right-0 mt-2 max-h-[60dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
            <label htmlFor="creator-name" className="block px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Creator profile · this browser</label>
            <input id="creator-name" value={creatorName} onChange={(event) => updateCreatorName(event.target.value)} maxLength={48}
              className="mx-3 mt-1 w-[calc(100%-1.5rem)] rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none" />
            <p className="px-3 py-2 text-[10px] leading-relaxed text-neutral-500">Local profile only. Projects are saved on this device, not synced to an online account.</p>
            {savedDrafts.map((draft) => (
              <div key={draft.id} className="flex items-center gap-1 rounded-lg hover:bg-neutral-800">
                <button onClick={() => void openDraft(draft.id)} disabled={isLoadingDraft}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-xs text-neutral-200 disabled:opacity-50">
                  <span className="block truncate font-semibold">{draft.title || 'Untitled creator project'}</span>
                  <span className="mt-1 block text-neutral-500">{draft.creatorName} · {Math.round(draft.durationMs / 1000)} sec · {new Date(draft.savedAt).toLocaleDateString()}</span>
                </button>
                <button onClick={() => void removeDraft(draft.id)} aria-label={`Delete ${draft.title}`} className="rounded-md p-2 text-neutral-600 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {savedDrafts.length === 0 && <p className="px-3 py-2 text-xs text-neutral-400">Your saved edits will appear here.</p>}
            {isLoadingDraft && <p className="px-3 py-2 text-xs text-neutral-400">Opening project…</p>}
            <div className="mx-2 mt-2 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <span className="text-xs font-semibold text-neutral-200">Free plan</span>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">60-second recordings and exports · watermark included. Secure account sync and billing will need backend/provider setup.</p>
              <button type="button" disabled className="mt-2 w-full cursor-not-allowed rounded-md border border-neutral-800 px-2 py-1.5 text-[10px] font-semibold text-neutral-500">Upgrade · payments not configured</button>
            </div>
          </div>
        </details>
        {cameraError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {cameraError}
          </div>
        )}

        <VideoCanvas
          videoRef={videoRef}
          canvasStreamRef={canvasStreamRef}
          settings={settings}
          onAvatarMouthPositionChange={(cameraAvatarMouthX, cameraAvatarMouthY) => updateSettings({ cameraAvatarMouthX, cameraAvatarMouthY })}
          microphoneLevelRef={microphoneLevelRef}
          isRecording={isRecording}
          countdown={countdown}
        />

        <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 md:bottom-6">
          {!isRecording ? (
            <button
              onClick={startRecordingSequence}
              className="flex items-center gap-2 whitespace-nowrap bg-red-600 px-6 py-3 rounded-full font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-500 sm:px-8">
              <Video className="w-5 h-5" /> Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 whitespace-nowrap bg-neutral-100 px-6 py-3 rounded-full font-semibold text-neutral-950 shadow-lg transition-all hover:bg-white sm:px-8">
              <StopCircle className="w-5 h-5 text-red-600" /> Stop Recording
            </button>
          )}
          {isRecording && (
            <p className="mt-2 rounded-full bg-black/65 px-3 py-1 text-center font-mono text-[11px] text-white">
              {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} / {Math.floor(freeRecordingLimitSeconds / 60)}:{String(freeRecordingLimitSeconds % 60).padStart(2, '0')} max
            </p>
          )}
        </div>

        {recordedVideoUrl && (
          <ExportModal
            videoUrl={recordedVideoUrl}
            mimeType={recordedVideoMimeType ?? 'video/webm'}
            onReset={resetRecording}
            onEdit={() => setView('edit')}
          />
        )}
      </div>
      {showWelcome && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="w-full max-w-lg rounded-3xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl sm:p-8">
            <div className="mb-4 inline-flex rounded-2xl bg-indigo-500/15 p-3 text-indigo-300"><FolderOpen className="h-6 w-6" /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Your creator workspace</p>
            <h2 id="welcome-title" className="mt-2 text-2xl font-bold text-white">Let’s make your first video.</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">Start with a ready-to-read Hinglish reel script, or jump straight into the studio. You can edit the script and language any time.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button onClick={() => dismissWelcome(true)} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500">Try the sample template</button>
              <button onClick={() => dismissWelcome(false)} className="flex-1 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-800">Start with my own script</button>
            </div>
          </section>
        </div>
      )}
      {!showWelcome && <FeedbackWidget />}
    </div>
  );
}