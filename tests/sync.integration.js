// Abgleich gegen einen echten PocketBase-Server. Nicht Teil von `npm test`.
// Aufruf: PB_URL=http://127.0.0.1:8090 node --test tests/sync.integration.js
// Der Server muss mit server/pb_migrations und server/pb_hooks laufen und leer sein.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, markDirty, syncOnce, ApiError } from '../src/sync.js';
import { makeId, newList, newItem, newRecord, newEvent, change } from '../src/model.js';
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

  // Module (Schema 2): Notiz, Ausgabe, Haushaltsplan, Projekt kommen beim Partner an
  const note = newRecord('notes', ctx(anna, 5000), { title: 'WLAN', body: 'steht am Router', pinned: true });
  const exp = newRecord('expenses', ctx(anna, 5001), { title: 'Einkauf', amount: 3050, date: '2026-10-21', paidBy: anna.u.id, people: [anna.u.id, partner.u.id] });
  const chore = newRecord('chores', ctx(anna, 5002), { title: 'Bad', startDate: '2026-10-19', people: [anna.u.id, partner.u.id] });
  const project = newList(ctx(anna, 5003), 'project', 'Keller');
  const contact = newRecord('contacts', ctx(anna, 5004), { name: 'Oma', birthday: '02-29', birthYear: 1948 });
  const meal = newRecord('meals', ctx(anna, 5005), { date: '2026-10-21', slot: 'dinner', title: 'Suppe' });
  for (const [c, r] of [['notes', note], ['expenses', exp], ['chores', chore], ['lists', project], ['contacts', contact], ['meals', meal]]) {
    await anna.store.put(c, r); await markDirty(anna.store, c, r);
  }
  await syncOnce(anna.c, anna.store, house.id);
  assert.deepEqual(await anna.store.getMeta('outbox'), {});
  await syncOnce(partner.c, partner.store, house.id);
  assert.deepEqual((await partner.store.all('notes'))[0], note);
  assert.deepEqual((await partner.store.all('expenses'))[0], exp);
  assert.deepEqual((await partner.store.all('chores'))[0], chore);
  assert.deepEqual((await partner.store.all('contacts'))[0], contact);
  assert.deepEqual((await partner.store.all('meals'))[0], meal);
  assert.ok((await partner.store.all('lists')).some((l) => l.id === project.id && l.kind === 'project'));

  // Private Geschenkidee sieht der Partner nicht, eine geteilte schon; fremder owner wird abgelehnt
  const secret = newRecord('gifts', ctx(anna, 6000), { forName: 'Partner', title: 'Uhr', private: true, owner: anna.u.id });
  const shared = newRecord('gifts', ctx(anna, 6001), { forName: 'Oma', title: 'Blumen', private: false, owner: anna.u.id });
  for (const g of [secret, shared]) { await anna.store.put('gifts', g); await markDirty(anna.store, 'gifts', g); }
  await syncOnce(anna.c, anna.store, house.id);
  await syncOnce(partner.c, partner.store, house.id);
  assert.deepEqual((await partner.store.all('gifts')).map((g) => g.title), ['Blumen']);
  await assert.rejects(partner.c.request('POST', '/api/collections/gifts/records', { ...shared, id: id(), private: true, owner: anna.u.id }), ApiError);
  await assert.rejects(partner.c.request('PATCH', `/api/collections/gifts/records/${secret.id}`, { title: 'x', changedAt: 99999 }), ApiError);
});

test('kalender-abo: geheimer link mit den terminen des haushalts', async () => {
  const anna = await user('Anna');
  const fremd = await user('Fremd');
  const house = await anna.c.createHousehold({ name: 'Wir', members: [anna.u.id], inviteCode: id() + id() });
  assert.equal(await anna.c.feedToken(house.id), '');
  await assert.rejects(fremd.c.newFeedToken(house.id), (e) => e instanceof ApiError && e.status === 404);

  const ev = newEvent({ id: id(), household: house.id, now: 1000, user: anna.u.id },
    { title: 'Schwimmen, Halle 2', startDate: '2099-11-03', startTime: '17:00', endTime: '18:00', repeat: 'weekly', people: [anna.u.id] });
  await anna.store.put('events', ev); await markDirty(anna.store, 'events', ev);
  await syncOnce(anna.c, anna.store, house.id);

  const token = await anna.c.newFeedToken(house.id);
  assert.match(token, /^[a-z0-9]{40}$/);
  assert.equal(await anna.c.feedToken(house.id), token);
  const h = await anna.c.request('GET', `/api/collections/households/records/${house.id}`);
  assert.equal(h.feedToken, undefined);
  await anna.c.request('PATCH', `/api/collections/households/records/${house.id}`, { feedToken: 'x'.repeat(40) }).catch(() => {});
  assert.equal(await anna.c.feedToken(house.id), token);

  const res = await fetch(`${URL_}/api/hm/feed/${token}.ics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  const text = await res.text();
  assert.match(text, /X-WR-CALNAME:Wir/);
  assert.match(text, /SUMMARY:Schwimmen\\, Halle 2/);
  assert.match(text, /DTSTART:20991103T170000/);
  assert.match(text, /RRULE:FREQ=WEEKLY/);
  assert.match(text, /DESCRIPTION:wer: Anna/);

  const renewed = await anna.c.newFeedToken(house.id);
  assert.notEqual(renewed, token);
  assert.equal((await fetch(`${URL_}/api/hm/feed/${token}.ics`)).status, 404);
  await anna.c.feedOff(house.id);
  assert.equal((await fetch(`${URL_}/api/hm/feed/${renewed}.ics`)).status, 404);
  assert.equal(await anna.c.feedToken(house.id), '');
});
