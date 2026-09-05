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
