# Hugin & Munin

Familienplaner für zwei, benannt nach Odins Raben „Gedanke“ und „Erinnerung“: Einkauf, Aufgaben, Kalender und mehr, gemeinsam mit dem Partner. Eine PWA ohne Build-Schritt und ohne Abhängigkeiten, Abgleich über einen eigenen PocketBase-Server (z. B. auf dem Mac mini zu Hause).

## Stand: Version 1

- **Heute:** Termine und fällige Aufgaben von heute, die Woche, Überfälliges, offener Einkauf.
- **Einkauf:** mehrere Listen, Schnelleingabe („2 Milch, Brot“), nach Bereich im Laden gruppiert, abhaken, Erledigtes aufräumen.
- **Aufgaben:** mehrere Listen, Fälligkeit, zuständige Person, „wichtig“, Notiz.
- **Kalender:** Termine mit Uhrzeit oder ganztägig, mehrtägig, Wiederholung (täglich, wöchentlich, monatlich, jährlich, mit Abstand und Ende), Personen.
- **Teilen:** Konto, Haushalt anlegen, Partner tritt mit Einladungscode bei, Änderungen erscheinen live beim anderen.
- **Offline:** alles wird zuerst auf dem Gerät gespeichert und später abgeglichen. Ohne Konto bleibt alles lokal.
- **Sicherung:** Export und Import als JSON.

## Version 2: Einrichtung, Speicherort, Module

- **Einrichtung beim ersten Start:** Speicherort wählen und Module ankreuzen. Beides lässt sich später unter **Mehr** ändern.
- **Speicherort:** nur auf dem Gerät, eigener Server über Tailscale, über WireGuard, im Heimnetz, mit eigener Domain oder gemieteter Server. Je nach Wahl erscheinen die passenden Felder (Gerätename und Tailnet, IP und Port, Adresse) und die Anmeldung. Tunnel und Schlüssel (Tailscale, WireGuard) verwaltet die jeweilige VPN-App, nicht Hugin & Munin. Eine http-Adresse (WireGuard, Heimnetz) geht nur, wenn die App selbst über http vom Server geöffnet wird, nicht über GitHub Pages.
- **Module** (an/aus, Ausgeschaltetes verschwindet überall, die Daten bleiben): Einkauf, Aufgaben, Kalender, Essensplan, Haushaltsplan im Wechsel, Ausgaben mit „wer schuldet wem“, Projekte, Notizen, Pinnwand, Kontakte & Geburtstage, Geschenkideen (auf Wunsch nur für dich sichtbar, auch auf dem Server), Listen-Vorlagen. Unten stehen Heute, die ersten drei Module und Mehr; weitere Module stehen unter Mehr → Bereiche.

## Version 3: Feinschliff, fremde Kalender, Erinnerungen

- **Rückgängig:** nach Abhaken, Löschen und „Erledigte entfernen“ erscheint unten kurz „rückgängig“. Dafür fragt die App beim Löschen einzelner Einträge nicht mehr nach.
- **Wischen:** in Einkauf und Aufgaben nach rechts abhaken, nach links löschen. Beim Abhaken blendet die Zeile ruhig aus, statt zu springen. Ein kurzes Vibrieren bestätigt (Android; iPhone ab iOS 18 über einen kurzen Klick).
- **Einkauf:** Einträge bearbeiten (Text, Menge, Bereich, Notiz), Vorschläge aus früheren Einkäufen beim Tippen, bekannte Sachen landen automatisch im zuletzt benutzten Bereich, Liste über das Teilen-Menü verschicken.
- **Personen:** jede Person hat eine Farbe und ihren Anfangsbuchstaben, z. B. bei zuständig, wer etwas auf den Einkaufszettel gesetzt hat, bei Terminen und im Haushaltsplan.
- **Suche** (Lupe oben) über Listen, Termine, Notizen, Kontakte, Geschenke, Essen, Ausgaben und Haushaltsplan.
- **Leere Seiten** mit Raben-Zeichnungen von Anna.
- **Fremde Kalender (ICS)** unter Kalender → „fremde kalender“: z. B. Schulferien, Müllabfuhr, Arbeitskalender. Der eigene Server lädt sie (der Browser darf das meist nicht), die App rechnet Zeitzonen, Serien, Ausfälle und einzeln verschobene Termine um. Nur zum Ansehen.
- **Erinnerungen (Push):** morgens um 7:30 ein Überblick (Termine, fällige und überfällige Aufgaben, Geburtstage), 30 Minuten vor Terminen eine Erinnerung. Verschickt werden sie von der [Mac-App](docs/MAC-APP.md); ein einfacher PocketBase-Server kann das nicht. Auf dem iPhone nur, wenn die App auf dem Home-Bildschirm liegt (ab iOS 16.4).
- **Sicherung:** der Server sichert jede Nacht um 3 Uhr selbst und behält die letzten 14 (`pb_data/backups`). Unter **Mehr** steht, wann auf diesem Gerät zuletzt gesichert wurde.
- Oberflächenwörter durchgehend klein (Castra · Blei).

## Aufbau

| Datei | Schicht | Aufgabe |
|---|---|---|
| `src/model.js` | Modell | Typen, Stammdaten-IDs, Prüfung (`sanitize…`), Export/Import, Migration |
| `src/logic.js` | Logik | reine Funktionen: Wiederholungen, Tagesplan, Sortierung, Zusammenführen beim Abgleich, Serveradresse, Haushaltsplan, Salden, Geburtstage, Vorlagen |
| `src/storage.js` | Speicher | IndexedDB, Ersatz localStorage |
| `src/sync.js` | Dienst | PocketBase: Anmeldung, Haushalt, Hoch- und Herunterladen, Live-Updates |
| `src/texts.js` | Texte | Beschriftungen und Meldungen |
| `src/ui.js`, `src/main.js` | Oberfläche | Rendering, Aktionen, Start; einzige Stelle mit Uhr und Zufall |
| `server/` | Server | PocketBase-Migration (Sammlungen, Regeln), Hook für Beitritt und Mitglieder, Startdatei für macOS |
| `mac/` | Mac-App | Server mit eingebautem Tailscale und Push-Erinnerungen (Go) und Menüleisten-App (SwiftUI), siehe [Mac-App](docs/MAC-APP.md) |

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
(cd mac/server && go test ./...)          # Planung der Erinnerungen
```

## Service Worker

Neue oder umbenannte Dateien in `SHELL` in `sw.js` eintragen und `VERSION` bei jeder Änderung hochzählen, sonst laden installierte Apps die alten Dateien.
