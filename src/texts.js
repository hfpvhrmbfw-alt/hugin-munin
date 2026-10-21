// Texte: Beschriftungen zu den IDs aus dem Modell und Meldungen. Gehört zur Oberfläche.

export const APP_NAME = 'Hugin & Munin';

export const TABS = { today: 'Heute', shopping: 'Einkauf', tasks: 'Aufgaben', calendar: 'Kalender', more: 'Mehr' };

export const CATEGORY = {
  produce: 'Obst & Gemüse', bakery: 'Brot & Backwaren', dairy: 'Milch & Käse', meat: 'Fleisch & Fisch',
  frozen: 'Tiefkühl', pantry: 'Vorrat', drinks: 'Getränke', household: 'Haushalt', care: 'Pflege', other: 'Sonstiges',
};

export const REPEAT = { none: 'einmalig', daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };
export const REPEAT_EVERY = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' };

export const KIND = { shopping: 'Einkaufsliste', tasks: 'Aufgabenliste' };

export const THEME = { system: 'wie das Gerät', light: 'hell', dark: 'dunkel' };

export const DEFAULT_LIST_NAME = { shopping: 'Einkauf', tasks: 'Zuhause' };

export const IMPORT_ERROR = {
  not_json: 'Die Datei ist keine gültige Sicherung (kein JSON).',
  wrong_app: 'Die Datei stammt nicht von Hugin & Munin.',
  too_new: 'Die Sicherung ist von einer neueren Version. Bitte zuerst die App aktualisieren.',
  bad_format: 'Die Sicherung ist beschädigt.',
};

export const SYNC = {
  local: 'nur auf diesem Gerät',
  syncing: 'gleicht ab …',
  ok: 'abgeglichen',
  offline: 'offline, gleicht später ab',
  error: 'Abgleich fehlgeschlagen',
  auth: 'bitte neu anmelden',
};

export const MSG = {
  confirmImport: (n) => `${n} Einträge aus der Sicherung übernehmen? Gleiche Einträge werden überschrieben.`,
  imported: (n, skipped) => `${n} Einträge übernommen${skipped ? `, ${skipped} fehlerhafte übersprungen` : ''}.`,
  confirmDeleteEvent: 'Diesen Termin (bei Wiederholung die ganze Serie) löschen?',
  confirmClearDone: 'Alle erledigten Einträge dieser Liste entfernen?',
  confirmLogout: 'Abmelden? Die Daten bleiben auf diesem Gerät.',
  confirmJoin: 'Beitreten? Deine bisherigen Einträge wandern in den neuen Haushalt.',
  loginFailed: 'Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmen nicht.',
  registerFailed: 'Konto konnte nicht angelegt werden. Ist die E-Mail schon vergeben oder das Passwort kürzer als 8 Zeichen?',
  serverUnreachable: 'Server nicht erreichbar. Stimmt die Adresse, und ist Tailscale an?',
  joinFailed: 'Kein Haushalt mit diesem Code gefunden.',
  copied: 'Code kopiert.',
  overdue: (n) => (n === 1 ? '1 Aufgabe überfällig' : `${n} Aufgaben überfällig`),
  shoppingOpen: (n) => (n === 0 ? 'Einkaufsliste leer' : n === 1 ? '1 Sache einzukaufen' : `${n} Sachen einzukaufen`),
  nothingToday: 'Heute steht nichts an.',
  nothingWeek: 'Die Woche ist frei.',
  emptyList: 'Noch nichts auf der Liste.',
  noEvents: 'Keine Termine in den nächsten vier Wochen.',
};

/** Fehlermeldung zu einem Abgleich- oder Server-Fehler. */
export function errorText(err) {
  if (err && err.status === 401) return SYNC.auth;
  if (err && err.status) return `${SYNC.error} (${err.status})`;
  return MSG.serverUnreachable;
}
