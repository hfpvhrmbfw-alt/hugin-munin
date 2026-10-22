/// <reference path="../pb_data/types.d.ts" />
// Hugin & Munin, Schema-Version 3:
// - calendars: fremde Kalender (ICS-Abos) je Haushalt, abgeglichen wie alle anderen Sammlungen.
// - push_subs: Push-Anmeldungen je Gerät, nur für die eigene Person sichtbar. Verschickt werden
//   Erinnerungen von der Mac-App (hm-server); ein einfacher PocketBase-Server speichert sie nur.
// - push_sent: welche Erinnerung schon verschickt ist, nur für den Server selbst.
// - Tägliche Sicherung um 3 Uhr, die letzten 14 bleiben (pb_data/backups), falls noch keine eingestellt ist.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const households = app.findCollectionByNameOrId("households");
  const member = "household.members.id ?= @request.auth.id";
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  app.save(new Collection({
    type: "base",
    name: "calendars",
    listRule: member,
    viewRule: member,
    createRule: "@request.auth.id != '' && " + member,
    updateRule: member
      + " && (@request.body.household:isset = false || @request.body.household = household)"
      + " && (@request.body.changedAt:isset = false || @request.body.changedAt >= changedAt)",
    deleteRule: null,
    fields: [
      { name: "household", type: "relation", collectionId: households.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "changedAt", type: "number", onlyInt: true, min: 0 },
      { name: "changedBy", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "deleted", type: "bool" },
      { name: "title", type: "text", max: 80 },
      { name: "url", type: "text", max: 1000 },
      ...timestamps,
    ],
    indexes: ["CREATE INDEX idx_calendars_updated ON calendars (household, updated)"],
  }));

  const own = "user = @request.auth.id";
  app.save(new Collection({
    type: "base",
    name: "push_subs",
    listRule: own,
    viewRule: own,
    createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
    updateRule: null,
    deleteRule: own,
    fields: [
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "endpoint", type: "text", required: true, max: 1000 },
      { name: "p256dh", type: "text", required: true, max: 200 },
      { name: "auth", type: "text", required: true, max: 100 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_push_subs_endpoint ON push_subs (endpoint)"],
  }));

  app.save(new Collection({
    type: "base",
    name: "push_sent",
    fields: [
      { name: "key", type: "text", required: true, max: 200 },
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_push_sent_key ON push_sent (key)"],
  }));

  const settings = app.settings();
  if (!settings.backups.cron) {
    settings.backups.cron = "0 3 * * *";
    settings.backups.cronMaxKeep = 14;
    app.save(settings);
  }
}, (app) => {
  for (const name of ["push_sent", "push_subs", "calendars"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
