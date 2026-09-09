from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "ai-coverage" / "run_codex_cli_campaign.py"

sys.path.insert(0, str(SCRIPT.parent))
import run_codex_cli_campaign as campaign  # noqa: E402


def make_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class CodexCliCampaignTest(unittest.TestCase):
    def test_dry_run_event_parser_keeps_only_opaque_ids(self) -> None:
        output = (
            "== codex ==\n"
            "  [dry-run] evt-1 /private/user/project/a.ts +2/-0 model=gpt-6-astra\n"
            "  [dry-run] evt-2 /private/user/project/b.ts +1/-0 model=gpt-6-astra\n"
        )
        self.assertEqual(campaign.parse_dry_run_event_ids(output), {"evt-1", "evt-2"})

    def test_event_bound_readback_passes_all_external_stages(self) -> None:
        args = type(
            "ReadbackArgs",
            (),
            {
                "readback_user_id": "00000000-0000-4000-8000-000000000001",
                "expected_provider": "openai",
                "expected_model": "gpt-6-astra",
                "clickhouse_url": "http://127.0.0.1:8123",
                "clickhouse_user": "default",
                "clickhouse_password": "default",
            },
        )()

        def fake_json_request(method: str, url: str, **_: object):
            if "/heartbeats?" in url:
                return 200, {
                    "data": [
                        {
                            "ai_event_id": "evt-1",
                            "actor_type": "ai_verified",
                            "ai_agent": "codex",
                            "ai_provider": "openai",
                            "ai_model": "gpt-6-astra",
                        }
                    ]
                }
            if "/dashboard/analytics?" in url:
                return 200, {
                    "schema_version": 3,
                    "daily_attribution": [
                        {
                            "ai_added": 2,
                            "ai_deleted": 0,
                            "ai_verified_added": 2,
                            "ai_verified_deleted": 0,
                        }
                    ],
                }
            raise AssertionError(url)

        canonical_rows = [
            {
                "ai_event_id": "evt-1",
                "revision": 0,
                "actor_type": "ai_verified",
                "ai_agent": "codex",
                "ai_provider": "openai",
                "ai_model": "gpt-6-astra",
                "ai_lines_added": 2,
                "ai_lines_deleted": 0,
            }
        ]
        with patch.object(campaign, "_json_request", side_effect=fake_json_request), patch.object(
            campaign, "_clickhouse_rows", return_value=canonical_rows
        ):
            stages, metrics, blockers = campaign._readback_campaign(
                args,
                campaign_url="http://127.0.0.1:8080",
                campaign_key="throwaway-key",
                event_ids={"evt-1"},
                started_at=1_756_000_000.0,
                finished_at=1_756_000_010.0,
                baseline_dashboard={
                    "ai_added": 0,
                    "ai_deleted": 0,
                    "ai_verified_added": 0,
                    "ai_verified_deleted": 0,
                },
            )
        self.assertEqual(stages["api_delivery"], "passed")
        self.assertEqual(stages["canonical_reconcile"], "passed")
        self.assertEqual(stages["dashboard_readback"], "passed")
        self.assertEqual(metrics, {"delivered": 1, "canonical": 1})
        self.assertEqual(blockers, [])

    def run_driver(
        self,
        args: list[str],
        sandbox: Path,
        extra_env: dict[str, str] | None = None,
    ) -> dict[str, object]:
        env = {
            **os.environ,
            "WAKACLOCK_CERTIFICATION_SANDBOX": str(sandbox),
            **(extra_env or {}),
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
                [
                    "--execute",
                    "--allow-shared-account",
                    "--codex",
                    str(fake_codex),
                    "--scenario-id",
                    "single-file",
                ],
                sandbox,
            )
            self.assertEqual(summary["stages"]["source_capture"], "failed")
            self.assertIn("codex_auth_home_not_configured", summary["blockers"])
            self.assertEqual(summary["scenarios"]["single-file"], "not_run")

    def test_execute_refuses_a_shared_account_without_isolation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            summary = self.run_driver(
                ["--execute", "--codex", "codex", "--scenario-id", "single-file"],
                Path(directory),
            )
            self.assertIn("campaign_identity_not_isolated", summary["blockers"])
            self.assertTrue(all(status == "not_run" for status in summary["scenarios"].values()))

    def test_shared_transcript_home_is_blocked_even_with_isolated_api(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sandbox = Path(directory)
            personal = sandbox / "personal-codex"
            personal.mkdir()
            fake_codex = sandbox / "codex"
            make_executable(fake_codex, "#!/usr/bin/env python3\nraise RuntimeError('must not run')\n")
            for selected in (personal, personal / "nested"):
                with self.subTest(selected=selected):
                    summary = self.run_driver(
                        ["--execute", "--campaign-api-key", "throwaway-key",
                         "--codex", str(fake_codex), "--codex-home", str(selected)],
                        sandbox,
                        {"CODEX_HOME": str(personal)},
                    )
                    self.assertIn("campaign_transcript_home_not_isolated", summary["blockers"])
                    self.assertTrue(all(value == "not_run" for value in summary["scenarios"].values()))

    def test_campaign_api_key_satisfies_isolation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            summary = self.run_driver(
                [
                    "--execute",
                    "--campaign-api-key",
                    "throwaway-key",
                    "--codex",
                    "codex",
                    "--scenario-id",
                    "single-file",
                ],
                Path(directory),
            )
            self.assertNotIn("campaign_identity_not_isolated", summary["blockers"])

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
    if '--sandbox' in args and '--approve-for-me' in args:
        raise SystemExit(7)
    if '--skip-git-repo-check' not in args:
        raise SystemExit(7)
    if not (Path.cwd() / '.git').is_dir():
        raise SystemExit(7)
    if 'rename-source.txt' in args[-1]:
        root = Path.cwd()
        if not (root / 'rename-source.txt').is_file() or not (root / 'delete-me.txt').is_file():
            raise SystemExit(7)
    root = Path(os.environ['CODEX_HOME']) / 'sessions' / '2026' / '09' / '06'
    root.mkdir(parents=True, exist_ok=True)
    thread_id = '01testthread0000000000000000'
    (root / f'rollout-{time.time_ns()}-{thread_id}.jsonl').write_text(
        json.dumps({'type': 'session_meta'}) + '\\n', encoding='utf-8'
    )
    print(json.dumps({'type': 'thread.started', 'thread_id': thread_id}))
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
    print('  1 event(s) parsed since last sync, 0 already delivered, 1 new')
    print('  broker accepted 1 (duplicates 0)')
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            summary = self.run_driver(
                [
                    "--execute",
                    "--allow-shared-account",
                    "--codex",
                    str(fake_codex),
                    "--codex-home",
                    str(codex_home),
                    "--wakaclock",
                    str(fake_wakaclock),
                    "--scenario-id",
                    "single-file",
                    "--deliver",
                ],
                sandbox,
                {
                    "WAKACLOCK_SERVER_URL": "http://127.0.0.1:8080",
                    "WAKACLOCK_API_KEY": "test-key",
                },
            )
            self.assertEqual(summary["stages"]["source_capture"], "passed")
            self.assertEqual(summary["stages"]["producer_event"], "passed")
            self.assertEqual(summary["scenarios"]["single-file"], "passed")
            self.assertEqual(summary["metrics"]["captured"], 1)
            self.assertEqual(summary["stages"]["broker_accept"], "passed")
            self.assertEqual(summary["stages"]["api_delivery"], "not_run")
            self.assertIn("api_delivery_readback_not_configured", summary["blockers"])
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
    if '--skip-git-repo-check' not in args:
        raise SystemExit(7)
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
    print('  1 event(s) parsed since last sync, 0 already delivered, 1 new')
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            summary = self.run_driver(
                [
                    "--execute",
                    "--allow-shared-account",
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

    def test_retry_dedup_requires_a_second_delivered_sync(self) -> None:
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
    if '--skip-git-repo-check' not in args:
        raise SystemExit(7)
    root = Path(os.environ['CODEX_HOME']) / 'sessions' / '2026' / '09' / '06'
    root.mkdir(parents=True, exist_ok=True)
    thread_id = '01retrythread0000000000000000'
    (root / f'rollout-{time.time_ns()}-{thread_id}.jsonl').write_text(
        json.dumps({'type': 'session_meta'}) + '\\n', encoding='utf-8'
    )
    print(json.dumps({'type': 'thread.started', 'thread_id': thread_id}))
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            fake_wakaclock = sandbox / "wakaclock"
            make_executable(
                fake_wakaclock,
                """#!/usr/bin/env python3
import os
import sys
from pathlib import Path

if 'sync' in sys.argv:
    state = Path(os.environ['WAKACLOCK_CERTIFICATION_SANDBOX']) / 'sync-count'
    count = int(state.read_text()) if state.exists() else 0
    state.write_text(str(count + 1))
    if count == 0:
        print('  1 event(s) parsed since last sync, 0 already delivered, 1 new')
        print('  broker accepted 1 (duplicates 0)')
    else:
        print('  1 event(s) parsed since last sync, 1 already delivered, 0 new')
        print('  broker accepted 0 (duplicates 1)')
    raise SystemExit(0)
raise SystemExit(2)
""",
            )
            summary = self.run_driver(
                [
                    "--execute",
                    "--allow-shared-account",
                    "--codex",
                    str(fake_codex),
                    "--codex-home",
                    str(codex_home),
                    "--wakaclock",
                    str(fake_wakaclock),
                    "--scenario-id",
                    "retry-dedup",
                    "--deliver",
                ],
                sandbox,
                {
                    "WAKACLOCK_SERVER_URL": "http://127.0.0.1:8080",
                    "WAKACLOCK_API_KEY": "test-key",
                },
            )
            self.assertEqual(summary["scenarios"]["retry-dedup"], "passed")
            self.assertEqual(summary["metrics"]["replayed"], 1)
            self.assertEqual(summary["metrics"]["duplicates"], 1)


if __name__ == "__main__":
    unittest.main()
