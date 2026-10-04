#!/usr/bin/env python3
"""External-process integration checks for the AI attribution matrix.

`docs/ai-attribution-test-matrix.md` marks several scenarios "Manual CI
external-process check" because a fixture-only unit test cannot prove a real
process boundary — a real shell command actually mutating a real file, a real
git operation with no AI evidence attached. This script is that check: it
builds the real `wakaclock` CLI binary, runs it as a real subprocess against a
real temporary git repository, performs the real external mutation (sed,
a Python codemod, `git checkout`, `git merge`), and inspects the heartbeat
payload that actually reached a fake backend HTTP server.

Run after `cargo build -p wakaclock-cli`:

    python3 scripts/ai-attribution-integration.py

Exits 1 and prints every failure if any scenario's assertions do not hold.
"""
from __future__ import annotations

import json
import os
import platform
import queue
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
BINARY = REPO_ROOT / "backend" / "api" / "target" / "debug" / (
    "wakaclock.exe" if sys.platform == "win32" else "wakaclock"
)

CAPTURED: "queue.Queue[dict]" = queue.Queue()


class CapturingHandler(BaseHTTPRequestHandler):
    def _capture(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw.decode("utf-8", errors="replace")
        CAPTURED.put({"path": self.path, "payload": payload})
        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 (BaseHTTPRequestHandler naming)
        self._capture()

    def log_message(self, _format: str, *_args: object) -> None:
        pass


def start_fake_server() -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", 0), CapturingHandler)
    import threading

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def drain_heartbeats(timeout: float = 3.0) -> list[dict]:
    """Collect every heartbeat the CLI sent, from either the single or bulk route."""
    import time

    collected: list[dict] = []
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            item = CAPTURED.get(timeout=0.1)
        except queue.Empty:
            continue
        payload = item["payload"]
        if isinstance(payload, list):
            collected.extend(payload)
        elif isinstance(payload, dict):
            collected.append(payload)
    return collected


def run_cli(args: list[str], cwd: Path, env: dict[str, str], stdin: str | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [str(BINARY), *args],
        cwd=cwd,
        env=env,
        input=stdin,
        capture_output=True,
        text=True,
        timeout=30,
    )


def base_env(home_dir: Path, server_url: str) -> dict[str, str]:
    env = dict(os.environ)
    env["HOME"] = str(home_dir)
    env["USERPROFILE"] = str(home_dir)
    env["CODEX_HOME"] = str(home_dir / ".codex")
    env["CLAUDE_CONFIG_DIR"] = str(home_dir / ".claude")
    env["XDG_CONFIG_HOME"] = str(home_dir / ".config")
    env["WAKACLOCK_SERVER_URL"] = server_url
    env["WAKACLOCK_API_KEY"] = "integration-test-key"
    # Producers persist to the local inbox; a later bounded sync drains work that
    # was deferred for editor correlation. No background broker is expected.
    # The freshly-built debug binary is not on PATH; the shell hook scripts (see
    # extensions/ai-agents/*/scripts/) all resolve WAKACLOCK_CLI_PATH before falling
    # back to a bare `wakaclock` lookup.
    env["WAKACLOCK_CLI_PATH"] = str(BINARY)
    return env


def init_git_repo(path: Path, filename: str, content: str) -> None:
    subprocess.run(["git", "init", "-q"], cwd=path, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=path, check=True)
    subprocess.run(["git", "config", "user.name", "Integration Test"], cwd=path, check=True)
    (path / filename).write_text(content)
    subprocess.run(["git", "add", filename], cwd=path, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "initial"], cwd=path, check=True)


def sed_inplace(path: Path, pattern: str, replacement: str) -> None:
    if platform.system() == "Darwin":
        subprocess.run(["sed", "-i", "", f"s/{pattern}/{replacement}/", str(path)], check=True)
    else:
        subprocess.run(["sed", "-i", f"s/{pattern}/{replacement}/", str(path)], check=True)


class Failure(AssertionError):
    pass


def check(condition: bool, message: str) -> None:
    if not condition:
        raise Failure(message)


def scenario_shell_mutation(server_url: str, agent: str, provider: str | None, mutate) -> None:
    """Shared engine behind the Claude/Codex/Gemini "shell mutation" matrix rows.

    `ai tool-before`/`ai tool-after` is the same metadata-only snapshot-diff engine
    for every agent (see `tool_snapshot.rs`); only the `agent` label differs. This
    proves the real snapshot -> real mutation -> real diff -> real heartbeat pipeline
    for each label, not just that the parser accepts the label.
    """
    with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as home_dir:
        repo = Path(repo_dir)
        init_git_repo(repo, "app.py", "value = 1\n")
        env = base_env(Path(home_dir), server_url)
        tool_event_id = f"{agent}-{uuid.uuid4()}"

        before = run_cli(
            ["ai", "tool-before", "--json"],
            cwd=repo,
            env=env,
            stdin=json.dumps(
                {
                    "tool_event_id": tool_event_id,
                    "agent": agent,
                    "provider": provider,
                    "tool": "Bash",
                    "workspace_root": str(repo),
                    "cwd": str(repo),
                }
            ),
        )
        check(before.returncode == 0, f"[{agent}] ai tool-before failed: {before.stderr}")

        mutate(repo / "app.py")

        after = run_cli(
            ["ai", "tool-after", "--json"],
            cwd=repo,
            env=env,
            stdin=json.dumps({"tool_event_id": tool_event_id, "agent": agent}),
        )
        check(after.returncode == 0, f"[{agent}] ai tool-after failed: {after.stderr}")

        heartbeats = drain_heartbeats()
        if agent == "codex":
            # A terminal-only Codex event waits briefly for editor evidence. The
            # hook process has exited; validate durability, then explicitly run
            # the next sync after the normal capture-drain window above. Do not
            # wait for a retired daemon or rewrite the queue's retry timestamps.
            with sqlite3.connect(Path(home_dir) / ".wakaclock" / "broker.db") as store:
                pending = store.execute(
                    "SELECT status, editor_wait_until FROM broker_events"
                ).fetchall()
            check(len(pending) == 1 and pending[0][1] is not None,
                  "[codex] terminal event was not durably deferred for editor correlation")
            sync = run_cli(["sync", "--agent", "codex", "--json"], cwd=repo, env=env)
            check(sync.returncode == 0, "[codex] bounded sync failed")
            heartbeats.extend(drain_heartbeats())
            replay = run_cli(["sync", "--agent", "codex", "--json"], cwd=repo, env=env)
            check(replay.returncode == 0, "[codex] replay sync failed")
            heartbeats.extend(drain_heartbeats())
        # ai_change_id groups every file a single tool call touched under one shared
        # id (see tool_snapshot.rs); ai_event_id is a content-hash-derived id that has
        # no relationship to tool_event_id's own spelling.
        matching = [h for h in heartbeats if h.get("ai_change_id") == tool_event_id]
        check(len(matching) == 1, f"[{agent}] expected exactly one matching heartbeat, got {len(matching)}")
        heartbeat = matching[0]
        # Shell snapshots prove that an AI tool operation changed the file, but
        # they do not provide verified authorship. The client therefore keeps the
        # AI bucket while scrubbing the self-declared agent/provider before upload.
        check(heartbeat.get("ai_agent") is None, f"[{agent}] unverified ai_agent leaked: {heartbeat.get('ai_agent')!r}")
        check(
            heartbeat.get("actor_type") == "ai_inferred",
            f"[{agent}] actor_type was {heartbeat.get('actor_type')!r}, expected ai_inferred",
        )
        check(not heartbeat.get("is_ai_generated") is False, f"[{agent}] is_ai_generated must be true")
        check(heartbeat.get("ai_provider") is None, f"[{agent}] unverified ai_provider leaked")
        check(heartbeat.get("ai_model") is None, f"[{agent}] unverified ai_model leaked")
        check(heartbeat.get("ai_source") == "observer", f"[{agent}] ai_source was {heartbeat.get('ai_source')!r}")
        check(
            heartbeat.get("human_lines_added") in (None, 0) and heartbeat.get("human_lines_deleted") in (None, 0),
            f"[{agent}] a shell-mutated file must not also carry positive Human line counters",
        )


def scenario_filesystem_only_change(server_url: str, label: str, mutate) -> None:
    """`git checkout` / `git merge` rows: a real filesystem mutation with *no* AI
    hook in the loop at all. Two things are checked, matching the two halves of
    the matrix's own framing:

    1. A bare, no-flags heartbeat (what a future Phase 3/4 filesystem observer
       would send — presence with no write/AI evidence) must resolve to Unknown,
       never silently to Human or, worse, to an AI actor.
    2. Today's actual CLI heartbeat path only ever gets `--write` from an editor
       save. That heartbeat *does* resolve to Human under the current
       `positive_editor_evidence` rule — not because anything here special-cases
       `git checkout`, but because nothing yet distinguishes "the editor's own
       save" from "an external process changed this open file", which is exactly
       the still-open Phase 3 Universal Workspace Observer gap. This assertion
       exists so that gap stays documented and visible, not so a git checkout is
       endorsed as Human.
    """
    with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as home_dir:
        repo = Path(repo_dir)
        init_git_repo(repo, "app.py", "value = 1\n")
        # `mutate` returns the working-tree content it expects to have produced, so
        # this can assert the real git operation actually landed rather than assuming
        # any particular before/after relationship — `git checkout` reverting a file
        # back to its very first committed content is a legitimate case where "after"
        # equals the original constant.
        expected_content = mutate(repo)
        check(
            (repo / "app.py").read_text() == expected_content,
            f"[{label}] expected app.py to read {expected_content!r} after the real git "
            f"operation, got {(repo / 'app.py').read_text()!r}",
        )

        env = base_env(Path(home_dir), server_url)

        bare = run_cli(
            ["heartbeat", "--entity", "app.py", "--json"],
            cwd=repo,
            env=env,
        )
        check(bare.returncode == 0, f"[{label}] bare heartbeat failed: {bare.stderr}")
        bare_heartbeats = drain_heartbeats()
        check(len(bare_heartbeats) >= 1, f"[{label}] expected a heartbeat from the bare send")
        bare_heartbeat = bare_heartbeats[0]
        check(
            bare_heartbeat.get("actor_type") not in ("ai_verified", "ai_inferred"),
            f"[{label}] a filesystem-only change with no AI evidence must never resolve to an AI actor "
            f"(got {bare_heartbeat.get('actor_type')!r})",
        )
        check(
            bare_heartbeat.get("actor_type") == "unknown",
            f"[{label}] a bare no-evidence heartbeat should resolve to unknown, got "
            f"{bare_heartbeat.get('actor_type')!r}",
        )

        written = run_cli(
            ["heartbeat", "--entity", "app.py", "--write", "--json"],
            cwd=repo,
            env=env,
        )
        check(written.returncode == 0, f"[{label}] --write heartbeat failed: {written.stderr}")
        written_heartbeats = drain_heartbeats()
        check(len(written_heartbeats) >= 1, f"[{label}] expected a heartbeat from the --write send")
        written_heartbeat = written_heartbeats[0]
        check(
            written_heartbeat.get("actor_type") not in ("ai_verified", "ai_inferred"),
            f"[{label}] --write must never resolve to an AI actor on its own "
            f"(got {written_heartbeat.get('actor_type')!r})",
        )
        # Documents today's real, deliberate gap — see the docstring above. If this
        # ever starts failing because --write now resolves to something other than
        # human, Phase 3 has landed and this whole scenario needs rewriting, not
        # patching.
        check(
            written_heartbeat.get("actor_type") == "human",
            f"[{label}] expected today's known --write-implies-Human gap "
            f"(actor_type was {written_heartbeat.get('actor_type')!r}); update this "
            "check and docs/ai-attribution-test-matrix.md together if this changed",
        )


def mutate_via_git_checkout(repo: Path) -> str:
    """third commit sets app.py to "value = 2\\n"; checking out two commits back
    reverts it to the very first committed content, "value = 1\\n"."""
    subprocess.run(["git", "commit", "-q", "--allow-empty", "-m", "second"], cwd=repo, check=True)
    (repo / "app.py").write_text("value = 2\n")
    subprocess.run(["git", "add", "app.py"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "third"], cwd=repo, check=True)
    subprocess.run(["git", "checkout", "HEAD~2", "--", "app.py"], cwd=repo, check=True)
    return "value = 1\n"


def mutate_via_git_merge(repo: Path) -> str:
    """A feature branch sets app.py to "value = 99\\n"; merging it into the repo's
    default branch (whichever `git init` created — "main" or "master" depending on
    the local git version/config) brings that content in."""
    subprocess.run(["git", "checkout", "-q", "-b", "feature"], cwd=repo, check=True)
    (repo / "app.py").write_text("value = 99\n")
    subprocess.run(["git", "add", "app.py"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "feature change"], cwd=repo, check=True)
    default_branch_probe = subprocess.run(
        ["git", "rev-parse", "--verify", "main"], cwd=repo, capture_output=True
    )
    default_branch = "main" if default_branch_probe.returncode == 0 else "master"
    subprocess.run(["git", "checkout", "-q", default_branch], cwd=repo, check=True)
    subprocess.run(["git", "merge", "-q", "feature"], cwd=repo, check=True)
    return "value = 99\n"


CURSOR_ADAPTER_DIR = REPO_ROOT / "extensions" / "ai-agents" / "cursor"


def scenario_cursor_shell_scaffold(server_url: str) -> None:
    """Runs the real `extensions/ai-agents/cursor/scripts/git-sweep-{before,after}.sh`
    against a real shell mutation. This proves the scaffold's *wiring* — the scripts
    correctly drive `wakaclock ai tool-before`/`tool-after` end to end — not that its
    guessed `beforeShellExecution`/`afterShellExecution` field names match a real
    Cursor payload. See `extensions/ai-agents/cursor/README.md` before trusting this
    scenario as proof the adapter works against real Cursor.
    """
    with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as home_dir:
        repo = Path(repo_dir)
        init_git_repo(repo, "app.py", "value = 1\n")
        env = base_env(Path(home_dir), server_url)

        before_stdin = json.dumps(
            {
                "workspace_roots": [str(repo)],
                "conversation_id": "conv-scaffold-1",
                "generation_id": "gen-scaffold-1",
                "hook_event_name": "beforeShellExecution",
            }
        )
        before = subprocess.run(
            ["bash", str(CURSOR_ADAPTER_DIR / "scripts" / "git-sweep-before.sh"), "cursor", "anysphere"],
            input=before_stdin,
            text=True,
            capture_output=True,
            env=env,
            timeout=30,
        )
        check(before.returncode == 0, f"[cursor scaffold] git-sweep-before.sh failed: {before.stderr}")

        sed_inplace(repo / "app.py", "value = 1", "value = 2")

        after_stdin = json.dumps(
            {
                "workspace_roots": [str(repo)],
                "conversation_id": "conv-scaffold-1",
                "generation_id": "gen-scaffold-1",
                "hook_event_name": "afterShellExecution",
            }
        )
        after = subprocess.run(
            ["bash", str(CURSOR_ADAPTER_DIR / "scripts" / "git-sweep-after.sh"), "cursor", "anysphere"],
            input=after_stdin,
            text=True,
            capture_output=True,
            env=env,
            timeout=30,
        )
        check(after.returncode == 0, f"[cursor scaffold] git-sweep-after.sh failed: {after.stderr}")

        heartbeats = drain_heartbeats()
        matching = [h for h in heartbeats if h.get("actor_type") == "ai_inferred"]
        check(len(matching) >= 1, f"[cursor scaffold] expected a heartbeat, got {len(heartbeats)}: {heartbeats}")
        heartbeat = matching[0]
        check(
            heartbeat.get("ai_agent") is None,
            f"[cursor scaffold] unverified ai_agent leaked: {heartbeat.get('ai_agent')!r}",
        )
        check(heartbeat.get("ai_provider") is None, f"[cursor scaffold] unverified ai_provider leaked")
        check(heartbeat.get("ai_source") == "observer", f"[cursor scaffold] ai_source was {heartbeat.get('ai_source')!r}")


def scenario_cursor_after_file_edit_scaffold(server_url: str) -> None:
    """Runs the real `extensions/ai-agents/cursor/scripts/heartbeat-hook.sh` with a
    synthetic `afterFileEdit`-shaped stdin payload. Proves the script's line-counting
    and `wakaclock ai emit` wiring works; the `file_path`/`edits[]` field names
    themselves are unverified — see `extensions/ai-agents/cursor/README.md`.
    """
    with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as home_dir:
        repo = Path(repo_dir)
        (repo / "app.py").write_text("value = 1\n")
        env = base_env(Path(home_dir), server_url)

        stdin_payload = json.dumps(
            {
                "file_path": str(repo / "app.py"),
                "workspace_roots": [str(repo)],
                "conversation_id": "conv-scaffold-2",
                "generation_id": "gen-scaffold-2",
                "hook_event_name": "afterFileEdit",
                "edits": [
                    {
                        "old_string": "value = 1",
                        "new_string": "value = 1\nvalue2 = 2\nvalue3 = 3",
                    }
                ],
            }
        )
        result = subprocess.run(
            ["bash", str(CURSOR_ADAPTER_DIR / "scripts" / "heartbeat-hook.sh")],
            input=stdin_payload,
            text=True,
            capture_output=True,
            env=env,
            timeout=30,
        )
        check(result.returncode == 0, f"[cursor afterFileEdit scaffold] script failed: {result.stderr}")

        heartbeats = drain_heartbeats()
        check(len(heartbeats) >= 1, f"[cursor afterFileEdit scaffold] expected a heartbeat, got none")
        heartbeat = heartbeats[0]
        check(heartbeat.get("ai_agent") == "cursor", f"[cursor afterFileEdit scaffold] ai_agent was {heartbeat.get('ai_agent')!r}")
        check(heartbeat.get("actor_type") == "ai_verified", f"[cursor afterFileEdit scaffold] actor_type was {heartbeat.get('actor_type')!r}")
        check(heartbeat.get("ai_lines_added") == 3, f"[cursor afterFileEdit scaffold] ai_lines_added was {heartbeat.get('ai_lines_added')!r}")
        check(heartbeat.get("ai_lines_deleted") == 1, f"[cursor afterFileEdit scaffold] ai_lines_deleted was {heartbeat.get('ai_lines_deleted')!r}")


def main() -> int:
    if not BINARY.exists():
        print(
            f"error: {BINARY} does not exist; run `cargo build -p wakaclock-cli` first",
            file=sys.stderr,
        )
        return 2

    server = start_fake_server()
    server_url = f"http://127.0.0.1:{server.server_port}"

    scenarios = [
        (
            "Claude Bash + sed",
            lambda: scenario_shell_mutation(
                server_url,
                "claude-code",
                "anthropic",
                lambda path: sed_inplace(path, "value = 1", "value = 2"),
            ),
        ),
        (
            "Claude Python codemod",
            lambda: scenario_shell_mutation(
                server_url,
                "claude-code",
                "anthropic",
                lambda path: path.write_text("value = 1\nvalue2 = 2\n"),
            ),
        ),
        (
            "Codex shell",
            lambda: scenario_shell_mutation(
                server_url,
                "codex",
                "openai",
                lambda path: sed_inplace(path, "value = 1", "value = 3"),
            ),
        ),
        (
            "Gemini shell",
            lambda: scenario_shell_mutation(
                server_url,
                "gemini-cli",
                "google",
                lambda path: sed_inplace(path, "value = 1", "value = 4"),
            ),
        ),
        (
            "git checkout",
            lambda: scenario_filesystem_only_change(server_url, "git checkout", mutate_via_git_checkout),
        ),
        (
            "git merge",
            lambda: scenario_filesystem_only_change(server_url, "git merge", mutate_via_git_merge),
        ),
        (
            "Cursor shell (scaffold, unverified payload shape)",
            lambda: scenario_cursor_shell_scaffold(server_url),
        ),
        (
            "Cursor afterFileEdit (scaffold, unverified payload shape)",
            lambda: scenario_cursor_after_file_edit_scaffold(server_url),
        ),
    ]

    failures: list[str] = []
    for name, scenario in scenarios:
        while not CAPTURED.empty():
            CAPTURED.get_nowait()
        try:
            scenario()
            print(f"  ok  {name}")
        except Failure as error:
            failures.append(f"{name}: {error}")
            print(f"FAIL  {name}: {error}")
        except subprocess.CalledProcessError as error:
            failures.append(f"{name}: subprocess failed: {error}")
            print(f"FAIL  {name}: subprocess failed: {error}")

    server.shutdown()

    if failures:
        print(f"\n{len(failures)} scenario(s) failed", file=sys.stderr)
        return 1
    print(f"\nAll {len(scenarios)} external-process scenarios passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
