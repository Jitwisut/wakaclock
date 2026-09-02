#!/usr/bin/env bash
# Kimi Stop: close the metadata-only interval at the lifecycle event Kimi reports.
# This is health/session metadata only; it never creates a file-change event.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON="${WAKACLOCK_AGENT_COMMON_DIR:-${SCRIPT_DIR}/../../common}/session-event.sh"
[ -x "$COMMON" ] || exit 0
exec "$COMMON" end
