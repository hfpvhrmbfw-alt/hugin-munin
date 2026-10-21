// Oberfläche: Zustand der Ansicht und Rendering. Formatiert Daten aus der Logik zu Text und HTML.
// Aufbau nach Castra · Blei (mobil): .app > .apphead, main.wrap (.bigtitle, .item …), .tabbar
import { SHOPPING_CATEGORIES, REPEATS } from './model.js';
import { groupShopping, sortTasks, itemsOf, overview, agenda, addDays, alive } from './logic.js';
import { APP_NAME, TABS, CATEGORY, REPEAT, REPEAT_EVERY, THEME, SYNC, MSG } from './texts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;

const fmtDay = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtRange = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const asDate = (iso) => new Date(iso + 'T00:00:00Z');

/** "heute", "morgen", "gestern" oder Datum. */
export function dayLabel(iso, today, long = false) {
  if (iso === today) return 'heute';
  if (iso === addDays(today, 1)) return 'morgen';
  if (iso === addDays(today, -1)) return 'gestern';
  return (long ? fmtDay : fmtShort).format(asDate(iso));
}

const memberName = (state, id) => state.members.find((m) => m.id === id)?.name || '';

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
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const iconBtn = (name, label, data) => `<button class="iconbtn" type="button" aria-label="${attr(label)}" title="${attr(label)}" ${data}>${icon(name)}</button>`;

// ---- Rahmen ------------------------------------------------------------------

export function renderShell(state) {
  const tabs = Object.entries(TABS).map(([id, name]) =>
    `<button role="tab" type="button" data-action="tab" data-tab="${id}" aria-selected="${state.tab === id}" tabindex="${state.tab === id ? 0 : -1}">${icon(id)}${name}</button>`).join('');
  const s = state.sync;
  const syncText = !state.session ? SYNC.local
    : s.status === 'ok' ? `${SYNC.ok} ${fmtTime.format(new Date(s.at))}` : (s.message || SYNC[s.status] || '');
  return `<div class="app">
  <header class="apphead"><div class="wrap"><h1>${esc(APP_NAME)}</h1>
    <span class="sync cap" data-status="${attr(state.session ? s.status : 'local')}" role="status">${esc(syncText)}</span></div></header>
  <main class="wrap" id="main">${state.flash ? `<div class="note info" role="status"><span class="cap">hinweis</span>${esc(state.flash)}</div>` : ''}${renderTab(state)}</main>
  <nav class="tabbar" aria-label="Bereiche"><div class="wrap" role="tablist">${tabs}</div></nav></div>`;
}

function renderTab(state) {
  switch (state.tab) {
    case 'shopping': return renderShopping(state);
    case 'tasks': return renderTasks(state);
    case 'calendar': return renderCalendar(state);
    case 'more': return renderMore(state);
    default: return renderToday(state);
  }
}

// ---- Zeilen ------------------------------------------------------------------

function eventParts(state, occ, today) {
  const ev = state.data.events.find((e) => e.id === occ.eventId);
  const multi = occ.start !== occ.end;
  const sub = [
    !ev.startTime ? 'ganztägig' : ev.endTime ? `bis ${ev.endTime}` : '',
    multi ? `${dayLabel(occ.start, today)} bis ${dayLabel(occ.end, today)}` : '',
    ev.people.map((p) => memberName(state, p)).filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');
  return { ev, inner: `<span class="t"><b>${esc(ev.title || 'Termin')}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span><span class="n">${esc(ev.startTime || '')}</span>` };
}

function eventLine(state, occ, today, current = false) {
  return `<div class="item"${current ? ' aria-current="true"' : ''}>${eventParts(state, occ, today).inner}</div>`;
}

function taskTags(state, item, today, showDue) {
  const overdue = item.dueDate && item.dueDate < today && !item.done;
  return [
    item.dueDate && (showDue || overdue) ? `<span class="tag${overdue ? ' acc' : ''}">${esc(dayLabel(item.dueDate, today))}</span>` : '',
    item.important ? '<span class="tag inv">wichtig</span>' : '',
    item.assignee ? `<span class="tag">${esc(memberName(state, item.assignee))}</span>` : '',
  ].join('');
}

function checkLine(item, title, sub, extra = '') {
  return `<div class="item"><label class="check"><input type="checkbox" data-action="toggle" data-id="${item.id}" ${item.done ? 'checked' : ''}>
    <span class="t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span></label>${extra}</div>`;
}

const taskLine = (state, item, today) => checkLine(item, esc(item.title), taskTags(state, item, today, false));

// ---- Heute -----------------------------------------------------------------

function renderToday(state) {
  const o = overview(state.data, state.today);
  const byId = new Map(state.data.items.map((i) => [i.id, i]));
  const plan = o.todayPlan;
  // Fokus: der nächste Termin, der heute noch nicht vorbei ist
  const now = state.now || '';
  const evOf = (occ) => state.data.events.find((e) => e.id === occ.eventId);
  const next = plan ? plan.events.find((occ) => { const ev = evOf(occ); return ev.startTime && (ev.endTime || ev.startTime) >= now; }) : null;
  const todayRows = plan ? plan.events.map((e) => eventLine(state, e, state.today, e === next)).join('') + plan.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('') : '';
  const week = o.week.map((d) => `<div class="day">${group(dayLabel(d.date, state.today, true))}
    ${d.events.map((e) => eventLine(state, e, state.today)).join('')}${d.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</div>`).join('');
  return `
  <h1 class="bigtitle">Heute</h1>
  <p class="meta-line">${esc(fmtDay.format(asDate(state.today)))}${sep}${esc(MSG.shoppingOpen(o.shoppingOpen))}${o.overdue.length ? `${sep}${esc(MSG.overdue(o.overdue.length))}` : ''}</p>
  ${o.overdue.length ? `<section class="section">${group('überfällig')}${o.overdue.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</section>` : ''}
  <section class="section">${group('heute')}${todayRows || `<p class="empty">${esc(MSG.nothingToday)}</p>`}</section>
  <section class="section"><h2 class="head2">Diese Woche</h2>${week || `<p class="empty">${esc(MSG.nothingWeek)}</p>`}</section>`;
}

// ---- Listen ------------------------------------------------------------------

function listPicker(state, kind, currentId) {
  const lists = alive(state.data.lists).filter((l) => l.kind === kind && !l.archived).sort((a, b) => a.sort - b.sort);
  const opts = lists.map((l) => `<option value="${l.id}" ${l.id === currentId ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  return `<div class="listbar">
    <label class="field"><select aria-label="Liste" data-action="pick-list" data-kind="${kind}">${opts}</select></label>
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
    ${grp.items.map((i) => shopRow(i)).join('')}</section>`).join('');
  return `${listPicker(state, 'shopping', list.id)}
  <p class="meta-line">${open} offen${g.done.length ? `${sep}${g.done.length} erledigt` : ''}</p>
  <form class="search" data-form="add-shopping">
    <input name="text" autocomplete="off" aria-label="Hinzufügen" placeholder="2 Milch, Brot, Äpfel" enterkeyhint="done">
    <select name="category" aria-label="Bereich">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === state.lastCategory ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select>
    <button class="iconbtn" type="submit" aria-label="Dazu" title="Dazu">${icon('plus')}</button></form>
  ${groups || `<p class="empty">${esc(MSG.emptyList)}</p>`}
  ${g.done.length ? doneBlock(list.id, g.done.map((i) => shopRow(i))) : ''}`;
}

function shopRow(i) {
  const title = `${i.quantity ? `<span class="fill">${esc(i.quantity)}</span> ` : ''}${esc(i.title)}`;
  const picker = `<select class="mini" aria-label="Bereich für ${attr(i.title)}" data-action="set-category" data-id="${i.id}">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === (i.category || 'other') ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select>`;
  return checkLine(i, title, '', picker);
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
  <section class="section">${open.map((i) => taskRow(state, i)).join('') || `<p class="empty">${esc(MSG.emptyList)}</p>`}</section>
  ${done.length ? doneBlock(list.id, done.map((i) => taskRow(state, i))) : ''}`;
}

function taskRow(state, i) {
  const editing = state.editing === i.id;
  const edit = `<button class="iconbtn" type="button" data-action="edit" data-id="${i.id}" aria-expanded="${editing}" aria-label="${editing ? 'Fertig' : 'Ändern'}" title="${editing ? 'Fertig' : 'Ändern'}">${icon('edit')}</button>`;
  const head = checkLine(i, esc(i.title), taskTags(state, i, state.today, true), edit);
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
  const days = agenda({ ...state.data, items: [] }, from, to);
  const editing = state.editing && state.data.events.find((e) => e.id === state.editing);
  const list = days.map((d) => `<div class="day">${group(dayLabel(d.date, state.today, true))}
    ${d.events.map((occ) => { const p = eventParts(state, occ, state.today); return `<button type="button" class="item" data-action="edit-event" data-id="${p.ev.id}">${p.inner}</button>`; }).join('')}</div>`).join('');
  return `
  <h1 class="bigtitle">Kalender</h1>
  <div class="calbar">${iconBtn('back', 'Vier Wochen zurück', 'data-action="cal-move" data-step="-1"')}
    <span class="cap">${esc(fmtRange.format(asDate(from)))} – ${esc(fmtRange.format(asDate(to)))}</span>
    ${iconBtn('next', 'Vier Wochen weiter', 'data-action="cal-move" data-step="1"')}</div>
  ${eventForm(state, editing || null)}
  <section class="section">${list || `<p class="empty">${esc(MSG.noEvents)}</p>`}</section>`;
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

// ---- Mehr --------------------------------------------------------------------

const infoRow = (label, value) => `<div class="item"><span class="t"><span>${esc(label)}</span><b>${value}</b></span></div>`;

function renderMore(state) {
  const s = state.session;
  const account = s
    ? `${infoRow('Angemeldet als', esc(s.user.name || s.user.email))}
       ${infoRow('Haushalt', esc(s.household?.name || '–'))}
       ${s.household?.inviteCode ? `<div class="item"><span class="t"><span>Einladungscode für deinen Partner</span><b><code class="invite">${esc(s.household.inviteCode)}</code></b></span>
         <button class="btn small" type="button" data-action="copy-code">Kopieren</button></div>` : ''}
       ${infoRow('Mitglieder', state.members.map((m) => esc(m.name || '–')).join(', ') || '–')}
       ${!s.household ? householdForms() : `<details><summary>anderem haushalt beitreten</summary><div>${joinForm()}</div></details>`}
       <div class="actions-row"><button class="btn" type="button" data-action="sync-now">Jetzt abgleichen</button>
          <button class="btn quiet" type="button" data-action="logout">Abmelden</button></div>`
    : `<p class="empty">Ohne Anmeldung bleibt alles auf diesem Gerät. Zum Teilen mit dem Partner meldet ihr euch beide am selben Server an.</p>
       <form class="editor" data-form="login">
         <label class="field"><span class="cap">server</span><input name="serverUrl" type="url" value="${attr(state.settings.serverUrl || state.defaultServer)}" required></label>
         <label class="field"><span class="cap">e-mail</span><input name="email" type="email" autocomplete="username" required></label>
         <label class="field"><span class="cap">passwort</span><input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
         <label class="field"><span class="cap">name (nur bei neuem konto)</span><input name="name" autocomplete="nickname"></label>
         <div class="actions"><button class="btn primary" type="submit" name="mode" value="login">Anmelden</button>
           <button class="btn" type="submit" name="mode" value="register">Neues Konto</button></div></form>`;
  return `
  <h1 class="bigtitle">Mehr</h1>
  <section class="section">${group('teilen')}${account}</section>
  <section class="section">${group('darstellung')}
    <label class="field"><span class="cap">farbschema</span><select data-action="theme">${Object.entries(THEME).map(([k, v]) => `<option value="${k}" ${k === state.settings.theme ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></section>
  <section class="section">${group('sicherung')}
    <p class="empty">Alle Listen, Aufgaben und Termine als Datei sichern oder aus einer Sicherung zurückholen.</p>
    <div class="actions-row"><button class="btn" type="button" data-action="export">Sicherung speichern</button>
      <label class="btn">Sicherung laden<input type="file" accept="application/json,.json" data-action="import" hidden></label></div></section>`;
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
