#!/usr/bin/env python3
"""Compare what the running API reports against the WakaTime reference builder.

Unlike `ladder.py`, which replays the algorithm in Python, this asks the live server
for its own numbers — so it measures the product, not a model of it. The WakaTime
column is built from the same heartbeat stream the server read, which makes the two
columns directly comparable.

    ./export.sh <user-uuid>
    WAKACLOCK_API_KEY=... python3 compare_api.py [--base http://localhost:8080]

Days are UTC because the server reports in UTC unless the user has a timezone set.
"""
import argparse, base64, datetime, json, os, sys, urllib.request, urllib.error
from pathlib import Path

SP = Path(__file__).resolve().parent
sys.path.insert(0, str(SP))
from timeline import wakatime_durations

def hms(seconds: float) -> str:
    seconds = int(round(seconds))
    return f"{seconds // 3600}h{(seconds % 3600) // 60:02d}m"

def fetch(base: str, key: str, path: str):
    request = urllib.request.Request(
        f"{base}{path}",
        headers={"Authorization": "Basic " + base64.b64encode(key.encode()).decode()},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=os.environ.get("WAKACLOCK_API", "http://localhost:8080"))
    parser.add_argument("--key", default=os.environ.get("WAKACLOCK_API_KEY", ""))
    args = parser.parse_args()
    if not args.key:
        print("set WAKACLOCK_API_KEY (or pass --key)", file=sys.stderr)
        return 2

    heartbeats = [json.loads(line) for line in open(SP / "hb.jsonl")]
    by_day: dict[datetime.date, list] = {}
    for heartbeat in heartbeats:
        day = datetime.datetime.fromtimestamp(heartbeat["time"], datetime.UTC).date()
        by_day.setdefault(day, []).append(heartbeat)

    days = sorted(by_day)
    summaries = fetch(
        args.base, args.key,
        f"/api/v1/users/current/summaries?start={days[0]}&end={days[-1]}",
    )["days"]
    reported = {day["date"]: day for day in summaries}

    print(f"{'day':<12}{'hb':>5}{'API total':>11}{'wakatime':>10}{'delta':>8}"
          f"{'proven':>9}{'inferred':>10}{'attended':>10}{'agent':>9}{'agent%':>8}")
    print("-" * 92)
    totals = dict.fromkeys(
        ("api", "wt", "proven", "inferred", "attended", "agent"), 0.0)
    for day in days:
        entry = reported.get(str(day))
        if not entry:
            continue
        total = entry["grand_total"]["total_seconds"]
        evidence = entry["grand_total"].get("evidence") or {}
        proven = evidence.get("proven_seconds", 0.0)
        inferred = evidence.get("inferred_seconds", 0.0)
        attended = evidence.get("attended_seconds", 0.0)
        agent = evidence.get("agent_seconds", 0.0)
        wt, _ = wakatime_durations(by_day[day], 900.0)
        totals["api"] += total; totals["wt"] += wt
        totals["proven"] += proven; totals["inferred"] += inferred
        totals["attended"] += attended; totals["agent"] += agent
        # A day worth seconds makes the ratio meaningless — 12s against 5s is "148%"
        # and says nothing. Below a minute, report the delta as "-" rather than noise.
        delta = f"{(total / wt - 1) * 100:>6.0f}%" if wt >= 60.0 else "     -"
        share = agent / total * 100 if total else 0.0
        print(f"{str(day):<12}{len(by_day[day]):>5}{hms(total):>11}{hms(wt):>10}"
              f"{delta:>7}{hms(proven):>9}{hms(inferred):>10}"
              f"{hms(attended):>10}{hms(agent):>9}{share:>7.0f}%")
    print("-" * 92)
    delta = f"{(totals['api'] / totals['wt'] - 1) * 100:>6.0f}%" if totals["wt"] else "     -"
    share = totals["agent"] / totals["api"] * 100 if totals["api"] else 0.0
    print(f"{'TOTAL':<12}{len(heartbeats):>5}{hms(totals['api']):>11}{hms(totals['wt']):>10}"
          f"{delta:>7}{hms(totals['proven']):>9}{hms(totals['inferred']):>10}"
          f"{hms(totals['attended']):>10}{hms(totals['agent']):>9}{share:>7.0f}%")
    print()
    print("API total = grand_total.total_seconds from /summaries (what the dashboard shows)")
    print("wakatime  = WakaTime's duration builder over the same heartbeats, 15-min timeout")
    print("proven    = seconds a client measured; inferred = added by idle bridging")
    print("attended  = human editor activity; agent = emitted by an AI agent hook")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
