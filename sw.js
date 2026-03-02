const CACHE = 'cositas-v3';
const ASSETS = ['./index.html', './manifest.json'];

const SUPABASE_URL = 'https://ppjjetgdlepxvgqxhyxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwampldGdkbGVweHZncXhoeXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc0MjksImV4cCI6MjA4Nzg4MzQyOX0.stEuoeTJ4I6zdGV10XE0bLliXD6RdGuAed_DXHU-HiM';

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
  // No cachear llamadas a APIs externas
  if (e.request.url.includes('supabase.co') || e.request.url.includes('fonts.googleapis')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Notificaciones push desde servidor (infraestructura lista para VAPID)
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || '📋 Cositas', {
      body: data.body || 'Tienes nuevas tareas',
      tag: data.tag || 'cositas-push',
      renotify: true,
      vibrate: [150, 80, 150],
      data: { url: './' }
    })
  );
});

// Al tocar la notificación → abrir o enfocar la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes('index') || c.url.endsWith('/'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// Sync periódico para resumen matutino (Chrome Android con PWA instalada)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'morning-summary') {
    e.waitUntil(sendMorningSummary());
  }
});

async function sendMorningSummary() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?select=id,text&done=eq.false&order=created_at.desc`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return;
    const tasks = await res.json();
    if (!Array.isArray(tasks) || !tasks.length) return;
    const n = tasks.length;
    await self.registration.showNotification('☀️ Buenos días — Cositas', {
      body: `${n} tarea${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''}`,
      tag: 'morning-summary',
      renotify: false,
      vibrate: [200, 100, 200]
    });
  } catch (e) {}
}
