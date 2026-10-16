'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Gauge, ImagePlus, Loader2, Maximize, Play, Trash2 } from 'lucide-react';
import { exitDocumentFullscreen, requestElementFullscreen, createDefaultTrackFile } from './photoReelExtras';
import { isDepthMotion } from './depthEstimator';
import { deletePhotoReelDraft, listPhotoReelDrafts, loadPhotoReelDraft, PhotoReelDraftSummary, savePhotoReelDraft } from './photoReelDrafts';
import { DEFAULT_RIPPLE_COLOR, FxId } from './photoReelFx';
import { generateSpeechAudio } from './textToSpeech';
import { ReelAssets } from './reelAssets';
import { LoadedFile, buildDraftData, restoreAudio, restoreClips, restoreSettings } from './reelDraftData';
import { RenderContext, renderFrame } from './reelRenderer';
import { ReelSidebar } from './ReelSidebar';
import {
    PRODUCT_TEMPLATES, applyProductTemplateToClips, applyReelPresetToClips, getTemplateClipStyle, productTemplateSettings, reelPresetSettings,
} from './reelTemplates';
import { buildTimeline, clipDurationMs } from './reelTimeline';
import {
    DEFAULT_SETTINGS, DEFAULT_VIDEO_CLIP_MS, MAX_IMAGES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, ReelImage, ReelSettings, ReelTemplate,
    SPEED_PRESETS, clamp, getCanvasSize, makeId, withSpeed,
} from './reelTypes';
import { CaptionDragHandle, PreviewCanvas, RipplePlacer, UpgradeModal } from './ReelUi';
import { useDepthMaps } from './useDepthMaps';
import { useReelExport } from './useReelExport';
import { useReelPreview } from './useReelPreview';

const PRO_MOTIONS = ['depth-orbit', 'depth-sway', 'depth-dolly'];

export function PhotoReelStudio({ onBack, initialDraftId }: { onBack: () => void; initialDraftId?: string | null }) {
    /* ------------------------------ state ------------------------------ */
    const [images, setImages] = useState<ReelImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [settings, setSettings] = useState<ReelSettings>(DEFAULT_SETTINGS);
    const set = useCallback(<K extends keyof ReelSettings>(key: K, value: ReelSettings[K]) => setSettings((current) => ({ ...current, [key]: value })), []);

    const [music, setMusic] = useState<LoadedFile | null>(null);
    const [voiceover, setVoiceover] = useState<LoadedFile | null>(null);
    const [logo, setLogo] = useState<LoadedFile | null>(null);
    const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
    const [loadingTrack, setLoadingTrack] = useState<string | null>(null);
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

    const [drafts, setDrafts] = useState<PhotoReelDraftSummary[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDraggingCaption, setIsDraggingCaption] = useState(false);

    const [isProUser, setIsProUser] = useState(false); // NOTE: client-side only - enforce on the server before shipping.
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const [, setFrameTick] = useState(0);
    const redraw = useCallback(() => setFrameTick((tick) => tick + 1), []);

    /* ------------------------------ refs ------------------------------- */
    const stageRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const exportCanvasRef = useRef<HTMLCanvasElement>(null);
    const musicAudioRef = useRef<HTMLAudioElement>(null);
    const voiceAudioRef = useRef<HTMLAudioElement>(null);

    const assets = useMemo(() => new ReelAssets(), []);
    useEffect(() => {
        assets.onChange = redraw;
        return () => { assets.onChange = null; };
    }, [assets, redraw]);

    /* --------------------------- derived data -------------------------- */
    const timeline = useMemo(() => buildTimeline(images, settings.secondsPerImage), [images, settings.secondsPerImage]);
    const durationLabel = `${(timeline.total / 1000).toFixed(0)} sec`;
    const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
    const productTemplate = PRODUCT_TEMPLATES.find((item) => item.id === settings.productTemplateId) ?? null;
    const { width: canvasW, height: canvasH } = getCanvasSize(settings.aspectRatio);

    const { depthStatus, ensureDepth, resetDepth } = useDepthMaps(images, assets);

    const preview = useReelPreview({
        clips: images, timeline, assets, music, musicVolume: settings.musicVolume,
        musicAudioRef, voiceAudioRef, onError: setError, onFrame: redraw,
    });
    const { activeClip: activeImage, activeIndex, timeMs: previewTimeMs, isPlaying: isPreviewPlaying } = preview;

    const renderContext: RenderContext = { clips: images, timeline, settings, assets, logoImage };
    const renderContextRef = useRef(renderContext);
    renderContextRef.current = renderContext;
    const getRenderContext = useCallback(() => renderContextRef.current, []);

    const exporter = useReelExport({ canvasRef: exportCanvasRef, getRenderContext, music, voiceover, ensureDepth, onError: setError });

    /* ----------------------------- clip edits -------------------------- */
    const updateClip = useCallback((id: string, patch: Partial<ReelImage>) =>
        setImages((current) => current.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip))), []);
    const updateSelected = (patch: Partial<ReelImage>) => { if (selectedImageId) updateClip(selectedImageId, patch); };
    const updateAllClips = (patch: Partial<ReelImage>) => setImages((current) => current.map((clip) => ({ ...clip, ...patch })));
    const setClipSpeed = (id: string, next: number) => setImages((current) => current.map((clip) => (clip.id === id ? withSpeed(clip, next) : clip)));
    const setAllClipSpeeds = (next: number) => setImages((current) => current.map((clip) => withSpeed(clip, next)));

    const toggleFx = (id: FxId) => {
        if (!selectedImage) return;
        const current = selectedImage.fx ?? [];
        updateSelected({ fx: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] });
    };
    const applyFxPreset = (fx: FxId[], allClips: boolean) => {
        if (allClips) updateAllClips({ fx: [...fx] });
        else updateSelected({ fx: [...fx] });
    };

    const handleMotionChange = (value: string) => {
        if (PRO_MOTIONS.includes(value) && !isProUser) {
            setShowUpgradeModal(true);
            return;
        }
        updateSelected({ motion: value as ReelImage['motion'] });
    };

    /* ------------------------- add / remove / move --------------------- */
    const checkResolution = async (files: File[]) => {
        const low: string[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const bitmap = await createImageBitmap(file);
                if (Math.min(bitmap.width, bitmap.height) < 720) low.push(`${file.name} (${bitmap.width}×${bitmap.height})`);
                bitmap.close();
            } catch { /* ignore unreadable files */ }
        }
        setNotice(low.length ? `Low resolution, so it may look soft in the reel: ${low.join(', ')}. Use photos 1080 px or larger.` : null);
    };

    const addImages = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        setError(null);

        const validFiles = files.filter((file) =>
            (file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES) ||
            (file.type.startsWith('video/') && file.size <= MAX_VIDEO_BYTES));
        if (validFiles.length !== files.length) setError('Some files were skipped. Use images under 12 MB and videos under 100 MB.');

        const accepted = validFiles.slice(0, Math.max(0, MAX_IMAGES - images.length));
        if (accepted.length < validFiles.length) setError(`A reel can contain up to ${MAX_IMAGES} photos and video clips combined.`);

        const nextImages = accepted.map((file, fileIndex): ReelImage => {
            const type: ReelImage['type'] = file.type.startsWith('video/') ? 'video' : 'image';
            const baseClip: ReelImage = {
                id: makeId(),
                type,
                file,
                url: URL.createObjectURL(file),
                durationMs: type === 'image' ? settings.secondsPerImage * 1000 : DEFAULT_VIDEO_CLIP_MS,
                overlayText: '',
                description: '',
                textStyle: 'banner',
                textPosition: 'bottom',
                textOffset: { x: 0, y: 0 },
                textSize: 1,
                fontFamily: 'sans',
                scale: 1,
                motion: type === 'image' ? 'zoom-in' : 'none',
                transition: 'fade',
                rippleScale: 0.5,
                cursorScale: 1.0,
            };
            const clip = productTemplate
                ? { ...baseClip, ...getTemplateClipStyle(productTemplate, images.length + fileIndex, type) }
                : baseClip;

            if (type === 'video') {
                const video = assets.getVideo(clip);
                video.onloadedmetadata = () => {
                    const sourceDurationMs = Number.isFinite(video.duration) ? video.duration * 1000 : DEFAULT_VIDEO_CLIP_MS;
                    updateClip(clip.id, { sourceDurationMs, durationMs: Math.min(DEFAULT_VIDEO_CLIP_MS, sourceDurationMs) });
                };
                video.onerror = () => setError(`Could not load video clip ${file.name}. Try an MP4 or WebM file.`);
            }
            return clip;
        });

        setImages((current) => [...current, ...nextImages]);
        void checkResolution(accepted);
        if (!selectedImageId && nextImages[0]) setSelectedImageId(nextImages[0].id);
        if (images.length === 0 && nextImages.length > 0) preview.seek(0);
        preview.pause();
    };

    const removeImage = (id: string) => {
        const target = images.find((item) => item.id === id);
        if (!target) return;
        URL.revokeObjectURL(target.url);
        assets.forget(id);
        const remaining = images.filter((item) => item.id !== id);
        setImages(remaining);
        if (selectedImageId === id) setSelectedImageId(remaining[0]?.id ?? null);
        if (remaining.length === 0) preview.seek(0);
    };

    const moveImage = (id: string, direction: -1 | 1) => {
        const index = images.findIndex((item) => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= images.length) return;
        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        setImages(next);
    };

    const selectClip = (index: number) => {
        const clip = images[index];
        if (!clip) return;
        setSelectedImageId(clip.id);
        preview.pause();
        preview.seek(timeline.starts[index]);
    };

    /* ----------------------------- templates --------------------------- */
    const applyProductTemplate = (id: string | null) => {
        const tpl = PRODUCT_TEMPLATES.find((item) => item.id === id);
        setSettings((current) => ({ ...current, productTemplateId: id, template: 'custom', ...(tpl ? productTemplateSettings(tpl) : {}) }));
        if (tpl) setImages((current) => applyProductTemplateToClips(tpl, current));
    };

    const applyReelPreset = (template: ReelTemplate) => {
        if (template === 'custom') {
            set('template', 'custom');
            return;
        }
        setSettings((current) => ({ ...current, template, ...reelPresetSettings(template) }));
        setImages((current) => applyReelPresetToClips(template, current));
    };

    const matchBackgroundToPhoto = () => {
        if (!selectedImage || selectedImage.type !== 'image') return;
        const element = assets.getImage(selectedImage);
        if (!element.naturalWidth) return;
        try {
            const probe = document.createElement('canvas');
            probe.width = 4;
            probe.height = 4;
            const probeCtx = probe.getContext('2d', { willReadFrequently: true });
            if (!probeCtx) return;
            probeCtx.drawImage(element, 0, 0, 4, 4);
            const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
            set('backgroundColor', `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`);
        } catch {
            setError('Could not read the background color from this photo.');
        }
    };

    /* ------------------------------- audio ----------------------------- */
    const replaceFile = (previous: LoadedFile | null, file: File): LoadedFile => {
        if (previous) URL.revokeObjectURL(previous.url);
        return { file, url: URL.createObjectURL(file) };
    };

    const pickMusicFile = (file: File) => {
        if (!file.type.startsWith('audio/')) { setError('Choose an audio file for the background music.'); return; }
        setMusic((current) => replaceFile(current, file));
        setError(null);
    };

    const pickDefaultTrack = async (id: string) => {
        setLoadingTrack(id);
        try {
            const file = await createDefaultTrackFile(id);
            setMusic((current) => replaceFile(current, file));
            setError(null);
        } catch {
            setError('Could not create this music track.');
        } finally {
            setLoadingTrack(null);
        }
    };

    const pickVoiceFile = (file: File) => {
        if (!file.type.startsWith('audio/')) { setError('Choose an audio file (MP3, WAV) for the voiceover.'); return; }
        setVoiceover((current) => replaceFile(current, file));
        setError(null);
        setNotice('Custom voiceover loaded from your computer.');
    };

    const pickLogoFile = (file: File) => {
        if (!file.type.startsWith('image/')) { setError('Choose an image file (PNG with a transparent background works best) for the logo.'); return; }
        setLogo((current) => replaceFile(current, file));
        setError(null);
    };

    const removeFile = (current: LoadedFile | null, clear: (value: null) => void) => {
        if (current) URL.revokeObjectURL(current.url);
        clear(null);
    };

    const handleGenerateNarration = async () => {
        if (!settings.narrationText.trim() || isGeneratingVoice) return;
        setIsGeneratingVoice(true);
        setError(null);
        setNotice(null);
        try {
            const result = await generateSpeechAudio(settings.narrationText, settings.narrationLanguage, settings.narrationVoiceGender);
            setVoiceover((current) => {
                if (current) URL.revokeObjectURL(current.url);
                return result;
            });
            const voiceMs = await new Promise<number>((resolve) => {
                const probe = new Audio(result.url);
                probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration * 1000 : 0);
                probe.onerror = () => resolve(0);
            });
            if (timeline.total > 0 && voiceMs > timeline.total + 500) {
                setNotice(`The voiceover is ${(voiceMs / 1000).toFixed(1)}s but your reel is ${(timeline.total / 1000).toFixed(1)}s, so the end will be cut off.`);
            } else {
                setNotice('Voiceover ready. Press Play preview to hear it with your reel.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not generate speech.');
        } finally {
            setIsGeneratingVoice(false);
        }
    };

    /* ------------------------------ drafts ----------------------------- */
    const refreshDrafts = async () => setDrafts(await listPhotoReelDrafts());

    const saveDraft = async () => {
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        setError(null);
        try {
            const id = currentDraftId ?? makeId();
            const savedAt = Date.now();
            const stamp = new Date(savedAt).toLocaleString();
            const summary: PhotoReelDraftSummary = {
                id,
                title: images.length ? `Photo + video reel · ${stamp}` : `Untitled reel · ${stamp}`,
                savedAt,
                clipCount: images.length,
                durationMs: timeline.total,
            };
            const data = buildDraftData(settings, images, music, voiceover, logo);
            await savePhotoReelDraft({ ...summary, data: data as any });
            setCurrentDraftId(id);
            await refreshDrafts();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this reel draft.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const openDraft = async (id: string) => {
        if (isLoadingDraft) return;
        setIsLoadingDraft(true);
        setError(null);
        preview.pause();
        try {
            const draft = await loadPhotoReelDraft(id);
            const saved = draft.data as any;

            images.forEach((clip) => URL.revokeObjectURL(clip.url));
            [music, voiceover, logo].forEach((item) => item && URL.revokeObjectURL(item.url));
            assets.reset();
            resetDepth();

            const clips = restoreClips(saved.clips as any[], assets);
            setImages(clips);
            setSelectedImageId(clips[0]?.id ?? null);
            setSettings(restoreSettings(saved));
            setMusic(restoreAudio(saved.music));
            setVoiceover(restoreAudio(saved.voiceover));
            setLogo(restoreAudio(saved.logo));
            preview.seek(0);
            setCurrentDraftId(draft.id);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not open this reel draft.');
        } finally {
            setIsLoadingDraft(false);
        }
    };

    const removeDraft = async (id: string) => {
        try {
            await deletePhotoReelDraft(id);
            await refreshDrafts();
            if (currentDraftId === id) setCurrentDraftId(null);
        } catch {
            setError('Could not delete this saved reel draft.');
        }
    };

    /* --------------------------- caption dragging ---------------------- */
    const handleCaptionPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!activeImage) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelectedImageId(activeImage.id);
        setIsDraggingCaption(true);
    };
    const handleCaptionPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingCaption || !activeImage || !frameRef.current) return;
        const rect = frameRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const current = activeImage.textOffset ?? { x: 0, y: 0 };
        updateClip(activeImage.id, {
            textOffset: {
                x: clamp(current.x + (event.movementX / rect.width) * 100, -45, 45),
                y: clamp(current.y + (event.movementY / rect.height) * 100, -50, 50),
            },
        });
    };
    const handleCaptionPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDraggingCaption(false);
    };

    /* ----------------------------- fullscreen -------------------------- */
    const toggleFullscreen = async () => {
        try {
            if (isFullscreen) await exitDocumentFullscreen();
            else {
                await requestElementFullscreen(stageRef.current);
                if (images.length && !isPreviewPlaying) preview.toggle();
            }
        } catch {
            setError('Fullscreen is not available in this browser.');
        }
    };

    useEffect(() => {
        const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    /* ------------------------------ lifecycle -------------------------- */
    useEffect(() => {
        if (!selectedImageId) return;
        document.getElementById(`clip-tile-${selectedImageId}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, [selectedImageId]);

    useEffect(() => {
        if (!logo) { setLogoImage(null); return; }
        const element = new Image();
        element.onload = () => setLogoImage(element);
        element.src = logo.url;
    }, [logo]);

    // Opens a draft picked on the studio home screen, once.
    const openedInitialDraftRef = useRef(false);
    useEffect(() => {
        if (!initialDraftId || openedInitialDraftRef.current) return;
        openedInitialDraftRef.current = true;
        void openDraft(initialDraftId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialDraftId]);

    useEffect(() => {
        let cancelled = false;
        listPhotoReelDrafts()
            .then((items) => { if (!cancelled) setDrafts(items); })
            .catch(() => { if (!cancelled) setError('Could not load saved reel drafts.'); });
        return () => { cancelled = true; };
    }, []);

    const latest = useRef({ images, music, voiceover, logo });
    latest.current = { images, music, voiceover, logo };
    useEffect(() => () => {
        const { images: clips, music: m, voiceover: v, logo: l } = latest.current;
        clips.forEach((clip) => URL.revokeObjectURL(clip.url));
        [m, v, l].forEach((item) => item && URL.revokeObjectURL(item.url));
        assets.dispose();
    }, [assets]);

    /* ------------------------------ layout ----------------------------- */
    const activeUsesDepth = activeImage?.type === 'image' && isDepthMotion(activeImage.motion);
    const activeDepthLoading = Boolean(activeImage && activeUsesDepth && !depthStatus[activeImage.id]);

    const frameH = isFullscreen ? 'h-[92dvh]' : 'h-[min(46dvh,34rem)]';
    const frameSizeClass = settings.aspectRatio === '9:16' ? `${frameH} aspect-9/16`
        : settings.aspectRatio === '1:1' ? `${frameH} aspect-square`
            : settings.aspectRatio === '4:5' ? `${frameH} aspect-4/5`
                : isFullscreen ? 'w-full max-h-[92dvh] aspect-video' : 'w-full aspect-video';

    const speedOf = (clip: ReelImage) => clip.speed ?? 1;

    return (
        <main className="grain flex min-h-dvh flex-col bg-[#14121F] font-[family-name:var(--font-body)] text-[#14121F] lg:h-dvh lg:flex-row lg:overflow-hidden">
            <ReelSidebar
                onBack={onBack}
                settings={settings}
                set={set}
                productTemplate={productTemplate}
                onPickProductTemplate={applyProductTemplate}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                onApplyReelPreset={applyReelPreset}
                images={images}
                selectedImage={selectedImage}
                durationLabel={durationLabel}
                onAddClick={() => imageInputRef.current?.click()}
                onSelectShot={(index) => (images[index] ? selectClip(index) : imageInputRef.current?.click())}
                updateSelected={updateSelected}
                updateAllClips={updateAllClips}
                onMotionChange={handleMotionChange}
                onMatchBackground={matchBackgroundToPhoto}
                depthStatus={depthStatus}
                toggleFx={toggleFx}
                applyFxPreset={applyFxPreset}
                drafts={drafts}
                currentDraftId={currentDraftId}
                isSavingDraft={isSavingDraft}
                isLoadingDraft={isLoadingDraft}
                isExporting={exporter.isExporting}
                onSaveDraft={() => void saveDraft()}
                onOpenDraft={(id) => void openDraft(id)}
                onRemoveDraft={(id) => void removeDraft(id)}
                logo={logo}
                onPickLogo={pickLogoFile}
                onRemoveLogo={() => removeFile(logo, setLogo)}
                music={music}
                musicAudioRef={musicAudioRef}
                loadingTrack={loadingTrack}
                onPickDefaultTrack={(id) => void pickDefaultTrack(id)}
                onPickMusicFile={pickMusicFile}
                onRemoveMusic={() => removeFile(music, setMusic)}
                voiceover={voiceover}
                voiceAudioRef={voiceAudioRef}
                isGeneratingVoice={isGeneratingVoice}
                onGenerateVoice={() => void handleGenerateNarration()}
                onPickVoiceFile={pickVoiceFile}
                onRemoveVoice={() => removeFile(voiceover, setVoiceover)}
            />

            <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple onChange={addImages} className="hidden" />

            <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col items-center overflow-y-auto p-4 lg:min-h-0 lg:p-8">
                <div className="my-auto flex w-full flex-col items-center gap-4">
                    <div className="flex w-full max-w-4xl items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold uppercase tracking-wider text-white/70">Reel preview</h2>
                            <p className="text-xs font-medium text-white/50">{images.length} clips · {durationLabel}</p>
                        </div>
                        {images.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={preview.toggle} className="flex items-center gap-2 rounded-xl border border-[#14121F]/15 bg-white px-4 py-2 text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]/40 hover:bg-gray-100">
                                    <Play className="h-3.5 w-3.5 text-[#6A4CFF]" />
                                    {isPreviewPlaying ? 'Pause preview' : 'Play preview'}
                                </button>
                                <button type="button" onClick={() => void toggleFullscreen()} className="flex items-center gap-2 rounded-xl border border-[#14121F]/15 bg-white px-4 py-2 text-xs font-semibold text-[#14121F] shadow-xs transition hover:border-[#6A4CFF]/40 hover:bg-gray-100">
                                    <Maximize className="h-3.5 w-3.5 text-[#6A4CFF]" /> Fullscreen
                                </button>
                            </div>
                        )}
                    </div>

                    <div
                        ref={stageRef}
                        className={`relative flex select-none items-center justify-center overflow-hidden ${isFullscreen
                            ? 'h-dvh w-dvw bg-black'
                            : 'max-h-[54dvh] min-h-72 w-full max-w-4xl rounded-3xl border border-[#14121F]/10 bg-[#F7F6FB] p-5 shadow-sm'}`}
                    >
                        <div
                            ref={frameRef}
                            className={`relative flex items-center justify-center overflow-hidden rounded-2xl shadow-xl ${frameSizeClass}`}
                            style={{ backgroundColor: settings.backgroundColor, containerType: 'inline-size' }}
                        >
                            {/* Same renderer as the export, so preview === output. */}
                            <PreviewCanvas
                                width={canvasW}
                                height={canvasH}
                                draw={(ctx) => renderFrame(ctx, renderContext, previewTimeMs, { watermark: true })}
                            />

                            {!activeImage && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs font-semibold text-black/40">
                                    <span><ImagePlus className="mx-auto mb-3 h-8 w-8 text-black/30" />Add product photos or videos</span>
                                </div>
                            )}

                            {activeDepthLoading && (
                                <div className="pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendering 3D camera angles…
                                </div>
                            )}

                            {activeImage && (
                                <>
                                    {!isPreviewPlaying && selectedImageId === activeImage.id && (
                                        <>
                                            {activeImage.fx?.includes('ripple-effect') && (
                                                <RipplePlacer
                                                    frameRef={frameRef}
                                                    label="Drag to place the ripple"
                                                    x={activeImage.rippleTargetX ?? 0.5}
                                                    y={activeImage.rippleTargetY ?? 0.4}
                                                    color={activeImage.rippleColor ?? DEFAULT_RIPPLE_COLOR}
                                                    onChange={(x, y) => updateClip(activeImage.id, { rippleTargetX: x, rippleTargetY: y })}
                                                />
                                            )}
                                            {activeImage.fx?.includes('cursor-click') && (
                                                <RipplePlacer
                                                    frameRef={frameRef}
                                                    label="Drag to place the cursor click"
                                                    x={activeImage.cursorTargetX ?? 0.5}
                                                    y={activeImage.cursorTargetY ?? 0.4}
                                                    color={activeImage.cursorColor ?? '#6A4CFF'}
                                                    onChange={(x, y) => updateClip(activeImage.id, { cursorTargetX: x, cursorTargetY: y })}
                                                />
                                            )}
                                        </>
                                    )}
                                    {activeImage.overlayText && (
                                        <CaptionDragHandle
                                            clip={activeImage}
                                            onPointerDown={handleCaptionPointerDown}
                                            onPointerMove={handleCaptionPointerMove}
                                            onPointerUp={handleCaptionPointerUp}
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        {isFullscreen && (
                            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur">
                                <button type="button" onClick={preview.toggle} aria-label="Play or pause" className="rounded-full p-2 text-white hover:bg-white/15"><Play className="h-4 w-4" /></button>
                                <button type="button" onClick={() => void toggleFullscreen()} aria-label="Exit fullscreen" className="rounded-full p-2 text-white hover:bg-white/15"><Maximize className="h-4 w-4" /></button>
                            </div>
                        )}
                    </div>

                    {images.length > 0 && (
                        <div className="w-full max-w-4xl rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                            <div className="mb-2.5 flex justify-between font-mono text-xs font-semibold text-[#14121F]/70">
                                <span>Clip {activeIndex + 1} of {images.length}</span>
                                <span>{(previewTimeMs / 1000).toFixed(1)}s / {(timeline.total / 1000).toFixed(1)}s</span>
                            </div>
                            <input type="range" min={0} max={Math.max(timeline.total, 1)} step={100} value={Math.min(previewTimeMs, timeline.total)} onChange={(event) => preview.seek(Number(event.target.value))} className="h-1.5 w-full cursor-pointer rounded-full bg-[#14121F]/10 accent-[#6A4CFF]" />
                        </div>
                    )}

                    {images.length > 0 && (
                        <div className="w-full max-w-4xl rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#14121F]/70">Timeline <span className="text-[#14121F]/40">({images.length}/{MAX_IMAGES})</span></h3>
                                <span className="font-mono text-xs font-semibold text-[#14121F]/60">{durationLabel}</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {images.map((image, index) => {
                                    const speed = speedOf(image);
                                    const selected = selectedImageId === image.id;
                                    return (
                                        <div
                                            id={`clip-tile-${image.id}`}
                                            key={image.id}
                                            className={`w-28 shrink-0 rounded-xl border p-1.5 transition ${selected ? 'border-[#6A4CFF] bg-[#6A4CFF]/5 ring-2 ring-[#6A4CFF]/30' : 'border-[#14121F]/10 bg-white hover:border-[#6A4CFF]/40'}`}
                                        >
                                            <button type="button" onClick={() => selectClip(index)} aria-label={`Select clip ${index + 1}`} className="relative block h-20 w-full overflow-hidden rounded-lg bg-[#14121F]/5">
                                                {image.type === 'video'
                                                    ? <video src={image.url} muted playsInline className="h-full w-full object-cover" />
                                                    : <img src={image.url} alt="" className="h-full w-full object-cover" />}
                                                <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                                                {speed !== 1 && <span className="absolute right-1 top-1 rounded-md bg-[#6A4CFF] px-1.5 py-0.5 text-[10px] font-bold text-white">{Number(speed.toFixed(2))}x</span>}
                                                {image.type === 'video' && <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">🎥</span>}
                                                <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{(clipDurationMs(image, settings.secondsPerImage) / 1000).toFixed(1)}s</span>
                                            </button>
                                            <div className="mt-1.5 flex items-center justify-between">
                                                <button type="button" onClick={() => moveImage(image.id, -1)} disabled={index === 0} aria-label="Move earlier" className="rounded-md p-1 text-[#14121F]/50 hover:bg-[#14121F]/10 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                                                <button type="button" onClick={() => removeImage(image.id)} aria-label="Remove clip" className="rounded-md p-1 text-[#14121F]/40 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                                <button type="button" onClick={() => moveImage(image.id, 1)} disabled={index === images.length - 1} aria-label="Move later" className="rounded-md p-1 text-[#14121F]/50 hover:bg-[#14121F]/10 disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <button type="button" onClick={() => imageInputRef.current?.click()} disabled={images.length >= MAX_IMAGES} className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#14121F]/25 text-[11px] font-semibold text-[#14121F]/60 transition hover:border-[#6A4CFF] hover:bg-[#6A4CFF]/5 hover:text-[#6A4CFF] disabled:opacity-40">
                                    <ImagePlus className="h-5 w-5" /> Add clip
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedImage && (
                        <div className="w-full max-w-4xl space-y-3 rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                            <div className="flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#14121F]/70">
                                    <Gauge className="h-4 w-4 text-[#6A4CFF]" /> Clip {images.findIndex((item) => item.id === selectedImage.id) + 1} speed
                                </h3>
                                <span className="font-mono text-sm font-bold text-[#6A4CFF]">{Number(speedOf(selectedImage).toFixed(2))}x</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {SPEED_PRESETS.map((value) => {
                                    const on = Math.abs(speedOf(selectedImage) - value) < 0.001;
                                    return (
                                        <button key={value} type="button" onClick={() => setClipSpeed(selectedImage.id, value)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-[#6A4CFF] bg-[#6A4CFF] text-white' : 'border-[#14121F]/15 bg-white text-[#14121F]/80 hover:border-[#6A4CFF]/60'}`}>
                                            {value === 0.25 ? '0.25x 🐌' : value === 4 ? '4x 🚀' : `${value}x`}
                                        </button>
                                    );
                                })}
                            </div>

                            <input type="range" min={0.25} max={4} step={0.05} value={speedOf(selectedImage)} onChange={(event) => setClipSpeed(selectedImage.id, Number(event.target.value))} aria-label="Clip speed" className="h-1.5 w-full cursor-pointer rounded-full bg-[#14121F]/10 accent-[#6A4CFF]" />

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] leading-relaxed text-[#14121F]/55">
                                    {selectedImage.type === 'video'
                                        ? 'Slow-mo or fast-forward. The clip length adjusts automatically.'
                                        : 'Faster means a shorter clip with quicker camera motion.'}
                                </p>
                                <button type="button" onClick={() => setAllClipSpeeds(speedOf(selectedImage))} className="rounded-xl border border-[#14121F]/15 bg-[#F7F6FB] px-3 py-2 text-xs font-semibold text-[#14121F]/80 transition hover:border-[#6A4CFF]">
                                    Apply speed to all clips
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#14121F]/10 bg-white p-4 shadow-xs">
                        <div className="text-xs font-semibold text-[#14121F]/70">{durationLabel} total</div>
                        <button type="button" onClick={() => void exporter.run()} disabled={!images.length || exporter.isExporting} className="flex items-center gap-2 rounded-xl bg-[#6A4CFF] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#6A4CFF]/20 transition hover:bg-[#5839e0] disabled:opacity-50">
                            {exporter.isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {exporter.isExporting ? `Rendering (${exporter.progress}%)...` : 'Create & download reel'}
                        </button>
                    </div>

                    {exporter.isExporting && exporter.status && <p className="w-full max-w-4xl text-xs font-medium text-white/70">{exporter.status}</p>}
                    {notice && <p role="status" className="w-full max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-800 shadow-xs">{notice}</p>}
                    {error && <p role="alert" className="w-full max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-600 shadow-xs">{error}</p>}
                </div>

                {showUpgradeModal && (
                    <UpgradeModal
                        onUpgrade={() => { setIsProUser(true); setShowUpgradeModal(false); }}
                        onClose={() => setShowUpgradeModal(false)}
                    />
                )}

                {/* Hidden canvas used only by the exporter */}
                <canvas ref={exportCanvasRef} className="hidden" />
            </section>
        </main>
    );
}
