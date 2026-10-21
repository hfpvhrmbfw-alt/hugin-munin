/// <reference path="../pb_data/types.d.ts" />
// Hugin & Munin: Sammlungen und Zugriffsregeln, Schema-Version 1.
// Jeder Eintrag gehört zu einem Haushalt; lesen und schreiben darf nur, wer Mitglied ist.
// Aktualisieren nur mit gleichem oder neuerem changedAt (neuere Änderung gewinnt, auch auf dem Server).

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const member = "household.members.id ?= @request.auth.id";
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const syncFields = (households) => [
    { name: "household", type: "relation", collectionId: households.id, maxSelect: 1, required: true, cascadeDelete: true },
    { name: "changedAt", type: "number", onlyInt: true, min: 0 },
    { name: "changedBy", type: "relation", collectionId: users.id, maxSelect: 1 },
    { name: "deleted", type: "bool" },
  ];
  const syncRules = {
    listRule: member,
    viewRule: member,
    createRule: "@request.auth.id != '' && " + member,
    updateRule: member
      + " && (@request.body.household:isset = false || @request.body.household = household)"
      + " && (@request.body.changedAt:isset = false || @request.body.changedAt >= changedAt)",
    deleteRule: null, // gelöscht wird nur über das Feld "deleted"
  };

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
      ...timestamps,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_households_invite ON households (inviteCode)"],
  });
  app.save(households);


  const lists = new Collection({
    type: "base",
    name: "lists",
    ...syncRules,
    fields: [
      ...syncFields(households),
      { name: "kind", type: "select", values: ["shopping", "tasks"], maxSelect: 1, required: true },
      { name: "name", type: "text", max: 80 },
      { name: "color", type: "select", values: ["orange", "ink", "olive", "sky", "plum", "sand"], maxSelect: 1 },
      { name: "sort", type: "number" },
      { name: "archived", type: "bool" },
      ...timestamps,
    ],
    indexes: ["CREATE INDEX idx_lists_updated ON lists (household, updated)"],
  });
  app.save(lists);

  const items = new Collection({
    type: "base",
    name: "items",
    ...syncRules,
    fields: [
      ...syncFields(households),
      { name: "list", type: "relation", collectionId: lists.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "title", type: "text", max: 200 },
      { name: "note", type: "text", max: 2000 },
      { name: "quantity", type: "text", max: 40 },
      { name: "category", type: "select", maxSelect: 1,
        values: ["produce", "bakery", "dairy", "meat", "frozen", "pantry", "drinks", "household", "care", "other"] },
      { name: "done", type: "bool" },
      { name: "dueDate", type: "text", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "assignee", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "important", type: "bool" },
      { name: "sort", type: "number" },
      ...timestamps,
    ],
    indexes: ["CREATE INDEX idx_items_updated ON items (household, updated)"],
  });
  app.save(items);

  const events = new Collection({
    type: "base",
    name: "events",
    ...syncRules,
    fields: [
      ...syncFields(households),
      { name: "title", type: "text", max: 200 },
      { name: "notes", type: "text", max: 2000 },
      { name: "startDate", type: "text", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "endDate", type: "text", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "startTime", type: "text", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
      { name: "endTime", type: "text", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
      { name: "repeat", type: "select", values: ["none", "daily", "weekly", "monthly", "yearly"], maxSelect: 1 },
      { name: "repeatInterval", type: "number", onlyInt: true, min: 1, max: 99 },
      { name: "repeatUntil", type: "text", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "people", type: "relation", collectionId: users.id, maxSelect: 20 },
      ...timestamps,
    ],
    indexes: ["CREATE INDEX idx_events_updated ON events (household, updated)"],
  });
  app.save(events);
}, (app) => {
  for (const name of ["events", "items", "lists", "households"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
