'use client';

import React, { useState } from 'react';
import { Download, ArrowLeft, Loader2, Volume2, VolumeX, Bookmark } from 'lucide-react';
import { useEditorProject } from '@/hooks/useEditorProject';
import { PreviewCanvas } from './PreviewCanvas';
import { Timeline } from './Timeline';
import { EditorSidebar } from './EditorSidebar';
import { buildColorGradeFilter } from './colorGrade';
import { saveEditorDraft } from './drafts';
import { EditorProject } from '@/types/editor';

interface EditorShellProps {
    sourceVideoUrl: string;
    onBack: () => void;
    initialProject?: EditorProject;
    onDraftSaved?: () => void;
}

export function EditorShell({ sourceVideoUrl, onBack, initialProject, onDraftSaved }: EditorShellProps) {
    const {
        project,
        videoRef,
        playheadMs,
        isPlaying,
        togglePlay,
        seekTo,
        addOverlay,
        updateOverlay,
        removeOverlay,
        setAudioTracks,
        updateColorGrade,
        addZoomKeyframe,
        updateZoomKeyframe,
        removeZoomKeyframe,
        isSourceMuted,
        toggleSourceAudio,
        getMixedAudioStream,
        addSpeedSegment,
        updateSpeedSegment,
        removeSpeedSegment,
    } = useEditorProject(sourceVideoUrl, initialProject);

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);

    const handleSaveDraft = async () => {
        if (!project || isSavingDraft) return;
        setIsSavingDraft(true);
        try {
            await saveEditorDraft(sourceVideoUrl, project);
            setDraftSaved(true);
            onDraftSaved?.();
            window.setTimeout(() => setDraftSaved(false), 2500);
        } catch (error) {
            console.error('Could not save editor draft:', error);
            window.alert('Could not save the draft. Check that the original video and music files are still available, then try again.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleDownload = async () => {
        const video = videoRef.current;
        if (!video || !project || isExporting) return;

        setIsExporting(true);

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = video.videoWidth || 1280;
        exportCanvas.height = video.videoHeight || 720;
        const ctx = exportCanvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
            setIsExporting(false);
            return;
        }

        const canvasStream = exportCanvas.captureStream(30);
        // The Web Audio destination mixes source audio (unless muted) and the
        // added music track, while canvas capture supplies the edited picture.
        const mixedAudioStream = getMixedAudioStream();
        const stream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...(mixedAudioStream?.getAudioTracks() ?? []),
        ]);
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        } catch {
            recorder = new MediaRecorder(stream);
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            let outputBlob = webmBlob;
            let extension = 'webm';
            try {
                setExportProgress(0);
                const { convertWebmToMp4 } = await import('./convertToMp4');
                outputBlob = await convertWebmToMp4(webmBlob, setExportProgress);
                extension = 'mp4';
            } catch (error) {
                console.error('MP4 conversion failed; downloading the WebM export instead:', error);
                window.alert('MP4 conversion failed in this browser. Your edited video will be downloaded as WebM instead.');
            }

            const url = URL.createObjectURL(outputBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creator-studio-edited-${Date.now()}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            canvasStream.getTracks().forEach((track) => track.stop());
            setIsExporting(false);
        };

        if (video.currentTime !== 0) {
            video.currentTime = 0;
            await new Promise<void>((resolve) => {
                const handleSeeked = () => {
                    video.removeEventListener('seeked', handleSeeked);
                    resolve();
                };
                video.addEventListener('seeked', handleSeeked, { once: true });
            });
        }
        try {
            await video.play();
            recorder.start();
        } catch (err) {
            console.error("Export playback error:", err);
            setIsExporting(false);
            return;
        }

        const renderExportFrame = () => {
            if (video.ended || video.paused) {
                if (recorder.state === 'recording') {
                    recorder.stop();
                }
                video.pause();
                return;
            }

            ctx.save();
            ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

            // Use the same full color-grade filter as the live editor preview.
            // This preserves Mono (zero saturation), warmth, brightness, and contrast in the download.
            ctx.filter = buildColorGradeFilter(project.colorGrade);
            ctx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
            ctx.restore();

            const currentMs = video.currentTime * 1000;
            for (const overlay of project.tracks.overlays) {
                if (currentMs < overlay.startMs || currentMs > overlay.endMs) continue;
                if (overlay.type === 'text') {
                    const fontSize = overlay.fontSize ?? 32;
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.fillStyle = overlay.color ?? '#ffffff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                    ctx.lineWidth = fontSize * 0.12;
                    const x = overlay.x * exportCanvas.width;
                    const y = overlay.y * exportCanvas.height;
                    ctx.strokeText(overlay.content, x, y);
                    ctx.fillText(overlay.content, x, y);
                }
            }

            requestAnimationFrame(renderExportFrame);
        };

        renderExportFrame();
    };

    return (
        <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
            {project ? (
                <EditorSidebar
                    project={project}
                    playheadMs={playheadMs}
                    onBack={onBack}
                    onColorGradeChange={updateColorGrade}
                    onAddOverlay={addOverlay}
                    onUpdateOverlay={updateOverlay}
                    onRemoveOverlay={removeOverlay}
                    onSetAudioTracks={setAudioTracks}
                    onAddZoomKeyframe={addZoomKeyframe}
                    onUpdateZoomKeyframe={updateZoomKeyframe}
                    onRemoveZoomKeyframe={removeZoomKeyframe}
                    onAddSpeedSegment={addSpeedSegment}
                    onUpdateSpeedSegment={updateSpeedSegment}
                    onRemoveSpeedSegment={removeSpeedSegment}
                />
            ) : (
                <aside className="w-80 border-r border-neutral-800 bg-neutral-900 p-4 flex flex-col justify-between">
                    <h2 className="text-lg font-bold">Edit Studio</h2>
                </aside>
            )}

            <div className="flex-1 flex flex-col p-6 relative overflow-hidden">
                {/* Top Header Actions Bar */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800/80">
                    <button
                        onClick={onBack}
                        disabled={isExporting}
                        className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors disabled:opacity-50">
                        <ArrowLeft className="w-4 h-4" /> Back to Studio
                    </button>

                    <button
                        onClick={toggleSourceAudio}
                        disabled={isExporting}
                        aria-label={isSourceMuted ? 'Unmute original video audio' : 'Mute original video audio'}
                        className="ml-auto mr-3 flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 disabled:opacity-50">
                        {isSourceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        {isSourceMuted ? 'Original audio muted' : 'Mute original audio'}
                    </button>

                    <button
                        onClick={handleSaveDraft}
                        disabled={!project || isSavingDraft || isExporting}
                        className="mr-3 flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 disabled:opacity-50">
                        {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                        {isSavingDraft ? 'Saving…' : draftSaved ? 'Draft Saved' : 'Save Draft'}
                    </button>

                    <button
                        onClick={handleDownload}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white px-5 py-2 rounded-lg font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all transform hover:scale-105">
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {exportProgress > 0 ? `Converting MP4… ${exportProgress}%` : 'Rendering edited video…'}
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" /> Download Video
                            </>
                        )}
                    </button>
                </div>

                <video ref={videoRef} src={sourceVideoUrl} className="hidden" playsInline />

                {project ? (
                    <div className={`flex-1 flex flex-col gap-4 overflow-hidden ${isExporting ? 'pointer-events-none opacity-70' : ''}`}>
                        <PreviewCanvas videoRef={videoRef} project={project} playheadMs={playheadMs} />
                        <Timeline
                            durationMs={project.durationMs}
                            playheadMs={playheadMs}
                            isPlaying={isPlaying}
                            onSeek={seekTo}
                            onTogglePlay={togglePlay}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">
                        Loading video metadata…
                    </div>
                )}
            </div>
        </div>
    );
}