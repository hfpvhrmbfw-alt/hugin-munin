// Dienst: Abgleich mit PocketBase. Spricht über fetch mit dem Server, entscheidet mit der Logik,
// speichert über die Speicher-Schnittstelle. Kennt keine Oberfläche.
import { COLLECTIONS, fromServer, toServer } from './model.js';
import { mergeRemote, nextCursor } from './logic.js';

const PAGE = 200;

export class ApiError extends Error {
  constructor(status, body) { super(`HTTP ${status}`); this.status = status; this.body = body; }
}

/**
 * Kleiner PocketBase-Client.
 * @param {string} baseUrl z. B. https://macmini.name.ts.net
 * @param {typeof fetch} fetchFn
 */
export function createClient(baseUrl, fetchFn = fetch) {
  let token = '';
  async function request(method, path, body) {
    const res = await fetchFn(baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }
  const auth = (r) => { token = r.token; return { token: r.token, user: { id: r.record.id, email: r.record.email, name: r.record.name || '' } }; };
  return {
    baseUrl,
    setToken(t) { token = t || ''; },
    get token() { return token; },
    request,
    register: (email, password, name) => request('POST', '/api/collections/users/records', { email, password, passwordConfirm: password, name }),
    login: async (email, password) => auth(await request('POST', '/api/collections/users/auth-with-password', { identity: email, password })),
    refresh: async () => auth(await request('POST', '/api/collections/users/auth-refresh')),
    households: async () => (await request('GET', '/api/collections/households/records?perPage=50&sort=created')).items,
    createHousehold: (fields) => request('POST', '/api/collections/households/records', fields),
    join: (code) => request('POST', '/api/hm/join', { code }),
    members: () => request('GET', '/api/hm/members'),
    feedToken: async (household) => (await request('GET', `/api/hm/feed-token?household=${encodeURIComponent(household)}`)).token,
    newFeedToken: async (household) => (await request('POST', '/api/hm/feed-token', { household })).token,
    feedOff: (household) => request('DELETE', `/api/hm/feed-token?household=${encodeURIComponent(household)}`),
  };
}

/**
 * Speicher-Schnittstelle, die der Abgleich braucht (siehe storage.js):
 *   all(collection) → Promise<object[]>
 *   putMany(collection, records) → Promise<void>
 *   getMeta(key) → Promise<any>, setMeta(key, value) → Promise<void>
 * Ausgang (Outbox): Meta-Schlüssel 'outbox' = { "items/abc…": changedAt, … }
 */

/** Lokale Änderung zum Hochladen vormerken. */
export async function markDirty(store, collection, record) {
  const outbox = (await store.getMeta('outbox')) || {};
  outbox[`${collection}/${record.id}`] = record.changedAt;
  await store.setMeta('outbox', outbox);
}

async function push(client, store) {
  const outbox = (await store.getMeta('outbox')) || {};
  const keys = Object.keys(outbox);
  if (keys.length === 0) return 0;
  const byCollection = {};
  for (const c of COLLECTIONS) byCollection[c] = new Map((await store.all(c)).map((r) => [r.id, r]));
  const done = [];
  for (const key of keys) {
    const [collection, id] = key.split('/');
    const rec = byCollection[collection]?.get(id);
    if (!rec) { done.push([key, outbox[key]]); continue; }
    const body = toServer(collection, rec);
    try {
      await client.request('PATCH', `/api/collections/${collection}/records/${id}`, body);
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) throw err;
      try {
        await client.request('POST', `/api/collections/${collection}/records`, body);
      } catch (err2) {
        // 404 beim Anlegen: Sammlung fehlt, der Server ist noch nicht aktualisiert. Später erneut versuchen.
        if (err2 instanceof ApiError && err2.status === 404) continue;
        // 400 heißt hier: Eintrag gibt es schon, aber der Server hat eine neuere Fassung.
        // Die kommt beim Abrufen und wird dort zusammengeführt.
        if (!(err2 instanceof ApiError) || err2.status !== 400) throw err2;
      }
    }
    done.push([key, rec.changedAt]);
  }
  // Nur entfernen, was sich während des Hochladens nicht schon wieder geändert hat.
  const current = (await store.getMeta('outbox')) || {};
  for (const [key, changedAt] of done) if (current[key] !== undefined && current[key] <= changedAt) delete current[key];
  await store.setMeta('outbox', current);
  return done.length;
}

async function pull(client, store, household) {
  const cursors = (await store.getMeta('cursors')) || {};
  const outbox = (await store.getMeta('outbox')) || {};
  let pulled = 0;
  for (const c of COLLECTIONS) {
    const since = cursors[c] || '';
    const filter = encodeURIComponent(`household = "${household}"` + (since ? ` && updated >= "${since}"` : ''));
    let page = 1; let raw = [];
    let missing = false;
    for (;;) {
      let res;
      try {
        res = await client.request('GET', `/api/collections/${c}/records?filter=${filter}&sort=updated&perPage=${PAGE}&page=${page}&skipTotal=1`);
      } catch (err) {
        // Sammlung gibt es auf einem älteren Server noch nicht: überspringen statt den ganzen Abgleich abzubrechen.
        if (err instanceof ApiError && err.status === 404) { missing = true; break; }
        throw err;
      }
      raw = raw.concat(res.items);
      if (res.items.length < PAGE) break;
      page++;
    }
    if (missing || raw.length === 0) continue;
    const remote = raw.map((r) => fromServer(c, r)).filter(Boolean);
    const pending = new Set(Object.keys(outbox).filter((k) => k.startsWith(c + '/')).map((k) => k.slice(c.length + 1)));
    const { put } = mergeRemote(await store.all(c), remote, pending);
    if (put.length) await store.putMany(c, put);
    pulled += put.length;
    cursors[c] = nextCursor(since, raw);
  }
  await store.setMeta('cursors', cursors);
  return pulled;
}

/**
 * Einmal abgleichen: erst eigene Änderungen hoch, dann Neues vom Server holen.
 * @returns {Promise<{pushed:number, pulled:number}>}
 */
export async function syncOnce(client, store, household) {
  const pushed = await push(client, store);
  const pulled = await pull(client, store, household);
  return { pushed, pulled };
}

/**
 * Live-Updates über PocketBase-Realtime (Server-Sent Events). Bei jeder Änderung wird onChange aufgerufen;
 * die App gleicht dann ab. Gibt eine Funktion zum Beenden zurück.
 * @param {typeof EventSource} EventSourceImpl
 */
export function subscribe(client, onChange, EventSourceImpl = globalThis.EventSource) {
  if (!EventSourceImpl) return () => {};
  const es = new EventSourceImpl(client.baseUrl + '/api/realtime');
  es.addEventListener('PB_CONNECT', (ev) => {
    const { clientId } = JSON.parse(ev.data);
    client.request('POST', '/api/realtime', { clientId, subscriptions: COLLECTIONS.map((c) => `${c}/*`) }).catch(() => {});
  });
  for (const c of COLLECTIONS) es.addEventListener(`${c}/*`, () => onChange(c));
  return () => es.close();
}
