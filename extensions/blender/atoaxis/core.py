from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Optional

NON_WRITE_INTERVAL_SECONDS = 120.0
PLUGIN_ID = "atoaxis-blender/0.1.0"


@dataclass(frozen=True)
class HeartbeatIntent:
    entity: str
    is_write: bool


class ActivityQueue:
    """Coalesces Blender's very noisy dependency-graph events without a worker thread."""

    def __init__(self, non_write_interval_seconds: float = NON_WRITE_INTERVAL_SECONDS):
        self.non_write_interval_seconds = non_write_interval_seconds
        self._pending: Optional[HeartbeatIntent] = None
        self._last_sent_at: Optional[float] = None

    def mark(self, entity: str, is_write: bool = False) -> None:
        entity = entity.strip()
        if not entity:
            return
        previous_write = self._pending.is_write if self._pending else False
        self._pending = HeartbeatIntent(entity=entity, is_write=is_write or previous_write)

    def drain(self, now: float, *, force: bool = False) -> Optional[HeartbeatIntent]:
        pending = self._pending
        if pending is None:
            return None
        due = (
            force
            or pending.is_write
            or self._last_sent_at is None
            or now - self._last_sent_at >= self.non_write_interval_seconds
        )
        if not due:
            return None
        self._pending = None
        self._last_sent_at = now
        return pending


def build_cli_args(cli_path: str, intent: HeartbeatIntent) -> list[str]:
    args = [
        cli_path,
        "heartbeat",
        "--entity",
        intent.entity,
        "--type",
        "file",
        "--category",
        "modeling",
        "--plugin",
        PLUGIN_ID,
    ]
    if intent.is_write:
        args.append("--write")
    return args


def resolve_cli(configured_path: str = "") -> Optional[str]:
    configured_path = configured_path.strip()
    if configured_path:
        path = Path(configured_path).expanduser()
        return str(path) if path.is_file() else None
    return shutil.which("wakaclock")
