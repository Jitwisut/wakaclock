"""Regression source only during development-first; no native services here."""
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import native_candidate_smoke as native
from native_smoke_common import SmokeError


class NativeSafetyTest(unittest.TestCase):
    def test_local_host_and_existing_profile_refused_before_service_mutation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(native.platform, "system", return_value="Darwin"), patch.object(native.platform, "machine", return_value="arm64"), patch.object(native, "services") as services:
            home = Path(directory).resolve()
            with self.assertRaisesRegex(SmokeError, "disposable_github"):
                native.require_fresh_runner("darwin-arm64", home, {})
            services.assert_not_called()
            data = home / ".wakaclock"
            data.mkdir()
            retained = data / "retained.json"
            retained.write_text('{"preserved":true}')
            with self.assertRaisesRegex(SmokeError, "fresh_profile"):
                native.require_fresh_runner("darwin-arm64", home, {"GITHUB_ACTIONS":"true", "RUNNER_ENVIRONMENT":"github-hosted"})
            self.assertEqual(retained.read_text(), '{"preserved":true}')
            services.assert_not_called()

    def test_existing_registration_without_data_directory_is_not_owned(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(native.platform, "system", return_value="Windows"), patch.object(native.platform, "machine", return_value="ARM64"), patch.object(native, "services", return_value={"com.atoaxis.wakaclock.capture-S-1-5-21"}):
            home = Path(directory).resolve()
            with self.assertRaisesRegex(SmokeError, "existing_service"):
                native.require_fresh_runner("win32-arm64", home, {"GITHUB_ACTIONS":"true", "RUNNER_ENVIRONMENT":"github-hosted"})
            self.assertFalse((home / ".wakaclock").exists())

    def test_fixture_children_do_not_inherit_provider_or_ci_credentials_or_proxy(self):
        environment = {"HOME":"unchanged-home", "USERPROFILE":"unchanged-profile", "PATH":"tools",
                       "GH_TOKEN":"synthetic-ci-sentinel", "UNKNOWN_SECRET":"synthetic-other-sentinel",
                       "HTTP_PROXY":"synthetic-proxy", "WAKACLOCK_API_KEY":"synthetic-account-sentinel"}
        with patch.dict(os.environ, environment, clear=True):
            selected = native.environment_for_fixture()
        self.assertEqual(selected["HOME"], environment["HOME"])
        self.assertEqual(selected["USERPROFILE"], environment["USERPROFILE"])
        self.assertEqual(selected["NO_PROXY"], "*")
        self.assertFalse({"GH_TOKEN", "UNKNOWN_SECRET", "HTTP_PROXY", "WAKACLOCK_API_KEY"} & selected.keys())

    def test_pause_failure_still_attempts_uninstall_for_every_owned_service(self):
        calls = []
        def command(_binary, args):
            calls.append(args)
            if args[1] == "pause":
                raise SmokeError("fixture_pause_failure")
            return {"installed":False}
        failures = native.cleanup_services(command, Path("owned-binary"), ["capture", "delivery"])
        self.assertEqual(failures, {"pause"})
        self.assertEqual([a[3] for a in calls if a[1] == "uninstall"], ["delivery", "capture"])

    def test_queue_observation_uses_wal_and_rejects_missing_or_duplicate_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            with sqlite3.connect(root / "queue.db") as writer:
                writer.execute("PRAGMA journal_mode=WAL")
                writer.execute("CREATE TABLE heartbeat_queue(heartbeat_id TEXT,payload TEXT)")
                writer.execute("CREATE TABLE editor_handoff_receipts(heartbeat_id TEXT,input_hash TEXT)")
                writer.execute("INSERT INTO heartbeat_queue VALUES('fixture','{}')")
                writer.execute("INSERT INTO editor_handoff_receipts VALUES('fixture',?)", ("a"*64,))
                writer.commit()
                self.assertEqual(native.queue_observation(root, "fixture"), (native.sha(b"{}"), "a"*64))
                writer.execute("INSERT INTO heartbeat_queue VALUES('fixture','{}')")
                writer.commit()
                with self.assertRaisesRegex(SmokeError, "duplicated"):
                    native.queue_observation(root, "fixture")
