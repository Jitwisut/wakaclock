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

CWD="$(jq -r '.cwd // empty' <<<"$INPUT" 2>/dev/null || true)"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$PWD"

ROOT="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || true)"
# Outside a repository there is no cheap way to know what changed. Say nothing rather
# than guess — a wrong entity is worse than a missing one.
[ -n "$ROOT" ] || exit 0

STATE_DIR="${HOME}/.wakaclock/claude-hook-state"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
STAMP="${STATE_DIR}/sweep-$(printf '%s' "$ROOT" | shasum | cut -c1-40)"

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

  EVENT_ID="claude-code-sweep-$(date +%s)-$(printf '%s' "$FULL" | shasum | cut -c1-12)"
  CLI_ARGS=(
    heartbeat
    --entity "$FULL"
    --write
    --ai-agent claude-code
    --ai-provider anthropic
    --ai-source agent_hook
    # `inferred`, not `verified`: git proves the file changed during this tool call, not
    # that this specific command is what changed it. The companion hook, which is handed
    # the path by the tool itself, keeps `verified`.
    --ai-confidence inferred
    --ai-event-id "$EVENT_ID"
  )
  [ -n "$AI_MODEL" ] && CLI_ARGS+=(--ai-model "$AI_MODEL")
  "$WAKACLOCK_BIN" "${CLI_ARGS[@]}" >/dev/null 2>&1 || true
done < <(git -C "$ROOT" status --porcelain --untracked-files=normal 2>/dev/null \
         | sed 's/^...//' | sed 's/.* -> //')

: >"$STAMP"
exit 0
