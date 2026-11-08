// Caches the app shell so Tempo opens instantly, and without a connection. Data
// itself is cached and queued by the app (see src/lib/store.ts), never by this worker.
const CACHE = 'tempo-shell-v4';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg?v=3', '/apple-touch-icon.png?v=3'];

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

const assetsIn = (html) => new Set([...html.matchAll(/\/assets\/[^"'\s)]+/g)].map((m) => m[0]));

/**
 * Fetch the latest page in the background. When it changed, keep only the build
 * assets the old and new pages use, and tell open windows an update is ready.
 */
async function refreshShell(request) {
  const cache = await caches.open(CACHE);
  const res = await fetch(request);
  if (!res.ok) return res;
  const fresh = await res.clone().text();
  const cached = await cache.match('/');
  const old = cached ? await cached.text() : null;
  await cache.put('/', res.clone());
  if (old !== null && old !== fresh) {
    const keep = new Set([...assetsIn(old), ...assetsIn(fresh)]);
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname;
      if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req);
    }
    for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'updated' });
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: open from the cache straight away and refresh it in the background,
  // so a new version is picked up on the next open. Network only the first time.
  if (request.mode === 'navigate') {
    const refresh = refreshShell(request);
    event.waitUntil(refresh.catch(() => {}));
    event.respondWith(caches.match('/').then((cached) => cached ?? refresh));
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
