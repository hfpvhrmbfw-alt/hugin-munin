/// <reference path="../pb_data/types.d.ts" />
// Fremden Kalender über den Server laden: GET /api/hm/ics?url=…
// Browser dürfen die meisten Kalender-Adressen nicht direkt abrufen (CORS), der Server schon.
// Nur Adressen, die in einem Kalender des eigenen Haushalts eingetragen sind, damit der Server
// nicht beliebige Seiten für jeden abruft.

routerAdd("GET", "/api/hm/ics", (e) => {
  const url = String(e.request.url.query().get("url") || "");
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("invalid_url");
  }
  try {
    e.app.findFirstRecordByFilter("calendars", "url = {:url} && deleted = false && household.members.id ?= {:uid}", { url: url, uid: e.auth.id });
  } catch (_) {
    throw new NotFoundError("unknown_calendar");
  }
  const res = $http.send({ url: url, method: "GET", timeout: 20, headers: { "User-Agent": "Hugin-Munin", "Accept": "text/calendar, */*" } });
  if (res.statusCode >= 400) {
    throw new BadRequestError("feed_" + res.statusCode);
  }
  const text = toString(res.body);
  if (text.length > 5 * 1024 * 1024) {
    throw new BadRequestError("feed_too_large");
  }
  e.response.header().set("Cache-Control", "no-store");
  return e.string(200, text);
}, $apis.requireAuth("users"));
