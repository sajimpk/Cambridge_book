// Service Worker: Disabled Caching - Clean up all caches and fetch directly from network
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch live from network, never cache
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
