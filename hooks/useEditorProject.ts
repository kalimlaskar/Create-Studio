'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorProject, OverlayClip, CaptionCue, BackgroundSegment, AudioTrackClip, ColorGradeSettings, createEmptyProject, SpeedSegment } from '@/types/editor';
import { ZoomKeyframe } from '@/types/editor';

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

export function useEditorProject(sourceVideoUrl: string, initialProject?: EditorProject) {
    const [project, setProject] = useState<EditorProject | null>(null);
    const [playheadMs, setPlayheadMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSourceMuted, setIsSourceMuted] = useState(false);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceGainRef = useRef<GainNode | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const videoAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const musicAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

    const ensureAudioGraph = useCallback(() => {
        const video = videoRef.current;
        if (!video) return null;

        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (!audioDestinationRef.current) {
            audioDestinationRef.current = context.createMediaStreamDestination();
        }
        if (!videoAudioSourceRef.current) {
            const source = context.createMediaElementSource(video);
            const gain = context.createGain();
            gain.gain.value = isSourceMuted ? 0 : 1;
            source.connect(gain);
            gain.connect(context.destination);
            gain.connect(audioDestinationRef.current);
            videoAudioSourceRef.current = source;
            sourceGainRef.current = gain;
        }
        if (audioElRef.current && !musicAudioSourceRef.current) {
            const source = context.createMediaElementSource(audioElRef.current);
            const gain = context.createGain();
            gain.gain.value = project?.tracks.audio[0]?.volume ?? 0.3;
            source.connect(gain);
            gain.connect(context.destination);
            gain.connect(audioDestinationRef.current);
            musicAudioSourceRef.current = source;
            musicGainRef.current = gain;
        }
        return context;
    }, [isSourceMuted, project?.tracks.audio]);

    const addZoomKeyframe = useCallback((atMs: number, scale: number) => {
        setProject((prev) => {
            if (!prev) return prev;
            // Replace any existing keyframe within 50ms of this point instead of stacking duplicates
            const filtered = prev.tracks.zoom.filter((k) => Math.abs(k.atMs - atMs) > 50);
            const next = [...filtered, { id: generateId(), atMs, scale }].sort((a, b) => a.atMs - b.atMs);
            return { ...prev, tracks: { ...prev.tracks, zoom: next } };
        });
    }, []);

    const updateZoomKeyframe = useCallback((id: string, patch: Partial<ZoomKeyframe>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                zoom: prev.tracks.zoom.map((k) => (k.id === id ? { ...k, ...patch } : k)).sort((a, b) => a.atMs - b.atMs),
            },
        });
    }, []);

    const removeZoomKeyframe = useCallback((id: string) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, zoom: prev.tracks.zoom.filter((k) => k.id !== id) },
        });
    }, []);


    useEffect(() => {
        const track = project?.tracks.audio[0];
        if (!track) {
            audioElRef.current?.pause();
            audioElRef.current = null;
            return;
        }
        if (!audioElRef.current || audioElRef.current.src !== track.url) {
            audioElRef.current?.pause();
            musicAudioSourceRef.current?.disconnect();
            musicAudioSourceRef.current = null;
            musicGainRef.current?.disconnect();
            musicGainRef.current = null;
            const audio = new Audio(track.url);
            audio.loop = false;
            audioElRef.current = audio;
            if (audioContextRef.current && audioDestinationRef.current) {
                const source = audioContextRef.current.createMediaElementSource(audio);
                const gain = audioContextRef.current.createGain();
                source.connect(gain);
                gain.connect(audioContextRef.current.destination);
                gain.connect(audioDestinationRef.current);
                musicAudioSourceRef.current = source;
                musicGainRef.current = gain;
            }
        }
        audioElRef.current.volume = musicGainRef.current ? 1 : track.volume;
        if (musicGainRef.current) musicGainRef.current.gain.value = track.volume;
        const syncMusic = () => {
            const video = videoRef.current;
            const audio = audioElRef.current;
            if (!video || !audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
            if (video.currentTime * 1000 < track.startMs) {
                audio.pause();
                return;
            }
            const trackTime = Math.max(0, video.currentTime * 1000 - track.startMs) / 1000;
            if (trackTime * 1000 > track.endMs - track.startMs) {
                audio.pause();
                return;
            }
            const audioTime = trackTime % audio.duration;
            if (Math.abs(audio.currentTime - audioTime) > 0.35) audio.currentTime = audioTime;
            audio.playbackRate = video.playbackRate;
            if (isPlaying && !audio.paused) return;
            if (isPlaying && trackTime >= 0 && trackTime * 1000 < track.endMs - track.startMs) {
                audio.play().catch(() => { });
            }
        };
        const video = videoRef.current;
        video?.addEventListener('timeupdate', syncMusic);
        video?.addEventListener('seeking', syncMusic);
        syncMusic();
        return () => {
            video?.removeEventListener('timeupdate', syncMusic);
            video?.removeEventListener('seeking', syncMusic);
        };
    }, [isPlaying, project?.tracks.audio, videoRef]);

    useEffect(() => {
        if (isPlaying) {
            const context = ensureAudioGraph();
            if (context?.state === 'suspended') context.resume().catch(() => { });
            const track = project?.tracks.audio[0];
            const video = videoRef.current;
            if (track && video && audioElRef.current) {
                const audioTime = Math.max(0, video.currentTime * 1000 - track.startMs) / 1000;
                if (Number.isFinite(audioElRef.current.duration) && audioElRef.current.duration > 0) {
                    audioElRef.current.currentTime = audioTime % audioElRef.current.duration;
                    audioElRef.current.playbackRate = video.playbackRate;
                }
                audioElRef.current.play().catch(() => { });
            }
        } else {
            audioElRef.current?.pause();
        }
    }, [ensureAudioGraph, isPlaying, project?.tracks.audio]);

    // Once the source video's metadata loads, we know its real duration —
    // that's when the project actually gets created.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            const durationMs = Math.round(video.duration * 1000);
            const restored = initialProject
                ? { ...initialProject, sourceVideoUrl, tracks: { ...initialProject.tracks, speed: initialProject.tracks.speed ?? [] } }
                : createEmptyProject(sourceVideoUrl, durationMs);
            setProject((current) => current ?? restored);
            setIsSourceMuted(restored.muteOriginalAudio);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }, [sourceVideoUrl, initialProject]);

    // Keep playheadMs in sync with actual video playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => setPlayheadMs(Math.round(video.currentTime * 1000));
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
        };
    }, []);

    const play = useCallback(() => {
        const context = ensureAudioGraph();
        if (context?.state === 'suspended') context.resume().catch(() => { });
        return videoRef.current?.play();
    }, [ensureAudioGraph]);
    const pause = useCallback(() => videoRef.current?.pause(), []);
    const togglePlay = useCallback(() => {
        if (isPlaying) pause(); else play();
    }, [isPlaying, play, pause]);

    const seekTo = useCallback((ms: number) => {
        const video = videoRef.current;
        if (!video || !project) return;
        const clamped = Math.max(0, Math.min(ms, project.durationMs));
        video.currentTime = clamped / 1000;
        setPlayheadMs(clamped);
    }, [project]);

    const toggleSourceAudio = useCallback(() => {
        setIsSourceMuted((muted) => {
            const nextMuted = !muted;
            ensureAudioGraph();
            if (sourceGainRef.current) sourceGainRef.current.gain.value = nextMuted ? 0 : 1;
            setProject((prev) => prev ? { ...prev, muteOriginalAudio: nextMuted } : prev);
            return nextMuted;
        });
    }, [ensureAudioGraph]);

    const getMixedAudioStream = useCallback(() => {
        const context = ensureAudioGraph();
        if (context?.state === 'suspended') context.resume().catch(() => { });
        return audioDestinationRef.current?.stream ?? null;
    }, [ensureAudioGraph]);

    const addSpeedSegment = useCallback((segment: Omit<SpeedSegment, 'id'>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, speed: [...prev.tracks.speed, { ...segment, id: generateId() }] },
        });
    }, []);

    const updateSpeedSegment = useCallback((id: string, patch: Partial<SpeedSegment>) => {
        setProject((prev) => prev && ({
            ...prev,
            tracks: { ...prev.tracks, speed: prev.tracks.speed.map((segment) => segment.id === id ? { ...segment, ...patch } : segment) },
        }));
    }, []);

    const removeSpeedSegment = useCallback((id: string) => {
        setProject((prev) => prev && ({
            ...prev,
            tracks: { ...prev.tracks, speed: prev.tracks.speed.filter((segment) => segment.id !== id) },
        }));
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !project) return;
        const updateRate = () => {
            const timeMs = video.currentTime * 1000;
            const segment = project.tracks.speed.find((item) => timeMs >= item.startMs && timeMs <= item.endMs);
            video.playbackRate = segment?.rate ?? 1;
            if (audioElRef.current) audioElRef.current.playbackRate = video.playbackRate;
            const musicTrack = project.tracks.audio[0];
            if (musicTrack && audioElRef.current && timeMs < musicTrack.startMs) audioElRef.current.pause();
        };
        video.addEventListener('timeupdate', updateRate);
        video.addEventListener('seeked', updateRate);
        updateRate();
        return () => {
            video.removeEventListener('timeupdate', updateRate);
            video.removeEventListener('seeked', updateRate);
            video.playbackRate = 1;
        };
    }, [project, videoRef]);

    // Generic track mutators — every future feature (subtitles, music, overlays,
    // background swap) goes through these instead of touching setProject directly.
    const addOverlay = useCallback((clip: Omit<OverlayClip, 'id'>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, overlays: [...prev.tracks.overlays, { ...clip, id: generateId() }] },
        });
    }, []);

    const updateOverlay = useCallback((id: string, patch: Partial<OverlayClip>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                overlays: prev.tracks.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
            },
        });
    }, []);

    const removeOverlay = useCallback((id: string) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, overlays: prev.tracks.overlays.filter((o) => o.id !== id) },
        });
    }, []);

    const addCaption = useCallback((cue: Omit<CaptionCue, 'id'>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, captions: [...prev.tracks.captions, { ...cue, id: generateId() }] },
        });
    }, []);

    const updateCaption = useCallback((id: string, patch: Partial<CaptionCue>) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                captions: prev.tracks.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            },
        });
    }, []);

    const removeCaption = useCallback((id: string) => {
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, captions: prev.tracks.captions.filter((c) => c.id !== id) },
        });
    }, []);

    const setBackgroundSegments = useCallback((segments: BackgroundSegment[]) => {
        setProject((prev) => prev && { ...prev, tracks: { ...prev.tracks, background: segments } });
    }, []);

    const setAudioTracks = useCallback((tracks: AudioTrackClip[]) => {
        setProject((prev) => prev && { ...prev, tracks: { ...prev.tracks, audio: tracks } });
    }, []);

    const updateColorGrade = useCallback((patch: Partial<ColorGradeSettings>) => {
        setProject((prev) => prev && { ...prev, colorGrade: { ...prev.colorGrade, ...patch } });
    }, []);

    return {
        project,
        videoRef,
        playheadMs,
        isPlaying,
        isSourceMuted,
        toggleSourceAudio,
        getMixedAudioStream,
        play,
        pause,
        togglePlay,
        seekTo,
        addOverlay,
        updateOverlay,
        removeOverlay,
        addCaption,
        updateCaption,
        removeCaption,
        setBackgroundSegments,
        setAudioTracks,
        updateColorGrade,
        addZoomKeyframe,
        updateZoomKeyframe,
        removeZoomKeyframe,
        addSpeedSegment,
        updateSpeedSegment,
        removeSpeedSegment,
    };
}