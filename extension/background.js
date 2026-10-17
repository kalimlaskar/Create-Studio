// Cliprame Recorder service worker.
// The worker can be stopped at any time, so recording state lives in
// chrome.storage.session and the MediaRecorder lives in the offscreen document.

const MASK_SCRIPT_ID = 'cliprame-mask';
const BUBBLE_ID = 'cliprame-camera-bubble';

/* ------------------------------ state ------------------------------ */

async function getRecording() {
    const { recording } = await chrome.storage.session.get('recording');
    return recording ?? null;
}

const setRecording = (recording) => chrome.storage.session.set({ recording });
const clearRecording = () => chrome.storage.session.remove('recording');

async function setBadge(state) {
    const text = state === 'recording' ? 'REC' : state === 'paused' ? 'II' : '';
    await chrome.action.setBadgeText({ text });
    if (text) await chrome.action.setBadgeBackgroundColor({ color: state === 'paused' ? '#6A4CFF' : '#E11D48' });
}

/* ---------------------------- offscreen ---------------------------- */

async function ensureOffscreen() {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Records the captured tab, tab audio and microphone with MediaRecorder.',
    });
}

const toOffscreen = (message) => chrome.runtime.sendMessage({ ...message, target: 'offscreen' });

/* --------------------------- camera bubble -------------------------- */

// Runs inside the recorded page. Shows where the camera will appear: the
// recorder draws the live camera exactly over this marker (see lib/compositor.js),
// so the marker itself never shows in the video. Drag to move, double-click to resize.
function addCameraMarker(markerId, layout) {
    document.getElementById(markerId)?.remove();
    const host = document.createElement('div');
    host.id = markerId;
    host.title = 'Your camera appears here · drag to move · double-click to resize';
    host.style.cssText = 'position:fixed;z-index:2147483647;border-radius:50%;padding:4px;box-sizing:border-box;background:linear-gradient(135deg,#6A4CFF,#8B5CF6 55%,#FF3D81);cursor:grab;touch-action:none;user-select:none;';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:100%;border-radius:50%;background:#14121F;display:grid;place-items:center;align-content:center;gap:6px;color:rgba(255,255,255,.8);font:600 12px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,sans-serif;text-align:center;pointer-events:none;';
    inner.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="8"/><circle cx="12" cy="10" r="3"/><path d="M7 22h10"/><path d="M12 22v-4"/></svg><span>Your camera</span>';
    host.appendChild(inner);

    const sizes = [0.18, 0.24, 0.32];
    let current = { ...layout };
    const place = () => {
        const diameter = Math.max(60, current.size * window.innerHeight);
        const radius = diameter / 2;
        const cx = Math.min(Math.max(radius, current.x * window.innerWidth), window.innerWidth - radius);
        const cy = Math.min(Math.max(radius, current.y * window.innerHeight), window.innerHeight - radius);
        Object.assign(host.style, { width: `${diameter}px`, height: `${diameter}px`, left: `${cx - radius}px`, top: `${cy - radius}px` });
    };
    const report = () => chrome.runtime.sendMessage({ target: 'background', type: 'camera-layout', layout: current }).catch(() => {});

    let drag = null;
    host.addEventListener('pointerdown', (event) => {
        const rect = host.getBoundingClientRect();
        drag = { dx: event.clientX - (rect.left + rect.width / 2), dy: event.clientY - (rect.top + rect.height / 2) };
        host.setPointerCapture(event.pointerId);
        host.style.cursor = 'grabbing';
    });
    host.addEventListener('pointermove', (event) => {
        if (!drag) return;
        current = { ...current, x: (event.clientX - drag.dx) / window.innerWidth, y: (event.clientY - drag.dy) / window.innerHeight };
        place();
        report();
    });
    host.addEventListener('pointerup', () => { drag = null; host.style.cursor = 'grab'; report(); });
    host.addEventListener('dblclick', () => {
        const index = sizes.findIndex((size) => Math.abs(size - current.size) < 0.01);
        current = { ...current, size: sizes[(index + 1) % sizes.length] };
        place();
        report();
    });
    window.addEventListener('resize', place);
    place();
    document.documentElement.appendChild(host);
    report();
}

function removeCameraMarker(markerId) {
    document.getElementById(markerId)?.remove();
}

const DEFAULT_LAYOUT = { x: 0.1, y: 0.8, size: 0.24 };

async function getCameraLayout() {
    const { cameraLayout } = await chrome.storage.session.get('cameraLayout');
    return cameraLayout ?? DEFAULT_LAYOUT;
}

async function showBubble(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, func: addCameraMarker, args: [BUBBLE_ID, await getCameraLayout()] });
    } catch (error) {
        // No access to this page (for example chrome:// pages). The camera is still recorded at the saved position.
        console.warn('[cliprame] Could not show the camera marker:', error.message);
    }
}

async function hideBubble(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, func: removeCameraMarker, args: [BUBBLE_ID] });
    } catch { /* the tab may be gone */ }
}

/** The marker moved or was resized: remember it and move the camera in the recording. */
async function setCameraLayout(layout) {
    const clean = {
        x: Math.min(1, Math.max(0, Number(layout?.x) || DEFAULT_LAYOUT.x)),
        y: Math.min(1, Math.max(0, Number(layout?.y) || DEFAULT_LAYOUT.y)),
        size: Math.min(0.5, Math.max(0.08, Number(layout?.size) || DEFAULT_LAYOUT.size)),
    };
    await chrome.storage.session.set({ cameraLayout: clean });
    if (await getRecording()) await toOffscreen({ type: 'camera-layout', layout: clean });
}

/* ----------------------------- countdown ---------------------------- */

// Runs inside the page. Resolves true to record, or false if Esc was pressed.
// The overlay is removed and two frames pass before capture starts, so it never appears in the video.
function showCountdown(seconds) {
    return new Promise((resolve) => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
        const root = host.attachShadow({ mode: 'closed' });
        root.innerHTML = `
            <style>
                .wrap{position:fixed;inset:0;display:grid;place-items:center;align-content:center;gap:22px;background:rgba(14,13,20,.5);backdrop-filter:blur(3px);font-family:ui-rounded,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:fade .2s ease-out}
                .ring{position:relative;width:168px;height:168px;border-radius:50%;background:rgba(20,18,31,.82);box-shadow:0 30px 60px -20px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.08)}
                svg{position:absolute;inset:0;transform:rotate(-90deg)}
                circle{fill:none;stroke-width:6;stroke-linecap:round}
                .track{stroke:rgba(255,255,255,.1)}
                .bar{stroke:url(#g);stroke-dasharray:465;stroke-dashoffset:0;animation:drain ${seconds}s linear forwards}
                .num{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:76px;font-weight:700;letter-spacing:-.04em}
                .num.tick{animation:pop .45s cubic-bezier(.3,.7,.4,1.4)}
                p{margin:0;padding:8px 14px;border-radius:999px;background:rgba(20,18,31,.82);color:rgba(255,255,255,.8);font-size:13px;font-weight:600}
                b{color:#fff}
                @keyframes drain{to{stroke-dashoffset:465}}
                @keyframes pop{from{transform:scale(1.35);opacity:0}to{transform:none;opacity:1}}
                @keyframes fade{from{opacity:0}}
                @media (prefers-reduced-motion:reduce){*{animation:none!important}}
            </style>
            <div class="wrap" role="status" aria-live="assertive">
                <div class="ring">
                    <svg viewBox="0 0 168 168"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A4CFF"/><stop offset="1" stop-color="#FF3D81"/></linearGradient></defs><circle class="track" cx="84" cy="84" r="74"/><circle class="bar" cx="84" cy="84" r="74"/></svg>
                    <span class="num tick">${seconds}</span>
                </div>
                <p>Recording starts soon · <b>Esc</b> to cancel</p>
            </div>`;
        document.documentElement.appendChild(host);
        const number = root.querySelector('.num');
        let remaining = seconds;

        const finish = (go) => {
            clearInterval(interval);
            window.removeEventListener('keydown', onKey, true);
            host.remove();
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(go)));
        };
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            finish(false);
        };
        window.addEventListener('keydown', onKey, true);
        const interval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) return finish(true);
            number.textContent = String(remaining);
            number.classList.remove('tick');
            void number.offsetWidth;
            number.classList.add('tick');
        }, 1000);
    });
}

async function runCountdown(tabId) {
    try {
        const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: showCountdown, args: [3] });
        return result?.result !== false;
    } catch {
        return true; // No access to draw on this page; record without the countdown.
    }
}

/* ----------------------------- recording ---------------------------- */

let starting = false;

async function startRecording({ tabId, mic, camera, countdown }) {
    if (starting || await getRecording()) throw new Error('A recording is already running.');
    starting = true;
    try {
        if (countdown && !(await runCountdown(tabId))) return 'cancelled';
        await beginCapture({ tabId, mic, camera });
        return 'started';
    } finally {
        starting = false;
    }
}

async function beginCapture({ tabId, mic, camera }) {
    const tab = await chrome.tabs.get(tabId);
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await ensureOffscreen();
    if (camera) await showBubble(tabId);

    const result = await toOffscreen({ type: 'start', streamId, mic, camera, layout: await getCameraLayout(), title: tab.title || 'Tab recording' });
    if (!result?.ok) {
        if (camera) await hideBubble(tabId);
        throw new Error(result?.error || 'Could not start recording.');
    }
    const cameraError = result.cameraError ?? null;
    if (cameraError) await hideBubble(tabId);
    await setRecording({ tabId, camera: camera && !cameraError, mic, startedAt: Date.now(), pausedAt: null, pausedMs: 0, micError: result.micError ?? null, cameraError });
    await setBadge('recording');
}

async function stopRecording() {
    const recording = await getRecording();
    if (!recording) return;
    await toOffscreen({ type: 'stop' });
    // The offscreen document replies later with "recording-saved".
}

async function discardRecording() {
    if (await getRecording()) await toOffscreen({ type: 'discard' });
}

async function pauseRecording(pause) {
    const recording = await getRecording();
    if (!recording || Boolean(recording.pausedAt) === pause) return;
    await toOffscreen({ type: pause ? 'pause' : 'resume' });
    const now = Date.now();
    await setRecording(pause
        ? { ...recording, pausedAt: now }
        : { ...recording, pausedAt: null, pausedMs: recording.pausedMs + (now - recording.pausedAt) });
    await setBadge(pause ? 'paused' : 'recording');
}

async function finishRecording(id) {
    const recording = await getRecording();
    await clearRecording();
    await setBadge('idle');
    if (recording?.camera) await hideBubble(recording.tabId);
    if (id) await chrome.tabs.create({ url: chrome.runtime.getURL(`result.html?id=${encodeURIComponent(id)}`) });
    try { await chrome.offscreen.closeDocument(); } catch { /* already closed */ }
}

/* ------------------------------ masking ----------------------------- */

/** Registers mask.js for every site that has masking on and has granted access. */
async function syncMaskScripts() {
    const { maskSites = [] } = await chrome.storage.local.get('maskSites');
    const allowed = [];
    for (const origin of maskSites) {
        if (await chrome.permissions.contains({ origins: [`${origin}/*`] })) allowed.push(`${origin}/*`);
    }
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [MASK_SCRIPT_ID] });
    if (!allowed.length) {
        if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [MASK_SCRIPT_ID] });
        return;
    }
    const script = { id: MASK_SCRIPT_ID, matches: allowed, js: ['mask.js'], runAt: 'document_start', allFrames: true, persistAcrossSessions: true };
    if (existing.length) await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
}

/** Adds mask.js to an already open tab, which a newly registered script does not reach. */
async function injectMask(tabId) {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['mask.js'] });
}

/* ------------------------------ messages ---------------------------- */

const handlers = {
    start: (message) => startRecording(message),
    stop: () => stopRecording(),
    discard: () => discardRecording(),
    'recording-discarded': () => finishRecording(null),
    pause: () => pauseRecording(true),
    resume: () => pauseRecording(false),
    'sync-masks': () => syncMaskScripts(),
    'inject-mask': (message) => injectMask(message.tabId),
    'recording-saved': (message) => finishRecording(message.id),
    'camera-layout': (message) => setCameraLayout(message.layout),
    'recording-failed': async (message) => {
        await finishRecording(null);
        console.error('[cliprame] Recording failed:', message.error);
    },
};

/* ---------------------------------- Gmail ---------------------------------- */
// gmail.js asks for these. Requests go to Cliprame with the browser's Cliprame session
// (host permission lets the service worker send its cookies), so nothing is stored here.

const CLIPRAME_ORIGINS = ['https://www.cliprame.com', 'http://localhost:3000'];
const OPENABLE_PATHS = /^\/(studio(\/videos)?(\?create=record)?|login\?next=\/studio\/videos)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The Cliprame address chosen on the review page; cliprame.com unless it's set to localhost. */
async function cliprameOrigin() {
    const { cliprameOrigin: chosen } = await chrome.storage.local.get('cliprameOrigin');
    return CLIPRAME_ORIGINS.includes(chosen) ? chosen : CLIPRAME_ORIGINS[0];
}

function fromGmail(sender) {
    if (sender.id !== chrome.runtime.id || sender.origin !== 'https://mail.google.com') throw new Error('Not allowed.');
}

async function cliprameApi(path, init = {}) {
    const origin = await cliprameOrigin();
    let response;
    try {
        response = await fetch(`${origin}${path}`, {
            ...init,
            credentials: 'include',
            headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
            cache: 'no-store',
        });
    } catch {
        throw new Error(`Couldn’t reach ${new URL(origin).host}. Check your connection.`);
    }
    if (response.status === 401) return { origin, signedOut: true };
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Cliprame answered ${response.status}.`);
    return { origin, ...data };
}

handlers['gmail-videos'] = (_message, sender) => {
    fromGmail(sender);
    return cliprameApi('/api/videos');
};

handlers['gmail-link'] = (message, sender) => {
    fromGmail(sender);
    if (!UUID.test(message.videoId ?? '')) throw new Error('Choose a video.');
    const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
    return cliprameApi(`/api/videos/${message.videoId}/links`, {
        method: 'POST',
        body: JSON.stringify({ recipientName: text(message.recipientName, 120), recipientEmail: text(message.recipientEmail, 254) }),
    });
};

handlers['open-cliprame'] = async (message, sender) => {
    fromGmail(sender);
    if (!OPENABLE_PATHS.test(message.path ?? '')) throw new Error('Not allowed.');
    await chrome.tabs.create({ url: `${await cliprameOrigin()}${message.path}`, index: sender.tab ? sender.tab.index + 1 : undefined });
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== 'background') return false;
    const handler = handlers[message.type];
    if (!handler) return false;
    Promise.resolve(handler(message, sender))
        .then((value) => sendResponse({ ok: true, value }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
});

// Put the camera bubble back after the recorded tab loads a new page.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (info.status !== 'complete') return;
    const recording = await getRecording();
    if (recording?.camera && recording.tabId === tabId) await showBubble(tabId);
});

// Keyboard shortcut: start on the current tab with the popup's last choices, or finish.
chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'toggle-recording') return;
    if (await getRecording()) {
        await stopRecording();
        return;
    }
    if (!tab?.id) return;
    const { recordPrefs } = await chrome.storage.local.get('recordPrefs');
    const prefs = { mic: true, camera: true, countdown: true, ...recordPrefs };
    try {
        await startRecording({ tabId: tab.id, ...prefs });
    } catch (error) {
        console.error('[cliprame] Could not start from the shortcut:', error.message);
    }
});

chrome.runtime.onInstalled.addListener(() => { void syncMaskScripts(); void setBadge('idle'); });
chrome.runtime.onStartup.addListener(() => { void syncMaskScripts(); void clearRecording(); void setBadge('idle'); });
