// Start, Aktionen, Ereignisse. Einzige Stelle, die die Uhr liest und den Zufall holt.
import {
  makeId, newList, newItem, newEvent, newRecord, change, sanitizeSettings, buildExport, parseImport,
  DEFAULT_SETTINGS, COLLECTIONS, SANITIZERS,
} from './model.js';
import {
  splitQuickAdd, itemsOf, serverAddress, addressWarning, guessStorage, fromTemplate, parseAmount, parseDayMonth,
} from './logic.js';
import * as storage from './storage.js';
import { createClient, markDirty, syncOnce, subscribe } from './sync.js';
import { renderShell, on } from './ui.js';
import { DEFAULT_LIST_NAME, MSG, IMPORT_ERROR, SYNC, ADDRESS_ERROR, errorText } from './texts.js';

const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

const root = document.getElementById('app');
const rid = () => makeId(crypto.getRandomValues(new Uint8Array(15)));
const now = () => Date.now();
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let store; let client = null; let unsubscribe = () => {}; let syncTimer = 0; let syncing = false; let again = false;

const state = {
  data: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  settings: { ...DEFAULT_SETTINGS },
  session: null, // { serverUrl, token, user:{id,email,name}, household:{id,name,inviteCode}|null }
  householdId: '',
  members: [],
  tab: 'today', shopListId: '', taskListId: '', templateId: '', projectId: '', lastCategory: 'other',
  editing: null, calOffset: 0, mealOffset: 0, flash: '',
  sync: { status: 'local', at: 0, message: '' },
  today: localToday(),
  setup: false, // Einrichtung beim ersten Start
  setupMode: 'local', // gewählter Speicherort im Formular
  pageProtocol: location.protocol,
  // Wurde die App direkt vom Server geöffnet (z. B. über Tailscale), ist das die Serveradresse. GitHub Pages ist kein Server.
  defaultServer: /^https?:$/.test(location.protocol) && !location.hostname.endsWith('github.io') && !['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin : '',
};

// ---- Darstellung -------------------------------------------------------------

function applyTheme() {
  if (state.settings.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', state.settings.theme);
}

function render(focusSelector) {
  state.today = localToday();
  state.now = fmtTime.format(new Date());
  const active = document.activeElement;
  const form = active && active.name ? active.closest('form') : null;
  const keep = focusSelector || (form ? `form[data-form="${form.dataset.form}"] [name="${active.name}"]` : null);
  const typed = !focusSelector && form && 'value' in active ? { value: active.value, start: active.selectionStart } : null;
  root.innerHTML = renderShell(state);
  const el = keep ? root.querySelector(keep) : null;
  if (!el) return;
  el.focus();
  if (typed && el.value !== typed.value) { el.value = typed.value; try { el.setSelectionRange(typed.start, typed.start); } catch { /* kein Textfeld */ } }
}

function flash(text) { state.flash = text; render(); setTimeout(() => { if (state.flash === text) { state.flash = ''; render(); } }, 4000); }

// ---- Daten -------------------------------------------------------------------

async function loadData() {
  for (const c of COLLECTIONS) state.data[c] = await store.all(c);
}

const ctx = () => ({ id: rid(), household: state.householdId, now: now(), user: state.session?.user.id || null });

async function save(collection, record) {
  await store.put(collection, record);
  const arr = state.data[collection];
  const i = arr.findIndex((r) => r.id === record.id);
  if (i >= 0) arr[i] = record; else arr.push(record);
  if (state.session?.household) { await markDirty(store, collection, record); scheduleSync(600); }
}

const update = (collection, id, fields) => {
  const rec = state.data[collection].find((r) => r.id === id);
  return rec ? save(collection, change(collection, rec, fields, now(), state.session?.user.id || null)) : null;
};

const LIST_KEY = { shopping: 'shopListId', tasks: 'taskListId', template: 'templateId' };

async function ensureLists() {
  for (const kind of ['shopping', 'tasks', 'template']) {
    const lists = state.data.lists.filter((l) => l.kind === kind && !l.deleted && !l.archived).sort((a, b) => a.sort - b.sort);
    if (lists.length === 0 && kind !== 'template') { const l = newList(ctx(), kind, DEFAULT_LIST_NAME[kind]); await save('lists', l); lists.push(l); }
    if (!lists.some((l) => l.id === state[LIST_KEY[kind]])) state[LIST_KEY[kind]] = lists[0]?.id || '';
  }
}

async function saveSettings(fields) {
  state.settings = sanitizeSettings({ ...state.settings, ...fields });
  await store.setMeta('settings', state.settings);
}

/** Einträge einer Vorlage in eine Liste übernehmen. */
async function applyTemplate(templateId, listId) {
  const target = state.data.lists.find((l) => l.id === listId);
  if (!templateId || !target) return;
  const add = fromTemplate(itemsOf(state.data.items, templateId), itemsOf(state.data.items, listId));
  for (const it of add) {
    await save('items', newItem(ctx(), listId, it.title, target.kind === 'shopping' ? { quantity: it.quantity, category: it.category } : { note: it.note }));
  }
  state.tab = target.kind; state[LIST_KEY[target.kind]] = listId;
  flash(MSG.templateApplied(add.length));
}

/**
 * Speicherort aus dem Formular übernehmen (Einrichtung und Mehr): nur Gerät, oder anmelden / Konto anlegen.
 * @returns {Promise<boolean>} true, wenn es geklappt hat
 */
async function chooseStorage(f, submitter) {
  const fd = new FormData(f);
  const mode = fd.get('storage') || 'local';
  if (mode === 'local') { await saveSettings({ storage: 'local' }); return true; }
  const addr = serverAddress(mode, { host: fd.get('host'), tailnet: fd.get('tailnet'), port: fd.get('port'), url: fd.get('url') });
  if (!addr.ok) { alert(ADDRESS_ERROR[addr.error]); return false; }
  if (addressWarning(addr.url, location.protocol) === 'mixed') { alert(`${MSG.mixedContent}\n\n${addr.url}`); return false; }
  const c = createClient(addr.url);
  const email = String(fd.get('email') || ''); const password = String(fd.get('password') || '');
  try {
    if (submitter?.value === 'register') {
      try { await c.register(email, password, String(fd.get('name') || '')); } catch (err) { if (err.status) { alert(MSG.registerFailed); return false; } throw err; }
    }
    const r = await c.login(email, password).catch((err) => { if (err.status) { alert(MSG.loginFailed); return null; } throw err; });
    if (!r) return false;
    await saveSettings({ serverUrl: addr.url, storage: mode });
    state.session = { serverUrl: addr.url, token: r.token, user: r.user, household: null };
    await store.setMeta('session', state.session);
    await connect();
    return true;
  } catch { alert(MSG.serverUnreachable); return false; }
}

/** Alle lokalen Einträge in einen anderen Haushalt verschieben (nach Beitritt). Leere Listen fallen weg. */
async function moveToHousehold(householdId) {
  state.householdId = householdId;
  await store.setMeta('household', householdId);
  for (const c of COLLECTIONS) {
    for (const r of state.data[c]) {
      if (r.household === householdId) continue;
      const empty = c === 'lists' && itemsOf(state.data.items, r.id).length === 0;
      await save(c, change(c, r, { household: householdId, deleted: r.deleted || empty }, now(), state.session?.user.id || null));
    }
  }
}

// ---- Abgleich ------------------------------------------------------------------

function setSync(status, message = '') {
  state.sync = { status, at: status === 'ok' ? now() : state.sync.at, message };
  const el = root.querySelector('.sync');
  if (!el) return;
  el.dataset.status = state.session ? status : 'local';
  el.textContent = !state.session ? SYNC.local : status === 'ok' ? `${SYNC.ok} ${fmtTime.format(new Date(state.sync.at))}` : (message || SYNC[status] || '');
}

function scheduleSync(ms = 0) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, ms);
}

async function runSync() {
  if (!client || !state.session?.household) return;
  if (syncing) { again = true; return; }
  syncing = true;
  setSync('syncing');
  try {
    const r = await syncOnce(client, store, state.session.household.id);
    if (r.pulled) { await loadData(); await ensureLists(); render(); }
    setSync('ok');
  } catch (err) {
    setSync(navigator.onLine === false ? 'offline' : 'error', errorText(err));
  } finally {
    syncing = false;
    if (again) { again = false; scheduleSync(0); }
  }
}

async function connect() {
  const s = state.session;
  client = createClient(s.serverUrl);
  client.setToken(s.token);
  try {
    const r = await client.refresh();
    s.token = r.token; s.user = r.user;
    const households = await client.households();
    const current = households.find((h) => h.id === s.household?.id) || households[0] || null;
    s.household = current ? { id: current.id, name: current.name, inviteCode: current.inviteCode } : null;
    await store.setMeta('session', s);
    if (s.household && s.household.id !== state.householdId) await moveToHousehold(s.household.id);
    // Private Geschenkideen, die vor der Anmeldung entstanden sind, gehören ab jetzt diesem Konto.
    for (const g of state.data.gifts.filter((x) => x.private && !x.owner)) await update('gifts', g.id, { owner: s.user.id });
    if (s.household) {
      state.members = (await client.members()).filter((m) => m.household === s.household.id);
      unsubscribe(); unsubscribe = subscribe(client, () => scheduleSync(300));
      scheduleSync(0);
    }
    render();
  } catch (err) {
    setSync(err?.status === 401 ? 'auth' : 'offline', errorText(err));
  }
}

// ---- Aktionen --------------------------------------------------------------------

const actions = {
  tab: (el) => { state.tab = el.dataset.tab; state.editing = null; render(); },
  toggle: (el) => update('items', el.dataset.id, { done: el.checked }),
  'set-category': (el) => { state.lastCategory = el.value; return update('items', el.dataset.id, { category: el.value }); },
  'pick-list': (el) => { state[LIST_KEY[el.dataset.kind]] = el.value; render(); },
  'new-list': async (el) => {
    const name = prompt(el.dataset.kind === 'template' ? 'Name der Vorlage' : 'Name der neuen Liste', el.dataset.kind === 'template' && !state.templateId ? DEFAULT_LIST_NAME.template : ''); if (!name) return;
    const l = newList(ctx(), el.dataset.kind, name); await save('lists', l);
    state[LIST_KEY[el.dataset.kind]] = l.id; render();
  },
  'rename-list': async (el) => {
    const l = state.data.lists.find((x) => x.id === el.dataset.id);
    const name = prompt('Neuer Name', l?.name || ''); if (!name) return;
    await update('lists', l.id, { name }); render();
  },
  'clear-done': async (el) => {
    if (!confirm(MSG.confirmClearDone)) return;
    for (const i of itemsOf(state.data.items, el.dataset.id).filter((x) => x.done)) await update('items', i.id, { deleted: true });
    render();
  },
  edit: (el) => { state.editing = state.editing === el.dataset.id ? null : el.dataset.id; render(); },
  'delete-item': async (el) => { await update('items', el.dataset.id, { deleted: true }); state.editing = null; render(); },
  'edit-event': (el) => { state.editing = el.dataset.id; render(); root.querySelector('.event-form')?.scrollIntoView({ block: 'start' }); },
  'cancel-edit': () => { state.editing = null; render(); },
  'delete-event': async (el) => { if (!confirm(MSG.confirmDeleteEvent)) return; await update('events', el.dataset.id, { deleted: true }); state.editing = null; render(); },
  'cal-move': (el) => { state.calOffset += Number(el.dataset.step); render(); },
  'meal-move': (el) => { state.mealOffset += Number(el.dataset.step); render(); },
  theme: async (el) => { await saveSettings({ theme: el.value }); applyTheme(); render(); },
  'pick-storage': (el) => {
    // Nur ein- und ausblenden, nicht neu zeichnen, damit Eingetipptes erhalten bleibt.
    state.setupMode = el.value;
    for (const box of el.form.querySelectorAll('[data-modes]')) {
      const show = box.dataset.modes.split(' ').includes(el.value);
      box.hidden = !show;
      if (box.tagName === 'FIELDSET') box.disabled = !show;
    }
  },
  'toggle-module': async (el) => {
    const set = new Set(state.settings.modules);
    if (el.checked) set.add(el.value); else set.delete(el.value);
    await saveSettings({ modules: [...set] }); render();
  },
  delete: async (el) => {
    if (el.dataset.confirm && !confirm(MSG.confirmDelete)) return;
    await update(el.dataset.collection, el.dataset.id, { deleted: true });
    state.editing = null;
    if (el.dataset.id === state.projectId) state.projectId = '';
    if (el.dataset.collection === 'lists') await ensureLists();
    render();
  },
  unpin: async (el) => { await update('notes', el.dataset.id, on(state, 'notes') ? { pinned: false } : { deleted: true }); render(); },
  'chore-done': async (el) => {
    await update('chores', el.dataset.id, el.checked ? { lastDone: state.today, doneBy: state.session?.user.id || null } : { lastDone: null, doneBy: null });
    render();
  },
  settle: async (el) => {
    await save('expenses', newRecord('expenses', ctx(), { kind: 'settle', title: 'Ausgleich', amount: Number(el.dataset.cents), date: state.today, paidBy: el.dataset.from, people: [el.dataset.to] }));
    render();
  },
  'open-project': (el) => { state.projectId = el.dataset.id; state.editing = null; render(); scrollTo(0, 0); },
  'archive-project': async (el) => {
    const p = state.data.lists.find((l) => l.id === el.dataset.id);
    await update('lists', p.id, { archived: !p.archived }); state.projectId = ''; render();
  },
  'gift-status': (el) => update('gifts', el.dataset.id, { status: el.value }),
  'apply-template': (el) => applyTemplate(el.value, el.dataset.list),
  'apply-template-from': (el) => applyTemplate(el.dataset.template, el.value),
  'sync-now': () => scheduleSync(0),
  'copy-code': async () => { try { await navigator.clipboard.writeText(state.session.household.inviteCode); flash(MSG.copied); } catch { /* Kopieren nicht erlaubt */ } },
  logout: async () => {
    if (!confirm(MSG.confirmLogout)) return;
    unsubscribe(); client = null; state.session = null; state.members = [];
    state.setupMode = state.settings.storage;
    await store.setMeta('session', null); render();
  },
  export: async () => {
    const data = buildExport(state.data, state.settings, new Date().toISOString());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `hugin-munin-${state.today}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: async (el) => {
    const file = el.files?.[0]; if (!file) return;
    const r = parseImport(await file.text());
    el.value = '';
    if (!r.ok) { alert(IMPORT_ERROR[r.error]); return; }
    const n = COLLECTIONS.reduce((s, c) => s + r.data[c].length, 0);
    if (!confirm(MSG.confirmImport(n))) return;
    for (const c of COLLECTIONS) {
      for (const rec of r.data[c]) await save(c, SANITIZERS[c]({ ...rec, household: state.householdId, changedAt: Math.max(rec.changedAt, now()) }));
    }
    await ensureLists(); flash(MSG.imported(n, r.skipped));
  },
};

const forms = {
  'add-shopping': async (f) => {
    const category = f.category.value; state.lastCategory = category;
    for (const p of splitQuickAdd(f.text.value)) await save('items', newItem(ctx(), state.shopListId, p.title, { quantity: p.quantity, category }));
    render('form[data-form="add-shopping"] [name="text"]');
  },
  'add-task': async (f) => {
    await save('items', newItem(ctx(), state.taskListId, f.title.value, { dueDate: f.dueDate.value || null }));
    render('form[data-form="add-task"] [name="title"]');
  },
  'edit-task': async (f) => {
    await update('items', f.dataset.id, {
      title: f.title.value, dueDate: f.dueDate.value || null, note: f.note.value,
      assignee: f.assignee ? f.assignee.value || null : null, important: f.important.checked,
    });
    state.editing = null; render();
  },
  'save-event': async (f) => {
    const fields = {
      title: f.title.value, startDate: f.startDate.value, endDate: f.endDate.value || f.startDate.value,
      startTime: f.startTime.value || null, endTime: f.endTime.value || null, repeat: f.repeat.value,
      repeatInterval: Number(f.repeatInterval.value) || 1, repeatUntil: f.repeatUntil.value || null,
      notes: f.notes.value, people: [...f.querySelectorAll('[name="people"]:checked')].map((x) => x.value),
    };
    if (f.dataset.id) await update('events', f.dataset.id, fields);
    else await save('events', newEvent(ctx(), fields));
    state.editing = null; render();
  },
  setup: async (f, submitter) => {
    await saveSettings({ modules: new FormData(f).getAll('modules') });
    if (!(await chooseStorage(f, submitter))) return;
    state.setup = false; await store.setMeta('setupPending', false);
    if (state.session && !state.session.household) state.tab = 'more';
    render();
  },
  login: async (f, submitter) => { if (await chooseStorage(f, submitter)) render(); },
  'add-pin': async (f) => {
    await save('notes', newRecord('notes', ctx(), { body: f.body.value, pinned: true }));
    render('form[data-form="add-pin"] [name="body"]');
  },
  'add-meal': async (f) => {
    await save('meals', newRecord('meals', ctx(), { date: f.date.value, slot: f.slot.value, title: f.title.value }));
    render('form[data-form="add-meal"] [name="title"]');
  },
  'save-chore': async (f) => {
    const fields = {
      title: f.title.value, unit: f.unit.value, interval: Number(f.interval.value) || 1, startDate: f.startDate.value,
      people: [...f.querySelectorAll('[name="people"]:checked')].map((x) => x.value),
    };
    if (f.dataset.id) await update('chores', f.dataset.id, fields);
    else await save('chores', newRecord('chores', ctx(), { ...fields }));
    state.editing = null; render();
  },
  'add-expense': async (f) => {
    const amount = parseAmount(f.amount.value);
    if (amount === null) { alert(MSG.badAmount); return; }
    // Beteiligte ausdrücklich speichern, damit alte Ausgaben nicht auf später Dazugekommene verteilt werden.
    const people = [...f.querySelectorAll('[name="people"]:checked')].map((x) => x.value);
    await save('expenses', newRecord('expenses', ctx(), {
      kind: 'expense', title: f.title.value, amount, date: f.date.value,
      paidBy: f.paidBy ? f.paidBy.value : state.session?.user.id || null, people,
    }));
    render();
  },
  'add-project': async (f) => {
    const l = newList(ctx(), 'project', f.name.value); await save('lists', l);
    state.projectId = l.id; render('form[data-form="add-step"] [name="title"]');
  },
  'add-step': async (f) => {
    await save('items', newItem(ctx(), f.dataset.list, f.title.value, { dueDate: f.dueDate.value || null }));
    render('form[data-form="add-step"] [name="title"]');
  },
  'save-note': async (f) => {
    const fields = { title: f.title.value, body: f.body.value, ...(f.pinned ? { pinned: f.pinned.checked } : {}) };
    if (!fields.title.trim() && !fields.body.trim()) return;
    if (f.dataset.id) await update('notes', f.dataset.id, fields);
    else await save('notes', newRecord('notes', ctx(), { ...fields }));
    state.editing = null; render();
  },
  'save-contact': async (f) => {
    const birthday = f.birthday.value.trim() ? parseDayMonth(f.birthday.value) : null;
    if (f.birthday.value.trim() && !birthday) { alert(MSG.badBirthday); return; }
    const fields = {
      name: f.name.value, birthday, birthYear: Number(f.birthYear.value) || null, phone: f.phone.value,
      email: f.email.value, address: f.address.value, note: f.note.value,
    };
    if (f.dataset.id) await update('contacts', f.dataset.id, fields);
    else await save('contacts', newRecord('contacts', ctx(), { ...fields }));
    state.editing = null; render();
  },
  'add-gift': async (f) => {
    const extra = f.extra.value.trim(); const isLink = /^https?:\/\/\S+$/.test(extra);
    await save('gifts', newRecord('gifts', ctx(), {
      forName: f.forName.value, title: f.title.value, link: isLink ? extra : null, note: isLink ? null : extra,
      private: f.private.checked, owner: state.session?.user.id || null,
    }));
    render('form[data-form="add-gift"] [name="title"]');
  },
  'add-template-item': async (f) => {
    const category = f.category.value; state.lastCategory = category;
    for (const p of splitQuickAdd(f.text.value)) await save('items', newItem(ctx(), state.templateId, p.title, { quantity: p.quantity, category }));
    render('form[data-form="add-template-item"] [name="text"]');
  },
  'create-household': async (f) => {
    const inviteCode = rid() + rid().slice(0, 9);
    const h = await client.createHousehold({ id: state.householdId, name: f.name.value, members: [state.session.user.id], inviteCode });
    state.session.household = { id: h.id, name: h.name, inviteCode: h.inviteCode };
    await store.setMeta('session', state.session);
    for (const c of COLLECTIONS) for (const r of state.data[c]) await markDirty(store, c, r);
    await connect();
  },
  join: async (f) => {
    if (state.data.items.some((i) => !i.deleted) && !confirm(MSG.confirmJoin)) return;
    try {
      const h = await client.join(f.code.value.trim());
      state.session.household = { id: h.id, name: h.name, inviteCode: f.code.value.trim() };
      await store.setMeta('session', state.session);
      await moveToHousehold(h.id);
      await connect();
    } catch (err) { alert(err?.status === 404 || err?.status === 400 ? MSG.joinFailed : errorText(err)); }
  },
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || isInput(el)) return;
  actions[el.dataset.action]?.(el);
});
const isInput = (el) => el.tagName === 'SELECT' || ['checkbox', 'radio', 'file'].includes(el.type);
root.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && isInput(el)) actions[el.dataset.action]?.(el);
});
root.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  forms[f.dataset.form]?.(f, e.submitter);
});
root.addEventListener('keydown', (e) => {
  if (e.target.getAttribute('role') !== 'tab' || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const next = tabs[(tabs.indexOf(e.target) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  actions.tab(next); root.querySelector(`[data-tab="${next.dataset.tab}"]`)?.focus();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { render(); scheduleSync(0); } });
addEventListener('online', () => scheduleSync(0));
setInterval(() => scheduleSync(0), 60000);

// ---- Start -----------------------------------------------------------------------

async function start() {
  store = await storage.open();
  const savedSettings = await store.getMeta('settings');
  state.settings = sanitizeSettings(savedSettings || { ...DEFAULT_SETTINGS, storage: guessStorage(state.defaultServer), serverUrl: state.defaultServer });
  state.setupMode = state.settings.storage;
  state.householdId = (await store.getMeta('household')) || rid();
  await store.setMeta('household', state.householdId);
  state.session = (await store.getMeta('session')) || null;
  applyTheme();
  await loadData();
  // Erster Start: noch nichts gespeichert (Version 1 hatte schon Listen, dann keine Einrichtung).
  if (!savedSettings && !state.session && state.data.lists.length === 0) await store.setMeta('setupPending', true);
  state.setup = (await store.getMeta('setupPending')) === true;
  await ensureLists();
  render();
  if (state.session) await connect();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

start().catch((err) => { root.textContent = String(err); });
