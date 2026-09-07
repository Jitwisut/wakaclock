# F5-03 Gemini CLI inventory — refreshed 2026-09-07

F5-03 is currently survey-blocked. The inventory records what is observable on
this machine and deliberately does not create synthetic Gemini fixtures.

## Local inventory

- Executable present: Gemini CLI `0.58.0` (`gemini --version`).
- The current CLI advertises structured `json` and `stream-json` output,
  `--session-file`, and hook configuration in `gemini --help`. This supersedes
  the earlier assumption that the executable had no structured output mode.
- `gemini extensions list` reports no installed extensions, and
  `gemini auth status` reports that no authenticated account is available.
- The local Gemini history/tmp roots contain project pointers and
  `.project_root` markers, but no authenticated edit transcript was available
  for inspection.
- No Gemini edit run was started. There is therefore no evidence for the
  current `write_file`, replace, multi-file, completion, failure, or shell/MCP
  payload shapes on this machine.

## Current support boundary

The parser and registry entry remain available as an unverified implementation
surface. They must not be promoted or certified from generic parser tests, help
output, or executable presence alone. The existing Gemini fixture directory stays
documentation-only until a real payload can be sanitized.

## Next unblocker

Authenticate Gemini CLI, then run it in a disposable workspace using the
structured output/session path advertised by the installed version. Capture
bounded metadata and record the exact tool, session, completion, path, failure
and multi-file shapes. Then add sanitized fixtures and a live
broker/API/dashboard certification artifact. Until that environment exists,
`survey-blocked` is the honest F5-03 outcome.
