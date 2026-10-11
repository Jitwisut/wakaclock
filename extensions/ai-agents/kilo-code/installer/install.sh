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

python3 "$SCRIPT_DIR/install.py" "$ROOT" "$PLUGIN_ROOT" "${1:-}"
