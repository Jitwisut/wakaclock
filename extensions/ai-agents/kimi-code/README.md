# AtoAxis Kimi Code hooks

Kimi Code exposes lifecycle hooks through `~/.kimi-code/config.toml` in current
releases and `~/.kimi/config.toml` in older Beta releases. Install the managed
block with:

```sh
./installer/install.sh
```

The hooks send successful `WriteFile`/`StrReplaceFile` calls through the shared
metadata-only producer and use the existing before/after snapshot API for Shell.
Failed Shell calls release pending state with `wakaclock ai tool-abort` and never
emit a verified edit. SessionStart/SessionEnd persist only bounded identity and
timestamps in `~/.wakaclock/ai-sessions.json`; Stop/StopFailure close the same
interval as lifecycle metadata. None of these hooks creates a file-change event or
stores prompt/response text.

The installer replaces only the marker-bounded AtoAxis block, preserves all user
hooks/comments, and is safe to run repeatedly. Remove it with
`./installer/install.sh --uninstall`.

Kimi hooks are Beta. This adapter remains `scaffold` until a real Kimi version is
run and the broker/backend row is inspected. Prompts, responses, tool output,
commands and source content are not forwarded or stored.
