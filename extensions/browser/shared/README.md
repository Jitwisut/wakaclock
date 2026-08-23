# AtoAxis browser tracking core

This WebExtension core is shared by Chrome/Edge/Brave, Firefox and Safari adapters.

- Domain-only tracking is the default.
- URL paths and tab titles require explicit opt-in.
- Incognito/private windows are disabled by default.
- Password-manager, banking and healthcare hostnames are denied before payload creation.
- AFK timeout defaults to 15 minutes and is user-configurable.
- The payload never contains page HTML, form values, cookies, prompts or source code.

Each browser adapter is responsible only for permissions, storage and the device-code
flow. `buildHeartbeat` is the single payload boundary shared by all adapters.
