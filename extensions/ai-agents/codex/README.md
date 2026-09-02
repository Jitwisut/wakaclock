# AtoAxis Codex CLI adapter

Current Codex releases expose lifecycle hooks through `~/.codex/config.toml`
rather than a marketplace plugin. The VS Code setup command enables the hooks
feature and installs the managed `PostToolUse`/shell blocks pointing at this
directory. `heartbeat-hook.sh` parses an `apply_patch` payload in memory, emits
one allowlisted metadata record per file, and delegates validation, retry and
offline spooling to `common/emit-event.sh` and the local broker.

The shell before/after scripts use the same snapshot API for edits made through
Codex shell or MCP tools. Failed calls never emit a verified file change. The
native hook has been exercised against `codex-cli 0.151.0-alpha.7.1`: its
PostToolUse payload puts the apply-patch DSL in `tool_input.command`, and the
managed matcher is anchored as `^apply_patch$`. Transcript recovery remains
enabled independently for older sessions and missed hook deliveries.
