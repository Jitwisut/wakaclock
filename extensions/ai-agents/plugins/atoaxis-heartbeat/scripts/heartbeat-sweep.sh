#!/usr/bin/env bash
#
# AtoAxis sweep hook for Claude Code — fires on PostToolUse for Bash.
#
# The companion `heartbeat.sh` reads `tool_input.file_path`, which only exists for the
# Write/Edit/MultiEdit/NotebookEdit tools. An agent that edits through the shell instead —
# `sed -i`, a heredoc, `python3 - <<EOF`, a codemod script, `git apply` — produces no
# such field, and every one of those edits was invisible. That is not an edge case:
# Claude Code is *instructed* to prefer shell edits whenever bypass-permissions mode is
# active, so in those sessions the AI attribution recorded nothing at all.
#
# A shell command cannot be parsed for the file it touched with any reliability, so this
# does not try. It asks git what actually changed since the last sweep, which is correct
# regardless of how the change was made, and costs one `git status` per Bash call.
set -euo pipefail

INPUT="$(cat)"

command -v jq >/dev/null 2>&1 || exit 0

WAKACLOCK_BIN="${WAKACLOCK_CLI_PATH:-}"
if [ -z "$WAKACLOCK_BIN" ] && [ -f "${HOME}/.wakaclock/cli-path" ]; then
  WAKACLOCK_BIN="$(tr -d '\r\n' < "${HOME}/.wakaclock/cli-path")"
fi
WAKACLOCK_BIN="${WAKACLOCK_BIN:-wakaclock}"
command -v "$WAKACLOCK_BIN" >/dev/null 2>&1 || exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
COMMON_EMITTER="${WAKACLOCK_AGENT_COMMON_EMITTER:-${SCRIPT_DIR}/../../../common/emit-event.sh}"
emit_metadata() {
  if [ -x "$COMMON_EMITTER" ]; then
    "$COMMON_EMITTER"
  else
    jq -c '{schema_version:1,producer_version:(.producer_version // 1),event_type:"file_change",event_id,occurred_at,entity,project_root:(.project_root // null),change_kind:(.change_kind // "modify"),previous_entity:(.previous_entity // null),agent:(.agent // .client_id),provider:(.provider // .provider_id // null),model:(.model // .model_id // null),source:(.source // "agent_hook"),confidence:(.confidence // "inferred"),lines_added:(.lines_added // null),lines_deleted:(.lines_deleted // null),transport:(.transport // "shell_hook"),tool:(.tool // null),tool_event_id:(.tool_event_id // .tool_call_id // null)}' \
      | "$WAKACLOCK_BIN" ai emit --json >/dev/null 2>&1 || true
  fi
}

CWD="$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"

ROOT="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)"
# Outside a repository there is no cheap way to know what changed. Say nothing rather
# than guess — a wrong entity is worse than a missing one.
[ -n "$ROOT" ] || exit 0

STATE_DIR="${HOME}/.wakaclock/claude-hook-state"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
if command -v shasum >/dev/null 2>&1; then
  ROOT_HASH="$(printf '%s' "$ROOT" | shasum -a 256 | cut -c1-40)"
elif command -v sha256sum >/dev/null 2>&1; then
  ROOT_HASH="$(printf '%s' "$ROOT" | sha256sum | cut -c1-40)"
elif command -v cksum >/dev/null 2>&1; then
  ROOT_HASH="$(printf '%s' "$ROOT" | cksum | awk '{print $1":"$2}')"
else
  ROOT_HASH="unhashed-$$"
fi
STAMP="${STATE_DIR}/sweep-${ROOT_HASH}"

# First sweep in this repository: record the mark and report nothing. Without this the
# first Bash call in a dirty tree would emit a heartbeat for every uncommitted file.
if [ ! -f "$STAMP" ]; then
  : >"$STAMP"
  exit 0
fi

AI_MODEL="$(jq -r '.model // .model_name // empty' <<<"$INPUT" 2>/dev/null || true)"
if [ -z "$AI_MODEL" ] || [ "$AI_MODEL" = "null" ]; then
  TRANSCRIPT_PATH="$(jq -r '.transcript_path // empty' <<<"$INPUT" 2>/dev/null || true)"
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    AI_MODEL="$(tail -n 400 "$TRANSCRIPT_PATH" 2>/dev/null \
      | jq -r 'select(.type == "assistant") | .message.model // empty' 2>/dev/null \
      | tail -n 1 || true)"
  fi
fi

# `git status` already honours .gitignore, so generated output and dependency trees stay
# out. Only paths modified since the previous sweep survive the `-newer` test.
CHANGED=0
while IFS= read -r path; do
  [ -n "$path" ] || continue
  FULL="${ROOT}/${path}"
  [ -f "$FULL" ] || continue
  [ -n "$(find "$FULL" -newer "$STAMP" -print -prune 2>/dev/null)" ] || continue

  CHANGED=$((CHANGED + 1))
  # A single command can rewrite a whole tree. Cap the batch so one `git checkout` does
  # not turn into hundreds of heartbeats; the time is bridged from the ones that do land.
  [ "$CHANGED" -le 20 ] || break

  FILE_MARK="$(stat -f '%m:%z' "$FULL" 2>/dev/null || stat -c '%Y:%s' "$FULL" 2>/dev/null || true)"
  EVENT_MATERIAL="${ROOT}|${FULL}|${FILE_MARK}"
  if command -v shasum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | shasum -a 256 | cut -c1-40)"
  elif command -v sha256sum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | sha256sum | cut -c1-40)"
  elif command -v cksum >/dev/null 2>&1; then
    EVENT_HASH="$(printf '%s' "$EVENT_MATERIAL" | cksum | awk '{print $1":"$2}')"
  else
    EVENT_HASH="unhashed-$$"
  fi
  EVENT_ID="claude-code-sweep-${EVENT_HASH}"
  # Keep the compatibility sweep on the same durable broker path as native hooks. The
  # file changed during a shell call, but the sweep cannot prove the exact writer or
  # line delta, so it is explicitly inferred with nullable counters.
  jq -cn \
    --arg client_id "claude-code" \
    --arg event_id "$EVENT_ID" \
    --arg occurred_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg entity "$FULL" \
    --arg project_root "$ROOT" \
    --arg agent "claude-code" \
    --arg provider "anthropic" \
    --arg model "$AI_MODEL" \
    '{client_id:$client_id,producer_version:1,event_id:$event_id,occurred_at:$occurred_at,entity:$entity,project_root:$project_root,change_kind:"modify",provider_id:$provider,model_id:(if $model=="" then null else $model end),source:"agent_hook",confidence:"inferred",lines_added:null,lines_deleted:null,transport:"tool_snapshot",tool:"shell-sweep",tool_event_id:$event_id}' \
    | emit_metadata
done < <(git -C "$ROOT" status --porcelain --untracked-files=normal 2>/dev/null \
         | sed 's/^...//' | sed 's/.* -> //')

: >"$STAMP"
exit 0
