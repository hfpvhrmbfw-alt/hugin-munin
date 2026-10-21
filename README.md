# Hugin & Munin

Familienplaner für zwei, benannt nach Odins Raben „Gedanke“ und „Erinnerung“: Einkauf, Aufgaben und Kalender, gemeinsam mit dem Partner. Eine PWA ohne Build-Schritt und ohne Abhängigkeiten, Abgleich über einen eigenen PocketBase-Server (z. B. auf dem Mac mini zu Hause).

## Stand: Version 1

- **Heute:** Termine und fällige Aufgaben von heute, die Woche, Überfälliges, offener Einkauf.
- **Einkauf:** mehrere Listen, Schnelleingabe („2 Milch, Brot“), nach Bereich im Laden gruppiert, abhaken, Erledigtes aufräumen.
- **Aufgaben:** mehrere Listen, Fälligkeit, zuständige Person, „wichtig“, Notiz.
- **Kalender:** Termine mit Uhrzeit oder ganztägig, mehrtägig, Wiederholung (täglich, wöchentlich, monatlich, jährlich, mit Abstand und Ende), Personen.
- **Teilen:** Konto, Haushalt anlegen, Partner tritt mit Einladungscode bei, Änderungen erscheinen live beim anderen.
- **Offline:** alles wird zuerst auf dem Gerät gespeichert und später abgeglichen. Ohne Konto bleibt alles lokal.
- **Sicherung:** Export und Import als JSON.

Geplant (siehe Plan im Projekt): Ausgaben mit Ausgleich, Projekte, Notizen, Kontakte und Geburtstage mit Geschenkideen, Essensplan, Haushaltsplan mit Wechsel, Listen-Vorlagen, fremde Kalender, Pinnwand, Push-Erinnerungen.

## Aufbau

| Datei | Schicht | Aufgabe |
|---|---|---|
| `src/model.js` | Modell | Typen, Stammdaten-IDs, Prüfung (`sanitize…`), Export/Import, Migration |
| `src/logic.js` | Logik | reine Funktionen: Wiederholungen, Tagesplan, Sortierung, Zusammenführen beim Abgleich |
| `src/storage.js` | Speicher | IndexedDB, Ersatz localStorage |
| `src/sync.js` | Dienst | PocketBase: Anmeldung, Haushalt, Hoch- und Herunterladen, Live-Updates |
| `src/texts.js` | Texte | Beschriftungen und Meldungen |
| `src/ui.js`, `src/main.js` | Oberfläche | Rendering, Aktionen, Start; einzige Stelle mit Uhr und Zufall |
| `server/` | Server | PocketBase-Migration (Sammlungen, Regeln), Hook für Beitritt und Mitglieder, Startdatei für macOS |
| `mac/` | Mac-App | Server mit eingebautem Tailscale (Go) und Menüleisten-App (SwiftUI), siehe [Mac-App](docs/MAC-APP.md) |

Abhängigkeiten zeigen nur nach innen: Oberfläche → Logik/Speicher/Dienst → Modell.

Mehr dazu: [Datenmodell](docs/DATENMODELL.md) · [Mac mini einrichten](docs/MAC-MINI.md) · [Mac-App](docs/MAC-APP.md) · [Weg nach Swift](docs/SWIFT.md)

## Ausprobieren

ES-Module brauchen einen Server, `file://` geht nicht.

```sh
npx serve .            # nur die App, ohne Abgleich
```

Mit Abgleich: PocketBase herunterladen (https://pocketbase.io, getestet mit 0.40.5) und im Repo starten:

```sh
./pocketbase serve --dir=server/pb_data --publicDir=. \
  --migrationsDir=server/pb_migrations --hooksDir=server/pb_hooks
```

Dann http://127.0.0.1:8090 öffnen, unter **Mehr** ein Konto anlegen und einen Haushalt gründen. Ein zweites Browserfenster (privat) spielt den Partner.

## Tests

```sh
npm test                                   # Modell und Logik, ohne Browser
PB_URL=http://127.0.0.1:8090 node --test tests/sync.integration.js   # Abgleich gegen einen frisch gestarteten PocketBase
```

## Service Worker

Neue oder umbenannte Dateien in `SHELL` in `sw.js` eintragen und `VERSION` bei jeder Änderung hochzählen, sonst laden installierte Apps die alten Dateien.
