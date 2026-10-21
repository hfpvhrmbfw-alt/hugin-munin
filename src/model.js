// Datenmodell: Typen, Stammdaten, leere Einträge, Validierung, Export/Import, Migration.
// Keine Abhängigkeiten, keine Anzeigetexte, keine Uhr.

export const APP_ID = 'hugin-munin';
export const SCHEMA_VERSION = 1;

/** Sammlungen, die mit dem Server abgeglichen werden (gleiche Namen wie in PocketBase). */
export const COLLECTIONS = ['lists', 'items', 'events'];

export const LIST_KINDS = ['shopping', 'tasks'];

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

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optStr = (v, max = 500) => { const s = str(v, max); return s === '' ? null : s; };
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const int = (v, min, max, fallback) => (Number.isInteger(v) && v >= min && v <= max ? v : fallback);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const optId = (v) => (isId(v) ? v : null);
const optDate = (v) => (isIsoDate(v) ? v : null);
const optTime = (v) => (isTime(v) ? v : null);

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
    people: Array.isArray(raw.people) ? [...new Set(raw.people.filter(isId))] : [],
  };
}

export const SANITIZERS = { lists: sanitizeList, items: sanitizeItem, events: sanitizeEvent };

/** Lokale Einstellungen (werden nicht abgeglichen). */
export const DEFAULT_SETTINGS = { theme: 'system', serverUrl: '' };
export const THEMES = ['system', 'light', 'dark'];

export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    theme: oneOf(r.theme, THEMES, DEFAULT_SETTINGS.theme),
    serverUrl: typeof r.serverUrl === 'string' && /^https?:\/\/\S+$/.test(r.serverUrl.trim())
      ? r.serverUrl.trim().replace(/\/+$/, '') : '',
  };
}

// ---- neue Einträge -------------------------------------------------------

/** @param {{id:string, household:string, now:number, user:string|null}} ctx */
const stamp = (ctx) => ({ id: ctx.id, household: ctx.household, changedAt: ctx.now, changedBy: ctx.user, deleted: false });

export const newList = (ctx, kind, name) => sanitizeList({ ...stamp(ctx), kind, name, sort: ctx.now });
export const newItem = (ctx, list, title, extra = {}) => sanitizeItem({ ...extra, ...stamp(ctx), list, title, sort: ctx.now });
export const newEvent = (ctx, fields) => sanitizeEvent({ ...fields, ...stamp(ctx) });

/**
 * Änderung an einem Eintrag: Felder ersetzen, Zeitstempel und Autor setzen, neu prüfen.
 * @param {'lists'|'items'|'events'} collection
 */
export function change(collection, record, fields, now, user) {
  return SANITIZERS[collection]({ ...record, ...fields, id: record.id, changedAt: Math.max(now, record.changedAt + 1), changedBy: user });
}

// ---- Export / Import -----------------------------------------------------

/**
 * @param {{lists:List[], items:Item[], events:CalEvent[]}} data
 * @param {object} settings
 * @param {string} exportedAt ISO-Zeitstempel, von außen
 */
export function buildExport(data, settings, exportedAt) {
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    exportedAt,
    settings: sanitizeSettings(settings),
    lists: data.lists.filter((r) => !r.deleted),
    items: data.items.filter((r) => !r.deleted),
    events: data.events.filter((r) => !r.deleted),
  };
}

/**
 * Hebt ältere Rohdaten auf die aktuelle Version. Idempotent.
 * Version 1 ist die erste, daher gibt es noch keine Schritte.
 */
export function upgradeRaw(raw) {
  const out = { ...raw };
  if (typeof out.version !== 'number') out.version = 1;
  // Beispiel für später: if (out.version === 1) { …; out.version = 2; }
  return out;
}

/**
 * @param {string} text Dateiinhalt
 * @returns {{ok:true, data:{lists:List[], items:Item[], events:CalEvent[]}, settings:object, skipped:number}
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
