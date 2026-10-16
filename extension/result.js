import { deleteRecording, getRecording, listRecordings, updateRecording } from './lib/recordings.js';

const $ = (id) => document.getElementById(id);
const id = new URLSearchParams(location.search).get('id');

function formatDuration(ms) {
    const total = Math.round(ms / 1000);
    const minutes = Math.floor(total / 60);
    return minutes ? `${minutes}:${String(total % 60).padStart(2, '0')}` : `0:${String(total).padStart(2, '0')}`;
}

const formatSize = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(0.1, bytes / 1e6).toFixed(1)} MB`);
const formatWhen = (time) => new Date(time).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const safeName = (title) => (title || 'recording').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'recording';

function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon-sm');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `icons.svg#${name}`);
    svg.append(use);
    return svg;
}

function chip(iconName, text) {
    const element = document.createElement('span');
    element.className = 'chip';
    element.append(icon(iconName), document.createTextNode(text));
    return element;
}

let toastTimer = null;
function toast(message, bad = false) {
    const element = $('toast');
    element.textContent = message;
    element.classList.toggle('bad', bad);
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
}

function renderRecent(list, items) {
    list.replaceChildren(...items.map((item) => {
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.href = `result.html?id=${encodeURIComponent(item.id)}`;
        if (item.id === id) link.setAttribute('aria-current', 'page');
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        thumb.append(icon('video'));
        const info = document.createElement('span');
        info.className = 'info';
        const title = document.createElement('b');
        title.textContent = item.title || 'Tab recording';
        const meta = document.createElement('small');
        meta.textContent = `${formatDuration(item.durationMs)} · ${formatWhen(item.createdAt)}`;
        info.append(title, meta);
        link.append(thumb, info);
        row.append(link);
        return row;
    }));
}

async function init() {
    const { cliprameOrigin } = await chrome.storage.local.get('cliprameOrigin');
    if (cliprameOrigin) $('target').value = cliprameOrigin;
    $('target').addEventListener('change', () => void chrome.storage.local.set({ cliprameOrigin: $('target').value }));

    const [recording, all] = await Promise.all([id ? getRecording(id) : null, listRecordings()]);
    if (!recording) {
        $('layout').hidden = true;
        $('saved-chip').hidden = true;
        $('missing').hidden = false;
        renderRecent($('missing-recent'), all);
        return;
    }

    const url = URL.createObjectURL(recording.blob);
    document.title = `${recording.title} · Cliprame`;
    $('title').value = recording.title;
    $('video').src = url;
    $('download').href = url;
    $('download').download = `${safeName(recording.title)}.webm`;

    const meta = $('meta');
    meta.append(chip('timer', formatDuration(recording.durationMs)), chip('download', formatSize(recording.blob.size)), chip('video', formatWhen(recording.createdAt)));
    $('video').addEventListener('loadedmetadata', () => {
        const { videoWidth, videoHeight } = $('video');
        if (videoWidth) meta.insertBefore(chip('film', `${videoWidth}×${videoHeight}`), meta.children[1]);
    }, { once: true });

    if (all.length > 1) {
        $('recent-panel').hidden = false;
        renderRecent($('recent'), all);
    }

    // Rename: saved when the field loses focus or Enter is pressed.
    const saveTitle = async () => {
        const title = $('title').value.trim() || 'Tab recording';
        $('title').value = title;
        if (title === recording.title) return;
        recording.title = title;
        await updateRecording(recording.id, { title });
        document.title = `${title} · Cliprame`;
        $('download').download = `${safeName(title)}.webm`;
        renderRecent($('recent'), await listRecordings());
        toast('Name saved');
    };
    $('title').addEventListener('blur', () => void saveTitle());
    $('title').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') $('title').blur();
        if (event.key === 'Escape') { $('title').value = recording.title; $('title').blur(); }
    });

    $('edit').addEventListener('click', () => {
        const target = new URL('/studio', $('target').value);
        target.searchParams.set('import', 'extension');
        target.searchParams.set('recording', recording.id);
        void chrome.tabs.create({ url: target.href });
        toast('Opening Cliprame…');
    });

    $('download').addEventListener('click', () => toast('Download started'));

    $('delete').addEventListener('click', async () => {
        if (!window.confirm(`Delete "${recording.title}"? This can't be undone.`)) return;
        await deleteRecording(recording.id);
        URL.revokeObjectURL(url);
        const next = (await listRecordings())[0];
        location.replace(next ? `result.html?id=${encodeURIComponent(next.id)}` : 'result.html');
    });
}

init().catch((error) => toast(`Could not open the recording: ${error.message}`, true));
