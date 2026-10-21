# Mac-App „Hugin & Munin“

Die Mac-App ersetzt die Terminal-Schritte aus [MAC-MINI.md](MAC-MINI.md). Sie sitzt als Rabe in der Menüleiste, bringt den Server mit und hat Tailscale eingebaut. Auf dem Mac braucht es keine Tailscale-App mehr.

## Was drin ist

| Teil | Ordner | Aufgabe |
|---|---|---|
| Server `hm-server` | `mac/server/` (Go) | PocketBase mit `server/pb_migrations`, `server/pb_hooks` und der PWA, dazu Tailscale über `tsnet`. Der Server ist selbst ein Gerät im Tailnet und hat eine eigene HTTPS-Adresse. |
| Oberfläche | `mac/app/` (SwiftUI) | Startet den Server, startet ihn nach einem Absturz neu, hält den Mac wach, zeigt Zustand, Adresse als QR-Code, letzte Sicherung. |
| Bauen | `mac/build-app.sh` | Baut `Hugin & Munin.app` und ein ZIP nach `mac/dist/`. GitHub baut es bei jeder Änderung (Actions → „Mac-App“ → Artefakt `HuginMunin-mac`). |

Server und Abgleich sind dieselben wie bisher. Die PWA merkt keinen Unterschied.

## Einrichten

1. ZIP aus GitHub laden (Actions → letzter Lauf von „Mac-App“ → `HuginMunin-mac`), entpacken, App in **Programme** ziehen.
2. Die App ist nicht von Apple beglaubigt. Beim ersten Start: Rechtsklick → **Öffnen** → **Öffnen**. Geht das nicht: `xattr -dr com.apple.quarantine "/Applications/Hugin & Munin.app"`.
3. Beim ersten Start öffnet sich der Browser zum Anlegen des Verwaltungskontos (PocketBase).
4. Im Rabenmenü **bei tailscale anmelden** und mit eurem Tailscale-Konto bestätigen. Das Gerät heißt `hugin-munin`.
5. In der Tailscale-Verwaltung (login.tailscale.com) unter DNS „MagicDNS“ und „HTTPS Certificates“ einschalten, falls noch nicht geschehen. Die App zeigt danach die Adresse, z. B. `https://hugin-munin.<name>.ts.net`, und einen QR-Code.
6. Im Menü **beim anmelden starten** einschalten. Auf dem Mac mini zusätzlich in den Systemeinstellungen die automatische Anmeldung einschalten, denn die App läuft nur, solange ein Benutzer angemeldet ist.
7. Handys: Tailscale-App installieren, QR-Code scannen, in Safari „Zum Home-Bildschirm“.

Den Ruhezustand verhindert die App selbst, solange sie läuft. „Nach Stromausfall automatisch starten“ (Systemeinstellungen → Energie) bleibt sinnvoll.

## Umzug von der Terminal-Einrichtung

Gibt es `~/hugin-munin-server/pb_data`, nimmt die App genau diese Daten. Sonst legt sie neue unter `~/Library/Application Support/Hugin & Munin/` an.

Vorher den alten Dienst und die alte Weiterleitung abschalten, sonst ist Port 8090 belegt:

```sh
sudo launchctl bootout system/de.huginmunin.pocketbase
sudo rm /Library/LaunchDaemons/de.huginmunin.pocketbase.plist
tailscale serve reset
```

Die Adresse ändert sich auf den neuen Gerätenamen. In der App auf den Handys unter **Mehr** die neue Serveradresse eintragen und neu anmelden. Die Daten bleiben.

## Ordner

- Daten: `~/hugin-munin-server/pb_data` oder `~/Library/Application Support/Hugin & Munin/pb_data`
- Sicherungen: `<Daten>/backups` (Time Machine sichert mit)
- Tailscale-Zustand: `~/Library/Application Support/Hugin & Munin/tailscale`
- Protokoll: `~/Library/Logs/Hugin & Munin/server.log`

## Selbst bauen

Auf einem Mac mit Xcode-Kommandozeilenwerkzeugen und Go:

```sh
sh mac/build-app.sh
```

Den Server allein (auch unter Linux) testen:

```sh
cd mac/server && go build -o hm-server . && cd ../..
mac/server/hm-server serve --dir=/tmp/hm/pb_data --hooksDir=server/pb_hooks \
  --migrationsDir=server/pb_migrations --publicDir=.            # ohne Tailscale
PB_URL=http://127.0.0.1:8090 node --test tests/sync.integration.js
```

Mit `--tsHostname=<name>` kommt Tailscale dazu. `GET /api/hm/server-status` liefert den Zustand (nur von 127.0.0.1).
