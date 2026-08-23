# AtoAxis AI agent integrations

Sends real AtoAxis coding-time heartbeats whenever an AI coding agent (Claude Code,
Codex CLI, Gemini CLI) edits a file — attributed to that agent, not silently merged
into your own human coding time. This does **not** depend on an editor being open or
noticing the change (unlike `extensions/vscode`, which only sees edits made through
VS Code's own document-change events) — each integration here hooks directly into the
agent's own tool-call lifecycle, the same mechanism WakaTime's official Claude Code /
Codex / Gemini CLI plugins use.

All three call the same underlying command:

```
wakaclock heartbeat --entity <file> --write --ai-agent <name> \
  --ai-provider <provider> --ai-source agent_hook \
  --ai-confidence verified --ai-event-id <id> \
  --ai-lines-added <n> --ai-lines-deleted <n>
```

`--ai-agent` is what flips `is_ai_generated` on and attributes the heartbeat to that
agent (see `backend/api/crates/wakaclock-cli` — there is no separate boolean flag to
keep in sync with it). The hooks read `WAKACLOCK_CLI_PATH` first and then
`~/.wakaclock/cli-path` (written by the VS Code setup wizard), so the binary does not
have to be on the AI tool's own `PATH`. This requires the `wakaclock` binary and a saved API key
(`wakaclock config set-key <key>`, from the dashboard's Settings → API key) already
working — see the repo root README's Quick Start if that isn't set up yet.

The VS Code extension bundles these files, detects the corresponding CLIs and offers
`AtoAxis: Set Up AI Tracking`. The setup writes only its own managed hook block and
keeps a stable copy under `~/.wakaclock/agent-plugins/`, so a VSIX update does not
leave another tool pointing at a deleted extension directory. It also installs a
per-user `wakaclock agent` service. The service scans Codex, Claude and Gemini
transcripts every five seconds, resumes per-agent/per-file cursors, and starts old
transcripts at their tail (only the last 24 hours are replayed on first discovery).
Use `wakaclock agent status --json` to inspect process, scan, queue and error state.

## Claude Code (`plugins/atoaxis-heartbeat/`)

The one with real plugin-marketplace support, so installation genuinely is one command
— no manual `settings.json` editing:

```
claude plugin marketplace add <path-or-git-url-to>/extensions/ai-agents
claude plugin install atoaxis-heartbeat@atoaxis-plugins
```

Registers a `PostToolUse` hook on `Write|Edit|MultiEdit` (`hooks/hooks.json`) that runs
`scripts/heartbeat.sh`. Verified end-to-end against a running AtoAxis server this
session: a real Edit produced a heartbeat with correct `ai_agent`/line-count
attribution, confirmed via `GET /users/current/ai_stats`.

## Codex CLI (`codex/`)

Codex has no plugin-marketplace equivalent yet — hooks are behind a feature flag and
registered by hand in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true

[[hooks.PostToolUse]]
matcher = "apply_patch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "/absolute/path/to/extensions/ai-agents/codex/heartbeat-hook.sh"
timeout = 60
```

`apply_patch`'s payload is Codex's own patch-text format (`*** Update File: <path>`
markers), not a single `file_path` field — `heartbeat-hook.sh` extracts the path and
counts `+`/`-` prefixed lines from the patch body. Mechanism verified with a synthetic
payload matching the documented shape; **not** verified against a real Codex CLI
session (this environment can't run one) — the file-path extraction is the part most
likely to need adjusting if Codex's real hook payload differs from what's documented.

## Gemini CLI (`gemini-cli/`)

Gemini CLI extensions do bundle hooks (closer to Claude Code's experience than
Codex's):

```
gemini extensions install <path-or-git-url-to>/extensions/ai-agents/gemini-cli
```

Registers an `AfterTool` hook on `write_file|replace` (Gemini's file-edit tools).
Same caveat as Codex: built from the documented hook event/payload shape, sanity-tested
with a synthetic payload, not against a real Gemini CLI session.

## Adding another agent

Any agent with a hook/event system that can run a shell command and receives a file
path (however it's nested in the payload) needs a new adapter that extracts the path,
line delta, provider/model metadata and event id, then calls
`wakaclock heartbeat --ai-agent <new-name> ...`. Events are intentionally not
rate-limited: an agent may edit the same file several times in one minute and every
line delta must survive the offline queue. Activity-time heartbeats can still be
coalesced separately by the editor extension.
