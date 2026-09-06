from __future__ import annotations

import json
import shlex
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "ai-coverage" / "run_live_certification.py"


def command_for(value: object, exit_code: int = 0) -> str:
    source = f"import json,sys; print(json.dumps({value!r})); sys.exit({exit_code})"
    return f"{shlex.quote(sys.executable)} -c {shlex.quote(source)}"


class LiveCertificationHarnessTest(unittest.TestCase):
    def test_success_is_pending_and_keeps_only_allowlisted_summary(self) -> None:
        payload = {
            "stages": {
                "source_capture": "passed",
                "producer_event": "passed",
                "broker_accept": "passed",
                "canonical_reconcile": "passed",
                "api_delivery": "passed",
                "dashboard_readback": "passed",
            },
            "scenarios": {"single-file": "passed"},
            "metrics": {
                "captured": 1,
                "producer_events": 1,
                "broker_accepted": 1,
                "canonical": 1,
                "delivered": 1,
                "duplicates": 0,
                "replayed": 0,
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "artifact.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--adapter-id",
                    "codex",
                    "--client-id",
                    "codex",
                    "--provider-id",
                    "openai",
                    "--driver",
                    command_for(payload),
                    "--output",
                    str(output),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            artifact = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(artifact["review_status"], "pending")
            self.assertFalse(artifact["promotable"])
            self.assertEqual(artifact["status"], "scaffold")
            serialized = output.read_text(encoding="utf-8")
            self.assertNotIn(str(Path(directory)), serialized)
            self.assertNotIn("raw", serialized)

    def test_driver_failure_is_recorded_as_metadata_only_blocker(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "artifact.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--adapter-id",
                    "codex",
                    "--client-id",
                    "codex",
                    "--provider-id",
                    "openai",
                    "--driver",
                    command_for({"raw": "/Users/private/prompt"}, exit_code=1),
                    "--output",
                    str(output),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            artifact = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(artifact["blockers"], ["driver_failed"])
            self.assertEqual(artifact["stages"][0]["status"], "failed")
            self.assertNotIn("/Users/private", output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
