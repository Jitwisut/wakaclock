#!/usr/bin/env python3
"""Metadata-only canary. Reads existing queues/history and GETs configured APIs.

Never enqueues events, imports WakaTime, changes timeouts or prints credentials.
"""
import argparse
import base64
import configparser
import datetime as dt
import json
import hashlib
import os
import re
from pathlib import Path
import ssl
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/heartbeat-recovery-2026-10-07/canary"
TZ = ZoneInfo("Asia/Bangkok")
FIRST_FULL_DAY = dt.date(2026, 10, 8)


def get(base, key, path, params=None, bearer=False):
    authorization = "Bearer " + key if bearer else "Basic " + base64.b64encode(key.encode()).decode()
    url = base.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"Authorization": authorization, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=30, context=ssl.create_default_context(cafile="/etc/ssl/cert.pem")) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        return {"http_error": error.code}
    except (urllib.error.URLError, TimeoutError, OSError):
        return {"error_code": "service_unavailable"}


def union(intervals):
    result = []
    for start, end in sorted(intervals):
        if end <= start:
            continue
        if result and start <= result[-1][1]:
            result[-1][1] = max(result[-1][1], end)
        else:
            result.append([start, end])
    return result


def difference(left, right):
    pieces = []
    for start, end in left:
        cursor = start
        for other_start, other_end in right:
            if other_end <= cursor:
                continue
            if other_start >= end:
                break
            if other_start > cursor:
                pieces.append([cursor, min(end, other_start)])
            cursor = max(cursor, other_end)
            if cursor >= end:
                break
        if cursor < end:
            pieces.append([cursor, end])
    return pieces


def ranges(response, day, cutoff=None):
    start = dt.datetime.combine(day, dt.time.min, TZ).timestamp()
    end = dt.datetime.combine(day + dt.timedelta(days=1), dt.time.min, TZ).timestamp()
    if cutoff:
        end = min(end, dt.datetime.fromisoformat(cutoff).timestamp())
    rows = response.get("data", [])
    intervals = []
    for row in rows:
        at = row.get("start", row.get("time", 0))
        until = row.get("end", at + row.get("duration_seconds", row.get("duration", 0)))
        intervals.append([max(start, at), min(end, until)])
    return union(intervals)


def compare(ato, waka, day, cutoff=None):
    a, w = ranges(ato, day, cutoff), ranges(waka, day, cutoff)
    seconds = lambda intervals: sum(end - start for start, end in intervals)
    ato_seconds, waka_seconds = seconds(a), seconds(w)
    result = {"date": day.isoformat(), "timezone": "Asia/Bangkok", "cutoff": cutoff,
              "atoaxis_timeout_seconds": ato.get("timeout_seconds"),
              "atoaxis_seconds": ato_seconds, "wakatime_seconds": waka_seconds,
              "difference_seconds": ato_seconds - waka_seconds,
              "difference_percent": (ato_seconds - waka_seconds) / waka_seconds * 100 if waka_seconds else None,
              "category_scope": "all coding and AI coding; captured streams may differ",
              "identical_input_certified": False}
    for label, intervals in [("wakatime_only", difference(w, a)), ("atoaxis_only", difference(a, w))]:
        result[label] = [{"start": dt.datetime.fromtimestamp(start, TZ).isoformat(),
                          "end": dt.datetime.fromtimestamp(end, TZ).isoformat(),
                          "seconds": end - start} for start, end in intervals if end - start >= 0.001]
    return result


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, indent=2))
    temp.chmod(0o600)
    temp.replace(path)



def extension_override_runtime(settings_path, deployment_path):
    """Read only override/build metadata; never return other settings or credentials."""
    try:
        text = settings_path.read_text()
    except FileNotFoundError:
        return {"status": "not_configured"}
    except OSError:
        return {"status": "unconfirmed", "error_code": "extension_settings_unavailable"}
    try:
        # Preserve quoted strings while stripping JSONC comments/trailing commas.
        text = re.sub(r'("(?:\\.|[^"\\])*")|//[^\n]*|/\*[\s\S]*?\*/',
                      lambda m: m.group(1) or "", text)
        text = re.sub(r'("(?:\\.|[^"\\])*")|,(?=\s*[}\]])',
                      lambda m: m.group(1) or "", text)
        settings = json.loads(text)
        selected = settings.get("wakaclock.cliPath")
        if not isinstance(selected, str) or not selected.strip():
            return {"status": "not_configured"}
        binary = Path(selected).expanduser()
        if not binary.is_absolute():
            return {"status": "unconfirmed", "error_code": "extension_override_resolution_unconfirmed"}
        actual = hashlib.sha256(binary.read_bytes()).hexdigest()
        deployment = json.loads(deployment_path.read_text())
        hashes = deployment.get("sha256", {})
        if not isinstance(hashes, dict):
            raise ValueError("unknown build metadata")
        matches = actual in hashes.values()
        return {"status": "verified" if matches else "unconfirmed", "configured_path": str(binary),
                "binary_sha256": actual, "matches_deployed_build": matches,
                "error_code": None if matches else "extension_override_build_mismatch"}
    except (OSError, ValueError, TypeError, AttributeError):
        return {"status": "unconfirmed", "error_code": "extension_override_metadata_unavailable"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=dt.date.fromisoformat)
    parser.add_argument("--cutoff", help="ISO timestamp with timezone for a historical comparison")
    args = parser.parse_args()
    cc = tomllib.loads((Path.home() / ".wakaclock/config.toml").read_text())
    base = cc["server_url"].rstrip("/").removesuffix("/api/v1")
    if urllib.parse.urlparse(base).hostname not in ("localhost", "127.0.0.1", "::1"):
        raise SystemExit("Configured origin changed; review the canary scope before continuing.")
    wc = configparser.ConfigParser(interpolation=None)
    wc.read(Path.home() / ".wakatime.cfg")
    waka_key = wc.get("settings", "api_key")
    now = dt.datetime.now(TZ)
    owner = "key:" + hashlib.sha256(cc["api_key"].encode()).hexdigest()
    scope = hashlib.sha256((cc["server_url"].rstrip("/") + "\n" + owner).encode()).hexdigest()
    worker_path = Path.home() / ".wakaclock/delivery-state.json"
    try:
        worker = json.loads(worker_path.read_text())
    except (OSError, ValueError):
        worker = {"read_status": "unavailable"}
    age = None
    if worker.get("checked_at"):
        age = (now - dt.datetime.fromisoformat(worker["checked_at"].replace("Z", "+00:00"))).total_seconds()
    worker_alive = False
    if worker.get("pid"):
        try:
            os.kill(worker["pid"], 0)
            worker_alive = True
        except OSError:
            pass
    delivery = get(base, cc["api_key"], "/api/v2/me/delivery-status", bearer=True)
    devices = delivery.get("data", {}).get("devices", [])
    capture = None
    try:
        capture = json.loads((Path.home()/'.wakaclock/capture-state.json').read_text())
    except (OSError,ValueError):
        pass
    generation = {"version": capture.get("version"), "git_sha": capture.get("git_sha")} if capture else None
    if generation is not None:
        binary = Path.home()/'.wakaclock/bin/wakaclock-capture'
        try: generation['binary_sha256'] = hashlib.sha256(binary.read_bytes()).hexdigest()
        except OSError: generation['binary_sha256'] = None
    capture_complete = bool(capture and capture.get('enabled') and capture.get('status')=='fresh'
        and capture.get('pending')==0 and capture.get('parser_errors')==0
        and capture.get('checked_at') and (now-dt.datetime.fromisoformat(capture['checked_at'].replace('Z','+00:00'))).total_seconds()<=300)
    complete = (worker_alive and age is not None and age <= 300 and worker.get("read_status") == "available"
                and worker.get("pending") == 0 and worker.get("dead_letter") == 0 and bool(devices)
                and capture_complete
                and all(d.get("schema_version") == 2 and d.get("status") == "fresh"
                        and d.get("pending") == 0 and d.get("dead_letter") == 0 and d.get("details") for d in devices))
    profile = get("https://api.wakatime.com", waka_key, "/api/v1/users/current")
    # Whitelist fields rather than saving the user profile or response body.
    settings = {k: v for k, v in profile.get("data", {}).items() if k in ("timeout", "timeout_seconds", "timezone")}
    dates = [args.date] if args.date else []
    if not args.date:
        day = FIRST_FULL_DAY
        while day < now.date():
            if day.weekday() < 5:
                dates.append(day)
            day += dt.timedelta(days=1)
    extension_runtime = extension_override_runtime(
        Path.home()/"Library/Application Support/Code/User/settings.json",
        ROOT/"output/heartbeat-recovery-2026-10-07/capture-recovery/capture-health-deployment.json")
    runtime_complete = extension_runtime["status"] != "unconfirmed"
    comparisons = []
    for day in dates:
        params = {"date": day.isoformat(), "timezone": "Asia/Bangkok"}
        ato = get(base, cc["api_key"], "/api/v1/users/current/durations", params)
        waka = get("https://api.wakatime.com", waka_key, "/api/v1/users/current/durations", params)
        if "data" not in ato or "data" not in waka:
            comparisons.append({"date": day.isoformat(), "status": "unavailable", "atoaxis_http": ato.get("http_error"), "wakatime_http": waka.get("http_error")})
            continue
        record = compare(ato, waka, day, args.cutoff)
        record["wakatime_settings"] = settings
        # Qualify activity from metadata that cannot be just this monitor's
        # generated artifacts. AI-only ambiguous days remain unconfirmed.
        hb = get(base, cc["api_key"], "/api/v1/users/current/heartbeats", params)
        confirmed_activity = False
        for row in hb.get("data", []):
            if row.get("user_agent") == "wakaclock-cli/codex-monitoring-v2":
                continue
            entity = str(row.get("entity", ""))
            artifact = entity.startswith(str(ROOT / "output")) or entity.startswith(str(Path.home()/'.wakaclock'))
            human_segments = any(s.get("source") in ("editor", "editor_active_v1") and s.get("end",0)>s.get("start",0) for s in row.get("activity_segments", []))
            file_mutation = row.get("entity_type",row.get("type")) == "file" and row.get("is_write") and not artifact
            if human_segments or file_mutation:
                confirmed_activity = True
        record["active_working_day"] = confirmed_activity
        record["activity_confirmation"] = "non-monitoring-event-evidence" if confirmed_activity else "unconfirmed-or-no-qualifying-event"
        record["capture_generation"] = generation
        record["delivery_complete_at_check"] = bool(complete)
        record["extension_cli_override"] = extension_runtime
        observations = []
        history = Path.home() / f".wakaclock/delivery-history/{day}.jsonl"
        if history.exists():
            for line in history.read_text().splitlines():
                try:
                    entry = json.loads(line)
                    if entry.get("scope") == scope:
                        observations.append(entry["observation"])
                except (ValueError, KeyError):
                    continue
        record["observations"] = len(observations)
        record["max_pending_age_seconds"] = max((o.get("pending_age_seconds") or 0 for o in observations), default=None)
        record["max_tick_ms"] = max((o.get("tick_elapsed_ms") or 0 for o in observations), default=None)
        record["drain_latency_resolution"] = "once-per-minute local observations; not exact event-to-ACK latency"
        record["status"] = "observed" if complete and runtime_complete else "unconfirmed"
        save(OUT / f"{day}{'-cutoff' if args.cutoff else ''}.json", record)
        comparisons.append(record)
        if not args.date and sum(r.get("status") == "observed" and r.get("active_working_day", False) for r in comparisons) >= 7:
            break
    count = 0 if args.date else sum(r.get("status") == "observed" and r.get("active_working_day", False) for r in comparisons)
    worker_build_sha256 = None
    try: worker_build_sha256 = hashlib.sha256((Path.home()/'.wakaclock/bin/wakaclock-delivery').read_bytes()).hexdigest()
    except OSError: pass
    result = {"checked_at": now.isoformat(), "first_full_day": str(FIRST_FULL_DAY),
              "worker_binary_sha256": worker_build_sha256,
              "worker_alive": worker_alive, "worker_age_seconds": age,
              "worker": worker, "delivery_complete": bool(complete),
              "capture_complete": capture_complete, "capture_generation": generation,
              "extension_cli_override": extension_runtime, "runtime_complete": runtime_complete,
              "capture": {k:capture.get(k) for k in ('checked_at','status','pending','parser_errors','version','git_sha','tick_elapsed_ms')} if capture else None,
              "backend_error":delivery.get("error_code"),
              "server_http": delivery.get("http_error"), "completed_active_working_days": count,
              "canary_complete": count >= 7 and not args.date, "comparisons": comparisons}
    save(OUT / "runs" / (now.strftime("%Y%m%d-%H%M%S")+".json"), result)
    save(OUT / (f"comparison-{args.date}{'-cutoff' if args.cutoff else ''}.json" if args.date else "latest.json"), result)
    print(json.dumps({k: v for k, v in result.items() if k not in ("worker", "comparisons")}))


if __name__ == "__main__":
    main()
