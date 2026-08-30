"""Regression checks that keep timeline.py aligned with activity_timeline.rs.

These cases mirror the Rust duration semantics most likely to drift in a Python
port: idle bridging, heartbeat anchors, human/AI handovers, and projected-row
fallback behavior.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from timeline import (
    Interval,
    bridge_idle_gaps_with_anchors,
    build_intervals,
    canonicalize,
    canonicalize_bridged,
    total_seconds,
    wakatime_durations,
)


def iv(i, source, s, e):
    return Interval(i, i, s, e, source, "file", None, None, "coding")


def anchor(i, at, source="editor"):
    return iv(i, source, at, at)


def bridge(c, t):
    return bridge_idle_gaps_with_anchors(c, [], t)


def seconds_by_source(intervals, source):
    return sum(x.end - x.start for x in intervals if x.source == source)


fails = []


def eq(name, got, want):
    ok = abs(got - want) <= 1e-9 if isinstance(got, float) else got == want
    if not ok:
        fails.append(f"{name}: got {got!r} want {want!r}")
    else:
        print(f"  ok  {name}")


def truth(name, condition, detail=""):
    if not condition:
        fails.append(f"{name}: {detail or 'condition was false'}")
    else:
        print(f"  ok  {name}")


# Base idle-bridge parity with Rust.
c = canonicalize([iv("a", "editor", 0, 60), iv("b", "editor", 360, 420)])
eq("canonical=120", total_seconds(c), 120.0)
b = bridge(canonicalize([iv("a", "editor", 0, 60), iv("b", "editor", 360, 420)]), 900)
eq("bridged=420", total_seconds(b), 420.0)
eq("owner=a", b[0].segment_id, "a")
eq("b[0].end=360", b[0].end, 360.0)
eq("tight timeout=120", total_seconds(bridge(canonicalize([iv("a", "editor", 0, 60), iv("b", "editor", 360, 420)]), 120)), 120.0)

b = bridge(canonicalize([iv("only", "editor", 0, 60)]), 900)
eq("lone=60", total_seconds(b), 60.0)
eq("lone end=60", b[-1].end, 60.0)

base = [iv("a", "editor", 0, 60), iv("b", "editor", 1260, 1320)]
eq("no anchor=120", total_seconds(bridge(canonicalize(base), 900)), 120.0)
eq("with anchor=1320", total_seconds(bridge_idle_gaps_with_anchors(canonicalize(base), [anchor("mid", 660)], 900)), 1320.0)

b = bridge_idle_gaps_with_anchors([], [anchor("lone", 500)], 900)
eq("isolated anchor=0", total_seconds(b), 0.0)
eq("isolated anchor empty", len(b), 0)

b = bridge_idle_gaps_with_anchors(canonicalize([iv("later", "editor", 600, 660)]), [anchor("first", 0)], 900)
eq("leading anchor=660", total_seconds(b), 660.0)
eq("leading owner=first", b[0].segment_id, "first")
eq("leading end=600", b[0].end, 600.0)

b = bridge_idle_gaps_with_anchors(canonicalize([iv("a", "ai", 0, 60)]), [anchor("tail", 300)], 900)
eq("trailing=300", total_seconds(b), 300.0)
eq("trailing end=300", b[-1].end, 300.0)

eq("zero timeout=120", total_seconds(bridge(canonicalize([iv("a", "editor", 0, 60), iv("b", "editor", 360, 420)]), 0)), 120.0)

r = canonicalize([iv("ai", "ai", 0, 300), iv("human", "editor", 120, 180)])
eq("union=300", total_seconds(r), 300.0)
eq("prefers editor", next(x for x in r if x.start == 120).source, "editor")

# Current split-bridge behavior: human/AI handovers count, but belong to neither side.
hand = canonicalize_bridged(
    [iv("human", "editor", 0, 60), iv("agent", "ai", 300, 360)],
    900,
    120,
)
eq("handover total=360", total_seconds(hand), 360.0)
eq("handover human=60", seconds_by_source(hand, "editor"), 60.0)
eq("handover ai=60", seconds_by_source(hand, "ai"), 60.0)
eq("handover other=240", seconds_by_source(hand, "other"), 240.0)

# A handover must not poison previous_source and turn every later event into `other`.
chain = [iv("human", "editor", 0, 60), iv("agent", "ai", 300, 360)]
chain += [anchor(f"a{i}", at, "ai") for i, at in enumerate([660, 960, 1260])]
bridged = canonicalize_bridged(chain, 900, 120)
eq("handover chain total=360", total_seconds(bridged), 360.0)
eq("handover chain other=240", seconds_by_source(bridged, "other"), 240.0)

# A long absence does not advance the clock just because an AI anchor appeared.
absence = canonicalize_bridged(
    [iv("before", "editor", 0, 1560), anchor("away", 5160, "ai"), iv("after", "editor", 5220, 5280)],
    900,
    120,
)
eq("long absence bounded", total_seconds(absence), 1680.0)

# Critical port-regression case: a segment-bearing raw heartbeat still needs an anchor
# at heartbeat.time; otherwise buffered segments can make a WakaTime session look idle.
raw = [{
    "entity": "file.ts",
    "time": 900.0,
    "project": "wakaclock",
    "language": "TypeScript",
    "category": "coding",
    "is_ai_generated": False,
    "heartbeat_id": "hb-buffered",
    "active_seconds": 60.0,
    "activity_segments": json.dumps([{
        "segment_id": "seg-buffered",
        "start": 60.0,
        "end": 120.0,
        "source": "editor",
    }]),
}]
intervals = build_intervals([], raw, 0.0, 1000.0)
truth("segment heartbeat keeps timestamp anchor", any(x.segment_id == "hb-buffered:anchor" and x.start == 900.0 and x.end == 900.0 for x in intervals))
truth("segment heartbeat keeps measured segment", any(x.segment_id == "seg-buffered" and x.start == 60.0 and x.end == 120.0 for x in intervals))

# Same guarantee when the measured interval already came from activity_intervals.
projected = [{
    "segment_id": "projected-seg",
    "heartbeat_id": "hb-projected",
    "start": 100.0,
    "end": 160.0,
    "source": "editor",
    "entity": "file.ts",
    "project": "wakaclock",
    "language": "TypeScript",
    "category": "coding",
}]
raw_projected = [{
    "entity": "file.ts",
    "time": 700.0,
    "project": "wakaclock",
    "language": "TypeScript",
    "category": "coding",
    "is_ai_generated": False,
    "heartbeat_id": "hb-projected",
    "active_seconds": 60.0,
    "activity_segments": "[]",
}]
intervals = build_intervals(projected, raw_projected, 0.0, 1000.0)
eq("projected measured interval once", sum(1 for x in intervals if x.segment_id == "projected-seg"), 1)
truth("projected heartbeat still keeps raw anchor", any(x.segment_id == "hb-projected:anchor" and x.start == 700.0 for x in intervals))

# Bare heartbeat streams must match the WakaTime reference exactly in single-stream mode.
streams = [
    [],
    [100.0],
    [0.0, 120.0, 240.0, 360.0, 480.0],
    [0.0, 120.0, 1010.0, 1130.0, 2040.0],
    [480.0, 0.0, 240.0, 120.0, 360.0],
]
for timeout in [120.0, 300.0, 900.0]:
    for index, times in enumerate(streams):
        ours = total_seconds(canonicalize_bridged([anchor(f"hb{i}", t) for i, t in enumerate(times)], timeout))
        theirs, _ = wakatime_durations([{"time": t} for t in times], timeout)
        eq(f"wakatime parity timeout={timeout} stream={index}", ours, theirs)

print()
if fails:
    print("FAILED:")
    [print("  " + f) for f in fails]
    sys.exit(1)
print("Python duration-audit port matches the current Rust regression semantics.")
