'use client';

import React, { useEffect, useRef, useState } from 'react'; // CUT: useEffect
import { Download, ArrowLeft, Loader2, Volume2, VolumeX, Bookmark, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useEditorProject } from '@/hooks/useEditorProject';
import { PreviewCanvas } from './PreviewCanvas';
import { Timeline } from './Timeline';
import { TranscriptPanel } from './TranscriptPanel'; // CUT
import { EditorSidebar } from './EditorSidebar';
import { buildColorGradeFilter } from './colorGrade';
import { saveEditorDraft } from './drafts';
import { EditorProject, TimeRange } from '@/types/editor'; // CUT: TimeRange
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
import { addDeletedRange, removeDeletedRange, getKeepRanges, skipTarget, sourceToOutput } from '@/lib/cuts'; // CUT

interface EditorShellProps {
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
}

export function EditorShell({ sourceVideoUrl, aspectRatio, initialScript, initialScriptLanguage, creatorName, sourceDurationMs, initialCameraArtEffect, onBack, initialProject, onDraftSaved }: EditorShellProps) {
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

    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStage, setExportStage] = useState<'idle' | 'preparing' | 'rendering' | 'converting' | 'saving' | 'complete' | 'error'>('idle');
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(0);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const exportCancelRef = useRef(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [performanceMode, setPerformanceMode] = useState(getInitialPerformanceMode);

    const handlePerformanceModeChange = (enabled: boolean) => {
        setPerformanceMode(enabled);
        storePerformanceMode(enabled);
    };

    const handlePreviewTransition = (atMs: number) => {
        if (!project) return;
        seekTo(Math.max(project.videoEdit.trimStartMs, atMs - 1000));
        if (!isPlaying) togglePlay();
    };

    // CUT: remove a section and join the rest
    const handleDeleteRange = (range: TimeRange) => {
        if (!project) return;
        const { trimStartMs, trimEndMs, deletedRanges } = project.videoEdit;
        const next = addDeletedRange(deletedRanges ?? [], range);
        const keptMs = getKeepRanges(trimStartMs, trimEndMs, next).reduce((sum, k) => sum + k.endMs - k.startMs, 0);
        if (keptMs < 250) return; // never delete everything
        beginVideoEdit();
        updateVideoEdit({ deletedRanges: next });
    };

    // CUT: bring a removed section back
    const handleRestoreRange = (atMs: number) => {
        if (!project) return;
        beginVideoEdit();
        updateVideoEdit({ deletedRanges: removeDeletedRange(project.videoEdit.deletedRanges ?? [], atMs) });
    };

    // CUT: preview jumps over removed sections while playing
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

    const handleDownload = async () => {
        const video = videoRef.current;
        if (!video || !project || isExporting || isTranscribing) return;
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            setExportError('The video is not ready yet. Wait for it to load, then export again.');
            setExportStage('error');
            return;
        }
        if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
            setExportError('This browser does not support canvas video export. Try the latest Chrome or Safari.');
            setExportStage('error');
            return;
        }

        const originalTime = video.currentTime;
        const wasPlaying = !video.paused;
        const trimStartMs = project.videoEdit.trimStartMs;
        const trimEndMs = project.videoEdit.trimEndMs;
        // CUT: length after removed sections
        const keep = getKeepRanges(trimStartMs, trimEndMs, project.videoEdit.deletedRanges);
        const keptDurationMs = Math.max(1, keep.reduce((sum, k) => sum + k.endMs - k.startMs, 0));
        if (keptDurationMs > FREE_VIDEO_LIMIT_MS) {
            setExportError('The free plan supports exports up to 60 seconds. Trim or cut the clip in the timeline or upgrade when billing is configured.');
            setExportStage('error');
            return;
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
            setExportError(null);
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
            recorder = createExportRecorder(stream, exportFormat, exportResolution);

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

                // CUT: skip removed sections, so picture and audio are both cut
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
                drawFreeTierWatermark(ctx, exportCanvas.width, exportCanvas.height);

                // CUT: progress measured on the joined timeline
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
            let extension: ExportFormat = exportFormat;
            const capturedMp4 = activeRecorder.mimeType.toLowerCase().startsWith('video/mp4');
            if (exportFormat === 'mp4' && !capturedMp4) {
                setExportStage('converting');
                const { convertWebmToMp4 } = await import('./convertToMp4');
                outputBlob = await convertWebmToMp4(recordedBlob, (progress) => setExportProgress(85 + Math.floor(progress * 0.14)));
                extension = 'mp4';
            }

            setExportStage('saving');
            const url = URL.createObjectURL(outputBlob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `creator-studio-edited-${Date.now()}.${extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            setExportProgress(100);
            setExportStage('complete');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'The video could not be exported.';
            console.error('Video export failed:', error);
            setExportError(message);
            setExportStage('error');
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
            if (audioBlob.size > 25 * 1024 * 1024) {
                throw new Error('The extracted audio exceeds the 25 MB transcription limit.');
            }

            setTranscriptionProgress(0);
            const body = new FormData();
            const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
            body.append('file', audioBlob, `creator-studio-audio.${extension}`);
            body.append('language', language);
            const response = await fetch('/api/transcribe', { method: 'POST', body });
            const result = await response.json() as {
                error?: string;
                words?: Array<{ word: string; start: number; end: number }>;
            };
            if (!response.ok) throw new Error(result.error ?? 'Transcription failed. Try again.');
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

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[#14121F] font-[family-name:var(--font-body)] text-[#14121F] md:flex-row relative grain">
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
                <aside className="hidden w-full shrink-0 border-r border-[#14121F]/10 bg-[#F7F6FB] p-4 md:flex md:w-72 md:flex-col">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-[#14121F]/70">Edit Studio</h2>
                </aside>
            )}

            <div className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:order-2 lg:p-5">
                {/* Top Floating Glass Header */}
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB]/90 px-4 py-2.5 backdrop-blur-xl shadow-sm rise md:mb-4 md:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            onClick={onBack}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 rounded-xl border border-[#14121F]/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#14121F]/80 transition hover:bg-white hover:border-[#6A4CFF]/40 disabled:opacity-50 shadow-xs">
                            <ArrowLeft className="h-3.5 w-3.5 text-[#14121F]/60" /> <span className="hidden sm:inline">Studio</span>
                        </button>
                        <div className="min-w-0 border-l border-[#14121F]/15 pl-3">
                            <input value={project?.title ?? 'Video editor'} onChange={(event) => renameProject(event.target.value)} aria-label="Project name" maxLength={80}
                                className="w-32 max-w-[32vw] truncate border-b border-transparent bg-transparent text-xs font-bold text-[#14121F] hover:border-[#14121F]/20 focus:border-[#6A4CFF] focus:outline-none sm:w-44" />
                            <p className="text-[10px] font-medium text-[#14121F]/50">{project?.aspectRatio ?? aspectRatio} frame</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:hidden">
                        <button type="button" onClick={() => setShowMoreOptions((open) => !open)} aria-expanded={showMoreOptions} aria-label="More options" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#14121F]/15 bg-white text-[#14121F] shadow-xs"><MoreHorizontal className="h-4 w-4" /></button>
                        <button onClick={handleDownload} disabled={isExporting || !project} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#6A4CFF] px-3 text-xs font-semibold text-white disabled:opacity-50 shadow-xs">{isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{isExporting ? 'Export…' : 'Export'}</button>
                    </div>

                    <div className={`${showMoreOptions ? 'grid grid-cols-2' : 'hidden'} w-full gap-2 md:flex md:w-auto md:flex-wrap md:items-center md:gap-2`}>
                        <div className="relative">
                            <label className="sr-only" htmlFor="editor-art-effect">Cartoon filter</label>
                            <select
                                id="editor-art-effect"
                                value={project?.cameraArtEffect === 'avatar' ? 'none' : project?.cameraArtEffect ?? 'none'}
                                onChange={(event) => updateCameraArtEffect(event.target.value as CameraArtEffect)}
                                disabled={isExporting || !project}
                                className="w-full appearance-none rounded-xl border md:w-auto md:max-w-28 border-[#14121F]/15 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none disabled:opacity-50 shadow-xs cursor-pointer"
                                title="On-device cartoon and sketch effects">
                                <option value="none">Original</option>
                                <option value="comic">Comic</option>
                                <option value="sketch">Sketch</option>
                                <option value="pixel">Pixel</option>
                                <option value="anime">Anime</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                        </div>

                        <button
                            onClick={toggleSourceAudio}
                            disabled={isExporting}
                            aria-label={isSourceMuted ? 'Unmute original video audio' : 'Mute original video audio'}
                            className="flex items-center gap-1.5 rounded-xl border border-[#14121F]/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14121F]/80 transition-colors hover:border-[#6A4CFF] hover:bg-white disabled:opacity-50 shadow-xs">
                            {isSourceMuted ? <VolumeX className="h-3.5 w-3.5 text-[#14121F]/40" /> : <Volume2 className="h-3.5 w-3.5 text-[#6A4CFF]" />}
                            <span className="hidden xl:inline">{isSourceMuted ? 'Unmute' : 'Mute'}</span>
                        </button>

                        <button
                            onClick={handleSaveDraft}
                            disabled={!project || isSavingDraft || isExporting}
                            className="flex items-center gap-1.5 rounded-xl border border-[#14121F]/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#14121F]/80 transition-colors hover:border-[#6A4CFF] hover:bg-white disabled:opacity-50 shadow-xs">
                            {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6A4CFF]" /> : <Bookmark className="h-3.5 w-3.5 text-[#6A4CFF]" />}
                            <span className="hidden xl:inline">{isSavingDraft ? 'Saving…' : draftSaved ? 'Saved' : 'Draft'}</span>
                        </button>

                        <div className="relative">
                            <label className="sr-only" htmlFor="export-resolution">Export resolution</label>
                            <select
                                id="export-resolution"
                                value={exportResolution}
                                onChange={(event) => setExportResolution(event.target.value as ExportResolution)}
                                disabled={isExporting}
                                className="appearance-none rounded-xl border border-[#14121F]/15 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none disabled:opacity-50 shadow-xs cursor-pointer">
                                <option value="720p">720p</option>
                                <option value="1080p">1080p</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                        </div>

                        <div className="relative">
                            <label className="sr-only" htmlFor="export-format">Export format</label>
                            <select
                                id="export-format"
                                value={exportFormat}
                                onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                                disabled={isExporting}
                                className="appearance-none rounded-xl border border-[#14121F]/15 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-[#14121F] focus:border-[#6A4CFF] focus:outline-none disabled:opacity-50 shadow-xs cursor-pointer">
                                <option value="mp4">MP4</option>
                                <option value="webm">WebM</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#14121F]/50" />
                        </div>

                        <button
                            onClick={handleDownload}
                            disabled={isExporting || !project}
                            className="hidden items-center gap-1.5 rounded-xl bg-[#6A4CFF] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#6A4CFF]/20 transition-colors hover:bg-[#5839e0] disabled:opacity-50 md:flex">
                            {isExporting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>{exportStage === 'converting' ? 'Encoding…' : exportStage === 'saving' ? 'Saving…' : 'Rendering…'}</span>
                                </>
                            ) : (
                                <>
                                    <Download className="h-3.5 w-3.5" /> <span>Export</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {(isExporting || exportStage === 'complete' || exportError) && (
                    <div className="mb-3 rounded-2xl border border-[#14121F]/10 bg-[#F7F6FB] px-4 py-3 shadow-sm" role="status" aria-live="polite">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
                            <span className={exportError ? 'text-red-600' : exportStage === 'complete' ? 'text-emerald-600' : 'text-[#14121F]'}>
                                {exportError ?? (exportStage === 'preparing' ? 'Preparing export…' : exportStage === 'rendering' ? `Rendering video · ${exportProgress}%` : exportStage === 'converting' ? `Encoding MP4 · ${exportProgress}%` : exportStage === 'saving' ? 'Saving file…' : 'Export complete')}
                            </span>
                            {isExporting && exportStage === 'rendering' && (
                                <button type="button" onClick={() => { exportCancelRef.current = true; }} className="text-[#14121F]/50 hover:text-[#14121F]">Cancel</button>
                            )}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#14121F]/10" role="progressbar" aria-valuenow={exportProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Video export progress">
                            <div className={`h-full rounded-full transition-[width] duration-200 ${exportError ? 'bg-red-500' : exportStage === 'complete' ? 'bg-emerald-500' : 'bg-[#6A4CFF]'}`} style={{ width: `${exportProgress}%` }} />
                        </div>
                    </div>
                )}

                <video ref={videoRef} src={sourceVideoUrl} className="hidden" playsInline />

                {project ? (
                    <div className={`flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden ${isExporting ? 'pointer-events-none opacity-70' : ''}`}>
                        <PreviewCanvas videoRef={videoRef} project={project} performanceMode={performanceMode} />
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
                            onDeleteRange={handleDeleteRange}   // CUT
                            onRestoreRange={handleRestoreRange} // CUT
                            performanceMode={performanceMode}
                            onPerformanceModeChange={handlePerformanceModeChange}
                        />
                        {/* CUT: clickable script, shown once captions exist */}
                        {project.tracks.captions.length > 0 && (
                            <div className="max-h-40 shrink-0 overflow-y-auto">
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
                    <div className="flex flex-1 items-center justify-center p-6">
                        <div role="alert" className="w-full max-w-lg rounded-3xl border border-red-200 bg-[#F7F6FB] p-6 text-center shadow-lg">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-[#14121F]">This video could not be opened</h2>
                            <p className="mt-2 text-xs leading-relaxed text-[#14121F]/60">{projectLoadError}</p>
                            <button type="button" onClick={onBack} className="mt-5 rounded-xl bg-[#6A4CFF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#5839e0] shadow-sm">Back to studio</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-xs font-medium text-[#14121F]/50">
                        Loading video metadata…
                    </div>
                )}
            </div>
        </div>
    );
}