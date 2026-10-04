'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { EditorProject, OverlayClip, CaptionCue, CaptionStyle, BackgroundSegment, AudioTrackClip, ColorGradeSettings, createEmptyProject, SpeedSegment, EditorTabId, DEFAULT_COLOR_GRADE } from '@/types/editor';
import { AspectRatioType } from '@/types/studio';
import { ScriptLanguage } from '@/types/studio';
import { ZoomKeyframe } from '@/types/editor';
import { COMPOSITE_STYLE_PRESETS, getStyleZoomKeyframe } from '@/components/editor/stylePresets';

function generateId() {
    return Math.random().toString(36).slice(2, 10);
}

const MAX_TAB_HISTORY = 40;
const EMPTY_UNDO_COUNTS = (): Record<EditorTabId, number> => ({ color: 0, text: 0, captions: 0, zoom: 0, speed: 0, music: 0, style: 0, clip: 0, coach: 0 });

function getTabSnapshot(project: EditorProject, tab: EditorTabId): unknown {
    switch (tab) {
        case 'color': return { ...project.colorGrade };
        case 'text': return project.tracks.overlays.map((overlay) => ({ ...overlay }));
        case 'captions': return { cues: project.tracks.captions.map((cue) => ({ ...cue })), style: project.captionStyle };
        case 'zoom': return project.tracks.zoom.map((keyframe) => ({ ...keyframe }));
        case 'speed': return project.tracks.speed.map((segment) => ({ ...segment }));
        case 'music': return project.tracks.audio.map((track) => ({ ...track }));
        case 'style': return { colorGrade: { ...project.colorGrade }, captionStyle: project.captionStyle, zoom: project.tracks.zoom.map((keyframe) => ({ ...keyframe })) };
        case 'clip': return { ...project.videoEdit, splitPointsMs: [...project.videoEdit.splitPointsMs] };
        case 'coach': return null;
    }
}

function isTabDirty(project: EditorProject, tab: EditorTabId): boolean {
    switch (tab) {
        case 'color': return Object.keys(DEFAULT_COLOR_GRADE).some((key) => project.colorGrade[key as keyof ColorGradeSettings] !== DEFAULT_COLOR_GRADE[key as keyof ColorGradeSettings]);
        case 'text': return project.tracks.overlays.length > 0;
        case 'captions': return project.tracks.captions.length > 0 || project.captionStyle !== 'classic';
        case 'zoom': return project.tracks.zoom.length > 0;
        case 'speed': return project.tracks.speed.length > 0;
        case 'music': return project.tracks.audio.length > 0;
        case 'style': return isTabDirty(project, 'color') || isTabDirty(project, 'captions') || isTabDirty(project, 'zoom');
        case 'clip': return project.videoEdit.trimStartMs > 0 || project.videoEdit.trimEndMs < project.durationMs || project.videoEdit.splitPointsMs.length > 0;
        case 'coach': return false;
    }
}

export function useEditorProject(sourceVideoUrl: string, initialProject?: EditorProject, aspectRatio: AspectRatioType = '16:9', initialScript = '', initialScriptLanguage: ScriptLanguage = 'en', sourceDurationMs?: number) {
    const [project, setProject] = useState<EditorProject | null>(null);
    const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
    const [undoCounts, setUndoCounts] = useState<Record<EditorTabId, number>>(EMPTY_UNDO_COUNTS);
    const undoHistoryRef = useRef<Record<EditorTabId, unknown[]>>({ color: [], text: [], captions: [], zoom: [], speed: [], music: [], style: [], clip: [], coach: [] });
    const [playheadMs, setPlayheadMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSourceMuted, setIsSourceMuted] = useState(false);
    const audioElRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceGainRef = useRef<GainNode | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const sourceAudioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const videoAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const musicAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

    const pushTabHistory = useCallback((tab: EditorTabId, snapshot: unknown) => {
        const history = undoHistoryRef.current[tab];
        history.push(snapshot);
        if (history.length > MAX_TAB_HISTORY) history.shift();
        setUndoCounts((counts) => ({ ...counts, [tab]: history.length }));
    }, []);

    const rememberTab = useCallback((tab: EditorTabId) => {
        if (project) pushTabHistory(tab, getTabSnapshot(project, tab));
    }, [project, pushTabHistory]);

    const undoTab = useCallback((tab: EditorTabId) => {
        const history = undoHistoryRef.current[tab];
        const snapshot = history.pop();
        if (snapshot === undefined) return;
        setUndoCounts((counts) => ({ ...counts, [tab]: history.length }));
        setProject((current) => {
            if (!current) return current;
            switch (tab) {
                case 'color': return { ...current, colorGrade: snapshot as ColorGradeSettings };
                case 'text': return { ...current, tracks: { ...current.tracks, overlays: snapshot as OverlayClip[] } };
                case 'captions': {
                    const captionSnapshot = snapshot as { cues: CaptionCue[]; style: CaptionStyle };
                    return { ...current, tracks: { ...current.tracks, captions: captionSnapshot.cues }, captionStyle: captionSnapshot.style };
                }
                case 'zoom': return { ...current, tracks: { ...current.tracks, zoom: snapshot as EditorProject['tracks']['zoom'] } };
                case 'speed': return { ...current, tracks: { ...current.tracks, speed: snapshot as SpeedSegment[] } };
                case 'music': return { ...current, tracks: { ...current.tracks, audio: snapshot as AudioTrackClip[] } };
                case 'style': {
                    const style = snapshot as { colorGrade: ColorGradeSettings; captionStyle: CaptionStyle; zoom: EditorProject['tracks']['zoom'] };
                    return { ...current, colorGrade: style.colorGrade, captionStyle: style.captionStyle, tracks: { ...current.tracks, zoom: style.zoom } };
                }
                case 'clip': return { ...current, videoEdit: snapshot as EditorProject['videoEdit'] };
                case 'coach': return current;
            }
        });
    }, []);

    const resetTab = useCallback((tab: EditorTabId) => {
        if (!project || !isTabDirty(project, tab)) return;
        rememberTab(tab);
        setProject((current) => {
            if (!current) return current;
            switch (tab) {
                case 'color': return { ...current, colorGrade: { ...DEFAULT_COLOR_GRADE } };
                case 'text': return { ...current, tracks: { ...current.tracks, overlays: [] } };
                case 'captions': return { ...current, tracks: { ...current.tracks, captions: [] }, captionStyle: 'classic' };
                case 'zoom': return { ...current, tracks: { ...current.tracks, zoom: [] } };
                case 'speed': return { ...current, tracks: { ...current.tracks, speed: [] } };
                case 'music': return { ...current, tracks: { ...current.tracks, audio: [] } };
                case 'style': return { ...current, colorGrade: { ...DEFAULT_COLOR_GRADE }, captionStyle: 'classic', tracks: { ...current.tracks, zoom: [] } };
                case 'clip': return { ...current, videoEdit: { trimStartMs: 0, trimEndMs: current.durationMs, splitPointsMs: [] } };
                case 'coach': return current;
            }
        });
    }, [project, rememberTab]);

    const ensureAudioGraph = useCallback(() => {
        const video = videoRef.current;
        if (!video) return null;

        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (!audioDestinationRef.current) {
            audioDestinationRef.current = context.createMediaStreamDestination();
        }
        if (!sourceAudioDestinationRef.current) {
            sourceAudioDestinationRef.current = context.createMediaStreamDestination();
        }
        if (!videoAudioSourceRef.current) {
            const source = context.createMediaElementSource(video);
            const gain = context.createGain();
            gain.gain.value = isSourceMuted ? 0 : 1;
            source.connect(gain);
            gain.connect(context.destination);
            gain.connect(audioDestinationRef.current);
            source.connect(sourceAudioDestinationRef.current);
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
        if (!project) return;
        rememberTab('zoom');
        setProject((prev) => {
            if (!prev) return prev;
            // Replace any existing keyframe within 50ms of this point instead of stacking duplicates
            const filtered = prev.tracks.zoom.filter((k) => Math.abs(k.atMs - atMs) > 50);
            const next = [...filtered, { id: generateId(), atMs, scale }].sort((a, b) => a.atMs - b.atMs);
            return { ...prev, tracks: { ...prev.tracks, zoom: next } };
        });
    }, [project, rememberTab]);

    const updateZoomKeyframe = useCallback((id: string, patch: Partial<ZoomKeyframe>) => {
        if (!project) return;
        rememberTab('zoom');
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                zoom: prev.tracks.zoom.map((k) => (k.id === id ? { ...k, ...patch } : k)).sort((a, b) => a.atMs - b.atMs),
            },
        });
    }, [project, rememberTab]);

    const removeZoomKeyframe = useCallback((id: string) => {
        if (!project) return;
        rememberTab('zoom');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, zoom: prev.tracks.zoom.filter((k) => k.id !== id) },
        });
    }, [project, rememberTab]);


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

        let durationProbeTimer: number | null = null;
        let durationProbeActive = false;

        const createProjectFromDuration = (durationSeconds: number) => {
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
            setProjectLoadError(null);
            const durationMs = Math.round(durationSeconds * 1000);
            const savedVideoEdit = initialProject?.videoEdit;
            let trimStartMs = savedVideoEdit && Number.isFinite(savedVideoEdit.trimStartMs)
                ? Math.max(0, Math.min(savedVideoEdit.trimStartMs, durationMs - 250))
                : 0;
            let trimEndMs = savedVideoEdit && Number.isFinite(savedVideoEdit.trimEndMs)
                ? Math.max(trimStartMs + 250, Math.min(savedVideoEdit.trimEndMs, durationMs))
                : durationMs;
            if (trimEndMs > durationMs || trimStartMs >= durationMs || trimEndMs <= trimStartMs) {
                trimStartMs = 0;
                trimEndMs = durationMs;
            }
            const videoEdit = {
                trimStartMs,
                trimEndMs,
                splitPointsMs: (savedVideoEdit?.splitPointsMs ?? []).filter((point) => Number.isFinite(point) && point > trimStartMs && point < trimEndMs),
            };
            const restored = initialProject
                ? { ...initialProject, title: initialProject.title ?? 'Untitled creator project', teleprompterScript: initialProject.teleprompterScript ?? initialScript, scriptLanguage: initialProject.scriptLanguage ?? initialScriptLanguage, durationMs, aspectRatio: initialProject.aspectRatio ?? aspectRatio, captionStyle: initialProject.captionStyle ?? 'classic', videoEdit, sourceVideoUrl, tracks: { ...initialProject.tracks, captions: initialProject.tracks.captions ?? [], speed: initialProject.tracks.speed ?? [] } }
                : createEmptyProject(sourceVideoUrl, durationMs, aspectRatio, initialScript, initialScriptLanguage);
            setProject((current) => current ?? restored);
            setIsSourceMuted(restored.muteOriginalAudio);
        };

        const finishDurationProbe = () => {
            if (!durationProbeActive || !Number.isFinite(video.duration) || video.duration <= 0) return;
            durationProbeActive = false;
            if (durationProbeTimer !== null) window.clearTimeout(durationProbeTimer);
            durationProbeTimer = null;
            video.removeEventListener('durationchange', handleDurationProbeProgress);
            video.removeEventListener('timeupdate', handleDurationProbeProgress);
            video.removeEventListener('seeked', handleDurationProbeProgress);
            const durationSeconds = video.duration;
            const initializeAtStart = () => {
                video.removeEventListener('seeked', initializeAtStart);
                createProjectFromDuration(durationSeconds);
            };
            if (video.currentTime > 0.05) {
                video.addEventListener('seeked', initializeAtStart, { once: true });
                video.currentTime = 0;
                window.setTimeout(() => createProjectFromDuration(durationSeconds), 1500);
            } else {
                createProjectFromDuration(durationSeconds);
            }
        };

        const handleDurationProbeProgress = () => finishDurationProbe();

        const handleLoadedMetadata = () => {
            if (Number.isFinite(video.duration) && video.duration > 0) {
                createProjectFromDuration(video.duration);
                return;
            }
            if (sourceDurationMs && Number.isFinite(sourceDurationMs) && sourceDurationMs > 0) {
                createProjectFromDuration(sourceDurationMs / 1000);
                return;
            }

            // Chrome/Safari can report Infinity for MediaRecorder WebM until a
            // seek to the end causes duration and cues to be finalized.
            durationProbeActive = true;
            video.addEventListener('durationchange', handleDurationProbeProgress);
            video.addEventListener('timeupdate', handleDurationProbeProgress);
            video.addEventListener('seeked', handleDurationProbeProgress);
            durationProbeTimer = window.setTimeout(() => {
                durationProbeActive = false;
                video.removeEventListener('durationchange', handleDurationProbeProgress);
                video.removeEventListener('timeupdate', handleDurationProbeProgress);
                video.removeEventListener('seeked', handleDurationProbeProgress);
                setProjectLoadError('The browser could not determine this recording’s duration. Try re-recording or use an MP4 source.');
            }, 5000);
            try {
                video.currentTime = Number.MAX_SAFE_INTEGER;
            } catch {
                setProjectLoadError('This recording has no readable duration metadata. Try re-recording or use an MP4 source.');
                durationProbeActive = false;
                if (durationProbeTimer !== null) window.clearTimeout(durationProbeTimer);
                durationProbeTimer = null;
                video.removeEventListener('durationchange', handleDurationProbeProgress);
                video.removeEventListener('timeupdate', handleDurationProbeProgress);
                video.removeEventListener('seeked', handleDurationProbeProgress);
            }
        };

        const handleVideoError = () => {
            const code = video.error?.code;
            const message = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                ? 'This browser could not decode this video. Try downloading the original recording or re-recording with a supported browser format.'
                : 'The video could not be loaded. Check that the source file is available and try again.';
            setProjectLoadError(message);
        };

        const metadataTimeout = window.setTimeout(() => {
            if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
                setProjectLoadError('The video is taking too long to load. The file may be incomplete or unsupported by this browser.');
            }
        }, 12_000);

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleVideoError);
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            window.setTimeout(handleLoadedMetadata, 0);
        }
        return () => {
            window.clearTimeout(metadataTimeout);
            if (durationProbeTimer !== null) window.clearTimeout(durationProbeTimer);
            video.removeEventListener('durationchange', handleDurationProbeProgress);
            video.removeEventListener('timeupdate', handleDurationProbeProgress);
            video.removeEventListener('seeked', handleDurationProbeProgress);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleVideoError);
        };
    }, [sourceVideoUrl, initialProject, aspectRatio, initialScript, initialScriptLanguage, sourceDurationMs]);

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
        const video = videoRef.current;
        if (video && project && video.currentTime * 1000 >= project.videoEdit.trimEndMs) {
            video.currentTime = project.videoEdit.trimStartMs / 1000;
        }
        return video?.play();
    }, [ensureAudioGraph, project]);
    const pause = useCallback(() => videoRef.current?.pause(), []);
    const togglePlay = useCallback(() => {
        if (isPlaying) pause(); else play();
    }, [isPlaying, play, pause]);

    const seekTo = useCallback((ms: number) => {
        const video = videoRef.current;
        if (!video || !project) return;
        const clamped = Math.max(project.videoEdit.trimStartMs, Math.min(ms, project.videoEdit.trimEndMs));
        video.currentTime = clamped / 1000;
        setPlayheadMs(clamped);
    }, [project]);

    const beginVideoEdit = useCallback(() => {
        rememberTab('clip');
    }, [rememberTab]);

    const updateVideoEdit = useCallback((patch: Partial<EditorProject['videoEdit']>) => {
        if (!project) return;
        setProject((prev) => prev ? {
            ...prev,
            videoEdit: { ...prev.videoEdit, ...patch },
        } : prev);
    }, [project]);

    const splitVideoAt = useCallback((atMs: number) => {
        if (!project) return;
        const { trimStartMs, trimEndMs, splitPointsMs } = project.videoEdit;
        if (atMs <= trimStartMs + 100 || atMs >= trimEndMs - 100 || splitPointsMs.some((point) => Math.abs(point - atMs) < 100)) return;
        beginVideoEdit();
        updateVideoEdit({ splitPointsMs: [...splitPointsMs, atMs].sort((a, b) => a - b) });
    }, [project, beginVideoEdit, updateVideoEdit]);

    const removeVideoSplit = useCallback((atMs: number) => {
        if (!project || !project.videoEdit.splitPointsMs.includes(atMs)) return;
        beginVideoEdit();
        updateVideoEdit({ splitPointsMs: project.videoEdit.splitPointsMs.filter((point) => point !== atMs) });
    }, [project, beginVideoEdit, updateVideoEdit]);

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

    const getSourceAudioStream = useCallback(() => {
        const context = ensureAudioGraph();
        if (context?.state === 'suspended') context.resume().catch(() => { });
        return sourceAudioDestinationRef.current?.stream ?? null;
    }, [ensureAudioGraph]);

    const addSpeedSegment = useCallback((segment: Omit<SpeedSegment, 'id'>) => {
        if (!project) return;
        rememberTab('speed');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, speed: [...prev.tracks.speed, { ...segment, id: generateId() }] },
        });
    }, [project, rememberTab]);

    const updateSpeedSegment = useCallback((id: string, patch: Partial<SpeedSegment>) => {
        if (!project) return;
        rememberTab('speed');
        setProject((prev) => prev && ({
            ...prev,
            tracks: { ...prev.tracks, speed: prev.tracks.speed.map((segment) => segment.id === id ? { ...segment, ...patch } : segment) },
        }));
    }, [project, rememberTab]);

    const removeSpeedSegment = useCallback((id: string) => {
        if (!project) return;
        rememberTab('speed');
        setProject((prev) => prev && ({
            ...prev,
            tracks: { ...prev.tracks, speed: prev.tracks.speed.filter((segment) => segment.id !== id) },
        }));
    }, [project, rememberTab]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !project) return;
        const enforceTrimRange = () => {
            if (video.currentTime * 1000 < project.videoEdit.trimStartMs) {
                video.currentTime = project.videoEdit.trimStartMs / 1000;
            } else if (video.currentTime * 1000 >= project.videoEdit.trimEndMs) {
                video.pause();
                video.currentTime = project.videoEdit.trimEndMs / 1000;
            }
        };
        video.addEventListener('timeupdate', enforceTrimRange);
        video.addEventListener('seeked', enforceTrimRange);
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
        if (video.currentTime * 1000 < project.videoEdit.trimStartMs || video.currentTime * 1000 >= project.videoEdit.trimEndMs) {
            video.currentTime = project.videoEdit.trimStartMs / 1000;
        }
        updateRate();
        return () => {
            video.removeEventListener('timeupdate', enforceTrimRange);
            video.removeEventListener('seeked', enforceTrimRange);
            video.removeEventListener('timeupdate', updateRate);
            video.removeEventListener('seeked', updateRate);
            video.playbackRate = 1;
        };
    }, [project, videoRef]);

    // Generic track mutators — every future feature (subtitles, music, overlays,
    // background swap) goes through these instead of touching setProject directly.
    const addOverlay = useCallback((clip: Omit<OverlayClip, 'id'>) => {
        if (!project) return;
        rememberTab('text');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, overlays: [...prev.tracks.overlays, { ...clip, id: generateId() }] },
        });
    }, [project, rememberTab]);

    const updateOverlay = useCallback((id: string, patch: Partial<OverlayClip>) => {
        if (!project) return;
        rememberTab('text');
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                overlays: prev.tracks.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
            },
        });
    }, [project, rememberTab]);

    const removeOverlay = useCallback((id: string) => {
        if (!project) return;
        rememberTab('text');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, overlays: prev.tracks.overlays.filter((o) => o.id !== id) },
        });
    }, [project, rememberTab]);

    const addCaption = useCallback((cue: Omit<CaptionCue, 'id'>) => {
        if (!project) return;
        rememberTab('captions');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, captions: [...prev.tracks.captions, { ...cue, id: generateId() }] },
        });
    }, [project, rememberTab]);

    const updateCaption = useCallback((id: string, patch: Partial<CaptionCue>) => {
        if (!project) return;
        rememberTab('captions');
        setProject((prev) => prev && {
            ...prev,
            tracks: {
                ...prev.tracks,
                captions: prev.tracks.captions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            },
        });
    }, [project, rememberTab]);

    const updateCaptionStyle = useCallback((captionStyle: CaptionStyle) => {
        if (!project) return;
        rememberTab('captions');
        setProject((prev) => prev && ({ ...prev, captionStyle }));
    }, [project, rememberTab]);

    const replaceCaptions = useCallback((captions: Array<Omit<CaptionCue, 'id'>>) => {
        if (!project) return;
        rememberTab('captions');
        setProject((prev) => prev && ({
            ...prev,
            tracks: { ...prev.tracks, captions: captions.map((caption) => ({ ...caption, id: generateId() })) },
        }));
    }, [project, rememberTab]);

    const removeCaption = useCallback((id: string) => {
        if (!project) return;
        rememberTab('captions');
        setProject((prev) => prev && {
            ...prev,
            tracks: { ...prev.tracks, captions: prev.tracks.captions.filter((c) => c.id !== id) },
        });
    }, [project, rememberTab]);

    const setBackgroundSegments = useCallback((segments: BackgroundSegment[]) => {
        setProject((prev) => prev && { ...prev, tracks: { ...prev.tracks, background: segments } });
    }, []);

    const setAudioTracks = useCallback((tracks: AudioTrackClip[]) => {
        if (!project) return;
        rememberTab('music');
        setProject((prev) => prev && { ...prev, tracks: { ...prev.tracks, audio: tracks } });
    }, [project, rememberTab]);

    const updateColorGrade = useCallback((patch: Partial<ColorGradeSettings>) => {
        if (!project) return;
        rememberTab('color');
        setProject((prev) => prev && { ...prev, colorGrade: { ...prev.colorGrade, ...patch } });
    }, [project, rememberTab]);

    const renameProject = useCallback((title: string) => {
        const normalizedTitle = title.trim().slice(0, 80);
        if (!normalizedTitle) return;
        setProject((prev) => prev ? { ...prev, title: normalizedTitle } : prev);
    }, []);

    const applyStylePreset = useCallback((presetId: string) => {
        if (!project) return;
        const preset = COMPOSITE_STYLE_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        rememberTab('style');
        rememberTab('color');
        rememberTab('captions');
        rememberTab('zoom');
        setProject((prev) => prev ? {
            ...prev,
            colorGrade: { ...preset.colorGrade },
            captionStyle: preset.captionStyle,
            tracks: { ...prev.tracks, zoom: getStyleZoomKeyframe(preset.zoomScale) },
        } : prev);
    }, [project, rememberTab]);

    return {
        project,
        projectLoadError,
        updateVideoEdit,
        beginVideoEdit,
        splitVideoAt,
        removeVideoSplit,
        undoCounts,
        undoTab,
        resetTab,
        applyStylePreset,
        renameProject,
        videoRef,
        playheadMs,
        isPlaying,
        isSourceMuted,
        toggleSourceAudio,
        getMixedAudioStream,
        getSourceAudioStream,
        play,
        pause,
        togglePlay,
        seekTo,
        addOverlay,
        updateOverlay,
        removeOverlay,
        addCaption,
        updateCaption,
        updateCaptionStyle,
        replaceCaptions,
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