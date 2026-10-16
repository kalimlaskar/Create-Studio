// Popup: start and control recordings, and manage privacy masks for the current site.

const PATTERNS = [
    ['email', 'Emails'],
    ['phone', 'Phone numbers'],
    ['card', 'Card numbers'],
    ['apiKey', 'API keys & tokens'],
    ['pan', 'PAN'],
    ['aadhaar', 'Aadhaar'],
];
const DEFAULT_RULES = {
    selectors: [],
    patterns: { email: true, phone: true, card: true, apiKey: true, pan: false, aadhaar: false },
    words: [],
    style: 'block',
    maskInputs: false,
};
const DEFAULT_PREFS = { mic: true, camera: true, countdown: true };
const METER_BARS = 22;

const $ = (id) => document.getElementById(id);
const send = (message) => chrome.runtime.sendMessage({ ...message, target: 'background' });

let tab = null;
let origin = null;
let timer = null;
let isLive = false;
const access = { camera: 'prompt', microphone: 'prompt' };

function icon(name, className = 'icon-sm') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `icons.svg#${name}`);
    svg.append(use);
    return svg;
}

/* -------------------------------- tabs ------------------------------ */

function selectTab(name, focus = false) {
    for (const id of ['record', 'privacy']) {
        const selected = id === name;
        $(`tab-${id}`).setAttribute('aria-selected', String(selected));
        $(`tab-${id}`).tabIndex = selected ? 0 : -1;
        $(`panel-${id}`).hidden = !selected;
    }
    if (focus) $(`tab-${name}`).focus();
    try { localStorage.setItem('popup-tab', name); } catch { /* not important */ }
    if (name === 'record') void refreshPreviews();
    else stopPreviews();
}

$('tab-record').addEventListener('click', () => selectTab('record'));
$('tab-privacy').addEventListener('click', () => selectTab('privacy'));
document.querySelector('.tabs').addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    selectTab($('tab-record').getAttribute('aria-selected') === 'true' ? 'privacy' : 'record', true);
});
$('privacy-row').addEventListener('click', () => selectTab('privacy'));

/* ------------------------------ previews ---------------------------- */

let camStream = null;
let micStream = null;
let audioContext = null;
let meterFrame = null;

async function readAccess() {
    for (const name of ['camera', 'microphone']) {
        try { access[name] = (await navigator.permissions.query({ name })).state; } catch { access[name] = 'prompt'; }
    }
}

function renderAccess() {
    const needs = (on, state) => on && state !== 'granted';
    $('grant').hidden = !(needs($('camera').checked, access.camera) || needs($('mic').checked, access.microphone));

    const camSub = $('camera-sub');
    camSub.classList.toggle('warn', access.camera === 'denied');
    camSub.textContent = access.camera === 'denied' ? 'Blocked. Allow it in Chrome site settings.' : access.camera === 'granted' ? 'Drag it anywhere on the page' : 'Needs camera access';

    const micSub = $('mic-sub');
    micSub.classList.toggle('warn', access.microphone === 'denied');
    micSub.textContent = access.microphone === 'denied' ? 'Blocked. Allow it in Chrome site settings.' : 'Needs microphone access';
    micSub.hidden = access.microphone === 'granted' && $('mic').checked;
    $('meter').hidden = !(access.microphone === 'granted' && $('mic').checked);
    $('bubble').classList.toggle('off', !$('camera').checked);

    // Without access, the camera bubble or voice would silently fail, so set it up first.
    const missing = missingAccess();
    $('start-label').textContent = missing ? `Allow ${missing} to start` : 'Start recording';
    $('start-anyway').hidden = !missing;
}

/** "camera", "microphone" or "camera and microphone" when switched on but not allowed yet. */
function missingAccess() {
    const camera = $('camera').checked && access.camera !== 'granted';
    const mic = $('mic').checked && access.microphone !== 'granted';
    return camera && mic ? 'camera & mic' : camera ? 'camera' : mic ? 'microphone' : '';
}

async function refreshPreviews() {
    renderAccess();
    if (isLive || $('panel-record').hidden) return stopPreviews();

    if ($('camera').checked && access.camera === 'granted' && !camStream) {
        try {
            camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 240 }, height: { ideal: 240 }, facingMode: 'user' } });
            $('cam-preview').srcObject = camStream;
            $('bubble').classList.add('live');
        } catch { /* camera busy or unavailable; the icon placeholder stays */ }
    } else if (!$('camera').checked) {
        stopCamera();
    }

    if ($('mic').checked && access.microphone === 'granted' && !micStream) {
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            startMeter(micStream);
        } catch { /* microphone busy or unavailable */ }
    } else if (!$('mic').checked) {
        stopMic();
    }
}

function stopCamera() {
    camStream?.getTracks().forEach((track) => track.stop());
    camStream = null;
    $('cam-preview').srcObject = null;
    $('bubble').classList.remove('live');
}

function stopMic() {
    cancelAnimationFrame(meterFrame);
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    void audioContext?.close();
    audioContext = null;
}

function stopPreviews() {
    stopCamera();
    stopMic();
}

function buildMeter() {
    $('meter').replaceChildren(...Array.from({ length: METER_BARS }, () => document.createElement('i')));
}

// A scrolling level meter: each bar is a recent moment of loudness.
function startMeter(stream) {
    audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const bars = [...$('meter').children];
    const levels = new Array(METER_BARS).fill(0);
    let last = 0;

    const draw = (time) => {
        meterFrame = requestAnimationFrame(draw);
        if (time - last < 60) return;
        last = time;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / data.length) * 4);
        levels.shift();
        levels.push(level);
        bars.forEach((bar, index) => {
            bar.style.height = `${3 + Math.round(levels[index] * 11)}px`;
            bar.classList.toggle('on', levels[index] > 0.08);
        });
    };
    meterFrame = requestAnimationFrame(draw);
}

window.addEventListener('pagehide', stopPreviews);

/* ------------------------------ preferences ------------------------- */

async function loadPrefs() {
    const { recordPrefs } = await chrome.storage.local.get('recordPrefs');
    const prefs = { ...DEFAULT_PREFS, ...recordPrefs };
    $('mic').checked = prefs.mic;
    $('camera').checked = prefs.camera;
    $('countdown').checked = prefs.countdown;
}

const savePrefs = () => chrome.storage.local.set({ recordPrefs: { mic: $('mic').checked, camera: $('camera').checked, countdown: $('countdown').checked } });

for (const id of ['mic', 'camera', 'countdown']) {
    $(id).addEventListener('change', () => { void savePrefs(); void refreshPreviews(); });
}

$('grant').addEventListener('click', () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
    window.close();
});

async function renderShortcut() {
    const commands = await chrome.commands.getAll();
    const shortcut = commands.find((command) => command.name === 'toggle-recording')?.shortcut;
    $('shortcut').textContent = shortcut || 'Set shortcut';
    $('shortcut').title = shortcut ? `Press ${shortcut} on any tab to start or finish` : 'Choose a keyboard shortcut to start or finish';
}

$('shortcut').addEventListener('click', () => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

/* ------------------------------- recording -------------------------- */

function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function renderLive(recording) {
    isLive = Boolean(recording);
    $('live').hidden = !isLive;
    $('idle').hidden = isLive;
    clearInterval(timer);
    if (!recording) {
        $('discard-confirm').hidden = true;
        $('live-controls').hidden = false;
        void refreshPreviews();
        return;
    }
    stopPreviews();

    const paused = Boolean(recording.pausedAt);
    document.querySelector('.live-card').classList.toggle('paused', paused);
    $('live-label').textContent = paused ? 'Paused' : 'Recording';
    $('pause').setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    $('pause').title = paused ? 'Resume' : 'Pause';
    $('pause-icon').firstElementChild.setAttribute('href', `icons.svg#${paused ? 'play' : 'pause'}`);
    $('mic-error').hidden = !recording.micError;
    $('mic-error').textContent = recording.micError ? `${recording.micError} Recording without your voice.` : '';
    $('camera-error').hidden = !recording.cameraError;
    $('camera-error').textContent = recording.cameraError ? `Camera bubble removed. ${recording.cameraError}` : '';
    chrome.tabs.get(recording.tabId).then((recordedTab) => { $('live-title').textContent = recordedTab.title; }).catch(() => {});

    const tick = () => {
        const end = recording.pausedAt ?? Date.now();
        $('timer').textContent = formatTime(end - recording.startedAt - recording.pausedMs);
    };
    tick();
    if (!paused) timer = setInterval(tick, 250);
}

$('start').addEventListener('click', () => {
    if (missingAccess()) {
        void chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
        window.close();
        return;
    }
    void startRecording({ camera: $('camera').checked, mic: $('mic').checked });
});

// Records with only what is already allowed; the saved choices don't change.
$('start-anyway').addEventListener('click', () => void startRecording({
    camera: $('camera').checked && access.camera === 'granted',
    mic: $('mic').checked && access.microphone === 'granted',
}));

async function startRecording({ camera, mic }) {
    // Must be the first call in the click so Chrome treats it as user-initiated.
    // Site access lets the camera bubble come back after the page navigates.
    const siteAccess = camera && origin ? chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false) : Promise.resolve(false);

    const countdown = $('countdown').checked;
    $('start').disabled = true;
    $('start').classList.toggle('counting', countdown);
    $('start-label').textContent = countdown ? 'Get ready…' : 'Starting…';
    $('start-error').hidden = true;
    stopPreviews();
    await siteAccess;

    const result = await send({ type: 'start', tabId: tab.id, mic, camera, countdown });
    $('start').disabled = false;
    $('start').classList.remove('counting');
    renderAccess();
    if (result?.ok && result.value !== 'cancelled') {
        window.close();
        return;
    }
    if (!result?.ok) {
        $('start-error').hidden = false;
        $('start-error').textContent = result?.error ?? 'Could not start recording.';
    }
    void refreshPreviews();
}

$('pause').addEventListener('click', async () => {
    const { recording } = await chrome.storage.session.get('recording');
    await send({ type: recording?.pausedAt ? 'resume' : 'pause' });
});

$('stop').addEventListener('click', async () => {
    $('stop').disabled = true;
    await send({ type: 'stop' });
    window.close();
});

$('discard').addEventListener('click', () => {
    $('live-controls').hidden = true;
    $('discard-confirm').hidden = false;
    $('discard-cancel').focus();
});
$('discard-cancel').addEventListener('click', () => {
    $('discard-confirm').hidden = true;
    $('live-controls').hidden = false;
});
$('discard-yes').addEventListener('click', async () => {
    $('discard-yes').disabled = true;
    await send({ type: 'discard' });
    $('discard-yes').disabled = false;
});

chrome.storage.session.onChanged.addListener((changes) => {
    if (changes.recording) renderLive(changes.recording.newValue ?? null);
});

/* --------------------------------- masks ---------------------------- */

const rulesKey = () => `rules:${origin}`;

async function getRules() {
    const stored = (await chrome.storage.local.get(rulesKey()))[rulesKey()];
    return { ...DEFAULT_RULES, ...stored, patterns: { ...DEFAULT_RULES.patterns, ...stored?.patterns } };
}

async function updateRules(change) {
    const rules = await getRules();
    await chrome.storage.local.set({ [rulesKey()]: { ...rules, ...change(rules) } });
}

async function masksEnabled() {
    if (!origin) return false;
    const { maskSites = [] } = await chrome.storage.local.get('maskSites');
    return maskSites.includes(origin) && chrome.permissions.contains({ origins: [`${origin}/*`] });
}

function summarize(rules) {
    const patterns = Object.values(rules.patterns).filter(Boolean).length;
    const parts = [];
    if (rules.selectors.length) parts.push(`${rules.selectors.length} ${rules.selectors.length === 1 ? 'element' : 'elements'}`);
    if (patterns) parts.push(`${patterns} ${patterns === 1 ? 'pattern' : 'patterns'}`);
    if (rules.words.length) parts.push(`${rules.words.length} ${rules.words.length === 1 ? 'word' : 'words'}`);
    if (rules.maskInputs) parts.push('form fields');
    return { count: rules.selectors.length + patterns + rules.words.length + (rules.maskInputs ? 1 : 0), text: parts.join(', ') };
}

async function renderMasks() {
    const enabled = await masksEnabled();
    const rules = await getRules();
    const { count, text } = summarize(rules);

    $('mask-on').checked = enabled;
    $('mask-on').disabled = !origin;
    $('mask-empty').hidden = enabled || !origin;
    $('mask-unavailable').hidden = Boolean(origin);
    $('mask-settings').hidden = !enabled;
    $('site-sub').textContent = enabled ? `Masks on · ${count} active` : 'Masks are off';
    $('site-sub').classList.toggle('on', enabled);

    $('privacy-row').classList.toggle('on', enabled);
    $('privacy-summary').textContent = !origin ? 'Masks work on regular websites' : enabled ? `Masks on: ${text || 'nothing selected yet'}` : 'Privacy masks are off for this site';
    $('privacy-count').hidden = !enabled || !count;
    $('privacy-count').textContent = String(count);
    $('stage-badge').hidden = !enabled;
    $('stage-mask-1').classList.toggle('on', enabled);
    $('stage-mask-2').classList.toggle('on', enabled);
    if (!enabled) return;

    $('picked').replaceChildren(...rules.selectors.map((item, index) => {
        const row = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'tag';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = item.label || item.selector;
        label.title = item.selector;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Stop masking ${item.label || item.selector}`);
        remove.append(icon('x'));
        remove.addEventListener('click', () => void updateRules((current) => ({ selectors: current.selectors.filter((_, i) => i !== index) })));
        row.append(swatch, label, remove);
        return row;
    }));

    for (const [name] of PATTERNS) $(`pattern-${name}`).setAttribute('aria-pressed', String(Boolean(rules.patterns[name])));
    $('mask-inputs').checked = rules.maskInputs;
    renderWords(rules.words);
    document.querySelector(`input[name="style"][value="${rules.style}"]`).checked = true;
}

function buildPatternChips() {
    $('patterns').replaceChildren(...PATTERNS.map(([name, label]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.id = `pattern-${name}`;
        chip.setAttribute('aria-pressed', 'false');
        chip.append(icon('check'), document.createTextNode(label));
        chip.addEventListener('click', () => {
            const next = chip.getAttribute('aria-pressed') !== 'true';
            void updateRules((rules) => ({ patterns: { ...rules.patterns, [name]: next } }));
        });
        return chip;
    }));
}

function renderWords(words) {
    const input = $('word-input');
    const chips = words.map((word) => {
        const chip = document.createElement('span');
        chip.className = 'word';
        chip.append(document.createTextNode(word));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${word}`);
        remove.append(icon('x', 'icon-sm'));
        remove.addEventListener('click', () => void updateRules((rules) => ({ words: rules.words.filter((item) => item !== word) })));
        chip.append(remove);
        return chip;
    });
    $('tags').replaceChildren(...chips, input);
}

$('tags').addEventListener('click', (event) => { if (event.target === $('tags')) $('word-input').focus(); });
$('word-input').addEventListener('keydown', (event) => {
    const input = event.currentTarget;
    if ((event.key === 'Enter' || event.key === ',') && input.value.trim()) {
        event.preventDefault();
        const word = input.value.trim();
        input.value = '';
        void updateRules((rules) => ({ words: rules.words.some((item) => item.toLowerCase() === word.toLowerCase()) ? rules.words : [...rules.words, word].slice(0, 100) }))
            .then(() => $('word-input').focus());
    } else if (event.key === 'Backspace' && !input.value) {
        void updateRules((rules) => ({ words: rules.words.slice(0, -1) })).then(() => $('word-input').focus());
    }
});

function setMasking(on) {
    // Ask for access to this site only, and only when masking is turned on.
    // This must be the first call in the click handler.
    const granted = on ? chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false) : Promise.resolve(false);
    void granted.then(async (allowed) => {
        const { maskSites = [] } = await chrome.storage.local.get('maskSites');
        const next = maskSites.filter((site) => site !== origin);
        if (on && allowed) next.push(origin);
        await chrome.storage.local.set({ maskSites: next });
        await send({ type: 'sync-masks' });
        if (on && allowed) await send({ type: 'inject-mask', tabId: tab.id });
        await renderMasks();
    });
}

$('mask-on').addEventListener('change', (event) => setMasking(event.target.checked));
$('mask-enable').addEventListener('click', () => setMasking(true));

$('pick').addEventListener('click', async () => {
    const pick = () => chrome.tabs.sendMessage(tab.id, { type: 'cliprame-pick' }, { frameId: 0 });
    await pick().catch(() => send({ type: 'inject-mask', tabId: tab.id }).then(pick));
    window.close();
});

$('mask-inputs').addEventListener('change', (event) => void updateRules(() => ({ maskInputs: event.target.checked })));

document.querySelectorAll('input[name="style"]').forEach((input) => {
    input.addEventListener('change', () => void updateRules(() => ({ style: input.value })));
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && origin && (changes[rulesKey()] || changes.maskSites)) void renderMasks();
});

/* --------------------------------- init ----------------------------- */

async function init() {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
        const url = new URL(tab.url);
        if (url.protocol === 'https:' || url.protocol === 'http:') origin = url.origin;
    } catch { /* no URL for this tab */ }

    const host = origin ? new URL(origin).host : 'This tab';
    $('stage-host').textContent = host;
    $('stage-title').textContent = tab?.title ?? '';
    $('site').textContent = origin ? host : 'This page';
    if (tab?.favIconUrl) {
        for (const id of ['stage-favicon', 'site-favicon']) {
            $(id).src = tab.favIconUrl;
            $(id).hidden = false;
        }
        $('stage-globe').remove();
        $('site-globe').remove();
    }

    buildMeter();
    buildPatternChips();
    await Promise.all([loadPrefs(), readAccess(), renderShortcut()]);
    await renderMasks();

    const { recording } = await chrome.storage.session.get('recording');
    let saved = 'record';
    try { saved = localStorage.getItem('popup-tab') === 'privacy' ? 'privacy' : 'record'; } catch { /* default tab */ }
    selectTab(saved);
    renderLive(recording ?? null);
}

void init();
