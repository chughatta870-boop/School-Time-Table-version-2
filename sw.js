/* ============================================
   SCHOOL TIMETABLE MANAGER — sw.js
   Service Worker — Offline + Cache First
   ============================================ */

const CACHE_NAME    = 'timetable-v1.0.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap'
];

// ── Install: cache all static assets ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First strategy ────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached, update in background
        fetchAndCache(event.request);
        return cachedResponse;
      }
      // Not cached: fetch and store
      return fetchAndCache(event.request);
    }).catch(() => {
      // Offline fallback for navigation
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (!response || response.status !== 200 || response.type === 'opaque') {
      return response;
    }
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Network failed, try cache
    return caches.match(request);
  }
}

// ── Message: force cache update ────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
