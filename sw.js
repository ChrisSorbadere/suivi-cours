const CACHE_NAME = 'suivi-cours-v1';
const urlsToCache = [
  '/suivi-cours/',
  '/suivi-cours/index.html',
  '/suivi-cours/manifest.json',
  '/suivi-cours/icon-192.png',
  '/suivi-cours/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
