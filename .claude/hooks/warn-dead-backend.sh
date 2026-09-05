#!/usr/bin/env bash
# PreToolUse guard: Write|Edit into a backend module tree that main.rs never
# compiles. See .context/dead-code.md for why these are unreachable.
#
# Emits an "ask" permission decision so the edit is confirmed rather than
# blocked — deleting or cleaning up this tree is legitimate work.
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -n "$path" ] || exit 0

case "$path" in
  */backend/api/src/interfaces/*)     why="src/interfaces/ — no 'mod interfaces;' in main.rs" ;;
  */backend/api/src/docs/*)           why="src/docs/ — no 'mod docs;' in main.rs" ;;
  */backend/api/src/model/v1/*)       why="src/model/v1/ — model/mod.rs does not declare 'pub mod v1;'" ;;
  */backend/api/src/helpers/auth/*)   why="src/helpers/auth/ — helpers/mod.rs is empty; real auth is middleware/auth.rs" ;;
  */backend/api/src/helpers/mapping/*) why="src/helpers/mapping/ — helpers/mod.rs is empty" ;;
  */backend/api/src/handlers/v1/handler.rs) why="handlers/v1/handler.rs — not listed in handlers/v1/mod.rs" ;;
  *) exit 0 ;;
esac

jq -n --arg why "$why" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason:
      ("UNREACHABLE CODE: " + $why + ".\n" +
       "This file is not compiled and is e-commerce template leftover — see .context/dead-code.md.\n" +
       "Editing it changes nothing at runtime. Confirm only if you are deliberately cleaning up the dead tree.")
  }
}'
