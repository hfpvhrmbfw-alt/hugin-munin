// Speicher: kleine Schnittstelle über IndexedDB.
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

function req(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

/** @returns {Promise<Store>} */
export async function open() {
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
