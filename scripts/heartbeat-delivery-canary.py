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
import time
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
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
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



def daily_evidence(day, now, scope, observations, activity, intervals):
    """Historical qualification uses only that day's scoped evidence, never current health."""
    result = {"status": "unconfirmed", "reason": "day_observations_missing"}
    if day >= now.astimezone(TZ).date():
        return {**result, "reason": "day_not_closed"}
    if day.weekday() >= 5 or not activity:
        return {**result, "reason": "user_activity_unconfirmed"}
    samples = []
    for observation in observations:
        try:
            at = dt.datetime.fromisoformat(observation["checked_at"].replace("Z", "+00:00"))
            if at.tzinfo and at.astimezone(TZ).date() == day and observation.get("scope") == scope:
                samples.append((at.timestamp(), observation))
        except (ValueError, KeyError, TypeError):
            continue
    if not samples:
        return result
    samples.sort(key=lambda entry: entry[0])
    builds = sorted({str(s.get("worker_binary_sha256")) + ":" + str(s.get("capture_generation")) for _, s in samples})
    result.update(observations=len(samples), builds=builds)
    if not intervals:
        return {**result, "reason": "activity_interval_evidence_missing"}
    healthy = []
    for at, s in samples:
        if (s.get("delivery_complete") and s.get("capture_complete") and s.get("runtime_complete")
                and s.get("worker_binary_sha256") and (s.get("capture_generation") or {}).get("binary_sha256")):
            healthy.append([at, at + 300])
        else:
            return {**result, "reason": "day_health_failure"}
    if difference(union(intervals), union(healthy)):
        return {**result, "reason": "activity_health_coverage_missing"}
    return {**result, "status": "observed", "reason": "day_scoped_activity_and_health_evidence"}


def save_revision(path, record):
    """Immutable revision files; legacy unversioned reports are preserved as revision 1."""
    previous = None
    if path.exists():
        try:
            previous = json.loads(path.read_text())
        except (OSError, ValueError):
            raise RuntimeError("Existing canary report unreadable; refuse to overwrite")
    stripped = lambda value: {k: v for k, v in value.items() if k not in ("revision", "revision_reason")}
    if previous and stripped(previous) == stripped(record):
        return previous
    directory = path.parent / (path.stem + "-revisions")
    revision = int((previous or {}).get("revision", 0))
    if previous and not revision:
        revision = 1
        save(directory / "000001.json", {**previous, "revision": 1, "revision_reason": "preserved_legacy_decision"})
    current = {**record, "revision": revision + 1,
               "revision_reason": "new_day_evidence" if previous else "initial_day_evidence"}
    target = directory / f"{revision+1:06d}.json"
    if target.exists():
        raise RuntimeError("Canary revision collision; refuse to overwrite")
    save(target, current)
    save(path, current)
    return current


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


def scoped_worker_evidence(worker, history, scope, now):
    """Legacy local snapshots have no scope; only their scoped archive binds their counters."""
    if worker.get("scope") == scope:
        return worker
    candidates = []
    for entry in history:
        observation = entry.get("observation", {})
        try:
            at = dt.datetime.fromisoformat(observation["checked_at"].replace("Z", "+00:00"))
            if (entry.get("scope") == scope and observation.get("pid") == worker.get("pid")
                    and at.tzinfo and 0 <= (now-at).total_seconds() <= 90):
                candidates.append((at, observation))
        except (KeyError, TypeError, ValueError):
            continue
    return max(candidates, key=lambda item: item[0])[1] if candidates else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--observe-only", action="store_true", help="Record scoped health/build metadata only; no activity query")
    parser.add_argument("--watch", action="store_true", help="Observe every 60 seconds; never creates activity")
    parser.add_argument("--date", type=dt.date.fromisoformat)
    parser.add_argument("--cutoff", help="ISO timestamp with timezone for a historical comparison")
    args = parser.parse_args()
    cc = tomllib.loads((Path.home() / ".wakaclock/config.toml").read_text())
    base = cc["server_url"].rstrip("/").removesuffix("/api/v1")
    if urllib.parse.urlparse(base).hostname not in ("localhost", "127.0.0.1", "::1"):
        raise SystemExit("Configured origin changed; review the canary scope before continuing.")
    now = dt.datetime.now(TZ)
    owner = "key:" + hashlib.sha256(cc["api_key"].encode()).hexdigest()
    destination = cc["server_url"].rstrip("/")
    # Worker archive uses newline; queue/capture identity uses NUL. They are distinct contracts.
    scope = hashlib.sha256((destination + "\n" + owner).encode()).hexdigest()
    queue_scope = hashlib.sha256((destination + "\0" + owner).encode()).hexdigest()
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
    devices = [d for d in delivery.get("data", {}).get("devices", []) if d.get("queue_id") == queue_scope]
    history_entries = []
    history_path = Path.home() / f".wakaclock/delivery-history/{now.date()}.jsonl"
    if history_path.exists():
        for line in history_path.read_text().splitlines():
            try: history_entries.append(json.loads(line))
            except ValueError: continue
    scoped_worker = scoped_worker_evidence(worker, history_entries, scope, now)
    worker_scope_source = ("snapshot" if worker.get("scope") == scope else
                           "scoped_archive" if scoped_worker is not None else "unconfirmed")
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
        and not capture.get('dry_run', True) and not capture.get('incomplete', True)
        and capture.get('receiver_capable') is True and capture.get('unread_sources')==0
        and capture.get('scope') == queue_scope and capture.get('checked_at')
        and 0 <= (now-dt.datetime.fromisoformat(capture['checked_at'].replace('Z','+00:00'))).total_seconds()<=300)
    complete = (worker_alive and scoped_worker is not None and age is not None and 0 <= age <= 300 and worker.get("read_status") == "available"
                and not worker.get("error_code") and not worker.get("delivery_incomplete", True)
                and worker.get("pending") == 0 and worker.get("dead_letter") == 0
                and scoped_worker.get("pending") == 0 and scoped_worker.get("dead_letter") == 0
                and scoped_worker.get("read_status") == "available" and not scoped_worker.get("error_code") and bool(devices)
                and capture_complete
                and all(d.get("schema_version") == 2 and d.get("status") == "fresh"
                        and d.get("pending") == 0 and d.get("dead_letter") == 0 and d.get("details") for d in devices))
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
    worker_build_sha256 = None
    try: worker_build_sha256 = hashlib.sha256((Path.home()/'.wakaclock/bin/wakaclock-delivery').read_bytes()).hexdigest()
    except OSError: pass
    evidence = {"checked_at": now.isoformat(), "scope": scope, "timezone": str(TZ),
                "worker_binary_sha256": worker_build_sha256, "delivery_complete": bool(complete),
                "capture_complete": capture_complete, "runtime_complete": runtime_complete,
                "capture_generation": generation,
                "worker_scope_evidence": worker_scope_source,
                "queue_scope": queue_scope}
    save(OUT / "observations" / (now.strftime("%Y%m%d-%H%M%S-%f")+".json"), evidence)
    if args.observe_only or args.watch:
        return
    wc = configparser.ConfigParser(interpolation=None)
    wc.read(Path.home() / ".wakatime.cfg")
    waka_key = wc.get("settings", "api_key")
    profile = get("https://api.wakatime.com", waka_key, "/api/v1/users/current")
    # Whitelist fields rather than saving the user profile or response body.
    settings = {k: v for k, v in profile.get("data", {}).items() if k in ("timeout", "timeout_seconds", "timezone")}
    historical = []
    for path in sorted((OUT / "observations").glob("*.json")):
        try: historical.append(json.loads(path.read_text()))
        except (OSError, ValueError): pass
    comparisons = []
    for day in dates:
        params = {"date": day.isoformat(), "timezone": "Asia/Bangkok"}
        ato = get(base, cc["api_key"], "/api/v1/users/current/durations", params)
        waka = get("https://api.wakatime.com", waka_key, "/api/v1/users/current/durations", params)
        if "data" not in ato or "data" not in waka:
            record = {"date": day.isoformat(), "status": "unconfirmed", "scope": scope,
                      "active_working_day": False, "activity_confirmation": "unconfirmed-api-unavailable",
                      "day_health": {"status": "unconfirmed", "reason": "canonical_or_comparison_api_unavailable"},
                      "atoaxis_http": ato.get("http_error"), "wakatime_http": waka.get("http_error")}
            comparisons.append(save_revision(OUT / f"{day}{'-cutoff' if args.cutoff else ''}.json", record))
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
            if (human_segments and not artifact) or file_mutation:
                confirmed_activity = True
        record["active_working_day"] = confirmed_activity
        record["activity_confirmation"] = "non-monitoring-event-evidence" if confirmed_activity else "unconfirmed-or-no-qualifying-event"
        record["scope"] = scope
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
        qualification = daily_evidence(day, now, scope, historical, confirmed_activity, ranges(ato, day, args.cutoff))
        record["day_health"] = qualification
        record["status"] = qualification["status"]
        if args.cutoff:
            record["status"] = "unconfirmed"
            record["day_health"]["reason"] = "partial_cutoff_comparison"
        record = save_revision(OUT / f"{day}{'-cutoff' if args.cutoff else ''}.json", record)
        comparisons.append(record)
        if not args.date and sum(r.get("status") == "observed" and r.get("active_working_day", False) for r in comparisons) >= 7:
            break
    count = 0 if args.date else sum(r.get("status") == "observed" and r.get("active_working_day", False) for r in comparisons)
    worker_build_sha256 = None
    try: worker_build_sha256 = hashlib.sha256((Path.home()/'.wakaclock/bin/wakaclock-delivery').read_bytes()).hexdigest()
    except OSError: pass
    result = {"schema_version": 2, "checked_at": now.isoformat(), "first_full_day": str(FIRST_FULL_DAY),
              "worker_binary_sha256": worker_build_sha256,
              "worker_alive": worker_alive, "worker_age_seconds": age,
              "worker": worker, "delivery_complete": bool(complete), "scope": scope,
              "capture_complete": capture_complete, "capture_generation": generation,
              "extension_cli_override": extension_runtime, "runtime_complete": runtime_complete,
              "capture": {k:capture.get(k) for k in ('checked_at','status','pending','parser_errors','version','git_sha','tick_elapsed_ms')} if capture else None,
              "worker_scope_evidence": worker_scope_source,
              "backend_error":delivery.get("error_code"),
              "server_http": delivery.get("http_error"), "completed_active_working_days": count,
              "canary_complete": count >= 7 and not args.date, "comparisons": comparisons}
    save(OUT / "runs" / (now.strftime("%Y%m%d-%H%M%S")+".json"), result)
    save(OUT / (f"comparison-{args.date}{'-cutoff' if args.cutoff else ''}.json" if args.date else "latest.json"), result)
    print(json.dumps({k: v for k, v in result.items() if k not in ("worker", "comparisons")}))


if __name__ == "__main__":
    if "--watch" in os.sys.argv:
        while True:
            try:
                latest = OUT / "latest.json"
                if latest.exists():
                    completed = json.loads(latest.read_text())
                    if completed.get("schema_version") == 2 and completed.get("canary_complete"):
                        break
                main()
            except (OSError, ValueError, KeyError, TypeError):
                # Diagnostics are reason codes only, never credentials or response bodies.
                print("canary_observation_unconfirmed", flush=True)
            time.sleep(60)
    else:
        main()
