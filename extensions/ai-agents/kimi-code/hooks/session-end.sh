#!/usr/bin/env bash
# Kimi SessionEnd: close only the metadata-only local session interval.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON="${WAKACLOCK_AGENT_COMMON_DIR:-${SCRIPT_DIR}/../../common}/session-event.sh"
[ -x "$COMMON" ] || exit 0
exec "$COMMON" end
