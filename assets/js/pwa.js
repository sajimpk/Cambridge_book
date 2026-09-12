/**
 * Service Worker & Cache Buster Manager
 * Unregisters any active service worker and purges CacheStorage so no cache is stored.
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }

  if ('caches' in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    }).catch(() => {});
  }
}