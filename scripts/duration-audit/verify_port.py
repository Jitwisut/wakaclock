"""Run the exact assertions from activity_timeline.rs's #[cfg(test)] mod tests
against the Python port. If these pass, the port is faithful enough to trust on
real data."""
import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from timeline import (Interval, canonicalize, bridge_idle_gaps_with_anchors,
                      total_seconds)

def iv(i, source, s, e):
    return Interval(i, i, s, e, source, "file", None, None, "coding")

def anchor(i, at):
    return iv(i, "editor", at, at)

def bridge(c, t):
    return bridge_idle_gaps_with_anchors(c, [], t)

fails = []
def eq(name, got, want):
    if abs(got - want) > 1e-9 if isinstance(got, float) else got != want:
        fails.append(f"{name}: got {got!r} want {want!r}")
    else:
        print(f"  ok  {name}")

# idle_bridge_credits_the_pause_to_the_earlier_activity
c = canonicalize([iv("a","editor",0,60), iv("b","editor",360,420)])
eq("canonical=120", total_seconds(c), 120.0)
b = bridge([x for x in canonicalize([iv("a","editor",0,60), iv("b","editor",360,420)])], 900)
eq("bridged=420", total_seconds(b), 420.0)
eq("owner=a", b[0].segment_id, "a")
eq("b[0].end=360", b[0].end, 360.0)
eq("tight timeout=120", total_seconds(bridge(canonicalize([iv("a","editor",0,60), iv("b","editor",360,420)]),120)), 120.0)

# idle_bridge_never_runs_past_the_last_observed_activity
b = bridge(canonicalize([iv("only","editor",0,60)]), 900)
eq("lone=60", total_seconds(b), 60.0)
eq("lone end=60", b[-1].end, 60.0)

# an_anchor_chain_connects_two_bursts_a_timeout_apart
base = [iv("a","editor",0,60), iv("b","editor",1260,1320)]
eq("no anchor=120", total_seconds(bridge(canonicalize(base),900)), 120.0)
eq("with anchor=1320", total_seconds(bridge_idle_gaps_with_anchors(canonicalize(base),[anchor("mid",660)],900)), 1320.0)

# an_isolated_anchor_is_still_worth_nothing
b = bridge_idle_gaps_with_anchors([], [anchor("lone",500)], 900)
eq("isolated anchor=0", total_seconds(b), 0.0)
eq("isolated anchor empty", len(b), 0)

# a_leading_anchor_starts_the_clock
b = bridge_idle_gaps_with_anchors(canonicalize([iv("later","editor",600,660)]), [anchor("first",0)], 900)
eq("leading anchor=660", total_seconds(b), 660.0)
eq("leading owner=first", b[0].segment_id, "first")
eq("leading end=600", b[0].end, 600.0)

# a_trailing_anchor_extends_the_last_run_but_no_further
b = bridge_idle_gaps_with_anchors(canonicalize([iv("a","ai",0,60)]), [anchor("tail",300)], 900)
eq("trailing=300", total_seconds(b), 300.0)
eq("trailing end=300", b[-1].end, 300.0)

# idle_bridge_is_disabled_by_a_zero_timeout
eq("zero timeout=120", total_seconds(bridge(canonicalize([iv("a","editor",0,60), iv("b","editor",360,420)]),0)), 120.0)

# union_deduplicates_overlap_and_prefers_editor
r = canonicalize([iv("ai","ai",0,300), iv("human","editor",120,180)])
eq("union=300", total_seconds(r), 300.0)
eq("prefers editor", next(x for x in r if x.start==120).source, "editor")

print()
if fails:
    print("FAILED:"); [print("  " + f) for f in fails]; sys.exit(1)
print("Python port matches all 8 Rust unit tests.")
