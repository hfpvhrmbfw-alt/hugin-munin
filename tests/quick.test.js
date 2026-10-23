import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickWhen } from '../src/logic.js';

const T = '2026-10-23'; // Freitag
const q = (s) => parseQuickWhen(s, T);

test('Schnelleingabe: Tag', () => {
  assert.deepEqual(q('Elternabend morgen 19 Uhr'), { title: 'Elternabend', date: '2026-10-24', startTime: '19:00', endTime: null });
  assert.equal(q('Müll übermorgen').date, '2026-10-25');
  assert.equal(q('heute Fenster putzen').date, T);
  assert.equal(q('Zahnarzt am Dienstag').date, '2026-10-27');
  assert.equal(q('Sport freitag').date, T); // heute zählt
  assert.equal(q('Kino 24.12.').date, '2026-12-24');
  assert.equal(q('Treffen 3.1.').date, '2027-01-03'); // schon vorbei → nächstes Jahr
  assert.equal(q('Fest 1.5.2027').date, '2027-05-01');
  assert.equal(q('Quatsch 31.2.').date, null);
});

test('Schnelleingabe: Uhrzeit', () => {
  assert.deepEqual(q('Zahnarzt am Freitag um 8:30'), { title: 'Zahnarzt', date: T, startTime: '08:30', endTime: null });
  assert.deepEqual(q('Kino 24.12. 20-22 Uhr'), { title: 'Kino', date: '2026-12-24', startTime: '20:00', endTime: '22:00' });
  assert.deepEqual(q('Elternabend 19:00–20:30'), { title: 'Elternabend', date: null, startTime: '19:00', endTime: '20:30' });
  assert.equal(q('Treffen um 9').startTime, '09:00');
  assert.equal(q('Treffen 9.30 Uhr').startTime, '09:30');
});

test('Schnelleingabe: Zahlen ohne Zeitbezug bleiben im Titel', () => {
  assert.deepEqual(q('2 Pakete abholen'), { title: '2 Pakete abholen', date: null, startTime: null, endTime: null });
  assert.equal(q('Kapitel 3-4 lesen').title, 'Kapitel 3-4 lesen');
  assert.equal(q('Termin um 25 Uhr').startTime, null);
  assert.equal(q('Montagsmaler spielen').date, null);
});
