'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { StudioSettings } from '@/types/studio';

const DEFAULT_SETTINGS: StudioSettings = {
    aspectRatio: '9:16',
    brightness: 100,
    contrast: 100,
    filterPreset: 'none',
    backgroundMode: 'none',
    backgroundImageUrl: null,
    scriptText: 'Type or paste your script here...\n\nWelcome to your new video studio. Keep your eyes on the camera lens while reading smoothly.'
};

export function useStudioSession() {
    const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
    const [isRecording, setIsRecording] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

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
        if (!canvasStreamRef.current || !mediaStreamRef.current) return;

        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        const combinedStream = new MediaStream([
            ...canvasStreamRef.current.getVideoTracks(),
            ...(audioTrack ? [audioTrack] : []),
        ]);

        try {
            const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setRecordedVideoUrl(url);
            };

            mediaRecorder.start();
            setIsRecording(true);
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
    }, []);

    const resetRecording = useCallback(() => {
        if (recordedVideoUrl) {
            URL.revokeObjectURL(recordedVideoUrl);
        }
        setRecordedVideoUrl(null);
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
        startRecordingSequence,
        stopRecording,
        resetRecording,

        // camera status
        cameraError,
    };
}