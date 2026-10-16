// Records the captured tab. Lives in an offscreen document because service
// workers cannot use getUserMedia or MediaRecorder.
import { saveRecording } from './lib/recordings.js';

const MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

let session = null;

const toBackground = (message) => chrome.runtime.sendMessage({ ...message, target: 'background' });

async function start({ streamId, mic, title }) {
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

    const output = new MediaStream([...tabStream.getVideoTracks(), ...mix.stream.getAudioTracks()]);
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };

    session = { recorder, chunks, tabStream, micStream, audio, title, mimeType: recorder.mimeType || 'video/webm', activeMs: 0, resumedAt: Date.now() };
    recorder.onstop = () => void finish();
    // Closing or crashing the recorded tab ends the capture; save what was recorded.
    tabStream.getVideoTracks()[0]?.addEventListener('ended', () => stop());
    recorder.start(1000);
    return { micError };
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
    if (message.type === 'pause') pause();
    if (message.type === 'resume') resume();
    sendResponse({ ok: true });
    return false;
});
