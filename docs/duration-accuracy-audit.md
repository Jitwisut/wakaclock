# Duration accuracy audit — heartbeat stream vs reported time

Measured 2026-08-27 against the local ClickHouse instance: 956 real heartbeats
for one user across 14 days (2026-08-12 → 2026-08-27), replayed through a
line-for-line port of `services/activity_timeline.rs` (the port reproduces all
eight of that module's unit tests) and through a reference implementation of
WakaTime's duration builder.

Reproduce: `scripts/duration-audit/` (timeline.py, verify_port.py, ladder.py,
decompose.py, sensitivity.py).

## Phase 0 baseline — single source of truth

The committed acceptance baseline is the synthetic, metadata-only fixture at
[`scripts/duration-audit/golden.jsonl`](../scripts/duration-audit/golden.jsonl)
and its expected-result manifest at
[`scripts/duration-audit/golden.expected.json`](../scripts/duration-audit/golden.expected.json).
Run `verify_port.py` first and then `golden.py`; CI runs the same order. The
runner enforces total error ≤1%, daily error ≤3% for days with at least 60
seconds, partitioning of total/project/actor breakdowns, and exact actor type /
confidence expectations. It also asserts that Unknown evidence cannot enter the
Human bucket.

`hb.jsonl` and `ai.jsonl` remain ignored live exports. Before a release, run the
live comparison against a selected account and record only an aggregate result,
check date, tested commit SHA, actor totals, and errors in
`scripts/duration-audit/certifications/latest.json`; never commit paths, user IDs,
prompts, diffs, or source content. That file is the single current acceptance
baseline. The historical measurements below explain prior findings and are not
acceptance criteria.

## Latest release certification — Phase 0–2 closeout

The latest production-like certification passed on candidate
`5d310ae5f2b76452c166d560e0412e0f282a4683`, checked at
`2026-08-30T19:01:30Z`, for the closed data range `2026-08-12..2026-08-29`.
Total Error was **0.4305%** and the maximum eligible Daily Error was
**2.8595%**. Actor filter error, actor partition error, and duration surface
error were all **0**; `unknown_counted_as_human` was **false**.

The sanitized artifact at
[`scripts/duration-audit/certifications/latest.json`](../scripts/duration-audit/certifications/latest.json)
is the sole latest source of truth for this certification. It contains only
aggregate totals, limits, dates, status, commit SHA, and error metrics; it does
not contain API keys, user IDs, paths, projects, source content, prompts,
responses, or per-heartbeat records. Measurements elsewhere in this document
remain historical findings and are not acceptance baselines.

## Headline

| | |
| --- | --- |
| Activity actually measured by the clients | **2h48m** |
| Time reported by `/status_bar/today`, `/durations`, summaries | **13h18m** |
| Invented by the server-side idle bridge | **10h30m — 79% of the reported number** |

The algorithm is not the problem. Replaying the same heartbeat times through
WakaTime's own duration builder gives **13h16m** — wakaclock is within 0.3% of
WakaTime at every timeout setting once the anchor bug in Finding 0 is fixed
(4% before it). What differs is the *stream*: wakaclock emits far more
heartbeats, from far more sources, than a WakaTime plugin does.

## The ladder, per day

```
day            hb   raw_sum  segments    canon   BRIDGED  wakatime     span  inflate
2026-08-12     59     0h02m     0h02m    0h02m     1h00m     1h00m    1h34m  22.5x
2026-08-13     89     0h03m     0h03m    0h03m     1h59m     1h59m   13h16m  31.5x
2026-08-14     95     0h02m     0h02m    0h02m     1h48m     1h47m    8h45m  46.9x
2026-08-15    185     0h07m     0h03m    0h03m     2h38m     2h38m   15h02m  39.8x
2026-08-16     10     0h03m     0h03m    0h03m     0h04m     0h04m    0h04m   1.4x
2026-08-21     10     0h17m     0h08m    0h08m     0h29m     0h29m    0h29m   3.4x
2026-08-22    189     1h39m     1h10m    1h10m     1h39m     1h39m    1h39m   1.4x
2026-08-23    163     1h13m     0h39m    0h39m     1h26m     1h25m   22h32m   2.2x
2026-08-24     68     0h30m     0h14m    0h14m     1h01m     1h00m   21h25m   4.2x
2026-08-25     33     0h11m     0h11m    0h11m     0h28m     0h29m    0h29m   2.6x
2026-08-26     47     0h09m     0h07m    0h07m     0h40m     0h40m    7h20m   5.3x
TOTAL         956     4h24m     2h48m    2h48m    13h18m    13h16m   96h21m
```

(Numbers are post-fix. Before the Finding 0 fix the BRIDGED column totalled
12h45m, with 2026-08-15 at 2h23m and 2026-08-24 at 0h45m — both days where an
anchor-only session after a break was silently discarded.)

## Finding 0 — anchors could never restart the clock after a break *(fixed)*

`bridge_idle_gaps_with_anchors` skipped every anchor once any run existed:

```rust
if is_anchor {
    // The anchor has done its job by extending the run above. It only opens
    // a run of its own when there is nothing to extend.
    continue;
}
```

"Nothing to extend" was implemented as `result.is_empty()`, not "nothing within
the timeout". So the *first* run of a range could be opened by an anchor, and
after that no anchor ever could — a session that resumed after a longer-than-
timeout break with a bare heartbeat (an editor switch, an agent tool call) was
discarded and the clock never restarted until the next heartbeat that happened to
carry a measured segment.

The heartbeat stream `[0, 120, 1010, 1130, 2040]` at a 120s timeout is worth 240s
to WakaTime (two blocks of 120s) and was worth 120s here. Fixed by pushing the
anchor when it is out of bridging reach; `anchor_only_streams_match_wakatime_exactly`
in that module's tests now pins the whole class.

The fix *raises* reported time — it repaired an under-count, and it is why the
totals above end up slightly higher than WakaTime's rather than lower.

- `raw_sum` — `sum(active_seconds)`, i.e. what `mv_*_summary` writes into
  `daily_totals` / `project_daily` / `language_daily` / `editor_daily` /
  `os_daily` / `insights_agg`.
- `segments` — union of the clamped evidence intervals.
- `canon` — `canonicalize()`, overlap-free, no bridging.
- `BRIDGED` — `canonicalize_bridged(900)`, what every duration endpoint returns.
- `wakatime` — WakaTime's builder over the same heartbeat times, 15-minute timeout.

## Finding 1 — the client and the server disagree about the timeout, by 7.5x

`extensions/vscode/package.json` tells the user, in the settings UI:

- `heartbeatRateLimitSeconds`: *"Gaps above 120 seconds never add time."*
- `idleMinutes`: *"Deprecated compatibility setting. Activity timing always uses
  the fixed 120-second strict gap."*

`config/mod.rs` then sets `DEFAULT_IDLE_TIMEOUT_MINUTES = 15.0`, and
`bridge_idle_gaps_with_anchors` credits every gap up to **900 seconds**. Weighted
by seconds, the real stream splits like this:

```
gap <= 120s   (the only gaps the client counts)     4h11m
gap 120s-5m   (added by the server bridge only)     2h46m
gap 5m-15m    (added by the server bridge only)     6h19m
gap > 15m     (dropped as idle)                    83h04m
```

**9h05m of the 13h18m comes from gaps the client's own documentation says are
never counted.** This is a product decision that was made in the server and never
propagated to the client contract, not a coding error.

## Finding 2 — the AI agent hook turns an unattended agent run into coding time

`extensions/ai-agents/plugins/atoaxis-heartbeat/hooks/hooks.json` fires on
**every** `PostToolUse` for Write/Edit/MultiEdit/NotebookEdit. The resulting
heartbeat carries no `active_seconds`, so `intervals()` records it as a
zero-length anchor, and the 15-minute bridge then fills the entire wall-clock
span between consecutive tool calls.

```
emitter                       heartbeats   zero-duration anchors
wakaclock-ai-sync (ai)               470                     228
vscode                               386                      36
Apple_Terminal (ai)                   97                      75
wakaclock-cli (ai)                     3                       1
```

59% of the stream is agent-emitted. Replaying agent heartbeats alone, with no
editor heartbeats at all, produces **8h06m** of billable coding time over the
14 days. An autonomous Claude Code run with nobody at the keyboard bills as
continuous work — that is the "clock jumps while I do nothing" symptom.

## Finding 3 — idle-timeout sensitivity

```
   timeout   wakaclock  wakatime-ref  human only   ai only
       off       2h48m         0h00m       1h10m     2h13m
        2m       5h13m         4h11m       2h40m     3h21m
        5m       7h16m         6h57m       3h52m     4h37m
       10m      10h49m        10h24m       6h19m     6h39m
       15m      13h18m        13h16m       7h58m     8h06m   <- shipped
```

wakaclock tracks the WakaTime reference closely at every setting, confirming the
timeline math is WakaTime-compatible. It reads slightly high because
client-measured segments prove time *before* a heartbeat that WakaTime never
sees — that is the one place wakaclock legitimately knows more.

Note that agent heartbeats alone are worth 8h06m and editor heartbeats alone
7h58m, but the combined total is 13h18m, not 16h04m: the two streams overlap for
about 2h44m. Reporting them as separate figures without saying so would double-
count.

## Finding 4 — two different duration algorithms on the same dashboard *(fixed)*

The grand total and the per-project/per-language breakdown of the same day are
computed by unrelated code paths:

| Surface | Source | Algorithm |
| --- | --- | --- |
| `summaries[].grand_total`, `/durations`, `/status_bar/today`, `/stats` totals | `heartbeats` + `activity_intervals` | `canonicalize_bridged` — overlap-free union, 900s bridge, per-heartbeat evidence clamped to 120s |
| `summaries[].projects/languages/editors/operating_systems`, `insights` | `project_daily` etc. via `mv_*_summary` | `sum(active_seconds)` — no union, no bridge, **no clamp** |

They cannot agree. Over the 14 days the MV path reports 4h24m against the
canonical path's 2h48m of the same evidence, and 13h18m as the headline.

The clamp is the sharpest part: `HeartbeatService::process_heartbeats` clamps
`active_seconds` to 120s when building `activity_intervals`, but stores the
**unclamped** value on the `heartbeats` row, which is exactly what the MVs sum.
24 rows in the sample claim more than 120s, up to 845s, contributing 5475s of
excess that only the MV-backed surfaces see.

Measured against the running API for this user over 30 days, the disagreement was
roughly threefold:

```
grand total  (canonicalize_bridged)   49140s   13h39m
breakdown    (*_daily MVs)            16472s    4h35m
```

**Fix.** `SummaryService` and `StatsService` now build one canonical timeline per
request and derive every figure from it — total, per-day, best day, and the
language / project / editor / OS / category breakdowns — through the shared
`Dimension` + `totals_by` helpers in `activity_timeline.rs`. `ActivityInterval`
now carries `editor` and `operating_system` (additively added to
`activity_intervals` too) so those two breakdowns can come from the timeline at
all. Re-measured against the API afterwards, every breakdown sums to its total to
the microsecond, and `StatsService` builds the timeline once instead of three
times.

`every_breakdown_sums_to_the_total` in `activity_timeline.rs` pins the invariant.

**Still on the aggregate tables**, and therefore still disagreeing:
`account_analytics`, `dashboard_analytics`, `project_analytics`, `insights`,
`projects`, `goals`. Those were out of scope for this pass; the same
`totals_by` helper is what they need.

## Finding 5 — aggregate drift (minor)

`daily_totals` for 2026-08-23 holds 1967.66s / 44 heartbeats; recomputing from
`heartbeats` gives 1457.66s / 42. `SummingMergeTree` rows survive deletion of the
source heartbeats, so any repair or manual delete leaves the aggregate
permanently high. `ReprocessService` does `ALTER TABLE ... DELETE` on the
aggregate before re-inserting, so reprocessing is not the cause here, but nothing
reconciles the two on the normal path.

Also historical: every heartbeat before 2026-08-23 has `heartbeat_id = NULL`
(1204 of 1372 rows), so ingest-time idempotency cannot apply to them and read-time
dedup falls back to `entity + time`. Rows from 2026-08-23 onward all carry IDs.

## Better than WakaTime — the evidence split *(shipped)*

Matching WakaTime is done. The improvement is that wakaclock knows something
WakaTime does not: which seconds are *proven* and which are *inferred*, and which
are attended by a human versus produced by an agent. `EvidenceSplit` now rides
alongside `total_seconds` on `/status_bar/today`, `/summaries` (per day) and
`/stats` (per range):

```json
"evidence": {
  "proven_seconds": 10209.6,
  "inferred_seconds": 38930.7,
  "attended_seconds": 34725.1,
  "agent_seconds": 14415.3,
  "other_seconds": 0.0
}
```

`proven + inferred` and `attended + agent + other` are each a partition of
`total_seconds`; `the_evidence_split_partitions_the_total_twice` pins both.
`total_seconds` keeps its WakaTime meaning, so the addition is backwards
compatible and the TypeScript fields are optional.

A live example from a session where the agent did the work and the developer
watched — 12 minutes on the clock, 2 minutes of it measured, essentially none of
it attended:

```
total     723.9
proven    117.5   inferred  606.4
attended    0.1   agent     723.8
```

## Re-measured 2026-08-28 — against the running API, split bridge active

The numbers above were replayed in Python. This pass asks the **live server** for its
own figures and compares them to the WakaTime reference over the same stream, so it
measures the product rather than a model of it. Reproduce:

```bash
./export.sh <user-uuid>
WAKACLOCK_API_KEY=... python3 compare_api.py
```

962 heartbeats, 2026-08-12 → 2026-08-27, UTC days:

```
day            hb  API total  wakatime   delta   proven  inferred  attended    agent  agent%
2026-08-12     83      1h14m     1h14m      0%    0h21m     0h53m     1h14m    0h00m      0%
2026-08-13     65      1h46m     1h46m      0%    0h30m     1h16m     1h46m    0h00m      0%
2026-08-14    267      2h36m     4h25m    -41%    0h44m     1h51m     1h59m    0h36m     24%
2026-08-21     10      0h29m     0h29m      1%    0h08m     0h21m     0h29m    0h00m      0%
2026-08-22    337      2h18m     2h53m    -20%    0h39m     1h38m     0h37m    1h40m     73%
2026-08-23     42      0h27m     0h49m    -45%    0h07m     0h19m     0h19m    0h07m     29%
2026-08-24     74      0h30m     0h52m    -43%    0h08m     0h21m     0h20m    0h09m     32%
2026-08-26     56      0h27m     0h54m    -49%    0h07m     0h19m     0h27m    0h00m      0%
TOTAL         962      9h59m    13h38m    -27%    2h50m     7h09m     7h21m    2h38m     26%
```

**wakaclock now reports 27% less than WakaTime would on the same stream, and the
difference is entirely unattended agent time.** On days with no agent activity the two
agree to the percentage point — 0% on 08-12, 08-13 and 08-16, 1% on 08-21 — which is the
parity claim from Finding 3, still holding. Every day that diverges is a day an agent ran.

### Finding 6 — the split bridge was written but never restarted into

The server process answering requests during the first audit had started **before** the
`bridge_by_attendance` code was built. It was serving the single-stream path, which is
why `attended_seconds` read 4h11m on 2026-08-14 — a figure larger than the entire
editor-only stream can produce (1.98h, measured by gap band). Under one timeline
`bridge_idle_gaps_with_anchors` extends whichever interval came *before* a gap regardless
of source, so an editor interval was being stretched to reach an agent heartbeat and the
inferred seconds were then attributed to the editor. Attended absorbed agent-justified
gaps.

Restarting onto the current build moved the total from 13h39m to 9h59m and `attended` to
7h21m, which matches the editor-stream ceiling (7h35m) as it must.

Nothing in this finding required a code change. It is recorded because the symptom —
attended time exceeding what the human stream can support — is the fastest way to detect
that a deployment is running a stale binary.

### Finding 7 — where the inferred seconds actually come from *(open, by design)*

Weighted by seconds, over the whole sample, for **editor** heartbeats only:

```
gap <= 120s   (the client measures these itself)   1.90h
gap 120s-5m   (added by the idle bridge)           1.49h
gap 5m-15m    (added by the idle bridge)           3.96h
gap > 15m     (dropped as idle)                       0
```

**5.45h of the 7.35h human total — 74% — is inference, and 3.96h of it comes from just 27
gaps.** That is roughly nine minutes credited per gap: touch the editor, leave for nine
minutes, come back, and the pause bills as work.

This is not a bug. It is WakaTime's model, reproduced faithfully, and it is the honest
answer to "why does the clock jump when I only worked a moment". A gap is credited at
full value regardless of how much evidence brackets it — two one-second cursor twitches
fourteen minutes apart are worth the same fourteen minutes as two heavy typing bursts.

`total_seconds` keeps that meaning for compatibility. What changed is that the dashboard
no longer reports it without context: `EvidenceSplitPanel` renders the measured/inferred
and human/agent partitions next to the total, so the composition of the number is visible
on the same screen as the number.

Tightening the bridge itself — crediting a gap in proportion to the evidence around it
rather than at face value — remains open. It is a new algorithm and belongs behind its
own measurement, not folded into a compatibility fix.

## Finding 4, continued — the clamp moved to the write path *(fixed)*

`active_seconds` was stored on the heartbeat row **unclamped** while `activity_intervals`
stored the clamped value. Every `mv_*_summary` sums the row, so the aggregate surfaces
and the duration surfaces measured different things by construction. 23 rows in the
sample claimed more than 120s, up to 845s, for 5474s of excess visible only to the MV
path.

`clamp_to_evidence_window` in `services/heartbeat.rs` now produces the segments and the
stored figure from one place, and the stored value is the **union** of the accepted
segments — so two emitters reporting the same file over the same seconds (the editor and
an agent hook, which happens constantly) contribute that second once rather than twice.
The client's original claim is preserved in a new additive `active_seconds_claimed`
column rather than overwritten; no historical row was rewritten or deleted.

Six tests in that module pin the behaviour, including the union case and the
"heartbeat that proves nothing is still a heartbeat" anchor case.

**Still on the aggregate tables**, and therefore still summing rather than unioning:
`account_analytics`, `dashboard_analytics`, `project_analytics`, `insights`, `projects`,
`goals`. They now sum a clamped number instead of a raw claim, which removes the worst of
the disagreement, but only the shared `totals_by` helper will make them agree exactly.

## Finding 8 — the split is about attribution, not about lowering the number *(fixed)*

The first pass shipped `AGENT_IDLE_TIMEOUT_MINUTES` defaulting to 2 minutes, on the
reasoning that an agent hook fires on a cadence no human controls. That reads **27% below
WakaTime**, which is a large unexplained gap for a product whose contract is WakaTime
compatibility.

Sweeping the knob against the running API over the same 962 heartbeats:

```
AGENT_IDLE_TIMEOUT   API total   wakatime   delta   attended    agent
off (one timeline)      13h39m     13h38m      0%      9h38m    4h00m
15m (= human timeout)   13h27m     13h38m     -1%      7h21m    6h05m   <- default
10m                     12h24m     13h38m     -9%      7h21m    5h02m
 5m                     10h54m     13h38m    -20%      7h21m    3h32m
 2m                      9h59m     13h38m    -27%      7h21m    2h38m
```

Two things fall out, and the second is the important one.

**The split earns its keep at any timeout.** Compare `off` with `15m`: the totals are
within 12 minutes of each other, but `attended` moves from 9h38m to 7h21m. The editor
stream cannot support 9h38m — its own gap bands cap it at 7h35m. On one timeline
`bridge_idle_gaps_with_anchors` extends whichever interval precedes a gap regardless of
who emitted it, so an editor interval was being stretched to reach an agent heartbeat and
the inferred seconds were then labelled human. Partitioning the streams first is what
fixes that, and it is independent of what the timeouts are set to.

**Lowering the agent timeout is a separate, optional policy.** It answers "should an
unattended overnight agent run bill as work?" — a real question, but not one that should
be answered silently in a default that also moves the headline 27%.

So the default is now the human timeout: `AGENT_IDLE_TIMEOUT_MINUTES` unset follows
`IDLE_TIMEOUT_MINUTES` rather than a constant, which keeps the total WakaTime-compatible
(−1%) **and** keeps human and agent seconds honestly separated. Deployments that want the
stricter behaviour set the number explicitly; `0` lets agent activity contribute only its
measured evidence, and `off` returns to one timeline and gives up the attribution with it.

Per-day at the new default, every day with meaningful time is within a few percent:

```
day            hb  API total  wakatime   delta   attended    agent  agent%
2026-08-12     83      1h14m     1h14m      0%      1h14m    0h00m      0%
2026-08-13     65      1h46m     1h46m      0%      1h46m    0h00m      0%
2026-08-14    267      4h25m     4h25m      0%      1h59m    2h26m     55%
2026-08-21     10      0h29m     0h29m      1%      0h29m    0h00m      0%
2026-08-22    337      2h52m     2h53m     -0%      0h37m    2h14m     78%
2026-08-23     42      0h39m     0h49m    -20%      0h19m    0h20m     51%
2026-08-24     74      0h52m     0h52m     -0%      0h20m    0h31m     61%
2026-08-26     56      0h52m     0h54m     -3%      0h27m    0h24m     47%
TOTAL         962     13h27m    13h38m     -1%      7h21m    6h05m     45%
```

2026-08-23 is the one day still meaningfully below WakaTime: agent and editor heartbeats
interleave there such that the streams, bridged apart, leave a gap that one timeline would
have spanned. That is the split working as designed, not drift.

Five tests in `config/mod.rs` pin the default, the override, `0`, `off`, and the
fail-at-boot behaviour for a malformed value.

## Finding 9 — bridging the streams apart dropped every human/agent handover *(fixed)*

Finding 8 left the totals at −1% overall but −20% on 2026-08-23 and −3% on 2026-08-26,
and called that "the split working as designed". It was not. It was a second defect.

`bridge_by_attendance` partitioned the canonical intervals into a human timeline and an
agent timeline and bridged each independently. Neither timeline could see the other, so a
pause that *spanned* the two — the developer typing, then Claude Code editing, then the
developer picking it back up — was invisible to both and dropped. Decomposing 2026-08-23
shows the whole 10-minute shortfall is exactly two such gaps:

```
18:34:55  gap=  42s  editor(anchor) -> ai(interval)
18:49:07  gap= 605s  ai(anchor)     -> editor(anchor)
```

That is the single most common shape of modern agent-assisted work, and it was the one
shape the algorithm could not represent.

### The fix: one timeline, a per-gap timeout

`bridge_by_attendance` now walks the combined event stream once and picks the allowance
from **who sits on each side of the pause**:

- a human on *either* side → `idle_timeout_seconds`. A developer reading agent output or
  prompting after it finishes is attended work.
- agent on *both* sides → `agent_idle_timeout_seconds`. This is the unattended-run case
  the short allowance exists to catch, and it still catches it.

### The handover belongs to neither side

Crediting the pause is only half of it. A single timeline extends whichever interval came
*first*, which silently labels a handover with that source — and that is precisely what
made `attended` read 9h38m against an editor stream that can only support 7h21m.

So a cross-source pause now becomes its own interval with `source = "other"`, inheriting
the preceding interval's project/language/editor/OS so every breakdown still sums to the
total. `EvidenceSplit.other_seconds` stops being permanently zero and starts carrying real
meaning; the dashboard renders it as **"You + agent"**.

### Measured against the running API

```
day            hb  API total  wakatime   delta   attended    agent    other
2026-08-12     83      1h14m     1h14m      0%      1h14m    0h00m    0h00m
2026-08-13     65      1h46m     1h46m      0%      1h46m    0h00m    0h00m
2026-08-14    267      4h25m     4h25m      0%      0h43m    0h14m    3h27m
2026-08-21     10      0h29m     0h29m      1%      0h29m    0h00m    0h00m
2026-08-22    337      2h54m     2h53m      1%      0h28m    2h17m    0h08m
2026-08-23     42      0h49m     0h49m      0%      0h16m    0h20m    0h13m
2026-08-24     74      0h52m     0h52m     -0%      0h19m    0h29m    0h03m
2026-08-26     56      0h52m     0h54m     -3%      0h26m    0h12m    0h13m
TOTAL         962     13h39m    13h38m      0%      5h50m    3h41m    4h07m
```

**Every day with meaningful time is now within 3% of WakaTime, agent-heavy days included**
— 2026-08-22 is 79% agent activity and lands at 1%. Both evidence partitions and the
language/project/editor/OS breakdowns all sum to the total exactly.

This is the "same as WakaTime, then better" position stated properly. The total is
WakaTime's number. What WakaTime cannot tell you, and this now does, is that of the 13h39m
only 5h50m was you alone, 3h41m was an agent working, and 4h07m was the two of you
handing work back and forth.

Five tests in `activity_timeline.rs` pin it: the handover is credited, it is attributed to
neither side, an unattended agent chain is still capped, a human on either side earns the
human timeout, and the attribution partition stays whole. The pre-existing WakaTime parity
tests (`anchor_only_streams_match_wakatime_exactly`,
`measured_segments_only_ever_add_to_the_wakatime_number`) and
`every_breakdown_sums_to_the_total` all still pass unchanged.

### What the agent timeout means now

`AGENT_IDLE_TIMEOUT_MINUTES` no longer chops up mixed sessions, so it can be lowered
without the collateral damage Finding 8 measured. At the default (follow the human
timeout) the product reports WakaTime's number. Lowered, it only ever shortens pauses that
have **no human on either side** — which is the question it was always meant to answer.

## Finding 10 — shell edits were invisible to AI attribution *(fixed)*

Over a 90-minute session in which an agent edited roughly twenty files in this
repository, `wakaclock.heartbeats` recorded **zero** agent heartbeats. The pipeline was
healthy: invoking the hook by hand inserted a row immediately.

`hooks.json` matched `Write|Edit|MultiEdit|NotebookEdit`, and `heartbeat.sh` reads
`tool_input.file_path`, which only those tools provide. An agent editing through the
shell — `sed -i`, a heredoc, `python3 - <<EOF`, `git apply`, a codemod script — matches no
entry and carries no such field.

This is not a rare path. Claude Code is *instructed* to prefer shell edits whenever
bypass-permissions mode is active, so in exactly those sessions AI attribution recorded
nothing, silently. Anything the developer happened to have open in VS Code was still
caught by the editor extension; anything else was lost.

**Fix.** Shell/MCP hooks now bracket the tool with `wakaclock ai tool-before` and
`wakaclock ai tool-after` instead of parsing command text or relying on a post-only mtime
sweep. `tool-before` writes a metadata-only workspace fingerprint into the existing local
AI-attribution SQLite database; `tool-after` loads that exact snapshot after a restart if
necessary, compares the resulting workspace, and emits only changes that happened during
that tool call. No prompt, response, shell command, patch body or source text is persisted.

The snapshot engine is deliberately conservative:

- clean tracked Git files reuse their index blob IDs, while dirty/untracked files are
  content-hashed; ignored files remain excluded by Git;
- non-Git workspaces are supported with filesystem SHA-256 snapshots and dependency/build
  directory exclusions;
- create, modify, delete and one-to-one pure rename are detected from before/after content
  identity, including files that were already dirty before the AI tool started;
- exact line deltas are emitted only when they can be proven. A clean tracked Git file can
  use `git diff --numstat`, while a pre-existing dirty file remains `unknown` rather than
  inheriting the developer's earlier changes;
- every file event from one tool call shares `ai_change_id = tool_event_id`, and only the
  first deterministic heartbeat carries the tool-call activity interval. A codemod touching
  100 files therefore does not multiply duration by 100;
- an exact stronger native-hook fingerprint suppresses the weaker inferred shell event;
- missing BeforeTool evidence never becomes guessed AI attribution. Abandoned snapshots are
  retained for retry across process/editor restarts and pruned after 24 hours.

On the current dirty WakaClock worktree (1,967 candidate files), the optimized snapshot
measured about 1.05s for BeforeTool and 0.10s for a no-change AfterTool, both comfortably
inside the 10-second hook budget. Clean release worktrees avoid hashing dirty candidates
and are expected to be cheaper. The legacy post-only `heartbeat-sweep.sh` remains only for
previously installed plugin compatibility.

### Second cause, same silence — a 402 nobody saw

Independently, `trial_ends_at` had passed on 2026-08-27 03:09, so `POST /heartbeats`
returned `402` for every client. The CLI queues a rejected heartbeat and retries, and
nothing surfaced the rejection: 16 rows sat in `~/.wakaclock/queue.db` while the dashboard
showed a quiet day. An expired entitlement and a broken hook look identical from the
dashboard, which is the real gap — **a client whose heartbeats are being refused should
say so somewhere the developer will see it.** That remains open.

## Finding 11 — a refused heartbeat looked exactly like an idle day *(fixed)*

Finding 10 left this open, and it is the more important half. When `POST /heartbeats`
returned `402`, `ApiClient::send_heartbeats` pushed the payload onto the offline queue and
returned the reason in `SendReport.error`. Every caller that matters throws that away — the
agent hooks end their CLI invocation with `>/dev/null 2>&1 || true` on purpose, so a
tracking failure can never break the tool call it is observing. Nothing was written down,
so nothing could be shown.

Three separate things then conspired to keep it invisible:

1. **Reading still worked.** `GET /status_bar/today` is not entitlement-gated, so the
   editor's refresh succeeded and took the *success* branch. The `subscription-required`
   state existed but was only reachable from the `catch` block.
2. **`queued_seconds` is scoped to today.** A backlog refused yesterday contributes zero,
   so the `offline-queued` branch did not fire either.
3. **Nothing recorded the reason.** Even a developer who suspected something could only
   see a queue depth, never *why* it was not draining.

The result: 16 heartbeats sat in `~/.wakaclock/queue.db` for a day and a half while the
status bar showed a plain clock and the dashboard showed a light day.

**Fix.**

- `ApiClient` persists the last refusal to `~/.wakaclock/last-delivery-failure.json`
  (`{at, message}`) and deletes it as soon as any send — including a queue flush —
  succeeds. Clearing on flush matters: a warning that outlives the outage trains the
  developer to ignore it.
- `wakaclock today` reports `Queued heartbeats` (queue *depth*, across every day, not
  today's seconds) and a one-line `Delivery:` verdict that starts with `REFUSED` when the
  server is turning heartbeats away.
- The VS Code status bar reads both, turns amber, and raises a notification once per
  outage: *"AtoAxis is not recording your time: REFUSED — … N heartbeat(s) are held
  locally."* The tooltip carries the same detail.

Verified end to end: pointing the CLI at a dead port records the refusal and surfaces it
in `today`; a subsequent successful heartbeat clears it and the warning disappears.

## Finding 12 — two under-counts behind "I came back and the clock jumped" *(fixed)*

Reported symptom: 26 minutes on the clock, a long absence, and 36 minutes on return.

### Cause A — the handover bucket chained into itself

`bridge_by_attendance` reads the preceding source off `result.last()`. When an anchor is
absorbed into a bridge the loop `continue`s, leaving the synthetic `other` row at the end
of `result` — so the next iteration compared against `"other"`, which matches no real
source, and minted another handover block. One handover degraded every later event into
another, and a chain of isolated heartbeats walked the clock forward in `other` blocks.
`is_attended("other")` is also false, so an agent chain could never be recognised again
either.

Observed live: three `other` blocks totalling 15 minutes built from a handful of isolated
heartbeats while nobody was at the keyboard.

Fixed by tracking the last *real* event's source in its own variable rather than reading
it back off a synthetic row. `a_handover_does_not_turn_every_later_event_into_another_handover`
and `returning_after_a_long_absence_adds_nothing_for_the_absence` pin it.

### Cause B — a heartbeat's own timestamp was discarded whenever it carried a segment

This one was costing time on **every** day, in the other direction.

The editor buffers activity and flushes it later, so a segment routinely describes a
window that closed minutes before the heartbeat carrying it was sent:

```
heartbeat 06:03:21  ->  segment 06:00:58 - 06:01:12
heartbeat 06:01:11  ->  segment 06:00:56 - 06:00:58
heartbeat 06:17:44  ->  no segment
```

`intervals()` only emitted a timestamp anchor when a heartbeat had *no* segments. So the
timeline's last evidence was 06:01:12, the following gap was measured from there rather
than from 06:03:21, and it crossed the idle timeout and ended the session early. The day
reported 8m where WakaTime — which reads heartbeat timestamps — said 24m.

A heartbeat proves the developer was present at its own instant regardless of what its
segments cover. Every heartbeat now contributes a zero-length anchor at `row.time`, in
addition to its segments. Anchors add no duration by themselves; they only let
`bridge_idle_gaps` reach, which is precisely what a WakaTime heartbeat does.

### Effect

```
day        before   after   wakatime
2026-08-24  0h52m   0h53m      0h52m
2026-08-26  0h52m   0h54m      0h54m
2026-08-28  0h08m   0h25m      0h24m
TOTAL      13h47m  14h06m     14h03m
```

**Every day with meaningful time is now within 3% of WakaTime, and most are 0-1%.**

The reported scenario resolves correctly: 24.9 minutes of work, a 57-minute absence
credited with nothing, 20 seconds on return — 25 minutes total, not 36.

### A note on how this was found, and on test hygiene

The 36-minute figure was partly an artifact of this investigation: six probe heartbeats
injected into the live account while testing earlier fixes acted as bridge stepping-stones
and manufactured roughly 25 minutes of `other`. They were removed (with the matching
`activity_intervals` rows) after which the day read 8m and Cause B became visible.

Two lessons worth keeping: **probe writes belong in a throwaway account, not the one whose
numbers are under audit**, and `ALTER TABLE ... DELETE` on `heartbeats` does not touch the
`SummingMergeTree` aggregates — `daily_totals` still holds 752s for that day against 523s
of surviving heartbeats. That is Finding 5, still open, and it is why the MV-backed
surfaces need moving onto `totals_by`.

`scripts/duration-audit/compare_api.py` is the regression check for this whole class:
it asks the running server for its own numbers and compares them to the WakaTime reference
over the identical stream, so an under-count like Cause B shows up as a per-day delta.

## Finding 4, closed for the project pages *(fixed)*

`/projects/analytics` and `/projects/:id/analytics` were the last high-traffic surfaces
still reporting `sum(active_seconds)`. Measured against `/summaries` over the same range
they read **57% low**.

Duration now comes from the canonical timeline; everything else on those responses — line
counts, token spend, last activity — stays on the repository, because those genuinely are
per-heartbeat sums. Summing `active_seconds` is only wrong for *time*: it double-counts a
second the editor and an agent hook both reported, and it credits none of the idle
bridging the dashboard's own total is built from.

### `project_id` had to reach the timeline first

`ActivityInterval`/`CanonicalInterval` carried a project *name*; the project pages key on
the stable id. `project_id` was added to both, to `activity_intervals` (additively, as
`editor`/`operating_system` were before it), and to the ingest path.

That alone was not enough, and the measurement said so: keyed on the id, the page reported
**6h03m against 14h06m**. `activity_intervals` gained the column long after the table
existed, so all 147 historical rows carry NULL, and 303 of 992 heartbeats have no id
either. A display name is present on 97%.

So each interval is counted once — under its id when it has one, under its name when it
does not — and a project sums both buckets. `ProjectSeconds` in `services/project_analytics.rs`
holds that rule with the reason next to it.

### The headline total is the canonical total, not the sum of the rows

The remaining 2% was activity with no resolvable project at all. The aggregate query only
returns projects with an id, so no row can carry that remainder, and summing the rows made
the page read short. `totals.total_seconds` is now the canonical grand total; the rows are
the resolvable breakdown of it.

### Measured after

```
/summaries (dashboard)     14h06m   50815s
/stats/last_30_days        14h06m   50815s
/projects/analytics        14h06m   50815s     <- was 6h03m
```

Project detail agrees with itself and with the list, to the second:

```
list card (wakaclock)      12h01m
project_seconds            12h01m   delta 0s
all_projects_seconds       14h06m   delta 0s vs the dashboard
languages sum              12h01m   delta 0s vs project_seconds
```

WakaTime parity is unchanged at 0% overall, every day within 3%.

### Still open

- **A branch filter cannot use the timeline.** `activity_intervals` carries no branch, so
  `?branch=` views keep the aggregate figure and remain a known disagreement. Closing it
  means carrying branch on the interval, the same additive move `project_id` just made.
- **`account_analytics::publish_snapshot`** (8 sites) and `insights` / `goals` are still on
  the aggregate tables.
- **Finding 5 is unchanged**: `ALTER TABLE ... DELETE` on `heartbeats` leaves the
  `SummingMergeTree` rows behind, so `daily_totals` can drift above the surviving
  heartbeats and nothing reconciles them.

## Finding 4, closed *(fixed)*

Every duration surface now reads the canonical timeline. Measured against `/summaries`
over the same range, to the second:

```
surface                        total    delta
/summaries (reference)        14h06m       0s
/stats/last_30_days           14h06m       0s
/projects/analytics           14h06m       0s
/projects                     14h06m       0s
/insights/languages           14h06m       0s
/insights/projects            14h06m       0s
/insights/editors             14h06m       0s
/insights/operating_systems   14h06m       0s
```

WakaTime parity is unchanged at 0% overall.

### `branch` joined `project_id` on the interval

A branch-filtered project view was the one case that still had to fall back to
`sum(active_seconds)`. `branch` was added to `ActivityInterval`/`CanonicalInterval`, to
`activity_intervals` (additively), and to the ingest path, so those views are now built
from the same seconds as the unscoped ones. `all_projects_seconds` stays deliberately
unscoped — it is the denominator for "how much of your time went here", and shrinking it
with the filter would make the ratio meaningless.

### What moved

| Surface | Was | Now |
| --- | --- | --- |
| `/projects/analytics`, `/projects/:id/analytics` | `sum(active_seconds)` on `heartbeats` | canonical timeline |
| `/projects` | `sum(total_seconds)` on `project_daily` | canonical timeline; merges applied in Rust |
| `/insights/:type/:range` | `sum(total_seconds)` on `insights_agg` | canonical timeline, all five dimensions |
| Goal progress (`time`, `ai_time`, `manual_time`) | `sum(total_seconds)` on `daily_totals` | canonical timeline |
| `/stats/all_time`, `/insights/*/all_time` date span | `min/max(date)` on the rollups | `heartbeats` |

`ai_time` and `manual_time` goals now split on the interval's own source, which is the
same attribution the evidence split reports — a goal and the dashboard can no longer
disagree about which seconds were the developer's.

The heartbeat-count goal metric stays on SQL: that one genuinely is a row count.
Line counts, token spend and `last_activity` stay on the repository for the same reason.
**Summing `active_seconds` is only ever wrong for time** — it counts a second twice when
the editor and an agent hook both report it, and it credits none of the idle bridging the
reported total is built from.

### Finding 5, reduced rather than solved

`SummingMergeTree` rows still survive deletion of their source heartbeats, and nothing
reconciles them. What changed is the blast radius: no duration surface reads those tables
any more, and the two remaining reads of them — the all-time date span in `stats` and
`insights` — were moved to `heartbeats`, because a repaired aggregate could otherwise
report a range extending past any surviving activity.

`daily_totals`, `language_daily`, `editor_daily`, `os_daily`, `project_daily` and
`insights_agg` are now written but never read for duration. They should either be dropped
or given a reconciliation job; leaving them in place as a second, drifting definition of
the same numbers is what caused this finding in the first place.

### `account_analytics::publish_snapshot` — measured, then left alone

Its 8 `sum(active_seconds)` sites build the versioned projection tables
(`project_file_daily`, `project_branch_daily`, `project_language_daily`, `machine_daily`,
`member_daily`). Grepping for readers found none: they are written by the snapshot builder
and queried by nothing, and the only route touching this path is `POST /analytics/rebuild`.

Converting them would be a different shape of work — they are pure `INSERT ... SELECT`
batch jobs, not live reads — for no user-visible effect today. They also now sum the
clamped, unioned `active_seconds` that Finding 4 put on the heartbeat row, so they are
building on a better number than before. Recorded as deliberately out of scope rather than
silently skipped.
