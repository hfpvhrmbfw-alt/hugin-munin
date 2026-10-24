# Mac-App „Hugin & Munin“

Die Mac-App macht den Mac mini zum Server für Hugin & Munin. Sie sitzt als Rabe in der Menüleiste, bringt den Server mit und hat Tailscale eingebaut. Auf dem Mac braucht es keine Tailscale-App mehr.

## Erster Test: Schritt für Schritt

Dauert etwa eine halbe Stunde. Du brauchst den Mac mini, dein iPhone und einen GitHub-Zugang (bist du ja schon).

### 1. Tailscale-Konto anlegen (falls noch keins da ist)

Tailscale ist ein privates Netz nur für eure Geräte. Darüber erreicht das iPhone den Mac mini, auch unterwegs.

1. Auf [tailscale.com](https://tailscale.com) **Get started** wählen und mit Apple- oder Google-Konto anmelden. Für euch beide ist es kostenlos.
2. In der Tailscale-Verwaltung ([login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns)) prüfen, dass **MagicDNS** an ist, und weiter unten bei **HTTPS Certificates** auf **Enable** tippen.

### 2. Mac-App herunterladen

1. Auf dem Mac mini in Safari öffnen: [github.com/hfpvhrmbfw-alt/hugin-munin/actions/workflows/mac-app.yml](https://github.com/hfpvhrmbfw-alt/hugin-munin/actions/workflows/mac-app.yml)
2. Den obersten Lauf mit grünem Haken anklicken.
3. Ganz unten bei **Artifacts** auf **HuginMunin-mac** klicken. Es lädt eine ZIP-Datei in „Downloads“.
4. Die ZIP doppelklicken. Darin ist noch eine ZIP, auch die doppelklicken. Heraus kommt **Hugin & Munin.app**.
5. Die App in den Ordner **Programme** ziehen.

### 3. App zum ersten Mal öffnen

Die App ist nicht bei Apple eingereicht, darum warnt der Mac beim ersten Mal.

1. **Hugin & Munin** in „Programme“ doppelklicken. Es kommt eine Warnung: auf **Fertig** (oder **Abbrechen**) klicken.
2. **Systemeinstellungen → Datenschutz & Sicherheit** öffnen, ganz nach unten scrollen. Dort steht „Hugin & Munin wurde blockiert“: auf **Dennoch öffnen** klicken, mit Passwort bestätigen, nochmal **Öffnen**.
3. Oben rechts in der Menüleiste sitzt jetzt ein Rabe. Ein Klick darauf öffnet das Rabenmenü. Dort sollte „server läuft“ stehen.
4. Gleichzeitig öffnet sich der Browser mit „Create superuser“. Das ist das Verwaltungskonto für den Server: E-Mail und ein gutes Passwort eintragen, gut aufheben (z. B. im Passwort-Manager). Öffnet sich nichts: im Rabenmenü auf **protokoll** klicken und den Link mit `/_/#/pbinstal/` herauskopieren.

Klappt Schritt 2 nicht, im Terminal einmal das hier eingeben, dann die App normal öffnen:
`xattr -dr com.apple.quarantine "/Applications/Hugin & Munin.app"`

### 4. Mac mini mit Tailscale verbinden

1. Im Rabenmenü auf **bei tailscale anmelden** klicken. Der Browser öffnet Tailscale: mit demselben Konto wie in Schritt 1 anmelden und **Connect** bestätigen.
2. Nach ein paar Sekunden steht im Rabenmenü „tailscale verbunden“, darunter die **adresse für die handys**, etwa `https://hugin-munin.tail1234.ts.net`, und ein QR-Code.
3. Steht dort „verbunden, https fehlt“: Schritt 1.2 nachholen (Knopf **dns-einstellungen öffnen**), dann ein, zwei Minuten warten.
4. Im Rabenmenü **beim anmelden starten** einschalten.
5. Die Adresse funktioniert nur auf Geräten mit Tailscale-App. Am Mac mini selbst zeigt **im browser öffnen** darum „Server nicht gefunden“, solange dort keine Tailscale-App läuft. Das ist normal.

### 5. iPhone verbinden

1. Auf dem iPhone die App **Tailscale** aus dem App Store laden, mit demselben Konto anmelden und das VPN erlauben. Der Schalter in der Tailscale-App muss an sein.
2. Deine bisherige Hugin-&-Munin-App vom Home-Bildschirm öffnen. So kommen deine bisherigen Einträge mit.
3. Unter **mehr → speicherort und teilen** „unser mac mini zu hause“ wählen.
4. **gerätename**: `hugin-munin`. **tailnet**: der Teil hinter `hugin-munin.` aus der Adresse im Rabenmenü, z. B. `tail1234.ts.net`.
5. E-Mail, Passwort (mindestens 8 Zeichen) und deinen Namen eintragen, dann **Neues Konto**. Das ist dein normales Konto für die App, nicht das Verwaltungskonto aus Schritt 3.
6. Danach an derselben Stelle einen Haushalt anlegen („Zuhause“ → **Haushalt anlegen**). Jetzt wandern deine Einträge auf den Mac mini.

Zeigt Safari „Server nicht gefunden“: In der Tailscale-App muss „Connected“ stehen, das Gerät **hugin-munin** in der Liste auftauchen (sonst ist das iPhone mit einem anderen Konto angemeldet) und **Use Tailscale DNS** an sein. Beim allerersten Aufruf kann es bis zu einer Minute dauern.

Vorher sicherheitshalber unter **mehr → sicherung** einmal **Sicherung speichern**.

### 6. Erster Test

1. Auf dem iPhone einen Einkaufseintrag anlegen, z. B. „Test-Milch“.
2. Auf einem zweiten Gerät mit Tailscale-App (iPad, Handy des Partners) die Adresse aus dem Rabenmenü öffnen und mit demselben Konto anmelden. Der Eintrag ist da.
3. Dort etwas abhaken, auf dem iPhone kurz die App schließen und wieder öffnen: der Haken ist auch dort.
4. Unterwegs testen: am iPhone WLAN aus, Tailscale an. Die App sollte trotzdem abgleichen.
5. Optional: unter **mehr → erinnerungen** einschalten und **Test senden**.

Klappt etwas nicht: Foto oder Bildschirmfoto vom Rabenmenü und von der Fehlermeldung in der App schicken. Die Datei hinter **protokoll** hilft auch.

### Danach

- Mac mini: in den Systemeinstellungen **Allgemein → Anmeldeobjekte** sollte Hugin & Munin stehen. Für Stromausfälle unter **Energie** „Nach Stromausfall automatisch starten“ einschalten und unter **Benutzer & Gruppen** die automatische Anmeldung.
- Partner: siehe [Handys und Partner](#handys-und-partner).
- Wenn eure Konten angelegt sind: Registrierung sperren (siehe unten).

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
