// One-time camera and microphone setup for the extension, with a live check of both.
const $ = (id) => document.getElementById(id);
const BAR_COUNT = 18;

function setCheck(kind, state) {
    const row = $(kind === 'camera' ? 'check-camera' : 'check-mic');
    const label = $(kind === 'camera' ? 'camera-state' : 'mic-state');
    row.classList.toggle('ok', state === 'granted');
    row.classList.toggle('bad', state === 'denied');
    label.textContent = state === 'granted' ? 'Allowed' : state === 'denied' ? 'Blocked in Chrome' : 'Not allowed yet';
}

function startMeter(stream) {
    const bars = $('bars');
    bars.hidden = false;
    bars.replaceChildren(...Array.from({ length: BAR_COUNT }, () => document.createElement('i')));
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const levels = new Array(BAR_COUNT).fill(0);
    let last = 0;
    const draw = (time) => {
        requestAnimationFrame(draw);
        if (time - last < 60) return;
        last = time;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        levels.shift();
        levels.push(Math.min(1, Math.sqrt(sum / data.length) * 4));
        [...bars.children].forEach((bar, index) => {
            bar.style.height = `${3 + Math.round(levels[index] * 15)}px`;
            bar.classList.toggle('on', levels[index] > 0.08);
        });
    };
    requestAnimationFrame(draw);
}

async function showReady(stream) {
    $('cam').srcObject = new MediaStream(stream.getVideoTracks());
    $('cam-circle').classList.add('live');
    startMeter(new MediaStream(stream.getAudioTracks()));
    setCheck('camera', 'granted');
    setCheck('microphone', 'granted');
    $('heading').textContent = 'Looking good';
    $('allow').hidden = true;
    $('error').hidden = true;
    $('done').hidden = false;
    try {
        const commands = await chrome.commands.getAll();
        const shortcut = commands.find((command) => command.name === 'toggle-recording')?.shortcut;
        if (shortcut) $('shortcut-text').textContent = `, or press ${shortcut}`;
    } catch { /* shortcut is optional */ }
}

async function request() {
    $('error').hidden = true;
    $('allow').disabled = true;
    $('allow').textContent = 'Waiting for Chrome…';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } });
        await showReady(stream);
    } catch (error) {
        $('allow').disabled = false;
        $('allow').textContent = 'Try again';
        $('error').hidden = false;
        $('error').textContent = error.name === 'NotAllowedError'
            ? 'Access was blocked. Click the camera icon in the address bar, allow both, then try again.'
            : `Could not use your camera or microphone: ${error.message}`;
        await refreshStates();
    }
}

async function refreshStates() {
    for (const name of ['camera', 'microphone']) {
        try { setCheck(name, (await navigator.permissions.query({ name })).state); } catch { setCheck(name, 'prompt'); }
    }
}

$('allow').addEventListener('click', () => void request());

// If access was granted before, show the live check straight away.
void refreshStates().then(async () => {
    const states = await Promise.all(['camera', 'microphone'].map((name) => navigator.permissions.query({ name }).then((s) => s.state).catch(() => 'prompt')));
    if (states.every((state) => state === 'granted')) void request();
});
