"""Prototype: source-aware idle bridging.

Today every source bridges at the same 15-minute timeout, so an agent hook that
fires every few seconds while nobody is at the keyboard bills as continuous work
(docs/duration-accuracy-audit.md, Finding 2).

Proposed: bridge the human-attended stream at the WakaTime timeout, bridge the
agent stream only across its own strict evidence window, then union the two.
"""
import sys, json, datetime, zoneinfo
SP = str(__import__("pathlib").Path(__file__).resolve().parent)
sys.path.insert(0, SP)
from timeline import (build_intervals, canonicalize, canonicalize_bridged,
                      bridge_idle_gaps_with_anchors, total_seconds, union_seconds,
                      wakatime_durations, MAX_ACTIVITY_GAP_SECONDS)
from golden import resolve_attribution

TZ = zoneinfo.ZoneInfo("Asia/Bangkok")
hb  = [json.loads(l) for l in open(f"{SP}/hb.jsonl")]
proj = [json.loads(l) for l in open(f"{SP}/ai.jsonl")]

def hms(s):
    s = int(round(s)); return f"{s//3600}h{(s%3600)//60:02d}m"

def actor_type(row):
    return resolve_attribution(row)["actor_type"]

def attended_bridged(ivs, human_timeout=900.0, agent_timeout=MAX_ACTIVITY_GAP_SECONDS):
    canonical = canonicalize(ivs)
    anchors = [iv for iv in ivs if iv.end <= iv.start]
    pick = lambda xs, human: [x for x in xs if (x.source == "editor") == human]
    human = bridge_idle_gaps_with_anchors(pick(canonical, True), pick(anchors, True), human_timeout)
    agent = bridge_idle_gaps_with_anchors(pick(canonical, False), pick(anchors, False), agent_timeout)
    return human, agent

days = sorted({datetime.datetime.fromtimestamp(h["time"], TZ).date() for h in hb})
print(f"{'day':<12}{'SHIPPED':>9}{'wakatime':>10}{'PROPOSED':>10}{'attended':>10}{'agent':>8}{'wt-human':>10}")
print("-"*72)
tot = [0.0]*6
for d in days:
    s = datetime.datetime.combine(d, datetime.time.min, TZ).timestamp()
    e = datetime.datetime.combine(d + datetime.timedelta(days=1), datetime.time.min, TZ).timestamp()
    day_hb = [h for h in hb if s <= h["time"] < e]
    if not day_hb: continue
    win_hb = [h for h in hb if s - MAX_ACTIVITY_GAP_SECONDS <= h["time"] < e + MAX_ACTIVITY_GAP_SECONDS]
    win_pr = [p for p in proj if p["end"] > s and p["start"] < e]
    ivs = build_intervals(win_pr, win_hb, s, e)

    shipped = total_seconds(canonicalize_bridged(ivs, 900.0))
    wt, _   = wakatime_durations(day_hb, 900.0)
    human, agent = attended_bridged(ivs)
    proposed = union_seconds(human + agent)
    # What WakaTime itself would report if only the editor plugin were installed.
    editor_hb = [h for h in day_hb if actor_type(h) == "human" and h.get("editor") == "vscode"]
    wt_human, _ = wakatime_durations(editor_hb, 900.0)
    row = (shipped, wt, proposed, total_seconds(human), total_seconds(agent), wt_human)
    tot = [t + r for t, r in zip(tot, row)]
    print(f"{str(d):<12}" + "".join(f"{hms(v):>{w}}" for v, w in zip(row, (9,10,10,10,8,10))))
print("-"*72)
print(f"{'TOTAL':<12}" + "".join(f"{hms(v):>{w}}" for v, w in zip(tot, (9,10,10,10,8,10))))
print()
print("SHIPPED  = canonicalize_bridged(900) — every source bridges at 15 minutes")
print("wakatime = WakaTime's builder over the same (mixed) stream, 15-min timeout")
print("PROPOSED = human stream bridged at 15m, agent stream at 120s, unioned")
print("attended/agent = the two halves of PROPOSED before the union (they overlap)")
print("wt-human = WakaTime over the vscode heartbeats only — i.e. what a WakaTime")
print("           user with the same editing behaviour would see on their dashboard")
