const CACHE = 'milista-v2';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Solo cachear assets locales, no llamadas a Supabase
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});