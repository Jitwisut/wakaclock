"""Artifact gate fixtures; these do not execute or certify native binaries."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from internal_candidate_preflight import HOSTS
from package_internal_candidate import TARGETS, package_candidate
from test_internal_candidate import fixture, COMMIT
from verify_candidate_matrix import verify_matrix, REQUIRED_SMOKE


def matrix(root, *, passed=False):
    for target in TARGETS:
        vsix = root / f"{target}.vsix"
        fixture(vsix, target)
        report_file = package_candidate(vsix, COMMIT, root)
        package = json.loads(report_file.read_text())
        system, arch, host = HOSTS[target]
        (root / f"native-runner-{target}.json").write_text(json.dumps({"source_commit":COMMIT,
            "target":target, "native_runner_preflight":"passed", "system":system,
            "machine":"x86_64" if arch == "x64" else "arm64", "node_arch":arch,"rust_host":host}))
        smoke = {"source_commit":COMMIT,"target":target,"status":"pending","reason":"native_smoke_not_requested"}
        if passed:
            smoke.update({"status":"passed","binary_sha256":package["binary_sha256"],
                "vsix_sha256":package["artifacts"][vsix.name],
                "checks":{name:{"status":"passed"} for name in REQUIRED_SMOKE}})
            smoke["checks"]["upgrade_rollback"].update({"previous_commit":"d"*40,
                "previous_binary_sha256":"e"*64,"installed_binary_sha256":package["binary_sha256"]})
            smoke["checks"]["queue_receipts_preserved"].update({"fixture_records":1,
                "server_acceptance":"not_tested_503_fixture","payload_sha256":"a"*64,"input_sha256":"b"*64})
            smoke["checks"]["vsix_install_activation"].update({"source_commit":COMMIT,"target":target,
                "binary_sha256":package["binary_sha256"],"vscode_version":"1.100.0","installed":True,
                "activated":True,"commands_registered":True,"bundled_cli_executed":True,"custom_override_preserved":True})
        (root / f"native-smoke-{target}.json").write_text(json.dumps(smoke))


class MatrixGateTest(unittest.TestCase):
    def test_all_eight_verified_artifacts_do_not_turn_missing_native_tests_into_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); matrix(root)
            result = verify_matrix(root, COMMIT)
            self.assertTrue(result["all_artifacts_verified"])
            self.assertEqual(result["status"], "pending")
            self.assertFalse(result["native_smoke_complete"])
            self.assertFalse(result["internal_test_ready"])
            self.assertFalse(result["production_ready"])

    def test_complete_native_fixture_still_does_not_certify_provider_or_stable_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); matrix(root, passed=True)
            result = verify_matrix(root, COMMIT)
            self.assertTrue(result["internal_test_ready"])
            self.assertEqual(result["provider_certification"], "pending")
            self.assertEqual(result["signing"], "unsigned")
            self.assertFalse(result["production_ready"])

    def test_forged_pass_missing_activation_and_cross_architecture_evidence_fail_closed(self):
        for broken in ("activation", "architecture", "source", "artifact", "same_baseline"):
            with self.subTest(broken=broken), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); matrix(root, passed=True)
                target = "win32-arm64"
                smoke_path = root / f"native-smoke-{target}.json"
                smoke = json.loads(smoke_path.read_text())
                if broken == "activation":
                    smoke["checks"]["vsix_install_activation"]["activated"] = False
                elif broken == "same_baseline":
                    smoke["checks"]["upgrade_rollback"]["previous_commit"] = COMMIT
                elif broken == "architecture":
                    path = root / f"native-runner-{target}.json"
                    value = json.loads(path.read_text()); value["node_arch"] = "x64"
                    path.write_text(json.dumps(value))
                elif broken == "source":
                    smoke["source_commit"] = "f"*40
                else:
                    (root / f"{target}.vsix").write_bytes(b"changed artifact")
                smoke_path.write_text(json.dumps(smoke))
                result = verify_matrix(root, COMMIT)
                self.assertEqual(result["status"], "failed")
                self.assertFalse(result["internal_test_ready"])
