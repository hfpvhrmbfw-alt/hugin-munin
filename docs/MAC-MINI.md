# Mac mini als Server einrichten

Ziel: PocketBase läuft dauerhaft auf dem Mac mini, liefert die App aus und gleicht ab. Von unterwegs erreicht ihr ihn über Tailscale unter einer HTTPS-Adresse wie `https://macmini.<name>.ts.net`.

## 1. Mac wach halten

Systemeinstellungen → Energie:
- „Automatischen Ruhezustand verhindern, wenn der Bildschirm aus ist“: an
- „Nach Stromausfall automatisch starten“: an

Der Bildschirm darf ausgehen, der Mac darf nicht in den Ruhezustand.

## 2. PocketBase und App installieren

```sh
mkdir -p ~/hugin-munin-server && cd ~/hugin-munin-server
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.40.5/pocketbase_0.40.5_darwin_arm64.zip
unzip pocketbase_0.40.5_darwin_arm64.zip pocketbase && rm pocketbase_0.40.5_darwin_arm64.zip
xattr -d com.apple.quarantine pocketbase 2>/dev/null || true   # macOS-Sperre für heruntergeladene Programme lösen

cd ~ && git clone https://github.com/<dein-konto>/hugin-munin.git
sh ~/hugin-munin/server/install.sh        # kopiert App, Migration und Hook nach ~/hugin-munin-server
```

Verwaltungskonto für die PocketBase-Oberfläche anlegen (eigene E-Mail und ein starkes Passwort):

```sh
cd ~/hugin-munin-server && ./pocketbase superuser upsert deine@mail.de 'STARKES-PASSWORT' --dir=pb_data
```

## 3. Automatisch starten

In `~/hugin-munin/server/de.huginmunin.pocketbase.plist` zweimal `BENUTZERNAME` durch deinen Mac-Benutzernamen ersetzen (steht im Terminal mit `whoami`), dann:

```sh
sudo cp ~/hugin-munin/server/de.huginmunin.pocketbase.plist /Library/LaunchDaemons/
sudo launchctl bootstrap system /Library/LaunchDaemons/de.huginmunin.pocketbase.plist
curl http://127.0.0.1:8090/api/health      # sollte "API is healthy" melden
```

PocketBase startet jetzt bei jedem Hochfahren, auch ohne Anmeldung am Mac, und nach einem Absturz neu. Protokoll: `/tmp/hugin-munin-pocketbase.log`.

## 4. Tailscale

1. Tailscale auf dem Mac installieren (tailscale.com/download oder App Store) und anmelden.
2. In der Tailscale-Verwaltung (login.tailscale.com) unter DNS „MagicDNS“ und „HTTPS Certificates“ einschalten.
3. Auf dem Mac:
   ```sh
   tailscale serve --bg 8090
   tailscale serve status        # zeigt die Adresse, z. B. https://macmini.<name>.ts.net
   ```
4. Tailscale-App auf deinem Handy installieren, mit demselben Konto anmelden.
5. Partner: in der Tailscale-Verwaltung einladen (Users → Invite) oder nur den Mac mini für ihn freigeben (Machines → Mac mini → Share). Er installiert die Tailscale-App ebenfalls.

Die genauen Menüs können sich bei Tailscale ändern; maßgeblich ist deren Dokumentation.

## 5. App auf den Handys

1. Adresse aus Schritt 4 in Safari öffnen.
2. Teilen → „Zum Home-Bildschirm“.
3. In der App unter **Mehr**: Server ist schon eingetragen. Neues Konto anlegen, Haushalt gründen.
4. Den Einladungscode an deinen Partner schicken. Er legt ebenfalls ein Konto an und tritt mit dem Code bei.

Danach in der PocketBase-Verwaltung (`https://macmini.<name>.ts.net/_/`) bei der Sammlung **users** die „Create rule“ auf „Superusers only“ stellen, damit niemand weiteres ein Konto anlegen kann.

## 6. Sicherung

- PocketBase-Verwaltung → Settings → Backups: automatische Sicherung einschalten (z. B. täglich um 3 Uhr, die letzten 7 behalten). Die Dateien liegen in `~/hugin-munin-server/pb_data/backups` und werden von Time Machine mitgesichert.
- Zusätzlich ab und zu in der App unter **Mehr → Sicherung speichern**.

## 7. Aktualisieren

```sh
cd ~/hugin-munin && git pull
sh server/install.sh
sudo launchctl kickstart -k system/de.huginmunin.pocketbase
```

Neue Migrationen laufen beim Neustart automatisch.
