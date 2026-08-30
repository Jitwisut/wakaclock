import sys, json, datetime, zoneinfo
SP = str(__import__("pathlib").Path(__file__).resolve().parent)
sys.path.insert(0, SP)
from timeline import build_intervals, canonicalize_bridged, total_seconds, wakatime_durations
from golden import resolve_attribution

TZ = zoneinfo.ZoneInfo("Asia/Bangkok")
hb   = [json.loads(l) for l in open(f"{SP}/hb.jsonl")]
proj = [json.loads(l) for l in open(f"{SP}/ai.jsonl")]
def hms(s):
    s=int(round(s)); return f"{s//3600}h{(s%3600)//60:02d}m"

def actor_type(row):
    return resolve_attribution(row)["actor_type"]

def projected_actor_type(row):
    """Read actor enum from an exported interval, with a safe legacy fallback."""
    value = row.get("actor_type")
    if isinstance(value, str) and value.strip().lower() in {
        "human", "ai_verified", "ai_inferred", "unknown"
    }:
        return value.strip().lower()
    source = str(row.get("source") or "").lower()
    if source in ("human", "editor"):
        return "human"
    if source == "ai" or "agent" in source:
        return "ai_inferred"
    return "unknown"

days = sorted({datetime.datetime.fromtimestamp(h["time"], TZ).date() for h in hb})
def run(timeout, allowed=None):
    tot=0.0
    for d in days:
        s = datetime.datetime.combine(d, datetime.time.min, TZ).timestamp()
        e = datetime.datetime.combine(d+datetime.timedelta(days=1), datetime.time.min, TZ).timestamp()
        src = hb if allowed is None else [h for h in hb if actor_type(h) in allowed]
        win_hb = [h for h in src if s-120 <= h["time"] < e+120]
        win_pr = [p for p in proj if p["end"] > s and p["start"] < e]
        if allowed is not None:
            win_pr = [p for p in win_pr if projected_actor_type(p) in allowed]
        tot += total_seconds(canonicalize_bridged(build_intervals(win_pr, win_hb, s, e), timeout))
    return tot

def run_wt(timeout, allowed=None):
    tot=0.0
    for d in days:
        s = datetime.datetime.combine(d, datetime.time.min, TZ).timestamp()
        e = datetime.datetime.combine(d+datetime.timedelta(days=1), datetime.time.min, TZ).timestamp()
        src = hb if allowed is None else [h for h in hb if actor_type(h) in allowed]
        day = [h for h in src if s <= h["time"] < e]
        tot += wakatime_durations(day, timeout)[0]
    return tot

print("Idle-timeout sensitivity over 14 real days (956 heartbeats, one user)")
print(f"{'timeout':>10}{'wakaclock':>12}{'wakatime-ref':>14}{'human only':>12}{'ai only':>10}")
print("-"*58)
for t in (0.0, 120.0, 300.0, 600.0, 900.0):
    label = "off" if t==0 else f"{int(t/60)}m"
    print(f"{label:>10}{hms(run(t)):>12}{hms(run_wt(t if t else 0.0001)):>14}"
          f"{hms(run(t, {'human'})):>12}"
          f"{hms(run(t, {'ai_verified', 'ai_inferred'})):>10}")
print()
print("human only = vscode editor heartbeats; ai only = agent hook + ai-sync transcript replay")
