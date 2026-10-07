const CACHE = 'cliprame-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/cliprame-logo.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

// Pages, API calls and auth stay network-only so signed-in content is never cached.
// Only the offline fallback is served when a navigation fails.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || request.mode !== 'navigate') return;
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
