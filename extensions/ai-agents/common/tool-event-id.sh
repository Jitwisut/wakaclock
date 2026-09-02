#!/usr/bin/env bash
# Shared deterministic identity for BeforeTool/AfterTool/Abort hooks.
# Source this file; it intentionally performs no work when executed directly.

atoaxis_tool_event_id() {
  local agent="${1:-unknown-agent}"
  local cwd="${2:-}"
  local session_id="${3:-}"
  local call_id="${4:-}"
  local tool_name="${5:-}"
  local material="${agent}|${cwd}|${session_id}|${call_id:-${tool_name}}"
  local hash

  if command -v shasum >/dev/null 2>&1; then
    hash="$(printf '%s' "$material" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    hash="$(printf '%s' "$material" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    hash="$(printf '%s' "$material" | cksum | awk '{print $1":"$2}')"
  else
    # Never put cwd/session/call material into an event ID when no digest utility
    # exists. The process identifier is only a last-resort, non-content identity.
    hash="unhashed-$$"
  fi
  printf '%s-tool-%s\n' "$agent" "$hash"
}
