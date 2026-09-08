#!/usr/bin/env bash
# Install or remove only the AtoAxis-managed Kimi hook block.
set -euo pipefail

MARKER="# AtoAxis managed Kimi Code hooks"
END_MARKER="# End AtoAxis managed Kimi Code hooks"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." 2>/dev/null && pwd)"
HOOK_DIR="${ROOT}/hooks"
CONFIG="${KIMI_CONFIG_PATH:-${HOME}/.kimi/config.toml}"
if [ -z "${KIMI_CONFIG_PATH:-}" ]; then
  # Kimi Code has used both locations: current releases document
  # ~/.kimi-code/config.toml while older Beta builds used ~/.kimi/config.toml.
  # Follow an explicit KIMI_CODE_HOME first, then preserve whichever existing
  # config the user already has; a new install defaults to the current path.
  if [ -n "${KIMI_CODE_HOME:-}" ]; then
    CONFIG="${KIMI_CODE_HOME}/config.toml"
  elif [ -f "${HOME}/.kimi-code/config.toml" ] || [ -d "${HOME}/.kimi-code" ]; then
    CONFIG="${HOME}/.kimi-code/config.toml"
  elif [ -f "${HOME}/.kimi/config.toml" ] || [ -d "${HOME}/.kimi" ]; then
    CONFIG="${HOME}/.kimi/config.toml"
  else
    CONFIG="${HOME}/.kimi-code/config.toml"
  fi
fi

toml_quote() {
  printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
}

remove_block() {
  [ -f "$CONFIG" ] || return 0
  local tmp
  tmp="$(mktemp "${CONFIG}.atoaxis.XXXXXX")"
  awk -v start="$MARKER" -v end="$END_MARKER" '
    $0 == start {skip=1; next}
    $0 == end {skip=0; next}
    !skip {print}
  ' "$CONFIG" >"$tmp" || { rm -f "$tmp"; return 1; }
  mv "$tmp" "$CONFIG" || { rm -f "$tmp"; return 1; }
}

if [ "${1:-}" = "--uninstall" ]; then
  remove_block
  exit 0
fi

mkdir -p "$(dirname "$CONFIG")"
remove_block
TMP="$(mktemp "${CONFIG}.atoaxis.XXXXXX")"
if [ -f "$CONFIG" ]; then
  cat "$CONFIG" >"$TMP" || { rm -f "$TMP"; exit 1; }
fi

cat >>"$TMP" <<EOF

$MARKER
[[hooks]]
event = "PreToolUse"
matcher = "Shell|Bash|shell|bash"
command = $(toml_quote "${HOOK_DIR}/pre-tool-use.sh")
timeout = 30

[[hooks]]
event = "PostToolUse"
matcher = "WriteFile|StrReplaceFile|Shell|Bash|write_file|str_replace_file|shell|bash"
command = $(toml_quote "${HOOK_DIR}/post-tool-use.sh")
timeout = 30

[[hooks]]
event = "PostToolUseFailure"
matcher = "Shell|Bash|shell|bash"
command = $(toml_quote "${HOOK_DIR}/post-tool-use-failure.sh")
timeout = 30

[[hooks]]
event = "SessionStart"
command = $(toml_quote "${HOOK_DIR}/session-start.sh")
timeout = 10

[[hooks]]
event = "SessionEnd"
command = $(toml_quote "${HOOK_DIR}/session-end.sh")
timeout = 10

[[hooks]]
event = "Stop"
command = $(toml_quote "${HOOK_DIR}/stop.sh")
timeout = 10

[[hooks]]
event = "StopFailure"
command = $(toml_quote "${HOOK_DIR}/stop-failure.sh")
timeout = 10
$END_MARKER
EOF
mv "$TMP" "$CONFIG"
exit 0
