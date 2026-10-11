self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('authichain-v1').then((cache) => cache.addAll(['/verify']))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return; // never cache API to protect metering
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
