bl_info = {
    "name": "AtoAxis Activity Tracker",
    "author": "AtoAxis",
    "version": (0, 1, 0),
    "blender": (4, 0, 0),
    "location": "Preferences > Add-ons",
    "description": "Privacy-first modeling activity tracking for AtoAxis",
    "category": "System",
}


def register():
    # Import Blender-only modules lazily so the pure queue/CLI contract remains unit-testable
    # with normal CPython outside Blender.
    from . import preferences, tracker

    preferences.register()
    tracker.register()


def unregister():
    from . import preferences, tracker

    tracker.unregister()
    preferences.unregister()
