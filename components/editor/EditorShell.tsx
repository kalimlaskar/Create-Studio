'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditorProject } from '@/hooks/useEditorProject';
import { PreviewCanvas } from './PreviewCanvas';
import { Timeline } from './Timeline';
import { TranscriptPanel } from './TranscriptPanel';
import { EditorSidebar } from './EditorSidebar';
import { EditorTopBar, ExportStage, Segmented } from './EditorTopBar';
import { TimelineSplitter, EditorLoading, EditorError } from './EditorOverlays';
import { ExportDialog, type RenderResult } from '@/components/export/ExportDialog';
import { buildColorGradeFilter } from './colorGrade';
import { saveEditorDraft } from './drafts';
import { EditorProject, TimeRange } from '@/types/editor';
import { createExportRecorder, getExportDimensions, getFrameCrop, getRecordingDimensions, RECORDING_FRAME_RATE, ExportFormat, ExportResolution } from '@/components/recordingQuality';
import { AspectRatioType } from '@/types/studio';
import { CameraArtEffect, ScriptLanguage } from '@/types/studio';
import { drawActiveCaption } from './captionRendering';
import { captureSourceAudio } from './captureSourceAudio';
import { TranscriptionLanguage } from './CaptionsPanel';
import { drawFreeTierWatermark, FREE_VIDEO_LIMIT_MS } from '@/components/freeTier';
import { applyArtisticEffect } from '@/components/studio/artisticEffects';
import { drawActiveOverlays } from './overlayRendering';
import { getZoomScale } from './zoom';
import { createTransitionRenderer, TransitionRenderer } from './transitionRenderer';
import { drawTransitionFrame, getInitialPerformanceMode, storePerformanceMode, TransitionSnapshots } from './transitions';
import { addDeletedRange, removeDeletedRange, getKeepRanges, skipTarget, sourceToOutput } from '@/lib/cuts';

/** Keep in sync with MAX_AUDIO_BYTES in app/api/transcribe/route.ts. */
const MAX_TRANSCRIBE_BYTES = 14 * 1024 * 1024;
const MIN_TIMELINE_HEIGHT = 180;
const MAX_TIMELINE_HEIGHT = 700;

interface EditorShellProps {
    isPro?: boolean;
    sourceVideoUrl: string;
    aspectRatio: AspectRatioType;
    initialScript: string;
    initialScriptLanguage: ScriptLanguage;
    creatorName: string;
    sourceDurationMs?: number;
    initialCameraArtEffect: CameraArtEffect;
    onBack: () => void;
    initialProject?: EditorProject;
    onDraftSaved?: () => void;
    /** Longest export the plan allows, in ms. Decided on the server. */
    exportLimitMs?: number;
}

const formatLimit = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} sec`);

export function EditorShell({
    isPro = false, sourceVideoUrl, aspectRatio, initialScript, initialScriptLanguage, creatorName,
    sourceDurationMs, initialCameraArtEffect, onBack, initialProject, onDraftSaved, exportLimitMs = FREE_VIDEO_LIMIT_MS,
}: EditorShellProps) {
    const {
        project,
        projectLoadError,
        undoCounts,
        undoTab,
        resetTab,
        applyStylePreset,
        renameProject,
        updateCameraArtEffect,
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
        getSourceAudioStream,
        addSpeedSegment,
        updateSpeedSegment,
        removeSpeedSegment,
        updateVideoEdit,
        beginVideoEdit,
        splitVideoAt,
        removeVideoSplit,
        setTransitionAt,
        addCaption,
        updateCaption,
        updateCaptionStyle,
        removeCaption,
        replaceCaptions,
    } = useEditorProject(sourceVideoUrl, initialProject, aspectRatio, initialScript, initialScriptLanguage, sourceDurationMs, initialCameraArtEffect);

    /* ------------------------------ state ------------------------------ */
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStage, setExportStage] = useState<ExportStage>('idle');
    const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
    const [exportOpen, setExportOpen] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(0);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const exportCancelRef = useRef(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [performanceMode, setPerformanceMode] = useState(getInitialPerformanceMode);

    // Draggable timeline height
    const [timelineHeight, setTimelineHeight] = useState<number>(340);
    const isDraggingTimelineRef = useRef<boolean>(false);

    /* --------------------------- small handlers ------------------------- */
    const handleMouseDownTimelineSplitter = (event: React.MouseEvent) => {
        event.preventDefault();
        isDraggingTimelineRef.current = true;

        const handleMouseMove = (mouseEvent: MouseEvent) => {
            if (!isDraggingTimelineRef.current) return;
            const nextHeight = window.innerHeight - mouseEvent.clientY - 40;
            if (nextHeight >= MIN_TIMELINE_HEIGHT && nextHeight <= MAX_TIMELINE_HEIGHT) setTimelineHeight(nextHeight);
        };

        const handleMouseUp = () => {
            isDraggingTimelineRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handlePerformanceModeChange = (enabled: boolean) => {
        setPerformanceMode(enabled);
        storePerformanceMode(enabled);
    };

    const closeExport = () => {
        setExportOpen(false);
        setExportStage('idle');
        setExportProgress(0);
    };

    const handlePreviewTransition = (atMs: number) => {
        if (!project) return;
        seekTo(Math.max(project.videoEdit.trimStartMs, atMs - 1000));
        if (!isPlaying) togglePlay();
    };

    const handleDeleteRange = (range: TimeRange) => {
        if (!project) return;
        const { trimStartMs, trimEndMs, deletedRanges } = project.videoEdit;
        const next = addDeletedRange(deletedRanges ?? [], range);
        const keptMs = getKeepRanges(trimStartMs, trimEndMs, next).reduce((sum, k) => sum + k.endMs - k.startMs, 0);
        if (keptMs < 250) return;
        beginVideoEdit();
        updateVideoEdit({ deletedRanges: next });
    };

    const handleRestoreRange = (atMs: number) => {
        if (!project) return;
        beginVideoEdit();
        updateVideoEdit({ deletedRanges: removeDeletedRange(project.videoEdit.deletedRanges ?? [], atMs) });
    };

    // Skip over deleted ranges during playback
    useEffect(() => {
        if (!project || !isPlaying || isExporting) return;
        const target = skipTarget(playheadMs, project.videoEdit.deletedRanges);
        if (target !== null) seekTo(target);
    }, [playheadMs, isPlaying, isExporting, project, seekTo]);

    const handleSaveDraft = async () => {
        if (!project || isSavingDraft) return;
        setIsSavingDraft(true);
        try {
            await saveEditorDraft(sourceVideoUrl, project, creatorName);
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

    /* ------------------------------- export ----------------------------- */
    /** Renders the edited video and returns the file. The export dialog downloads or uploads it. */
    const renderExport = async ({ forCloud }: { forCloud: boolean }): Promise<RenderResult> => {
        const video = videoRef.current;
        if (!video || !project || isExporting) throw new Error('The editor is busy. Try again in a moment.');
        if (isTranscribing) throw new Error('Wait for captions to finish generating, then export.');
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) throw new Error('The video is not ready yet. Wait for it to load, then export again.');
        if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
            throw new Error('This browser does not support canvas video export. Try the latest Chrome or Safari.');
        }
        // Shared videos are always MP4 so they play on every device.
        const format: ExportFormat = forCloud ? 'mp4' : exportFormat;

        const originalTime = video.currentTime;
        const wasPlaying = !video.paused;
        const trimStartMs = project.videoEdit.trimStartMs;
        const trimEndMs = project.videoEdit.trimEndMs;
        const keep = getKeepRanges(trimStartMs, trimEndMs, project.videoEdit.deletedRanges);
        const keptDurationMs = Math.max(1, keep.reduce((sum, k) => sum + k.endMs - k.startMs, 0));
        if (keptDurationMs > exportLimitMs) {
            throw new Error(`Your plan allows exports up to ${formatLimit(exportLimitMs)}. Trim or cut the clip in the timeline, or upgrade for longer videos.`);
        }
        const outputDimensions = getExportDimensions(project.aspectRatio, exportResolution);
        const sourceCrop = getFrameCrop(video.videoWidth, video.videoHeight, project.aspectRatio);
        const scale = outputDimensions.width / getRecordingDimensions(project.aspectRatio).width;
        let canvasStream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let animationFrameId = 0;
        let transitionSnapshots: TransitionSnapshots | null = null;
        let transitionRenderer: TransitionRenderer | null = null;
        exportCancelRef.current = false;
        setIsExporting(true);
        try {
            setExportProgress(0);
            setExportStage('preparing');

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = outputDimensions.width;
            exportCanvas.height = outputDimensions.height;
            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error('Could not create the export canvas.');

            if (project.videoEdit.transitions?.length) {
                transitionSnapshots = new TransitionSnapshots();
                transitionRenderer = createTransitionRenderer();
                await transitionSnapshots.prepare(project, exportCanvas.width, exportCanvas.height);
            }

            canvasStream = exportCanvas.captureStream(RECORDING_FRAME_RATE);
            const mixedAudioStream = getMixedAudioStream();
            const stream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...(mixedAudioStream?.getAudioTracks() ?? []),
            ]);
            recorder = createExportRecorder(stream, format, exportResolution);

            video.pause();
            if (Math.abs(video.currentTime * 1000 - trimStartMs) > 50) {
                video.currentTime = trimStartMs / 1000;
                await new Promise<void>((resolve, reject) => {
                    const timeout = window.setTimeout(() => reject(new Error('Could not seek to the start of the video.')), 5000);
                    video.addEventListener('seeked', () => {
                        window.clearTimeout(timeout);
                        resolve();
                    }, { once: true });
                });
            }
            await video.play();
            const activeRecorder = recorder;
            let recordingError: Error | null = null;
            const chunks: Blob[] = [];
            activeRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunks.push(event.data);
            };
            const recording = new Promise<Blob>((resolve, reject) => {
                activeRecorder.onerror = () => {
                    recordingError = new Error('The browser stopped encoding the video unexpectedly.');
                    if (activeRecorder.state === 'recording') activeRecorder.stop();
                };
                activeRecorder.onstop = () => {
                    if (recordingError) {
                        reject(recordingError);
                        return;
                    }
                    const mimeType = activeRecorder.mimeType || 'video/webm';
                    const blob = new Blob(chunks, { type: mimeType });
                    if (blob.size === 0) reject(new Error('The export contained no video data.'));
                    else resolve(blob);
                };
            });
            activeRecorder.start(1000);
            setExportStage('rendering');
            let lastPercent = -1;

            const stopWithError = (message: string) => {
                recordingError = new Error(message);
                if (activeRecorder.state === 'recording') activeRecorder.stop();
            };
            const renderExportFrame = () => {
                if (exportCancelRef.current) {
                    stopWithError('Export cancelled.');
                    return;
                }
                if (video.ended || video.currentTime * 1000 >= trimEndMs - 20) {
                    if (activeRecorder.state === 'recording') activeRecorder.stop();
                    return;
                }
                if (video.paused) {
                    stopWithError('Video playback paused before export finished. Try the export again.');
                    return;
                }

                const jumpMs = skipTarget(video.currentTime * 1000, project.videoEdit.deletedRanges);
                if (jumpMs !== null) {
                    video.currentTime = jumpMs / 1000;
                    animationFrameId = requestAnimationFrame(renderExportFrame);
                    return;
                }

                ctx.save();
                ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
                const currentMs = video.currentTime * 1000;
                const zoomScale = getZoomScale(project.tracks.zoom, currentMs);
                ctx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
                ctx.scale(zoomScale, zoomScale);
                ctx.translate(-exportCanvas.width / 2, -exportCanvas.height / 2);
                ctx.filter = buildColorGradeFilter(project.colorGrade);
                ctx.drawImage(video, sourceCrop.x, sourceCrop.y, sourceCrop.width, sourceCrop.height, 0, 0, exportCanvas.width, exportCanvas.height);
                ctx.filter = 'none';
                ctx.restore();

                if (transitionSnapshots) {
                    drawTransitionFrame(ctx, exportCanvas, project, currentMs, transitionSnapshots, transitionRenderer, performanceMode);
                }

                drawActiveOverlays(ctx, project.tracks.overlays, currentMs, exportCanvas.width, exportCanvas.height, scale);
                drawActiveCaption(ctx, project.tracks.captions, currentMs, project.captionStyle, exportCanvas.width, exportCanvas.height);
                applyArtisticEffect(exportCanvas, project.cameraArtEffect);
                if (!isPro) {
                    drawFreeTierWatermark(ctx, exportCanvas.width, exportCanvas.height);
                }

                const outputMs = sourceToOutput(currentMs, keep) ?? 0;
                const percent = Math.min(85, Math.floor((outputMs / keptDurationMs) * 85));
                if (percent !== lastPercent) {
                    lastPercent = percent;
                    setExportProgress(percent);
                }
                animationFrameId = requestAnimationFrame(renderExportFrame);
            };
            renderExportFrame();

            const recordedBlob = await recording;
            let outputBlob = recordedBlob;
            let extension: ExportFormat = format;
            const capturedMp4 = activeRecorder.mimeType.toLowerCase().startsWith('video/mp4');
            if (format === 'mp4' && !capturedMp4) {
                setExportStage('converting');
                const { convertWebmToMp4 } = await import('./convertToMp4');
                outputBlob = await convertWebmToMp4(recordedBlob, (progress) => setExportProgress(85 + Math.floor(progress * 0.14)));
                extension = 'mp4';
            }

            setExportProgress(100);
            setExportStage('complete');
            return { blob: outputBlob, extension };
        } catch (error) {
            console.error('Video export failed:', error);
            setExportStage('error');
            throw error instanceof Error ? error : new Error('The video could not be exported.');
        } finally {
            cancelAnimationFrame(animationFrameId);
            transitionRenderer?.dispose();
            transitionSnapshots?.dispose();
            if (recorder?.state === 'recording') recorder.stop();
            canvasStream?.getTracks().forEach((track) => track.stop());
            video.pause();
            if (Math.abs(video.currentTime - originalTime) > 0.05) video.currentTime = originalTime;
            if (wasPlaying) video.play().catch(() => undefined);
            setIsExporting(false);
        }
    };

    /* ----------------------------- captions ----------------------------- */
    const handleGenerateCaptions = async (language: TranscriptionLanguage) => {
        const video = videoRef.current;
        if (!video || !project || isTranscribing || isExporting) return;

        setIsTranscribing(true);
        setTranscriptionProgress(0);
        setTranscriptionError(null);
        try {
            const audioStream = getSourceAudioStream();
            if (!audioStream) throw new Error('Could not access the video audio track.');
            const audioBlob = await captureSourceAudio(video, audioStream, setTranscriptionProgress, project.durationMs);
            if (audioBlob.size > MAX_TRANSCRIBE_BYTES) {
                throw new Error('The extracted audio is too large to transcribe. Trim the video and try again.');
            }

            setTranscriptionProgress(0);
            const body = new FormData();
            const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
            body.append('file', audioBlob, `creator-studio-audio.${extension}`);
            body.append('language', language);
            body.append('durationSeconds', String(Math.round(project.durationMs / 1000)));
            const response = await fetch('/api/transcribe', { method: 'POST', body });

            // Read as text first: host/platform errors (e.g. 413) are often not JSON.
            const raw = await response.text();
            let result: { error?: string; words?: Array<{ word: string; start: number; end: number }> } = {};
            try { result = JSON.parse(raw); } catch { /* non-JSON response */ }
            if (!response.ok) {
                throw new Error(result.error ?? (response.status === 413
                    ? 'The audio is too large to upload. Trim the video and try again.'
                    : `Transcription failed (HTTP ${response.status}). Try again.`));
            }
            if (!result.words?.length) throw new Error('No speech was detected. Try another language setting or add captions manually.');

            let groupIndex = 0;
            let wordsInGroup = 0;
            const cues = result.words.map((word) => {
                if (wordsInGroup === 0) groupIndex += 1;
                const startMs = Math.max(0, Math.min(project.durationMs - 1, Math.round(word.start * 1000)));
                const endMs = Math.max(startMs + 80, Math.min(project.durationMs, Math.round(word.end * 1000)));
                const cue = {
                    text: word.word,
                    startMs,
                    endMs,
                    groupId: `caption-group-${groupIndex}`,
                };
                wordsInGroup += 1;
                if (wordsInGroup >= 5 || /[.!?।]$/.test(word.word.trim())) wordsInGroup = 0;
                return cue;
            }).filter((cue) => cue.endMs > cue.startMs);
            if (cues.length === 0) throw new Error('No usable word timestamps were returned.');
            replaceCaptions(cues);
            seekTo(cues[0].startMs);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Caption generation failed.';
            setTranscriptionError(message);
        } finally {
            setIsTranscribing(false);
            setTranscriptionProgress(0);
        }
    };

    const tightenToSpeech = (startMs: number, endMs: number) => {
        if (!project || endMs - startMs < 250) return;
        beginVideoEdit();
        updateVideoEdit({ trimStartMs: Math.max(0, startMs), trimEndMs: Math.min(project.durationMs, endMs) });
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, startMs) / 1000;
    };

    /* ------------------------------- render ----------------------------- */
    return (
        <div className="relative flex h-dvh flex-col overflow-hidden bg-[#F7F6FB] font-[family-name:var(--font-body)] text-[#14121F] md:flex-row">
            {project ? (
                <EditorSidebar
                    project={project}
                    undoCounts={undoCounts}
                    onUndoTab={undoTab}
                    onResetTab={resetTab}
                    onApplyStylePreset={applyStylePreset}
                    onTightenToSpeech={tightenToSpeech}
                    playheadMs={playheadMs}
                    onBack={onBack}
                    onColorGradeChange={updateColorGrade}
                    onAddOverlay={addOverlay}
                    onUpdateOverlay={updateOverlay}
                    onRemoveOverlay={removeOverlay}
                    onSetAudioTracks={setAudioTracks}
                    isSourceMuted={isSourceMuted}
                    onMuteSourceAudio={toggleSourceAudio}
                    onAddZoomKeyframe={addZoomKeyframe}
                    onUpdateZoomKeyframe={updateZoomKeyframe}
                    onRemoveZoomKeyframe={removeZoomKeyframe}
                    onAddSpeedSegment={addSpeedSegment}
                    onUpdateSpeedSegment={updateSpeedSegment}
                    onRemoveSpeedSegment={removeSpeedSegment}
                    onAddCaption={addCaption}
                    onUpdateCaption={updateCaption}
                    onRemoveCaption={removeCaption}
                    onCaptionStyleChange={updateCaptionStyle}
                    onGenerateCaptions={handleGenerateCaptions}
                    onSeek={seekTo}
                    isTranscribing={isTranscribing}
                    transcriptionProgress={transcriptionProgress}
                    transcriptionError={transcriptionError}
                />
            ) : (
                <aside className="hidden w-full shrink-0 border-r border-[#14121F]/10 bg-white p-4 md:flex md:w-[22.5rem] md:flex-col">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#14121F]/70">Edit Studio</h2>
                </aside>
            )}

            <div className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:order-2 lg:p-5">
                <EditorTopBar
                    title={project?.title ?? 'Video editor'}
                    aspectRatio={project?.aspectRatio ?? aspectRatio}
                    hasProject={Boolean(project)}
                    isPro={isPro}
                    isExporting={isExporting}
                    exportStage={exportStage}
                    exportProgress={exportProgress}
                    isSourceMuted={isSourceMuted}
                    isSavingDraft={isSavingDraft}
                    draftSaved={draftSaved}
                    cameraArtEffect={project?.cameraArtEffect ?? 'none'}
                    onTitleChange={renameProject}
                    onBack={onBack}
                    onToggleMute={toggleSourceAudio}
                    onSaveDraft={handleSaveDraft}
                    onCameraArtEffectChange={updateCameraArtEffect}
                    onExport={() => setExportOpen(true)}
                />

                <video ref={videoRef} src={sourceVideoUrl} className="hidden" playsInline />

                {project ? (
                    <div className={`flex min-h-0 flex-1 flex-col gap-0 overflow-hidden ${isExporting ? 'pointer-events-none opacity-70' : ''}`}>
                        {/* Video preview */}
                        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                            <PreviewCanvas videoRef={videoRef} project={project} performanceMode={performanceMode} isPro={isPro} />
                        </div>

                        <TimelineSplitter onMouseDown={handleMouseDownTimelineSplitter} />

                        {/* Resizable timeline */}
                        <div style={{ height: `${timelineHeight}px` }} className="flex shrink-0 flex-col overflow-y-auto transition-all duration-75">
                            <Timeline
                                durationMs={project.durationMs}
                                playheadMs={playheadMs}
                                isPlaying={isPlaying}
                                onSeek={seekTo}
                                onTogglePlay={togglePlay}
                                videoEdit={project.videoEdit}
                                onTrimChange={updateVideoEdit}
                                onTrimStart={beginVideoEdit}
                                onSplit={() => splitVideoAt(playheadMs)}
                                onRemoveSplit={removeVideoSplit}
                                onSetTransition={setTransitionAt}
                                onPreviewTransition={handlePreviewTransition}
                                onDeleteRange={handleDeleteRange}
                                onRestoreRange={handleRestoreRange}
                                performanceMode={performanceMode}
                                onPerformanceModeChange={handlePerformanceModeChange}
                            />
                        </div>

                        {project.tracks.captions.length > 0 && (
                            <div className="mt-2 max-h-40 shrink-0 overflow-y-auto">
                                <TranscriptPanel
                                    words={project.tracks.captions.map((cue) => ({ text: cue.text, startMs: cue.startMs, endMs: cue.endMs }))}
                                    playheadMs={playheadMs}
                                    deleted={project.videoEdit.deletedRanges ?? []}
                                    onSeek={seekTo}
                                    onDelete={handleDeleteRange}
                                    onRestore={handleRestoreRange}
                                />
                            </div>
                        )}
                    </div>
                ) : projectLoadError ? (
                    <EditorError message={projectLoadError} onBack={onBack} />
                ) : (
                    <EditorLoading />
                )}

                <ExportDialog
                    open={exportOpen}
                    kind="video"
                    defaultTitle={project?.title ?? 'Untitled video'}
                    durationMs={project ? getKeepRanges(project.videoEdit.trimStartMs, project.videoEdit.trimEndMs, project.videoEdit.deletedRanges).reduce((sum, range) => sum + range.endMs - range.startMs, 0) : 0}
                    facts={[project?.aspectRatio ?? aspectRatio, isPro ? 'No watermark' : 'Free plan']}
                    notice={isPro ? `Your plan exports up to ${formatLimit(exportLimitMs)}.` : `Free plan: up to ${formatLimit(exportLimitMs)}, with a small Cliprame watermark.`}
                    settings={
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Segmented label="Quality" value={exportResolution} options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p HD' }]} onChange={setExportResolution} />
                            <Segmented label="Download format" value={exportFormat} options={[{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }]} onChange={setExportFormat} />
                        </div>
                    }
                    render={renderExport}
                    renderProgress={exportProgress}
                    renderLabel={exportStage === 'converting' ? 'Encoding MP4 for every device' : exportStage === 'preparing' ? 'Preparing your edits' : 'Applying your edits frame by frame'}
                    onCancelRender={() => { exportCancelRef.current = true; }}
                    onClose={closeExport}
                />
            </div>
        </div>
    );
}