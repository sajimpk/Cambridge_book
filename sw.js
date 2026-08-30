const getCacheName = () => {
  // Generates a unique cache key that changes every hour
  const hourTimestamp = Math.floor(Date.now() / (1000 * 60 * 60));
  return `book-library-cache-hour-${hourTimestamp}`;
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const currentCache = getCacheName();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== currentCache).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  // Bypass caching on localhost for development
  const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocalhost) {
    return;
  }

  const currentCache = getCacheName();
  
  event.respondWith(
    caches.open(currentCache).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch from network and update the current hour's cache
        const networkFetch = fetch(event.request).then((networkResponse) => {
          if (event.request.method === 'GET' && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Fallback if network fails
          return cachedResponse;
        });
        
        // Return cached response if exists, otherwise fetch from network
        return cachedResponse || networkFetch;
      });
    })
  );

  // Asynchronously clean up any old hourly caches
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== currentCache).map((key) => caches.delete(key))
    ))
  );
});
