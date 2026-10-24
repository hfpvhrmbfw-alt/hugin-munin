/// <reference path="../pb_data/types.d.ts" />
// Hugin & Munin: alle Sammlungen und Zugriffsregeln.
// Jeder Eintrag gehört zu einem Haushalt; lesen und schreiben darf nur, wer Mitglied ist.
// Aktualisieren nur mit gleichem oder neuerem changedAt (neuere Änderung gewinnt, auch auf dem Server).
// Gelöscht wird nur über das Feld "deleted". Geschenkideen mit private = true sieht und ändert nur owner.
// push_subs: Push-Anmeldungen je Gerät, nur für die eigene Person. push_sent: schon verschickte
// Erinnerungen, nur für den Server (hm-server aus der Mac-App).

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const member = "household.members.id ?= @request.auth.id";
  const date = "^\\d{4}-\\d{2}-\\d{2}$";
  const time = "^([01]\\d|2[0-3]):[0-5]\\d$";
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  // Kalender-Abo: geheimer Link je Haushalt (feedToken, leer = aus). Versteckt, damit ihn
  // nur der eigene Endpunkt /api/hm/feed-token ausgibt.
  const households = new Collection({
    type: "base",
    name: "households",
    listRule: "members.id ?= @request.auth.id",
    viewRule: "members.id ?= @request.auth.id",
    createRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    updateRule: "members.id ?= @request.auth.id",
    deleteRule: null,
    fields: [
      { name: "name", type: "text", required: true, max: 80 },
      { name: "members", type: "relation", collectionId: users.id, maxSelect: 20, required: true },
      { name: "inviteCode", type: "text", min: 12, max: 40, required: true },
      { name: "feedToken", type: "text", max: 64, hidden: true },
      ...timestamps,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_households_invite ON households (inviteCode)",
      "CREATE UNIQUE INDEX idx_households_feed ON households (feedToken) WHERE feedToken != ''",
    ],
  });
  app.save(households);

  const syncRules = {
    listRule: member,
    viewRule: member,
    createRule: "@request.auth.id != '' && " + member,
    updateRule: member
      + " && (@request.body.household:isset = false || @request.body.household = household)"
      + " && (@request.body.changedAt:isset = false || @request.body.changedAt >= changedAt)",
    deleteRule: null,
  };
  const make = (name, fields, rules) => {
    const c = new Collection({
      type: "base",
      name,
      ...syncRules,
      ...(rules || {}),
      fields: [
        { name: "household", type: "relation", collectionId: households.id, maxSelect: 1, required: true, cascadeDelete: true },
        { name: "changedAt", type: "number", onlyInt: true, min: 0 },
        { name: "changedBy", type: "relation", collectionId: users.id, maxSelect: 1 },
        { name: "deleted", type: "bool" },
        ...fields,
        ...timestamps,
      ],
      indexes: [`CREATE INDEX idx_${name}_updated ON ${name} (household, updated)`],
    });
    app.save(c);
    return c;
  };

  const lists = make("lists", [
    { name: "kind", type: "select", values: ["shopping", "tasks", "project", "template"], maxSelect: 1, required: true },
    { name: "name", type: "text", max: 80 },
    { name: "color", type: "select", values: ["orange", "ink", "olive", "sky", "plum", "sand"], maxSelect: 1 },
    { name: "sort", type: "number" },
    { name: "archived", type: "bool" },
  ]);

  make("items", [
    { name: "list", type: "relation", collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
    { name: "title", type: "text", max: 200 },
    { name: "note", type: "text", max: 2000 },
    { name: "quantity", type: "text", max: 40 },
    { name: "category", type: "select", maxSelect: 1,
      values: ["produce", "bakery", "dairy", "meat", "frozen", "pantry", "drinks", "household", "care", "other"] },
    { name: "done", type: "bool" },
    { name: "dueDate", type: "text", pattern: date },
    { name: "assignee", type: "relation", collectionId: users.id, maxSelect: 1 },
    { name: "important", type: "bool" },
    { name: "sort", type: "number" },
  ]);

  make("events", [
    { name: "title", type: "text", max: 200 },
    { name: "notes", type: "text", max: 2000 },
    { name: "startDate", type: "text", required: true, pattern: date },
    { name: "endDate", type: "text", required: true, pattern: date },
    { name: "startTime", type: "text", pattern: time },
    { name: "endTime", type: "text", pattern: time },
    { name: "repeat", type: "select", values: ["none", "daily", "weekly", "monthly", "yearly"], maxSelect: 1 },
    { name: "repeatInterval", type: "number", onlyInt: true, min: 1, max: 99 },
    { name: "repeatUntil", type: "text", pattern: date },
    { name: "people", type: "relation", collectionId: users.id, maxSelect: 20 },
  ]);

  make("notes", [
    { name: "title", type: "text", max: 120 },
    { name: "body", type: "text", max: 5000 },
    { name: "pinned", type: "bool" },
  ]);

  make("expenses", [
    { name: "kind", type: "select", values: ["expense", "settle"], maxSelect: 1 },
    { name: "title", type: "text", max: 120 },
    { name: "amount", type: "number", onlyInt: true, min: 0, max: 100000000 },
    { name: "date", type: "text", required: true, pattern: date },
    { name: "paidBy", type: "relation", collectionId: users.id, maxSelect: 1 },
    { name: "people", type: "relation", collectionId: users.id, maxSelect: 20 },
  ]);

  make("meals", [
    { name: "date", type: "text", required: true, pattern: date },
    { name: "slot", type: "select", values: ["breakfast", "lunch", "dinner"], maxSelect: 1 },
    { name: "title", type: "text", max: 120 },
    { name: "note", type: "text", max: 500 },
  ]);

  make("chores", [
    { name: "title", type: "text", max: 120 },
    { name: "people", type: "relation", collectionId: users.id, maxSelect: 20 },
    { name: "unit", type: "select", values: ["daily", "weekly", "monthly"], maxSelect: 1 },
    { name: "interval", type: "number", onlyInt: true, min: 1, max: 99 },
    { name: "startDate", type: "text", required: true, pattern: date },
    { name: "lastDone", type: "text", pattern: date },
    { name: "doneBy", type: "relation", collectionId: users.id, maxSelect: 1 },
  ]);

  make("contacts", [
    { name: "name", type: "text", max: 120 },
    { name: "birthday", type: "text", pattern: "^\\d{2}-\\d{2}$" },
    { name: "birthYear", type: "number", onlyInt: true, min: 1900, max: 2200 },
    { name: "phone", type: "text", max: 40 },
    { name: "email", type: "text", max: 120 },
    { name: "address", type: "text", max: 300 },
    { name: "note", type: "text", max: 2000 },
  ]);

  const mine = "(private = false || owner = @request.auth.id)";
  make("gifts", [
    { name: "forName", type: "text", max: 80 },
    { name: "contact", type: "text", max: 15 },
    { name: "title", type: "text", max: 200 },
    { name: "note", type: "text", max: 2000 },
    { name: "link", type: "text", max: 500 },
    { name: "status", type: "select", values: ["idea", "bought", "given"], maxSelect: 1 },
    { name: "private", type: "bool" },
    { name: "owner", type: "relation", collectionId: users.id, maxSelect: 1 },
  ], {
    listRule: member + " && " + mine,
    viewRule: member + " && " + mine,
    createRule: "@request.auth.id != '' && " + member + " && (@request.body.private != true || @request.body.owner = @request.auth.id)",
    updateRule: syncRules.updateRule + " && " + mine
      + " && (@request.body.private:isset = false || @request.body.private != true || @request.body.owner = @request.auth.id)",
  });

  // Fremde Kalender (ICS-Abos), abgeglichen wie alle anderen Sammlungen.
  make("calendars", [
    { name: "title", type: "text", max: 80 },
    { name: "url", type: "text", max: 1000 },
  ]);

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

  // Tägliche Sicherung um 3 Uhr, die letzten 14 bleiben (pb_data/backups), falls noch keine eingestellt ist.
  const settings = app.settings();
  if (!settings.backups.cron) {
    settings.backups.cron = "0 3 * * *";
    settings.backups.cronMaxKeep = 14;
    app.save(settings);
  }
}, (app) => {
  for (const name of ["push_sent", "push_subs", "calendars", "gifts", "contacts", "chores", "meals", "expenses", "notes", "events", "items", "lists", "households"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
