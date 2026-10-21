/// <reference path="../pb_data/types.d.ts" />
// Hugin & Munin, Schema-Version 2: Sammlungen für die Module Notizen/Pinnwand, Ausgaben, Essensplan,
// Haushaltsplan, Kontakte und Geschenkideen; Listen bekommen die Arten "project" und "template".
// Regeln wie in Version 1. Geschenkideen mit private = true sieht und ändert nur owner.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const households = app.findCollectionByNameOrId("households");

  const lists = app.findCollectionByNameOrId("lists");
  lists.fields.getByName("kind").values = ["shopping", "tasks", "project", "template"];
  app.save(lists);

  const member = "household.members.id ?= @request.auth.id";
  const date = "^\\d{4}-\\d{2}-\\d{2}$";
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const syncFields = [
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
    deleteRule: null,
  };
  const make = (name, fields, rules) => {
    app.save(new Collection({
      type: "base",
      name,
      ...syncRules,
      ...(rules || {}),
      fields: [...syncFields, ...fields, ...timestamps],
      indexes: [`CREATE INDEX idx_${name}_updated ON ${name} (household, updated)`],
    }));
  };

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
}, (app) => {
  for (const name of ["gifts", "contacts", "chores", "meals", "expenses", "notes"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
  const lists = app.findCollectionByNameOrId("lists");
  lists.fields.getByName("kind").values = ["shopping", "tasks"];
  app.save(lists);
});
