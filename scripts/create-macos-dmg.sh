#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 /path/to/ProtoDocs.app /path/to/output.dmg" >&2
  exit 2
fi

APP_PATH="$1"
OUTPUT_DMG="$2"
APP_NAME="$(basename "$APP_PATH")"
VOLUME_NAME="${APP_NAME%.app}"
WORK_DIR="$(mktemp -d)"
STAGING_DIR="$WORK_DIR/$VOLUME_NAME"
RW_DMG="$WORK_DIR/$VOLUME_NAME.rw.dmg"
MOUNT_DIR="$WORK_DIR/mount"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [[ ! -d "$APP_PATH" ]]; then
  echo "app bundle not found: $APP_PATH" >&2
  exit 1
fi

mkdir -p "$STAGING_DIR"
cp -R "$APP_PATH" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

hdiutil create \
  -volname "$VOLUME_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDRW \
  "$RW_DMG" >/dev/null

mkdir -p "$MOUNT_DIR"
hdiutil attach "$RW_DMG" -readwrite -noverify -noautoopen -mountpoint "$MOUNT_DIR" >/dev/null

detach() {
  hdiutil detach "$MOUNT_DIR" -quiet || true
}
trap 'detach; cleanup' EXIT

osascript <<APPLESCRIPT
tell application "Finder"
  tell folder POSIX file "$MOUNT_DIR"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {100, 100, 620, 420}
    set theViewOptions to the icon view options of container window
    set arrangement of theViewOptions to not arranged
    set icon size of theViewOptions to 96
    set position of item "$APP_NAME" of container window to {165, 155}
    set position of item "Applications" of container window to {375, 155}
    close
  end tell
end tell
APPLESCRIPT

sync
detach
trap cleanup EXIT

mkdir -p "$(dirname "$OUTPUT_DMG")"
rm -f "$OUTPUT_DMG"
hdiutil convert "$RW_DMG" -ov -format UDZO -imagekey zlib-level=9 -o "$OUTPUT_DMG" >/dev/null
