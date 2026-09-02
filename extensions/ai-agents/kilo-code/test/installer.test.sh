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
KILO_PLUGIN_DIR="$PLUGIN_ROOT" "$ROOT/installer/install.sh"
[ "$(shasum -a 256 "$CONFIG")" = "$BEFORE" ]

KILO_PLUGIN_DIR="$PLUGIN_ROOT" "$ROOT/installer/install.sh" --uninstall
[ ! -e "$TARGET" ]
[ ! -e "$ENTRY" ]

# An unrecognised path must not be removed by uninstall.
OTHER="$TMP/config/kilo/user-plugin/plugin"
mkdir -p "$OTHER"
touch "$OTHER/keep"
KILO_PLUGIN_DIR="$OTHER" "$ROOT/installer/install.sh" --uninstall
[ -f "$OTHER/keep" ]
echo "kilo installer ok"
