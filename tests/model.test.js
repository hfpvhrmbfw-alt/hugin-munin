import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makeId, isId, isIsoDate, sanitizeEvent, sanitizeItem, sanitizeSettings, newItem, change,
  buildExport, parseImport, upgradeRaw, SCHEMA_VERSION, SHOPPING_CATEGORIES, REPEATS, LIST_KINDS, COLORS,
} from '../src/model.js';

const fixtureText = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('IDs im PocketBase-Format', () => {
  const idv = makeId(Uint8Array.from({ length: 15 }, (_, i) => i * 17));
  assert.ok(isId(idv), idv);
  assert.equal(idv.length, 15);
});

test('Stammdaten-IDs sind eindeutig', () => {
  for (const list of [SHOPPING_CATEGORIES, REPEATS, LIST_KINDS, COLORS]) assert.equal(new Set(list).size, list.length);
  assert.equal(SHOPPING_CATEGORIES.at(-1), 'other');
});

test('Datumsprüfung lehnt unmögliche Tage ab', () => {
  assert.ok(isIsoDate('2028-02-29'));
  assert.ok(!isIsoDate('2026-02-29'));
  assert.ok(!isIsoDate('2026-13-01'));
  assert.ok(!isIsoDate('19.10.2026'));
});

test('Termin wird bereinigt: Ende nicht vor Beginn, Endzeit nicht vor Startzeit', () => {
  const e = sanitizeEvent({ id: 'event0000000001', title: ' Zahnarzt ', startDate: '2026-10-22', endDate: '2026-10-01', startTime: '09:30', endTime: '08:00', repeat: 'nie' });
  assert.equal(e.title, 'Zahnarzt');
  assert.equal(e.endDate, '2026-10-22');
  assert.equal(e.endTime, null);
  assert.equal(e.repeat, 'none');
  assert.equal(sanitizeEvent({ id: 'event0000000001', startDate: 'morgen' }), null);
});

test('PocketBase-Leerwerte werden zu null', () => {
  const i = sanitizeItem({ id: 'item00000000001', list: 'list00000000001', title: 'x', note: '', dueDate: '', assignee: '', category: '' });
  assert.deepEqual([i.note, i.dueDate, i.assignee, i.category], [null, null, null, null]);
});

test('Änderung erhöht changedAt immer', () => {
  const ctx = { id: 'item00000000001', household: 'house0000000001', now: 1000, user: 'user00000000001' };
  const a = newItem(ctx, 'list00000000001', 'Milch');
  const b = change('items', a, { done: true }, 500, 'user00000000002'); // Uhr des anderen Geräts geht nach
  assert.equal(b.changedAt, 1001);
  assert.equal(b.changedBy, 'user00000000002');
  assert.equal(b.done, true);
});

test('Einstellungen: unbekannte Werte fallen auf Standard', () => {
  assert.deepEqual(sanitizeSettings({ theme: 'pink', serverUrl: 'ftp://x' }), { theme: 'system', serverUrl: '', storage: 'local', modules: ['shopping', 'tasks', 'calendar'] });
  assert.equal(sanitizeSettings({ serverUrl: 'https://mac.ts.net///' }).serverUrl, 'https://mac.ts.net');
});

test('Import einer Sicherung: gültige Einträge, kaputte übersprungen', () => {
  const r = parseImport(fixtureText('export-v1.json'));
  assert.equal(r.ok, true);
  assert.equal(r.data.items.length, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.data.events[0].endTime, null);
  assert.equal(r.settings.serverUrl, 'https://macmini.example.ts.net');
});

test('Import lehnt Fremdes, Kaputtes und Neueres ab', () => {
  assert.deepEqual(parseImport('{nope'), { ok: false, error: 'not_json' });
  assert.deepEqual(parseImport('[]'), { ok: false, error: 'bad_format' });
  assert.deepEqual(parseImport('{"app":"andere"}'), { ok: false, error: 'wrong_app' });
  assert.deepEqual(parseImport(JSON.stringify({ app: 'hugin-munin', version: SCHEMA_VERSION + 1 })), { ok: false, error: 'too_new' });
  assert.deepEqual(parseImport(JSON.stringify({ app: 'hugin-munin', version: 1, items: 'x' })), { ok: false, error: 'bad_format' });
});

test('Export und Import ergeben denselben Stand, Gelöschtes fehlt im Export', () => {
  const r = parseImport(fixtureText('export-v1.json'));
  const gone = { ...r.data.items[0], id: 'item00000000002', deleted: true };
  const exp = buildExport({ ...r.data, items: [...r.data.items, gone] }, r.settings, '2026-10-19T13:00:00.000Z');
  assert.equal(exp.items.length, 1);
  const back = parseImport(JSON.stringify(exp));
  assert.deepEqual(back.data, r.data);
});

test('Migration ist idempotent', () => {
  const raw = { app: 'hugin-munin', items: [] };
  assert.deepEqual(upgradeRaw(upgradeRaw(raw)), upgradeRaw(raw));
});
