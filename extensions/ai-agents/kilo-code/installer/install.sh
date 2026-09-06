#!/usr/bin/env bash
# Install/remove the local Kilo server plugin without editing user JSONC config.
# Kilo auto-discovers only *.ts/*.js files directly under plugin/. Keep helper
# modules in a managed subdirectory and install one top-level entrypoint.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." 2>/dev/null && pwd)"
SOURCE="${ROOT}/src"
ENTRYPOINT="${ROOT}/installer/entrypoint.ts"
PLUGIN_ROOT="${KILO_PLUGIN_DIR:-${HOME}/.config/kilo/plugin}"
TARGET="${PLUGIN_ROOT}/atoaxis-kilo-code"
ENTRY_TARGET="${PLUGIN_ROOT}/atoaxis-kilo-code.ts"

if [ "${1:-}" = "--uninstall" ]; then
  case "$PLUGIN_ROOT" in
    */kilo/plugin|*/.kilo/plugin|*/.kilocode/plugin)
      rm -rf "$TARGET" 2>/dev/null || true
      rm -f "$ENTRY_TARGET" 2>/dev/null || true
      ;;
    *) echo "refusing to remove an unrecognised Kilo plugin path" >&2; exit 2 ;;
  esac
  exit 0
fi

[ -d "$SOURCE" ] && [ -f "$ENTRYPOINT" ] || {
  echo "Kilo adapter resources are incomplete: expected $SOURCE and $ENTRYPOINT" >&2
  exit 1
}
TMP="${TARGET}.tmp-$$"
ENTRY_TMP="${ENTRY_TARGET}.tmp-$$"
rm -rf "$TMP" "$ENTRY_TMP"
mkdir -p "$PLUGIN_ROOT"
cp -R "$SOURCE" "$TMP"
cp "$ENTRYPOINT" "$ENTRY_TMP"
rm -rf "$TARGET"
mv "$TMP" "$TARGET"
mv "$ENTRY_TMP" "$ENTRY_TARGET"
exit 0
