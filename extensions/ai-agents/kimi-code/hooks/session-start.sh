#!/usr/bin/env bash
# Kimi SessionStart: route a fixed identity/timing allowlist to the local CLI.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON="${WAKACLOCK_AGENT_COMMON_DIR:-${SCRIPT_DIR}/../../common}/session-event.sh"
[ -x "$COMMON" ] || exit 0
exec "$COMMON" start
