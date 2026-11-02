# AtoAxis for Blender

Website: <https://www.atoaxis.com> · Early Access: <https://www.atoaxis.com/join>

The Blender addon records modeling **activity metadata only**. It never serializes geometry,
materials, node trees, object names, text blocks, scene contents, or rendered output.

Signals:

- `depsgraph_update_post` → coalesced modeling activity;
- `save_post` → immediate `--write` heartbeat;
- `load_post` → activity marker;
- unsaved `.blend` files are ignored until Blender has a stable file path.

Blender explicitly warns against persistent Python worker threads. This addon therefore keeps a
single bounded in-memory activity marker and polls it with `bpy.app.timers` every second. Delivery
uses non-blocking `subprocess.Popen` to the normal `wakaclock` CLI, so offline queueing, project
resolution and API behavior remain centralized in `wakaclock-core`.

## Install

Zip the `atoaxis/` directory and install it from **Edit → Preferences → Add-ons → Install**. If the
CLI is not on Blender's `PATH`, set **AtoAxis CLI path** in the addon preferences.

## Tests

```bash
cd extensions/blender
PYTHONPATH=. python3 -m unittest discover -s tests -v
python3 -m compileall -q atoaxis
```

A real Blender UI/headless smoke additionally requires Blender to be installed on the test host.
