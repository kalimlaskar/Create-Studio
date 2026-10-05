'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { StudioSettings } from '@/types/studio';
import { createHighQualityRecorder, getRecordingDimensions } from '@/components/recordingQuality';

const DEFAULT_SETTINGS: StudioSettings = {
    aspectRatio: '9:16',
    brightness: 100,
    contrast: 100,
    filterPreset: 'none',
    cameraArtEffect: 'none',
    cameraAvatarImageUrl: null,
    cameraAvatarMouthX: 0.5,
    cameraAvatarMouthY: 0.68,
    cameraAvatarMouthWidth: 0.09,
    backgroundMode: 'none',
    backgroundImageUrl: null,
    inputMode: 'camera',
    scriptLanguage: 'en',
    scriptText: 'Type or paste your script here...\n\nWelcome to your new video studio. Keep your eyes on the camera lens while reading smoothly.'
};

export const FREE_RECORDING_LIMIT_SECONDS = 60;

export function useStudioSession(enabled = true, screenShareStream: MediaStream | null = null) {
    const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [recordedVideoMimeType, setRecordedVideoMimeType] = useState<string | null>(null);
    const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isFinalizingScreenRecording, setIsFinalizingScreenRecording] = useState(false);
    const settingsRef = useRef(settings);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const avatarAudioContextRef = useRef<AudioContext | null>(null);
    const avatarAnalyserRef = useRef<AnalyserNode | null>(null);
    const avatarAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const avatarMeterFrameRef = useRef<number | null>(null);
    const avatarMeterActiveRef = useRef(false);
    const microphoneLevelRef = useRef(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const cameraRecorderRef = useRef<MediaRecorder | null>(null);
    const screenShareStreamRef = useRef<MediaStream | null>(screenShareStream);
    const isScreenShareRecordingRef = useRef(false);
    const cameraRecordingPromiseRef = useRef<Promise<Blob> | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartedAtRef = useRef(0);
    const recordingAccumulatedMsRef = useRef(0);
    const recordingSegmentStartedAtRef = useRef<number | null>(null);

    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { screenShareStreamRef.current = screenShareStream; }, [screenShareStream]);

    // Initialize Camera & Mic with AI Noise Suppression
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;

        async function setupCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: {
                        noiseSuppression: true,
                        echoCancellation: true,
                        autoGainControl: true,
                    }
                });
                if (cancelled) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }
                mediaStreamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setCameraError(null);
            } catch (err) {
                console.error('Error accessing media devices:', err);
                if (!cancelled) {
                    setCameraError('Camera/microphone access was denied or unavailable. Please check your browser permissions.');
                }
            }
        }

        setupCamera();

        return () => {
            cancelled = true;
            mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [enabled]);

    const updateSettings = useCallback((newSettings: Partial<StudioSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    }, []);

    const stopAvatarAudioMeter = useCallback(() => {
        avatarMeterActiveRef.current = false;
        if (avatarMeterFrameRef.current !== null) cancelAnimationFrame(avatarMeterFrameRef.current);
        avatarMeterFrameRef.current = null;
        avatarAudioSourceRef.current?.disconnect();
        avatarAnalyserRef.current?.disconnect();
        avatarAudioSourceRef.current = null;
        avatarAnalyserRef.current = null;
        microphoneLevelRef.current = 0;
        void avatarAudioContextRef.current?.close().catch(() => undefined);
        avatarAudioContextRef.current = null;
    }, []);

    const startAvatarAudioMeter = useCallback(() => {
        if (avatarMeterActiveRef.current && avatarAnalyserRef.current) return true;
        stopAvatarAudioMeter();
        const microphoneTrack = mediaStreamRef.current?.getAudioTracks()[0];
        if (!microphoneTrack) return false;

        try {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.35;
            const source = audioContext.createMediaStreamSource(new MediaStream([microphoneTrack]));
            source.connect(analyser);
            avatarAudioContextRef.current = audioContext;
            avatarAnalyserRef.current = analyser;
            avatarAudioSourceRef.current = source;
            avatarMeterActiveRef.current = true;
            void audioContext.resume().catch(() => undefined);

            const samples = new Uint8Array(analyser.fftSize);
            const updateLevel = () => {
                analyser.getByteTimeDomainData(samples);
                let energy = 0;
                for (const sample of samples) {
                    const amplitude = (sample - 128) / 128;
                    energy += amplitude * amplitude;
                }
                const rms = Math.sqrt(energy / samples.length);
                const voiceLevel = Math.max(0, Math.min(1, (rms - 0.012) * 8));
                microphoneLevelRef.current = microphoneLevelRef.current * 0.55 + voiceLevel * 0.45;
                avatarMeterFrameRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();
            return true;
        } catch (error) {
            console.warn('Microphone level meter could not start:', error);
            stopAvatarAudioMeter();
            return false;
        }
    }, [stopAvatarAudioMeter]);

    useEffect(() => () => stopAvatarAudioMeter(), [stopAvatarAudioMeter]);

    const startActualRecording = useCallback(() => {
        recordedChunksRef.current = [];
        setCameraError(null);
        if (!mediaStreamRef.current) return;

        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        const activeScreenTrack = screenShareStreamRef.current?.getVideoTracks().find((track) => track.readyState === 'live');
        if (!activeScreenTrack && !canvasStreamRef.current) return;
        const canvasStream = canvasStreamRef.current;
        const combinedStream = activeScreenTrack
            ? new MediaStream([activeScreenTrack, ...(audioTrack ? [audioTrack] : [])])
            : new MediaStream([...(canvasStream?.getVideoTracks() ?? []), ...(audioTrack ? [audioTrack] : [])]);

        try {
            isScreenShareRecordingRef.current = Boolean(activeScreenTrack);
            const mediaRecorder = createHighQualityRecorder(combinedStream);
            mediaRecorderRef.current = mediaRecorder;

            if (activeScreenTrack) {
                const cameraTrack = mediaStreamRef.current.getVideoTracks()[0];
                if (!cameraTrack) throw new Error('The camera is not available for the floating camera card.');
                const cameraOnlyStream = new MediaStream([cameraTrack]);
                const cameraRecorder = createHighQualityRecorder(cameraOnlyStream);
                cameraRecorderRef.current = cameraRecorder;
                const cameraChunks: Blob[] = [];
                cameraRecordingPromiseRef.current = new Promise<Blob>((resolve, reject) => {
                    cameraRecorder.ondataavailable = (event) => { if (event.data.size > 0) cameraChunks.push(event.data); };
                    cameraRecorder.onerror = () => reject(new Error('The camera inset could not be recorded.'));
                    cameraRecorder.onstop = () => {
                        const cameraMime = cameraRecorder.mimeType || 'video/webm';
                        const cameraBlob = new Blob(cameraChunks, { type: cameraMime });
                        if (cameraBlob.size === 0) reject(new Error('No camera frames were captured for the floating camera card.'));
                        else resolve(cameraBlob);
                        cameraRecorderRef.current = null;
                    };
                });
                cameraRecorder.start(1000);
            } else {
                cameraRecordingPromiseRef.current = null;
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                setIsRecording(false);
                setIsRecordingPaused(false);
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
                const finalElapsedMs = recordingAccumulatedMsRef.current + (recordingSegmentStartedAtRef.current === null ? 0 : Date.now() - recordingSegmentStartedAtRef.current);
                recordingSegmentStartedAtRef.current = null;
                recordingAccumulatedMsRef.current = 0;
                setRecordedDurationMs(finalElapsedMs);
                const mimeType = mediaRecorder.mimeType || 'video/webm';
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                if (blob.size === 0) {
                    cameraRecorderRef.current?.stop();
                    setCameraError('The browser did not capture any video frames. Check camera permissions and try recording again.');
                    return;
                }
                if (isScreenShareRecordingRef.current) {
                    const screenBlob = blob;
                    const cameraPromise = cameraRecordingPromiseRef.current;
                    activeScreenTrack?.stop();
                    cameraRecorderRef.current?.stop();
                    setIsFinalizingScreenRecording(true);
                    setCameraError(null);
                    void (async () => {
                        try {
                            if (!cameraPromise) throw new Error('The camera inset recording was not available.');
                            const cameraBlob = await cameraPromise;
                            const { composeScreenShareWithCamera } = await import('@/components/editor/convertToMp4');
                            const composedBlob = await composeScreenShareWithCamera(screenBlob, cameraBlob, getRecordingDimensions(settingsRef.current.aspectRatio), () => undefined);
                            setRecordedVideoMimeType('video/mp4');
                            setRecordedVideoUrl(URL.createObjectURL(composedBlob));
                        } catch (error) {
                            console.error('Screen-share composition failed:', error);
                            setCameraError(error instanceof Error ? error.message : 'Could not combine the screen recording and camera inset.');
                        } finally {
                            isScreenShareRecordingRef.current = false;
                            cameraRecordingPromiseRef.current = null;
                            setIsFinalizingScreenRecording(false);
                        }
                    })();
                    return;
                }
                setRecordedVideoMimeType(mimeType);
                setRecordedVideoUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.onerror = () => {
                cameraRecorderRef.current?.stop();
                setCameraError('Video recording stopped unexpectedly. Check camera permissions and try again.');
                setIsRecording(false);
                setIsRecordingPaused(false);
            };

            recordingStartedAtRef.current = Date.now();
            recordingAccumulatedMsRef.current = 0;
            recordingSegmentStartedAtRef.current = recordingStartedAtRef.current;
            setRecordingSeconds(0);
            mediaRecorder.start(1000);
            setIsRecording(true);
            setIsRecordingPaused(false);
            recordingTimerRef.current = setInterval(() => {
                const elapsedMs = recordingAccumulatedMsRef.current + (recordingSegmentStartedAtRef.current === null ? 0 : Date.now() - recordingSegmentStartedAtRef.current);
                const elapsed = Math.floor(elapsedMs / 1000);
                setRecordingSeconds(elapsed);
                const activeRecorder = mediaRecorderRef.current;
                if (elapsed >= FREE_RECORDING_LIMIT_SECONDS && activeRecorder?.state === 'recording') {
                    activeRecorder.stop();
                    cameraRecorderRef.current?.stop();
                    setIsRecording(false);
                }
            }, 250);
        } catch (e) {
            console.error('MediaRecorder error:', e);
        }
    }, []);

    const startRecordingSequence = useCallback(() => {
        setCountdown(3);
        let currentCount = 3;
        const timer = setInterval(() => {
            currentCount -= 1;
            if (currentCount > 0) {
                setCountdown(currentCount);
            } else {
                clearInterval(timer);
                setCountdown(null);
                startActualRecording();
            }
        }, 1000);
    }, [startActualRecording]);

    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            if (recordingSegmentStartedAtRef.current !== null) {
                recordingAccumulatedMsRef.current += Date.now() - recordingSegmentStartedAtRef.current;
                recordingSegmentStartedAtRef.current = null;
            }
            recorder.stop();
            if (cameraRecorderRef.current?.state !== 'inactive') cameraRecorderRef.current?.stop();
            setIsRecording(false);
            setIsRecordingPaused(false);
        }
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
    }, []);

    const pauseRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== 'recording' || recordingSegmentStartedAtRef.current === null) return;
        recordingAccumulatedMsRef.current += Date.now() - recordingSegmentStartedAtRef.current;
        recordingSegmentStartedAtRef.current = null;
        recorder.pause();
        if (cameraRecorderRef.current?.state === 'recording') cameraRecorderRef.current.pause();
        setIsRecordingPaused(true);
    }, []);

    const resumeRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state !== 'paused') return;
        recordingSegmentStartedAtRef.current = Date.now();
        recorder.resume();
        if (cameraRecorderRef.current?.state === 'paused') cameraRecorderRef.current.resume();
        setIsRecordingPaused(false);
    }, []);

    const resetRecording = useCallback(() => {
        if (cameraRecorderRef.current?.state !== 'inactive') cameraRecorderRef.current?.stop();
        if (recordedVideoUrl) {
            URL.revokeObjectURL(recordedVideoUrl);
        }
        setRecordedVideoUrl(null);
        setRecordedVideoMimeType(null);
        setRecordedDurationMs(null);
        setRecordingSeconds(0);
    }, [recordedVideoUrl]);

    return {
        // settings
        settings,
        updateSettings,
        microphoneLevelRef,
        startAvatarAudioMeter,
        stopAvatarAudioMeter,

        // refs consumed by VideoCanvas
        videoRef,
        canvasStreamRef,

        // recording state + controls
        isRecording,
        isRecordingPaused,
        countdown,
        recordedVideoUrl,
        recordedVideoMimeType,
        recordedDurationMs,
        recordingSeconds,
        freeRecordingLimitSeconds: FREE_RECORDING_LIMIT_SECONDS,
        isFinalizingScreenRecording,
        startRecordingSequence,
        stopRecording,
        pauseRecording,
        resumeRecording,
        resetRecording,

        // camera status
        cameraError,
    };
}