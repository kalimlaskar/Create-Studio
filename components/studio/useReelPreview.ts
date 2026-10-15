'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ReelAssets } from './reelAssets';
import { Timeline, indexAtTime } from './reelTimeline';
import { ReelImage, clamp } from './reelTypes';

interface Options {
    clips: ReelImage[];
    timeline: Timeline;
    assets: ReelAssets;
    music: { url: string } | null;
    musicVolume: number;
    musicAudioRef: RefObject<HTMLAudioElement | null>;
    voiceAudioRef: RefObject<HTMLAudioElement | null>;
    onError: (message: string) => void;
    /** Called when a video frame becomes available so the canvas can redraw. */
    onFrame: () => void;
}

export function useReelPreview(options: Options) {
    const { clips, timeline, assets, music, musicVolume, musicAudioRef, voiceAudioRef } = options;

    const [timeMs, setTimeMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const timeRef = useRef(0);

    // Latest values for callbacks / rAF loops that must not re-subscribe on every change.
    const live = useRef({ clips, timeline });
    live.current = { clips, timeline };
    const callbacks = useRef({ onError: options.onError, onFrame: options.onFrame });
    callbacks.current = { onError: options.onError, onFrame: options.onFrame };

    const safeTimeMs = Math.min(timeMs, timeline.total);
    const activeIndex = indexAtTime(timeline, safeTimeMs);
    const activeClip = clips[activeIndex] ?? null;
    const activeClipStartMs = timeline.starts[activeIndex] ?? 0;

    const syncVideoTo = useCallback((ms: number) => {
        const { clips: currentClips, timeline: currentTimeline } = live.current;
        const index = indexAtTime(currentTimeline, ms);
        const clip = currentClips[index];
        if (!clip || clip.type !== 'video') return;
        const video = assets.getVideo(clip);
        if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
        const local = Math.max(0, ((ms - currentTimeline.starts[index]) / 1000) * (clip.speed ?? 1));
        video.currentTime = Math.min(local, Math.max(0, (video.duration || local) - 0.05));
    }, [assets]);

    const seek = useCallback((ms: number) => {
        const next = clamp(ms, 0, live.current.timeline.total);
        timeRef.current = next;
        setTimeMs(next);

        const music = musicAudioRef.current;
        if (music && Number.isFinite(music.duration) && music.duration > 0) music.currentTime = (next / 1000) % music.duration;
        const voice = voiceAudioRef.current;
        if (voice && Number.isFinite(voice.duration) && voice.duration > 0) voice.currentTime = Math.min(next / 1000, Math.max(0, voice.duration - 0.05));

        syncVideoTo(next);
    }, [musicAudioRef, voiceAudioRef, syncVideoTo]);

    const pause = useCallback(() => setIsPlaying(false), []);

    const toggle = useCallback(() => {
        if (!live.current.clips.length) return;
        if (isPlaying) {
            setIsPlaying(false);
            return;
        }
        if (timeRef.current >= live.current.timeline.total) seek(0);
        setIsPlaying(true);
    }, [isPlaying, seek]);

    /* Playback clock + audio sync */
    const hasClips = clips.length > 0;
    useEffect(() => {
        if (!isPlaying || !hasClips) return;
        let frameId = 0;
        let last = performance.now();
        const music = musicAudioRef.current;
        const voice = voiceAudioRef.current;

        if (music && Number.isFinite(music.duration) && music.duration > 0) {
            music.currentTime = (timeRef.current / 1000) % music.duration;
            music.play().catch(() => callbacks.current.onError('The music preview could not start.'));
        }
        if (voice && Number.isFinite(voice.duration) && voice.duration > 0 && timeRef.current < voice.duration * 1000) {
            voice.currentTime = timeRef.current / 1000;
            voice.play().catch(() => callbacks.current.onError('The voiceover preview could not start.'));
        }

        const advance = (now: number) => {
            const { clips: currentClips, timeline: currentTimeline } = live.current;
            const elapsed = now - last;
            last = now;
            const next = Math.min(currentTimeline.total, timeRef.current + elapsed);
            timeRef.current = next;
            setTimeMs(next);

            const m = musicAudioRef.current;
            if (m && !m.paused && Number.isFinite(m.duration) && m.duration > 0) {
                const expected = (next / 1000) % m.duration;
                if (Math.abs(m.currentTime - expected) > 0.4) m.currentTime = expected;
            }
            const v = voiceAudioRef.current;
            if (v && !v.paused && Number.isFinite(v.duration) && v.duration > 0) {
                if (next < v.duration * 1000) {
                    if (Math.abs(v.currentTime - next / 1000) > 0.4) v.currentTime = next / 1000;
                } else v.pause();
            }

            // Keep the playing video clip in step with the timeline.
            const index = indexAtTime(currentTimeline, next);
            const clip = currentClips[index];
            if (clip?.type === 'video') {
                const video = assets.getVideo(clip);
                const expected = ((next - currentTimeline.starts[index]) / 1000) * (clip.speed ?? 1);
                if (!video.paused && Math.abs(video.currentTime - expected) > 0.4) video.currentTime = expected;
            }

            if (next >= currentTimeline.total) {
                setIsPlaying(false);
                return;
            }
            frameId = requestAnimationFrame(advance);
        };
        frameId = requestAnimationFrame(advance);

        return () => {
            cancelAnimationFrame(frameId);
            music?.pause();
            voice?.pause();
        };
    }, [isPlaying, hasClips, assets, musicAudioRef, voiceAudioRef]);

    /* Music element settings */
    useEffect(() => {
        const audio = musicAudioRef.current;
        if (audio) {
            audio.volume = musicVolume / 100;
            audio.loop = true;
            if (!music) audio.pause();
        }
        const voice = voiceAudioRef.current;
        if (voice) voice.volume = 1;
    }, [music, musicVolume, musicAudioRef, voiceAudioRef]);

    /* Active video clip: speed, seeking, play / pause, redraw on new frames */
    const activeClipId = activeClip?.id;
    const activeClipType = activeClip?.type;
    const activeClipSpeed = activeClip?.speed ?? 1;
    useEffect(() => {
        if (!activeClip || activeClip.type !== 'video') return;
        const video = assets.getVideo(activeClip);
        video.muted = true;
        video.playbackRate = activeClipSpeed;

        const bump = () => callbacks.current.onFrame();
        video.addEventListener('seeked', bump);
        video.addEventListener('loadeddata', bump);

        syncVideoTo(timeRef.current);
        if (isPlaying) video.play().catch(() => callbacks.current.onError('This video clip could not play in the preview.'));
        else video.pause();

        return () => {
            video.pause();
            video.removeEventListener('seeked', bump);
            video.removeEventListener('loadeddata', bump);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeClipId, activeClipType, activeClipSpeed, activeClipStartMs, isPlaying, assets, syncVideoTo]);

    return { timeMs: safeTimeMs, isPlaying, activeIndex, activeClip, activeClipStartMs, seek, toggle, pause };
}
