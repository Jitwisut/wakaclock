"""Development regression source; execution deferred by the owner.

Uses temporary metadata and mocked launchers only. No services, database,
provider, runtime initialization or Docker are needed for this test module.
"""
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent))
from team_staging_configuration import ConfigurationError, configuration, FEATURES

spec = importlib.util.spec_from_file_location("staging", Path(__file__).with_name("team-github-staging.py"))
staging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(staging)


class TeamConfigurationTests(unittest.TestCase):
    def write(self, root, value):
        (root / "team-features.json").write_text(json.dumps(value), encoding="utf-8")

    def test_absent_file_is_read_only_default_off_and_does_not_initialize_a_ledger(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "missing-runtime"
            env, summary = configuration(root)
            self.assertEqual(set(env), set(FEATURES.values()))
            self.assertEqual(set(env.values()), {"false"})
            self.assertEqual(summary["configuration"], "default_off")
            self.assertFalse(summary["ledger_contents_verified"])
            self.assertFalse(root.exists())

    def test_guarded_features_need_existing_isolated_pinned_metadata_not_stripe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            value = {"schema_version":1, "features":{"organization_onboarding":True,
                      "self_service_trial":True, "usage_admission_worker":True}}
            self.write(root, value)
            with self.assertRaisesRegex(ConfigurationError, "independent_enrollment_guard_required"):
                configuration(root)
            journal = root / "independent-enrollment.jsonl"
            # Presence is deliberately not proof that this is a valid journal.
            journal.write_text("synthetic-unverified-file\n")
            journal.chmod(0o600)
            original = journal.read_bytes()
            value["enrollment_guard"] = {"path":str(journal), "namespace":str(uuid4())}
            self.write(root, value)
            env, summary = configuration(root)
            self.assertEqual(env["ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED"], "true")
            self.assertEqual(summary["enrollment_guard"], "present_unverified")
            self.assertFalse(summary["ledger_contents_verified"])
            self.assertFalse(summary["enables_stripe"])
            self.assertFalse(summary["enables_organization_rollout"])
            self.assertEqual(journal.read_bytes(), original)
            self.assertFalse(any("STRIPE" in key for key in env))

    @unittest.skipUnless(os.name == "posix", "runtime Unix permission contract")
    def test_public_journal_or_parent_permissions_are_rejected_without_chmod(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            parent = root / "private-proof"
            parent.mkdir(mode=0o700)
            journal = parent / "enrollment.jsonl"
            journal.write_text("synthetic retained proof")
            value = {"schema_version":1, "enrollment_guard":{"path":str(journal), "namespace":str(uuid4())}}
            self.write(root, value)
            journal.chmod(0o644)
            with self.assertRaisesRegex(ConfigurationError, "private_permissions_required"):
                configuration(root)
            self.assertEqual(journal.stat().st_mode & 0o777, 0o644)
            journal.chmod(0o600)
            parent.chmod(0o755)
            with self.assertRaisesRegex(ConfigurationError, "private_permissions_required"):
                configuration(root)
            self.assertEqual(parent.stat().st_mode & 0o777, 0o755)

    def test_reject_unknown_keys_invalid_flags_namespace_and_nonisolated_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            for value in [
                {"schema_version":True}, {"schema_version":2},
                {"schema_version":1, "credential":"synthetic-sensitive-sentinel"},
                {"schema_version":1, "features":{"stripe":True}},
                {"schema_version":1, "features":{"self_service_trial":"true"}},
                {"schema_version":1, "features":{"copilot_weekly":True}},
                {"schema_version":1, "enrollment_guard":{"path":str(root / "absent"), "namespace":str(uuid4())}},
                {"schema_version":1, "enrollment_guard":{"path":str(root / "absent"), "namespace":"0"*32}},
                {"schema_version":1, "enrollment_guard":{"path":str(root.parent / "outside"), "namespace":str(uuid4())}},
            ]:
                self.write(root, value)
                with self.subTest(value=value), self.assertRaises(ConfigurationError) as error:
                    configuration(root)
                self.assertNotIn("synthetic-sensitive-sentinel", str(error.exception))
            (root / "team-features.json").write_text('{"schema_version":1,"features":{},"features":{}}')
            with self.assertRaises(ConfigurationError):
                configuration(root)

    def test_symlink_configuration_is_not_followed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            target = root / "retained-metadata.json"
            target.write_text('{"schema_version":1}')
            (root / "team-features.json").symlink_to(target)
            with self.assertRaises(ConfigurationError):
                configuration(root)
            self.assertEqual(target.read_text(), '{"schema_version":1}')

    def test_stop_and_status_do_not_require_valid_config_or_create_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / "team-features.json").write_text("broken config")
            for command in ("stop", "status"):
                with patch.object(staging, "OUT", root), patch.object(staging, "environment") as environment, \
                        patch.object(staging, "managed") as managed, patch.object(sys, "argv", ["staging", command]):
                    staging.main()
                    managed.assert_called_once()
                    environment.assert_not_called()
            self.assertFalse((root / "environment.json").exists())

    def test_infra_stop_never_loads_config_or_passes_database_credentials(self):
        with patch.object(staging, "environment") as environment, \
                patch.object(staging.subprocess, "run") as run, \
                patch.dict(staging.os.environ, {"TEAM_STAGE_POSTGRES_PASSWORD":"synthetic-secret"}), \
                patch.object(sys, "argv", ["staging", "infra-stop"]):
            staging.main()
            environment.assert_not_called()
            args, kwargs = run.call_args
            self.assertEqual(args[0][-1], "stop")
            self.assertNotIn("down", args[0])
            self.assertNotIn("-v", args[0])
            self.assertEqual(kwargs["env"]["TEAM_STAGE_POSTGRES_PASSWORD"], "unused-for-stop")

    def test_readonly_preflight_reports_configuration_only_without_launching(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve() / "not-created"
            with patch.object(staging, "OUT", root), patch.object(staging, "environment") as environment, \
                    patch.object(staging.subprocess, "run") as run, \
                    patch.object(sys, "argv", ["staging", "preflight-team"]), redirect_stdout(io.StringIO()) as output:
                staging.main()
                summary = json.loads(output.getvalue())
                self.assertFalse(summary["runtime_checked"])
                self.assertFalse(summary["production_ready"])
                environment.assert_not_called()
                run.assert_not_called()
                self.assertFalse(root.exists())

    def test_pilot_wrapper_preserves_arguments_and_requires_explicit_apply_approval(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(staging,'OUT',Path(directory).resolve()):
            prepare = Namespace(command='pilot-prepare',organization=str(uuid4()),expected_owner=str(uuid4()),
                                enabled='false',timezone='Asia/Bangkok',output=str(staging.OUT/'ทดสอบ path'/'plan.json'))
            command = staging.pilot_arguments(prepare)
            self.assertEqual(command[0], 'prepare')
            self.assertEqual(command[command.index('--enabled')+1], 'false')
            self.assertEqual(command[-1], prepare.output)
            apply = Namespace(command='pilot-apply',plan=prepare.output,approve_plan='a'*64,
                              acknowledge_pilot_only=False,acknowledge_no_consent_change=True)
            with self.assertRaises(SystemExit):
                staging.pilot_arguments(apply)
            apply.acknowledge_pilot_only=True
            command=staging.pilot_arguments(apply)
            self.assertEqual(command[0], 'apply')
            self.assertEqual(command[2], prepare.output)
            self.assertIn('--acknowledge-pilot-only', command)
            apply.plan = str(staging.OUT.parent/'other-scope.json')
            with self.assertRaises(SystemExit):
                staging.pilot_arguments(apply)


if __name__ == "__main__":
    unittest.main()
