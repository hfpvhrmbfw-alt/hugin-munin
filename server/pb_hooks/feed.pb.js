/// <reference path="../pb_data/types.d.ts" />
// Termine des Haushalts als Kalender-Abo, z. B. für den Apple-Kalender.
// GET    /api/hm/feed-token?household=…   → { token }   ("" = aus)
// POST   /api/hm/feed-token { household } → neuer Link, der alte hört auf zu gehen
// DELETE /api/hm/feed-token?household=…   → Link abschalten
// GET    /api/hm/feed/{token}.ics         → Kalenderdatei, ohne Anmeldung (Kalender-Apps können sich nicht anmelden).
// Wer den Link kennt, sieht die Termine. Deshalb ist er lang und zufällig und lässt sich jederzeit erneuern.

routerAdd("GET", "/api/hm/feed-token", (e) => {
  const { ownHousehold } = require(`${__hooks}/feed.cjs`);
  const h = ownHousehold(e, e.request.url.query().get("household"));
  return e.json(200, { token: h.getString("feedToken") });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/hm/feed-token", (e) => {
  const { ownHousehold } = require(`${__hooks}/feed.cjs`);
  const h = ownHousehold(e, e.requestInfo().body.household);
  const token = $security.randomStringWithAlphabet(40, "abcdefghijklmnopqrstuvwxyz0123456789");
  h.set("feedToken", token);
  e.app.save(h);
  return e.json(200, { token: token });
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/hm/feed-token", (e) => {
  const { ownHousehold } = require(`${__hooks}/feed.cjs`);
  const h = ownHousehold(e, e.request.url.query().get("household"));
  h.set("feedToken", "");
  e.app.save(h);
  return e.json(200, { token: "" });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/hm/feed/{file}", (e) => {
  const token = String(e.request.pathValue("file") || "").replace(/\.ics$/i, "");
  if (!/^[a-z0-9]{40}$/.test(token)) {
    throw new NotFoundError("unknown_feed");
  }
  let h;
  try {
    h = e.app.findFirstRecordByData("households", "feedToken", token);
  } catch (_) {
    throw new NotFoundError("unknown_feed");
  }
  const people = {};
  for (const uid of h.get("members") || []) {
    try { people[uid] = e.app.findRecordById("users", uid).getString("name"); } catch (_) { /* gelöschter Benutzer */ }
  }
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const events = e.app.findRecordsByFilter("events", "household = {:h} && deleted = false", "startDate", 5000, 0, { h: h.id }).map((r) => ({
    id: r.id, changedAt: r.getInt("changedAt"), title: r.getString("title"), notes: r.getString("notes"),
    startDate: r.getString("startDate"), endDate: r.getString("endDate"), startTime: r.getString("startTime"), endTime: r.getString("endTime"),
    repeat: r.getString("repeat"), repeatInterval: r.getInt("repeatInterval"), repeatUntil: r.getString("repeatUntil"), people: r.get("people") || [],
  }));
  const { buildIcs } = require(`${__hooks}/feed.cjs`);
  const body = buildIcs(events, { name: h.getString("name") || "Hugin & Munin", people: people, from: from });
  e.response.header().set("Content-Type", "text/calendar; charset=utf-8");
  e.response.header().set("Cache-Control", "no-store");
  return e.string(200, body);
});
