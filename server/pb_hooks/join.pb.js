/// <reference path="../pb_data/types.d.ts" />
// Einem Haushalt mit Einladungscode beitreten: POST /api/hm/join  { "code": "…" }
// Wer den Code kennt, wird Mitglied. Der Code steht in den Einstellungen der App.

routerAdd("POST", "/api/hm/join", (e) => {
  const code = String(e.requestInfo().body.code || "").trim();
  if (code.length < 12) {
    throw new BadRequestError("invalid_code");
  }
  let household;
  try {
    household = e.app.findFirstRecordByData("households", "inviteCode", code);
  } catch (_) {
    throw new NotFoundError("invalid_code");
  }
  const members = household.get("members") || [];
  if (members.indexOf(e.auth.id) === -1) {
    household.set("members", members.concat([e.auth.id]));
    e.app.save(household);
  }
  return e.json(200, { id: household.id, name: household.get("name") });
}, $apis.requireAuth("users"));

// Mitglieder der eigenen Haushalte: GET /api/hm/members → [{ id, name, household }]
// Eigener Endpunkt, damit die Benutzerliste sonst für niemanden lesbar bleibt.
routerAdd("GET", "/api/hm/members", (e) => {
  const households = e.app.findRecordsByFilter("households", "members.id ?= {:uid}", "created", 50, 0, { uid: e.auth.id });
  const out = [];
  for (const h of households) {
    for (const uid of h.get("members") || []) {
      try {
        const u = e.app.findRecordById("users", uid);
        out.push({ id: u.id, name: u.get("name") || "", household: h.id });
      } catch (_) { /* gelöschter Benutzer */ }
    }
  }
  return e.json(200, out);
}, $apis.requireAuth("users"));
