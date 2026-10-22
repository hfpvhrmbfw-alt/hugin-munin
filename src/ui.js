// Oberfläche: Zustand der Ansicht und Rendering. Formatiert Daten aus der Logik zu Text und HTML.
// Aufbau nach Castra · Blei (mobil): .app > .apphead, main.wrap (.bigtitle, .item …), .tabbar
import { SHOPPING_CATEGORIES, REPEATS, MODULES, STORAGE_MODES, MEAL_SLOTS, CHORE_UNITS, GIFT_STATUS as GIFT_STATUSES, DEFAULT_PORT } from './model.js';
import {
  groupShopping, sortTasks, itemsOf, overview, agenda, addDays, alive, tabLayout, addressFields, choreState, balances,
  settleUp, monthTotal, upcomingBirthdays, nextBirthday, mealWeek, pinnedNotes, visibleGifts, progress, weekStart,
  shoppingHistory, search,
} from './logic.js';
import {
  APP_NAME, TABS, CATEGORY, REPEAT, REPEAT_EVERY, THEME, SYNC, MSG, MODULE, STORAGE, MEAL_SLOT, CHORE_UNIT, GIFT_STATUS, AREA, RAVEN,
} from './texts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;

const fmtDay = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtRange = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtMoney = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const money = (cents) => fmtMoney.format(cents / 100);
const dayMonth = (mmdd) => `${Number(mmdd.slice(3))}.${Number(mmdd.slice(0, 2))}.`;
const asDate = (iso) => new Date(iso + 'T00:00:00Z');

/** "heute", "morgen", "gestern" oder Datum. */
export function dayLabel(iso, today, long = false) {
  if (iso === today) return 'heute';
  if (iso === addDays(today, 1)) return 'morgen';
  if (iso === addDays(today, -1)) return 'gestern';
  return (long ? fmtDay : fmtShort).format(asDate(iso));
}

const memberName = (state, id) => state.members.find((m) => m.id === id)?.name || '';

/**
 * Kleines Zeichen für eine Person: Anfangsbuchstabe in ihrer Farbe. Die Farbe folgt der Reihenfolge der IDs,
 * damit sie auf allen Geräten gleich ist. Nur, wenn mehr als eine Person im Haushalt ist.
 */
export function who(state, id) {
  if (!id || state.members.length < 2) return '';
  const ids = state.members.map((m) => m.id).sort();
  const i = ids.indexOf(id);
  if (i < 0) return '';
  const name = memberName(state, id) || '?';
  return `<span class="who p${i % 4}" title="${attr(name)}" aria-label="${attr(name)}">${esc(name.trim().charAt(0).toLowerCase() || '?')}</span>`;
}

/** Leere Seite mit Rabe. */
const emptyState = (motif, text) => `<div class="empty-state"><span class="raven" style="--raven:url('icons/${RAVEN[motif] || RAVEN.today}')" aria-hidden="true"></span><p>${esc(text)}</p></div>`;

/** Alle Termine: eigene und die aus fremden Kalendern (nur die von noch eingetragenen Kalendern). */
function allEvents(state) {
  const cals = new Map(alive(state.data.calendars || []).map((c) => [c.id, c]));
  const feeds = Object.entries(state.feeds || {}).filter(([id]) => cals.has(id)).flatMap(([, f]) => f.events || []);
  return feeds.length ? state.data.events.concat(feeds) : state.data.events;
}
/** Ist ein Modul eingeschaltet? */
export const on = (state, module) => state.settings.modules.includes(module);

const group = (text) => `<h2 class="cap group">${esc(text)}</h2>`;
const sep = '<span class="sep">·</span>';

// Linien-Symbole, 24er Raster, Strich aus dem Stylesheet
const ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  shopping: '<path d="M5.5 8h13l-1 12h-11z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  tasks: '<path d="M4 7l2 2 3.5-3.5M4 16l2 2 3.5-3.5M13 8h7M13 17h7"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  meals: '<circle cx="12" cy="13" r="6.5"/><path d="M3 4v5a2 2 0 0 0 2 2V20M21 4c-1.5 1-2 3-2 5s.8 2 2 2v9"/>',
  chores: '<path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  expenses: '<circle cx="12" cy="12" r="8"/><path d="M15 8.8a3.5 3.5 0 1 0 0 6.4M8 11h5M8 13.5h5"/>',
  projects: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  notes: '<path d="M6 3.5h9l4 4V20.5H6z"/><path d="M14.5 3.5v4.5H19M9 12h6M9 16h6"/>',
  contacts: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  gifts: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S12 9 12 9zM12 9c2-4 6-4 6-1.5S12 9 12 9z"/>',
  templates: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  share: '<path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8.5 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-2"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const iconBtn = (name, label, data) => `<button class="iconbtn" type="button" aria-label="${attr(label)}" title="${attr(label)}" ${data}>${icon(name)}</button>`;

// ---- Rahmen ------------------------------------------------------------------

/** Tab, der wirklich gezeigt wird: ausgeschaltete Module fallen auf "Heute" zurück. */
export function currentTab(state) {
  return ['today', 'more', 'search'].includes(state.tab) || on(state, state.tab) ? state.tab : 'today';
}

export function renderShell(state) {
  if (state.setup) return renderSetup(state);
  state.events = allEvents(state); // einmal je Zeichnen, für Heute und Kalender
  const tab = currentTab(state);
  const layout = tabLayout(state.settings.modules);
  const selected = tab === 'search' ? '' : layout.bar.includes(tab) ? tab : 'more';
  const tabs = layout.bar.map((id) =>
    `<button role="tab" type="button" data-action="tab" data-tab="${id}" aria-selected="${selected === id}" tabindex="${selected === id ? 0 : -1}">${icon(id)}${TABS[id]}</button>`).join('');
  const s = state.sync;
  const syncText = !state.session ? SYNC.local
    : s.status === 'ok' ? `${SYNC.ok} ${fmtTime.format(new Date(s.at))}` : (s.message || SYNC[s.status] || '');
  return `<div class="app">
  <header class="apphead"><div class="wrap"><h1>${esc(APP_NAME)}</h1>
    <span class="sync cap" data-status="${attr(state.session ? s.status : 'local')}" role="status">${esc(syncText)}</span>
    ${iconBtn('search', 'Suche', `data-action="tab" data-tab="search"${tab === 'search' ? ' aria-current="page"' : ''}`)}</div></header>
  <main class="wrap" id="main">${flashNote(state)}${renderTab(state, tab)}</main>
  ${state.undo ? `<div class="toast" role="status"><span>${esc(state.undo.text)}</span><button class="btn small" type="button" data-action="undo">rückgängig</button></div>` : ''}
  <nav class="tabbar" aria-label="Bereiche"><div class="wrap" role="tablist">${tabs}</div></nav></div>`;
}

const flashNote = (state) => (state.flash ? `<div class="note info" role="status"><span class="cap">hinweis</span>${esc(state.flash)}</div>` : '');

function renderTab(state, tab) {
  switch (tab) {
    case 'shopping': return renderShopping(state);
    case 'tasks': return renderTasks(state);
    case 'calendar': return renderCalendar(state);
    case 'meals': return renderMeals(state);
    case 'chores': return renderChores(state);
    case 'expenses': return renderExpenses(state);
    case 'projects': return renderProjects(state);
    case 'notes': return renderNotes(state);
    case 'contacts': return renderContacts(state);
    case 'gifts': return renderGifts(state);
    case 'templates': return renderTemplates(state);
    case 'more': return renderMore(state);
    case 'search': return renderSearch(state);
    default: return renderToday(state);
  }
}

// ---- Zeilen ------------------------------------------------------------------

function eventParts(state, occ, today) {
  const ev = (state.events || state.data.events).find((e) => e.id === occ.eventId);
  const multi = occ.start !== occ.end;
  const cal = ev.feed ? state.data.calendars.find((c) => c.id === ev.feed) : null;
  const sub = [
    !ev.startTime ? 'ganztägig' : ev.endTime ? `bis ${ev.endTime}` : '',
    multi ? `${dayLabel(occ.start, today)} bis ${dayLabel(occ.end, today)}` : '',
    ev.feed ? ev.notes || '' : '',
  ].filter(Boolean).map(esc).join(sep);
  const people = ev.people.map((p) => who(state, p) || esc(memberName(state, p))).filter(Boolean).join('');
  const tag = cal ? `<span class="tag">${esc(cal.title || 'kalender')}</span>` : '';
  return { ev, inner: `<span class="t"><b>${esc(ev.title || 'Termin')}</b>${sub || tag ? `<span>${sub}${tag}</span>` : ''}</span>${people}<span class="n">${esc(ev.startTime || '')}</span>` };
}

function eventLine(state, occ, today, current = false) {
  return `<div class="item"${current ? ' aria-current="true"' : ''}>${eventParts(state, occ, today).inner}</div>`;
}

function taskTags(state, item, today, showDue) {
  const overdue = item.dueDate && item.dueDate < today && !item.done;
  return [
    item.dueDate && (showDue || overdue) ? `<span class="tag${overdue ? ' acc' : ''}">${esc(dayLabel(item.dueDate, today))}</span>` : '',
    item.important ? '<span class="tag inv">wichtig</span>' : '',
    item.assignee && !who(state, item.assignee) ? `<span class="tag">${esc(memberName(state, item.assignee))}</span>` : '',
  ].join('');
}

/** Zeile zum Abhaken. Nach rechts wischen hakt ab, nach links löscht. */
function checkLine(item, title, sub, extra = '') {
  return `<div class="item" data-swipe data-id="${item.id}"><label class="check"><input type="checkbox" data-action="toggle" data-id="${item.id}" ${item.done ? 'checked' : ''}>
    <span class="t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span></label>${extra}</div>`;
}

const taskLine = (state, item, today) => checkLine(item, esc(item.title), taskTags(state, item, today, false), who(state, item.assignee));

// ---- Heute -----------------------------------------------------------------

/** Daten für "Heute" und den Kalender ohne ausgeschaltete Module. */
function visibleData(state) {
  const d = state.data;
  return {
    ...d,
    events: on(state, 'calendar') ? d.events : [],
    lists: d.lists.filter((l) => (l.kind !== 'tasks' || on(state, 'tasks')) && (l.kind !== 'shopping' || on(state, 'shopping'))),
  };
}

function renderToday(state) {
  const o = overview({ ...visibleData(state), events: on(state, 'calendar') ? state.events : [] }, state.today);
  const byId = new Map(state.data.items.map((i) => [i.id, i]));
  const plan = o.todayPlan;
  // Fokus: der nächste Termin, der heute noch nicht vorbei ist
  const now = state.now || '';
  const evOf = (occ) => state.events.find((e) => e.id === occ.eventId);
  const next = plan ? plan.events.find((occ) => { const ev = evOf(occ); return ev.startTime && (ev.endTime || ev.startTime) >= now; }) : null;
  const todayRows = plan ? plan.events.map((e) => eventLine(state, e, state.today, e === next)).join('') + plan.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('') : '';
  const week = o.week.map((d) => `<div class="day">${group(dayLabel(d.date, state.today, true))}
    ${d.events.map((e) => eventLine(state, e, state.today)).join('')}${d.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</div>`).join('');
  const meta = [
    esc(fmtDay.format(asDate(state.today))),
    on(state, 'shopping') ? esc(MSG.shoppingOpen(o.shoppingOpen)) : '',
    o.overdue.length ? esc(MSG.overdue(o.overdue.length)) : '',
  ].filter(Boolean).join(sep);
  const hasPlan = on(state, 'calendar') || on(state, 'tasks');
  const extras = todayMeals(state) + todayChores(state);
  return `
  <h1 class="bigtitle">heute</h1>
  <p class="meta-line">${meta}</p>
  ${on(state, 'board') ? todayBoard(state) : ''}
  ${o.overdue.length ? `<section class="section">${group('überfällig')}${o.overdue.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</section>` : ''}
  ${hasPlan || on(state, 'meals') || on(state, 'chores') ? `<section class="section">${group('heute')}${extras}${todayRows || (extras ? '' : emptyState('today', MSG.nothingToday))}</section>` : ''}
  ${on(state, 'contacts') ? todayBirthdays(state) : ''}
  ${hasPlan ? `<section class="section"><h2 class="head2">diese woche</h2>${week || `<p class="empty">${esc(MSG.nothingWeek)}</p>`}</section>` : ''}`;
}

function todayBoard(state) {
  const notes = pinnedNotes(state.data.notes);
  const cards = notes.map((n) => `<div class="pin"><div class="t">${n.title ? `<b>${esc(n.title)}</b>` : ''}${n.body ? `<p>${esc(n.body)}</p>` : ''}
    ${who(state, n.changedBy) || `<span class="cap">${esc(memberName(state, n.changedBy) || '')}</span>`}</div>${iconBtn('close', 'Abnehmen', `data-action="unpin" data-id="${n.id}"`)}</div>`).join('');
  return `<section class="section board">${group('pinnwand')}${cards}
    <form class="search" data-form="add-pin"><input name="body" autocomplete="off" aria-label="Auf die Pinnwand" placeholder="Nachricht an alle" required>
    <button class="iconbtn" type="submit" aria-label="Anheften" title="Anheften">${icon('plus')}</button></form></section>`;
}

function todayMeals(state) {
  if (!on(state, 'meals')) return '';
  const meals = alive(state.data.meals).filter((m) => m.date === state.today).sort((a, b) => MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot));
  return meals.map((m) => `<div class="item"><span class="t"><b>${esc(m.title)}</b><span>essen${sep}${esc(MEAL_SLOT[m.slot])}</span></span></div>`).join('');
}

function todayChores(state) {
  if (!on(state, 'chores')) return '';
  return alive(state.data.chores).map((c) => ({ c, st: choreState(c, state.today) }))
    .filter(({ st }) => !st.notYet && !st.done)
    .map(({ c, st }) => choreLine(state, c, st)).join('');
}

function todayBirthdays(state) {
  const list = upcomingBirthdays(state.data.contacts, state.today, 14);
  if (!list.length) return '';
  const byId = new Map(state.data.contacts.map((c) => [c.id, c]));
  return `<section class="section">${group('geburtstage')}${list.map((b) => birthdayLine(state, byId.get(b.contactId), b)).join('')}</section>`;
}

function birthdayLine(state, c, b) {
  const when = b.inDays === 0 ? 'heute' : b.inDays === 1 ? 'morgen' : `in ${b.inDays} tagen`;
  return `<div class="item"${b.inDays === 0 ? ' aria-current="true"' : ''}><span class="t"><b>${esc(c.name)}</b><span>${esc(dayLabel(b.date, state.today))}${b.age !== null ? `${sep}wird ${b.age}` : ''}</span></span><span class="n">${esc(when)}</span></div>`;
}

// ---- Listen ------------------------------------------------------------------

function listPicker(state, kind, currentId) {
  const lists = alive(state.data.lists).filter((l) => l.kind === kind && !l.archived).sort((a, b) => a.sort - b.sort);
  const opts = lists.map((l) => `<option value="${l.id}" ${l.id === currentId ? 'selected' : ''}>${esc(l.name.toLocaleLowerCase('de-DE'))}</option>`).join('');
  return `<div class="listbar">
    <label class="field"><select aria-label="Liste" data-action="pick-list" data-kind="${kind}">${opts}</select></label>
    ${kind !== 'template' ? iconBtn('share', 'Liste teilen', `data-action="share-list" data-id="${currentId}"`) : ''}
    ${iconBtn('edit', 'Liste umbenennen', `data-action="rename-list" data-id="${currentId}"`)}
    ${iconBtn('plus', 'Neue Liste', `data-action="new-list" data-kind="${kind}"`)}</div>`;
}

function doneBlock(listId, rows) {
  return `<details><summary>erledigt (${rows.length})</summary><div>${rows.join('')}
    <div class="actions-row"><button class="btn small" type="button" data-action="clear-done" data-id="${listId}">Erledigte entfernen</button></div></div></details>`;
}

function renderShopping(state) {
  const list = state.data.lists.find((l) => l.id === state.shopListId);
  if (!list) return '';
  const g = groupShopping(itemsOf(state.data.items, list.id));
  const open = g.open.reduce((n, grp) => n + grp.items.length, 0);
  const groups = g.open.map((grp) => `<section class="section">${group(CATEGORY[grp.category])}
    ${grp.items.map((i) => shopRow(state, i)).join('')}</section>`).join('');
  // Vorschläge aus früheren Einkäufen, ohne das, was gerade offen auf der Liste steht
  const shopLists = new Set(state.data.lists.filter((l) => l.kind === 'shopping' || l.kind === 'template').map((l) => l.id));
  const onList = new Set(g.open.flatMap((grp) => grp.items.map((i) => i.title.toLowerCase())));
  const suggest = shoppingHistory(state.data.items, shopLists).titles.filter((t) => !onList.has(t.toLowerCase()));
  return `${listPicker(state, 'shopping', list.id)}
  <p class="meta-line">${open} offen${g.done.length ? `${sep}${g.done.length} erledigt` : ''}</p>
  <form class="search" data-form="add-shopping">
    <input name="text" autocomplete="off" list="shop-suggest" aria-label="Hinzufügen" placeholder="2 Milch, Brot, Äpfel" enterkeyhint="done">
    <select name="category" aria-label="Bereich">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === state.lastCategory ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select>
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  <datalist id="shop-suggest">${suggest.map((t) => `<option value="${attr(t)}">`).join('')}</datalist>
  ${groups || emptyState('shopping', MSG.emptyList)}
  ${g.done.length ? doneBlock(list.id, g.done.map((i) => shopRow(state, i))) : ''}
  ${templatePicker(state, list.id)}`;
}

function shopRow(state, i) {
  const editing = state.editing === i.id;
  const title = `${i.quantity ? `<span class="fill">${esc(i.quantity)}</span> ` : ''}${esc(i.title)}`;
  const edit = `<button class="iconbtn" type="button" data-action="edit" data-id="${i.id}" aria-expanded="${editing}" aria-label="${editing ? 'Fertig' : 'Ändern'}" title="${editing ? 'Fertig' : 'Ändern'}">${icon('edit')}</button>`;
  // Wer etwas auf die Liste gesetzt hat, steht nur bei den anderen dabei.
  const by = i.changedBy && i.changedBy !== state.session?.user.id ? who(state, i.changedBy) : '';
  const head = checkLine(i, title, i.note ? esc(i.note) : '', by + edit);
  if (!editing) return head;
  return head + `<form class="editor taskedit" data-form="edit-shop" data-id="${i.id}">
    <div class="pair"><label class="field"><span class="cap">was</span><input name="title" value="${attr(i.title)}" required></label>
      <label class="field"><span class="cap">menge</span><input name="quantity" value="${attr(i.quantity || '')}" placeholder="2, 500 g"></label></div>
    <label class="field"><span class="cap">bereich</span><select name="category">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === (i.category || 'other') ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select></label>
    <label class="field"><span class="cap">notiz</span><input name="note" value="${attr(i.note || '')}" placeholder="z. B. die laktosefreie"></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      <button class="btn" type="button" data-action="delete-item" data-id="${i.id}">Löschen</button></div></form>`;
}

function renderTasks(state) {
  const list = state.data.lists.find((l) => l.id === state.taskListId);
  if (!list) return '';
  const items = sortTasks(itemsOf(state.data.items, list.id));
  const open = items.filter((i) => !i.done); const done = items.filter((i) => i.done);
  return `${listPicker(state, 'tasks', list.id)}
  <p class="meta-line">${open.length} offen${done.length ? `${sep}${done.length} erledigt` : ''}</p>
  <form class="search" data-form="add-task">
    <input name="title" autocomplete="off" aria-label="Neue Aufgabe" placeholder="Neue Aufgabe" required>
    <input name="dueDate" type="date" aria-label="Fällig">
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  <section class="section">${open.map((i) => taskRow(state, i)).join('') || emptyState('tasks', done.length ? MSG.allDone : MSG.emptyList)}</section>
  ${done.length ? doneBlock(list.id, done.map((i) => taskRow(state, i))) : ''}
  ${templatePicker(state, list.id)}`;
}

/** Auswahl "Vorlage einfügen" unter einer Liste, nur mit eingeschalteten Vorlagen. */
function templatePicker(state, listId) {
  if (!on(state, 'templates')) return '';
  const t = alive(state.data.lists).filter((l) => l.kind === 'template').sort((a, b) => a.sort - b.sort);
  if (!t.length) return '';
  return `<label class="field inline-field"><span class="cap">vorlage einfügen</span>
    <select data-action="apply-template" data-list="${listId}"><option value="">auswählen …</option>${t.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label>`;
}

function taskRow(state, i) {
  const editing = state.editing === i.id;
  const edit = `<button class="iconbtn" type="button" data-action="edit" data-id="${i.id}" aria-expanded="${editing}" aria-label="${editing ? 'Fertig' : 'Ändern'}" title="${editing ? 'Fertig' : 'Ändern'}">${icon('edit')}</button>`;
  const head = checkLine(i, esc(i.title), taskTags(state, i, state.today, true), who(state, i.assignee) + edit);
  if (!editing) return head;
  const members = state.members.map((m) => `<option value="${m.id}" ${m.id === i.assignee ? 'selected' : ''}>${esc(m.name || 'ohne Namen')}</option>`).join('');
  return head + `<form class="editor taskedit" data-form="edit-task" data-id="${i.id}">
    <label class="field"><span class="cap">titel</span><input name="title" value="${attr(i.title)}" required></label>
    <label class="field"><span class="cap">fällig</span><input name="dueDate" type="date" value="${attr(i.dueDate || '')}"></label>
    ${members ? `<label class="field"><span class="cap">wer</span><select name="assignee"><option value="">niemand</option>${members}</select></label>` : ''}
    <label class="field"><span class="cap">notiz</span><input name="note" value="${attr(i.note || '')}"></label>
    <label class="check inline"><input type="checkbox" name="important" ${i.important ? 'checked' : ''}><span class="t"><b>wichtig</b></span></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      <button class="btn" type="button" data-action="delete-item" data-id="${i.id}">Löschen</button></div></form>`;
}

// ---- Kalender ------------------------------------------------------------------

function renderCalendar(state) {
  const from = addDays(state.today, state.calOffset * 28);
  const to = addDays(from, 27);
  const days = agenda({ ...state.data, events: state.events, items: [] }, from, to);
  const editing = state.editing && state.data.events.find((e) => e.id === state.editing);
  const list = days.map((d) => `<div class="day">${group(dayLabel(d.date, state.today, true))}
    ${d.events.map((occ) => { const p = eventParts(state, occ, state.today); return p.ev.feed ? `<div class="item feed">${p.inner}</div>` : `<button type="button" class="item" data-action="edit-event" data-id="${p.ev.id}">${p.inner}</button>`; }).join('')}</div>`).join('');
  return `
  <h1 class="bigtitle">Kalender</h1>
  <div class="calbar">${iconBtn('back', 'Vier Wochen zurück', 'data-action="cal-move" data-step="-1"')}
    <span class="cap">${esc(fmtRange.format(asDate(from)))} – ${esc(fmtRange.format(asDate(to)))}</span>
    ${iconBtn('next', 'Vier Wochen weiter', 'data-action="cal-move" data-step="1"')}</div>
  ${eventForm(state, editing || null)}
  <section class="section">${list || emptyState('calendar', MSG.noEvents)}</section>
  ${feedSection(state)}`;
}

/** Fremde Kalender: Liste mit Stand und Formular zum Hinzufügen. */
function feedSection(state) {
  const cals = alive(state.data.calendars).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const rows = cals.map((c) => {
    const f = state.feeds?.[c.id];
    const status = !f ? 'lädt …' : f.error ? MSG.feedError : `${MSG.feedLoaded(f.events.length)}${sep}${esc(new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(f.at)))}`;
    return `<div class="item"><span class="t"><b>${esc(c.title || 'kalender')}</b><span${f?.error ? ' class="err"' : ''}>${status}</span></span>
      ${iconBtn('close', 'Kalender entfernen', `data-action="delete" data-collection="calendars" data-id="${c.id}"`)}</div>`;
  }).join('');
  return `<details${state.editing === 'feeds' ? ' open' : ''}><summary>fremde kalender${cals.length ? ` (${cals.length})` : ''}</summary><div>
    <p class="empty small">${esc(MSG.feedsHint)}${state.session ? '' : ` ${esc(MSG.feedsLocal)}`}</p>
    ${rows}
    <form class="editor" data-form="add-calendar">
      <div class="pair"><label class="field"><span class="cap">name</span><input name="title" placeholder="Schulferien" required></label>
        <label class="field"><span class="cap">adresse</span><input name="url" autocomplete="off" autocapitalize="none" placeholder="webcal://…" required></label></div>
      <div class="actions"><button class="btn primary" type="submit">Hinzufügen</button>
        ${cals.length ? '<button class="btn" type="button" data-action="reload-feeds">Neu laden</button>' : ''}</div></form></div></details>`;
}

function eventForm(state, ev) {
  const v = ev || { title: '', startDate: state.today, endDate: state.today, startTime: null, endTime: null, repeat: 'none', repeatInterval: 1, repeatUntil: null, notes: null, people: [] };
  const people = state.members.map((m) => `<label class="check inline"><input type="checkbox" name="people" value="${m.id}" ${v.people.includes(m.id) ? 'checked' : ''}><span class="t"><b>${esc(m.name || 'ohne Namen')}</b></span></label>`).join('');
  return `<details ${ev ? 'open' : ''} class="event-form"><summary>${ev ? 'termin ändern' : 'neuer termin'}</summary><div>
  <form class="editor" data-form="save-event" data-id="${ev ? ev.id : ''}">
    <label class="field"><span class="cap">titel</span><input name="title" value="${attr(v.title)}" required></label>
    <div class="pair"><label class="field"><span class="cap">von</span><input name="startDate" type="date" value="${v.startDate}" required></label>
      <label class="field"><span class="cap">bis</span><input name="endDate" type="date" value="${v.endDate}"></label></div>
    <div class="pair"><label class="field"><span class="cap">beginn</span><input name="startTime" type="time" value="${attr(v.startTime || '')}"></label>
      <label class="field"><span class="cap">ende</span><input name="endTime" type="time" value="${attr(v.endTime || '')}"></label></div>
    <div class="pair"><label class="field"><span class="cap">wiederholen</span><select name="repeat">${REPEATS.map((r) => `<option value="${r}" ${r === v.repeat ? 'selected' : ''}>${esc(REPEAT[r])}</option>`).join('')}</select></label>
      <label class="field"><span class="cap">alle … ${esc(REPEAT_EVERY[v.repeat] || '')}</span><input name="repeatInterval" type="number" min="1" max="99" value="${v.repeatInterval}"></label></div>
    <label class="field"><span class="cap">wiederholen bis (optional)</span><input name="repeatUntil" type="date" value="${attr(v.repeatUntil || '')}"></label>
    ${people ? `<fieldset class="people"><legend class="cap">wer</legend>${people}</fieldset>` : ''}
    <label class="field"><span class="cap">notiz</span><input name="notes" value="${attr(v.notes || '')}"></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      ${ev ? `<button class="btn" type="button" data-action="cancel-edit">Abbrechen</button><button class="btn" type="button" data-action="delete-event" data-id="${ev.id}">Löschen</button>` : ''}</div>
  </form></div></details>`;
}

// ---- Essensplan --------------------------------------------------------------

function renderMeals(state) {
  const monday = addDays(weekStart(state.today), state.mealOffset * 7);
  const week = mealWeek(state.data.meals, monday);
  const byId = new Map(state.data.meals.map((m) => [m.id, m]));
  const days = week.map((d) => `<div class="day">${group(dayLabel(d.date, state.today, true))}
    ${d.meals.map((id) => { const m = byId.get(id); return `<div class="item"><span class="t"><b>${esc(m.title)}</b>${m.note ? `<span>${esc(m.note)}</span>` : ''}</span>
      <span class="tag">${esc(MEAL_SLOT[m.slot])}</span>${iconBtn('close', 'Entfernen', `data-action="delete" data-collection="meals" data-id="${m.id}"`)}</div>`; }).join('')
      || `<p class="empty small">${esc(MSG.noMeals)}</p>`}</div>`).join('');
  const dayOpts = week.map((d) => `<option value="${d.date}" ${d.date === state.today ? 'selected' : ''}>${esc(dayLabel(d.date, state.today))}</option>`).join('');
  return `
  <h1 class="bigtitle">Essen</h1>
  <div class="calbar">${iconBtn('back', 'Woche zurück', 'data-action="meal-move" data-step="-1"')}
    <span class="cap">${esc(fmtRange.format(asDate(monday)))} – ${esc(fmtRange.format(asDate(addDays(monday, 6))))}</span>
    ${iconBtn('next', 'Woche weiter', 'data-action="meal-move" data-step="1"')}</div>
  <form class="search" data-form="add-meal">
    <input name="title" autocomplete="off" aria-label="Gericht" placeholder="Gericht" required>
    <select name="date" aria-label="Tag">${dayOpts}</select>
    <select name="slot" aria-label="Mahlzeit">${MEAL_SLOTS.map((m) => `<option value="${m}" ${m === 'dinner' ? 'selected' : ''}>${esc(MEAL_SLOT[m])}</option>`).join('')}</select>
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  <section class="section">${days}</section>`;
}

// ---- Haushaltsplan ------------------------------------------------------------

function choreLine(state, c, st) {
  const name = (id) => memberName(state, id) || 'jemand';
  const parts = st.notYet ? [`ab ${dayLabel(c.startDate, state.today)}`]
    : st.done ? [`erledigt${c.doneBy ? ` von ${name(c.doneBy)}` : ''}`, st.next && st.next !== st.assignee ? `als nächstes ${name(st.next)}` : '']
      : [`dran: ${st.assignee ? name(st.assignee) : 'alle'}`, `bis ${dayLabel(st.periodEnd, state.today)}`];
  const edit = currentTab(state) === 'chores'
    ? `<button class="iconbtn" type="button" data-action="edit" data-id="${c.id}" aria-expanded="${state.editing === c.id}" aria-label="Ändern" title="Ändern">${icon('edit')}</button>` : '';
  return `<div class="item"><label class="check"><input type="checkbox" data-action="chore-done" data-id="${c.id}" ${st.done ? 'checked' : ''} ${st.notYet ? 'disabled' : ''}>
    <span class="t"><b>${esc(c.title)}</b><span>${parts.filter(Boolean).map(esc).join(sep)}</span></span></label>${!st.done && !st.notYet ? who(state, st.assignee) : ''}${edit}</div>`;
}

function renderChores(state) {
  const chores = alive(state.data.chores).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const rows = chores.map((c) => { const st = choreState(c, state.today); return choreLine(state, c, st) + (state.editing === c.id ? choreForm(state, c) : ''); }).join('');
  return `
  <h1 class="bigtitle">Haushalt</h1>
  <p class="meta-line">im wechsel${sep}wer dran ist, steht auch auf „heute“</p>
  <section class="section">${rows || emptyState('tasks', MSG.noChores)}</section>
  <details ${chores.length ? '' : 'open'}><summary>neue aufgabe im plan</summary><div>${choreForm(state, null)}</div></details>`;
}

function choreForm(state, c) {
  const v = c || { title: '', unit: 'weekly', interval: 1, startDate: weekStart(state.today), people: state.members.map((m) => m.id) };
  // Reihenfolge: erst die gewählten in ihrer Reihenfolge, dann der Rest
  const ordered = [...v.people.filter((p) => state.members.some((m) => m.id === p)), ...state.members.map((m) => m.id).filter((p) => !v.people.includes(p))];
  const people = ordered.map((p) => `<label class="check inline"><input type="checkbox" name="people" value="${p}" ${v.people.includes(p) ? 'checked' : ''}><span class="t"><b>${esc(memberName(state, p) || 'ohne Namen')}</b></span></label>`).join('');
  return `<form class="editor${c ? ' taskedit' : ''}" data-form="save-chore" data-id="${c ? c.id : ''}">
    <label class="field"><span class="cap">was</span><input name="title" value="${attr(v.title)}" placeholder="Bad putzen" required></label>
    <div class="pair"><label class="field"><span class="cap">alle</span><input name="interval" type="number" min="1" max="99" value="${v.interval}"></label>
      <label class="field"><span class="cap">einheit</span><select name="unit">${CHORE_UNITS.map((u) => `<option value="${u}" ${u === v.unit ? 'selected' : ''}>${esc(CHORE_UNIT[u])}</option>`).join('')}</select></label></div>
    <label class="field"><span class="cap">ab</span><input name="startDate" type="date" value="${attr(v.startDate)}" required></label>
    ${people ? `<fieldset class="people"><legend class="cap">im wechsel (in dieser reihenfolge)</legend>${people}</fieldset>` : `<p class="empty small">Ohne Haushalt ist niemand bestimmtes dran.</p>`}
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      ${c ? `<button class="btn" type="button" data-action="delete" data-collection="chores" data-id="${c.id}">Löschen</button>` : ''}</div></form>`;
}

// ---- Ausgaben -----------------------------------------------------------------

function renderExpenses(state) {
  const people = state.members.map((m) => m.id);
  const exps = alive(state.data.expenses).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.changedAt - a.changedAt));
  const month = state.today.slice(0, 7);
  let settle;
  if (people.length < 2) settle = `<p class="empty">${esc(MSG.noMembers)}</p>`;
  else {
    const t = settleUp(balances(exps, people));
    settle = t.length ? t.map((x) => `<div class="item"><span class="t"><b>${esc(memberName(state, x.from))} → ${esc(memberName(state, x.to))}</b></span>
      <span class="n">${esc(money(x.cents))}</span><button class="btn small" type="button" data-action="settle" data-from="${x.from}" data-to="${x.to}" data-cents="${x.cents}">ausgeglichen</button></div>`).join('')
      : `<p class="empty">${esc(MSG.settled)}</p>`;
  }
  const byMonth = new Map();
  for (const e of exps) { const k = e.date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(e); }
  const list = [...byMonth.entries()].map(([k, es]) => `<section class="section">${group(`${fmtMonth.format(asDate(k + '-01'))} · ${money(monthTotal(es, k))}`)}
    ${es.map((e) => expenseRow(state, e)).join('')}</section>`).join('');
  return `
  <h1 class="bigtitle">Ausgaben</h1>
  <p class="meta-line">${esc(fmtMonth.format(asDate(month + '-01')))}${sep}${esc(money(monthTotal(exps, month)))}</p>
  <section class="section">${group('wer schuldet wem')}${settle}</section>
  <details><summary>neue ausgabe</summary><div>${expenseForm(state)}</div></details>
  ${list}`;
}

function expenseRow(state, e) {
  const sub = e.kind === 'settle'
    ? `ausgleich an ${memberName(state, e.people[0]) || '–'}`
    : [e.paidBy ? `${memberName(state, e.paidBy) || 'jemand'} hat bezahlt` : '', e.people.length === 1 ? `für ${memberName(state, e.people[0])}` : '', dayLabel(e.date, state.today)].filter(Boolean).join(' · ');
  return `<div class="item"><span class="t"><b>${esc(e.kind === 'settle' ? `${memberName(state, e.paidBy)} → ${memberName(state, e.people[0])}` : e.title || 'Ausgabe')}</b><span>${esc(sub)}</span></span>
    <span class="n">${esc(money(e.amount))}</span>${iconBtn('close', 'Löschen', `data-action="delete" data-collection="expenses" data-id="${e.id}"`)}</div>`;
}

function expenseForm(state) {
  const me = state.session?.user.id || '';
  const payers = state.members.map((m) => `<option value="${m.id}" ${m.id === me ? 'selected' : ''}>${esc(m.name || 'ohne Namen')}</option>`).join('');
  const people = state.members.map((m) => `<label class="check inline"><input type="checkbox" name="people" value="${m.id}" checked><span class="t"><b>${esc(m.name || 'ohne Namen')}</b></span></label>`).join('');
  return `<form class="editor" data-form="add-expense">
    <label class="field"><span class="cap">wofür</span><input name="title" placeholder="Wocheneinkauf" required></label>
    <div class="pair"><label class="field"><span class="cap">betrag in €</span><input name="amount" inputmode="decimal" placeholder="12,50" required></label>
      <label class="field"><span class="cap">datum</span><input name="date" type="date" value="${state.today}" required></label></div>
    ${payers ? `<label class="field"><span class="cap">bezahlt von</span><select name="paidBy">${payers}</select></label>
      <fieldset class="people"><legend class="cap">für wen</legend>${people}</fieldset>` : ''}
    <div class="actions"><button class="btn primary" type="submit">Speichern</button></div></form>`;
}

// ---- Projekte ------------------------------------------------------------------

function renderProjects(state) {
  const projects = alive(state.data.lists).filter((l) => l.kind === 'project').sort((a, b) => a.archived - b.archived || a.sort - b.sort);
  const p = projects.find((x) => x.id === state.projectId);
  if (p) return renderProject(state, p);
  const row = (l) => { const pr = progress(state.data.items, l.id); return `<button type="button" class="item" data-action="open-project" data-id="${l.id}">
    <span class="t"><b>${esc(l.name)}</b><span>${l.archived ? 'abgeschlossen' : pr.total ? `${pr.done} von ${pr.total} schritten` : 'noch keine schritte'}</span></span>
    <span class="n">${pr.total ? `${Math.round((pr.done / pr.total) * 100)} %` : ''}</span></button>`; };
  const active = projects.filter((l) => !l.archived); const archived = projects.filter((l) => l.archived);
  return `
  <h1 class="bigtitle">Projekte</h1>
  <form class="search" data-form="add-project"><input name="name" autocomplete="off" aria-label="Neues Projekt" placeholder="Neues Projekt, z. B. Kinderzimmer streichen" required>
    <button class="iconbtn" type="submit" aria-label="Anlegen" title="Anlegen">${icon('plus')}</button></form>
  <section class="section">${active.map(row).join('') || emptyState('projects', MSG.noProjects)}</section>
  ${archived.length ? `<details><summary>abgeschlossen (${archived.length})</summary><div>${archived.map(row).join('')}</div></details>` : ''}`;
}

function renderProject(state, p) {
  const items = sortTasks(itemsOf(state.data.items, p.id));
  const open = items.filter((i) => !i.done); const done = items.filter((i) => i.done);
  const pr = progress(state.data.items, p.id);
  return `<div class="listbar">${iconBtn('back', 'Alle Projekte', 'data-action="open-project" data-id=""')}
    <h1 class="bigtitle inline">${esc(p.name)}</h1>${iconBtn('edit', 'Umbenennen', `data-action="rename-list" data-id="${p.id}"`)}</div>
  <p class="meta-line">${pr.done} von ${pr.total} erledigt</p>
  ${pr.total ? `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${pr.total}" aria-valuenow="${pr.done}"><span style="width:${(pr.done / pr.total) * 100}%"></span></div>` : ''}
  <form class="search" data-form="add-step" data-list="${p.id}">
    <input name="title" autocomplete="off" aria-label="Neuer Schritt" placeholder="Nächster Schritt" required>
    <input name="dueDate" type="date" aria-label="Fällig">
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  <section class="section">${open.map((i) => taskRow(state, i)).join('') || `<p class="empty">${esc(MSG.emptyList)}</p>`}</section>
  ${done.length ? doneBlock(p.id, done.map((i) => taskRow(state, i))) : ''}
  <div class="actions-row"><button class="btn" type="button" data-action="archive-project" data-id="${p.id}">${p.archived ? 'Wieder öffnen' : 'Abschließen'}</button>
    <button class="btn quiet" type="button" data-action="delete" data-collection="lists" data-id="${p.id}" data-confirm="1">Projekt löschen</button></div>`;
}

// ---- Notizen -------------------------------------------------------------------

function renderNotes(state) {
  const notes = alive(state.data.notes).sort((a, b) => b.pinned - a.pinned || b.changedAt - a.changedAt);
  const rows = notes.map((n) => (state.editing === n.id ? noteForm(state, n)
    : `<button type="button" class="item" data-action="edit" data-id="${n.id}"><span class="t"><b>${esc(n.title || n.body.split('\n')[0] || 'Notiz')}</b>
      ${n.title && n.body ? `<span>${esc(n.body.split('\n')[0])}</span>` : ''}</span>${n.pinned && on(state, 'board') ? '<span class="tag">pinnwand</span>' : ''}</button>`)).join('');
  return `
  <h1 class="bigtitle">Notizen</h1>
  <details ${notes.length ? '' : 'open'}><summary>neue notiz</summary><div>${noteForm(state, null)}</div></details>
  <section class="section">${rows || emptyState('notes', MSG.noNotes)}</section>`;
}

function noteForm(state, n) {
  const v = n || { title: '', body: '', pinned: false };
  return `<form class="editor${n ? ' taskedit' : ''}" data-form="save-note" data-id="${n ? n.id : ''}">
    <label class="field"><span class="cap">titel</span><input name="title" value="${attr(v.title)}"></label>
    <label class="field"><span class="cap">text</span><textarea name="body" rows="${n ? 6 : 3}">${esc(v.body)}</textarea></label>
    ${on(state, 'board') ? `<label class="check inline"><input type="checkbox" name="pinned" ${v.pinned ? 'checked' : ''}><span class="t"><b>an die pinnwand</b></span></label>` : ''}
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      ${n ? `<button class="btn" type="button" data-action="cancel-edit">Schließen</button><button class="btn" type="button" data-action="delete" data-collection="notes" data-id="${n.id}">Löschen</button>` : ''}</div></form>`;
}

// ---- Kontakte ------------------------------------------------------------------

function renderContacts(state) {
  const contacts = alive(state.data.contacts).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const soon = upcomingBirthdays(contacts, state.today, 60);
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const rows = contacts.map((c) => {
    if (state.editing === c.id) return contactForm(state, c);
    const b = nextBirthday(c, state.today);
    const sub = [c.birthday ? `geburtstag ${dayMonth(c.birthday)}${b && b.age !== null ? ` (wird ${b.age})` : ''}` : '', c.phone || ''].filter(Boolean).join(' · ');
    return `<div class="item"><span class="t"><b>${esc(c.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>
      ${c.phone ? `<a class="btn small" href="tel:${attr(c.phone.replace(/[^\d+]/g, ''))}">anrufen</a>` : ''}
      <button class="iconbtn" type="button" data-action="edit" data-id="${c.id}" aria-label="Ändern" title="Ändern">${icon('edit')}</button></div>`;
  }).join('');
  return `
  <h1 class="bigtitle">Kontakte</h1>
  ${soon.length ? `<section class="section">${group('nächste geburtstage')}${soon.map((b) => birthdayLine(state, byId.get(b.contactId), b)).join('')}</section>` : ''}
  <details ${contacts.length ? '' : 'open'}><summary>neuer kontakt</summary><div>${contactForm(state, null)}</div></details>
  <section class="section">${group('alle')}${rows || emptyState('contacts', MSG.noContacts)}</section>`;
}

function contactForm(state, c) {
  const v = c || { name: '', birthday: null, birthYear: null, phone: '', email: '', address: '', note: '' };
  return `<form class="editor${c ? ' taskedit' : ''}" data-form="save-contact" data-id="${c ? c.id : ''}">
    <label class="field"><span class="cap">name</span><input name="name" value="${attr(v.name)}" required></label>
    <div class="pair"><label class="field"><span class="cap">geburtstag (tt.mm.)</span><input name="birthday" inputmode="decimal" placeholder="24.12." value="${attr(v.birthday ? dayMonth(v.birthday) : '')}"></label>
      <label class="field"><span class="cap">jahr (optional)</span><input name="birthYear" type="number" min="1900" max="2200" value="${attr(v.birthYear || '')}"></label></div>
    <div class="pair"><label class="field"><span class="cap">telefon</span><input name="phone" type="tel" value="${attr(v.phone || '')}"></label>
      <label class="field"><span class="cap">e-mail</span><input name="email" type="email" value="${attr(v.email || '')}"></label></div>
    <label class="field"><span class="cap">adresse</span><textarea name="address" rows="2">${esc(v.address || '')}</textarea></label>
    <label class="field"><span class="cap">notiz</span><input name="note" value="${attr(v.note || '')}"></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      ${c ? `<button class="btn" type="button" data-action="cancel-edit">Schließen</button><button class="btn" type="button" data-action="delete" data-collection="contacts" data-id="${c.id}">Löschen</button>` : ''}</div></form>`;
}

// ---- Geschenkideen ---------------------------------------------------------------

function renderGifts(state) {
  const gifts = visibleGifts(state.data.gifts, state.session?.user.id || null);
  const groups = new Map();
  for (const g of gifts.sort((a, b) => GIFT_STATUSES.indexOf(a.status) - GIFT_STATUSES.indexOf(b.status) || b.changedAt - a.changedAt)) {
    const k = g.forName || 'ohne Person'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g);
  }
  const names = [...new Set(alive(state.data.contacts).map((c) => c.name).filter(Boolean))];
  const list = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([k, gs]) => `<section class="section">${group(k)}
    ${gs.map((g) => `<div class="item"><span class="t"><b>${esc(g.title)}</b>${g.note || g.link ? `<span>${esc(g.note || '')}${g.link ? ` <a href="${attr(g.link)}" target="_blank" rel="noopener noreferrer">link</a>` : ''}</span>` : ''}</span>
      ${g.private ? '<span class="tag">nur ich</span>' : ''}
      <select class="mini status" aria-label="Stand" data-action="gift-status" data-id="${g.id}">${GIFT_STATUSES.map((st) => `<option value="${st}" ${st === g.status ? 'selected' : ''}>${esc(GIFT_STATUS[st])}</option>`).join('')}</select>
      ${iconBtn('close', 'Löschen', `data-action="delete" data-collection="gifts" data-id="${g.id}"`)}</div>`).join('')}</section>`).join('');
  return `
  <h1 class="bigtitle">Geschenke</h1>
  <form class="editor" data-form="add-gift">
    <div class="pair"><label class="field"><span class="cap">für</span><input name="forName" list="gift-names" autocomplete="off" required></label>
      <label class="field"><span class="cap">idee</span><input name="title" required></label></div>
    ${names.length ? `<datalist id="gift-names">${names.map((n) => `<option value="${attr(n)}">`).join('')}</datalist>` : ''}
    <label class="field"><span class="cap">link oder notiz</span><input name="extra" autocomplete="off"></label>
    <label class="check inline"><input type="checkbox" name="private" checked><span class="t"><b>nur für mich sichtbar</b></span></label>
    <div class="actions"><button class="btn primary" type="submit">Merken</button></div></form>
  ${list || emptyState('gifts', MSG.noGifts)}`;
}

// ---- Vorlagen ----------------------------------------------------------------------

function renderTemplates(state) {
  const t = state.data.lists.find((l) => l.id === state.templateId && !l.deleted && l.kind === 'template');
  if (!t) {
    return `<h1 class="bigtitle">Vorlagen</h1>${emptyState('projects', MSG.noTemplates)}
      <div class="actions-row"><button class="btn primary" type="button" data-action="new-list" data-kind="template">Neue Vorlage</button></div>`;
  }
  const items = itemsOf(state.data.items, t.id).sort((a, b) => a.sort - b.sort);
  const targets = alive(state.data.lists).filter((l) => !l.archived && ((l.kind === 'shopping' && on(state, 'shopping')) || (l.kind === 'tasks' && on(state, 'tasks'))));
  return `${listPicker(state, 'template', t.id)}
  <p class="meta-line">vorlage${sep}${items.length} einträge</p>
  <form class="search" data-form="add-template-item">
    <input name="text" autocomplete="off" aria-label="Hinzufügen" placeholder="Milch, 6 Eier, Brot" required>
    <select name="category" aria-label="Bereich">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === state.lastCategory ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select>
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  <section class="section">${items.map((i) => `<div class="item"><span class="t"><b>${i.quantity ? `<span class="fill">${esc(i.quantity)}</span> ` : ''}${esc(i.title)}</b><span>${esc(i.category ? CATEGORY[i.category] : '')}</span></span>
    ${iconBtn('close', 'Entfernen', `data-action="delete-item" data-id="${i.id}"`)}</div>`).join('') || `<p class="empty">${esc(MSG.emptyList)}</p>`}</section>
  ${targets.length && items.length ? `<label class="field inline-field"><span class="cap">übernehmen in</span>
    <select data-action="apply-template-from" data-template="${t.id}"><option value="">liste wählen …</option>${targets.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label>` : ''}
  <div class="actions-row"><button class="btn quiet" type="button" data-action="delete" data-collection="lists" data-id="${t.id}" data-confirm="1">Vorlage löschen</button></div>`;
}

// ---- Speicherort (Einrichtung und Mehr) ------------------------------------------------

/**
 * Auswahl des Speicherorts mit den passenden Feldern. Felder anderer Speicherorte sind ausgeblendet
 * und abgeschaltet, damit nur die gewählten abgeschickt werden.
 */
function storageFields(state, mode, setup = false) {
  const f = addressFields(mode, state.settings.serverUrl || state.defaultServer);
  const showIf = (modes) => (modes.split(' ').includes(mode) ? '' : 'hidden disabled');
  const radios = STORAGE_MODES.map((m) => `<label class="choice"><input type="radio" name="storage" value="${m}" data-action="pick-storage" ${m === mode ? 'checked' : ''}>
    <span class="t"><b>${esc(STORAGE[m][0])}</b><span>${esc(STORAGE[m][1])}</span></span></label>`).join('');
  const port = (v) => `<label class="field"><span class="cap">port</span><input name="port" inputmode="numeric" value="${attr(v)}" placeholder="${DEFAULT_PORT}"></label>`;
  const mixed = state.pageProtocol === 'https:' ? `<div class="note"><span class="cap">achtung</span>${esc(MSG.mixedContent)}</div>` : '';
  return `<fieldset class="choices"><legend class="cap">wo sollen eure daten liegen?</legend>${radios}</fieldset>
  <fieldset class="fields" data-modes="tailscale" ${showIf('tailscale')}>
    <div class="pair"><label class="field"><span class="cap">gerätename</span><input name="host" autocomplete="off" autocapitalize="none" placeholder="macmini" value="${attr(mode === 'tailscale' ? f.host : '')}" required></label>
      <label class="field"><span class="cap">tailnet</span><input name="tailnet" autocomplete="off" autocapitalize="none" placeholder="tail1234.ts.net" value="${attr(f.tailnet)}"></label></div>
    <p class="empty small">Steht in der Tailscale-App beim Mac mini, z. B. macmini.tail1234.ts.net. Auf dem Mac: <code>tailscale serve --bg 8090</code>.</p></fieldset>
  <fieldset class="fields" data-modes="wireguard" ${showIf('wireguard')}>
    <div class="pair"><label class="field"><span class="cap">adresse im tunnel</span><input name="host" autocomplete="off" autocapitalize="none" placeholder="10.8.0.1" value="${attr(mode === 'wireguard' ? f.host : '')}" required></label>${port(mode === 'wireguard' ? f.port : DEFAULT_PORT)}</div>
    <p class="empty small">IP des Mac mini im WireGuard-Netz. Den Tunnel baut die WireGuard-App auf, die Schlüssel bleiben dort.</p>${mixed}</fieldset>
  <fieldset class="fields" data-modes="lan" ${showIf('lan')}>
    <div class="pair"><label class="field"><span class="cap">adresse im heimnetz</span><input name="host" autocomplete="off" autocapitalize="none" placeholder="macmini.local" value="${attr(mode === 'lan' ? f.host : '')}" required></label>${port(mode === 'lan' ? f.port : DEFAULT_PORT)}</div>
    <p class="empty small">Name oder IP des Mac mini, z. B. macmini.local oder 192.168.178.20.</p>${mixed}</fieldset>
  <fieldset class="fields" data-modes="domain hosted" ${showIf('domain hosted')}>
    <label class="field"><span class="cap">adresse</span><input name="url" type="url" autocomplete="off" autocapitalize="none" placeholder="https://planer.example.de" value="${attr(mode === 'domain' || mode === 'hosted' ? f.url : '')}" required></label>
    <p class="empty small">Nur mit https. Der Server ist dann aus dem Internet erreichbar: starkes Passwort und nach dem Anlegen eurer Konten die Registrierung sperren (siehe Anleitung Mac mini).</p></fieldset>
  <fieldset class="fields" data-modes="tailscale wireguard lan domain hosted" ${showIf('tailscale wireguard lan domain hosted')}>
    <label class="field"><span class="cap">e-mail</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="field"><span class="cap">passwort</span><input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
    <label class="field"><span class="cap">dein name (nur bei neuem konto)</span><input name="name" autocomplete="nickname"></label>
    ${setup ? '' : accountButtons}</fieldset>`;
}

const accountButtons = `<div class="actions"><button class="btn primary" type="submit" name="mode" value="login">Anmelden</button>
  <button class="btn" type="submit" name="mode" value="register">Neues Konto</button></div>`;

function moduleChecks(state, form) {
  return MODULES.map((m) => `<label class="choice"><input type="checkbox" name="modules" value="${m}" ${form ? '' : 'data-action="toggle-module"'} ${on(state, m) ? 'checked' : ''}>
    <span class="t"><b>${esc(MODULE[m][0])}</b><span>${esc(MODULE[m][1])}</span></span></label>`).join('');
}

// ---- Einrichtung -----------------------------------------------------------------------

function renderSetup(state) {
  const mode = state.setupMode;
  return `<div class="app setup">
  <header class="apphead"><div class="wrap"><h1>${esc(APP_NAME)}</h1><span class="sync cap">einrichtung</span></div></header>
  <main class="wrap" id="main">${flashNote(state)}
    <h1 class="bigtitle">Willkommen</h1>
    <p class="meta-line">zwei fragen, dann geht's los.</p>
    <form class="editor" data-form="setup">
      ${storageFields(state, mode, true)}
      <fieldset class="choices"><legend class="cap">was braucht ihr? (später unter „mehr“ änderbar)</legend>${moduleChecks(state, true)}</fieldset>
      <fieldset class="fields" data-modes="local" ${mode === 'local' ? '' : 'hidden disabled'}>
        <div class="actions"><button class="btn primary" type="submit" name="mode" value="local">Los geht's</button></div></fieldset>
      <fieldset class="fields" data-modes="tailscale wireguard lan domain hosted" ${mode === 'local' ? 'hidden disabled' : ''}>${accountButtons}</fieldset>
    </form>
  </main></div>`;
}

// ---- Mehr --------------------------------------------------------------------

const infoRow = (label, value) => `<div class="item"><span class="t"><span>${esc(label)}</span><b>${value}</b></span></div>`;

function renderMore(state) {
  const s = state.session;
  const extra = tabLayout(state.settings.modules).more;
  const account = s
    ? `${infoRow('speicherort', esc(STORAGE[state.settings.storage][0]))}
       ${infoRow('server', `<code class="invite">${esc(s.serverUrl)}</code>`)}
       ${infoRow('angemeldet als', esc(s.user.name || s.user.email))}
       ${infoRow('haushalt', esc(s.household?.name || '–'))}
       ${s.household?.inviteCode ? `<div class="item"><span class="t"><span>einladungscode für deinen partner</span><b><code class="invite">${esc(s.household.inviteCode)}</code></b></span>
         <button class="btn small" type="button" data-action="copy-code">Kopieren</button></div>` : ''}
       ${infoRow('mitglieder', state.members.map((m) => `${who(state, m.id)}${esc(m.name || '–')}`).join('<span class="sep">·</span>') || '–')}
       ${!s.household ? householdForms() : `<details><summary>anderem haushalt beitreten</summary><div>${joinForm()}</div></details>`}
       <div class="actions-row"><button class="btn" type="button" data-action="sync-now">Jetzt abgleichen</button>
          <button class="btn quiet" type="button" data-action="logout">Abmelden / Speicherort wechseln</button></div>`
    : `<form class="editor" data-form="login">${storageFields(state, state.setupMode)}
       <div data-modes="local" class="fields" ${state.setupMode === 'local' ? '' : 'hidden'}><p class="empty">Alles bleibt auf diesem Gerät. Zum Teilen mit dem Partner meldet ihr euch beide am selben Server an.</p></div></form>`;
  return `
  <h1 class="bigtitle">Mehr</h1>
  ${extra.length ? `<section class="section">${group('bereiche')}${extra.map((m) => `<button type="button" class="item" data-action="tab" data-tab="${m}">
    <span class="ico">${icon(m)}</span><span class="t"><b>${esc(TABS[m])}</b></span>${icon('next')}</button>`).join('')}</section>` : ''}
  <section class="section">${group('speicherort und teilen')}${account}</section>
  <section class="section">${group('module')}
    <p class="empty">Was ausgeschaltet ist, verschwindet überall. Die Einträge bleiben gespeichert.</p>
    <div class="choices">${moduleChecks(state, false)}</div></section>
  <section class="section">${group('erinnerungen')}${pushSection(state)}</section>
  <section class="section">${group('darstellung')}
    <label class="field"><span class="cap">farbschema</span><select data-action="theme">${Object.entries(THEME).map(([k, v]) => `<option value="${k}" ${k === state.settings.theme ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></section>
  <section class="section">${group('sicherung')}
    <p class="empty">Alle Einträge als Datei sichern oder aus einer Sicherung zurückholen.
      ${esc(state.lastExport ? MSG.lastBackup(dayLabel(state.lastExport, state.today, true)) : MSG.noBackupYet)}
      ${s ? esc(MSG.backupServer) : ''}</p>
    <div class="actions-row"><button class="btn" type="button" data-action="export">Sicherung speichern</button>
      <label class="btn">Sicherung laden<input type="file" accept="application/json,.json" data-action="import" hidden></label></div></section>`;
}

/** Erinnerungen ein- und ausschalten, je Gerät. state.push: unsupported | no-server | off | on | denied */
function pushSection(state) {
  const p = state.push;
  if (!state.session) return `<p class="empty">${esc(MSG.pushLocal)}</p>`;
  const text = { unsupported: MSG.pushUnsupported, 'no-server': MSG.pushNoServer, denied: MSG.pushDenied, on: MSG.pushOn, off: MSG.pushOff }[p] || '';
  const buttons = p === 'on'
    ? '<button class="btn" type="button" data-action="push-test">Test senden</button><button class="btn quiet" type="button" data-action="push-off">Ausschalten</button>'
    : p === 'off' ? '<button class="btn primary" type="button" data-action="push-on">Einschalten</button>' : '';
  return `<p class="empty">${esc(MSG.pushHint)} ${esc(text)}</p>${buttons ? `<div class="actions-row">${buttons}</div>` : ''}`;
}

// ---- Suche ---------------------------------------------------------------------

/** Daten der eingeschalteten Module, für die Suche. */
function searchable(state) {
  const d = state.data;
  const kinds = new Set([on(state, 'shopping') && 'shopping', on(state, 'tasks') && 'tasks', on(state, 'projects') && 'project'].filter(Boolean));
  const off = (m, list) => (on(state, m) ? list : []);
  return {
    lists: d.lists.filter((l) => kinds.has(l.kind)), items: d.items, events: off('calendar', d.events), notes: off('notes', d.notes),
    contacts: off('contacts', d.contacts), gifts: off('gifts', visibleGifts(d.gifts, state.session?.user.id || null)),
    meals: off('meals', d.meals), expenses: off('expenses', d.expenses), chores: off('chores', d.chores),
  };
}

function renderSearch(state) {
  const q = state.query || '';
  const hits = search(searchable(state), q);
  const areas = [...new Set(hits.map((h) => h.area))];
  const sub = (h) => (/^\d{4}-\d{2}-\d{2}$/.test(h.sub) ? dayLabel(h.sub, state.today) : h.sub);
  const list = areas.map((a) => `<section class="section">${group(AREA[a])}${hits.filter((h) => h.area === a).map((h) => `<button type="button" class="item${h.done ? ' done' : ''}" data-action="open-result" data-area="${h.area}" data-id="${h.id}" data-list="${h.list || ''}">
    <span class="t"><b>${esc(h.title || '–')}</b>${h.sub ? `<span>${esc(sub(h))}</span>` : ''}</span>${icon('next')}</button>`).join('')}</section>`).join('');
  return `
  <h1 class="bigtitle">Suche</h1>
  <form class="search" data-form="search" role="search">
    <input name="q" type="search" autocomplete="off" aria-label="Suchen" placeholder="Was suchst du?" value="${attr(q)}" data-live="search" enterkeyhint="search">
  </form>
  ${q.trim().length < 2 ? `<p class="empty">${esc(MSG.searchHint)}</p>` : list || emptyState('search', MSG.noResults)}`;
}

/** Liste als Text zum Teilen; Einkauf nach Bereich im Laden, Aufgaben nur die offenen. */
export function shareText(state, listId) {
  const list = state.data.lists.find((l) => l.id === listId);
  const items = itemsOf(state.data.items, listId);
  if (list.kind === 'shopping') {
    const g = groupShopping(items);
    return `${list.name}\n${g.open.map((grp) => `\n${CATEGORY[grp.category]}\n${grp.items.map((i) => `– ${i.quantity ? `${i.quantity} ` : ''}${i.title}`).join('\n')}`).join('\n')}`;
  }
  return `${list.name}\n\n${sortTasks(items).filter((i) => !i.done).map((i) => `– ${i.title}${i.dueDate ? ` (${dayLabel(i.dueDate, state.today)})` : ''}`).join('\n')}`;
}

function householdForms() {
  return `<form class="editor" data-form="create-household">
    <label class="field"><span class="cap">neuer haushalt</span><input name="name" value="Zuhause" required></label>
    <div class="actions"><button class="btn primary" type="submit">Haushalt anlegen</button></div></form>
    <p class="cap empty">oder</p>${joinForm()}`;
}

function joinForm() {
  return `<form class="editor" data-form="join">
    <label class="field"><span class="cap">einladungscode</span><input name="code" autocomplete="off" required minlength="12"></label>
    <div class="actions"><button class="btn" type="submit">Beitreten</button></div></form>`;
}
