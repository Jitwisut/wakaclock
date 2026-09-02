#!/usr/bin/env bash
# PreToolUse guard for Bash: catches the three build traps in this repo.
#   1. cargo from the repo root  — root Cargo.toml points at crates/* that do not exist
#   2. npm/pnpm outside a package.json dir — frontend/package.json does not exist
#   3. Makefile targets broken by FRONTEND_DIR=frontend
# See .context/commands.md and .context/dead-code.md.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

# Collect the program actually invoked in each command segment, so a tool name
# appearing as an argument (grep -rn cargo ...) is never mistaken for the tool.
progs=$(printf '%s\n' "$cmd" \
  | sed -E 's/(\|\||&&|[;&|])/\n/g' \
  | sed -E 's/^[[:space:]]+//' \
  | sed -E 's/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)+//' \
  | awk '{print $1}')

has() { grep -qxF "$1" <<<"$progs"; }
target=$(printf '%s\n' "$cmd" | sed -E 's/(\|\||&&|[;&|])/\n/g' \
  | awk '$1=="make"{print $2}')

reason=""

if has cargo \
   && ! grep -q 'backend/api' <<<"$cmd" \
   && ! grep -q -- '--manifest-path' <<<"$cmd"; then
  reason="cargo appears to run from the repo root. The root Cargo.toml declares members at crates/*, which do not exist — cargo metadata fails there. Use: cd backend/api && cargo ..."
fi

if { has npm || has pnpm || has yarn; } \
   && ! grep -qE 'frontend/app|extensions/vscode' <<<"$cmd"; then
  reason="${reason:+$reason$'\n\n'}npm/pnpm has no package.json at the repo root or in frontend/. The Next.js app is frontend/app; the VS Code extension is extensions/vscode. Use: cd frontend/app && npm ..."
fi

if grep -qxE '(dev|build|test|dev-frontend|build-frontend|test-frontend|dev-worker)' <<<"$target"; then
  reason="${reason:+$reason$'\n\n'}That Makefile target is broken: FRONTEND_DIR=frontend but package.json lives in frontend/app (and no 'worker' binary exists). Run the cd-prefixed commands from .context/commands.md instead."
fi

[ -n "$reason" ] || exit 0

jq -n --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "ask",
    permissionDecisionReason: $r
  }
}'
