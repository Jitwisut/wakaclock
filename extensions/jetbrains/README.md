# AtoAxis for IntelliJ IDEA and PyCharm

This opt-in desktop plugin records activity on the selected local file in the active project window. Tracking is off on first install.

## Set up

1. Install the AtoAxis CLI and configure the account and destination you want to use with it.
2. Install the plugin ZIP from disk. See [Building the plugin](BUILDING.md) for the build command and archive location.
3. Choose **Tools → Configure AtoAxis Tracking…**, enter the absolute path to the trusted CLI executable, and enable tracking. The setting applies to projects in this IDE installation. Return to the same dialog to disable it.

## What gets recorded

| IDE event | CLI handoff |
| --- | --- |
| A local project file becomes selected or its project window gains focus | File activity with the observed time |
| The selected editor document changes | One observation per file per 30-second editing window, with the latest observed time |
| The IDE is about to save the selected file | A write observation that supersedes any edit still waiting in that file’s window |

Each CLI invocation includes the file path, timestamp, heartbeat ID, coding category, plugin version and IDE identity (`intellij-idea` or `pycharm`). The plugin does not read document text, infer the author, or calculate duration or changed-line counts. The CLI uses its usual configuration and delivery path.

Project content and foreground checks exclude external files, scratches, library files and inactive project windows. Pending observations live in memory until CLI handoff. Closing the project or disabling tracking discards that project's pending work. On overflow or CLI failure the plugin shows a warning. An observation that the CLI did not accept may be lost.

The initial product allowlist covers IDEA and PyCharm desktop. Other JetBrains products require their own product and file-scope validation before enabling capture. Live IDE capture and signed-in dashboard receipt are separate release checks for each host.
