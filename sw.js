// Service Worker - Club Sarmiento Portal
const CACHE_NAME = 'club-sarmiento-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/firebase-config.js'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// Push notifications handler
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : { title: 'Club Sarmiento', body: 'Nueva notificación' };
    e.waitUntil(
        self.registration.showNotification(data.title || 'Club Sarmiento', {
            body: data.body || '',
            icon: 'https://files.catbox.moe/9h1xff.jpg',
            badge: 'https://files.catbox.moe/9h1xff.jpg',
            vibrate: [200, 100, 200]
        })
    );
});
