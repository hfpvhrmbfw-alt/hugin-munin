// Service Worker: App-Hülle offline verfügbar machen. Daten laufen nie über den Cache.
// Programm und Stil kommen zuerst frisch vom Netz (neue Versionen sind sofort da), nur offline aus dem Speicher.
// Schriften und Bilder ändern sich selten: die kommen aus dem Speicher und werden im Hintergrund nachgeladen.
const VERSION = 'hm-18';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/main.js', 'src/model.js', 'src/logic.js', 'src/storage.js', 'src/sync.js', 'src/texts.js', 'src/ui.js', 'src/raven.js',
  'fonts/asap.woff2', 'fonts/chivo-mono.woff2', 'icons/favicon.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ...['shopping', 'tasks', 'calendar', 'today', 'notes', 'contacts', 'gifts', 'projects', 'search'].flatMap((m) => [`icons/rabe-${m}.png`, `icons/rabe-${m}-rand.png`]),
  ...['kopf', 'fliegt', 'schlaeft', 'zwei', 'schaut', 'traegt'].map((m) => `icons/mini-${m}.png`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const NET_WAIT = 3000; // so lange aufs Netz warten, dann die gespeicherte Fassung zeigen
const isAsset = (path) => /\/(icons|fonts)\//.test(path);

/** Erst vom Netz holen und den Speicher auffrischen; ohne Netz (oder zu langsam) die gespeicherte Fassung. */
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  const slow = new Promise((r) => { setTimeout(r, NET_WAIT); });
  try {
    const res = await Promise.race([net, slow.then(() => null)]);
    if (res) return res;
  } catch { /* offline */ }
  const hit = await cache.match(req, { ignoreSearch: true });
  return hit || net;
}

/** Aus dem Speicher, im Hintergrund nachladen. */
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_/')) return;
  e.respondWith(isAsset(url.pathname) ? cacheFirst(e.request) : networkFirst(e.request));
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
