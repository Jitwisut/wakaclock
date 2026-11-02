"""Bounded child execution with closed diagnostics for native artifact smoke."""
from __future__ import annotations

import subprocess


class SmokeError(Exception):
    def __init__(self, code: str, *, preserve_work: bool = False):
        super().__init__(code)
        self.preserve_work = preserve_work


def child(args: list[str], *, env: dict | None = None, stdin: str | None = None,
          timeout: int = 45) -> str:
    try:
        result = subprocess.run(args, input=stdin, capture_output=True, text=True, encoding="utf-8",
                                env=env, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SmokeError("native_child_unavailable_or_timeout") from error
    if result.returncode or len(result.stdout.encode()) > 2 * 1024 * 1024:
        raise SmokeError("native_child_failed")
    return result.stdout
