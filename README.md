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

Noch offen: fremde Kalender (ICS) einblenden, Push-Erinnerungen.

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

Abhängigkeiten zeigen nur nach innen: Oberfläche → Logik/Speicher/Dienst → Modell.

Mehr dazu: [Datenmodell](docs/DATENMODELL.md) · [Mac mini einrichten](docs/MAC-MINI.md) · [Weg nach Swift](docs/SWIFT.md)

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
