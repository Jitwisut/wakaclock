#!/usr/bin/env python3
"""Reject production code that treats the legacy AI boolean as attribution.

The boolean remains in a small, explicit compatibility surface so old clients and
historical rows can still be read.  New attribution decisions must use actor_type.
This check is intentionally allowlist-based: adding a new production use requires a
reviewed entry here instead of silently expanding the legacy surface.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_ROOTS = (
    ROOT / "backend" / "api" / "src",
    ROOT / "backend" / "api" / "crates",
    ROOT / "extensions" / "vscode" / "src",
    ROOT / "frontend" / "app" / "app",
    ROOT / "frontend" / "app" / "components",
    ROOT / "frontend" / "app" / "hooks",
    ROOT / "frontend" / "app" / "lib",
)

# Compatibility adapters, storage columns/migrations, and the deprecated client type
# are the only production locations allowed to mention the legacy field.
ALLOWED_FILES = {
    "backend/api/crates/wakaclock-cli/src/broker.rs",
    "backend/api/crates/wakaclock-cli/src/main.rs",
    "backend/api/crates/wakaclock-core/src/api_client.rs",
    "backend/api/crates/wakaclock-core/src/heartbeat.rs",
    "backend/api/crates/wakaclock-ls/src/main.rs",
    "backend/api/src/handlers/v1/heartbeats.rs",
    "backend/api/src/model/heartbeat.rs",
    "backend/api/src/repository/analytics.rs",
    "backend/api/src/repository/heartbeat.rs",
    "backend/api/src/repository/project_analytics.rs",
    "backend/api/src/services/heartbeat.rs",
    "backend/api/src/services/reprocess.rs",
    "backend/api/src/services/wakatime_import.rs",
    "frontend/app/lib/wakaclock/types.ts",
}

LEGACY_RE = re.compile(r"\bis_ai_generated\b")
FORBIDDEN_HUMAN_RE = re.compile(r"\bNOT\s+is_ai_generated\b", re.IGNORECASE)
IGNORED_FILES = {
    # These are public documentation examples, not attribution decisions.
    "frontend/app/components/marketing/marketing-copy.ts",
}


def production_files() -> list[Path]:
    files: set[Path] = set()
    for root in PRODUCTION_ROOTS:
        if root.exists():
            files.update(
                path
                for path in root.rglob("*")
                if path.is_file()
                and path.suffix in {".rs", ".ts", ".tsx", ".js", ".mjs"}
                and not path.name.endswith(".map")
                and "/out/" not in path.as_posix()
            )
    return sorted(files)


def main() -> int:
    violations: list[str] = []
    legacy_files: set[str] = set()
    for path in production_files():
        relative = path.relative_to(ROOT).as_posix()
        if relative in IGNORED_FILES:
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(lines, start=1):
            if FORBIDDEN_HUMAN_RE.search(line):
                violations.append(f"{relative}:{number}: legacy boolean cannot decide Human")
            if LEGACY_RE.search(line):
                legacy_files.add(relative)
                if relative not in ALLOWED_FILES:
                    violations.append(
                        f"{relative}:{number}: add actor_type logic; legacy boolean is not allowlisted"
                    )

    if violations:
        print("actor migration verification FAILED", file=sys.stderr)
        print("\n".join(violations), file=sys.stderr)
        return 1

    unknown_allowlist = sorted(ALLOWED_FILES - legacy_files)
    if unknown_allowlist:
        print(
            "actor migration verification FAILED: allowlist entries no longer contain "
            "the legacy compatibility field:",
            file=sys.stderr,
        )
        print("\n".join(unknown_allowlist), file=sys.stderr)
        return 1

    print(f"actor migration verification passed ({len(legacy_files)} allowlisted files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
