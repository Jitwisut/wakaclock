from __future__ import annotations

import subprocess
import time

import bpy
from bpy.app.handlers import persistent

from .core import ActivityQueue, build_cli_args, resolve_cli

_POLL_SECONDS = 1.0
_QUEUE = ActivityQueue()


def _current_entity() -> str:
    # Unsaved files have no stable local identity. Ignoring them avoids inventing a path or
    # sending document contents merely to distinguish one temporary scene from another.
    return bpy.data.filepath or ""


def _configured_cli_path() -> str:
    addon = bpy.context.preferences.addons.get(__package__)
    if addon is None:
        return ""
    return getattr(addon.preferences, "cli_path", "")


def _spawn(intent) -> bool:
    cli = resolve_cli(_configured_cli_path())
    if cli is None:
        return False
    try:
        subprocess.Popen(
            build_cli_args(cli, intent),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError:
        return False
    return True


def _flush(*, force: bool = False) -> None:
    intent = _QUEUE.drain(time.monotonic(), force=force)
    if intent is not None and not _spawn(intent):
        # Put the one bounded activity marker back so a CLI installed while Blender remains
        # open can recover on a later timer tick without building an unbounded memory queue.
        _QUEUE.mark(intent.entity, intent.is_write)


def _timer_poll():
    _flush()
    return _POLL_SECONDS


@persistent
def _on_load(_unused):
    _QUEUE.mark(_current_entity(), False)


@persistent
def _on_save(_unused):
    _QUEUE.mark(_current_entity(), True)
    _flush(force=True)


@persistent
def _on_depsgraph_update(_scene, _depsgraph):
    _QUEUE.mark(_current_entity(), False)


def _append_once(collection, handler) -> None:
    if handler not in collection:
        collection.append(handler)


def register():
    _append_once(bpy.app.handlers.load_post, _on_load)
    _append_once(bpy.app.handlers.save_post, _on_save)
    _append_once(bpy.app.handlers.depsgraph_update_post, _on_depsgraph_update)
    if not bpy.app.timers.is_registered(_timer_poll):
        bpy.app.timers.register(_timer_poll, first_interval=_POLL_SECONDS, persistent=True)
    _QUEUE.mark(_current_entity(), False)


def unregister():
    for collection, handler in (
        (bpy.app.handlers.load_post, _on_load),
        (bpy.app.handlers.save_post, _on_save),
        (bpy.app.handlers.depsgraph_update_post, _on_depsgraph_update),
    ):
        if handler in collection:
            collection.remove(handler)
    if bpy.app.timers.is_registered(_timer_poll):
        bpy.app.timers.unregister(_timer_poll)
