# AtoAxis for Figma

AtoAxis tracks **activity metadata only** while this plugin is open. It never sends layer names,
text contents, component properties, geometry, comments, collaborator identities, or document
contents.

Tracked signals:

- selection/page changes → non-write `designing` activity;
- local `documentchange` events → immediate write activity;
- remote collaborator-only changes → ignored;
- entity label → bounded `<document name> / <page name>` metadata.

Authentication uses the OAuth device flow with the first-party public client `atoaxis_figma`.
Tokens are stored with `figma.clientStorage`; the plugin never asks for or stores an AtoAxis API
key. Access tokens request only `write_logged_time`.

Activity waiting for delivery is kept in Figma client storage with its capture time and ID. Reopening the plugin retries records for the same authorization grant. A new connection has a separate queue. Older single-array queue entries are retained for recovery; a warning identifies affected connections.

## Development

The manifest contains a development-only numeric ID. Before publishing to Figma Community,
replace it with the ID assigned by Figma's **Create new plugin** / publishing flow.

```bash
npm ci
npm run validate

# Point a development build at a local API (allowed only through manifest devAllowedDomains):
ATOAXIS_FIGMA_API_URL=http://localhost:8080 npm run build
```

Import `manifest.json` as a development plugin. A real-host smoke requires a Figma account and a
Figma-assigned plugin ID; automated tests validate the payload/privacy and build contracts.
