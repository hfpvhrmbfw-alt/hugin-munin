import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const src = readFileSync(new URL('sw.js', root), 'utf8');

// Ein Tippfehler im Service Worker hält alle Geräte still auf der alten Version fest. Darum prüfen wir ihn mit.
test('Service Worker: lässt sich lesen, und alle Dateien der App-Hülle gibt es', () => {
  const listeners = {};
  const self = { addEventListener: (type, fn) => { listeners[type] = fn; }, registration: {}, clients: {} };
  const ctx = vm.createContext({ self, location: { origin: 'https://x' }, URL, caches: {}, fetch: () => {}, setTimeout });
  vm.runInContext(`${src}\nself.SHELL = SHELL;`, ctx);
  assert.deepEqual(Object.keys(listeners).sort(), ['activate', 'fetch', 'install', 'notificationclick', 'push']);
  for (const f of self.SHELL.filter((x) => x !== './')) assert.ok(existsSync(new URL(f, root)), `fehlt: ${f}`);
});
