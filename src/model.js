// Datenmodell: Typen, Stammdaten, leere Einträge, Validierung, Export/Import, Migration.
// Keine Abhängigkeiten, keine Anzeigetexte, keine Uhr.

export const APP_ID = 'hugin-munin';
export const SCHEMA_VERSION = 3;

/** Sammlungen, die mit dem Server abgeglichen werden (gleiche Namen wie in PocketBase). */
export const COLLECTIONS = ['lists', 'items', 'events', 'notes', 'expenses', 'meals', 'chores', 'contacts', 'gifts', 'calendars'];

/** project = Projekt mit Schritten, template = Vorlage für Einkaufs- oder Aufgabenlisten. */
export const LIST_KINDS = ['shopping', 'tasks', 'project', 'template'];

/**
 * Module, die in den Einstellungen an- und ausgeschaltet werden. Reihenfolge = Reihenfolge der Tabs.
 * "Heute" und "Mehr" gibt es immer. board (Pinnwand) hat keinen eigenen Tab, sondern steht auf "Heute".
 */
export const MODULES = [
  'shopping', 'tasks', 'calendar', 'meals', 'chores', 'expenses', 'projects', 'notes', 'board', 'contacts', 'gifts', 'templates',
];
export const TAB_MODULES = MODULES.filter((m) => m !== 'board');
export const DEFAULT_MODULES = ['shopping', 'tasks', 'calendar'];

/**
 * Wo die Daten liegen. local = nur auf dem Gerät; alle anderen = eigener PocketBase-Server,
 * unterschiedlich erreicht (Tailscale, WireGuard-Tunnel, Heimnetz, eigene Domain, gemieteter Server).
 */
export const STORAGE_MODES = ['local', 'tailscale', 'wireguard', 'lan', 'domain', 'hosted'];
export const DEFAULT_PORT = 8090;

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
export const CHORE_UNITS = ['daily', 'weekly', 'monthly'];
export const EXPENSE_KINDS = ['expense', 'settle'];
export const GIFT_STATUS = ['idea', 'bought', 'given'];

/** Reihenfolge = Reihenfolge im Laden und bei Gleichstand. */
export const SHOPPING_CATEGORIES = [
  'produce', 'bakery', 'dairy', 'meat', 'frozen', 'pantry',
  'drinks', 'household', 'care', 'other',
];

export const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export const COLORS = ['orange', 'ink', 'olive', 'sky', 'plum', 'sand'];

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const ID_LENGTH = 15; // PocketBase-Format: 15 Zeichen a-z0-9

/**
 * Neue ID im PocketBase-Format. Zufall kommt von außen (crypto.getRandomValues in der UI).
 * @param {Uint8Array} bytes mindestens 15 Zufallsbytes
 * @returns {string}
 */
export function makeId(bytes) {
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return id;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[a-z0-9]{15}$/;

export const isIsoDate = (v) => typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
  && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
export const isTime = (v) => typeof v === 'string' && HHMM.test(v);
export const isId = (v) => typeof v === 'string' && ID_RE.test(v);
/** Tag im Jahr ohne Jahr, 'MM-DD' (29.02. erlaubt). */
export const isMonthDay = (v) => typeof v === 'string' && /^\d{2}-\d{2}$/.test(v) && isIsoDate('2000-' + v);

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optStr = (v, max = 500) => { const s = str(v, max); return s === '' ? null : s; };
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const int = (v, min, max, fallback) => (Number.isInteger(v) && v >= min && v <= max ? v : fallback);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const optId = (v) => (isId(v) ? v : null);
const optDate = (v) => (isIsoDate(v) ? v : null);
const optTime = (v) => (isTime(v) ? v : null);
const ids = (v) => (Array.isArray(v) ? [...new Set(v.filter(isId))] : []);
const optUrl = (v) => { const s = str(v, 500); return /^https?:\/\/\S+$/.test(s) ? s : null; };

/**
 * Felder, die jeder abgeglichene Eintrag hat.
 * @typedef {{id:string, household:string, changedAt:number, changedBy:string|null, deleted:boolean}} Base
 */
function base(raw) {
  return {
    id: raw.id,
    household: isId(raw.household) ? raw.household : '',
    changedAt: int(raw.changedAt, 0, Number.MAX_SAFE_INTEGER, 0),
    changedBy: optId(raw.changedBy),
    deleted: raw.deleted === true,
  };
}

/** @typedef {Base & {kind:'shopping'|'tasks', name:string, color:string, sort:number, archived:boolean}} List */
/** @returns {List|null} */
export function sanitizeList(raw) {
  if (!raw || !isId(raw.id)) return null;
  return {
    ...base(raw),
    kind: oneOf(raw.kind, LIST_KINDS, 'tasks'),
    name: str(raw.name, 80),
    color: oneOf(raw.color, COLORS, COLORS[0]),
    sort: num(raw.sort, 0),
    archived: raw.archived === true,
  };
}

/**
 * Eintrag einer Einkaufs- oder Aufgabenliste.
 * @typedef {Base & {list:string, title:string, note:string|null, quantity:string|null, category:string|null,
 *   done:boolean, dueDate:string|null, assignee:string|null, important:boolean, sort:number}} Item
 */
/** @returns {Item|null} */
export function sanitizeItem(raw) {
  if (!raw || !isId(raw.id) || !isId(raw.list)) return null;
  return {
    ...base(raw),
    list: raw.list,
    title: str(raw.title, 200),
    note: optStr(raw.note, 2000),
    quantity: optStr(raw.quantity, 40),
    category: SHOPPING_CATEGORIES.includes(raw.category) ? raw.category : null,
    done: raw.done === true,
    dueDate: optDate(raw.dueDate),
    assignee: optId(raw.assignee),
    important: raw.important === true,
    sort: num(raw.sort, 0),
  };
}

/**
 * Termin. Ohne startTime ganztägig. Wiederholung als Regel, Vorkommen rechnet die Logik aus.
 * @typedef {Base & {title:string, notes:string|null, startDate:string, endDate:string, startTime:string|null,
 *   endTime:string|null, repeat:string, repeatInterval:number, repeatUntil:string|null, people:string[]}} CalEvent
 */
/** @returns {CalEvent|null} */
export function sanitizeEvent(raw) {
  if (!raw || !isId(raw.id) || !isIsoDate(raw.startDate)) return null;
  const endDate = isIsoDate(raw.endDate) && raw.endDate >= raw.startDate ? raw.endDate : raw.startDate;
  const startTime = optTime(raw.startTime);
  let endTime = startTime ? optTime(raw.endTime) : null;
  if (endTime && endDate === raw.startDate && endTime < startTime) endTime = null;
  const repeat = oneOf(raw.repeat, REPEATS, 'none');
  const repeatUntil = repeat !== 'none' && isIsoDate(raw.repeatUntil) && raw.repeatUntil >= raw.startDate ? raw.repeatUntil : null;
  return {
    ...base(raw),
    title: str(raw.title, 200),
    notes: optStr(raw.notes, 2000),
    startDate: raw.startDate,
    endDate,
    startTime,
    endTime,
    repeat,
    repeatInterval: repeat === 'none' ? 1 : int(raw.repeatInterval, 1, 99, 1),
    repeatUntil,
    people: ids(raw.people),
  };
}

/** Notiz; angeheftete Notizen stehen auf der Pinnwand. @typedef {Base & {title:string, body:string, pinned:boolean}} Note */
/** @returns {Note|null} */
export function sanitizeNote(raw) {
  if (!raw || !isId(raw.id)) return null;
  return { ...base(raw), title: str(raw.title, 120), body: str(raw.body, 5000), pinned: raw.pinned === true };
}

/**
 * Ausgabe (kind expense: paidBy hat für people bezahlt, leer = für alle) oder Ausgleich
 * (kind settle: paidBy hat people[0] Geld gegeben). Betrag in Cent.
 * @typedef {Base & {kind:string, title:string, amount:number, date:string, paidBy:string|null, people:string[]}} Expense
 */
/** @returns {Expense|null} */
export function sanitizeExpense(raw) {
  if (!raw || !isId(raw.id) || !isIsoDate(raw.date)) return null;
  const kind = oneOf(raw.kind, EXPENSE_KINDS, 'expense');
  const people = ids(raw.people);
  return {
    ...base(raw),
    kind,
    title: str(raw.title, 120),
    amount: int(raw.amount, 0, 100000000, 0),
    date: raw.date,
    paidBy: optId(raw.paidBy),
    people: kind === 'settle' ? people.slice(0, 1) : people,
  };
}

/** Essen an einem Tag. @typedef {Base & {date:string, slot:string, title:string, note:string|null}} Meal */
/** @returns {Meal|null} */
export function sanitizeMeal(raw) {
  if (!raw || !isId(raw.id) || !isIsoDate(raw.date)) return null;
  return { ...base(raw), date: raw.date, slot: oneOf(raw.slot, MEAL_SLOTS, 'dinner'), title: str(raw.title, 120), note: optStr(raw.note, 500) };
}

/**
 * Aufgabe im Haushaltsplan: alle interval Tage/Wochen/Monate ab startDate, people sind der Reihe nach dran.
 * lastDone = Tag, an dem sie zuletzt erledigt wurde.
 * @typedef {Base & {title:string, people:string[], unit:string, interval:number, startDate:string,
 *   lastDone:string|null, doneBy:string|null}} Chore
 */
/** @returns {Chore|null} */
export function sanitizeChore(raw) {
  if (!raw || !isId(raw.id) || !isIsoDate(raw.startDate)) return null;
  return {
    ...base(raw),
    title: str(raw.title, 120),
    people: ids(raw.people),
    unit: oneOf(raw.unit, CHORE_UNITS, 'weekly'),
    interval: int(raw.interval, 1, 99, 1),
    startDate: raw.startDate,
    lastDone: optDate(raw.lastDone),
    doneBy: optId(raw.doneBy),
  };
}

/**
 * Kontakt. Geburtstag als 'MM-DD', Jahr getrennt und optional.
 * @typedef {Base & {name:string, birthday:string|null, birthYear:number|null, phone:string|null,
 *   email:string|null, address:string|null, note:string|null}} Contact
 */
/** @returns {Contact|null} */
export function sanitizeContact(raw) {
  if (!raw || !isId(raw.id)) return null;
  const birthday = isMonthDay(raw.birthday) ? raw.birthday : null;
  let birthYear = birthday ? int(raw.birthYear, 1900, 2200, null) : null;
  if (birthday === '02-29' && birthYear !== null && !isIsoDate(`${birthYear}-02-29`)) birthYear = null;
  return {
    ...base(raw),
    name: str(raw.name, 120),
    birthday,
    birthYear,
    phone: optStr(raw.phone, 40),
    email: optStr(raw.email, 120),
    address: optStr(raw.address, 300),
    note: optStr(raw.note, 2000),
  };
}

/**
 * Geschenkidee. private = nur für owner sichtbar (auch auf dem Server), damit der Partner
 * seine eigenen Geschenke nicht sieht.
 * @typedef {Base & {forName:string, contact:string|null, title:string, note:string|null, link:string|null,
 *   status:string, private:boolean, owner:string|null}} Gift
 */
/** @returns {Gift|null} */
export function sanitizeGift(raw) {
  if (!raw || !isId(raw.id)) return null;
  return {
    ...base(raw),
    forName: str(raw.forName, 80),
    contact: optId(raw.contact),
    title: str(raw.title, 200),
    note: optStr(raw.note, 2000),
    link: optUrl(raw.link),
    status: oneOf(raw.status, GIFT_STATUS, 'idea'),
    private: raw.private === true,
    owner: optId(raw.owner),
  };
}

/**
 * Fremder Kalender (ICS-Abo), z. B. Schulferien oder der Arbeitskalender. Die Termine selbst werden nicht
 * abgeglichen, jedes Gerät lädt sie von url. webcal:// wird zu https://.
 * @typedef {Base & {title:string, url:string}} Calendar
 */
/** @returns {Calendar|null} */
export function sanitizeCalendar(raw) {
  if (!raw || !isId(raw.id)) return null;
  const url = str(raw.url, 1000).replace(/^webcals?:\/\//i, 'https://');
  return { ...base(raw), title: str(raw.title, 80), url: /^https?:\/\/\S+$/i.test(url) ? url : '' };
}

export const SANITIZERS = {
  lists: sanitizeList, items: sanitizeItem, events: sanitizeEvent, notes: sanitizeNote, expenses: sanitizeExpense,
  meals: sanitizeMeal, chores: sanitizeChore, contacts: sanitizeContact, gifts: sanitizeGift, calendars: sanitizeCalendar,
};

/** Lokale Einstellungen (werden nicht abgeglichen, gelten je Gerät). */
export const DEFAULT_SETTINGS = { theme: 'system', serverUrl: '', storage: 'local', modules: DEFAULT_MODULES };
export const THEMES = ['system', 'light', 'dark'];

const cleanUrl = (v) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim().replace(/\/+$/, '') : '');

export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const serverUrl = cleanUrl(r.serverUrl);
  // Einstellungen aus Version 1 haben noch keinen Speicherort: aus der Adresse ableiten.
  const storage = STORAGE_MODES.includes(r.storage) ? r.storage
    : serverUrl ? (/\.ts\.net$/i.test(serverUrl) ? 'tailscale' : 'domain') : 'local';
  const modules = Array.isArray(r.modules) ? MODULES.filter((m) => r.modules.includes(m)) : [...DEFAULT_MODULES];
  return { theme: oneOf(r.theme, THEMES, DEFAULT_SETTINGS.theme), serverUrl, storage, modules };
}

// ---- neue Einträge -------------------------------------------------------

/** @param {{id:string, household:string, now:number, user:string|null}} ctx */
const stamp = (ctx) => ({ id: ctx.id, household: ctx.household, changedAt: ctx.now, changedBy: ctx.user, deleted: false });

export const newList = (ctx, kind, name) => sanitizeList({ ...stamp(ctx), kind, name, sort: ctx.now });
export const newItem = (ctx, list, title, extra = {}) => sanitizeItem({ ...extra, ...stamp(ctx), list, title, sort: ctx.now });
export const newEvent = (ctx, fields) => sanitizeEvent({ ...fields, ...stamp(ctx) });
/** Neuer Eintrag in einer beliebigen Sammlung. */
export const newRecord = (collection, ctx, fields) => SANITIZERS[collection]({ ...fields, ...stamp(ctx) });

/**
 * Änderung an einem Eintrag: Felder ersetzen, Zeitstempel und Autor setzen, neu prüfen.
 * @param {string} collection eine aus COLLECTIONS
 */
export function change(collection, record, fields, now, user) {
  return SANITIZERS[collection]({ ...record, ...fields, id: record.id, changedAt: Math.max(now, record.changedAt + 1), changedBy: user });
}

// ---- Export / Import -----------------------------------------------------

/**
 * @param {Object<string, object[]>} data je Sammlung aus COLLECTIONS
 * @param {object} settings
 * @param {string} exportedAt ISO-Zeitstempel, von außen
 */
export function buildExport(data, settings, exportedAt) {
  const out = { app: APP_ID, version: SCHEMA_VERSION, exportedAt, settings: sanitizeSettings(settings) };
  for (const c of COLLECTIONS) out[c] = (data[c] || []).filter((r) => !r.deleted);
  return out;
}

/**
 * Hebt ältere Rohdaten auf die aktuelle Version. Idempotent.
 * 1 → 2: neue Sammlungen (Notizen, Ausgaben, Essen, Haushaltsplan, Kontakte, Geschenke) kommen leer dazu;
 * Einstellungen bekommen Speicherort und Module (macht sanitizeSettings).
 * 2 → 3: fremde Kalender (calendars) kommen leer dazu.
 */
export function upgradeRaw(raw) {
  const out = { ...raw };
  if (typeof out.version !== 'number') out.version = 1;
  if (out.version < SCHEMA_VERSION) {
    for (const c of COLLECTIONS) if (out[c] === undefined) out[c] = [];
    out.version = SCHEMA_VERSION;
  }
  return out;
}

/**
 * @param {string} text Dateiinhalt
 * @returns {{ok:true, data:Object<string, object[]>, settings:object, skipped:number}
 *   | {ok:false, error:'not_json'|'wrong_app'|'too_new'|'bad_format'}}
 */
export function parseImport(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not_json' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'bad_format' };
  if (raw.app !== APP_ID) return { ok: false, error: 'wrong_app' };
  if (typeof raw.version === 'number' && raw.version > SCHEMA_VERSION) return { ok: false, error: 'too_new' };
  const up = upgradeRaw(raw);
  let skipped = 0;
  const data = {};
  for (const c of COLLECTIONS) {
    if (up[c] !== undefined && !Array.isArray(up[c])) return { ok: false, error: 'bad_format' };
    data[c] = [];
    for (const r of up[c] || []) {
      const s = SANITIZERS[c](r);
      if (s) data[c].push(s); else skipped++;
    }
  }
  return { ok: true, data, settings: sanitizeSettings(up.settings), skipped };
}

// ---- Abbildung auf PocketBase --------------------------------------------

/** Server-Datensatz → Eintrag. PocketBase liefert zusätzlich collectionId, created, updated. */
export function fromServer(collection, rec) {
  return SANITIZERS[collection](rec);
}

/** Eintrag → Felder für den Server (ohne lokale Extras). */
export function toServer(collection, rec) {
  return { ...SANITIZERS[collection](rec) };
}
