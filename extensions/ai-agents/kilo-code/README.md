# AtoAxis Kilo Code producer

This package is a metadata-only Kilo server plugin. It runs in both Kilo CLI and
the Kilo VS Code extension and listens for `tool.execute.before`/
`tool.execute.after` plus `file.edited` events. Successful file changes are sent
to the local `wakaclock ai emit --json` broker ingress.

Install globally with Kilo's supported local-plugin directory (the installer
creates a top-level entrypoint and keeps implementation helpers private):

```sh
./installer/install.sh
```

The plugin keeps `client_id=kilo-code` separate from the provider and model used
for a request (`deepseek`, `moonshot`, `openai`, `anthropic`, etc.). It sends only
paths, IDs, line counts and bounded timing metadata. Prompt, response, content,
patch, command and tool-output fields are ignored. A missing CLI or broker is
fail-open and cannot block Kilo.

Session created/updated/idle/error/deleted events persist only bounded lifecycle
metadata through `wakaclock ai session-start/end`; shell tools use the shared
before/after snapshot and failed calls abort their pending state. Inline completion
has no direct acceptance event in this plugin, so it is not attributed in v1.

The adapter is `scaffold` until a real Kilo CLI and VS Code run is captured and
the resulting broker/backend rows are inspected. Inline autocomplete has no
direct acceptance event here and is intentionally not claimed as Kilo evidence.

Native activity capture is opt-in for this internal candidate. Configure the
plugin with `{ "activitySurface": "cli" }` or `{ "activitySurface": "ide" }`
using Kilo's plugin options tuple. Do not install the same module both through
auto-discovery and the configured tuple. Without the option, the existing file
producer remains enabled and activity-surface evidence is pending.

The activity path observes all tool start/end callbacks, including read/search
and failures, and accepts them only after a matching durable inbox ACK from
`wakaclock ai activity-hook`. It records the callback timestamp and session/call
identity. It does not turn permission waits into measured intervals or failed
tools into successful edits. A missing ACK is reported with a safe error code;
it is not a promise that a callback which never reached durable storage can be
recovered. Retry of an accepted operation retains its original ID and timestamp.
Live runtime/version checks remain pending on both operating systems.
