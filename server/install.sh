#!/bin/sh
# Kopiert App, Migrationen und Hooks in den Server-Ordner auf dem Mac mini.
# Aufruf aus dem Repo: sh server/install.sh  (Ziel: ~/hugin-munin-server, änderbar mit ZIEL=…)
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ZIEL="${ZIEL:-$HOME/hugin-munin-server}"
mkdir -p "$ZIEL/pb_public" "$ZIEL/pb_migrations" "$ZIEL/pb_hooks"
cp -R "$REPO/index.html" "$REPO/styles.css" "$REPO/sw.js" "$REPO/manifest.webmanifest" "$REPO/src" "$REPO/icons" "$REPO/fonts" "$ZIEL/pb_public/"
cp "$REPO"/server/pb_migrations/*.js "$ZIEL/pb_migrations/"
cp "$REPO"/server/pb_hooks/*.js "$ZIEL/pb_hooks/"
echo "Kopiert nach $ZIEL. PocketBase neu starten, damit Migrationen und Hooks greifen:"
echo "  sudo launchctl kickstart -k system/de.huginmunin.pocketbase"
