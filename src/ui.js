// Oberfläche: Zustand der Ansicht und Rendering. Formatiert Daten aus der Logik zu Text und HTML.
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

function label(no, text) {
  return `<h2 class="label"><span class="no">№ ${String(no).padStart(2, '0')}</span> — ${esc(text)}</h2>`;
}

// ---- Rahmen ------------------------------------------------------------------

export function renderShell(state) {
  const tabs = Object.entries(TABS).map(([id, name]) =>
    `<button role="tab" type="button" data-action="tab" data-tab="${id}" aria-selected="${state.tab === id}" tabindex="${state.tab === id ? 0 : -1}">${name}</button>`).join('');
  const s = state.sync;
  const syncText = !state.session ? SYNC.local
    : s.status === 'ok' ? `${SYNC.ok} ${fmtTime.format(new Date(s.at))}` : (s.message || SYNC[s.status] || '');
  return `
  <header class="runhead"><div class="wrap cap"><span class="brand">${esc(APP_NAME)}</span>
    <span class="sync" data-status="${attr(state.session ? s.status : 'local')}" role="status">${esc(syncText)}</span></div></header>
  <nav class="tabs appnav wrap" aria-label="Bereiche"><div role="tablist">${tabs}</div></nav>
  <main class="wrap" id="main">${state.flash ? `<div class="note info" role="status"><span class="cap">Hinweis</span>${esc(state.flash)}</div>` : ''}${renderTab(state)}</main>`;
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

// ---- Heute -----------------------------------------------------------------

function eventLine(state, occ, today) {
  const ev = state.data.events.find((e) => e.id === occ.eventId);
  const multi = occ.start !== occ.end;
  const when = ev.startTime ? `${ev.startTime}${ev.endTime ? '–' + ev.endTime : ''}` : 'ganztägig';
  const span = multi ? ` · ${dayLabel(occ.start, today)} bis ${dayLabel(occ.end, today)}` : '';
  const who = ev.people.map((p) => memberName(state, p)).filter(Boolean).join(', ');
  return `<div class="row"><span><span class="fill">${esc(when)}</span> <b>${esc(ev.title || 'Termin')}</b>${esc(span)}${who ? ` <span class="tag">${esc(who)}</span>` : ''}</span></div>`;
}

function taskLine(state, item, today) {
  return `<label class="check"><input type="checkbox" data-action="toggle" data-id="${item.id}" ${item.done ? 'checked' : ''}>
    <span>${esc(item.title)}${item.dueDate && item.dueDate < today ? ` <span class="tag acc">${esc(dayLabel(item.dueDate, today))}</span>` : ''}${item.important ? ' <span class="tag inv">wichtig</span>' : ''}${item.assignee ? ` <span class="tag">${esc(memberName(state, item.assignee))}</span>` : ''}</span></label>`;
}

function renderToday(state) {
  const o = overview(state.data, state.today);
  const byId = new Map(state.data.items.map((i) => [i.id, i]));
  const plan = o.todayPlan;
  const todayRows = plan ? plan.events.map((e) => eventLine(state, e, state.today)).join('') + plan.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('') : '';
  const week = o.week.map((d) => `<div class="day"><div class="cap day-head">${esc(dayLabel(d.date, state.today, true))}</div>
    ${d.events.map((e) => eventLine(state, e, state.today)).join('')}${d.tasks.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</div>`).join('');
  return `
  <section class="hero"><h1>${esc(fmtDay.format(asDate(state.today)))}</h1>
    <div class="subtitle cap">${esc(MSG.shoppingOpen(o.shoppingOpen))}${o.overdue.length ? `<span class="sep">·</span>${esc(MSG.overdue(o.overdue.length))}` : ''}</div></section>
  <hr class="rule-heavy">
  ${o.overdue.length ? `<section class="section">${label(1, 'Überfällig')}${o.overdue.map((id) => taskLine(state, byId.get(id), state.today)).join('')}</section>` : ''}
  <section class="section">${label(o.overdue.length ? 2 : 1, 'Heute')}${todayRows || `<p class="empty">${esc(MSG.nothingToday)}</p>`}</section>
  <section class="section">${label(o.overdue.length ? 3 : 2, 'Diese Woche')}${week || `<p class="empty">${esc(MSG.nothingWeek)}</p>`}</section>`;
}

// ---- Listen ------------------------------------------------------------------

function listPicker(state, kind, currentId) {
  const lists = alive(state.data.lists).filter((l) => l.kind === kind && !l.archived).sort((a, b) => a.sort - b.sort);
  const opts = lists.map((l) => `<option value="${l.id}" ${l.id === currentId ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  return `<div class="toolbar">
    <label class="field grow"><span class="cap">Liste</span><select data-action="pick-list" data-kind="${kind}">${opts}</select></label>
    <button class="btn" type="button" data-action="new-list" data-kind="${kind}">Neue Liste</button>
    <button class="btn" type="button" data-action="rename-list" data-id="${currentId}">Umbenennen</button></div>`;
}

function renderShopping(state) {
  const list = state.data.lists.find((l) => l.id === state.shopListId);
  if (!list) return '';
  const g = groupShopping(itemsOf(state.data.items, list.id));
  let no = 1;
  const groups = g.open.map((grp) => `<section class="section">${label(no++, CATEGORY[grp.category])}
    ${grp.items.map((i) => shopRow(i)).join('')}</section>`).join('');
  return `${listPicker(state, 'shopping', list.id)}
  <form class="quickadd" data-form="add-shopping">
    <label class="field grow"><span class="cap">Hinzufügen</span>
      <input name="text" autocomplete="off" placeholder="z. B. 2 Milch, Brot, Äpfel" enterkeyhint="done"></label>
    <label class="field"><span class="cap">Bereich</span><select name="category">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === state.lastCategory ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select></label>
    <button class="btn primary" type="submit">Dazu</button></form>
  ${groups || `<p class="empty">${esc(MSG.emptyList)}</p>`}
  ${g.done.length ? `<details><summary>Erledigt (${g.done.length})</summary><div>${g.done.map((i) => shopRow(i)).join('')}
    <p><button class="btn" type="button" data-action="clear-done" data-id="${list.id}">Erledigte entfernen</button></p></div></details>` : ''}`;
}

function shopRow(i) {
  return `<div class="item"><label class="check"><input type="checkbox" data-action="toggle" data-id="${i.id}" ${i.done ? 'checked' : ''}>
    <span>${i.quantity ? `<span class="fill">${esc(i.quantity)}</span> ` : ''}${esc(i.title)}</span></label>
    <select class="mini" aria-label="Bereich für ${attr(i.title)}" data-action="set-category" data-id="${i.id}">${SHOPPING_CATEGORIES.map((c) => `<option value="${c}" ${c === (i.category || 'other') ? 'selected' : ''}>${esc(CATEGORY[c])}</option>`).join('')}</select></div>`;
}

function renderTasks(state) {
  const list = state.data.lists.find((l) => l.id === state.taskListId);
  if (!list) return '';
  const items = sortTasks(itemsOf(state.data.items, list.id));
  const open = items.filter((i) => !i.done); const done = items.filter((i) => i.done);
  return `${listPicker(state, 'tasks', list.id)}
  <form class="quickadd" data-form="add-task">
    <label class="field grow"><span class="cap">Neue Aufgabe</span><input name="title" autocomplete="off" required></label>
    <label class="field"><span class="cap">Fällig</span><input name="dueDate" type="date"></label>
    <button class="btn primary" type="submit">Dazu</button></form>
  <section class="section">${label(1, 'Offen')}${open.map((i) => taskRow(state, i)).join('') || `<p class="empty">${esc(MSG.emptyList)}</p>`}</section>
  ${done.length ? `<details><summary>Erledigt (${done.length})</summary><div>${done.map((i) => taskRow(state, i)).join('')}
    <p><button class="btn" type="button" data-action="clear-done" data-id="${list.id}">Erledigte entfernen</button></p></div></details>` : ''}`;
}

function taskRow(state, i) {
  const editing = state.editing === i.id;
  const due = i.dueDate ? ` <span class="tag ${i.dueDate < state.today && !i.done ? 'acc' : ''}">${esc(dayLabel(i.dueDate, state.today))}</span>` : '';
  const head = `<div class="item"><label class="check"><input type="checkbox" data-action="toggle" data-id="${i.id}" ${i.done ? 'checked' : ''}>
    <span>${esc(i.title)}${due}${i.important ? ' <span class="tag inv">wichtig</span>' : ''}${i.assignee ? ` <span class="tag">${esc(memberName(state, i.assignee))}</span>` : ''}</span></label>
    <button class="btn small" type="button" data-action="edit" data-id="${i.id}" aria-expanded="${editing}">${editing ? 'Fertig' : 'Ändern'}</button></div>`;
  if (!editing) return head;
  const members = state.members.map((m) => `<option value="${m.id}" ${m.id === i.assignee ? 'selected' : ''}>${esc(m.name || 'ohne Namen')}</option>`).join('');
  return head + `<form class="editor" data-form="edit-task" data-id="${i.id}">
    <label class="field"><span class="cap">Titel</span><input name="title" value="${attr(i.title)}" required></label>
    <label class="field"><span class="cap">Fällig</span><input name="dueDate" type="date" value="${attr(i.dueDate || '')}"></label>
    ${members ? `<label class="field"><span class="cap">Wer</span><select name="assignee"><option value="">niemand</option>${members}</select></label>` : ''}
    <label class="field"><span class="cap">Notiz</span><input name="note" value="${attr(i.note || '')}"></label>
    <label class="check inline"><input type="checkbox" name="important" ${i.important ? 'checked' : ''}><span>wichtig</span></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      <button class="btn" type="button" data-action="delete-item" data-id="${i.id}">Löschen</button></div></form>`;
}

// ---- Kalender ------------------------------------------------------------------

function renderCalendar(state) {
  const from = addDays(state.today, state.calOffset * 28);
  const to = addDays(from, 27);
  const days = agenda({ ...state.data, items: [] }, from, to);
  const editing = state.editing && state.data.events.find((e) => e.id === state.editing);
  const list = days.map((d) => `<div class="day"><div class="cap day-head">${esc(dayLabel(d.date, state.today, true))}</div>
    ${d.events.map((occ) => { const ev = state.data.events.find((e) => e.id === occ.eventId); return `<button type="button" class="evt" data-action="edit-event" data-id="${ev.id}">${eventLine(state, occ, state.today)}</button>`; }).join('')}</div>`).join('');
  return `<div class="toolbar cal">
    <button class="btn" type="button" data-action="cal-move" data-step="-1">Zurück</button>
    <span class="cap grow center">${esc(fmtRange.format(asDate(from)))} – ${esc(fmtRange.format(asDate(to)))}</span>
    <button class="btn" type="button" data-action="cal-move" data-step="1">Weiter</button></div>
  ${eventForm(state, editing || null)}
  <section class="section">${label(1, 'Termine')}${list || `<p class="empty">${esc(MSG.noEvents)}</p>`}</section>`;
}

function eventForm(state, ev) {
  const v = ev || { title: '', startDate: state.today, endDate: state.today, startTime: null, endTime: null, repeat: 'none', repeatInterval: 1, repeatUntil: null, notes: null, people: [] };
  const people = state.members.map((m) => `<label class="check inline"><input type="checkbox" name="people" value="${m.id}" ${v.people.includes(m.id) ? 'checked' : ''}><span>${esc(m.name || 'ohne Namen')}</span></label>`).join('');
  return `<details ${ev ? 'open' : ''} class="event-form"><summary>${ev ? 'Termin ändern' : 'Neuer Termin'}</summary><div>
  <form class="editor" data-form="save-event" data-id="${ev ? ev.id : ''}">
    <label class="field"><span class="cap">Titel</span><input name="title" value="${attr(v.title)}" required></label>
    <div class="pair"><label class="field"><span class="cap">Von</span><input name="startDate" type="date" value="${v.startDate}" required></label>
      <label class="field"><span class="cap">Bis</span><input name="endDate" type="date" value="${v.endDate}"></label></div>
    <div class="pair"><label class="field"><span class="cap">Beginn</span><input name="startTime" type="time" value="${attr(v.startTime || '')}"></label>
      <label class="field"><span class="cap">Ende</span><input name="endTime" type="time" value="${attr(v.endTime || '')}"></label></div>
    <div class="pair"><label class="field"><span class="cap">Wiederholen</span><select name="repeat">${REPEATS.map((r) => `<option value="${r}" ${r === v.repeat ? 'selected' : ''}>${esc(REPEAT[r])}</option>`).join('')}</select></label>
      <label class="field"><span class="cap">Alle … ${esc(REPEAT_EVERY[v.repeat] || '')}</span><input name="repeatInterval" type="number" min="1" max="99" value="${v.repeatInterval}"></label></div>
    <label class="field"><span class="cap">Wiederholen bis (optional)</span><input name="repeatUntil" type="date" value="${attr(v.repeatUntil || '')}"></label>
    ${people ? `<fieldset class="people"><legend class="cap">Wer</legend>${people}</fieldset>` : ''}
    <label class="field"><span class="cap">Notiz</span><input name="notes" value="${attr(v.notes || '')}"></label>
    <div class="actions"><button class="btn primary" type="submit">Speichern</button>
      ${ev ? `<button class="btn" type="button" data-action="cancel-edit">Abbrechen</button><button class="btn" type="button" data-action="delete-event" data-id="${ev.id}">Löschen</button>` : ''}</div>
  </form></div></details>`;
}

// ---- Mehr --------------------------------------------------------------------

function renderMore(state) {
  const s = state.session;
  const account = s
    ? `<div class="row"><span>Angemeldet als <b>${esc(s.user.name || s.user.email)}</b></span></div>
       <div class="row"><span>Haushalt <b>${esc(s.household?.name || '–')}</b></span></div>
       ${s.household?.inviteCode ? `<div class="row"><span>Einladungscode für deinen Partner: <code class="invite">${esc(s.household.inviteCode)}</code>
         <button class="btn small" type="button" data-action="copy-code">Kopieren</button></span></div>` : ''}
       <div class="row"><span>Mitglieder: ${state.members.map((m) => esc(m.name || '–')).join(', ') || '–'}</span></div>
       ${!s.household ? householdForms() : `<details><summary>Anderem Haushalt beitreten</summary><div>${joinForm()}</div></details>`}
       <p><button class="btn" type="button" data-action="sync-now">Jetzt abgleichen</button>
          <button class="btn" type="button" data-action="logout">Abmelden</button></p>`
    : `<p>Ohne Anmeldung bleibt alles auf diesem Gerät. Zum Teilen mit dem Partner meldet ihr euch beide am selben Server an.</p>
       <form class="editor" data-form="login">
         <label class="field"><span class="cap">Server</span><input name="serverUrl" type="url" value="${attr(state.settings.serverUrl || state.defaultServer)}" required></label>
         <label class="field"><span class="cap">E-Mail</span><input name="email" type="email" autocomplete="username" required></label>
         <label class="field"><span class="cap">Passwort</span><input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
         <label class="field"><span class="cap">Name (nur bei neuem Konto)</span><input name="name" autocomplete="nickname"></label>
         <div class="actions"><button class="btn primary" type="submit" name="mode" value="login">Anmelden</button>
           <button class="btn" type="submit" name="mode" value="register">Neues Konto</button></div></form>`;
  return `
  <section class="section">${label(1, 'Teilen')}${account}</section>
  <section class="section">${label(2, 'Darstellung')}
    <label class="field"><span class="cap">Farbschema</span><select data-action="theme">${Object.entries(THEME).map(([k, v]) => `<option value="${k}" ${k === state.settings.theme ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></section>
  <section class="section">${label(3, 'Sicherung')}
    <p>Alle Listen, Aufgaben und Termine als Datei sichern oder aus einer Sicherung zurückholen.</p>
    <p><button class="btn" type="button" data-action="export">Sicherung speichern</button>
      <label class="btn">Sicherung laden<input type="file" accept="application/json,.json" data-action="import" hidden></label></p></section>`;
}

function householdForms() {
  return `<form class="editor" data-form="create-household">
    <label class="field"><span class="cap">Neuer Haushalt</span><input name="name" value="Zuhause" required></label>
    <div class="actions"><button class="btn primary" type="submit">Haushalt anlegen</button></div></form>
    <p class="cap">oder</p>${joinForm()}`;
}

function joinForm() {
  return `<form class="editor" data-form="join">
    <label class="field"><span class="cap">Einladungscode</span><input name="code" autocomplete="off" required minlength="12"></label>
    <div class="actions"><button class="btn" type="submit">Beitreten</button></div></form>`;
}
