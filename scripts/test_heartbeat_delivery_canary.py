"""Override provenance checks use disposable metadata, never a real key or API."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("canary", Path(__file__).with_name("heartbeat-delivery-canary.py"))
canary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canary)


class ExtensionOverrideTests(unittest.TestCase):
    def test_jsonc_override_is_verified_without_leaking_other_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            binary = root / "wakaclock"
            binary.write_bytes(b"verified-build")
            settings = root / "settings.json"
            settings.write_text('// "wakaclock.cliPath": "/obsolete",\n' + '{\n"wakaclock.cliPath": ' + json.dumps(str(binary)) + ',\n"private": "DO_NOT_STORE_SECRET",\n}\n')
            deployment = root / "deployment.json"
            deployment.write_text(json.dumps({"sha256": {"client": hashlib.sha256(binary.read_bytes()).hexdigest()}}))
            result = canary.extension_override_runtime(settings, deployment)
            self.assertEqual(result["status"], "verified")
            self.assertNotIn("DO_NOT_STORE_SECRET", json.dumps(result))
            binary.write_bytes(b"older-build")
            result = canary.extension_override_runtime(settings, deployment)
            self.assertEqual(result["status"], "unconfirmed")
            self.assertEqual(result["error_code"], "extension_override_build_mismatch")

    def test_missing_or_unresolvable_metadata_is_not_a_verified_override(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = root / "settings.json"
            deployment = root / "deployment.json"
            self.assertEqual(canary.extension_override_runtime(settings, deployment)["status"], "not_configured")
            for value in ['{"wakaclock.cliPath":"wakaclock"}', '{"wakaclock.cliPath":"/does-not-exist"}', '{invalid']:
                settings.write_text(value)
                self.assertEqual(canary.extension_override_runtime(settings, deployment)["status"], "unconfirmed")


class ScopeBindingTests(unittest.TestCase):
    def test_legacy_worker_requires_recent_archive_from_same_scope_and_process(self):
        import datetime as dt
        now = dt.datetime(2026, 10, 8, 12, tzinfo=canary.TZ)
        worker = {"pid": 123, "checked_at": now.isoformat(), "pending": 0}
        entry = {"scope": "account-A", "observation": worker}
        self.assertEqual(canary.scoped_worker_evidence(worker,[entry],"account-A",now),worker)
        self.assertIsNone(canary.scoped_worker_evidence(worker,[entry],"account-B",now))
        self.assertIsNone(canary.scoped_worker_evidence({**worker,"pid":124},[entry],"account-A",now))
        self.assertIsNone(canary.scoped_worker_evidence(worker,[entry],"account-A",now+dt.timedelta(seconds=91)))


class DailyEvidenceTests(unittest.TestCase):
    def test_recovery_today_does_not_certify_yesterday(self):
        import datetime as dt
        day = dt.date(2026, 10, 8)
        now = dt.datetime(2026, 10, 10, tzinfo=canary.TZ)
        current = {'checked_at': now.isoformat(), 'scope': 'account', 'delivery_complete': True,
                   'capture_complete': True, 'runtime_complete': True}
        result = canary.daily_evidence(day, now, 'account', [current], True, [])
        self.assertEqual(result['status'], 'unconfirmed')
        self.assertEqual(result['reason'], 'day_observations_missing')

    def test_partial_day_and_monitor_only_are_never_counted(self):
        import datetime as dt
        day = dt.date(2026, 10, 8)
        now = dt.datetime(2026, 10, 8, 23, tzinfo=canary.TZ)
        self.assertEqual(canary.daily_evidence(day, now, 'x', [], True, [])['reason'], 'day_not_closed')
        now += dt.timedelta(days=1)
        self.assertEqual(canary.daily_evidence(day, now, 'x', [], False, [])['reason'], 'user_activity_unconfirmed')

    def test_closed_day_requires_scoped_build_and_activity_coverage(self):
        import datetime as dt
        day = dt.date(2026, 10, 8)
        now = dt.datetime(2026, 10, 9, tzinfo=canary.TZ)
        at = dt.datetime(2026, 10, 8, 12, tzinfo=canary.TZ)
        sample = {'checked_at': at.isoformat(), 'scope': 'x', 'delivery_complete': True,
                  'capture_complete': True, 'runtime_complete': True,
                  'worker_binary_sha256': 'a', 'capture_generation': {'binary_sha256': 'b'}}
        interval = [[at.timestamp(), at.timestamp()+30]]
        result = canary.daily_evidence(day, now, 'x', [sample], True, interval)
        self.assertEqual(result['status'], 'observed')
        sample['capture_complete'] = False
        self.assertEqual(canary.daily_evidence(day, now, 'x', [sample], True, interval)['status'], 'unconfirmed')

    def test_revisions_preserve_old_decisions_and_do_not_duplicate(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'day.json'
            first = {'date': '2026-10-08', 'status': 'unconfirmed'}
            self.assertEqual(canary.save_revision(path, first)['revision'], 1)
            self.assertEqual(canary.save_revision(path, first)['revision'], 1)
            second = {'date': '2026-10-08', 'status': 'observed'}
            self.assertEqual(canary.save_revision(path, second)['revision'], 2)
            self.assertEqual(json.loads((path.parent/'day-revisions/000001.json').read_text())['status'], 'unconfirmed')

if __name__ == "__main__":
    unittest.main()
