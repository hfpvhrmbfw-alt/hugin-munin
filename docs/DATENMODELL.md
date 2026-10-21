# Datenmodell (Schema-Version 2)

Alle Einträge gehören zu einem **Haushalt**. IDs haben das PocketBase-Format (15 Zeichen `a-z0-9`) und werden auf dem Gerät erzeugt, damit ein offline angelegter Eintrag auf dem Server dieselbe ID behält.

## Gemeinsame Felder (Listen, Einträge, Termine)

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | string | 15 Zeichen |
| `household` | string | ID des Haushalts |
| `changedAt` | int | Zeitpunkt der letzten Änderung (ms seit 1970), steigt bei jeder Änderung mindestens um 1 |
| `changedBy` | string \| null | Benutzer-ID der letzten Änderung |
| `deleted` | bool | gelöscht (Markierung, damit das andere Gerät davon erfährt) |

## Sammlungen

**lists**: `kind` (`shopping` \| `tasks` \| `project` \| `template`), `name`, `color` (`orange`, `ink`, `olive`, `sky`, `plum`, `sand`), `sort`, `archived`

**items** (Einkauf und Aufgaben): `list`, `title`, `note`, `quantity` (Freitext, z. B. „500g“), `category` (nur Einkauf: `produce`, `bakery`, `dairy`, `meat`, `frozen`, `pantry`, `drinks`, `household`, `care`, `other`), `done`, `dueDate` (`YYYY-MM-DD`), `assignee`, `important`, `sort`

**events**: `title`, `notes`, `startDate`, `endDate` (`YYYY-MM-DD`), `startTime`, `endTime` (`HH:MM` oder null = ganztägig), `repeat` (`none`, `daily`, `weekly`, `monthly`, `yearly`), `repeatInterval` (1–99), `repeatUntil`, `people` (Benutzer-IDs)

**notes**: `title`, `body`, `pinned` (angeheftet = Pinnwand auf „Heute“)

**expenses**: `kind` (`expense` = Ausgabe, `settle` = Ausgleichszahlung), `title`, `amount` (Cent, ganze Zahl), `date`, `paidBy`, `people` (bei Ausgabe: für wen, leer = alle; bei Ausgleich: genau die Empfängerin)

**meals**: `date`, `slot` (`breakfast`, `lunch`, `dinner`), `title`, `note`

**chores** (Haushaltsplan): `title`, `people` (Reihenfolge = wer nacheinander dran ist), `unit` (`daily`, `weekly`, `monthly`), `interval` (1–99), `startDate`, `lastDone`, `doneBy`. Wer dran ist, rechnet `choreState` aus: Abschnitt k ab `startDate`, dran ist `people[k mod n]`.

**contacts**: `name`, `birthday` (`MM-DD`), `birthYear` (optional), `phone`, `email`, `address`, `note`

**gifts**: `forName`, `contact` (optional), `title`, `note`, `link`, `status` (`idea`, `bought`, `given`), `private`, `owner`. Private Ideen sieht und ändert auf dem Server nur `owner`.

**households** (nur Server): `name`, `members` (Benutzer-IDs), `inviteCode`

Wiederholungen werden nicht als einzelne Termine gespeichert, sondern beim Anzeigen ausgerechnet (`occurrences` in `logic.js`). Monatlich am 31. und jährlich am 29.02. überspringen Monate bzw. Jahre ohne diesen Tag.

## Regeln für Stammdaten

IDs nie umbenennen, nur ergänzen. Beschriftungen stehen in `src/texts.js`. Neue Auswahlwerte müssen auch in der PocketBase-Migration ergänzt werden (neue Migrationsdatei).

## Abgleich

1. Jede Änderung wird lokal gespeichert und im Ausgang (`meta.outbox`) vorgemerkt.
2. Hochladen: `PATCH`, bei unbekanntem Eintrag `POST` mit derselben ID.
3. Der Server nimmt eine Änderung nur an, wenn ihr `changedAt` nicht älter ist als der gespeicherte (Regel in der Migration). So gewinnt auch auf dem Server die neuere Änderung.
4. Herunterladen: alles mit `updated >= letzter Merker`, zusammenführen mit `mergeRemote` (neuere Änderung gewinnt, bei Gleichstand die größere `changedBy`).
5. Live-Updates (PocketBase-Realtime) lösen einen Abgleich aus; zusätzlich beim Start, beim Zurückkehren in die App, nach jeder Änderung und jede Minute.

## Sicherung (Export)

```json
{ "app": "hugin-munin", "version": 1, "exportedAt": "…", "settings": { "theme": "system", "serverUrl": "…" },
  "lists": [ … ], "items": [ … ], "events": [ … ] }
```

Beim Import werden neuere Versionen abgelehnt, ältere über `upgradeRaw` angehoben und jeder Eintrag geprüft.

## Einstellungen (nur auf dem Gerät)

`theme`, `serverUrl`, `storage` (`local`, `tailscale`, `wireguard`, `lan`, `domain`, `hosted`), `modules` (eingeschaltete Module aus `MODULES`). Version 1 kannte `storage` und `modules` noch nicht: `storage` wird aus der Adresse abgeleitet, `modules` sind dann Einkauf, Aufgaben, Kalender.

## Version 1 → 2

Sicherungen der Version 1 werden beim Import hochgehoben (neue Sammlungen leer). IndexedDB bekommt in Version 2 die neuen Speicher dazu. Auf dem Server legt `server/pb_migrations/1761000000_modules.js` die neuen Sammlungen an. Ein noch nicht aktualisierter Server stört den Abgleich nicht: fehlende Sammlungen werden übersprungen und später nachgeholt.
