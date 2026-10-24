# Mac-App „Hugin & Munin“

Die Mac-App macht den Mac mini zum Server für Hugin & Munin. Sie sitzt als Rabe in der Menüleiste, bringt den Server mit und hat Tailscale eingebaut. Auf dem Mac braucht es keine Tailscale-App mehr.

## Was drin ist

| Teil | Ordner | Aufgabe |
|---|---|---|
| Server `hm-server` | `mac/server/` (Go) | PocketBase mit `server/pb_migrations`, `server/pb_hooks` und der PWA, dazu Tailscale über `tsnet`. Der Server ist selbst ein Gerät im Tailnet und hat eine eigene HTTPS-Adresse. Er verschickt auch die Erinnerungen (siehe unten). |
| Oberfläche | `mac/app/` (SwiftUI) | Startet den Server, startet ihn nach einem Absturz neu, hält den Mac wach, zeigt Zustand, Adresse als QR-Code, letzte Sicherung. |
| Bauen | `mac/build-app.sh` | Baut `Hugin & Munin.app` und ein ZIP nach `mac/dist/`. GitHub baut es bei jeder Änderung (Actions → „Mac-App“ → Artefakt `HuginMunin-mac`). |

## Einrichten

1. ZIP aus GitHub laden (Actions → letzter Lauf von „Mac-App“ → `HuginMunin-mac`), entpacken, App in **Programme** ziehen.
2. Die App ist nicht von Apple beglaubigt. Beim ersten Start: Rechtsklick → **Öffnen** → **Öffnen**. Geht das nicht: `xattr -dr com.apple.quarantine "/Applications/Hugin & Munin.app"`.
3. Beim ersten Start öffnet sich der Browser zum Anlegen des Verwaltungskontos (PocketBase).
4. Im Rabenmenü **bei tailscale anmelden** und mit eurem Tailscale-Konto bestätigen. Das Gerät heißt `hugin-munin`.
5. In der Tailscale-Verwaltung (login.tailscale.com) unter DNS „MagicDNS“ und „HTTPS Certificates“ einschalten, falls noch nicht geschehen. Die App zeigt danach die Adresse, z. B. `https://hugin-munin.<name>.ts.net`, und einen QR-Code.
6. Im Menü **beim anmelden starten** einschalten. Auf dem Mac mini zusätzlich in den Systemeinstellungen die automatische Anmeldung einschalten, denn die App läuft nur, solange ein Benutzer angemeldet ist.
7. Handys: Tailscale-App installieren, QR-Code scannen, in Safari „Zum Home-Bildschirm“.

Den Ruhezustand verhindert die App selbst, solange sie läuft. „Nach Stromausfall automatisch starten“ (Systemeinstellungen → Energie) bleibt sinnvoll.

## Handys und Partner

1. Auf dem Handy die Tailscale-App installieren und mit demselben Konto anmelden.
2. Adresse aus der Mac-App (oder QR-Code) in Safari öffnen, dann Teilen → „Zum Home-Bildschirm“.
3. Bei der Einrichtung „mac mini über tailscale“ wählen, Module ankreuzen, Konto anlegen, danach unter **Mehr** den Haushalt gründen.
4. Partner: in der Tailscale-Verwaltung einladen (Users → Invite) oder nur das Gerät `hugin-munin` freigeben (Machines → Share). Er installiert die Tailscale-App, legt in Hugin & Munin ein Konto an und tritt mit dem Einladungscode bei.

Danach in der PocketBase-Verwaltung (`https://hugin-munin.<name>.ts.net/_/`) bei der Sammlung **users** die „Create rule“ auf „Superusers only“ stellen, damit niemand weiteres ein Konto anlegen kann.

Die genauen Menüs können sich bei Tailscale ändern; maßgeblich ist deren Dokumentation.

## Erinnerungen (Push)

Der Server prüft alle 5 Minuten, was fällig ist, und schickt es an die Geräte, auf denen unter **Mehr → erinnerungen** „Einschalten“ gedrückt wurde:

- ab 7:30 einmal am Tag ein Überblick je Person: Termine, für die sie eingetragen ist (oder ohne Personen), fällige und überfällige Aufgaben (ihr zugewiesen oder niemandem), Geburtstage. War der Mac bis 11 Uhr aus, entfällt der Überblick an diesem Tag.
- 30 Minuten vor Terminen mit Uhrzeit.

Jede Erinnerung geht nur einmal raus (`push_sent`). Die Schlüssel (VAPID) liegen in `<Daten>/vapid.json` und bleiben dort; neue Schlüssel würden alle Geräte abmelden. Abgemeldete Geräte (Antwort 404/410) entfernt der Server selbst. Zeitzone ist die des Mac.

Auf dem iPhone kommen Mitteilungen nur, wenn die App vom Home-Bildschirm geöffnet und dort eingeschaltet wurde (iOS 16.4 oder neuer). Mit **Test senden** lässt sich das prüfen.

## Sicherung

Jede Nacht um 3 Uhr legt der Server eine Sicherung an und behält die letzten 14 (Einstellung aus der Migration, in der PocketBase-Verwaltung unter Settings → Backups änderbar). Zusätzlich ab und zu in der App unter **Mehr → Sicherung speichern**.

## Ordner

- Daten: `~/Library/Application Support/Hugin & Munin/pb_data`
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
