'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { StudioSettings } from '@/types/studio';
import { createHighQualityRecorder } from '@/components/recordingQuality';

const DEFAULT_SETTINGS: StudioSettings = {
    aspectRatio: '9:16',
    brightness: 100,
    contrast: 100,
    filterPreset: 'none',
    backgroundMode: 'none',
    backgroundImageUrl: null,
    inputMode: 'camera',
    scriptLanguage: 'en',
    scriptText: 'Type or paste your script here...\n\nWelcome to your new video studio. Keep your eyes on the camera lens while reading smoothly.'
};

export const FREE_RECORDING_LIMIT_SECONDS = 60;

export function useStudioSession() {
    const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
    const [isRecording, setIsRecording] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [recordedVideoMimeType, setRecordedVideoMimeType] = useState<string | null>(null);
    const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingStartedAtRef = useRef(0);

    // Initialize Camera & Mic with AI Noise Suppression
    useEffect(() => {
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
        };
    }, []);

    const updateSettings = useCallback((newSettings: Partial<StudioSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    }, []);

    const startActualRecording = useCallback(() => {
        recordedChunksRef.current = [];
        setCameraError(null);
        if (!canvasStreamRef.current || !mediaStreamRef.current) return;

        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        const combinedStream = new MediaStream([
            ...canvasStreamRef.current.getVideoTracks(),
            ...(audioTrack ? [audioTrack] : []),
        ]);

        try {
            const mediaRecorder = createHighQualityRecorder(combinedStream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                setIsRecording(false);
                if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
                setRecordedDurationMs(Math.min(Date.now() - recordingStartedAtRef.current, FREE_RECORDING_LIMIT_SECONDS * 1000));
                const mimeType = mediaRecorder.mimeType || 'video/webm';
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                if (blob.size === 0) {
                    setCameraError('The browser did not capture any video frames. Check camera permissions and try recording again.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                setRecordedVideoMimeType(mimeType);
                setRecordedVideoUrl(url);
            };

            mediaRecorder.onerror = () => {
                setCameraError('Video recording stopped unexpectedly. Check camera permissions and try again.');
                setIsRecording(false);
            };

            recordingStartedAtRef.current = Date.now();
            setRecordingSeconds(0);
            mediaRecorder.start(1000);
            setIsRecording(true);
            recordingTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
                setRecordingSeconds(elapsed);
                if (elapsed >= FREE_RECORDING_LIMIT_SECONDS && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
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
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
    }, []);

    const resetRecording = useCallback(() => {
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

        // refs consumed by VideoCanvas
        videoRef,
        canvasStreamRef,

        // recording state + controls
        isRecording,
        countdown,
        recordedVideoUrl,
        recordedVideoMimeType,
        recordedDurationMs,
        recordingSeconds,
        freeRecordingLimitSeconds: FREE_RECORDING_LIMIT_SECONDS,
        startRecordingSequence,
        stopRecording,
        resetRecording,

        // camera status
        cameraError,
    };
}