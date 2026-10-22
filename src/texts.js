// Texte: Beschriftungen zu den IDs aus dem Modell und Meldungen. Gehört zur Oberfläche.

export const APP_NAME = 'Hugin & Munin';

/** Bild für leere Seiten je Motiv (Raben-Zeichnungen von Anna), liegt in icons/. */
export const RAVEN = {
  shopping: 'rabe-shopping.png', tasks: 'rabe-tasks.png', calendar: 'rabe-calendar.png', today: 'rabe-today.png', notes: 'rabe-notes.png',
  contacts: 'rabe-contacts.png', gifts: 'rabe-gifts.png', projects: 'rabe-projects.png', search: 'rabe-search.png',
};

// Oberflächenwörter klein (Castra · Blei), Sätze normal.
export const TABS = {
  today: 'heute', shopping: 'einkauf', tasks: 'aufgaben', calendar: 'kalender', meals: 'essen', chores: 'haushalt',
  expenses: 'ausgaben', projects: 'projekte', notes: 'notizen', contacts: 'kontakte', gifts: 'geschenke', templates: 'vorlagen', more: 'mehr',
  search: 'suche',
};

/** Bereiche in der Suche. */
export const AREA = {
  shopping: 'einkauf', tasks: 'aufgaben', project: 'projekte', calendar: 'kalender', notes: 'notizen', contacts: 'kontakte',
  gifts: 'geschenke', meals: 'essen', expenses: 'ausgaben', chores: 'haushalt',
};

/** Module in den Einstellungen: Name und ein Satz, was es kann. */
export const MODULE = {
  shopping: ['einkauf', 'Einkaufslisten, nach Bereich im Laden sortiert.'],
  tasks: ['aufgaben', 'Aufgabenlisten mit Fälligkeit, „wichtig“ und Zuständigkeit.'],
  calendar: ['kalender', 'Gemeinsame Termine, auch wiederkehrend, dazu fremde Kalender wie Schulferien.'],
  meals: ['essensplan', 'Was es in dieser Woche zu essen gibt.'],
  chores: ['haushaltsplan', 'Wiederkehrende Hausarbeit, ihr seid abwechselnd dran.'],
  expenses: ['ausgaben', 'Gemeinsame Ausgaben und wer wem wie viel schuldet.'],
  projects: ['projekte', 'Größere Vorhaben mit Schritten und Fortschritt.'],
  notes: ['notizen', 'Gemeinsame Notizen, z. B. WLAN, Maße, Ideen.'],
  board: ['pinnwand', 'Kurze Nachrichten oben auf „Heute“.'],
  contacts: ['kontakte & geburtstage', 'Adressen, Nummern, Geburtstage mit Erinnerung auf „Heute“.'],
  gifts: ['geschenkideen', 'Ideen sammeln, auf Wunsch nur für dich sichtbar.'],
  templates: ['listen-vorlagen', 'Wiederkehrende Listen wie Wocheneinkauf oder Packliste.'],
};

/** Speicherorte: Name und Hinweis. */
export const STORAGE = {
  local: ['nur auf diesem gerät', 'Kein Server, kein Konto. Teilen mit dem Partner geht dann nicht, eine Sicherung als Datei schon.'],
  tailscale: ['unser mac mini zu hause', 'Gemeinsam mit dem Partner, von überall erreichbar über die Tailscale-App. Empfohlen.'],
  wireguard: ['eigener server über wireguard', 'Der Mac mini über einen eigenen WireGuard-Tunnel (z. B. von der FritzBox). Die WireGuard-App muss an sein.'],
  lan: ['eigener server im heimnetz', 'Nur im WLAN zu Hause erreichbar. Unterwegs speichert die App und gleicht später ab.'],
  domain: ['eigener server mit eigener adresse', 'Der Mac mini unter einer eigenen Domain mit HTTPS, z. B. über Cloudflare Tunnel.'],
  hosted: ['gemieteter server', 'PocketBase bei einem Anbieter (z. B. PocketHost). Die Daten liegen dann nicht bei euch zu Hause.'],
};

export const ADDRESS_ERROR = {
  missing_host: 'Bitte die Adresse des Servers vollständig eintragen.',
  bad_host: 'Die Adresse enthält ungültige Zeichen (keine Leerzeichen, kein „/“).',
  bad_port: 'Der Port muss eine Zahl zwischen 1 und 65535 sein (Standard 8090).',
  need_https: 'Hier ist nur eine https-Adresse sicher genug.',
  bad_url: 'Das sieht nicht wie eine Adresse aus, z. B. https://planer.example.de',
};

export const MEAL_SLOT = { breakfast: 'frühstück', lunch: 'mittag', dinner: 'abend' };
export const CHORE_UNIT = { daily: 'tage', weekly: 'wochen', monthly: 'monate' };
export const GIFT_STATUS = { idea: 'idee', bought: 'gekauft', given: 'verschenkt' };

export const CATEGORY = {
  produce: 'obst & gemüse', bakery: 'brot & backwaren', dairy: 'milch & käse', meat: 'fleisch & fisch',
  frozen: 'tiefkühl', pantry: 'vorrat', drinks: 'getränke', household: 'haushalt', care: 'pflege', other: 'sonstiges',
};

export const REPEAT = { none: 'einmalig', daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', yearly: 'jährlich' };
export const REPEAT_EVERY = { daily: 'tage', weekly: 'wochen', monthly: 'monate', yearly: 'jahre' };

export const KIND = { shopping: 'einkaufsliste', tasks: 'aufgabenliste', project: 'projekt', template: 'vorlage' };

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
  noEventsDay: 'Keine Termine an diesem Tag.',
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
  moreTasks: (n) => (n === 1 ? '1 weitere aufgabe' : `${n} weitere aufgaben`),
  // Hinweise auf „heute“
  installIos: 'Hol dir Hugin & Munin auf den Home-Bildschirm: unten in Safari auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. So startet die App wie eine richtige App, kann Erinnerungen schicken, und Safari räumt eure Einträge nicht weg.',
  installOther: 'Installiere Hugin & Munin als App. Dann startet sie ohne Browserleiste, und der Browser räumt eure Einträge nicht weg.',
  backupNever: 'Eure Einträge liegen nur auf diesem Gerät. Speichere ab und zu eine Sicherung, z. B. in iCloud Drive.',
  backupDue: 'Die letzte Sicherung ist über einen Monat her. Eure Einträge liegen nur auf diesem Gerät.',
  newVersion: 'Neue Version geladen.',
  emptyList: 'Noch nichts auf der Liste.',
  allDone: 'Alles erledigt. Zeit für eine Pause.',
  noEvents: 'Keine Termine in den nächsten vier Wochen.',
  // Rückgängig
  undoDone: 'abgehakt', undoDeleted: 'gelöscht', undoUnpinned: 'abgenommen',
  undoCleared: (n) => (n === 1 ? '1 eintrag entfernt' : `${n} einträge entfernt`),
  // Suche
  searchHint: 'Sucht in Listen, Terminen, Notizen, Kontakten und mehr.',
  noResults: 'Nichts gefunden.',
  // Teilen
  listCopied: 'Liste kopiert.',
  // Fremde Kalender
  feedsHint: 'Kalender-Abos (ICS), z. B. Schulferien, Müllabfuhr oder der Arbeitskalender. Die Adresse endet meist auf .ics oder beginnt mit webcal://. Termine daraus sind nur zum Ansehen.',
  feedsLocal: 'Ohne eigenen Server lassen sich viele Kalender nicht laden, weil der Browser fremde Seiten nicht abrufen darf.',
  nothingLater: 'In den nächsten drei Monaten steht noch nichts an.',
  toMonth: 'ganzer kalender als monat',
  feedError: 'nicht erreichbar',
  feedErrors: {
    local: 'Ohne eigenen Server lädt der Browser Apple- und die meisten anderen Kalender nicht (fremde Seiten sind gesperrt). Dafür braucht es den Mac mini als Speicherort.',
    server: 'Der Mac mini ist gerade nicht erreichbar. Ist Tailscale an?',
    oldserver: 'Der Server kann fremde Kalender noch nicht laden. Bitte die neue Mac-App installieren.',
    sync: 'Der Server kennt den Kalender noch nicht. Gleich noch mal „Neu laden“.',
    gone: 'Unter dieser Adresse gibt es keinen Kalender (mehr). Ist er noch als „Öffentlicher Kalender“ freigegeben? Sonst den Link neu kopieren.',
    notics: 'Die Adresse ist keine Kalenderdatei. Beim Apple-Kalender den Link aus „Link teilen …“ nehmen, er beginnt mit webcal://.',
    large: 'Der Kalender ist zu groß.',
    auth: 'Bitte neu anmelden.',
    remote: 'Der Kalender antwortet gerade nicht. Später noch mal versuchen.',
  },
  feedLoaded: (n) => (n === 1 ? '1 termin' : `${n} termine`),
  appleIntro: 'Ein Kalender aus der Apple-Kalender-App (iCloud) lässt sich als öffentlicher Link freigeben und hier eintragen. Der Name kann leer bleiben, er wird dann aus dem Kalender übernommen.',
  appleIphone: [
    'Kalender-App öffnen, unten auf „Kalender“ tippen.',
    'Beim gewünschten iCloud-Kalender auf das (i) tippen.',
    'Ganz unten „Öffentlicher Kalender“ einschalten.',
    '„Link teilen …“ → „Kopieren“ und hier bei „adresse“ einfügen.',
  ],
  appleMac: [
    'Kalender-App öffnen, links mit der rechten Maustaste auf den iCloud-Kalender klicken.',
    '„Kalender teilen …“ wählen und „Öffentlicher Kalender“ anhaken.',
    'Den Link (webcal://…) kopieren und hier einfügen.',
  ],
  appleNote: 'Wer den Link kennt, kann die Termine lesen, also nur in Hugin & Munin eintragen. Änderungen im Apple-Kalender erscheinen hier nach spätestens einer halben Stunde, Termine daraus sind nur zum Ansehen. Kalender „Auf meinem iPhone/Mac“ ohne iCloud lassen sich nicht freigeben.',
  aboHint: 'Ein geheimer Link mit allen Terminen aus Hugin & Munin. Im Apple-Kalender abonniert, stehen sie dort neben deinen anderen Terminen, nur zum Ansehen. Ändern kannst du sie weiter hier.',
  aboLocal: 'Geht nur mit eigenem Server, weil der Apple-Kalender die Termine von dort abholt.',
  aboOldServer: 'Dein Server kennt das Kalender-Abo noch nicht. Bitte die neue Mac-App „Hugin & Munin“ installieren.',
  aboIphone: [
    'Link kopieren.',
    'Einstellungen → Apps → Kalender → Kalender-Accounts → Account hinzufügen → Andere.',
    '„Kalenderabo hinzufügen“ antippen, Link einfügen, „Weiter“ und „Sichern“.',
  ],
  aboMac: [
    'Link kopieren.',
    'Kalender-App: Ablage → Neues Kalenderabonnement …, Link einfügen, „Abonnieren“.',
    'Bei „Ort“ „Auf meinem Mac“ wählen, nicht iCloud. Automatisch aktualisieren: alle 15 Minuten.',
  ],
  aboNote: 'Der Kalender holt die Termine direkt vom Mac mini, unterwegs also nur mit eingeschaltetem Tailscale. Bei iCloud als Ort würde Apple sie abholen und den Mac mini nicht erreichen. Wer den Link kennt, sieht die Termine: Mit „Neuer Link“ hört der alte sofort auf zu gehen.',
  aboCopied: 'Link kopiert.',
  aboRenewAsk: 'Neuen Link erstellen? Der alte geht dann nicht mehr, auf allen Geräten muss der Kalender neu abonniert werden.',
  aboOffAsk: 'Kalender-Abo abschalten? Der Link geht dann nicht mehr.',
  aboFailed: 'Das hat nicht geklappt. Ist der Server erreichbar?',
  badFeedUrl: 'Bitte die Adresse des Kalenders eintragen (https://… oder webcal://…).',
  // Erinnerungen
  pushHint: 'Morgens um 7:30 ein Überblick über den Tag, 30 Minuten vor Terminen eine Erinnerung.',
  pushLocal: 'Erinnerungen kommen vom eigenen Server. Mit „nur auf diesem Gerät“ gibt es keine.',
  pushNoServer: 'Der Server verschickt keine Erinnerungen. Das kann nur die Mac-App „Hugin & Munin“ (siehe Anleitung Mac-App).',
  pushUnsupported: 'Dieser Browser kann keine Erinnerungen empfangen. Auf dem iPhone: erst „Zum Home-Bildschirm“ hinzufügen und die App von dort öffnen.',
  pushDenied: 'Mitteilungen sind für diese App ausgeschaltet. Einschalten in den Einstellungen des Geräts unter Mitteilungen.',
  pushOn: 'Erinnerungen sind auf diesem Gerät an.',
  pushOff: 'Erinnerungen sind auf diesem Gerät aus.',
  pushTestSent: 'Testnachricht ist unterwegs.',
  pushFailed: 'Das hat nicht geklappt. Ist der Server erreichbar?',
  // Sicherung
  backupServer: 'Der Server sichert zusätzlich jede Nacht um 3 Uhr (die letzten 14 Tage).',
  lastBackup: (d) => `Zuletzt gesichert: ${d}.`,
  noBackupYet: 'Auf diesem Gerät noch nie gesichert.',
};

/** Fehlermeldung zu einem Abgleich- oder Server-Fehler. */
export function errorText(err) {
  if (err && err.status === 401) return SYNC.auth;
  if (err && err.status) return `${SYNC.error} (${err.status})`;
  return MSG.serverUnreachable;
}
