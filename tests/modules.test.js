import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  tabLayout, serverAddress, addressFields, choreState, balances, settleUp, parseAmount, monthTotal,
  nextBirthday, upcomingBirthdays, parseDayMonth, mealWeek, fromTemplate, visibleGifts, pinnedNotes, addMonths,
} from '../src/logic.js';
import {
  sanitizeChore, sanitizeExpense, sanitizeContact, sanitizeMeal, sanitizeGift, sanitizeNote, sanitizeItem, sanitizeSettings,
  parseImport, buildExport, upgradeRaw, SCHEMA_VERSION, MODULES, TAB_MODULES, STORAGE_MODES, COLLECTIONS, MEAL_SLOTS, CHORE_UNITS, GIFT_STATUS,
} from '../src/model.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const id = (n) => String(n).padStart(15, '0');

test('Stammdaten der Module sind eindeutig', () => {
  for (const list of [MODULES, STORAGE_MODES, COLLECTIONS, MEAL_SLOTS, CHORE_UNITS, GIFT_STATUS]) assert.equal(new Set(list).size, list.length);
  assert.ok(!TAB_MODULES.includes('board'));
});

test('Tabs: Heute, drei Module, Mehr; der Rest steht unter Mehr', () => {
  assert.deepEqual(tabLayout(['shopping', 'tasks', 'calendar']), { bar: ['today', 'shopping', 'tasks', 'calendar', 'more'], more: [] });
  assert.deepEqual(tabLayout(['notes', 'board', 'shopping', 'meals', 'gifts']), { bar: ['today', 'shopping', 'meals', 'notes', 'more'], more: ['gifts'] });
  assert.deepEqual(tabLayout([]), { bar: ['today', 'more'], more: [] });
});

test('Einstellungen: Module und Speicherort', () => {
  assert.deepEqual(sanitizeSettings({ modules: ['notes', 'quatsch', 'shopping', 'notes'] }).modules, ['shopping', 'notes']);
  assert.deepEqual(sanitizeSettings({ modules: [] }).modules, []);
  // Version 1 hatte noch keinen Speicherort
  assert.equal(sanitizeSettings({ serverUrl: 'https://macmini.tail1.ts.net' }).storage, 'tailscale');
  assert.equal(sanitizeSettings({ serverUrl: 'https://planer.example.de' }).storage, 'domain');
  assert.equal(sanitizeSettings({}).storage, 'local');
  // Frühere Wege (wireguard, heimnetz, gemietet) werden zu „andere adresse“, die Adresse bleibt.
  assert.deepEqual(sanitizeSettings({ storage: 'wireguard', serverUrl: 'http://10.0.0.2:8090' }), { ...sanitizeSettings({}), storage: 'domain', serverUrl: 'http://10.0.0.2:8090' });
  assert.equal(sanitizeSettings({ storage: 'hosted', serverUrl: 'https://x.pockethost.io' }).storage, 'domain');
});

test('Serveradresse je Speicherort', () => {
  assert.deepEqual(serverAddress('tailscale', { host: 'MacMini', tailnet: 'tail1234.ts.net' }), { ok: true, url: 'https://macmini.tail1234.ts.net' });
  assert.deepEqual(serverAddress('tailscale', { host: 'macmini', tailnet: 'tail1234' }), { ok: true, url: 'https://macmini.tail1234.ts.net' });
  assert.deepEqual(serverAddress('tailscale', { host: 'https://macmini.tail1234.ts.net/' }), { ok: true, url: 'https://macmini.tail1234.ts.net' });
  assert.deepEqual(serverAddress('tailscale', { host: 'macmini' }), { ok: false, error: 'missing_host' });
  assert.deepEqual(serverAddress('domain', { url: 'https://Planer.Example.de/' }), { ok: true, url: 'https://planer.example.de' });
  assert.deepEqual(serverAddress('domain', { url: 'http://planer.example.de' }), { ok: false, error: 'need_https' });
  assert.deepEqual(serverAddress('domain', { url: 'kein link' }), { ok: false, error: 'bad_url' });
  assert.deepEqual(serverAddress('domain', { url: 'http://127.0.0.1:8090' }), { ok: true, url: 'http://127.0.0.1:8090' });
  assert.deepEqual(serverAddress('local', {}), { ok: true, url: '' });
});

test('Serveradresse wieder in Felder zerlegen', () => {
  assert.deepEqual(addressFields('tailscale', 'https://macmini.tail1234.ts.net'), { host: 'macmini', tailnet: 'tail1234.ts.net', url: 'https://macmini.tail1234.ts.net' });
  assert.equal(addressFields('domain', 'https://planer.example.de').url, 'https://planer.example.de');
  const url = serverAddress('tailscale', { host: 'a', tailnet: 'b.ts.net' }).url;
  assert.equal(serverAddress('tailscale', addressFields('tailscale', url)).url, url);
});

for (const c of fixture('chores.json')) {
  test(`Haushaltsplan: ${c.name}`, () => {
    const chore = sanitizeChore({ id: id(1), title: 'Bad', ...c.chore });
    assert.deepEqual(choreState(chore, c.today), { choreId: id(1), ...c.expected });
  });
}

test('Monate addieren bleibt im Monat', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
});

for (const c of fixture('balances.json')) {
  test(`Ausgaben: ${c.name}`, () => {
    const exps = c.expenses.map((e, i) => sanitizeExpense({ id: id(i + 1), date: '2026-10-21', title: 'x', ...e }));
    const b = balances(exps, c.people);
    assert.deepEqual(b, c.balances);
    assert.equal(b.reduce((s, x) => s + x.cents, 0), 0);
    assert.deepEqual(settleUp(b), c.transfers);
  });
}

test('Beträge eingeben', () => {
  assert.equal(parseAmount('12,50'), 1250);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('1.234,56 €'), 123456);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('1,234'), null);
  const exps = [{ kind: 'expense', amount: 500, date: '2026-10-01' }, { kind: 'settle', amount: 900, date: '2026-10-02' }, { kind: 'expense', amount: 100, date: '2026-09-30' }]
    .map((e, i) => sanitizeExpense({ id: id(i + 1), paidBy: id(9), ...e }));
  assert.equal(monthTotal(exps, '2026-10'), 500);
});

test('Ausgleich hat genau eine Empfängerin', () => {
  const e = sanitizeExpense({ id: id(1), kind: 'settle', amount: 100, date: '2026-10-21', people: [id(2), id(3)] });
  assert.deepEqual(e.people, [id(2)]);
  assert.equal(sanitizeExpense({ id: id(1), amount: 100 }), null);
});

test('Geburtstage: nächster Termin, Alter, 29. Februar', () => {
  const c = (birthday, birthYear) => sanitizeContact({ id: id(1), name: 'Oma', birthday, birthYear });
  assert.deepEqual(nextBirthday(c('10-21', 1950), '2026-10-21'), { contactId: id(1), date: '2026-10-21', inDays: 0, age: 76 });
  assert.deepEqual(nextBirthday(c('10-20', null), '2026-10-21'), { contactId: id(1), date: '2027-10-20', inDays: 364, age: null });
  assert.equal(nextBirthday(c('02-29', 2000), '2027-01-01').date, '2027-02-28');
  assert.equal(nextBirthday(c('02-29', 2000), '2028-01-01').date, '2028-02-29');
  assert.equal(c('02-30', 2000).birthday, null);
  assert.equal(c('02-29', 2001).birthYear, null);
  const list = [sanitizeContact({ id: id(1), birthday: '11-01' }), sanitizeContact({ id: id(2), birthday: '10-25' }), sanitizeContact({ id: id(3), birthday: '12-24' })];
  assert.deepEqual(upcomingBirthdays(list, '2026-10-21', 14).map((b) => b.contactId), [id(2), id(1)]);
});

test('Essensplan: sieben Tage, Mahlzeiten in fester Reihenfolge', () => {
  const meals = [
    sanitizeMeal({ id: id(1), date: '2026-10-20', slot: 'dinner', title: 'Suppe' }),
    sanitizeMeal({ id: id(2), date: '2026-10-20', slot: 'lunch', title: 'Brot' }),
    sanitizeMeal({ id: id(3), date: '2026-10-27', slot: 'lunch', title: 'nächste Woche' }),
    sanitizeMeal({ id: id(4), date: '2026-10-21', slot: 'quatsch', title: 'x', deleted: true }),
  ];
  const w = mealWeek(meals, '2026-10-19');
  assert.equal(w.length, 7);
  assert.deepEqual(w[1], { date: '2026-10-20', meals: [id(2), id(1)] });
  assert.deepEqual(w[2].meals, []);
  assert.equal(meals[3].slot, 'dinner');
});

test('Vorlage übernimmt nur, was noch nicht offen auf der Liste steht', () => {
  const t = [sanitizeItem({ id: id(1), list: id(9), title: 'Milch', sort: 2 }), sanitizeItem({ id: id(2), list: id(9), title: 'Brot', quantity: '1', sort: 1 })];
  const target = [sanitizeItem({ id: id(3), list: id(8), title: 'milch' })];
  assert.deepEqual(fromTemplate(t, target).map((x) => x.title), ['Brot']);
  assert.deepEqual(fromTemplate(t, [{ ...target[0], done: true }]).map((x) => x.title), ['Brot', 'Milch']);
});

test('Private Geschenkideen sieht nur, wer sie angelegt hat', () => {
  const g = [sanitizeGift({ id: id(1), title: 'Uhr', private: true, owner: id(7) }), sanitizeGift({ id: id(2), title: 'Buch', owner: id(8) })];
  assert.deepEqual(visibleGifts(g, id(8)).map((x) => x.id), [id(2)]);
  assert.deepEqual(visibleGifts(g, id(7)).map((x) => x.id), [id(1), id(2)]);
  assert.equal(sanitizeGift({ id: id(1), link: 'javascript:alert(1)' }).link, null);
});

test('Pinnwand: angeheftete Notizen, neueste zuerst', () => {
  const n = [sanitizeNote({ id: id(1), pinned: true, changedAt: 1 }), sanitizeNote({ id: id(2), pinned: true, changedAt: 5 }), sanitizeNote({ id: id(3), changedAt: 9 })];
  assert.deepEqual(pinnedNotes(n).map((x) => x.id), [id(2), id(1)]);
});

test('Sicherung aus Version 1 lässt sich in Version 2 laden', () => {
  const r = parseImport(readFileSync(new URL('./fixtures/export-v1.json', import.meta.url), 'utf8'));
  assert.equal(r.ok, true);
  for (const c of COLLECTIONS) assert.ok(Array.isArray(r.data[c]), c);
  assert.deepEqual(r.data.notes, []);
  assert.deepEqual(r.settings.modules, ['shopping', 'tasks', 'calendar']);
  const raw = { app: 'hugin-munin', version: 1, lists: [] };
  assert.deepEqual(upgradeRaw(upgradeRaw(raw)), upgradeRaw(raw));
  assert.equal(upgradeRaw(raw).version, SCHEMA_VERSION);
});

test('Export enthält alle Sammlungen und kommt gleich zurück', () => {
  const data = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  data.notes = [sanitizeNote({ id: id(1), title: 'Wlan', body: 'Passwort am Router' })];
  data.chores = [sanitizeChore({ id: id(2), title: 'Bad', startDate: '2026-10-19', people: [id(5), id(6)] })];
  const back = parseImport(JSON.stringify(buildExport(data, { modules: ['notes'] }, '2026-10-21T00:00:00Z')));
  assert.deepEqual(back.data, data);
  assert.deepEqual(back.settings.modules, ['notes']);
});

test('Geburtstag eingeben', () => {
  assert.equal(parseDayMonth('24.12.'), '12-24');
  assert.equal(parseDayMonth('1.2'), '02-01');
  assert.equal(parseDayMonth('29.02.'), '02-29');
  assert.equal(parseDayMonth('31.04.'), null);
  assert.equal(parseDayMonth('Weihnachten'), null);
});
