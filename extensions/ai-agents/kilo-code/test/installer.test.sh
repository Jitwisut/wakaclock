#!/usr/bin/env bash
# Verify the Kilo installer owns only its top-level entrypoint and managed module
# directory, and leaves the user's JSON/JSONC configuration untouched.
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/atoaxis-kilo-installer.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

PLUGIN_ROOT="$TMP/config/kilo/plugin"
TARGET="$PLUGIN_ROOT/atoaxis-kilo-code"
ENTRY="$PLUGIN_ROOT/atoaxis-kilo-code.ts"
CONFIG="$TMP/config/kilo/kilo.jsonc"
mkdir -p "$(dirname "$CONFIG")"
printf '%s\n' '{' '  // user-owned JSONC comment' '  "plugins": ["user-plugin"]' '}' >"$CONFIG"
BEFORE="$(shasum -a 256 "$CONFIG")"

KILO_PLUGIN_DIR="$PLUGIN_ROOT" "$ROOT/installer/install.sh"
[ -f "$ENTRY" ]
[ -f "$TARGET/plugin.ts" ] || [ -f "$TARGET/src/plugin.ts" ] || {
  echo "Kilo plugin source was not installed" >&2
  exit 1
}
[ -f "$TARGET/tool-boundary-producer.py" ]
[ -f "$TARGET/activity-producer.py" ]
[ -f "$TARGET/context-producer.py" ]
# Installed entrypoint resolves only owned helpers, without a repository sibling.
! grep -q '../../common/tool-boundary-producer.py' "$TARGET/producer-client.ts"
printf '%s' '{"agent":"kilo-code","tool_event_id":"fixture-call","session_id":"fixture-session"}' \
  | ATOAXIS_PRODUCER_HOME="$TMP/producer-home" python3 "$TARGET/tool-boundary-producer.py" --phase abort --surface ide --cli "$TMP/missing-cli"
[ "$(find "$TMP/producer-home/.wakaclock/native-producer-spool/unconfirmed" -name '*.json' | wc -l | tr -d ' ')" = 2 ]
[ ! -d "$TARGET/__pycache__" ]

KILO_PLUGIN_DIR="$PLUGIN_ROOT" "$ROOT/installer/install.sh"
[ "$(shasum -a 256 "$CONFIG")" = "$BEFORE" ]

KILO_PLUGIN_DIR="$PLUGIN_ROOT" "$ROOT/installer/install.sh" --uninstall
[ ! -e "$TARGET" ]
[ ! -e "$ENTRY" ]

# An unrecognised path must not be removed by uninstall.
OTHER="$TMP/config/kilo/user-plugin/plugin"
mkdir -p "$OTHER"
touch "$OTHER/keep"
if KILO_PLUGIN_DIR="$OTHER" "$ROOT/installer/install.sh" --uninstall; then
  echo "unrecognised Kilo path unexpectedly succeeded" >&2
  exit 1
fi
[ -f "$OTHER/keep" ]
echo "kilo installer ok"
