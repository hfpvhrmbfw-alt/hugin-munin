# Weg nach Swift

| Datei | Schicht | In Swift |
|---|---|---|
| `src/model.js` | Modell | 1:1 übertragen: `struct`s, `enum`s mit denselben IDs, `sanitize` als `init(raw:)` |
| `src/logic.js` | Logik | 1:1 übertragen, gleiche Funktionsnamen |
| `tests/fixtures/*.json` | Testfälle | unverändert in XCTest wiederverwenden |
| `src/texts.js` | Texte | String Catalog |
| `src/storage.js` | Speicher | neu: SwiftData oder SQLite |
| `src/sync.js` | Dienst | neu: URLSession gegen denselben PocketBase-Server, gleiche Regeln |
| `src/ui.js`, `src/main.js` | Oberfläche | neu: SwiftUI |
| `server/` | Server | bleibt unverändert |

## Datentypen (Skizze)

```swift
enum ListKind: String, Codable { case shopping, tasks }
enum Repeat: String, Codable { case none, daily, weekly, monthly, yearly }

struct Item: Codable, Identifiable {
  let id: String; var household: String; var changedAt: Int64; var changedBy: String?; var deleted: Bool
  var list: String; var title: String; var note: String?; var quantity: String?; var category: String?
  var done: Bool; var dueDate: String?; var assignee: String?; var important: Bool; var sort: Double
}

struct CalEvent: Codable, Identifiable {
  let id: String; var household: String; var changedAt: Int64; var changedBy: String?; var deleted: Bool
  var title: String; var notes: String?; var startDate: String; var endDate: String
  var startTime: String?; var endTime: String?; var repeat: Repeat; var repeatInterval: Int
  var repeatUntil: String?; var people: [String]
}
```

## Datumsregel

Datum immer als `YYYY-MM-DD`, gerechnet in ganzen Tagen (UTC, ohne lokale Zeit). „Heute“ liest nur die Oberfläche aus der Uhr und übergibt es der Logik.

## Austauschformat

Das JSON der Sicherung (siehe `docs/DATENMODELL.md`) ist in PWA und Swift-App dasselbe.
