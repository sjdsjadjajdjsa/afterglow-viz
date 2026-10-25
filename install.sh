#!/bin/sh
# installs or updates afterglow-viz for spicetify
#   curl -fsSL https://raw.githubusercontent.com/sjdsjadjajdjsa/afterglow-viz/main/install.sh | sh
set -e
APP=afterglow-viz
URL=https://github.com/sjdsjadjajdjsa/afterglow-viz/releases/latest/download/afterglow-viz.zip

SPICETIFY=$(command -v spicetify || true)
if [ -z "$SPICETIFY" ] && [ -x "$HOME/.spicetify/spicetify" ]; then SPICETIFY="$HOME/.spicetify/spicetify"; fi
if [ -z "$SPICETIFY" ]; then
  echo "Spicetify isn't installed yet. Get it from https://spicetify.app, then run this again."
  exit 1
fi
if ! command -v unzip >/dev/null 2>&1; then
  echo "This needs unzip. Install it (for example: sudo apt install unzip), then run this again."
  exit 1
fi

# CustomApps sits next to spicetify's config file
CONFIG=$("$SPICETIFY" -c 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | tail -n 1)
if [ -n "$CONFIG" ] && [ -f "$CONFIG" ]; then
  DIR="$(dirname "$CONFIG")/CustomApps"
else
  DIR="$HOME/.config/spicetify/CustomApps"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Downloading afterglow-viz..."
curl -fsSL "$URL" -o "$TMP/app.zip"
mkdir -p "$DIR"
rm -rf "$DIR/$APP"
unzip -q "$TMP/app.zip" -d "$DIR"
echo "Installed to $DIR/$APP"

if ! "$SPICETIFY" config custom_apps 2>/dev/null | tr ' |' '\n\n' | grep -qx "$APP"; then
  "$SPICETIFY" config custom_apps "$APP"
fi
"$SPICETIFY" apply
echo "Done. Open afterglow-viz from Spotify's sidebar."
