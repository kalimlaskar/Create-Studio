// Records the captured tab. Lives in an offscreen document because service
// workers cannot use getUserMedia or MediaRecorder.
import { saveRecording } from './lib/recordings.js';
import { createCompositor } from './lib/compositor.js';

const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

let session = null;

const toBackground = (message) => chrome.runtime.sendMessage({ ...message, target: 'background' });

function explainCameraError(error) {
    if (error.name === 'NotAllowedError' && /system/i.test(error.message)) return 'Chrome isn’t allowed to use the camera in your computer’s privacy settings.';
    if (error.name === 'NotAllowedError') return 'Camera access isn’t set up for the recorder yet. Choose “Allow camera and microphone” in the popup.';
    if (error.name === 'NotReadableError') return 'Your camera is being used by another app.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No camera was found.';
    return `The camera couldn’t start (${error.message || error.name}).`;
}

async function start({ streamId, mic, camera, layout, title }) {
    if (session) throw new Error('Already recording.');

    const tabStream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
        video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } },
    });

    // Capturing a tab mutes it for the user, so play its audio back while also recording it.
    const audio = new AudioContext();
    const mix = audio.createMediaStreamDestination();
    if (tabStream.getAudioTracks().length) {
        const tabAudio = audio.createMediaStreamSource(tabStream);
        tabAudio.connect(audio.destination);
        tabAudio.connect(mix);
    }

    let micStream = null;
    let micError = null;
    if (mic) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            audio.createMediaStreamSource(micStream).connect(mix);
        } catch (error) {
            // Usually means microphone access was never granted to the extension. Record without it.
            micError = error.name === 'NotAllowedError' ? 'Microphone access is blocked for the extension.' : error.message;
        }
    }

    // The camera bubble is drawn into the video here rather than on the page.
    let cameraStream = null;
    let cameraError = null;
    let compositor = null;
    if (camera) {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' } });
            compositor = createCompositor(tabStream.getVideoTracks()[0], cameraStream.getVideoTracks()[0], layout);
        } catch (error) {
            cameraStream?.getTracks().forEach((track) => track.stop());
            cameraStream = null;
            cameraError = explainCameraError(error);
        }
    }

    const videoTrack = compositor ? compositor.track : tabStream.getVideoTracks()[0];
    const output = new MediaStream([videoTrack, ...mix.stream.getAudioTracks()]);
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

    session = { recorder, chunks, tabStream, micStream, cameraStream, compositor, audio, title, mimeType: recorder.mimeType || 'video/webm', activeMs: 0, resumedAt: Date.now() };
    recorder.onstop = () => void finish();
    // Closing or crashing the recorded tab ends the capture; save what was recorded.
    tabStream.getVideoTracks()[0]?.addEventListener('ended', () => stop());
    recorder.start(1000);
    return { micError, cameraError };
}

function stop() {
    if (session?.recorder.state && session.recorder.state !== 'inactive') session.recorder.stop();
}

function discard() {
    if (!session) return;
    session.discard = true;
    stop();
}

function pause() {
    if (session?.recorder.state !== 'recording') return;
    session.recorder.pause();
    session.activeMs += Date.now() - session.resumedAt;
}

function resume() {
    if (session?.recorder.state !== 'paused') return;
    session.recorder.resume();
    session.resumedAt = Date.now();
}

async function finish() {
    const current = session;
    session = null;
    if (!current) return;
    if (current.recorder.state !== 'paused') current.activeMs += Date.now() - current.resumedAt;
    current.tabStream.getTracks().forEach((track) => track.stop());
    current.micStream?.getTracks().forEach((track) => track.stop());
    current.compositor?.stop();
    current.cameraStream?.getTracks().forEach((track) => track.stop());
    void current.audio.close();

    if (current.discard) {
        await toBackground({ type: 'recording-discarded' });
        return;
    }
    try {
        if (!current.chunks.length) throw new Error('Nothing was recorded.');
        const id = crypto.randomUUID();
        const blob = new Blob(current.chunks, { type: current.mimeType.split(';')[0] });
        await saveRecording({ id, blob, title: current.title, durationMs: current.activeMs, createdAt: Date.now() });
        await toBackground({ type: 'recording-saved', id });
    } catch (error) {
        await toBackground({ type: 'recording-failed', error: error.message });
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.target !== 'offscreen') return false;
    if (message.type === 'start') {
        start(message)
            .then((result) => sendResponse({ ok: true, ...result }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }
    if (message.type === 'stop') stop();
    if (message.type === 'discard') discard();
    if (message.type === 'camera-layout') session?.compositor?.setLayout(message.layout);
    if (message.type === 'pause') pause();
    if (message.type === 'resume') resume();
    sendResponse({ ok: true });
    return false;
});
