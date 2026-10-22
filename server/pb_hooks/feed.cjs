// Hilfen für das Kalender-Abo (feed.pb.js): Haushalt prüfen und Termine als Kalenderdatei (ICS) ausgeben.
// CommonJS ohne Abhängigkeiten, damit ihn die PocketBase-Hooks (require) und die Tests (node) gleich laden.
// Zeiten sind „schwebend“ (ohne Zeitzone): der Kalender zeigt sie so, wie sie in der App stehen.

const FREQ = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" };

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => d.replace(/-/g, "");

function addDays(d, n) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

function plusHour(d, time) {
  const h = Number(time.slice(0, 2)) + 1;
  return h < 24 ? [d, pad(h) + time.slice(2)] : [addDays(d, 1), pad(h - 24) + time.slice(2)];
}

const stamp = (d, time) => ymd(d) + "T" + time.replace(":", "") + "00";

/** Text nach RFC 5545 maskieren. */
const text = (v) => String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Zeilen über 75 Byte falten, ohne UTF-8-Zeichen zu zerschneiden. */
function fold(line) {
  const out = [];
  let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = unescape(encodeURIComponent(ch)).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * @param {object[]} events Termine wie in der App (title, notes, startDate, endDate, startTime, endTime,
 *   repeat, repeatInterval, repeatUntil, people, id, changedAt)
 * @param {{name:string, people?:Object<string,string>, from?:string}} opts Kalendername, Namen der Personen
 *   je id, ältere einmalige Termine als from fallen weg
 * @returns {string}
 */
function buildIcs(events, opts) {
  const people = opts.people || {};
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hugin & Munin//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + text(opts.name), "REFRESH-INTERVAL;VALUE=DURATION:PT30M", "X-PUBLISHED-TTL:PT30M",
  ];
  for (const e of events) {
    if (!e || e.deleted || !/^\d{4}-\d{2}-\d{2}$/.test(e.startDate || "")) continue;
    const repeat = FREQ[e.repeat] ? e.repeat : "none";
    const endDate = e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate;
    if (opts.from && repeat === "none" && endDate < opts.from) continue;
    if (opts.from && repeat !== "none" && e.repeatUntil && e.repeatUntil < opts.from) continue;
    const changed = new Date(Number(e.changedAt) || 0);
    lines.push("BEGIN:VEVENT", "UID:" + e.id + "@hugin-munin",
      "DTSTAMP:" + changed.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z");
    if (e.startTime) {
      let end;
      if (e.endTime) end = [endDate, e.endTime];
      else if (endDate > e.startDate) end = [addDays(endDate, 1), "00:00"];
      else end = plusHour(e.startDate, e.startTime);
      lines.push("DTSTART:" + stamp(e.startDate, e.startTime), "DTEND:" + stamp(end[0], end[1]));
    } else {
      lines.push("DTSTART;VALUE=DATE:" + ymd(e.startDate), "DTEND;VALUE=DATE:" + ymd(addDays(endDate, 1)));
    }
    if (repeat !== "none") {
      let rule = "RRULE:FREQ=" + FREQ[repeat];
      if (Number(e.repeatInterval) > 1) rule += ";INTERVAL=" + Number(e.repeatInterval);
      if (e.repeatUntil) rule += ";UNTIL=" + ymd(e.repeatUntil) + (e.startTime ? "T235959" : "");
      lines.push(rule);
    }
    lines.push("SUMMARY:" + text(e.title || "Termin"));
    const who = (e.people || []).map((id) => people[id]).filter(Boolean);
    const desc = [who.length ? "wer: " + who.join(", ") : "", e.notes || ""].filter(Boolean).join("\n");
    if (desc) lines.push("DESCRIPTION:" + text(desc));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Haushalt, in dem die angemeldete Person Mitglied ist, sonst 404. Nur im PocketBase-Hook nutzbar. */
function ownHousehold(e, id) {
  try {
    return e.app.findFirstRecordByFilter("households", "id = {:id} && members.id ?= {:uid}", { id: String(id || ""), uid: e.auth.id });
  } catch (_) {
    throw new NotFoundError("unknown_household");
  }
}

module.exports = { buildIcs, ownHousehold };
