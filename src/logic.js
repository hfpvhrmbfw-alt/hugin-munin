// Logik: reine Funktionen. Daten rein, Daten raus. "Heute" kommt immer als Parameter.
import { SHOPPING_CATEGORIES } from './model.js';

const DAY_MS = 86400000;

// ---- Datum (UTC, ganze Tage) ---------------------------------------------

/** @param {string} iso 'YYYY-MM-DD' @returns {number} Tage seit 1970-01-01 */
export const dayNumber = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY_MS);

/** @param {number} n @returns {string} 'YYYY-MM-DD' */
export const isoFromDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const addDays = (iso, n) => isoFromDay(dayNumber(iso) + n);

/** Wochentag 0 = Montag … 6 = Sonntag */
export const weekday = (iso) => (dayNumber(iso) + 3) % 7;

/** Montag der Woche, in der iso liegt. */
export const weekStart = (iso) => addDays(iso, -weekday(iso));

const ymd = (iso) => iso.split('-').map(Number);
const pad = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12

// ---- Termine und Wiederholungen ------------------------------------------

/**
 * Startdatum des k-ten Vorkommens, oder null, wenn es dieses Datum nicht gibt
 * (z. B. monatlich am 31. im April, jährlich am 29.02. in Nicht-Schaltjahren: wird übersprungen).
 */
function nthStart(event, k) {
  const step = event.repeatInterval * k;
  switch (event.repeat) {
    case 'none': return k === 0 ? event.startDate : null;
    case 'daily': return addDays(event.startDate, step);
    case 'weekly': return addDays(event.startDate, 7 * step);
    case 'monthly': {
      const [y, m, d] = ymd(event.startDate);
      const total = (y * 12 + (m - 1)) + step;
      const ny = Math.floor(total / 12); const nm = (total % 12) + 1;
      return d <= daysInMonth(ny, nm) ? `${ny}-${pad(nm)}-${pad(d)}` : null;
    }
    case 'yearly': {
      const [y, m, d] = ymd(event.startDate);
      const ny = y + step;
      return d <= daysInMonth(ny, m) ? `${ny}-${pad(m)}-${pad(d)}` : null;
    }
    default: return null;
  }
}

/**
 * Vorkommen eines Termins, die den Zeitraum [from, to] (beide inklusive) berühren.
 * @returns {{eventId:string, start:string, end:string, index:number}[]} sortiert nach start
 */
export function occurrences(event, from, to) {
  if (event.deleted) return [];
  const length = dayNumber(event.endDate) - dayNumber(event.startDate);
  const fromN = dayNumber(from); const toN = dayNumber(to);
  const untilN = event.repeatUntil ? dayNumber(event.repeatUntil) : Infinity;
  const out = [];
  // Erstes k grob abschätzen, damit lange Serien nicht von Anfang an durchlaufen werden.
  let k = 0;
  if (event.repeat === 'daily' || event.repeat === 'weekly') {
    const per = event.repeatInterval * (event.repeat === 'weekly' ? 7 : 1);
    k = Math.max(0, Math.floor((fromN - length - dayNumber(event.startDate)) / per));
  } else if (event.repeat === 'monthly' || event.repeat === 'yearly') {
    const per = event.repeatInterval * (event.repeat === 'yearly' ? 366 : 31);
    k = Math.max(0, Math.floor((fromN - length - dayNumber(event.startDate)) / per) - 1);
  }
  for (let guard = 0; guard < 5000; guard++, k++) {
    const start = nthStart(event, k);
    if (start === null) {
      if (event.repeat === 'none') break;
      continue; // übersprungenes Datum (31., 29.02.)
    }
    const s = dayNumber(start);
    if (s > toN || s > untilN) break;
    if (s + length >= fromN) out.push({ eventId: event.id, start, end: isoFromDay(s + length), index: k });
    if (event.repeat === 'none') break;
  }
  return out;
}

// ---- Listen ----------------------------------------------------------------

export const alive = (records) => records.filter((r) => !r.deleted);

/** Einträge einer Liste, ohne gelöschte. */
export const itemsOf = (items, listId) => items.filter((i) => i.list === listId && !i.deleted);

const bySort = (a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Einkaufsliste nach Kategorie gruppiert (Reihenfolge der Stammdaten), erledigte am Ende.
 * @returns {{open:{category:string, items:object[]}[], done:object[]}}
 */
export function groupShopping(items) {
  const open = items.filter((i) => !i.done && !i.deleted);
  const groups = SHOPPING_CATEGORIES.map((category) => ({
    category,
    items: open.filter((i) => (i.category || 'other') === category).sort(bySort),
  })).filter((g) => g.items.length > 0);
  const done = items.filter((i) => i.done && !i.deleted).sort((a, b) => b.changedAt - a.changedAt || bySort(a, b));
  return { open: groups, done };
}

/** Aufgaben sortiert: offen vor erledigt, wichtig zuerst, nach Fälligkeit (ohne Datum zuletzt), dann Reihenfolge. */
export function sortTasks(items) {
  return [...items].filter((i) => !i.deleted).sort((a, b) =>
    (a.done - b.done)
    || (b.important - a.important)
    || ((a.dueDate === null) - (b.dueDate === null))
    || (a.dueDate && b.dueDate && a.dueDate !== b.dueDate ? (a.dueDate < b.dueDate ? -1 : 1) : 0)
    || bySort(a, b));
}

/** Text einer Schnelleingabe in einzelne Einträge zerlegen ("Milch, 2 Eier\nBrot"). */
export function splitQuickAdd(text) {
  return text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^(\d+(?:[.,]\d+)?\s*(?:x|stk|g|kg|ml|l|pck|dose|bund)?\.?)\s+(.+)$/i);
    return m ? { title: m[2], quantity: m[1].trim() } : { title: s, quantity: null };
  });
}

// ---- Überblick ---------------------------------------------------------------

/**
 * Tagesplan für einen Zeitraum: Terminvorkommen und fällige Aufgaben je Tag.
 * @returns {{date:string, events:{eventId:string,start:string,end:string,index:number}[], tasks:string[]}[]}
 *   nur Tage mit Inhalt, aufsteigend; events nach startTime sortiert (ganztägig zuerst); tasks = Item-IDs
 */
export function agenda(data, from, to) {
  const days = new Map();
  const day = (d) => { if (!days.has(d)) days.set(d, { date: d, events: [], tasks: [] }); return days.get(d); };
  const fromN = dayNumber(from); const toN = dayNumber(to);
  const eventsById = new Map(data.events.map((e) => [e.id, e]));
  for (const ev of alive(data.events)) {
    for (const occ of occurrences(ev, from, to)) {
      const a = Math.max(dayNumber(occ.start), fromN); const b = Math.min(dayNumber(occ.end), toN);
      for (let n = a; n <= b; n++) day(isoFromDay(n)).events.push(occ);
    }
  }
  const taskLists = new Set(data.lists.filter((l) => l.kind === 'tasks' && !l.deleted && !l.archived).map((l) => l.id));
  for (const it of data.items) {
    if (it.deleted || it.done || !it.dueDate || !taskLists.has(it.list)) continue;
    if (it.dueDate >= from && it.dueDate <= to) day(it.dueDate).tasks.push(it.id);
  }
  const t = (o) => eventsById.get(o.eventId).startTime || '';
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((d) => ({
    ...d,
    events: d.events.sort((x, y) => (t(x) < t(y) ? -1 : t(x) > t(y) ? 1 : x.eventId < y.eventId ? -1 : 1)),
  }));
}

/**
 * Daten für die Startseite.
 * @param {string} today 'YYYY-MM-DD'
 * @returns {{today:string, todayPlan:object|null, week:object[], overdue:string[], shoppingOpen:number}}
 */
export function overview(data, today) {
  const weekEnd = addDays(today, 6);
  const plan = agenda(data, today, weekEnd);
  const taskLists = new Set(data.lists.filter((l) => l.kind === 'tasks' && !l.deleted && !l.archived).map((l) => l.id));
  const shopLists = new Set(data.lists.filter((l) => l.kind === 'shopping' && !l.deleted && !l.archived).map((l) => l.id));
  const overdue = sortTasks(data.items.filter((i) => taskLists.has(i.list) && !i.done && i.dueDate && i.dueDate < today))
    .map((i) => i.id);
  return {
    today,
    todayPlan: plan.find((d) => d.date === today) || null,
    week: plan.filter((d) => d.date !== today),
    overdue,
    shoppingOpen: data.items.filter((i) => shopLists.has(i.list) && !i.done && !i.deleted).length,
  };
}

// ---- Abgleich ------------------------------------------------------------------

/**
 * Welche Fassung eines Eintrags gilt? Neuere Änderung gewinnt, bei Gleichstand die größere changedBy-ID,
 * damit beide Geräte dasselbe Ergebnis wählen.
 * @returns {'local'|'remote'}
 */
export function pickWinner(local, remote) {
  if (!local) return 'remote';
  if (!remote) return 'local';
  if (remote.changedAt !== local.changedAt) return remote.changedAt > local.changedAt ? 'remote' : 'local';
  return (remote.changedBy || '') > (local.changedBy || '') ? 'remote' : 'local';
}

/**
 * Server-Einträge in den lokalen Stand einspielen.
 * @param {object[]} localRecords aktueller lokaler Stand einer Sammlung
 * @param {object[]} remoteRecords vom Server geholt (bereits geprüft)
 * @param {Set<string>} pendingIds IDs mit noch nicht hochgeladenen Änderungen
 * @returns {{put:object[], keepPending:string[]}} put = lokal zu speichern;
 *   keepPending = lokale Änderung ist neuer und muss weiter hochgeladen werden
 */
export function mergeRemote(localRecords, remoteRecords, pendingIds) {
  const local = new Map(localRecords.map((r) => [r.id, r]));
  const put = []; const keepPending = [];
  for (const remote of remoteRecords) {
    const mine = local.get(remote.id);
    if (pickWinner(mine, remote) === 'remote') {
      if (!mine || JSON.stringify(mine) !== JSON.stringify(remote)) put.push(remote);
    } else if (pendingIds.has(remote.id)) {
      keepPending.push(remote.id);
    }
  }
  return { put, keepPending };
}

/** Größter Server-Zeitstempel "updated" einer Antwort, als Merker für den nächsten Abruf. */
export function nextCursor(previous, serverRecords) {
  let max = previous || '';
  for (const r of serverRecords) if (typeof r.updated === 'string' && r.updated > max) max = r.updated;
  return max;
}
