const CACHE = 'trademap-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept external APIs (Yahoo Finance, CORS proxies)
  if (
    url.hostname.includes('yahoo') ||
    url.hostname.includes('corsproxy') ||
    url.hostname.includes('allorigins')
  ) return;

  // CDN assets (fonts, Tailwind, Lightweight Charts): stale-while-revalidate
  if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then(r => { if (r.ok) cache.put(request, r.clone()); return r; })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Same-origin app shell: network first, fall back to cache
  e.respondWith(
    fetch(request)
      .then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return r;
      })
      .catch(() => caches.match(request).then(r => r || caches.match('/')))
  );
});
