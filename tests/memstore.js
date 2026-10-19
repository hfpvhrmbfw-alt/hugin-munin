// Speicher im Arbeitsspeicher, gleiche Schnittstelle wie src/storage.js. Für Tests.
export function memStore() {
  const data = { lists: new Map(), items: new Map(), events: new Map() };
  const meta = new Map();
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  return {
    async all(c) { return [...data[c].values()].map(clone); },
    async put(c, r) { data[c].set(r.id, clone(r)); },
    async putMany(c, rs) { for (const r of rs) data[c].set(r.id, clone(r)); },
    async getMeta(k) { return clone(meta.get(k)); },
    async setMeta(k, v) { meta.set(k, clone(v)); },
    async clear() { for (const m of Object.values(data)) m.clear(); meta.clear(); },
  };
}
