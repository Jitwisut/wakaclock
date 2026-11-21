"""macOS/Linux: python3 tests/host_smoke.py /absolute/path/to/blender"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import zipfile


def check_in_blender(root):
    import bpy

    bpy.ops.preferences.addon_install(filepath=str(root / "addon.zip"))
    bpy.ops.preferences.addon_enable(module="atoaxis")
    bpy.context.preferences.addons["atoaxis"].preferences.cli_path = str(root / "wakaclock")
    for name in ("one.blend", "two.blend"):
        bpy.ops.wm.save_as_mainfile(filepath=str(root / name))
    bpy.ops.wm.open_mainfile(filepath=str(root / "one.blend"))
    bpy.ops.wm.save_as_mainfile(filepath=str(root / "one.blend"))
    bpy.ops.preferences.addon_disable(module="atoaxis")
    from atoaxis import tracker
    assert tracker._on_save not in bpy.app.handlers.save_post
    assert not bpy.app.timers.is_registered(tracker._timer_poll)

    deadline = time.monotonic() + 8
    while True:
        receipts = root / "receipts"
        records = [json.loads(line) for line in receipts.read_text().splitlines()] if receipts.exists() else []
        writes = [Path(args[args.index("--entity") + 1]).name for args in records
                  if "--write" in args and args[args.index("--category") + 1] == "modeling"]
        if len(writes) >= 3 or time.monotonic() >= deadline:
            assert sorted(writes) == ["one.blend", "one.blend", "two.blend"], writes
            break
        time.sleep(0.05)


def launch(blender, root):
    addon = Path(__file__).resolve().parents[1] / "atoaxis"
    with zipfile.ZipFile(root / "addon.zip", "w") as archive:
        for source in addon.glob("*.py"):
            archive.write(source, "atoaxis/" + source.name)
    sink = root / "wakaclock"
    sink.write_text("#!/usr/bin/env python3\nimport json, os, sys\n"
                    "with open(os.path.join(os.environ['ATOAXIS_ADDON_SMOKE'], 'receipts'), 'a') as out:\n"
                    "    out.write(json.dumps(sys.argv[1:]) + '\\n')\n")
    sink.chmod(0o700)
    env = dict(os.environ, ATOAXIS_ADDON_SMOKE=str(root), BLENDER_USER_RESOURCES=str(root / "user"),
               BLENDER_USER_CONFIG=str(root / "config"), BLENDER_USER_SCRIPTS=str(root / "scripts"),
               PATH=str(root) + os.pathsep + os.environ["PATH"])
    subprocess.run([blender, "--background", "--factory-startup", "--python-exit-code", "1",
                    "--python", str(Path(__file__).resolve())], env=env, check=True, timeout=90)


if __name__ == "__main__":
    if "bpy" in sys.modules:
        check_in_blender(Path(os.environ["ATOAXIS_ADDON_SMOKE"]))
    else:
        with tempfile.TemporaryDirectory(prefix="atoaxis-blender-") as directory:
            launch(sys.argv[1], Path(directory))
