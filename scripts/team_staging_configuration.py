"""Metadata-only, explicit feature configuration for isolated Team staging.

This validates configuration, not ledger contents or runtime readiness. It never
creates a journal, grants consent, starts a trial or enables a Stripe feature.
"""
from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from uuid import UUID


FEATURES = {
    "organization_onboarding": "ATOAXIS_TEAM_ORGANIZATION_ONBOARDING_ENABLED",
    "self_service_trial": "ATOAXIS_TEAM_SELF_SERVICE_TRIAL_ENABLED",
    "usage_admission_worker": "ATOAXIS_TEAM_USAGE_ADMISSION_WORKER_ENABLED",
    "workflow_reports": "ATOAXIS_TEAM_WORKFLOW_ENABLED",
    "copilot_daily": "ATOAXIS_COPILOT_DAILY_ENABLED",
    "copilot_weekly": "ATOAXIS_COPILOT_WEEKLY_ENABLED",
}
GUARDED = {"organization_onboarding", "self_service_trial", "usage_admission_worker", "copilot_daily"}


class ConfigurationError(ValueError):
    """Safe fixed error code; never include a supplied value or file contents."""


def _require(condition: bool, code: str) -> None:
    if not condition:
        raise ConfigurationError(code)


def _object(pairs):
    result = {}
    for key, value in pairs:
        _require(key not in result, "team_staging_duplicate_configuration_key")
        result[key] = value
    return result


def configuration(root: Path) -> tuple[dict[str, str], dict]:
    """Read only an existing staging-local file. Absent means features off."""
    _require(root.is_absolute() and root.resolve() == root and not root.is_symlink(),
             "team_staging_root_unconfirmed")
    path = root / "team-features.json"
    configured = path.exists() or path.is_symlink()
    if not configured:
        selected = {}
        guard = None
    else:
        info = path.lstat()
        _require(stat.S_ISREG(info.st_mode) and info.st_size <= 65_536,
                 "team_staging_configuration_file_invalid")
        try:
            value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_object)
        except (OSError, UnicodeError, ValueError) as error:
            raise ConfigurationError("team_staging_configuration_invalid") from error
        _require(isinstance(value, dict) and set(value) <= {"schema_version", "features", "enrollment_guard"}
                 and type(value.get("schema_version")) is int and value["schema_version"] == 1,
                 "team_staging_configuration_schema_invalid")
        selected = value.get("features", {})
        guard = value.get("enrollment_guard")
        _require(isinstance(selected, dict) and set(selected) <= FEATURES.keys()
                 and all(type(enabled) is bool for enabled in selected.values()),
                 "team_staging_features_invalid")
    flags = {feature: selected.get(feature, False) for feature in FEATURES}
    _require(not flags["copilot_weekly"] or flags["copilot_daily"],
             "team_staging_copilot_weekly_requires_daily")
    _require(guard is not None or not any(flags[name] for name in GUARDED),
             "team_staging_independent_enrollment_guard_required")
    env = {name: "true" if flags[key] else "false" for key, name in FEATURES.items()}
    if guard is not None:
        _require(isinstance(guard, dict) and set(guard) == {"path", "namespace"}
                 and all(isinstance(guard[key], str) for key in ("path", "namespace")),
                 "team_staging_enrollment_configuration_invalid")
        try:
            namespace = UUID(guard["namespace"])
        except ValueError as error:
            raise ConfigurationError("team_staging_enrollment_namespace_invalid") from error
        _require(namespace.int != 0 and str(namespace) == guard["namespace"],
                 "team_staging_enrollment_namespace_invalid")
        journal = Path(guard["path"])
        _require(journal.is_absolute() and journal.resolve() == journal
                 and not journal.is_symlink() and root in journal.parents,
                 "team_staging_enrollment_path_not_isolated")
        _require(journal not in {path, root / "environment.json", root / "github-app.json",
                                root / "independent-privacy-ledger.json", root / "managed-processes.json"},
                 "team_staging_enrollment_path_conflict")
        try:
            info = journal.lstat()
        except OSError as error:
            raise ConfigurationError("team_staging_enrollment_journal_missing") from error
        _require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
                 "team_staging_enrollment_file_invalid")
        if os.name == "posix":
            _require(info.st_mode & 0o077 == 0 and journal.parent.stat().st_mode & 0o077 == 0,
                     "team_staging_enrollment_private_permissions_required")
        env.update({"ATOAXIS_TEAM_FINANCIAL_GUARD_PATH": str(journal),
                    "ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE": str(namespace),
                    "ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED": "true"})
    return env, {
        "schema_version": 1, "configuration": "explicit" if configured else "default_off",
        "features": flags, "enrollment_guard": "present_unverified" if guard else "not_configured",
        "ledger_contents_verified": False, "enables_organization_rollout": False,
        "enables_sharing": False, "enables_stripe": False, "runtime_checked": False,
        "production_ready": False,
    }
