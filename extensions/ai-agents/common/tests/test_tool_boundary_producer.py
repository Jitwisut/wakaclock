import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).parents[2]
spec = importlib.util.spec_from_file_location("tool_boundary", ROOT / "common/tool-boundary-producer.py")
producer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(producer)


class BoundaryTests(unittest.TestCase):
    def input(self, root, adapter="codex"):
        return {"tool_event_id": "stable-call", "agent": adapter, "session_id": "session",
                "tool": "shell", "cwd": str(root), "transport": "shell_hook"}

    def bind(self, home, adapter="codex", surface="cli"):
        directory = home / ".wakaclock/native-producer-bindings"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"{adapter}-{surface}.json").write_text(json.dumps({"scope_id": "a" * 64}))

    def test_missing_cli_keeps_both_real_boundaries_without_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            file = root / "a.ts"; file.write_text("PRIVATE_BEFORE_SENTINEL\n")
            self.assertEqual(producer.run("before", self.input(root), "/missing/cli", "cli", home), "handoff_pending")
            file.write_text("PRIVATE_AFTER_SENTINEL\nsecond\n")
            self.assertEqual(producer.run("after", self.input(root), "/missing/cli", "cli", home), "handoff_pending")
            records = [json.loads(p.read_text()) for p in (home / ".wakaclock/native-producer-spool").rglob("*.json")]
            self.assertEqual(len(records), 2)
            phases = {r["metadata"]["phase"]: r for r in records}
            self.assertEqual(phases["before"]["metadata"]["snapshot"]["files"]["a.ts"]["line_count"], 1)
            self.assertEqual(phases["after"]["metadata"]["snapshot"]["files"]["a.ts"]["line_count"], 2)
            stored = json.dumps(records)
            self.assertNotIn("PRIVATE_BEFORE_SENTINEL", stored); self.assertNotIn("PRIVATE_AFTER_SENTINEL", stored)
            file.unlink()
            self.assertEqual(json.dumps(records), stored)  # Replay has immutable evidence.

    def test_git_hashes_and_after_numstat_are_frozen_at_boundary(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            def git(*args):
                return subprocess.run(["git", "-C", str(root), *args], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
            git("init", "-q"); file = root / "a.ts"; file.write_text("before\n")
            git("add", "a.ts"); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture")
            _, start = producer.retain("before", self.input(root), "cli", home)
            before = start["metadata"]["snapshot"]["files"]["a.ts"]
            self.assertEqual(before["content_hash"], git("rev-parse", "HEAD:a.ts").decode().strip())
            self.assertIsNone(before["line_count"]); self.assertFalse(before["dirty_before"])
            file.write_text("after\nextra\n")
            _, end = producer.retain("after", self.input(root), "cli", home)
            self.assertEqual(end["metadata"]["numstat"]["a.ts"], {"added": 2, "deleted": 1})
            frozen = json.dumps(end)
            git("add", "a.ts"); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "later")
            file.write_text("later unrelated data\n")
            self.assertEqual(json.dumps(end), frozen)

    def test_cli_cannot_be_invoked_before_durable_acceptance(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            def cli(*args, **kwargs):
                records = list((home / ".wakaclock/native-producer-spool").rglob("*.json"))
                self.assertEqual(len(records), 1)
                json.loads(records[0].read_text())
                raise FileNotFoundError("missing CLI")
            with patch.object(producer.subprocess, "run", side_effect=cli), patch.object(producer, "capture", return_value=None):
                # A scan unavailable must be explicit, not an empty successful map.
                with patch.object(producer, "capture", side_effect=ValueError("failed scan")):
                    self.assertEqual(producer.run("before", self.input(root), "/missing/cli", "cli", home), "handoff_pending")

    def test_disk_failure_does_not_attempt_cli_or_claim_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            with patch.object(producer.common, "durable_file", side_effect=OSError("full")), patch.object(producer.subprocess, "run") as cli:
                with self.assertRaises(OSError): producer.run("abort", self.input(root), "/cli", "cli", home)
                cli.assert_not_called()

    def test_failed_scan_is_durable_unavailable_not_empty_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); self.bind(home)
            _, record = producer.retain("after", self.input(home / "missing"), "cli", home)
            self.assertIsNone(record["metadata"]["snapshot"])
            self.assertEqual(record["metadata"]["measurement_error"], "tool_boundary_measurement_unavailable")

    def test_pause_and_unknown_owner_never_rebind(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir()
            self.assertEqual(producer.run("abort", self.input(root), "/missing", "cli", home), "producer_owner_unconfirmed")
            parked = next((home / ".wakaclock/native-producer-spool/unconfirmed").glob("*.json"))
            original = parked.read_bytes(); self.bind(home)
            self.assertEqual(parked.read_bytes(), original)
            (home / ".wakaclock/runtime-desired.json").write_text(json.dumps({"schema_version": 1, "desired": {"capture": False}}))
            self.assertEqual(producer.run("before", self.input(root), "/missing", "cli", home), "paused_by_user")
            self.assertEqual(len(list((home / ".wakaclock/native-producer-spool").rglob("*.json"))), 1)

    def test_missing_workspace_never_uses_producer_current_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); self.bind(home)
            input = self.input(home); del input["cwd"]
            _, record = producer.retain("before", input, "cli", home)
            self.assertIsNone(record["metadata"]["snapshot"])
            self.assertEqual(record["metadata"]["measurement_error"], "tool_boundary_measurement_unavailable")

    def test_before_evidence_survives_spool_ack_and_later_git_initialization(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            (root / "a.ts").write_text("one\n")
            file, before = producer.retain("before", self.input(root), "cli", home)
            file.unlink()  # Collector has durably handed off the original.
            subprocess.run(["git", "-C", str(root), "init", "-q"], check=True)
            (root / "a.ts").write_text("two\nthree\n")
            _, after = producer.retain("after", self.input(root), "cli", home)
            self.assertFalse(before["metadata"]["snapshot"]["git_backed"])
            self.assertFalse(after["metadata"]["snapshot"]["git_backed"])
            self.assertEqual(after["metadata"]["snapshot"]["files"]["a.ts"]["line_count"], 2)
            self.assertEqual(after["metadata"]["numstat"], {})

    def test_cached_before_conflict_stops_before_cli_or_new_spool(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp); root = home / "repo"; root.mkdir(); self.bind(home)
            producer.retain("before", self.input(root), "cli", home)
            cache = next((home / ".wakaclock/tool-boundary-evidence").rglob("*.before.json"))
            record = json.loads(cache.read_text()); record["metadata"]["input"]["session_id"] = "foreign"
            cache.write_text(json.dumps(record))
            with patch.object(producer.subprocess, "run") as cli:
                with self.assertRaisesRegex(ValueError, "cached_evidence_conflict"):
                    producer.run("after", self.input(root), "/cli", "cli", home)
                cli.assert_not_called()
            self.assertEqual(len(list((home / ".wakaclock/native-producer-spool").rglob("*.json"))), 1)

    def test_shell_paths_store_boundary_when_cli_absent(self):
        scripts = [("codex/git-sweep-before.sh", "before"), ("codex/git-sweep-after.sh", "after"),
                   ("codex/tool-abort.sh", "abort"), ("common/git-sweep-before.sh", "before"),
                   ("common/git-sweep-after.sh", "after"), ("cursor/scripts/git-sweep-before.sh", "before"),
                   ("cursor/scripts/git-sweep-after.sh", "after"), ("gemini-cli/scripts/git-sweep-before.sh", "before"),
                   ("gemini-cli/scripts/git-sweep-after.sh", "after"), ("plugins/atoaxis-heartbeat/scripts/git-sweep-before.sh", "before"),
                   ("plugins/atoaxis-heartbeat/scripts/git-sweep-after.sh", "after"), ("plugins/atoaxis-heartbeat/scripts/tool-abort.sh", "abort"),
                   ("kimi-code/hooks/pre-tool-use.sh", "before"), ("kimi-code/hooks/post-tool-use.sh", "after"),
                   ("kimi-code/hooks/post-tool-use-failure.sh", "abort")]
        for script, phase in scripts:
            with self.subTest(script=script), tempfile.TemporaryDirectory() as tmp:
                home = Path(tmp); root = home / "repo"; root.mkdir()
                payload = {"session_id": "s", "tool_use_id": "c", "tool_call_id": "c", "tool_name": "Bash", "cwd": str(root), "tool_input": {"command": "PRIVATE_COMMAND_SENTINEL"}, "tool_response": "PRIVATE_RESPONSE_SENTINEL"}
                env = {**os.environ, "ATOAXIS_PRODUCER_HOME": str(home), "WAKACLOCK_CLI_PATH": str(home / "missing-cli")}
                result = subprocess.run(["bash", str(ROOT / script)], input=json.dumps(payload).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=root, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr.decode())
                rows = list((home / ".wakaclock/native-producer-spool/unconfirmed").glob("*.json"))
                self.assertEqual(len(rows), 1, result.stderr.decode())
                text = rows[0].read_text(); record = json.loads(text)
                self.assertEqual(record["metadata"]["phase"], phase)
                self.assertNotIn("PRIVATE_COMMAND_SENTINEL", text); self.assertNotIn("PRIVATE_RESPONSE_SENTINEL", text)


if __name__ == "__main__":
    unittest.main()
