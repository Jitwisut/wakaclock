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


if __name__ == "__main__":
    unittest.main()
