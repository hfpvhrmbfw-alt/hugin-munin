import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, icsName, occurrences, search, shoppingHistory, fold } from '../src/logic.js';
import { sanitizeItem, sanitizeList, sanitizeNote, sanitizeContact, sanitizeCalendar } from '../src/model.js';

const ics = (...events) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const Z = 'Europe/Berlin';

test('ICS: ganztägig, Ende exklusiv, Text entschärft', () => {
  const [e] = parseIcs(ics(['UID:a', 'SUMMARY:Herbstferien\\, Bayern', 'DTSTART;VALUE=DATE:20261102', 'DTEND;VALUE=DATE:20261107']), 'f', Z, '2026-01-01');
  assert.deepEqual([e.title, e.startDate, e.endDate, e.startTime, e.repeat, e.feed], ['Herbstferien, Bayern', '2026-11-02', '2026-11-06', null, 'none', 'f']);
});

test('ICS: UTC und TZID werden Ortszeit, auch über die Zeitumstellung', () => {
  const [a, b, c] = parseIcs(ics(
    ['UID:a', 'SUMMARY:Sommer', 'DTSTART:20260715T080000Z', 'DTEND:20260715T093000Z'],
    ['UID:b', 'SUMMARY:Winter', 'DTSTART:20261215T080000Z', 'DURATION:PT45M'],
    ['UID:c', 'SUMMARY:New York', 'DTSTART;TZID=America/New_York:20261020T090000', 'DTEND;TZID=America/New_York:20261020T100000'],
  ), 'f', Z, '2026-01-01');
  assert.deepEqual([a.startTime, a.endTime], ['10:00', '11:30']);
  assert.deepEqual([b.startTime, b.endTime], ['09:00', '09:45']);
  assert.deepEqual([c.startDate, c.startTime, c.endTime], ['2026-10-20', '15:00', '16:00']);
});

test('ICS: gefaltete Zeilen, VALARM wird übersprungen, abgesagte fallen weg', () => {
  const evs = parseIcs(ics(
    ['UID:a', 'SUMMARY:Elternabend in der', ' Schule', 'DTSTART:20261021T180000', 'BEGIN:VALARM', 'SUMMARY:Erinnerung', 'END:VALARM'],
    ['UID:b', 'SUMMARY:Fällt aus', 'STATUS:CANCELLED', 'DTSTART:20261022T180000'],
  ), 'f', Z, '2026-01-01');
  assert.equal(evs.length, 1);
  assert.equal(evs[0].title, 'Elternabend in derSchule'); // Fortsetzungszeile: genau ein Leerzeichen fällt weg
  assert.equal(evs[0].startTime, '18:00');
});

test('ICS: wöchentlich an mehreren Tagen mit Ende, Ausfall und geändertem Termin', () => {
  const evs = parseIcs(ics(
    ['UID:s', 'SUMMARY:Training', 'DTSTART;TZID=Europe/Berlin:20261020T170000', 'DTEND;TZID=Europe/Berlin:20261020T183000',
      'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261105T225959Z', 'EXDATE;TZID=Europe/Berlin:20261022T170000'],
    ['UID:s', 'RECURRENCE-ID;TZID=Europe/Berlin:20261027T170000', 'SUMMARY:Training (Halle 2)', 'DTSTART;TZID=Europe/Berlin:20261027T180000'],
  ), 'f', Z, '2026-01-01');
  const dates = evs.flatMap((e) => occurrences(e, '2026-10-01', '2026-12-31').map((o) => `${o.start} ${e.startTime} ${e.title}`)).sort();
  assert.deepEqual(dates, [
    '2026-10-20 17:00 Training', '2026-10-27 18:00 Training (Halle 2)', '2026-10-29 17:00 Training', '2026-11-03 17:00 Training', '2026-11-05 17:00 Training',
  ]);
});

test('ICS: werktags täglich, Anzahl, jährlich; Altes fällt weg', () => {
  const evs = parseIcs(ics(
    ['UID:w', 'SUMMARY:Kita', 'DTSTART;VALUE=DATE:20261019', 'RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=5'],
    ['UID:y', 'SUMMARY:Hochzeitstag', 'DTSTART;VALUE=DATE:20200612', 'RRULE:FREQ=YEARLY'],
    ['UID:o', 'SUMMARY:Alt', 'DTSTART;VALUE=DATE:20200101'],
    ['UID:m', 'SUMMARY:2. Dienstag', 'DTSTART;VALUE=DATE:20261013', 'RRULE:FREQ=MONTHLY;BYDAY=2TU'],
  ), 'f', Z, '2026-01-01');
  const kita = evs.filter((e) => e.title === 'Kita').flatMap((e) => occurrences(e, '2026-10-01', '2026-12-31').map((o) => o.start)).sort();
  assert.deepEqual(kita, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  const y = evs.find((e) => e.title === 'Hochzeitstag');
  assert.deepEqual(occurrences(y, '2027-01-01', '2027-12-31').map((o) => o.start), ['2027-06-12']);
  assert.equal(evs.some((e) => e.title === 'Alt'), false);
  assert.equal(evs.find((e) => e.title === '2. Dienstag').repeat, 'none');
});

test('ICS: Unsinn ergibt keine Termine', () => {
  assert.deepEqual(parseIcs('<html>Fehler</html>', 'f', Z, '2026-01-01'), []);
});

const id = (s) => s.padEnd(15, '0');
test('Suche: über Bereiche, ohne Akzente, Erledigtes hinten', () => {
  const lists = [sanitizeList({ id: id('shop'), kind: 'shopping', name: 'Einkauf' }), sanitizeList({ id: id('tmpl'), kind: 'template', name: 'Vorlage' })];
  const items = [
    sanitizeItem({ id: id('i1'), list: id('shop'), title: 'Äpfel', done: true }),
    sanitizeItem({ id: id('i2'), list: id('shop'), title: 'Apfelsaft' }),
    sanitizeItem({ id: id('i3'), list: id('tmpl'), title: 'Apfel aus Vorlage' }),
  ];
  const notes = [sanitizeNote({ id: id('n1'), title: 'WLAN', body: 'Kennwort apfelbaum' })];
  const contacts = [sanitizeContact({ id: id('c1'), name: 'Oma', note: 'mag Apfelkuchen' })];
  const r = search({ lists, items, notes, contacts, events: [], gifts: [], meals: [], expenses: [], chores: [] }, 'apfel');
  assert.deepEqual(r.map((x) => [x.area, x.title]), [['shopping', 'Apfelsaft'], ['contacts', 'Oma'], ['notes', 'WLAN'], ['shopping', 'Äpfel']]);
  assert.deepEqual(search({ lists, items, notes, contacts }, 'a'), []);
  assert.equal(fold('Größe'), 'große');
});

test('Einkauf: Vorschläge nach Häufigkeit, letzter Bereich gilt', () => {
  const shop = new Set([id('shop')]);
  const mk = (n, title, category, at) => sanitizeItem({ id: id('i' + n), list: id('shop'), title, category, changedAt: at, deleted: n === 3 });
  const h = shoppingHistory([mk(1, 'Milch', 'dairy', 1), mk(2, 'milch', 'drinks', 5), mk(3, 'Brot', 'bakery', 9), mk(4, 'Milch', null, 7),
    sanitizeItem({ id: id('x'), list: id('other'), title: 'Bohrer' })], shop);
  assert.deepEqual(h.titles, ['Milch', 'Brot']);
  assert.equal(h.category.get('milch'), 'drinks');
  assert.equal(h.category.get('brot'), 'bakery');
});

test('Fremder Kalender: webcal wird https, Unsinn wird leer', () => {
  assert.equal(sanitizeCalendar({ id: id('c'), title: 'Ferien', url: 'webcal://example.de/f.ics' }).url, 'https://example.de/f.ics');
  assert.equal(sanitizeCalendar({ id: id('c'), url: 'javascript:alert(1)' }).url, '');
  assert.equal(sanitizeCalendar({ id: 'kurz' }), null);
});

test('apple-kalender (icloud-freigabe): name, zeitzone, serie', () => {
  const text = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Apple Inc.//iCloud Calendar Server//EN', 'X-WR-CALNAME:Familie', 'X-APPLE-CALENDAR-COLOR:#34AADC',
    'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'BEGIN:DAYLIGHT', 'DTSTART:19810329T020000', 'TZNAME:MESZ', 'END:DAYLIGHT', 'END:VTIMEZONE',
    'BEGIN:VEVENT', 'UID:x@icloud', 'DTSTART;TZID=Europe/Berlin:20261103T170000', 'DTEND;TZID=Europe/Berlin:20261103T180000',
    'RRULE:FREQ=WEEKLY;BYDAY=TU', 'SUMMARY:Schwimmen', 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  assert.equal(icsName(text), 'Familie');
  const [e] = parseIcs(text, 'f', 'Europe/Berlin', '2026-01-01');
  assert.deepEqual([e.title, e.startDate, e.startTime, e.endTime, e.repeat], ['Schwimmen', '2026-11-03', '17:00', '18:00', 'weekly']);
  assert.equal(icsName(ics(['UID:a', 'X-WR-CALNAME:Falsch', 'DTSTART:20261103'])), '');
  assert.equal(sanitizeCalendar({ id: 'abcdefghijklmno', url: 'webcal://p52-caldav.icloud.com/published/2/MTIz' }).url, 'https://p52-caldav.icloud.com/published/2/MTIz');
});
