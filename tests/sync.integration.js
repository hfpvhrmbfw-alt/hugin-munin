// Abgleich gegen einen echten PocketBase-Server. Nicht Teil von `npm test`.
// Aufruf: PB_URL=http://127.0.0.1:8090 node --test tests/sync.integration.js
// Der Server muss mit server/pb_migrations und server/pb_hooks laufen und leer sein.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, markDirty, syncOnce, ApiError } from '../src/sync.js';
import { makeId, newList, newItem, change } from '../src/model.js';
import { memStore } from './memstore.js';

const URL_ = process.env.PB_URL || 'http://127.0.0.1:8090';
const id = () => makeId(randomBytes(15));
const pw = 'geheim-geheim-123';

async function user(name) {
  const c = createClient(URL_);
  const email = `${name}-${id()}@example.com`;
  await c.register(email, pw, name);
  const { user: u } = await c.login(email, pw);
  return { c, u, store: memStore() };
}

test('zwei Geräte gleichen über PocketBase ab', async () => {
  const anna = await user('Anna');
  const partner = await user('Partner');
  const fremd = await user('Fremd');

  // Haushalt anlegen und beitreten
  const inviteCode = id() + id();
  const house = await anna.c.createHousehold({ name: 'Wir', members: [anna.u.id], inviteCode });
  await assert.rejects(partner.c.join('falsch-falsch-falsch'), (e) => e instanceof ApiError && e.status === 404);
  const joined = await partner.c.join(inviteCode);
  assert.equal(joined.id, house.id);
  assert.equal((await partner.c.households()).length, 1);
  assert.equal((await fremd.c.households()).length, 0);

  // Mitglieder sehen sich gegenseitig, Fremde nicht
  const seen = (await partner.c.members()).map((m) => m.name).sort();
  assert.deepEqual(seen, ['Anna', 'Partner']);
  assert.deepEqual(await fremd.c.members(), []);
  await assert.rejects(partner.c.request('GET', `/api/collections/users/records/${anna.u.id}`), ApiError);

  // Anna legt offline eine Liste mit Eintrag an, dann Abgleich
  const ctx = (who, now) => ({ id: id(), household: house.id, now, user: who.u.id });
  const list = newList(ctx(anna, 1000), 'shopping', 'Wocheneinkauf');
  const milk = newItem(ctx(anna, 1001), list.id, 'Milch', { category: 'dairy', quantity: '2' });
  await anna.store.put('lists', list); await markDirty(anna.store, 'lists', list);
  await anna.store.put('items', milk); await markDirty(anna.store, 'items', milk);
  assert.deepEqual(await syncOnce(anna.c, anna.store, house.id), { pushed: 2, pulled: 0 });
  assert.deepEqual(await anna.store.getMeta('outbox'), {});

  // Partner holt alles
  const r = await syncOnce(partner.c, partner.store, house.id);
  assert.equal(r.pulled, 2);
  const [pMilk] = await partner.store.all('items');
  assert.deepEqual(pMilk, milk);

  // Fremde dürfen weder lesen noch schreiben
  const outsider = await fremd.c.request('GET', `/api/collections/items/records?filter=${encodeURIComponent(`household="${house.id}"`)}`);
  assert.equal(outsider.items.length, 0);
  await assert.rejects(fremd.c.request('POST', '/api/collections/items/records', { ...milk, id: id() }), ApiError);

  // Gleichzeitige Änderung: Partner hakt ab (neuer), Anna benennt um (älter)
  const pDone = change('items', pMilk, { done: true }, 3000, partner.u.id);
  await partner.store.put('items', pDone); await markDirty(partner.store, 'items', pDone);
  const aRename = change('items', milk, { title: 'Hafermilch' }, 2000, anna.u.id);
  await anna.store.put('items', aRename); await markDirty(anna.store, 'items', aRename);
  await syncOnce(partner.c, partner.store, house.id);
  await syncOnce(anna.c, anna.store, house.id); // Annas ältere Änderung wird vom Server abgelehnt
  const [aNow] = await anna.store.all('items');
  assert.equal(aNow.done, true);
  assert.equal(aNow.title, 'Milch');
  assert.deepEqual(await anna.store.getMeta('outbox'), {});

  // Löschen als Markierung kommt beim Partner an
  const gone = change('items', aNow, { deleted: true }, 4000, anna.u.id);
  await anna.store.put('items', gone); await markDirty(anna.store, 'items', gone);
  await syncOnce(anna.c, anna.store, house.id);
  await syncOnce(partner.c, partner.store, house.id);
  const [pNow] = await partner.store.all('items');
  assert.equal(pNow.deleted, true);

  // Haushalt wechseln ist nicht erlaubt
  await assert.rejects(anna.c.request('PATCH', `/api/collections/lists/records/${list.id}`, { household: id(), changedAt: 99999 }), ApiError);
});
