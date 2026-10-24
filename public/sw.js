// Caches the app shell so Ember opens without a connection. Data itself is
// cached and queued by the app (see src/lib/store.ts), never by this worker.
const CACHE = 'ember-shell-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg?v=2', '/apple-touch-icon.png?v=2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network first so updates land immediately, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Hashed build assets never change; everything else refreshes in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && url.pathname.startsWith('/assets/')) return cached;
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
      if (!cached) return network;
      network.catch(() => {});
      return cached;
    }),
  );
});
