'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { getExportDimensions, RECORDING_FRAME_RATE } from '@/components/recordingQuality';
import { FREE_VIDEO_LIMIT_MS } from '@/components/freeTier';
import type { AspectRatioType } from '@/types/studio';
import { isDepthMotion } from './depthEstimator';
import type { LoadedFile } from './reelDraftData';
import {
    ensureVideoMetadata, nextFrame, seekVideo, sleep, waitForImageDecode, waitForVideoFrame,
} from './reelMedia';
import { RenderContext, renderFrame } from './reelRenderer';
import { indexAtTime } from './reelTimeline';
import type { ReelImage } from './reelTypes';

interface Options {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    /** Returns the latest render context (clips, settings, assets...). Snapshotted when export starts. */
    getRenderContext: () => RenderContext;
    music: LoadedFile | null;
    voiceover: LoadedFile | null;
    ensureDepth: (clip: ReelImage) => Promise<void>;
    onError: (message: string) => void;
}

/** MP4 first (no lossy WebM -> MP4 re-encode, no timing drift), WebM as fallback. */
const pickMimeType = () => {
    const candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm',
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
};

export function useReelExport({ canvasRef, getRenderContext, music, voiceover, ensureDepth, onError }: Options) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string | null>(null);
    const [completedUrl, setCompletedUrl] = useState<string | null>(null);

    useEffect(() => () => {
        if (completedUrl) URL.revokeObjectURL(completedUrl);
    }, [completedUrl]);

    const run = useCallback(async () => {
        const rc = getRenderContext();
        const { clips, timeline, settings, assets } = rc;
        if (!clips.length || isExporting) return;
        if (timeline.total > FREE_VIDEO_LIMIT_MS) {
            onError('This free-plan reel can be up to 60 seconds.');
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsExporting(true);
        setProgress(0);
        setCompletedUrl(null);
        setStatus('Preparing your photos, clips, and audio…');

        let stream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let audioContext: AudioContext | null = null;
        const audioElements: HTMLAudioElement[] = [];

        try {
            const dimensions = getExportDimensions(settings.aspectRatio as unknown as AspectRatioType, '1080p');
            canvas.width = dimensions.width;
            canvas.height = dimensions.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not prepare the reel canvas.');

            /* 1. Depth maps (awaits the real in-flight job) */
            const depthClips = clips.filter((clip) => clip.type === 'image' && isDepthMotion(clip.motion));
            for (const [index, clip] of depthClips.entries()) {
                setStatus(`Computing 3D depth map ${index + 1} of ${depthClips.length}…`);
                await ensureDepth(clip);
            }

            /* 2. Decode photos, grab poster frames for videos, park every video at 0 */
            for (const [index, clip] of clips.entries()) {
                setStatus(`Preparing clip ${index + 1} of ${clips.length}…`);
                if (clip.type === 'image') {
                    await waitForImageDecode(assets.getImage(clip), clip.file.name);
                    continue;
                }
                const video = assets.getVideo(clip);
                await ensureVideoMetadata(video, clip.file.name);
                if (!(await waitForVideoFrame(video, clip.file.name))) throw new Error(`Could not decode a frame from ${clip.file.name}.`);
                const poster = document.createElement('canvas');
                poster.width = video.videoWidth;
                poster.height = video.videoHeight;
                poster.getContext('2d')?.drawImage(video, 0, 0, poster.width, poster.height);
                assets.posters.set(clip.id, poster);
                video.pause();
                await seekVideo(video, 0);
            }

            /* 3. First frame before the stream starts, so the recording never begins blank */
            renderFrame(ctx, rc, 0, { watermark: true });
            stream = canvas.captureStream(RECORDING_FRAME_RATE);
            const tracks = [...stream.getVideoTracks()];

            /* 4. Audio graph */
            if (music || voiceover) {
                audioContext = new AudioContext();
                const destination = audioContext.createMediaStreamDestination();
                tracks.push(...destination.stream.getAudioTracks());
                await audioContext.resume();

                const prepare = async (url: string, volume: number, loop: boolean, label: string) => {
                    const element = new Audio(url);
                    element.preload = 'auto';
                    element.loop = loop;
                    const source = audioContext!.createMediaElementSource(element);
                    const gain = audioContext!.createGain();
                    gain.gain.value = volume;
                    source.connect(gain);
                    gain.connect(destination);
                    await new Promise<void>((resolve, reject) => {
                        if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) { resolve(); return; }
                        const timeout = window.setTimeout(() => reject(new Error(`${label} loading timeout.`)), 10000);
                        element.addEventListener('canplay', () => { window.clearTimeout(timeout); resolve(); }, { once: true });
                        element.load();
                    });
                    element.currentTime = 0;
                    audioElements.push(element);
                    return element;
                };

                if (music) await prepare(music.url, settings.musicVolume / 100, true, 'Background music');
                if (voiceover) await prepare(voiceover.url, 1, false, 'Voiceover');
            }

            /* 5. Recorder */
            const mimeType = pickMimeType();
            recorder = new MediaRecorder(new MediaStream(tracks), { mimeType, videoBitsPerSecond: 8_000_000 });
            const activeRecorder = recorder;
            const chunks: Blob[] = [];
            const recording = new Promise<Blob>((resolve, reject) => {
                activeRecorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
                activeRecorder.onerror = () => reject(new Error('Browser encoding error.'));
                activeRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: activeRecorder.mimeType || mimeType });
                    if (blob.size) resolve(blob);
                    else reject(new Error('Exported reel is empty.'));
                };
            });
            recording.catch(() => undefined); // avoid an unhandled rejection if we abort early

            /* 6. Render loop driven by the REAL clock.
               MediaRecorder records wall-clock time, so frame time must come from performance.now(),
               not from a fixed "+33 ms per frame" counter - that is what made exports run too fast. */
            setStatus('Rendering your reel… keep this tab visible until it finishes.');
            activeRecorder.start();
            await Promise.all(audioElements.map((element) => element.play().catch(() => undefined)));

            const total = timeline.total;
            const startedAt = performance.now();
            let currentIndex = -1;

            while (true) {
                let elapsed = performance.now() - startedAt;
                if (elapsed >= total) break;

                const index = indexAtTime(timeline, elapsed);
                const clip = clips[index];

                if (index !== currentIndex) {
                    currentIndex = index;
                    setStatus(`Rendering clip ${index + 1} of ${clips.length}…`);
                    assets.pauseAllVideos(clip.type === 'video' ? clip.id : undefined);
                    if (clip.type === 'video') {
                        const video = assets.getVideo(clip);
                        video.muted = true;
                        video.playbackRate = clip.speed ?? 1;
                        await video.play().catch(() => undefined);
                        elapsed = performance.now() - startedAt;
                    }
                } else if (clip.type === 'video') {
                    // Only correct real drift; constant re-seeking makes frames stale.
                    const video = assets.getVideo(clip);
                    const expected = ((elapsed - timeline.starts[index]) / 1000) * (clip.speed ?? 1);
                    if (Math.abs(video.currentTime - expected) > 0.35) video.currentTime = expected;
                }

                renderFrame(ctx, rc, Math.min(elapsed, total - 1), { watermark: true });
                setProgress(5 + Math.min(80, Math.floor((elapsed / total) * 80)));
                await nextFrame();
            }

            // Hold the final frame so the encoder doesn't cut off the tail.
            renderFrame(ctx, rc, Math.max(0, total - 1), { watermark: true });
            await sleep(300);
            assets.pauseAllVideos();
            if (activeRecorder.state === 'recording') {
                activeRecorder.requestData();
                activeRecorder.stop();
            }

            let result = await recording;

            /* 7. Convert only if the browser could not record MP4 directly */
            if (!result.type.toLowerCase().startsWith('video/mp4')) {
                setStatus('Encoding MP4…');
                setProgress(85);
                const { convertWebmToMp4 } = await import('@/components/editor/convertToMp4');
                result = await convertWebmToMp4(result, (value: number) => setProgress(85 + Math.round(value * 0.15)));
            }

            const url = URL.createObjectURL(result);
            setCompletedUrl(url);
            setStatus('Reel is ready! Your download should start automatically.');
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'product-reel.mp4';
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setProgress(100);
        } catch (cause) {
            if (recorder?.state === 'recording') recorder.stop();
            onError(cause instanceof Error ? cause.message : 'Could not export reel.');
            setStatus('Export stopped.');
        } finally {
            if (recorder?.state === 'recording') recorder.stop();
            audioElements.forEach((element) => element.pause());
            assets.pauseAllVideos();
            assets.posters.clear();
            stream?.getTracks().forEach((track) => track.stop());
            await audioContext?.close().catch(() => undefined);
            setIsExporting(false);
        }
    }, [canvasRef, getRenderContext, music, voiceover, ensureDepth, isExporting, onError]);

    return { isExporting, progress, status, completedUrl, run };
}
