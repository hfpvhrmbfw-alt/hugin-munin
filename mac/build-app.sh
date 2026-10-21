#!/bin/sh
# Baut „Hugin & Munin.app“ (Apple Silicon) nach mac/dist/. Läuft auf macOS mit Xcode-Kommandozeilenwerkzeugen und Go.
# Aufruf aus dem Repo: sh mac/build-app.sh   (Version mit VERSION=…)
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-0.1.0}"
DIST="$REPO/mac/dist"
APP="$DIST/Hugin & Munin.app"
RES="$APP/Contents/Resources"

rm -rf "$DIST" && mkdir -p "$APP/Contents/MacOS" "$RES/server/pb_public"

# Oberfläche (SwiftUI)
(cd "$REPO/mac/app" && swift build -c release --arch arm64)
cp "$REPO/mac/app/.build/arm64-apple-macosx/release/HuginMunin" "$APP/Contents/MacOS/HuginMunin"

# Server (PocketBase + Tailscale)
(cd "$REPO/mac/server" && CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 \
  go build -trimpath -ldflags "-s -w -X main.Version=$VERSION" -o "$RES/server/hm-server" .)

# App, Migrationen, Hooks – dieselben Dateien wie server/install.sh
cp -R "$REPO/index.html" "$REPO/styles.css" "$REPO/sw.js" "$REPO/manifest.webmanifest" "$REPO/src" "$REPO/icons" "$RES/server/pb_public/"
cp -R "$REPO/server/pb_migrations" "$REPO/server/pb_hooks" "$RES/server/"

sed "s/__VERSION__/$VERSION/g" "$REPO/mac/app/Info.plist" > "$APP/Contents/Info.plist"

# Symbol aus dem Raben-Icon
ICONSET="$DIST/AppIcon.iconset" && mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$REPO/icons/icon-512.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); [ $d -le 512 ] && sips -z $d $d "$REPO/icons/icon-512.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$RES/AppIcon.icns" && rm -rf "$ICONSET"

# Ad-hoc signieren (ohne Apple-Entwicklerkonto). Innen nach außen.
codesign --force --sign - "$RES/server/hm-server"
codesign --force --sign - "$APP"

(cd "$DIST" && ditto -c -k --keepParent "Hugin & Munin.app" "HuginMunin-$VERSION.zip")
echo "Fertig: $APP"
