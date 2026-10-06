'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowDown, ArrowUp, Download, FolderOpen, ImagePlus, Loader2, Music2, Play, Save, Sparkles, Trash2 } from 'lucide-react';
import { AspectRatioType } from '@/types/studio';
import { createExportRecorder, getExportDimensions, RECORDING_FRAME_RATE } from '@/components/recordingQuality';
import { drawFreeTierWatermark, FREE_VIDEO_LIMIT_MS } from '@/components/freeTier';
import { TextOverlayStyle } from '@/types/editor';
import { deletePhotoReelDraft, listPhotoReelDrafts, loadPhotoReelDraft, PhotoReelDraftSummary, savePhotoReelDraft } from './photoReelDrafts';

interface ReelImage {
    id: string;
    type: 'image' | 'video';
    file: File;
    url: string;
    durationMs: number;
    sourceDurationMs?: number;
    overlayText: string;
    description: string;
    textStyle: TextOverlayStyle;
    textPosition: 'top' | 'center' | 'bottom';
    motion: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
    transition: 'cut' | 'fade' | 'slide' | 'zoom';
}

type GradientPreset = 'none' | 'sunset' | 'violet' | 'ocean' | 'warm';
type ReelTemplate = 'custom' | 'travel' | 'birthday' | 'product' | 'festival';

const GRADIENTS: Array<{ id: GradientPreset; label: string; colors: [string, string] }> = [
    { id: 'none', label: 'None', colors: ['0,0,0', '0,0,0'] },
    { id: 'sunset', label: 'Sunset', colors: ['249,115,22', '190,24,93'] },
    { id: 'violet', label: 'Violet', colors: ['124,58,237', '30,64,175'] },
    { id: 'ocean', label: 'Ocean', colors: ['8,145,178', '30,58,138'] },
    { id: 'warm', label: 'Warm', colors: ['234,179,8', '220,38,38'] },
];

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const DEFAULT_VIDEO_CLIP_MS = 5000;

export function PhotoReelStudio({ onBack }: { onBack: () => void }) {
    const [images, setImages] = useState<ReelImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('9:16');
    const [secondsPerImage, setSecondsPerImage] = useState(3);
    const [gradient, setGradient] = useState<GradientPreset>('sunset');
    const [gradientStrength, setGradientStrength] = useState(35);
    const [brightness, setBrightness] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [template, setTemplate] = useState<ReelTemplate>('custom');
    const [captionLanguage, setCaptionLanguage] = useState('en');
    const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
    const [isAnalyzingBeats, setIsAnalyzingBeats] = useState(false);
    const [beatSyncMessage, setBeatSyncMessage] = useState<string | null>(null);
    const [isSortingPhotos, setIsSortingPhotos] = useState(false);
    const [music, setMusic] = useState<{ file: File; url: string } | null>(null);
    const [musicVolume, setMusicVolume] = useState(70);
    const [narrationText, setNarrationText] = useState('');
    const [narrationLanguage, setNarrationLanguage] = useState<'en' | 'hi' | 'bn' | 'ta' | 'te'>('en');
    const [narrationVoiceGender, setNarrationVoiceGender] = useState<'female' | 'male'>('female');
    const [voiceover, setVoiceover] = useState<{ file: File; url: string } | null>(null);
    const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewTimeMs, setPreviewTimeMs] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [completedExportUrl, setCompletedExportUrl] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<PhotoReelDraftSummary[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const musicInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const exportVoiceoverRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement>(null);
    const previewVoiceoverRef = useRef<HTMLAudioElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
    const videoCacheRef = useRef(new Map<string, HTMLVideoElement>());
    const videoPosterFramesRef = useRef(new Map<string, HTMLCanvasElement>());
    const imagesRef = useRef(images);
    const musicRef = useRef(music);
    const voiceoverRef = useRef(voiceover);
    const previewTimeRef = useRef(0);
    const getClipDurationMs = (clip: ReelImage) => clip.type === 'image' ? secondsPerImage * 1000 : clip.durationMs;
    const durationMs = images.reduce((total, clip) => total + getClipDurationMs(clip), 0);
    const resolvedPreviewIndex = images.findIndex((clip, index) => {
        const clipEndMs = images.slice(0, index + 1).reduce((total, item) => total + getClipDurationMs(item), 0);
        return previewTimeMs < clipEndMs;
    });
    const safePreviewIndex = resolvedPreviewIndex < 0 ? Math.max(0, images.length - 1) : resolvedPreviewIndex;
    const activeImage = images[safePreviewIndex] ?? null;
    const activeClipStartMs = images.slice(0, safePreviewIndex).reduce((total, clip) => total + getClipDurationMs(clip), 0);
    const selectedImage = images.find((image) => image.id === selectedImageId) ?? null;
    const durationLabel = useMemo(() => `${(durationMs / 1000).toFixed(0)} sec`, [durationMs]);

    useEffect(() => {
        imagesRef.current = images;
        musicRef.current = music;
        voiceoverRef.current = voiceover;
    }, [images, music, voiceover]);

    useEffect(() => {
        let cancelled = false;
        listPhotoReelDrafts().then((items) => { if (!cancelled) setDrafts(items); })
            .catch(() => { if (!cancelled) setError('Could not load saved reel drafts.'); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => () => {
        imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
        if (musicRef.current) URL.revokeObjectURL(musicRef.current.url);
        if (voiceoverRef.current) URL.revokeObjectURL(voiceoverRef.current.url);
        audioRef.current?.pause();
        exportVoiceoverRef.current?.pause();
        previewAudioRef.current?.pause();
        previewVoiceoverRef.current?.pause();
        videoCacheRef.current.forEach((video) => { video.pause(); video.src = ''; });
        void audioContextRef.current?.close().catch(() => undefined);
    }, []);

    useEffect(() => () => {
        if (completedExportUrl) URL.revokeObjectURL(completedExportUrl);
    }, [completedExportUrl]);

    const seekPreview = (timeMs: number) => {
        const nextTime = Math.max(0, Math.min(durationMs, timeMs));
        previewTimeRef.current = nextTime;
        setPreviewTimeMs(nextTime);
        const audio = previewAudioRef.current;
        if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (nextTime / 1000) % audio.duration;
        }
        const voiceoverAudio = previewVoiceoverRef.current;
        if (voiceoverAudio && Number.isFinite(voiceoverAudio.duration) && voiceoverAudio.duration > 0) {
            voiceoverAudio.currentTime = Math.min(nextTime / 1000, Math.max(0, voiceoverAudio.duration - 0.05));
        }
        const video = previewVideoRef.current;
        if (video && activeImage?.type === 'video' && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            const localTime = Math.max(0, (nextTime - activeClipStartMs) / 1000);
            video.currentTime = Math.min(localTime, Math.max(0, (video.duration || localTime) - 0.05));
        }
    };

    const togglePreview = () => {
        if (!images.length) return;
        if (isPreviewPlaying) {
            setIsPreviewPlaying(false);
            return;
        }
        if (previewTimeRef.current >= durationMs) seekPreview(0);
        setIsPreviewPlaying(true);
    };

    useEffect(() => {
        if (!isPreviewPlaying || images.length === 0) return;
        let frameId = 0;
        let lastFrameTime = performance.now();
        const audio = previewAudioRef.current;
        const voice = previewVoiceoverRef.current;
        if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (previewTimeRef.current / 1000) % audio.duration;
            audio.play().catch(() => setError('The music preview could not start. Try the music player controls below.'));
        }
        if (voice && Number.isFinite(voice.duration) && voice.duration > 0 && previewTimeRef.current < voice.duration * 1000) {
            voice.currentTime = previewTimeRef.current / 1000;
            voice.play().catch(() => setError('The voiceover preview could not start.'));
        }
        const advance = (now: number) => {
            const elapsed = now - lastFrameTime;
            lastFrameTime = now;
            const nextTime = Math.min(durationMs, previewTimeRef.current + elapsed);
            previewTimeRef.current = nextTime;
            setPreviewTimeMs(nextTime);
            const activeAudio = previewAudioRef.current;
            if (activeAudio && !activeAudio.paused && Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
                const expectedAudioTime = (nextTime / 1000) % activeAudio.duration;
                if (Math.abs(activeAudio.currentTime - expectedAudioTime) > 0.4) activeAudio.currentTime = expectedAudioTime;
            }
            const activeVoice = previewVoiceoverRef.current;
            if (activeVoice && !activeVoice.paused && Number.isFinite(activeVoice.duration) && activeVoice.duration > 0 && nextTime < activeVoice.duration * 1000) {
                if (Math.abs(activeVoice.currentTime - nextTime / 1000) > 0.4) activeVoice.currentTime = nextTime / 1000;
            } else if (activeVoice && !activeVoice.paused && nextTime >= activeVoice.duration * 1000) {
                activeVoice.pause();
            }
            if (nextTime >= durationMs) {
                setIsPreviewPlaying(false);
                return;
            }
            frameId = requestAnimationFrame(advance);
        };
        frameId = requestAnimationFrame(advance);
        return () => {
            cancelAnimationFrame(frameId);
            audio?.pause();
            voice?.pause();
        };
    }, [isPreviewPlaying, images.length, durationMs]);

    useEffect(() => {
        const audio = previewAudioRef.current;
        if (!audio) return;
        audio.volume = musicVolume / 100;
        audio.loop = true;
        if (!music) audio.pause();
        const voice = previewVoiceoverRef.current;
        if (voice) voice.volume = 1;
    }, [music, musicVolume]);

    useEffect(() => {
        if (activeImage?.type !== 'video') return;
        const video = previewVideoRef.current;
        if (!video) return;
        video.muted = true;
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            const localTime = Math.max(0, (previewTimeRef.current - activeClipStartMs) / 1000);
            video.currentTime = Math.min(localTime, Math.max(0, (video.duration || localTime) - 0.05));
        }
        if (isPreviewPlaying) video.play().catch(() => setError('This video clip could not play in the preview.'));
        else video.pause();
        return () => video.pause();
    }, [activeImage?.id, activeImage?.type, activeClipStartMs, isPreviewPlaying]);

    const addImages = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        setError(null);
        const validFiles = files.filter((file) => (file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES)
            || (file.type.startsWith('video/') && file.size <= MAX_VIDEO_BYTES));
        if (validFiles.length !== files.length) setError('Some files were skipped. Use images under 12 MB and videos under 100 MB.');
        const accepted = validFiles.slice(0, Math.max(0, MAX_IMAGES - images.length));
        if (accepted.length < validFiles.length) setError(`A reel can contain up to ${MAX_IMAGES} photos and video clips combined.`);
        const nextImages = accepted.map((file): ReelImage => {
            const type: ReelImage['type'] = file.type.startsWith('video/') ? 'video' : 'image';
            const url = URL.createObjectURL(file);
            const clip: ReelImage = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, file, url, durationMs: type === 'image' ? secondsPerImage * 1000 : DEFAULT_VIDEO_CLIP_MS, overlayText: '', description: '', textStyle: 'banner', textPosition: 'bottom', motion: type === 'image' ? 'zoom-in' : 'none', transition: 'fade' };
            if (type === 'video') {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.muted = true;
                video.playsInline = true;
                videoCacheRef.current.set(clip.id, video);
                video.onloadedmetadata = () => {
                    const sourceDurationMs = Number.isFinite(video.duration) ? video.duration * 1000 : DEFAULT_VIDEO_CLIP_MS;
                    setImages((current) => current.map((item) => item.id === clip.id
                        ? { ...item, sourceDurationMs, durationMs: Math.min(DEFAULT_VIDEO_CLIP_MS, sourceDurationMs) }
                        : item));
                };
                video.onerror = () => setError(`Could not load video clip ${file.name}. Try an MP4 or WebM file.`);
                video.src = url;
            }
            return clip;
        });
        setImages((current) => [...current, ...nextImages]);
        if (!selectedImageId && nextImages[0]) setSelectedImageId(nextImages[0].id);
        if (images.length === 0 && nextImages.length > 0) seekPreview(0);
        setIsPreviewPlaying(false);
    };

    const removeImage = (id: string) => {
        setImages((current) => {
            const image = current.find((item) => item.id === id);
            if (image) URL.revokeObjectURL(image.url);
            imageCacheRef.current.delete(id);
            videoPosterFramesRef.current.delete(id);
            const video = videoCacheRef.current.get(id);
            if (video) {
                video.pause();
                video.src = '';
                videoCacheRef.current.delete(id);
            }
            const remaining = current.filter((item) => item.id !== id);
            if (selectedImageId === id) setSelectedImageId(remaining[0]?.id ?? null);
            if (remaining.length === 0) seekPreview(0);
            return remaining;
        });
    };

    const moveImage = (id: string, direction: -1 | 1) => {
        setImages((current) => {
            const index = current.findIndex((item) => item.id === id);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const setMusicFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            setError('Choose an audio file for the background music.');
            return;
        }
        if (music) URL.revokeObjectURL(music.url);
        setMusic({ file, url: URL.createObjectURL(file) });
        setError(null);
    };

    const applyTemplate = (nextTemplate: ReelTemplate) => {
        setTemplate(nextTemplate);
        const config: Record<Exclude<ReelTemplate, 'custom'>, { gradient: GradientPreset; strength: number; brightness: number; saturation: number; transition: ReelImage['transition']; motion: ReelImage['motion']; style: TextOverlayStyle; position: ReelImage['textPosition']; seconds: number; caption: string }> = {
            travel: { gradient: 'ocean', strength: 30, brightness: 108, saturation: 112, transition: 'fade', motion: 'pan-left', style: 'classic', position: 'bottom', seconds: 4, caption: 'A little moment from the journey ✨' },
            birthday: { gradient: 'violet', strength: 42, brightness: 105, saturation: 118, transition: 'zoom', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Celebrating a day as special as you 🎂' },
            product: { gradient: 'warm', strength: 28, brightness: 105, saturation: 108, transition: 'slide', motion: 'zoom-in', style: 'banner', position: 'bottom', seconds: 3, caption: 'Meet your new everyday favorite.' },
            festival: { gradient: 'sunset', strength: 40, brightness: 108, saturation: 120, transition: 'fade', motion: 'zoom-in', style: 'highlight', position: 'center', seconds: 3, caption: 'Wishing you joy, light, and togetherness ✨' },
        };
        if (nextTemplate === 'custom') return;
        const preset = config[nextTemplate];
        setGradient(preset.gradient);
        setGradientStrength(preset.strength);
        setBrightness(preset.brightness);
        setSaturation(preset.saturation);
        setSecondsPerImage(preset.seconds);
        setImages((current) => current.map((clip) => ({
            ...clip,
            transition: preset.transition,
            motion: clip.type === 'image' ? preset.motion : clip.motion,
            textStyle: preset.style,
            textPosition: preset.position,
            overlayText: clip.overlayText.trim() ? clip.overlayText : preset.caption,
        })));
    };

    const generateCaption = async (clip: ReelImage) => {
        if (clip.description.trim().length < 3) {
            setError('Add a short description of this photo or clip before generating its caption.');
            return;
        }
        setIsGeneratingCaption(true);
        setError(null);
        try {
            const response = await fetch('/api/generate-reel-caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: clip.description, language: captionLanguage, template }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? 'Could not generate a caption.');
            }
            const payload = await response.json() as { caption?: string };
            if (!payload.caption) throw new Error('The caption service returned no text.');
            setImages((current) => current.map((item) => item.id === clip.id ? { ...item, overlayText: payload.caption!.slice(0, 120) } : item));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not generate a caption.');
        } finally {
            setIsGeneratingCaption(false);
        }
    };

    const generateVoiceover = async () => {
        const narration = narrationText.trim() || images.map((clip) => clip.overlayText.trim()).filter(Boolean).join('. ');
        if (narration.length < 3) {
            setError('Write a narration script or add captions to your slides first.');
            return;
        }
        setIsGeneratingVoiceover(true);
        setError(null);
        try {
            const response = await fetch('/api/dub', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: narration, sourceLanguage: narrationLanguage, targetLanguage: narrationLanguage, voiceGender: narrationVoiceGender }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? 'Could not generate narration.');
            }
            const file = new File([await response.blob()], `reel-narration-${narrationLanguage}.wav`, { type: 'audio/wav' });
            if (voiceover) URL.revokeObjectURL(voiceover.url);
            setVoiceover({ file, url: URL.createObjectURL(file) });
            setNarrationText(narration);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not generate narration.');
        } finally {
            setIsGeneratingVoiceover(false);
        }
    };

    const syncToMusicBeat = async () => {
        if (!music || isAnalyzingBeats) {
            if (!music) setError('Add a music track before syncing slide timing to its beat.');
            return;
        }
        setIsAnalyzingBeats(true);
        setBeatSyncMessage(null);
        setError(null);
        try {
            const context = new AudioContext();
            try {
                const buffer = await context.decodeAudioData(await music.file.arrayBuffer());
                const channel = buffer.getChannelData(0);
                const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.012));
                const energy: number[] = [];
                for (let offset = 0; offset < channel.length; offset += windowSize) {
                    let sum = 0;
                    const end = Math.min(channel.length, offset + windowSize);
                    for (let sample = offset; sample < end; sample += 1) sum += channel[sample] * channel[sample];
                    energy.push(Math.sqrt(sum / Math.max(1, end - offset)));
                }
                const sorted = [...energy].sort((a, b) => a - b);
                const threshold = (sorted[Math.floor(sorted.length * 0.55)] ?? 0) * 1.65;
                const peaks: number[] = [];
                const minGap = Math.ceil(0.25 / 0.012);
                for (let index = 2; index < energy.length - 2; index += 1) {
                    if (energy[index] < threshold || energy[index] < energy[index - 1] || energy[index] < energy[index + 1]) continue;
                    if (peaks.length && index - peaks[peaks.length - 1] < minGap) continue;
                    peaks.push(index);
                }
                const intervals = peaks.slice(1).map((peak, index) => (peak - peaks[index]) * 0.012).filter((interval) => interval >= 0.3 && interval <= 1.2);
                if (intervals.length < 3) throw new Error('Could not find a steady beat in this music. Choose a clearer, steady-tempo track.');
                intervals.sort((a, b) => a - b);
                const beatSeconds = intervals[Math.floor(intervals.length / 2)];
                const secondsPerTwoBeats = Math.max(1, Math.min(8, Math.round(beatSeconds * 2)));
                setSecondsPerImage(secondsPerTwoBeats);
                setBeatSyncMessage(`Approx. ${Math.round(60 / beatSeconds)} BPM · photos set to about every 2 beats.`);
            } finally {
                await context.close();
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not analyze the music beat.');
        } finally {
            setIsAnalyzingBeats(false);
        }
    };

    const autoOrderPhotos = async () => {
        const photoClips = images.filter((clip) => clip.type === 'image');
        if (photoClips.length < 2 || isSortingPhotos) return;
        setIsSortingPhotos(true);
        setError(null);
        try {
            const scores = await Promise.all(photoClips.map((clip) => new Promise<{ id: string; score: number }>((resolve) => {
                const image = new Image();
                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 96;
                    canvas.height = 96;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) { resolve({ id: clip.id, score: 0 }); return; }
                    const ratio = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
                    ctx.drawImage(image, 0, 0, image.naturalWidth / ratio, image.naturalHeight / ratio);
                    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    const gray: number[] = [];
                    let sum = 0;
                    for (let index = 0; index < pixels.length; index += 4) {
                        const value = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
                        gray.push(value);
                        sum += value;
                    }
                    const mean = sum / gray.length;
                    let variance = 0;
                    let sharpness = 0;
                    for (let y = 1; y < 95; y += 1) for (let x = 1; x < 95; x += 1) {
                        const index = y * 96 + x;
                        const value = gray[index];
                        variance += (value - mean) ** 2;
                        const laplacian = gray[index - 1] + gray[index + 1] + gray[index - 96] + gray[index + 96] - 4 * value;
                        sharpness += laplacian * laplacian;
                    }
                    const exposureScore = Math.max(0, 1 - Math.abs(mean - 128) / 145);
                    const detailScore = Math.min(1, Math.sqrt(sharpness / (94 * 94)) / 25);
                    const contrastScore = Math.min(1, Math.sqrt(variance / gray.length) / 75);
                    resolve({ id: clip.id, score: exposureScore * 0.35 + detailScore * 0.45 + contrastScore * 0.2 });
                };
                image.onerror = () => resolve({ id: clip.id, score: 0 });
                image.src = clip.url;
            })));
            const sortedPhotoIds = scores.sort((a, b) => b.score - a.score).map((item) => item.id);
            const rankedPhotos = sortedPhotoIds.map((id) => photoClips.find((photo) => photo.id === id)).filter((photo): photo is ReelImage => Boolean(photo));
            let photoIndex = 0;
            setImages(images.map((clip) => clip.type === 'image' ? rankedPhotos[photoIndex++] ?? clip : clip));
            setBeatSyncMessage('Photos reordered by estimated clarity and exposure. Review the order before exporting.');
        } catch {
            setError('Could not analyze these photos. You can still reorder them manually.');
        } finally {
            setIsSortingPhotos(false);
        }
    };

    const saveDraft = async () => {
        if (isSavingDraft) return;
        setIsSavingDraft(true);
        setError(null);
        try {
            const id = currentDraftId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const savedAt = Date.now();
            const data = {
                aspectRatio,
                secondsPerImage,
                gradient,
                gradientStrength,
                brightness,
                saturation,
                musicVolume,
                template,
                narrationText,
                narrationLanguage,
                narrationVoiceGender,
                clips: await Promise.all(images.map(async (clip) => ({
                    id: clip.id,
                    type: clip.type,
                    fileName: clip.file.name,
                    fileType: clip.file.type,
                    blob: clip.file,
                    durationMs: clip.durationMs,
                    sourceDurationMs: clip.sourceDurationMs,
                    overlayText: clip.overlayText,
                    description: clip.description,
                    textStyle: clip.textStyle,
                    textPosition: clip.textPosition,
                    motion: clip.motion,
                    transition: clip.transition,
                }))),
                music: music ? { fileName: music.file.name, fileType: music.file.type, blob: music.file } : undefined,
                voiceover: voiceover ? { fileName: voiceover.file.name, fileType: voiceover.file.type, blob: voiceover.file } : undefined,
            };
            const summary: PhotoReelDraftSummary = {
                id,
                title: images.length ? `Photo + video reel · ${new Date(savedAt).toLocaleString()}` : `Untitled reel · ${new Date(savedAt).toLocaleString()}`,
                savedAt,
                clipCount: images.length,
                durationMs,
            };
            await savePhotoReelDraft({ ...summary, data });
            setCurrentDraftId(id);
            setDrafts(await listPhotoReelDrafts());
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this reel draft. Check available browser storage and try again.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const openDraft = async (id: string) => {
        if (isLoadingDraft) return;
        setIsLoadingDraft(true);
        setError(null);
        setIsPreviewPlaying(false);
        try {
            const draft = await loadPhotoReelDraft(id);
            imagesRef.current.forEach((clip) => URL.revokeObjectURL(clip.url));
            if (musicRef.current) URL.revokeObjectURL(musicRef.current.url);
            if (voiceoverRef.current) URL.revokeObjectURL(voiceoverRef.current.url);
            videoCacheRef.current.forEach((video) => { video.pause(); video.src = ''; });
            videoCacheRef.current.clear();
            imageCacheRef.current.clear();
            videoPosterFramesRef.current.clear();
            const clips: ReelImage[] = draft.data.clips.map((clip) => {
                const file = new File([clip.blob], clip.fileName, { type: clip.fileType });
                const url = URL.createObjectURL(file);
                if (clip.type === 'video') {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.muted = true;
                    video.playsInline = true;
                    video.src = url;
                    videoCacheRef.current.set(clip.id, video);
                }
                return {
                    ...clip,
                    file,
                    url,
                    description: clip.description ?? '',
                    motion: clip.motion ?? (clip.type === 'image' ? 'zoom-in' : 'none'),
                    transition: clip.transition ?? 'fade',
                };
            });
            const restoredMusic = draft.data.music
                ? new File([draft.data.music.blob], draft.data.music.fileName, { type: draft.data.music.fileType })
                : null;
            const restoredVoiceover = draft.data.voiceover
                ? new File([draft.data.voiceover.blob], draft.data.voiceover.fileName, { type: draft.data.voiceover.fileType })
                : null;
            setImages(clips);
            setSelectedImageId(clips[0]?.id ?? null);
            setAspectRatio(draft.data.aspectRatio);
            setSecondsPerImage(draft.data.secondsPerImage);
            setGradient(draft.data.gradient);
            setGradientStrength(draft.data.gradientStrength);
            setBrightness(draft.data.brightness);
            setSaturation(draft.data.saturation);
            setMusicVolume(draft.data.musicVolume);
            setTemplate(draft.data.template ?? 'custom');
            setNarrationText(draft.data.narrationText ?? '');
            setNarrationLanguage(draft.data.narrationLanguage ?? 'en');
            setNarrationVoiceGender(draft.data.narrationVoiceGender ?? 'female');
            setVoiceover(restoredVoiceover ? { file: restoredVoiceover, url: URL.createObjectURL(restoredVoiceover) } : null);
            setMusic(restoredMusic ? { file: restoredMusic, url: URL.createObjectURL(restoredMusic) } : null);
            seekPreview(0);
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
            setDrafts(await listPhotoReelDrafts());
            if (currentDraftId === id) setCurrentDraftId(null);
        } catch {
            setError('Could not delete this saved reel draft.');
        }
    };

    const getImage = (image: ReelImage) => {
        let element = imageCacheRef.current.get(image.id);
        if (!element) {
            element = new Image();
            element.src = image.url;
            imageCacheRef.current.set(image.id, element);
        }
        return element;
    };

    const waitForImageDecode = async (image: HTMLImageElement, fileName: string) => {
        try {
            if (!image.complete || image.naturalWidth === 0) {
                await new Promise<void>((resolve, reject) => {
                    const timeout = window.setTimeout(() => reject(new Error(`Photo ${fileName} is taking too long to load.`)), 10000);
                    image.onload = () => { window.clearTimeout(timeout); resolve(); };
                    image.onerror = () => { window.clearTimeout(timeout); reject(new Error(`Could not decode photo ${fileName}. Try a JPG, PNG, or WebP image.`)); };
                });
            }
            if (typeof image.decode === 'function') await image.decode();
            if (image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(`Could not decode photo ${fileName}. Try a JPG, PNG, or WebP image.`);
        } catch (cause) {
            throw cause instanceof Error ? cause : new Error(`Could not decode photo ${fileName}.`);
        }
    };

    const getVideo = (clip: ReelImage) => {
        let element = videoCacheRef.current.get(clip.id);
        if (!element) {
            element = document.createElement('video');
            element.src = clip.url;
            element.preload = 'auto';
            element.muted = true;
            element.playsInline = true;
            videoCacheRef.current.set(clip.id, element);
        }
        return element;
    };

    const waitForVideoFrame = (video: HTMLVideoElement, fileName: string, timeoutMs = 10000) => new Promise<boolean>((resolve, reject) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            resolve(true);
            return;
        }
        const cleanup = () => {
            window.clearTimeout(timeout);
            video.removeEventListener('loadeddata', checkReady);
            video.removeEventListener('canplay', checkReady);
            video.removeEventListener('seeked', checkReady);
            video.removeEventListener('playing', checkReady);
            video.removeEventListener('timeupdate', checkReady);
            video.removeEventListener('error', handleError);
        };
        const checkReady = () => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
                cleanup();
                resolve(true);
            }
        };
        const handleError = () => {
            cleanup();
            reject(new Error(`Could not decode ${fileName}. Try an MP4 or WebM video.`));
        };
        const timeout = window.setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);
        video.addEventListener('loadeddata', checkReady);
        video.addEventListener('canplay', checkReady);
        video.addEventListener('seeked', checkReady);
        video.addEventListener('playing', checkReady);
        video.addEventListener('timeupdate', checkReady);
        video.addEventListener('error', handleError);
        checkReady();
    });

    const drawSlide = (ctx: CanvasRenderingContext2D, image: ReelImage, width: number, height: number, progress = 0) => {
        const liveVideo = image.type === 'video' ? getVideo(image) : null;
        const videoHasFrame = Boolean(liveVideo && liveVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && liveVideo.videoWidth > 0);
        const element: CanvasImageSource = image.type === 'image'
            ? getImage(image)
            : videoHasFrame
                ? liveVideo!
                : videoPosterFramesRef.current.get(image.id) ?? liveVideo!;
        const sourceWidthNatural = element instanceof HTMLImageElement ? element.naturalWidth
            : element instanceof HTMLVideoElement ? element.videoWidth
                : element instanceof HTMLCanvasElement ? element.width : 0;
        const sourceHeightNatural = element instanceof HTMLImageElement ? element.naturalHeight
            : element instanceof HTMLVideoElement ? element.videoHeight
                : element instanceof HTMLCanvasElement ? element.height : 0;
        if (image.type === 'image' && (!(element instanceof HTMLImageElement) || !element.complete || sourceWidthNatural === 0)) {
            throw new Error(`Photo ${image.file.name} is not decoded yet. Please try exporting again.`);
        }
        if (sourceWidthNatural === 0 || sourceHeightNatural === 0) {
            throw new Error(`Could not load a preview frame for video ${image.file.name}. Try a different MP4 or WebM clip.`);
        }
        const progressClamped = Math.max(0, Math.min(1, progress));
        const motion = image.type === 'image' ? image.motion ?? 'zoom-in' : 'none';
        const motionScale = motion === 'zoom-in' || motion === 'pan-left' || motion === 'pan-right'
            ? 1 + 0.12 * progressClamped
            : motion === 'zoom-out' ? 1.12 - 0.12 * progressClamped : 1;
        const ratio = Math.max(width / sourceWidthNatural, height / sourceHeightNatural);
        const sourceWidth = width / ratio / motionScale;
        const sourceHeight = height / ratio / motionScale;
        const extraSourceX = sourceWidthNatural - sourceWidth;
        const sourceX = motion === 'pan-left' ? extraSourceX * progressClamped : motion === 'pan-right' ? extraSourceX * (1 - progressClamped) : extraSourceX / 2;
        const sourceY = (sourceHeightNatural - sourceHeight) / 2;
        ctx.save();
        const transition = image.transition ?? 'fade';
        if (transition === 'fade') ctx.globalAlpha = progressClamped;
        else if (transition === 'slide') ctx.translate((1 - progressClamped) * width, 0);
        else if (transition === 'zoom') {
            const transitionScale = 1.12 - 0.12 * progressClamped;
            ctx.translate(width / 2, height / 2);
            ctx.scale(transitionScale, transitionScale);
            ctx.translate(-width / 2, -height / 2);
        }
        ctx.filter = `brightness(${brightness}%) saturate(${saturation}%)`;
        ctx.drawImage(element, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        ctx.filter = 'none';
        if (gradient !== 'none') {
            const colors = GRADIENTS.find((item) => item.id === gradient)?.colors ?? ['0,0,0', '0,0,0'];
            const overlay = ctx.createLinearGradient(0, 0, 0, height);
            const alpha = gradientStrength / 100;
            overlay.addColorStop(0, `rgba(${colors[0]},${alpha * 0.2})`);
            overlay.addColorStop(0.48, `rgba(${colors[0]},${alpha * 0.52})`);
            overlay.addColorStop(1, `rgba(${colors[1]},${alpha})`);
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, width, height);
        }
        if (image.overlayText.trim()) {
            const fontSize = Math.max(28, Math.round(width * 0.065));
            const padding = fontSize * 0.42;
            ctx.font = `700 ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const maxWidth = width * 0.82;
            const words = image.overlayText.trim().split(/\s+/);
            const lines: string[] = [];
            let line = '';
            for (const word of words) {
                const candidate = line ? `${line} ${word}` : word;
                if (line && ctx.measureText(candidate).width > maxWidth - padding * 2) {
                    lines.push(line);
                    line = word;
                } else line = candidate;
            }
            if (line) lines.push(line);
            const lineHeight = fontSize * 1.2;
            const textHeight = lines.length * lineHeight;
            const textY = image.textPosition === 'top' ? height * 0.15 : image.textPosition === 'center' ? height * 0.5 : height * 0.82;
            const boxWidth = Math.min(maxWidth, Math.max(...lines.map((item) => ctx.measureText(item).width), 0) + padding * 2);
            if (image.textStyle === 'banner' || image.textStyle === 'highlight') {
                ctx.fillStyle = image.textStyle === 'banner' ? 'rgba(10,10,10,0.78)' : 'rgba(250,204,21,0.92)';
                ctx.beginPath();
                ctx.roundRect(width / 2 - boxWidth / 2, textY - textHeight / 2 - padding / 2, boxWidth, textHeight + padding, fontSize * 0.2);
                ctx.fill();
            }
            lines.forEach((item, index) => {
                const y = textY + (index - (lines.length - 1) / 2) * lineHeight;
                if (image.textStyle === 'outline') {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = Math.max(2, fontSize * 0.07);
                    ctx.strokeText(item, width / 2, y, maxWidth);
                } else {
                    ctx.fillStyle = image.textStyle === 'highlight' ? '#111111' : '#ffffff';
                    if (image.textStyle === 'classic') {
                        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                        ctx.lineWidth = fontSize * 0.1;
                        ctx.strokeText(item, width / 2, y, maxWidth);
                    }
                    ctx.fillText(item, width / 2, y, maxWidth);
                }
            });
        }
        ctx.restore();
    };

    const exportReel = async () => {
        if (!images.length || isExporting) return;
        if (durationMs > FREE_VIDEO_LIMIT_MS) {
            setError('This free-plan reel can be up to 60 seconds. Reduce the number of photos or seconds per photo.');
            return;
        }
        setError(null);
        setIsExporting(true);
        setExportProgress(0);
        setCompletedExportUrl(null);
        setExportStatus('Preparing your photos, clips, and audio…');
        const canvas = canvasRef.current;
        if (!canvas) {
            setIsExporting(false);
            return;
        }
        let canvasStream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let audioContext: AudioContext | null = null;
        let voiceoverAudioElement: HTMLAudioElement | null = null;
        let frameId = 0;
        try {
            const dimensions = getExportDimensions(aspectRatio, '1080p');
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not prepare the reel canvas.');
            const exportCanvas = canvas;
            const exportContext = ctx;
            for (const [index, clip] of images.entries()) {
                setExportStatus(`Preparing ${clip.type === 'image' ? 'photo' : 'video'} ${index + 1} of ${images.length}…`);
                if (clip.type === 'image') {
                    const element = getImage(clip);
                    await waitForImageDecode(element, clip.file.name);
                } else {
                    const element = getVideo(clip);
                    if (element.readyState < HTMLMediaElement.HAVE_METADATA) await new Promise<void>((resolve, reject) => {
                        const timeout = window.setTimeout(() => reject(new Error(`Could not load video metadata for ${clip.file.name}.`)), 10000);
                        element.addEventListener('loadedmetadata', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                        element.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error(`Could not decode ${clip.file.name}. Use MP4 or WebM video.`)); }, { once: true });
                        element.load();
                    });
                    const hasFrame = await waitForVideoFrame(element, clip.file.name);
                    if (!hasFrame) throw new Error(`Could not decode the first frame of ${clip.file.name}. Re-save it as MP4 or WebM and try again.`);
                    const poster = document.createElement('canvas');
                    poster.width = element.videoWidth;
                    poster.height = element.videoHeight;
                    poster.getContext('2d')?.drawImage(element, 0, 0, poster.width, poster.height);
                    videoPosterFramesRef.current.set(clip.id, poster);
                    element.pause();
                    element.currentTime = 0;
                }
            }

            drawSlide(ctx, images[0], canvas.width, canvas.height, images[0].transition === 'cut' ? 1 : 0);
            drawFreeTierWatermark(ctx, canvas.width, canvas.height);
            canvasStream = canvas.captureStream(RECORDING_FRAME_RATE);
            const tracks = [...canvasStream.getVideoTracks()];
            let audioElement: HTMLAudioElement | null = null;
            if (music || voiceover) {
                audioContext = new AudioContext();
                audioContextRef.current = audioContext;
                const destination = audioContext.createMediaStreamDestination();
                tracks.push(...destination.stream.getAudioTracks());
                await audioContext.resume();
                const prepareAudioTrack = async (url: string, volume: number, shouldLoop: boolean, label: string) => {
                    const element = new Audio(url);
                    element.preload = 'auto';
                    element.loop = shouldLoop;
                    element.volume = 1;
                    const source = audioContext!.createMediaElementSource(element);
                    const gain = audioContext!.createGain();
                    gain.gain.value = volume;
                    source.connect(gain);
                    gain.connect(destination);
                    await new Promise<void>((resolve, reject) => {
                        if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) { resolve(); return; }
                        const timeout = window.setTimeout(() => reject(new Error(`${label} did not finish loading.`)), 10000);
                        element.addEventListener('canplay', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                        element.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error(`Could not decode the ${label.toLowerCase()}.`)); }, { once: true });
                        element.load();
                    });
                    element.currentTime = 0;
                    return element;
                };
                if (music) {
                    audioElement = await prepareAudioTrack(music.url, musicVolume / 100, true, 'Background music');
                    audioRef.current = audioElement;
                }
                if (voiceover) {
                    voiceoverAudioElement = await prepareAudioTrack(voiceover.url, 1, false, 'Voiceover');
                    exportVoiceoverRef.current = voiceoverAudioElement;
                }
            }

            recorder = createExportRecorder(new MediaStream(tracks), 'mp4', '1080p');
            const chunks: Blob[] = [];
            const activeRecorder = recorder;
            let renderingError: Error | null = null;
            const recording = new Promise<Blob>((resolve, reject) => {
                activeRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
                activeRecorder.onerror = () => reject(new Error('The browser could not encode this reel.'));
                activeRecorder.onstop = () => {
                    if (renderingError) {
                        reject(renderingError);
                        return;
                    }
                    const blob = new Blob(chunks, { type: activeRecorder.mimeType || 'video/webm' });
                    if (blob.size) resolve(blob);
                    else reject(new Error('The exported reel is empty.'));
                };
            });
            setExportStatus('Rendering your reel…');
            activeRecorder.start(250);
            const audioPlayback = Promise.all([
                audioElement?.play().catch(() => { throw new Error('Could not start the background music during export. Try another audio file.'); }),
                voiceoverAudioElement?.play().catch(() => { throw new Error('Could not start the voiceover during export.'); }),
            ]);
            let elapsed = 0;
            let previousFrameTimestamp: number | null = null;
            let activeVideoId: string | null = null;
            let lastReportedClip = -1;
            const getIndexAtTime = (timeMs: number) => {
                let elapsedMs = 0;
                for (let index = 0; index < images.length; index += 1) {
                    elapsedMs += getClipDurationMs(images[index]);
                    if (timeMs < elapsedMs) return index;
                }
                return images.length - 1;
            };
            const getStartAtIndex = (targetIndex: number) => images.slice(0, targetIndex).reduce((total, clip) => total + getClipDurationMs(clip), 0);
            async function renderFrame(timestamp: number) {
                if (previousFrameTimestamp !== null) elapsed += timestamp - previousFrameTimestamp;
                previousFrameTimestamp = timestamp;
                if (elapsed >= durationMs) {
                    if (activeRecorder.state === 'recording') activeRecorder.stop();
                    return;
                }
                const index = getIndexAtTime(elapsed);
                const clip = images[index];
                if (index !== lastReportedClip) {
                    lastReportedClip = index;
                    setExportStatus(`Rendering ${clip.type === 'image' ? 'photo' : 'video'} ${index + 1} of ${images.length}…`);
                }
                const localTimeMs = Math.max(0, elapsed - getStartAtIndex(index));
                if (clip.type === 'video') {
                    const video = getVideo(clip);
                    video.muted = true;
                    if (activeVideoId !== clip.id) {
                        videoCacheRef.current.forEach((item, id) => { if (id !== clip.id) item.pause(); });
                        const targetTime = Math.min(localTimeMs / 1000, Math.max(0, video.duration - 0.05));
                        if (Math.abs(video.currentTime - targetTime) > 0.08) {
                            const seeked = new Promise<void>((resolve) => {
                                const timeout = window.setTimeout(() => resolve(), 1500);
                                video.addEventListener('seeked', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                            });
                            video.currentTime = targetTime;
                            await seeked;
                        }
                        await video.play();
                        await waitForVideoFrame(video, clip.file.name, 1500);
                        activeVideoId = clip.id;
                    }
                } else if (activeVideoId) {
                    videoCacheRef.current.get(activeVideoId)?.pause();
                    activeVideoId = null;
                }
                if (clip.type === 'image') await waitForImageDecode(getImage(clip), clip.file.name);
                drawSlide(exportContext, clip, exportCanvas.width, exportCanvas.height, clip.transition === 'cut' ? 1 : Math.min(1, localTimeMs / 450));
                drawFreeTierWatermark(exportContext, exportCanvas.width, exportCanvas.height);
                setExportProgress(5 + Math.min(80, Math.floor(elapsed / durationMs * 80)));
                scheduleRender();
            }
            const scheduleRender = () => {
                frameId = requestAnimationFrame((timestamp) => {
                    void renderFrame(timestamp).catch((cause: unknown) => {
                        renderingError = cause instanceof Error ? cause : new Error('A video clip could not be rendered.');
                        if (activeRecorder.state === 'recording') activeRecorder.stop();
                    });
                });
            };
            scheduleRender();
            let result = await Promise.all([recording, audioPlayback]).then(([recorded]) => recorded);
            if (!result.type.toLowerCase().startsWith('video/mp4')) {
                setExportStatus('Encoding MP4… this can take a little while.');
                setExportProgress(85);
                const { convertWebmToMp4 } = await import('@/components/editor/convertToMp4');
                result = await convertWebmToMp4(result, (progress) => setExportProgress(100 - Math.ceil((1 - progress / 100) * 15)));
            }
            const url = URL.createObjectURL(result);
            setCompletedExportUrl(url);
            setExportStatus('Reel is ready. Your download should start automatically.');
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'photo-reel.mp4';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            setExportProgress(100);
            setExportStatus('Reel downloaded. If it did not start, use Download reel below.');
        } catch (cause) {
            if (recorder?.state === 'recording') recorder.stop();
            const message = cause instanceof Error ? cause.message : 'Could not export the photo reel.';
            setError(message);
            setExportStatus('Export stopped. Fix the issue and try again.');
        } finally {
            cancelAnimationFrame(frameId);
            if (recorder?.state === 'recording') recorder.stop();
            audioRef.current?.pause();
            exportVoiceoverRef.current?.pause();
            audioRef.current = null;
            exportVoiceoverRef.current = null;
            videoCacheRef.current.forEach((video) => video.pause());
            videoPosterFramesRef.current.clear();
            canvasStream?.getTracks().forEach((track) => track.stop());
            await audioContext?.close().catch(() => undefined);
            audioContextRef.current = null;
            setIsExporting(false);
        }
    };

    const filterStyle = `brightness(${brightness}%) saturate(${saturation}%)`;
    const gradientStyle = gradient === 'none' ? 'none' : `linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,${gradientStrength / 240}) 45%, rgba(0,0,0,${gradientStrength / 100}) 100%)`;
    const gradientColor = gradient === 'none' ? '' : `linear-gradient(180deg, rgba(${GRADIENTS.find((item) => item.id === gradient)?.colors[0]},0.12), rgba(${GRADIENTS.find((item) => item.id === gradient)?.colors[1]},${gradientStrength / 100}))`;
    const activeClipProgress = activeImage ? Math.max(0, Math.min(1, (previewTimeMs - activeClipStartMs) / getClipDurationMs(activeImage))) : 0;
    const transitionProgress = !activeImage || activeImage.transition === 'cut' ? 1 : Math.min(1, activeClipProgress * getClipDurationMs(activeImage) / 450);
    const transitionStyle: React.CSSProperties = activeImage?.transition === 'slide'
        ? { transform: `translateX(${(1 - transitionProgress) * 100}%)` }
        : activeImage?.transition === 'zoom'
            ? { transform: `scale(${1.12 - transitionProgress * 0.12})` }
            : { opacity: activeImage?.transition === 'fade' ? transitionProgress : 1 };
    const photoMotion = activeImage?.type === 'image' ? activeImage.motion ?? 'zoom-in' : 'none';
    const photoScale = photoMotion === 'zoom-in' || photoMotion === 'pan-left' || photoMotion === 'pan-right'
        ? 1 + 0.12 * activeClipProgress
        : photoMotion === 'zoom-out' ? 1.12 - 0.12 * activeClipProgress : 1;
    const photoPanX = photoMotion === 'pan-left' ? `${(0.5 - activeClipProgress) * 8}%` : photoMotion === 'pan-right' ? `${(activeClipProgress - 0.5) * 8}%` : '0%';
    const photoMotionStyle: React.CSSProperties = { transform: `translateX(${photoPanX}) scale(${photoScale})` };

    return (
        <main className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100 lg:h-dvh lg:flex-row lg:overflow-hidden">
            <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto border-b border-neutral-800 bg-neutral-900 p-4 lg:max-h-full lg:w-92 lg:border-b-0 lg:border-r lg:p-5">
                <button type="button" onClick={onBack} className="flex w-fit items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> All creation options</button>
                <header>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Photo + video reel studio</p>
                    <h1 className="mt-1 text-2xl font-bold">Mix photos and video clips</h1>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-400">Arrange photos and short clips, style them with text and gradients, add music, then export your reel.</p>
                </header>

                <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Reel clips <span className="text-neutral-500">({images.length}/{MAX_IMAGES})</span></h2><span className="text-[11px] text-neutral-500">{durationLabel}</span></div>
                    <input ref={imageInputRef} type="file" accept="image/*,video/*" multiple onChange={addImages} className="hidden" />

                    <section className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                        <button type="button" onClick={() => void saveDraft()} disabled={isSavingDraft || isExporting} className="flex w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2.5 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingDraft ? 'Saving draft…' : currentDraftId ? 'Update saved draft' : 'Save as draft'}
                        </button>
                        <details>
                            <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1 text-xs font-medium text-neutral-400 hover:text-neutral-200">
                                <FolderOpen className="h-3.5 w-3.5" /> Saved reel drafts ({drafts.length})
                            </summary>
                            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                                {drafts.map((draft) => <div key={draft.id} className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2">
                                    <button type="button" onClick={() => void openDraft(draft.id)} disabled={isLoadingDraft} className="min-w-0 flex-1 text-left text-xs text-neutral-200 disabled:opacity-50">
                                        <span className="block truncate font-medium">{draft.title}</span>
                                        <span className="mt-0.5 block text-[10px] text-neutral-500">{draft.clipCount} clips · {Math.round(draft.durationMs / 1000)} sec · {new Date(draft.savedAt).toLocaleDateString()}</span>
                                    </button>
                                    <button type="button" onClick={() => void removeDraft(draft.id)} aria-label={`Delete ${draft.title}`} className="rounded p-1.5 text-neutral-500 hover:bg-red-950 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>)}
                                {drafts.length === 0 && <p className="px-2 py-2 text-[11px] text-neutral-500">Your saved reels will appear here.</p>}
                            </div>
                        </details>
                    </section>
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={images.length >= MAX_IMAGES} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 py-3 text-sm text-neutral-300 hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-40"><ImagePlus className="h-4 w-4" /> Add photos or videos</button>
                    <p className="text-[10px] text-neutral-500">Mix photos with short MP4 or WebM video clips, then reorder them below.</p>
                    {images.filter((clip) => clip.type === 'image').length > 1 && <button type="button" onClick={() => void autoOrderPhotos()} disabled={isSortingPhotos} className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-300 hover:border-fuchsia-500 disabled:opacity-50">{isSortingPhotos ? 'Scoring photo clarity…' : 'Auto-order photos by quality'}</button>}
                    <div className="space-y-2">
                        {images.map((image, index) => (
                            <div key={image.id} className={`flex items-center gap-2 rounded-lg border p-2 ${selectedImageId === image.id ? 'border-fuchsia-500/70 bg-fuchsia-500/10' : 'border-neutral-800 bg-neutral-900'}`}>
                                <button type="button" onClick={() => { setSelectedImageId(image.id); setIsPreviewPlaying(false); seekPreview(images.slice(0, index).reduce((total, clip) => total + getClipDurationMs(clip), 0)); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                    {image.type === 'video' ? <video src={image.url} muted playsInline className="h-11 w-11 rounded-md object-cover" /> : <img src={image.url} alt="" className="h-11 w-11 rounded-md object-cover" />}
                                    <span className="min-w-0"><span className="block text-xs font-medium">{image.type === 'video' ? 'Video' : 'Photo'} {index + 1}</span><span className="block truncate text-[10px] text-neutral-500">{image.file.name}</span></span>
                                </button>
                                <button type="button" onClick={() => moveImage(image.id, -1)} disabled={index === 0} aria-label={`Move clip ${index + 1} up`} className="rounded p-1 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => moveImage(image.id, 1)} disabled={index === images.length - 1} aria-label={`Move clip ${index + 1} down`} className="rounded p-1 text-neutral-400 hover:bg-neutral-800 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove clip ${index + 1}`} className="rounded p-1 text-neutral-500 hover:bg-red-950 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        ))}
                        {!images.length && <p className="py-3 text-center text-xs text-neutral-500">Add a few photos to start building your reel.</p>}
                    </div>
                </section>

                <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <h2 className="text-sm font-semibold">Image look</h2>
                    <label className="block text-xs text-neutral-400">Reel template
                        <select value={template} onChange={(event) => applyTemplate(event.target.value as ReelTemplate)} className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100">
                            <option value="custom">Custom look</option><option value="travel">Travel diary</option><option value="birthday">Birthday</option><option value="product">Product launch</option><option value="festival">Festival wishes</option>
                        </select>
                    </label>
                    <label className="block text-xs text-neutral-400">Frame format
                        <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatioType)} className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100"><option value="9:16">Reel · 9:16</option><option value="1:1">Square · 1:1</option><option value="16:9">Landscape · 16:9</option></select>
                    </label>
                    <label className="block text-xs text-neutral-400">Seconds per photo · {secondsPerImage}s
                        <input type="range" min={1} max={8} value={secondsPerImage} onChange={(event) => setSecondsPerImage(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" />
                    </label>
                    {selectedImage?.type === 'video' && <label className="block text-xs text-neutral-400">Selected video length · {(selectedImage.durationMs / 1000).toFixed(1)}s
                        <input type="range" min={Math.min(1000, selectedImage.sourceDurationMs ?? 1000)} max={Math.max(Math.min(1000, selectedImage.sourceDurationMs ?? 1000), Math.min(15000, selectedImage.sourceDurationMs ?? 15000))} step={100} value={selectedImage.durationMs} onChange={(event) => setImages((current) => current.map((clip) => clip.id === selectedImage.id ? { ...clip, durationMs: Number(event.target.value) } : clip))} className="mt-2 w-full accent-fuchsia-500" />
                    </label>}
                    {selectedImage && <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-neutral-400">Entry transition
                            <select value={selectedImage.transition ?? 'fade'} onChange={(event) => setImages((current) => current.map((clip) => clip.id === selectedImage.id ? { ...clip, transition: event.target.value as ReelImage['transition'] } : clip))} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="cut">Cut</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="zoom">Zoom</option></select>
                        </label>
                        {selectedImage.type === 'image' && <label className="text-xs text-neutral-400">Photo motion
                            <select value={selectedImage.motion ?? 'none'} onChange={(event) => setImages((current) => current.map((clip) => clip.id === selectedImage.id ? { ...clip, motion: event.target.value as ReelImage['motion'] } : clip))} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="none">Still</option><option value="zoom-in">Slow zoom in</option><option value="zoom-out">Slow zoom out</option><option value="pan-left">Slow pan left</option><option value="pan-right">Slow pan right</option></select>
                        </label>}
                    </div>}
                    <label className="block text-xs text-neutral-400">Gradient overlay
                        <select value={gradient} onChange={(event) => setGradient(event.target.value as GradientPreset)} className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100">{GRADIENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                    </label>
                    {gradient !== 'none' && <label className="block text-xs text-neutral-400">Gradient strength · {gradientStrength}%<input type="range" min={0} max={85} value={gradientStrength} onChange={(event) => setGradientStrength(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label>}
                    <label className="block text-xs text-neutral-400">Brightness · {brightness}%<input type="range" min={60} max={150} value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label>
                    <label className="block text-xs text-neutral-400">Saturation · {saturation}%<input type="range" min={0} max={180} value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label>
                    {selectedImage && <p className="text-[10px] text-neutral-500">Image crop: fill frame. Current look applies to all photos.</p>}
                </section>

                <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <div><h2 className="text-sm font-semibold">Add text to a clip</h2><p className="mt-1 text-[11px] text-neutral-500">Select a photo or video above, then type a title or caption. Text appears over that clip in your reel.</p></div>
                    {selectedImage ? <>
                        <label className="block text-xs text-neutral-400">Describe this photo or clip for AI
                            <textarea value={selectedImage.description ?? ''} onChange={(event) => setImages((current) => current.map((image) => image.id === selectedImage.id ? { ...image, description: event.target.value.slice(0, 500) } : image))} maxLength={500} rows={2} placeholder="Example: A sunset walk along the beach…" className="mt-1 w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-fuchsia-500 focus:outline-none" />
                        </label>
                        <div className="flex gap-2">
                            <select aria-label="Caption language" value={captionLanguage} onChange={(event) => setCaptionLanguage(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option><option value="ta">Tamil</option><option value="te">Telugu</option></select>
                            <button type="button" onClick={() => void generateCaption(selectedImage)} disabled={isGeneratingCaption || (selectedImage.description ?? '').trim().length < 3} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{isGeneratingCaption ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate caption</button>
                        </div>
                        <textarea aria-label={`Text overlay for clip ${images.findIndex((image) => image.id === selectedImage.id) + 1}`} value={selectedImage.overlayText} onChange={(event) => setImages((current) => current.map((image) => image.id === selectedImage.id ? { ...image, overlayText: event.target.value.slice(0, 120) } : image))} maxLength={120} rows={2} placeholder="Type text to add to this clip…" className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-fuchsia-500 focus:outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-neutral-400">Design<select value={selectedImage.textStyle} onChange={(event) => setImages((current) => current.map((image) => image.id === selectedImage.id ? { ...image, textStyle: event.target.value as TextOverlayStyle } : image))} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="classic">Classic</option><option value="banner">Banner</option><option value="highlight">Highlight</option><option value="outline">Outline</option></select></label>
                            <label className="text-xs text-neutral-400">Position<select value={selectedImage.textPosition} onChange={(event) => setImages((current) => current.map((image) => image.id === selectedImage.id ? { ...image, textPosition: event.target.value as ReelImage['textPosition'] } : image))} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
                        </div>
                        {selectedImage.overlayText && <button type="button" onClick={() => setImages((current) => current.map((image) => image.id === selectedImage.id ? { ...image, overlayText: '' } : image))} className="text-left text-xs text-neutral-400 hover:text-red-300">Remove text from this photo</button>}
                    </> : <p className="rounded-lg border border-dashed border-neutral-700 px-3 py-4 text-center text-xs text-neutral-500">Add and select a photo or video above to edit its text.</p>}
                </section>

                <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <div>
                        <h2 className="text-sm font-semibold">Narration voiceover</h2>
                        <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">Write a short narration or leave it blank to read your clip captions in order. Gemini generates a voice track for the reel.</p>
                    </div>
                    <textarea value={narrationText} onChange={(event) => setNarrationText(event.target.value.slice(0, 2000))} maxLength={2000} rows={3} placeholder="Write what the narrator should say…" className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-fuchsia-500 focus:outline-none" />
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-neutral-400">Narration language
                            <select value={narrationLanguage} onChange={(event) => setNarrationLanguage(event.target.value as typeof narrationLanguage)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="en">English</option><option value="hi">Hindi</option><option value="bn">Bengali</option><option value="ta">Tamil</option><option value="te">Telugu</option></select>
                        </label>
                        <label className="text-xs text-neutral-400">Voice
                            <select value={narrationVoiceGender} onChange={(event) => setNarrationVoiceGender(event.target.value as typeof narrationVoiceGender)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-xs text-neutral-100"><option value="female">Female</option><option value="male">Male</option></select>
                        </label>
                    </div>
                    <button type="button" onClick={() => void generateVoiceover()} disabled={isGeneratingVoiceover || (!narrationText.trim() && !images.some((clip) => clip.overlayText.trim()))} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                        {isGeneratingVoiceover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{isGeneratingVoiceover ? 'Generating narration…' : 'Generate voiceover'}
                    </button>
                    {voiceover && <>
                        <audio ref={previewVoiceoverRef} src={voiceover.url} controls preload="auto" className="w-full" aria-label="Preview generated narration" onLoadedMetadata={(event) => {
                            const audio = event.currentTarget;
                            if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = Math.min(previewTimeRef.current / 1000, Math.max(0, audio.duration - 0.05));
                        }} />
                        <div className="flex gap-2"><a href={voiceover.url} download={voiceover.file.name} className="flex-1 rounded-md border border-neutral-700 px-2 py-2 text-center text-xs text-neutral-200 hover:bg-neutral-800">Download WAV</a><button type="button" onClick={() => { URL.revokeObjectURL(voiceover.url); setVoiceover(null); }} className="rounded-md border border-neutral-700 px-2 py-2 text-xs text-neutral-300 hover:border-red-500 hover:text-red-300">Remove voiceover</button></div>
                    </>}
                </section>

                <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
                    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Music2 className="h-4 w-4 text-fuchsia-300" /> Background music</h2>{music && <button type="button" onClick={() => { URL.revokeObjectURL(music.url); setMusic(null); }} className="text-xs text-neutral-500 hover:text-red-300">Remove</button>}</div>
                    <input ref={musicInputRef} type="file" accept="audio/*" onChange={setMusicFile} className="hidden" />
                    <button type="button" onClick={() => musicInputRef.current?.click()} className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 hover:border-fuchsia-500">{music ? music.file.name : 'Choose music from your device'}</button>
                    {music && <>
                        <audio ref={previewAudioRef} src={music.url} controls preload="auto" className="w-full" aria-label="Preview background music" onLoadedMetadata={(event) => {
                            const audio = event.currentTarget;
                            if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = (previewTimeRef.current / 1000) % audio.duration;
                        }} />
                        <label className="block text-xs text-neutral-400">Music volume · {musicVolume}%<input type="range" min={0} max={100} value={musicVolume} onChange={(event) => setMusicVolume(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" /></label>
                        <p className="text-[10px] text-neutral-500">Music plays across the reel and follows the timeline. Video clip audio is muted so it won’t compete with the soundtrack.</p>
                    </>}
                    {music && <button type="button" onClick={() => void syncToMusicBeat()} disabled={isAnalyzingBeats || images.length === 0} className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-300 hover:border-fuchsia-500 disabled:opacity-50">{isAnalyzingBeats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Music2 className="h-3.5 w-3.5" />}{isAnalyzingBeats ? 'Analyzing beat…' : 'Sync photo timing to beat'}</button>}
                    {beatSyncMessage && <p className="text-[10px] text-fuchsia-200">{beatSyncMessage}</p>}
                </section>
                <p className="text-[10px] leading-relaxed text-neutral-500">Use music you have permission to use. Free exports are limited to 60 seconds and include a small watermark.</p>
            </aside>

            <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col items-center justify-center gap-4 p-4 lg:min-h-0 lg:p-8">
                <div className="flex w-full max-w-4xl items-center justify-between gap-3">
                    <div><h2 className="text-lg font-semibold">Reel preview</h2><p className="text-xs text-neutral-500">{images.length} clips · {durationLabel}</p></div>
                    {images.length > 0 && <button type="button" onClick={togglePreview} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold hover:bg-neutral-800"><Play className="h-3.5 w-3.5" />{isPreviewPlaying ? 'Pause preview' : 'Play preview'}</button>}
                </div>
                <div className="relative flex max-h-[65dvh] min-h-80 w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                    <div className={`relative overflow-hidden rounded-xl bg-neutral-950 shadow-2xl ${aspectRatio === '9:16' ? 'h-[min(62dvh,38rem)] aspect-9/16' : aspectRatio === '1:1' ? 'h-[min(62dvh,38rem)] aspect-square' : 'w-full aspect-video'}`} style={transitionStyle}>
                        {activeImage?.type === 'video' ? <video key={activeImage.id} ref={previewVideoRef} src={activeImage.url} muted playsInline preload="auto" onLoadedMetadata={(event) => {
                            const video = event.currentTarget;
                            const localTime = Math.max(0, (previewTimeRef.current - activeClipStartMs) / 1000);
                            video.currentTime = Math.min(localTime, Math.max(0, video.duration - 0.05));
                            if (isPreviewPlaying) video.play().catch(() => setError('This video clip could not play in the preview.'));
                        }} className="h-full w-full object-cover" style={{ filter: filterStyle, ...photoMotionStyle }} /> : activeImage ? <img src={activeImage.url} alt={`${activeImage.type === 'image' ? 'Photo' : 'Video'} ${safePreviewIndex + 1} preview`} className="h-full w-full object-cover" style={{ filter: filterStyle, ...photoMotionStyle }} /> : <div className="flex h-full items-center justify-center text-center text-sm text-neutral-500"><span><ImagePlus className="mx-auto mb-3 h-8 w-8" />Add photos or videos to preview your reel</span></div>}
                        {activeImage && gradient !== 'none' && <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `${gradientColor}, ${gradientStyle}` }} />}
                        {activeImage?.overlayText && <div className={`pointer-events-none absolute left-1/2 w-[84%] -translate-x-1/2 px-3 py-2 text-center text-sm font-bold sm:text-xl ${activeImage.textPosition === 'top' ? 'top-[15%]' : activeImage.textPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[15%]'} ${activeImage.textStyle === 'banner' ? 'rounded-lg bg-black/80 text-white' : activeImage.textStyle === 'highlight' ? 'rounded-lg bg-yellow-400/95 text-neutral-950' : activeImage.textStyle === 'outline' ? 'text-white [text-shadow:-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000,1px_1px_0_#000]' : 'text-white [text-shadow:0_2px_7px_#000]'}`}>{activeImage.overlayText}</div>}
                        {activeImage && <div className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-[9px] font-semibold text-white/80">CLIPRAME · FREE</div>}
                    </div>
                </div>
                {images.length > 0 && <div className="w-full max-w-4xl rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
                    <div className="mb-2 flex justify-between text-[11px] font-mono text-neutral-400"><span>Photo {safePreviewIndex + 1} of {images.length}</span><span>{(previewTimeMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s</span></div>
                    <input aria-label="Reel preview timeline" type="range" min={0} max={Math.max(durationMs, 1)} step={100} value={Math.min(previewTimeMs, durationMs)} onChange={(event) => seekPreview(Number(event.target.value))} className="w-full cursor-pointer accent-fuchsia-500" />
                    <div className="mt-2 flex gap-1.5 overflow-x-auto">
                        {images.map((image, index) => <button key={image.id} type="button" onClick={() => { setSelectedImageId(image.id); setIsPreviewPlaying(false); seekPreview(images.slice(0, index).reduce((total, clip) => total + getClipDurationMs(clip), 0)); }} aria-label={`Preview clip ${index + 1}`} aria-pressed={safePreviewIndex === index} className={`relative h-11 w-10 shrink-0 overflow-hidden rounded border-2 ${safePreviewIndex === index ? 'border-fuchsia-400' : 'border-transparent'}`}>{image.type === 'video' ? <video src={image.url} muted playsInline className="h-full w-full object-cover" /> : <img src={image.url} alt="" className="h-full w-full object-cover" />}</button>)}
                    </div>
                </div>}
                {(isExporting || completedExportUrl) && <div role="status" aria-live="polite" className="w-full max-w-4xl rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                        {isExporting && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-fuchsia-300" />}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-neutral-100">
                                <span className="truncate">{exportStatus ?? 'Preparing your reel…'}</span>
                                {isExporting && <span className="shrink-0 tabular-nums text-fuchsia-200">{exportProgress}%</span>}
                            </div>
                            {isExporting && <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-linear-to-r from-fuchsia-600 to-indigo-400 transition-[width] duration-200" style={{ width: `${Math.max(3, exportProgress)}%` }} /></div>}
                        </div>
                        {completedExportUrl && !isExporting && <a href={completedExportUrl} download="photo-reel.mp4" className="shrink-0 rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-500"><Download className="mr-1 inline h-3.5 w-3.5" />Download reel</a>}
                    </div>
                </div>}
                <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                    <div className="text-xs text-neutral-400">{durationLabel} total {durationMs > FREE_VIDEO_LIMIT_MS && <span className="text-red-300">· Over 60-second limit</span>}</div>
                    <button type="button" onClick={() => void exportReel()} disabled={!images.length || isExporting || durationMs > FREE_VIDEO_LIMIT_MS} className="flex items-center gap-2 rounded-lg bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50">
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isExporting ? 'Rendering reel…' : completedExportUrl ? 'Create another export' : 'Create & download reel'}
                    </button>
                </div>
                {error && <p role="alert" className="w-full max-w-4xl rounded-lg border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs text-red-200">{error}</p>}
                <canvas ref={canvasRef} className="hidden" />
            </section>
        </main>
    );
}
