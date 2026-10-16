// Loaded in a hidden frame on a Cliprame page. Sends one saved recording to that page.
import { getRecording } from './lib/recordings.js';

const ALLOWED = ['https://www.cliprame.com', 'https://cliprame.com', 'http://localhost:3000'];
const parentOrigin = location.ancestorOrigins?.[0];
const id = new URLSearchParams(location.search).get('id');

async function send() {
    // Only ever hand recordings to Cliprame itself.
    if (!ALLOWED.includes(parentOrigin) || window.parent === window) return;
    const recording = id ? await getRecording(id) : null;
    const message = recording
        ? { source: 'cliprame-extension', type: 'recording', id, blob: recording.blob, title: recording.title, durationMs: recording.durationMs }
        : { source: 'cliprame-extension', type: 'missing', id };
    window.parent.postMessage(message, parentOrigin);
}

void send();
