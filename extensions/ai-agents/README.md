# AtoAxis AI agent integrations

Website: <https://www.atoaxis.com>

Sends real AtoAxis coding-time heartbeats whenever an AI coding agent (Claude Code,
Codex CLI, Gemini CLI, Kilo Code or Kimi Code CLI) edits a file — attributed to that agent, not silently merged
into your own human coding time. This does **not** depend on an editor being open or
noticing the change: each integration here hooks directly into the agent's own
tool-call lifecycle, the same mechanism WakaTime's official Claude Code / Codex /
Gemini CLI plugins use. The VS Code extension also has a workspace-scoped filesystem
receiver for external writes, but native hooks remain the only source that can prove
an AI model's identity while the editor is closed.

All adapters send the same metadata-only event to the local SQLite inbox through the
existing `wakaclock` binary:

```
cat event.json | wakaclock ai emit --json
```

The on-demand processor resolves the canonical `actor_type` and `actor_confidence`, then derives the
deprecated `is_ai_generated` compatibility field from that enum at heartbeat creation
(see `backend/api/crates/wakaclock-cli`). The hooks read `WAKACLOCK_CLI_PATH` first and then
`~/.wakaclock/cli-path` (written by the VS Code setup wizard), so the binary does not
have to be on the AI tool's own `PATH`. This requires the `wakaclock` binary and a saved API key
(`wakaclock config set-key <key>`, from the dashboard's Settings → API key) already
working — see the repo root README's Quick Start if that isn't set up yet. Don't have a key?
Join Early Access at <https://www.atoaxis.com/join>.

The VS Code extension bundles these files, detects the corresponding CLIs and offers
`AtoAxis: Set Up AI Tracking`. The setup writes only its own managed hook block and
keeps a stable copy under `~/.wakaclock/agent-plugins/`, so a VSIX update does not
leave another tool pointing at a deleted extension directory. It never installs a
per-user service. Native hooks invoke a bounded `wakaclock sync --automatic --json`
pass at lifecycle boundaries; the SQLite cursor resumes the active transcript and
old transcripts start at their tail (only the last 24 hours are replayed on first
discovery). Use `wakaclock sync --json` to inspect accepted/sent/pending work,
heartbeat and AI-usage queues, retry/dead-letter counts, and the current on-demand
lease. `wakaclock ai doctor --json` reports adapter coverage and exact runtime
metadata. `wakaclock broker status --json` and `wakaclock agent status --json` remain
read-only compatibility aliases.

The same setup is available without VS Code:

```sh
wakaclock ai setup --all          # configure every detected client
wakaclock ai setup codex          # configure one client (aliases are accepted)
wakaclock ai setup --all --yes    # explicit consent for terminal automation
wakaclock ai setup --all --json   # machine-readable health and remediation report
```

The CLI copies this tested bundle to a versioned directory below
`~/.wakaclock/agent-plugins/` before registering paths. Missing clients are reported
as `not_detected`; scaffold adapters remain scaffold and are not promoted by a name
in the registry. Run `wakaclock doctor ai --json` afterward to inspect the actual
on-demand and transcript state.

## Claude Code (`plugins/atoaxis-heartbeat/`)

The one with real plugin-marketplace support, so installation genuinely is one command
— no manual `settings.json` editing:

```
claude plugin marketplace add <path-or-git-url-to>/extensions/ai-agents
claude plugin install atoaxis-heartbeat@atoaxis-plugins
```

Registers a verified `PostToolUse` hook on `Write|Edit|MultiEdit|NotebookEdit` and a
Before/After snapshot around `Bash`/MCP tool calls. The thin hook adapters call
`wakaclock ai tool-before` and `wakaclock ai tool-after`; the Rust engine fingerprints
the workspace, persists the BeforeTool snapshot in SQLite, and emits `inferred` events
only for files whose content actually changed. Git workspaces reuse clean index blob IDs
and hash only dirty/untracked files; non-Git workspaces use filesystem SHA-256. This
covers `sed`, heredocs, Python scripts, codemods and `git apply` without parsing command
text. The older post-only `heartbeat-sweep.sh` remains only for compatibility with
previously installed plugin versions.

## Codex CLI (`codex/`)

Current Codex CLI/Desktop builds install the versioned AtoAxis plugin through a local
marketplace. The setup command performs the registration idempotently:

```
wakaclock ai setup codex --yes
```

The managed bundle contains `.codex-plugin/plugin.json`, `hooks/hooks.json`, and the
local marketplace entry. For older builds that do not expose `codex plugin`, setup
falls back to a marker-bounded block in `~/.codex/config.toml` and removes only that
block on uninstall:

```toml
[features]
hooks = true

[[hooks.PostToolUse]]
matcher = "^apply_patch$"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "/absolute/path/to/extensions/ai-agents/codex/heartbeat-hook.sh"
timeout = 60

[[hooks.PreToolUse]]
matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*"
[[hooks.PreToolUse.hooks]]
type = "command"
command = "/absolute/path/to/extensions/ai-agents/codex/git-sweep-before.sh"
timeout = 60

[[hooks.PostToolUse]]
matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "/absolute/path/to/extensions/ai-agents/codex/git-sweep-after.sh"
timeout = 60

[[hooks.PostToolUseFailure]]
matcher = "Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*"
[[hooks.PostToolUseFailure.hooks]]
type = "command"
command = "/absolute/path/to/extensions/ai-agents/codex/tool-abort.sh"
timeout = 60
```

`apply_patch` still uses the verified per-file delta adapter when that hook fires. The
current PostToolUse payload carries the patch DSL in `tool_input.command`; the adapter
also accepts the older `input`/`patch` shapes for one upgrade cycle. Shell
and MCP mutations use the shared Before/After fingerprint engine and therefore do not
need to parse command text. Current Codex releases use `[features].hooks = true`; the VS Code setup
helper migrates the deprecated `codex_hooks = true` setting automatically. Codex hook
coverage has varied between releases/tool execution paths, so the event-triggered
transcript parser remains a second independent fallback rather than treating hooks as
infallible.

## Gemini CLI (`gemini-cli/`)

Gemini CLI extensions bundle hooks (closer to Claude Code's experience than
Codex's). Setup uses a bounded, non-interactive install:

```
wakaclock ai setup gemini-cli --yes
# equivalent underlying command:
gemini extensions install <path> --consent --skip-settings
```

Registers the verified `AfterTool` adapter on `write_file|replace`, plus Before/After
fingerprint snapshots around `run_shell_command|mcp_.*`. Gemini's hook matcher is regex-based, so
this also covers file mutations performed through Gemini MCP tools without trying to
parse arbitrary shell command text.

## Kilo Code (`kilo-code/`)

Kilo loads TypeScript server plugins in both its CLI and VS Code runtimes. The VS
Code setup command copies a top-level `atoaxis-kilo-code.ts` entrypoint and its
private helper modules into `~/.config/kilo/plugin/`; they can also be installed
through Kilo's supported plugin mechanism. The plugin listens to `tool.execute.after` and `file.edited`,
keeps `client_id=kilo-code` separate from the provider/model selected for each
request, and sends only allowlisted file metadata. It remains scaffold until a
real Kilo run is inspected.

## Kimi Code CLI (`kimi-code/`)

Kimi's Beta lifecycle hooks are installed with `kimi-code/installer/install.sh`
(the VS Code setup command invokes it automatically). Current releases use
`~/.kimi-code/config.toml`; the installer also preserves older `~/.kimi/config.toml`
configurations. `WriteFile`/`StrReplaceFile`
success events use the shared producer; Shell uses `ai tool-before`/`ai tool-after`,
and failed Shell calls use `ai tool-abort`. The installer owns one marker-bounded
block in `~/.kimi/config.toml` and preserves other user hooks. SessionStart/End
record only bounded identity/timestamps in `~/.wakaclock/ai-sessions.json`; Stop and
StopFailure close the same interval as lifecycle metadata. This adapter remains
scaffold until a real Kimi version and broker row are verified.

## Shell / MCP mutation snapshot engine

For tools that can mutate files indirectly, use the same stable tool id on both sides:

```bash
printf '%s' '{"tool_event_id":"session:call-1","agent":"codex","provider":"openai","tool":"shell_command","workspace_root":"/project"}' \
  | wakaclock ai tool-before --json
# the AI shell command runs here
printf '%s' '{"tool_event_id":"session:call-1","agent":"codex","provider":"openai","tool":"shell_command","workspace_root":"/project"}' \
  | wakaclock ai tool-after --json
```

The BeforeTool snapshot contains only paths, Git/content fingerprints, file metadata and
agent/session/tool identifiers — never source text, prompts, responses or command
arguments. It survives CLI/editor restarts in `~/.wakaclock/ai-attribution.sqlite3` and
is pruned after 24 hours if abandoned. AfterTool detects create/modify/delete and
one-to-one pure renames. Exact line deltas are emitted only when they can be proven:
new/deleted whole files and clean tracked Git diffs are exact; a file that was already
dirty before AI remains `lines_added/deleted = unknown` instead of inheriting the user's
pre-existing changes.

All file events from one shell call share `ai_change_id = tool_event_id`. Only the first
heartbeat carries the tool-call activity interval; the rest carry zero duration, so a
codemod touching 100 files does not multiply coding time by 100. If an exact native-hook
fingerprint already exists, the weaker inferred event is suppressed.

When a tool fails or is cancelled, adapters call `wakaclock ai tool-abort --json`
with the same `tool_event_id`. This only discards the pending snapshot and never
emits an AI edit.

## Generic MCP / tool ingress

WakaClock now exposes a normalized metadata-only ingress for agents that are not
covered by a native transcript parser or hook adapter:

```bash
cat <<'JSON' | wakaclock ai emit --json
{
  "event_id": "chatgpt-session-42:src/app.ts:1",
  "agent": "chatgpt",
  "provider": "openai",
  "session_id": "session-42",
  "entity": "/absolute/project/src/app.ts",
  "project_root": "/absolute/project",
  "lines_added": 12,
  "lines_deleted": 4,
  "source": "mcp",
  "confidence": "verified",
  "transport": "mcp",
  "tool": "tan.apply_patch"
}
JSON
```

The command converts the event into the same durable Broker inbox used by transcript
sync. The BrokerProcessor appends a metadata-only record to
`~/.wakaclock/ai-events.jsonl` after local acceptance so an open VS Code document can
correlate the external edit instead of counting the same change as manual typing.
`prompt`, response text, patch/source content, and arbitrary unknown fields are rejected
by the ingress contract. `transport` and `tool` are local diagnostic metadata only; tool
arguments are never recorded. See `docs/ai-activity-broker.md` for the HTTP v1 contract,
authentication, retry semantics, and privacy guarantees.

This is the preferred integration surface for ChatGPT/Tan/MCP and future agents. The
external MCP server still needs a small adapter that emits one event after each
successful file mutation (`write_file`, `apply_patch`, `move_file`, etc.).

## Adding another agent

Any agent with a hook/event system that can run a shell command and receives a file
path (however it's nested in the payload) needs a new adapter that extracts the path,
line delta, provider/model metadata and event id, then calls `wakaclock ai emit` with
the Broker Event v1 envelope. Events are intentionally not rate-limited: an agent may
edit the same file several times in one minute and every line delta must survive the
durable inbox. Activity-time heartbeats can still be coalesced separately by the editor
extension. The old `wakaclock heartbeat --ai-agent ...` form remains only as a
compatibility adapter and is routed through the Broker internally.
