/// <reference path="../pb_data/types.d.ts" />
// Kalender-Abo: geheimer Link je Haushalt (households.feedToken, leer = aus). Versteckt, damit ihn
// nur der eigene Endpunkt /api/hm/feed-token ausgibt.

migrate((app) => {
  const households = app.findCollectionByNameOrId("households");
  households.fields.add(new TextField({ name: "feedToken", max: 64, hidden: true }));
  households.addIndex("idx_households_feed", true, "feedToken", "feedToken != ''");
  app.save(households);
}, (app) => {
  const households = app.findCollectionByNameOrId("households");
  households.removeIndex("idx_households_feed");
  households.fields.removeByName("feedToken");
  app.save(households);
});
