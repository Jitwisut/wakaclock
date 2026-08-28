import sys, json, datetime, zoneinfo, collections
SP = str(__import__("pathlib").Path(__file__).resolve().parent)
sys.path.insert(0, SP)
from timeline import (build_intervals, canonicalize_bridged, total_seconds,
                      canonicalize, union_seconds, MAX_ACTIVITY_GAP_SECONDS)

TZ = zoneinfo.ZoneInfo("Asia/Bangkok")
hb   = [json.loads(l) for l in open(f"{SP}/hb.jsonl")]
proj = [json.loads(l) for l in open(f"{SP}/ai.jsonl")]

def hms(s):
    s=int(round(s)); return f"{s//3600}h{(s%3600)//60:02d}m"

# ---- 1. who owns the bridged seconds, and how much of it is pure bridge ----
by_src   = collections.Counter()
by_editor= collections.Counter()
evidence = 0.0; bridged_total = 0.0
gap_hist = collections.Counter()

days = sorted({datetime.datetime.fromtimestamp(h["time"], TZ).date() for h in hb})
for d in days:
    s = datetime.datetime.combine(d, datetime.time.min, TZ).timestamp()
    e = datetime.datetime.combine(d+datetime.timedelta(days=1), datetime.time.min, TZ).timestamp()
    win_hb = [h for h in hb if s-120 <= h["time"] < e+120]
    win_pr = [p for p in proj if p["end"] > s and p["start"] < e]
    ivs = build_intervals(win_pr, win_hb, s, e)
    canon = canonicalize(ivs)
    br    = canonicalize_bridged(ivs, 900.0)
    evidence      += total_seconds(canon)
    bridged_total += total_seconds(br)
    for iv in br:
        by_src[iv.source] += iv.end - iv.start

    # gap histogram between consecutive heartbeats inside the day
    ts = sorted(h["time"] for h in hb if s <= h["time"] < e)
    for a,b in zip(ts, ts[1:]):
        g = b-a
        if   g <= 120:  gap_hist["<=120s (client counts it)"] += g
        elif g <= 300:  gap_hist["120s-5m  (server bridge only)"] += g
        elif g <= 900:  gap_hist["5m-15m   (server bridge only)"] += g
        else:           gap_hist[">15m     (idle, dropped)"] += g

print("=== where the reported time comes from ===")
print(f"proven evidence (canonicalize)      {hms(evidence):>10}")
print(f"reported (canonicalize_bridged 900) {hms(bridged_total):>10}")
print(f"invented by the idle bridge         {hms(bridged_total-evidence):>10}"
      f"   ({(bridged_total-evidence)/bridged_total*100:.0f}% of the reported number)")
print()
print("=== reported seconds by owning source ===")
for k,v in by_src.most_common():
    print(f"  {k:<8}{hms(v):>10}  {v/bridged_total*100:5.1f}%")
print()
print("=== consecutive-heartbeat gaps, weighted by seconds ===")
for k in ["<=120s (client counts it)","120s-5m  (server bridge only)","5m-15m   (server bridge only)",">15m     (idle, dropped)"]:
    print(f"  {k:<32}{hms(gap_hist[k]):>10}")
print()

# ---- 2. what fraction of heartbeats is each emitter, and anchors ----
print("=== emitters ===")
c = collections.Counter()
anch = collections.Counter()
for h in hb:
    key = f"{h['editor']}{' (ai)' if h['is_ai_generated'] else ''}"
    c[key]+=1
    if not (h.get("active_seconds") or 0) > 0 and h["activity_segments"] in ("","[]"):
        anch[key]+=1
for k,v in c.most_common():
    print(f"  {k:<28}{v:>5} heartbeats, {anch[k]:>4} of them zero-duration anchors")
