// Logik: reine Funktionen. Daten rein, Daten raus. "Heute" kommt immer als Parameter.
import { SHOPPING_CATEGORIES, MEAL_SLOTS, TAB_MODULES, DEFAULT_PORT } from './model.js';

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

// ---- Module und Tabs ------------------------------------------------------------

/**
 * Welche Tabs unten stehen und welche unter "Mehr" landen. Heute und Mehr stehen immer da.
 * @param {string[]} modules eingeschaltete Module (Reihenfolge aus MODULES)
 * @param {number} slots Plätze zwischen Heute und Mehr
 * @returns {{bar:string[], more:string[]}}
 */
export function tabLayout(modules, slots = 3) {
  const tabs = TAB_MODULES.filter((m) => modules.includes(m));
  return { bar: ['today', ...tabs.slice(0, slots), 'more'], more: tabs.slice(slots) };
}

// ---- Serveradresse -----------------------------------------------------------------

const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/**
 * Adresse aus den Feldern der Einrichtung bauen.
 *   tailscale: host (Gerätename) + tailnet (z. B. tail1234.ts.net) → https://host.tailnet
 *              Steht im Gerätenamen schon eine ganze Adresse, gilt sie.
 *   wireguard, lan: host (IP oder Name) + port → http://host:port
 *   domain, hosted: url, nur https
 * @param {string} mode aus STORAGE_MODES
 * @param {{host?:string, tailnet?:string, port?:string|number, url?:string}} f
 * @returns {{ok:true, url:string} | {ok:false, error:'missing_host'|'bad_host'|'bad_port'|'need_https'|'bad_url'}}
 */
export function serverAddress(mode, f) {
  const t = (v) => String(v ?? '').trim();
  if (mode === 'local') return { ok: true, url: '' };
  if (mode === 'tailscale') {
    let host = t(f.host).replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    const tailnet = t(f.tailnet).replace(/^\.+/, '').replace(/\/+$/, '').toLowerCase();
    if (!host) return { ok: false, error: 'missing_host' };
    if (!host.endsWith('.ts.net')) {
      if (!tailnet) return { ok: false, error: 'missing_host' };
      host = `${host}.${tailnet.endsWith('.ts.net') ? tailnet : tailnet + '.ts.net'}`;
    }
    return HOST_RE.test(host) ? { ok: true, url: `https://${host}` } : { ok: false, error: 'bad_host' };
  }
  if (mode === 'wireguard' || mode === 'lan') {
    const host = t(f.host).replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    const portText = t(f.port) || String(DEFAULT_PORT);
    if (!host) return { ok: false, error: 'missing_host' };
    if (!HOST_RE.test(host)) return { ok: false, error: 'bad_host' };
    const port = Number(portText);
    if (!/^\d+$/.test(portText) || port < 1 || port > 65535) return { ok: false, error: 'bad_port' };
    return { ok: true, url: `http://${host}${port === 80 ? '' : `:${port}`}` };
  }
  const url = t(f.url).replace(/\/+$/, '');
  if (!url) return { ok: false, error: 'missing_host' };
  const m = url.match(/^(https?):\/\/([^/:?#]+)(:\d{1,5})?(\/[^\s?#]*)?$/i);
  if (!m || !HOST_RE.test(m[2])) return { ok: false, error: 'bad_url' };
  if (m[1].toLowerCase() !== 'https') return { ok: false, error: 'need_https' };
  return { ok: true, url: `https://${m[2].toLowerCase()}${m[3] || ''}${m[4] || ''}` };
}

/**
 * Umkehrung von serverAddress: gespeicherte Adresse in Felder zerlegen (zum Vorbelegen).
 * @returns {{host:string, tailnet:string, port:string, url:string}}
 */
export function addressFields(mode, url) {
  const out = { host: '', tailnet: '', port: String(DEFAULT_PORT), url: url || '' };
  const m = (url || '').match(/^https?:\/\/([^/:]+)(?::(\d+))?/i);
  if (!m) return out;
  if (mode === 'tailscale' && /\.ts\.net$/i.test(m[1])) {
    const [host, ...rest] = m[1].split('.');
    return { ...out, host, tailnet: rest.join('.') };
  }
  if (mode === 'wireguard' || mode === 'lan') return { ...out, host: m[1], port: m[2] || (url.startsWith('https') ? '443' : '80') };
  return out;
}

/** Speicherort zu einer Adresse raten, z. B. wenn die App direkt vom Server geöffnet wurde. */
export function guessStorage(url) {
  const m = (url || '').match(/^(https?):\/\/([^/:]+)/i);
  if (!m) return 'local';
  if (/\.ts\.net$/i.test(m[2])) return 'tailscale';
  if (m[1].toLowerCase() === 'https') return 'domain';
  return /^10\./.test(m[2]) ? 'wireguard' : 'lan';
}

/**
 * Hinweis zur Adresse: eine http-Adresse lässt sich von einer https-Seite (z. B. GitHub Pages) nicht erreichen.
 * @param {string} url Serveradresse
 * @param {string} pageProtocol 'https:' oder 'http:' der geöffneten App
 * @returns {'mixed'|null}
 */
export function addressWarning(url, pageProtocol) {
  return pageProtocol === 'https:' && /^http:\/\//i.test(url || '') ? 'mixed' : null;
}

// ---- Essensplan ---------------------------------------------------------------------

/**
 * Sieben Tage ab Montag mit den Essen je Tag (Reihenfolge der Mahlzeiten aus MEAL_SLOTS).
 * @returns {{date:string, meals:string[]}[]} meals = IDs
 */
export function mealWeek(meals, monday) {
  const slot = (m) => MEAL_SLOTS.indexOf(m.slot);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const list = alive(meals).filter((m) => m.date === date).sort((a, b) => slot(a) - slot(b) || a.changedAt - b.changedAt);
    return { date, meals: list.map((m) => m.id) };
  });
}

// ---- Haushaltsplan im Wechsel --------------------------------------------------------

/** Datum + n Monate, Tag auf das Monatsende begrenzt (31.01. + 1 = 28./29.02.). */
export function addMonths(iso, n) {
  const [y, m, d] = ymd(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12); const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

/**
 * Wer ist gerade dran? Die Zeit ab startDate ist in Abschnitte (interval Tage/Wochen/Monate) geteilt,
 * im k-ten Abschnitt ist people[k mod n] dran. Erledigt = lastDone liegt im aktuellen Abschnitt.
 * @returns {{choreId:string, period:number, periodStart:string, periodEnd:string, assignee:string|null,
 *   next:string|null, done:boolean, notYet:boolean}}
 */
export function choreState(chore, today) {
  const notYet = today < chore.startDate;
  let k = 0; let periodStart = chore.startDate; let periodEnd;
  if (chore.unit === 'monthly') {
    if (!notYet) {
      const [sy, sm, sd] = ymd(chore.startDate); const [ty, tm, td] = ymd(today);
      const months = (ty * 12 + tm) - (sy * 12 + sm) - (td < Math.min(sd, daysInMonth(ty, tm)) ? 1 : 0);
      k = Math.floor(months / chore.interval);
      periodStart = addMonths(chore.startDate, k * chore.interval);
    }
    periodEnd = addDays(addMonths(chore.startDate, (k + 1) * chore.interval), -1);
  } else {
    const per = chore.interval * (chore.unit === 'weekly' ? 7 : 1);
    if (!notYet) k = Math.floor((dayNumber(today) - dayNumber(chore.startDate)) / per);
    periodStart = addDays(chore.startDate, k * per);
    periodEnd = addDays(periodStart, per - 1);
  }
  const n = chore.people.length;
  return {
    choreId: chore.id,
    period: k,
    periodStart,
    periodEnd,
    assignee: n ? chore.people[k % n] : null,
    next: n ? chore.people[(k + 1) % n] : null,
    done: !notYet && chore.lastDone !== null && chore.lastDone >= periodStart,
    notYet,
  };
}

// ---- Ausgaben ---------------------------------------------------------------------------

const byIdStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Salden in Cent je Person: positiv = bekommt noch Geld, negativ = schuldet.
 * Ausgabe: paidBy +Betrag, jede beteiligte Person −Anteil (Restcent gehen der Reihe nach an die kleinsten IDs).
 * Ohne beteiligte Personen zählt die Ausgabe für alle in people. Ausgleich: paidBy +Betrag, people[0] −Betrag.
 * @param {object[]} expenses
 * @param {string[]} people alle Personen des Haushalts
 * @returns {{person:string, cents:number}[]} nach ID sortiert
 */
export function balances(expenses, people) {
  const bal = new Map([...new Set(people)].sort(byIdStr).map((p) => [p, 0]));
  const add = (p, v) => bal.set(p, (bal.get(p) || 0) + v);
  for (const e of alive(expenses)) {
    if (!e.paidBy || e.amount <= 0) continue;
    const among = (e.kind === 'settle' ? e.people.slice(0, 1) : e.people.length ? e.people : [...bal.keys()]).slice().sort(byIdStr);
    if (among.length === 0) continue;
    add(e.paidBy, e.amount);
    const share = Math.floor(e.amount / among.length); const rest = e.amount - share * among.length;
    among.forEach((p, i) => add(p, -(share + (i < rest ? 1 : 0))));
  }
  return [...bal.entries()].sort((a, b) => byIdStr(a[0], b[0])).map(([person, cents]) => ({ person, cents }));
}

/**
 * Möglichst wenige Überweisungen, damit alle Salden 0 werden.
 * @returns {{from:string, to:string, cents:number}[]}
 */
export function settleUp(bals) {
  const debt = bals.filter((b) => b.cents < 0).map((b) => ({ ...b, cents: -b.cents }));
  const credit = bals.filter((b) => b.cents > 0).map((b) => ({ ...b }));
  const order = (a, b) => b.cents - a.cents || byIdStr(a.person, b.person);
  const out = [];
  while (debt.length && credit.length) {
    debt.sort(order); credit.sort(order);
    const d = debt[0]; const c = credit[0];
    const cents = Math.min(d.cents, c.cents);
    out.push({ from: d.person, to: c.person, cents });
    d.cents -= cents; c.cents -= cents;
    if (d.cents === 0) debt.shift();
    if (c.cents === 0) credit.shift();
  }
  return out;
}

/** Summe der Ausgaben (ohne Ausgleiche) in einem Monat 'YYYY-MM', in Cent. */
export const monthTotal = (expenses, month) => alive(expenses)
  .filter((e) => e.kind === 'expense' && e.date.slice(0, 7) === month).reduce((s, e) => s + e.amount, 0);

/** Betrag aus Eingabe ("12,50", "12.5", "1.234,56") in Cent, oder null. */
export function parseAmount(text) {
  let s = String(text ?? '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= 100000000 ? cents : null;
}

// ---- Geburtstage -------------------------------------------------------------------------

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Nächster Geburtstag ab heute (heute zählt). 29.02. fällt in Nicht-Schaltjahren auf den 28.02.
 * @returns {{contactId:string, date:string, inDays:number, age:number|null}|null}
 */
export function nextBirthday(contact, today) {
  if (contact.deleted || !contact.birthday) return null;
  const at = (y) => (contact.birthday === '02-29' && !isLeap(y) ? `${y}-02-28` : `${y}-${contact.birthday}`);
  let y = Number(today.slice(0, 4));
  if (at(y) < today) y++;
  const date = at(y);
  return { contactId: contact.id, date, inDays: dayNumber(date) - dayNumber(today), age: contact.birthYear ? y - contact.birthYear : null };
}

/** Eingabe "24.12." oder "24.12" → 'MM-DD', sonst null. */
export function parseDayMonth(text) {
  const m = String(text ?? '').trim().match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (!m) return null;
  const d = Number(m[1]); const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(2000, mo) ? `${pad(mo)}-${pad(d)}` : null;
}

/** Geburtstage in den nächsten days Tagen (heute = 0), nach Nähe sortiert. */
export function upcomingBirthdays(contacts, today, days) {
  return contacts.map((c) => nextBirthday(c, today)).filter((b) => b && b.inDays < days)
    .sort((a, b) => a.inDays - b.inDays || byIdStr(a.contactId, b.contactId));
}

// ---- Notizen, Geschenke, Vorlagen ----------------------------------------------------------

/** Angeheftete Notizen für die Pinnwand, neueste zuerst. */
export const pinnedNotes = (notes) => alive(notes).filter((n) => n.pinned).sort((a, b) => b.changedAt - a.changedAt);

/** Geschenkideen, die diese Person sehen darf (private nur die eigenen). */
export const visibleGifts = (gifts, userId) => alive(gifts).filter((g) => !g.private || !g.owner || g.owner === userId);

/**
 * Einträge einer Vorlage, die in eine Liste übernommen werden sollen. Was dort schon offen steht
 * (gleicher Titel, Groß/klein egal), wird übersprungen.
 * @returns {{title:string, quantity:string|null, category:string|null, note:string|null}[]}
 */
export function fromTemplate(templateItems, targetItems) {
  const open = new Set(targetItems.filter((i) => !i.done && !i.deleted).map((i) => i.title.toLowerCase()));
  return [...templateItems].filter((i) => !i.deleted).sort(bySort)
    .filter((i) => !open.has(i.title.toLowerCase()))
    .map((i) => ({ title: i.title, quantity: i.quantity, category: i.category, note: i.note }));
}

/** Fortschritt eines Projekts: erledigte und alle Schritte. */
export function progress(items, listId) {
  const list = itemsOf(items, listId);
  return { done: list.filter((i) => i.done).length, total: list.length };
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
