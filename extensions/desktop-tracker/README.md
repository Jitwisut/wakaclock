# AtoAxis desktop activity tracker

This directory defines the platform-neutral privacy contract for native macOS, Windows
and Linux adapters. The adapters report only the foreground application by default and
must use `sanitizeActivity` before any event leaves the machine.

The default AFK timeout is 15 minutes. Private mode, a denylist for password managers and
financial/healthcare applications, and title tracking (off by default) are user controls.
Raw window titles, clipboard data, keystrokes, page contents and source code are never
required by this fallback tracker.
