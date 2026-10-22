// Service Worker: App-Hülle offline verfügbar machen. Daten laufen nie über den Cache.
const VERSION = 'hm-11';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/main.js', 'src/model.js', 'src/logic.js', 'src/storage.js', 'src/sync.js', 'src/texts.js', 'src/ui.js',
  'icons/favicon.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 
  ...['shopping', 'tasks', 'calendar', 'today', 'notes', 'contacts', 'gifts', 'projects', 'search'].flatMap((m) => [`icons/rabe-${m}.png`, `icons/rabe-${m}-rand.png`]),
  ...['sitzt', 'fliegt', 'huepft', 'schlaeft', 'zwei', 'schaut', 'traegt', 'landet'].map((m) => `icons/mini-${m}.png`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
  }
});

// Erinnerungen vom eigenen Server (Mac-App). Inhalt: { title, body, tag, url }
self.addEventListener('push', (e) => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch { msg = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(msg.title || 'Hugin & Munin', {
    body: msg.body || '', tag: msg.tag || undefined, icon: 'icons/icon-192.png', badge: 'icons/favicon.png', data: { url: msg.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow(new URL(e.notification.data?.url || './', self.registration.scope).href);
  }));
});
