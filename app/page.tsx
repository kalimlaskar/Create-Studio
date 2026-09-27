'use client';

import React, { useState, useEffect } from 'react';
import { Video, StopCircle, FolderOpen } from 'lucide-react';
import { SidebarControls } from '@/components/studio/SidebarControls';
import { VideoCanvas } from '@/components/studio/VideoCanvas';
import { ExportModal } from '@/components/studio/ExportModal';
import { EditorShell } from '@/components/editor/EditorShell';
import { useStudioSession } from '@/hooks/useStudioSession';
import { DraftSummary, LoadedDraft, listEditorDrafts, loadEditorDraft } from '@/components/editor/drafts';

export default function CreatorStudioDashboard() {
  const {
    settings,
    updateSettings,
    videoRef,
    canvasStreamRef,
    isRecording,
    countdown,
    recordedVideoUrl,
    startRecordingSequence,
    stopRecording,
    resetRecording,
    cameraError,
  } = useStudioSession();

  const [view, setView] = useState<'record' | 'edit'>('record');
  const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
  const [restoredDraft, setRestoredDraft] = useState<LoadedDraft | null>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);

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

  // If we are in edit mode and have a video ready, render the dedicated editor shell
  if ((view === 'edit' || (settings.inputMode === 'upload' && Boolean(settings.uploadedVideoUrl))) && activeVideoUrl) {
    return (
      <EditorShell
        sourceVideoUrl={activeVideoUrl}
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
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      <SidebarControls settings={settings} onUpdateSettings={updateSettings} />

      <div className="flex-1 flex flex-col relative">
        {savedDrafts.length > 0 && (
          <details className="absolute top-4 right-4 z-40">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs font-semibold text-neutral-200 shadow-lg hover:bg-neutral-800">
              <FolderOpen className="h-4 w-4" /> Drafts ({savedDrafts.length})
            </summary>
            <div className="absolute right-0 mt-2 max-h-64 w-72 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
              {savedDrafts.map((draft) => (
                <button key={draft.id} onClick={() => void openDraft(draft.id)} disabled={isLoadingDraft}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50">
                  <span className="block font-semibold">Edited project · {Math.round(draft.durationMs / 1000)} sec</span>
                  <span className="mt-1 block text-neutral-500">{new Date(draft.savedAt).toLocaleString()}</span>
                </button>
              ))}
              {isLoadingDraft && <p className="px-3 py-2 text-xs text-neutral-400">Opening draft…</p>}
            </div>
          </details>
        )}

        {cameraError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            {cameraError}
          </div>
        )}

        <VideoCanvas
          videoRef={videoRef}
          canvasStreamRef={canvasStreamRef}
          settings={settings}
          isRecording={isRecording}
          countdown={countdown}
        />

        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
          {!isRecording ? (
            <button
              onClick={startRecordingSequence}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-red-600/30 transition-all transform hover:scale-105">
              <Video className="w-5 h-5" /> Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-neutral-100 hover:bg-white text-neutral-950 px-8 py-3 rounded-full font-semibold shadow-lg transition-all transform hover:scale-105">
              <StopCircle className="w-5 h-5 text-red-600" /> Stop Recording
            </button>
          )}
        </div>

        {recordedVideoUrl && (
          <ExportModal
            videoUrl={recordedVideoUrl}
            onReset={resetRecording}
            onEdit={() => setView('edit')}
          />
        )}
      </div>
    </div>
  );
}