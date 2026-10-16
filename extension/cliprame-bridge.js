// Runs on Cliprame pages. When the studio asks for an extension recording, adds a
// hidden extension frame that sends the video file to the page.
(() => {
    const requested = new Set();

    window.addEventListener('message', (event) => {
        if (event.source !== window || event.origin !== location.origin) return;
        const data = event.data;
        if (data?.source !== 'cliprame-app' || data.type !== 'import-ready' || typeof data.id !== 'string') return;
        if (requested.has(data.id) || !/^[\w-]{1,64}$/.test(data.id)) return;
        requested.add(data.id);

        const frame = document.createElement('iframe');
        frame.src = chrome.runtime.getURL(`bridge.html?id=${encodeURIComponent(data.id)}`);
        frame.hidden = true;
        frame.title = 'Cliprame Recorder';
        document.documentElement.appendChild(frame);
        setTimeout(() => frame.remove(), 60_000);
    });
})();
