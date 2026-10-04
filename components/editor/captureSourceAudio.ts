export async function captureSourceAudio(
    video: HTMLVideoElement,
    audioStream: MediaStream,
    onProgress: (percent: number) => void,
    expectedDurationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 0
): Promise<Blob> {
    if (typeof MediaRecorder === 'undefined') throw new Error('Audio capture is not supported in this browser.');
    if (!audioStream.getAudioTracks().length) throw new Error('No audio track is available in this video.');
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !Number.isFinite(expectedDurationMs) || expectedDurationMs <= 0) {
        throw new Error('Wait for the video to finish loading, then try again.');
    }
    const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : expectedDurationMs;

    const supportedMime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    let recorder: MediaRecorder;
    try {
        recorder = new MediaRecorder(new MediaStream(audioStream.getAudioTracks()), supportedMime ? { mimeType: supportedMime } : undefined);
    } catch {
        throw new Error('This browser cannot capture audio for transcription.');
    }

    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;
    const originalPlaybackRate = video.playbackRate;
    const chunks: Blob[] = [];
    let frameId = 0;
    const captureFailure: { reject?: (error: Error) => void } = {};

    const stopRecorder = () => {
        if (recorder.state === 'recording') recorder.stop();
    };
    const updateProgress = () => {
        onProgress(durationMs > 0 ? Math.min(95, Math.round((video.currentTime * 1000 / durationMs) * 95)) : 0);
        if (video.ended || video.currentTime * 1000 >= durationMs - 20) stopRecorder();
        else frameId = requestAnimationFrame(updateProgress);
    };
    const handlePause = () => {
        if (!video.ended && recorder.state === 'recording') {
            captureFailure.reject?.(new Error('Playback stopped before audio capture finished. Try again and keep the video playing.'));
            stopRecorder();
        }
    };

    const recording = new Promise<Blob>((resolve, reject) => {
        captureFailure.reject = reject;
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('The browser stopped capturing audio unexpectedly.'));
        recorder.onstop = () => {
            const mimeType = recorder.mimeType || supportedMime || 'audio/webm';
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size === 0) reject(new Error('No audio was captured from this video.'));
            else resolve(blob);
        };
        video.addEventListener('ended', stopRecorder, { once: true });
        video.addEventListener('pause', handlePause);
    });
    void recording.catch(() => undefined);

    try {
        video.pause();
        video.playbackRate = 1;
        if (video.currentTime > 0) {
            video.currentTime = 0;
            await new Promise<void>((resolve, reject) => {
                const timeout = window.setTimeout(() => reject(new Error('Could not seek to the start of the video.')), 5000);
                video.addEventListener('seeked', () => {
                    window.clearTimeout(timeout);
                    resolve();
                }, { once: true });
            });
        }
        recorder.start(1000);
        await video.play();
        frameId = requestAnimationFrame(updateProgress);
        return await recording;
    } catch (error) {
        captureFailure.reject?.(error instanceof Error ? error : new Error('Audio capture failed.'));
        stopRecorder();
        throw error;
    } finally {
        cancelAnimationFrame(frameId);
        video.removeEventListener('ended', stopRecorder);
        video.removeEventListener('pause', handlePause);
        if (recorder.state === 'recording') recorder.stop();
        video.pause();
        video.playbackRate = originalPlaybackRate;
        if (Math.abs(video.currentTime - originalTime) > 0.05) {
            video.currentTime = originalTime;
        }
        if (wasPlaying) video.play().catch(() => undefined);
        onProgress(100);
    }
}
