#!/usr/bin/env python3
"""Create one privacy-safe Universal AI adapter certification artifact.

This command accepts only explicitly supplied metadata and counters. It never
reads transcripts, source files, prompts, command output, or user identity. A
real adapter run must provide its observed counts; ``scaffold``/``unverified``
are the safe defaults when only fixtures or an unavailable client exist.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

from verify_ai_certification import verify_report

ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def bounded_id(value: str, field: str) -> str:
    value = value.strip().lower()
    if not ID_RE.fullmatch(value):
        raise ValueError(f"{field} must be a lowercase identifier")
    return value


def bounded_count(value: str, field: str) -> int:
    parsed = int(value)
    if parsed < 0 or parsed > 10_000_000:
        raise ValueError(f"{field} is outside the certification bound")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", required=True)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--model")
    parser.add_argument("--client-version", default="not-recorded")
    parser.add_argument("--plugin-version", default="not-recorded")
    parser.add_argument("--contract-version", default="producer-v1")
    parser.add_argument("--fingerprint-version", default="caf1")
    parser.add_argument("--status", choices=("verified", "scaffold", "unverified"), default="scaffold")
    parser.add_argument("--scenario", action="append", dest="scenarios", required=True)
    parser.add_argument("--live-e2e", action="store_true")
    parser.add_argument("--captured", default="0")
    parser.add_argument("--correlated", default="0")
    parser.add_argument("--canonical", default="0")
    parser.add_argument("--duplicates", default="0")
    parser.add_argument("--delivered", default="0")
    parser.add_argument("--replayed", default="0")
    parser.add_argument("--delivery-result", choices=("delivered", "not_observed", "blocked"), default="not_observed")
    parser.add_argument("--timezone", default="UTC")
    parser.add_argument("--blocker", action="append", default=[])
    parser.add_argument("--checked-at-utc")
    parser.add_argument("--expires-at-utc")
    parser.add_argument("--tested-commit-sha")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        client = bounded_id(args.client, "client")
        provider = bounded_id(args.provider, "provider")
        contract = bounded_id(args.contract_version, "contract-version")
        fingerprint = bounded_id(args.fingerprint_version, "fingerprint-version")
        scenarios = [bounded_id(item, "scenario") for item in args.scenarios]
        if not args.scenarios:
            raise ValueError("at least one scenario is required")
        counts = {
            "captured_events": bounded_count(args.captured, "captured"),
            "correlated_events": bounded_count(args.correlated, "correlated"),
            "canonical_activities": bounded_count(args.canonical, "canonical"),
            "duplicate_events": bounded_count(args.duplicates, "duplicates"),
            "delivered_events": bounded_count(args.delivered, "delivered"),
            "replayed_events": bounded_count(args.replayed, "replayed"),
        }
        sha = args.tested_commit_sha or subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        if not SHA_RE.fullmatch(sha):
            raise ValueError("tested-commit-sha must be a full lowercase Git SHA")
        checked = args.checked_at_utc or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
        if checked.endswith("+00:00"):
            checked = checked[:-6] + "Z"
        expires = args.expires_at_utc
        if expires is None:
            parsed = dt.datetime.fromisoformat(checked.replace("Z", "+00:00"))
            expires = (parsed + dt.timedelta(days=30)).replace(microsecond=0).isoformat()
            if expires.endswith("+00:00"):
                expires = expires[:-6] + "Z"
        if args.status == "verified" and not args.live_e2e:
            raise ValueError("verified requires --live-e2e")
        if args.status != "verified" and args.live_e2e:
            raise ValueError("--live-e2e is only valid for verified")
        report = {
            "schema_version": 1,
            "status": args.status,
            "client_id": client,
            "provider_id": provider,
            "model_id": args.model,
            "client_version": args.client_version,
            "plugin_version": args.plugin_version,
            "contract_version": contract,
            "fingerprint_version": fingerprint,
            "checked_at_utc": checked,
            "expires_at_utc": expires,
            "tested_commit_sha": sha,
            "timezone": args.timezone,
            "scenario_ids": scenarios,
            "live_e2e": args.live_e2e,
            **counts,
            "delivery_result": args.delivery_result,
            "tolerance": {"duplicate_rate_max": 0.05, "delivery_loss_max": 0.0},
            "blockers": args.blocker,
        }
        validation_errors = verify_report(report)
        if validation_errors:
            raise ValueError("; ".join(validation_errors))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(args.output)
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"certification creation failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
