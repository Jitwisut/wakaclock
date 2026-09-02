import sys, json, datetime, zoneinfo
SP = str(__import__("pathlib").Path(__file__).resolve().parent)
sys.path.insert(0, SP)
from timeline import (build_intervals, canonicalize, canonicalize_bridged,
                      total_seconds, union_seconds, wakatime_durations,
                      MAX_ACTIVITY_GAP_SECONDS)

TZ = zoneinfo.ZoneInfo("Asia/Bangkok")
hb  = [json.loads(l) for l in open(f"{SP}/hb.jsonl")]
proj = [json.loads(l) for l in open(f"{SP}/ai.jsonl")]

def hms(s):
    s = int(round(s)); return f"{s//3600}h{(s%3600)//60:02d}m"

days = sorted({datetime.datetime.fromtimestamp(h["time"], TZ).date() for h in hb})
print(f"{'day':<12}{'hb':>5}{'raw_sum':>10}{'segments':>10}{'canon':>9}{'BRIDGED':>10}{'wakatime':>10}{'span':>9}  inflate")
print("-"*95)
rows=[]
for d in days:
    s = datetime.datetime.combine(d, datetime.time.min, TZ).timestamp()
    e = datetime.datetime.combine(d + datetime.timedelta(days=1), datetime.time.min, TZ).timestamp()
    day_hb  = [h for h in hb if s <= h["time"] < e]
    if not day_hb: continue
    win_hb  = [h for h in hb if s - MAX_ACTIVITY_GAP_SECONDS <= h["time"] < e + MAX_ACTIVITY_GAP_SECONDS]
    win_pr  = [p for p in proj if p["end"] > s and p["start"] < e]

    raw_sum   = sum(h.get("active_seconds") or 0 for h in day_hb)          # what the MVs store
    ivs       = build_intervals(win_pr, win_hb, s, e)
    seg_union = union_seconds(ivs)                                          # evidence only, clamped
    canon     = total_seconds(canonicalize(ivs))                            # overlap-free, no bridging
    bridged   = total_seconds(canonicalize_bridged(ivs, 900.0))             # what the API returns
    wt, _     = wakatime_durations(day_hb, 900.0)                           # WakaTime reference
    span      = max(h["time"] for h in day_hb) - min(h["time"] for h in day_hb)
    rows.append((d, len(day_hb), raw_sum, seg_union, canon, bridged, wt, span))
    print(f"{str(d):<12}{len(day_hb):>5}{hms(raw_sum):>10}{hms(seg_union):>10}{hms(canon):>9}{hms(bridged):>10}{hms(wt):>10}{hms(span):>9}  "
          f"{(bridged/canon if canon else 0):.1f}x")

print("-"*95)
tot = lambda i: sum(r[i] for r in rows)
print(f"{'TOTAL':<12}{tot(1):>5}{hms(tot(2)):>10}{hms(tot(3)):>10}{hms(tot(4)):>9}{hms(tot(5)):>10}{hms(tot(6)):>10}{hms(tot(7)):>9}")
print()
print("raw_sum  = sum(active_seconds) -> what mv_*_summary writes into daily_totals/project_daily/...")
print("segments = union of clamped evidence intervals (no bridging)")
print("canon    = canonicalize()  (overlap-free, no bridging)")
print("BRIDGED  = canonicalize_bridged(900s) -> /status_bar/today, /durations, summaries grand_total")
print("wakatime = WakaTime duration builder over the same heartbeat times, 15-min timeout")
