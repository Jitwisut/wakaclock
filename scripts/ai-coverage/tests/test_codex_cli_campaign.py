from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "ai-coverage" / "run_codex_cli_campaign.py"


def make_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class CodexCliCampaignTest(unittest.TestCase):
    def run_driver(self, args: list[str], sandbox: Path) -> dict[str, object]:
        env = {
            **os.environ,
            "WAKACLOCK_CERTIFICATION_SANDBOX": str(sandbox),
        }
        result = subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_campaign_is_disabled_without_explicit_execute(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            summary = self.run_driver([], Path(directory))
            self.assertEqual(summary["blockers"], ["campaign_not_enabled"])
            self.assertTrue(all(status == "not_run" for status in summary["scenarios"].values()))

    def test_missing_auth_is_a_blocker_and_never_a_pass(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            fake_codex = sandbox / "codex"
            make_executable(
                fake_codex,
                "#!/usr/bin/env python3\nprint('codex-cli 0.153.4')\n",
            )
            summary = self.run_driver(
                ["--execute", "--codex", str(fake_codex), "--scenario-id", "single-file"],
                sandbox,
            )
            self.assertEqual(summary["stages"]["source_capture"], "failed")
            self.assertIn("codex_auth_home_not_configured", summary["blockers"])
            self.assertEqual(summary["scenarios"]["single-file"], "not_run")

    def test_fake_campaign_keeps_only_bounded_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            codex_home = sandbox / "codex-home"
            codex_home.mkdir()
            fake_codex = sandbox / "codex"
            make_executable(
                fake_codex,
                """#!/usr/bin/env python3
import json
import os
import sys
import time
from pathlib import Path

args = sys.argv[1:]
if args == ['--version']:
    print('codex-cli 0.153.4')
    raise SystemExit(0)
if args[:2] == ['login', 'status']:
    print('logged in')
    raise SystemExit(0)
if args and args[0] == 'exec':
    if 'rename-source.txt' in args[-1]:
        root = Path.cwd()
        if not (root / 'rename-source.txt').is_file() or not (root / 'delete-me.txt').is_file():
            raise SystemExit(7)
    root = Path(os.environ['CODEX_HOME']) / 'sessions' / '2026' / '09' / '06'
    root.mkdir(parents=True, exist_ok=True)
    (root / f'rollout-{time.time_ns()}.jsonl').write_text(
        json.dumps({'type': 'session_meta'}) + '\\n', encoding='utf-8'
    )
    print(json.dumps({'type': 'task_complete'}))
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            fake_wakaclock = sandbox / "wakaclock"
            make_executable(
                fake_wakaclock,
                """#!/usr/bin/env python3
import sys
if 'sync' in sys.argv:
    print('  1 event(s) parsed since last scan, 0 already delivered, 1 new')
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            summary = self.run_driver(
                [
                    "--execute",
                    "--codex",
                    str(fake_codex),
                    "--codex-home",
                    str(codex_home),
                    "--wakaclock",
                    str(fake_wakaclock),
                    "--scenario-id",
                    "single-file",
                ],
                sandbox,
            )
            self.assertEqual(summary["stages"]["source_capture"], "passed")
            self.assertEqual(summary["stages"]["producer_event"], "passed")
            self.assertEqual(summary["scenarios"]["single-file"], "passed")
            self.assertEqual(summary["metrics"]["captured"], 1)
            serialized = json.dumps(summary)
            self.assertNotIn(str(sandbox), serialized)
            self.assertNotIn("single.txt", serialized)

    def test_create_delete_rename_seeds_files_inside_codex_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            codex_home = sandbox / "codex-home"
            codex_home.mkdir()
            fake_codex = sandbox / "codex"
            make_executable(
                fake_codex,
                """#!/usr/bin/env python3
import json
import os
import sys
import time
from pathlib import Path

args = sys.argv[1:]
if args == ['--version']:
    print('codex-cli 0.153.4')
    raise SystemExit(0)
if args[:2] == ['login', 'status']:
    raise SystemExit(0)
if args and args[0] == 'exec':
    if 'rename-source.txt' in args[-1]:
        root = Path.cwd()
        if not (root / 'rename-source.txt').is_file() or not (root / 'delete-me.txt').is_file():
            raise SystemExit(7)
    root = Path(os.environ['CODEX_HOME']) / 'sessions' / '2026' / '09' / '06'
    root.mkdir(parents=True, exist_ok=True)
    (root / f'rollout-{time.time_ns()}.jsonl').write_text(
        json.dumps({'type': 'session_meta'}) + '\\n', encoding='utf-8'
    )
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            fake_wakaclock = sandbox / "wakaclock"
            make_executable(
                fake_wakaclock,
                """#!/usr/bin/env python3
import sys
if 'sync' in sys.argv:
    print('  1 event(s) parsed since last scan, 0 already delivered, 1 new')
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            summary = self.run_driver(
                [
                    "--execute",
                    "--codex",
                    str(fake_codex),
                    "--codex-home",
                    str(codex_home),
                    "--wakaclock",
                    str(fake_wakaclock),
                    "--scenario-id",
                    "create-delete-rename",
                ],
                sandbox,
            )
            self.assertEqual(summary["scenarios"]["create-delete-rename"], "passed")


if __name__ == "__main__":
    unittest.main()
