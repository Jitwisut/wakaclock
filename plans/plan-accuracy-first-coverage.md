# Historical plan: accuracy-first coverage

**Status:** superseded by [`ROADMAP.md`](ROADMAP.md); retained as an
implementation reference.

The original phase proposal established the important boundary: transcript
parsing can qualify as verified evidence when the transcript records a concrete
file edit, while filesystem/process inference cannot. It proposed promotion in
this order: Gemini CLI, Kilo Code, Cursor, transcript-backed editor agents, then
remaining CLI agents, with Kimi Code CLI and standalone Deep Code parked until a
real evidence surface exists.

The canonical roadmap narrows the old proposal with two updates:

- diagnostics are now an explicit product surface and never feed production;
- a setup/fixture result cannot promote an adapter to `Verified` without a live
  end-to-end certification artifact.

Use this file for historical context only; update `plans/ROADMAP.md` for current
work.
