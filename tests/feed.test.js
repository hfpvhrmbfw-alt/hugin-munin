import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseIcs } from '../src/logic.js';

const { buildIcs } = createRequire(import.meta.url)('../server/pb_hooks/feed.cjs');
const ev = (o) => ({ id: 'e' + Math.random().toString(36).slice(2, 8), changedAt: 1, title: 'T', notes: '', startDate: '2026-11-03', endDate: '2026-11-03', startTime: '', endTime: '', repeat: 'none', repeatInterval: 1, repeatUntil: '', people: [], ...o });

test('kalender-abo: termine kommen über die eigene ics-logik unverändert zurück', () => {
  const events = [
    ev({ title: 'Ferien', startDate: '2026-11-02', endDate: '2026-11-06' }),
    ev({ title: 'Schwimmen', startTime: '17:00', endTime: '18:00', repeat: 'weekly', repeatInterval: 2, repeatUntil: '2026-12-31' }),
    ev({ title: 'Spät', startTime: '23:30' }),
    ev({ title: 'Alt', startDate: '2020-01-01', endDate: '2020-01-01' }),
    ev({ title: 'Gelöscht', deleted: true }),
  ];
  const text = buildIcs(events, { name: 'Wir', from: '2026-01-01' });
  assert.ok(text.endsWith('\r\n'));
  const got = parseIcs(text, 'f', 'Europe/Berlin', '2026-01-01').map((e) => [e.title, e.startDate, e.endDate, e.startTime, e.endTime, e.repeat, e.repeatInterval, e.repeatUntil]);
  assert.deepEqual(got, [
    ['Ferien', '2026-11-02', '2026-11-06', null, null, 'none', 1, null],
    ['Schwimmen', '2026-11-03', '2026-11-03', '17:00', '18:00', 'weekly', 2, '2026-12-31'],
    ['Spät', '2026-11-03', '2026-11-04', '23:30', '00:30', 'none', 1, null],
  ]);
});

test('kalender-abo: personen, maskierung und gefaltete zeilen', () => {
  const text = buildIcs([ev({ title: 'Elternabend; Raum 3, oben', notes: 'Zettel mitbringen\n'.repeat(8), people: ['u1', 'u2'] })], { name: 'Wir', people: { u1: 'Anna', u2: 'Björn' } });
  const flat = text.replace(/\r\n /g, '');
  assert.match(flat, /SUMMARY:Elternabend\\; Raum 3\\, oben/);
  assert.match(flat, /DESCRIPTION:wer: Anna\\, Björn\\nZettel/);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
});
