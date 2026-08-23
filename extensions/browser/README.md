# AtoAxis browser extensions

The `shared/` directory is the protocol and privacy core. Build adapters for Chromium
(Chrome, Edge, Brave), Firefox and Safari without changing the payload contract. The
adapter must use OAuth device authorization, keep its access token in browser secure
storage, honor the allowlist/denylist and send heartbeats asynchronously. No adapter may
read page content or transmit a title unless the user enabled that setting.
