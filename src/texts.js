// Texte: Beschriftungen zu den IDs aus dem Modell und Meldungen. Gehört zur Oberfläche.

export const APP_NAME = 'Hugin & Munin';

export const TABS = {
  today: 'Heute', shopping: 'Einkauf', tasks: 'Aufgaben', calendar: 'Kalender', meals: 'Essen', chores: 'Haushalt',
  expenses: 'Ausgaben', projects: 'Projekte', notes: 'Notizen', contacts: 'Kontakte', gifts: 'Geschenke', templates: 'Vorlagen', more: 'Mehr',
};

/** Module in den Einstellungen: Name und ein Satz, was es kann. */
export const MODULE = {
  shopping: ['Einkauf', 'Einkaufslisten, nach Bereich im Laden sortiert.'],
  tasks: ['Aufgaben', 'Aufgabenlisten mit Fälligkeit, „wichtig“ und Zuständigkeit.'],
  calendar: ['Kalender', 'Gemeinsame Termine, auch wiederkehrend.'],
  meals: ['Essensplan', 'Was es in dieser Woche zu essen gibt.'],
  chores: ['Haushaltsplan', 'Wiederkehrende Hausarbeit, ihr seid abwechselnd dran.'],
  expenses: ['Ausgaben', 'Gemeinsame Ausgaben und wer wem wie viel schuldet.'],
  projects: ['Projekte', 'Größere Vorhaben mit Schritten und Fortschritt.'],
  notes: ['Notizen', 'Gemeinsame Notizen, z. B. WLAN, Maße, Ideen.'],
  board: ['Pinnwand', 'Kurze Nachrichten oben auf „Heute“.'],
  contacts: ['Kontakte & Geburtstage', 'Adressen, Nummern, Geburtstage mit Erinnerung auf „Heute“.'],
  gifts: ['Geschenkideen', 'Ideen sammeln, auf Wunsch nur für dich sichtbar.'],
  templates: ['Listen-Vorlagen', 'Wiederkehrende Listen wie Wocheneinkauf oder Packliste.'],
};

/** Speicherorte: Name und Hinweis. */
export const STORAGE = {
  local: ['Nur auf diesem Gerät', 'Kein Server, kein Konto. Teilen mit dem Partner geht dann nicht, eine Sicherung als Datei schon.'],
  tailscale: ['Eigener Server über Tailscale', 'Der Mac mini zu Hause, von überall erreichbar über die Tailscale-App. Empfohlen.'],
  wireguard: ['Eigener Server über WireGuard', 'Der Mac mini über einen eigenen WireGuard-Tunnel (z. B. von der FritzBox). Die WireGuard-App muss an sein.'],
  lan: ['Eigener Server im Heimnetz', 'Nur im WLAN zu Hause erreichbar. Unterwegs speichert die App und gleicht später ab.'],
  domain: ['Eigener Server mit eigener Adresse', 'Der Mac mini unter einer eigenen Domain mit HTTPS, z. B. über Cloudflare Tunnel.'],
  hosted: ['Gemieteter Server', 'PocketBase bei einem Anbieter (z. B. PocketHost). Die Daten liegen dann nicht bei euch zu Hause.'],
};

export const ADDRESS_ERROR = {
  missing_host: 'Bitte die Adresse des Servers vollständig eintragen.',
  bad_host: 'Die Adresse enthält ungültige Zeichen (keine Leerzeichen, kein „/“).',
  bad_port: 'Der Port muss eine Zahl zwischen 1 und 65535 sein (Standard 8090).',
  need_https: 'Hier ist nur eine https-Adresse sicher genug.',
  bad_url: 'Das sieht nicht wie eine Adresse aus, z. B. https://planer.example.de',
};

export const MEAL_SLOT = { breakfast: 'frühstück', lunch: 'mittag', dinner: 'abend' };
export const CHORE_UNIT = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate' };
export const GIFT_STATUS = { idea: 'idee', bought: 'gekauft', given: 'verschenkt' };

export const CATEGORY = {
  produce: 'Obst & Gemüse', bakery: 'Brot & Backwaren', dairy: 'Milch & Käse', meat: 'Fleisch & Fisch',
  frozen: 'Tiefkühl', pantry: 'Vorrat', drinks: 'Getränke', household: 'Haushalt', care: 'Pflege', other: 'Sonstiges',
};

export const REPEAT = { none: 'einmalig', daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };
export const REPEAT_EVERY = { daily: 'Tage', weekly: 'Wochen', monthly: 'Monate', yearly: 'Jahre' };

export const KIND = { shopping: 'Einkaufsliste', tasks: 'Aufgabenliste', project: 'Projekt', template: 'Vorlage' };

export const THEME = { system: 'wie das Gerät', light: 'hell', dark: 'dunkel' };

export const DEFAULT_LIST_NAME = { shopping: 'Einkauf', tasks: 'Zuhause', project: 'Neues Projekt', template: 'Wocheneinkauf' };

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
  serverUnreachable: 'Server nicht erreichbar. Stimmt die Adresse, und ist Tailscale bzw. WireGuard an?',
  mixedContent: 'Diese Seite ist über https geöffnet, der Server spricht nur http. Das blockiert der Browser. Öffne die App dann direkt vom Server, also über die Adresse unten.',
  confirmModuleOff: (name) => `„${name}“ ausblenden? Die Einträge bleiben gespeichert und sind wieder da, wenn du es einschaltest.`,
  confirmDelete: 'Wirklich löschen?',
  noMembers: 'Wer wem etwas schuldet, steht hier, sobald ihr zu zweit im Haushalt seid (Mehr → Speicherort).',
  settled: 'Alles ausgeglichen.',
  noChores: 'Noch nichts im Plan, z. B. Bad putzen, Müll rausbringen.',
  noMeals: 'noch nichts geplant',
  noNotes: 'Noch keine Notizen.',
  noContacts: 'Noch keine Kontakte.',
  noGifts: 'Noch keine Ideen.',
  noProjects: 'Noch keine Projekte.',
  noTemplates: 'Noch keine Vorlage. Lege eine an, z. B. „Wocheneinkauf“ oder „Packliste Urlaub“.',
  templateApplied: (n) => (n === 0 ? 'Steht schon alles auf der Liste.' : n === 1 ? '1 Eintrag übernommen.' : `${n} Einträge übernommen.`),
  badAmount: 'Bitte einen Betrag eingeben, z. B. 12,50.',
  badBirthday: 'Geburtstag bitte als Tag und Monat, z. B. 24.12.',
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
