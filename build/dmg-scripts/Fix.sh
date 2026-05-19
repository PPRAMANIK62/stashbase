#!/bin/zsh
set -euo pipefail

APP_NAME="StashBase.app"
SOURCE_APP="${0:A:h}/${APP_NAME}"
TARGET_APP="/Applications/${APP_NAME}"

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "Cannot find ${APP_NAME} next to this installer script."
  echo "Run this script from the mounted StashBase DMG."
  read -r "?Press Enter to close..."
  exit 1
fi

HELPER="$(/usr/bin/mktemp -t stashbase-install)"
/bin/cat > "$HELPER" <<'EOS'
#!/bin/zsh
set -euo pipefail

SOURCE_APP="$1"
TARGET_APP="$2"

if [[ -d "$TARGET_APP" ]]; then
  /bin/rm -rf "$TARGET_APP"
fi

/usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"
/usr/bin/xattr -cr "$TARGET_APP" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - "$TARGET_APP" 2>/dev/null || true
EOS

/bin/chmod +x "$HELPER"

/usr/bin/osascript - "$HELPER" "$SOURCE_APP" "$TARGET_APP" <<'OSA'
on run argv
  set helperPath to item 1 of argv
  set sourcePath to item 2 of argv
  set targetPath to item 3 of argv
  do shell script quoted form of helperPath & " " & quoted form of sourcePath & " " & quoted form of targetPath with administrator privileges
end run
OSA

/bin/rm -f "$HELPER"
/usr/bin/open "$TARGET_APP"
