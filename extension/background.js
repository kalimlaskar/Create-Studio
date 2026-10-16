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

// Runs inside the recorded page. The bubble is part of the page, so tab capture records it.
function addCameraBubble(bubbleId) {
    if (document.getElementById(bubbleId)) return;
    const host = document.createElement('div');
    host.id = bubbleId;
    host.title = 'Drag to move · double-click to resize';
    host.style.cssText = 'position:fixed;left:24px;bottom:24px;width:180px;height:180px;z-index:2147483647;border-radius:50%;padding:4px;background:linear-gradient(135deg,#6A4CFF,#8B5CF6 55%,#FF3D81);box-shadow:0 18px 40px -12px rgba(20,18,31,.55),0 0 0 1px rgba(255,255,255,.25);cursor:grab;touch-action:none;transition:width .25s cubic-bezier(.3,.7,.4,1.2),height .25s cubic-bezier(.3,.7,.4,1.2);';
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('camera.html');
    frame.allow = 'camera';
    frame.title = 'Cliprame camera';
    frame.style.cssText = 'width:100%;height:100%;border:0;border-radius:50%;pointer-events:none;background:#14121F;';
    host.appendChild(frame);

    // Drag the whole bubble. The iframe ignores pointer events so the host receives them.
    let start = null;
    host.addEventListener('pointerdown', (event) => {
        const rect = host.getBoundingClientRect();
        start = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        host.setPointerCapture(event.pointerId);
        host.style.cursor = 'grabbing';
    });
    host.addEventListener('pointermove', (event) => {
        if (!start) return;
        const left = Math.min(Math.max(0, event.clientX - start.x), window.innerWidth - host.offsetWidth);
        const top = Math.min(Math.max(0, event.clientY - start.y), window.innerHeight - host.offsetHeight);
        host.style.left = `${left}px`;
        host.style.top = `${top}px`;
        host.style.bottom = 'auto';
    });
    host.addEventListener('pointerup', () => { start = null; host.style.cursor = 'grab'; });
    // Double-click cycles small, medium and large.
    const sizes = [140, 180, 240];
    host.addEventListener('dblclick', () => {
        const next = sizes[(sizes.indexOf(host.offsetWidth) + 1) % sizes.length] ?? 180;
        host.style.width = `${next}px`;
        host.style.height = `${next}px`;
    });
    document.documentElement.appendChild(host);
}

function removeCameraBubble(bubbleId) {
    document.getElementById(bubbleId)?.remove();
}

async function showBubble(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, func: addCameraBubble, args: [BUBBLE_ID] });
    } catch (error) {
        // No access to this page (for example chrome:// pages, or a site without permission after navigating).
        console.warn('[cliprame] Could not show the camera bubble:', error.message);
    }
}

async function hideBubble(tabId) {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, func: removeCameraBubble, args: [BUBBLE_ID] });
    } catch { /* the tab may be gone */ }
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

    const result = await toOffscreen({ type: 'start', streamId, mic, title: tab.title || 'Tab recording' });
    if (!result?.ok) {
        if (camera) await hideBubble(tabId);
        throw new Error(result?.error || 'Could not start recording.');
    }
    const { pendingCameraError } = await chrome.storage.session.get('pendingCameraError');
    await chrome.storage.session.remove('pendingCameraError');
    const cameraError = pendingCameraError?.tabId === tabId ? pendingCameraError.reason : null;
    await setRecording({ tabId, camera: camera && !cameraError, mic, startedAt: Date.now(), pausedAt: null, pausedMs: 0, micError: result.micError ?? null, cameraError });
    await setBadge('recording');
}

async function stopRecording() {
    const recording = await getRecording();
    if (!recording) return;
    await toOffscreen({ type: 'stop' });
    // The offscreen document replies later with "recording-saved".
}

/** The bubble's camera couldn't start: remove the bubble and tell the popup why. */
async function cameraFailed(tabId, reason) {
    if (!tabId) return;
    await hideBubble(tabId);
    const recording = await getRecording();
    if (recording?.tabId === tabId) {
        await setRecording({ ...recording, camera: false, cameraError: reason });
    } else {
        // The bubble is added just before the recording state is saved; keep the reason for it.
        await chrome.storage.session.set({ pendingCameraError: { tabId, reason } });
    }
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
    'camera-failed': (message, sender) => cameraFailed(sender.tab?.id, message.reason),
    'recording-failed': async (message) => {
        await finishRecording(null);
        console.error('[cliprame] Recording failed:', message.error);
    },
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
