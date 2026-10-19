import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dayNumber, isoFromDay, addDays, weekday, weekStart, occurrences, groupShopping, sortTasks,
  splitQuickAdd, agenda, overview, pickWinner, mergeRemote, nextCursor,
} from '../src/logic.js';
import { sanitizeEvent, sanitizeItem, sanitizeList } from '../src/model.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const id = (n) => String(n).padStart(15, 'x').replace(/[^a-z0-9]/g, 'x');

test('Datum: Tage hin und zurück, Wochentag', () => {
  assert.equal(isoFromDay(dayNumber('2026-10-19')), '2026-10-19');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(weekday('2026-10-19'), 0); // Montag
  assert.equal(weekday('2026-10-25'), 6); // Sonntag
  assert.equal(weekStart('2026-10-22'), '2026-10-19');
});

for (const c of fixture('occurrences.json')) {
  test(`Vorkommen: ${c.name}`, () => {
    const ev = sanitizeEvent({ id: 'event0000000001', title: 'x', ...c.event });
    assert.deepEqual(occurrences(ev, c.from, c.to).map((o) => o.start), c.starts);
  });
}

test('Vorkommen: mehrtägiger Termin hat passendes Ende', () => {
  const ev = sanitizeEvent({ id: 'event0000000001', startDate: '2026-10-30', endDate: '2026-11-02', repeat: 'yearly' });
  const [o] = occurrences(ev, '2027-10-01', '2027-10-31');
  assert.deepEqual([o.start, o.end, o.index], ['2027-10-30', '2027-11-02', 1]);
});

test('Aufgaben sortieren', () => {
  const f = fixture('sort-tasks.json');
  const items = f.items.map((i) => sanitizeItem({ ...i, list: 'list00000000001' }));
  assert.deepEqual(sortTasks(items).map((i) => i.id), f.expected);
});

test('Einkauf nach Kategorie in Stammdaten-Reihenfolge, Erledigtes getrennt', () => {
  const mk = (n, category, done = false) => sanitizeItem({ id: id(n), list: 'list00000000001', title: String(n), category, done, sort: n, changedAt: n });
  const g = groupShopping([mk(1, 'dairy'), mk(2, 'produce'), mk(3, null), mk(4, 'dairy', true), mk(5, 'produce')]);
  assert.deepEqual(g.open.map((x) => [x.category, x.items.map((i) => i.title)]), [
    ['produce', ['2', '5']], ['dairy', ['1']], ['other', ['3']],
  ]);
  assert.deepEqual(g.done.map((i) => i.title), ['4']);
});

test('Schnelleingabe zerlegt Zeilen und Mengen', () => {
  assert.deepEqual(splitQuickAdd('Milch, 2 Eier\n500g Mehl;  Brot  \n\n'), [
    { title: 'Milch', quantity: null },
    { title: 'Eier', quantity: '2' },
    { title: 'Mehl', quantity: '500g' },
    { title: 'Brot', quantity: null },
  ]);
});

function sampleData() {
  const lists = [
    sanitizeList({ id: 'listtasks000001', kind: 'tasks', name: 'Haushalt' }),
    sanitizeList({ id: 'listshop0000001', kind: 'shopping', name: 'Einkauf' }),
  ];
  const items = [
    sanitizeItem({ id: 'itemtask0000001', list: 'listtasks000001', title: 'Müll', dueDate: '2026-10-19' }),
    sanitizeItem({ id: 'itemtask0000002', list: 'listtasks000001', title: 'Steuer', dueDate: '2026-10-10' }),
    sanitizeItem({ id: 'itemtask0000003', list: 'listtasks000001', title: 'Fenster', dueDate: '2026-10-23' }),
    sanitizeItem({ id: 'itemtask0000004', list: 'listtasks000001', title: 'erledigt', dueDate: '2026-10-19', done: true }),
    sanitizeItem({ id: 'itemshop0000001', list: 'listshop0000001', title: 'Milch' }),
    sanitizeItem({ id: 'itemshop0000002', list: 'listshop0000001', title: 'Brot', done: true }),
  ];
  const events = [
    sanitizeEvent({ id: 'eventswim000001', title: 'Schwimmen', startDate: '2026-10-07', startTime: '18:00', repeat: 'weekly' }),
    sanitizeEvent({ id: 'eventtrip000001', title: 'Urlaub', startDate: '2026-10-24', endDate: '2026-10-27' }),
    sanitizeEvent({ id: 'eventdent000001', title: 'Zahnarzt', startDate: '2026-10-21', startTime: '08:00' }),
  ];
  return { lists, items, events };
}

test('Tagesplan: mehrtägige Termine an jedem Tag, Aufgaben am Fälligkeitstag', () => {
  const a = agenda(sampleData(), '2026-10-19', '2026-10-25');
  assert.deepEqual(a.map((d) => [d.date, d.events.map((e) => e.eventId), d.tasks]), [
    ['2026-10-19', [], ['itemtask0000001']],
    ['2026-10-21', ['eventdent000001', 'eventswim000001'], []],
    ['2026-10-23', [], ['itemtask0000003']],
    ['2026-10-24', ['eventtrip000001'], []],
    ['2026-10-25', ['eventtrip000001'], []],
  ]);
});

test('Überblick: heute, Woche, überfällig, offener Einkauf', () => {
  const o = overview(sampleData(), '2026-10-19');
  assert.deepEqual(o.todayPlan.tasks, ['itemtask0000001']);
  assert.deepEqual(o.overdue, ['itemtask0000002']);
  assert.equal(o.shoppingOpen, 1);
  assert.deepEqual(o.week.map((d) => d.date), ['2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25']);
});

test('Abgleich: neuere Änderung gewinnt, Gleichstand ist eindeutig', () => {
  const a = { changedAt: 5, changedBy: 'aaaaaaaaaaaaaaa' };
  const b = { changedAt: 5, changedBy: 'bbbbbbbbbbbbbbb' };
  assert.equal(pickWinner({ changedAt: 1 }, { changedAt: 2 }), 'remote');
  assert.equal(pickWinner({ changedAt: 3 }, { changedAt: 2 }), 'local');
  assert.equal(pickWinner(a, b), 'remote');
  assert.equal(pickWinner(b, a), 'local');
  assert.equal(pickWinner(null, a), 'remote');
});

test('Abgleich: mergeRemote übernimmt Neueres und behält eigene neuere Änderungen', () => {
  const L = (idx, changedAt, title) => sanitizeItem({ id: id(idx), list: 'list00000000001', title, changedAt });
  const local = [L(1, 10, 'alt'), L(2, 30, 'meins neuer'), L(3, 5, 'gleich')];
  const remote = [L(1, 20, 'neu vom Partner'), L(2, 25, 'Partner älter'), L(3, 5, 'gleich'), L(4, 1, 'ganz neu')];
  const r = mergeRemote(local, remote, new Set([id(2)]));
  assert.deepEqual(r.put.map((x) => x.title), ['neu vom Partner', 'ganz neu']);
  assert.deepEqual(r.keepPending, [id(2)]);
  // zweimal angewendet: nichts mehr zu tun
  const again = mergeRemote([remote[0], local[1], local[2], remote[3]], remote, new Set([id(2)]));
  assert.deepEqual(again.put, []);
});

test('Abgleich: Merker wandert nur vorwärts', () => {
  assert.equal(nextCursor('', [{ updated: '2026-10-19 10:00:00.000Z' }, { updated: '2026-10-19 09:00:00.000Z' }]), '2026-10-19 10:00:00.000Z');
  assert.equal(nextCursor('2026-10-20 00:00:00.000Z', [{ updated: '2026-10-19 10:00:00.000Z' }]), '2026-10-20 00:00:00.000Z');
});
