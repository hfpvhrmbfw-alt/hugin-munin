// Speicher: kleine Schnittstelle über IndexedDB, mit localStorage als Ersatz.
// Kennt das Modell nur über die Sammlungsnamen. Die Logik kennt den Speicher nicht.
import { COLLECTIONS } from './model.js';

const DB_NAME = 'hugin-munin';
const DB_VERSION = 3; // 2: Sammlungen für die neuen Module, 3: fremde Kalender
const STORES = [...COLLECTIONS, 'meta'];

/**
 * @typedef {object} Store
 * @property {(c:string)=>Promise<object[]>} all
 * @property {(c:string, r:object)=>Promise<void>} put
 * @property {(c:string, rs:object[])=>Promise<void>} putMany
 * @property {(k:string)=>Promise<any>} getMeta
 * @property {(k:string, v:any)=>Promise<void>} setMeta
 * @property {()=>Promise<void>} clear
 */

/** @returns {Promise<Store>} */
export async function open() {
  try {
    if (!globalThis.indexedDB) throw new Error('no idb');
    return await openIdb();
  } catch {
    return openLocal();
  }
}

function req(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

async function openIdb() {
  const r = indexedDB.open(DB_NAME, DB_VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'meta' ? undefined : { keyPath: 'id' });
  };
  const db = await req(r);
  const tx = (s, mode, fn) => new Promise((resolve, reject) => {
    const t = db.transaction(s, mode);
    const out = fn(t.objectStore(s));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  return {
    all: (c) => tx(c, 'readonly', (st) => st.getAll()),
    put: (c, rec) => tx(c, 'readwrite', (st) => { st.put(rec); }),
    putMany: (c, recs) => tx(c, 'readwrite', (st) => { for (const rec of recs) st.put(rec); }),
    getMeta: (k) => tx('meta', 'readonly', (st) => st.get(k)),
    setMeta: (k, v) => tx('meta', 'readwrite', (st) => { st.put(v, k); }),
    clear: async () => { for (const s of STORES) await tx(s, 'readwrite', (st) => { st.clear(); }); },
  };
}

function openLocal() {
  const key = (s) => `${DB_NAME}:${s}`;
  const read = (s) => { try { return JSON.parse(localStorage.getItem(key(s)) || '{}'); } catch { return {}; } };
  const write = (s, v) => localStorage.setItem(key(s), JSON.stringify(v));
  return {
    all: async (c) => Object.values(read(c)),
    put: async (c, rec) => { const m = read(c); m[rec.id] = rec; write(c, m); },
    putMany: async (c, recs) => { const m = read(c); for (const rec of recs) m[rec.id] = rec; write(c, m); },
    getMeta: async (k) => read('meta')[k],
    setMeta: async (k, v) => { const m = read('meta'); m[k] = v; write('meta', m); },
    clear: async () => { for (const s of STORES) localStorage.removeItem(key(s)); },
  };
}
