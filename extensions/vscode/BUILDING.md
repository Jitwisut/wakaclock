# Building platform-specific Marketplace packages

The Extension Host runs on the workspace machine, so each VSIX must contain one
matching native CLI. Do not commit a binary to the source tree. Build `wakaclock-cli`
in `backend/api`, then run the target packager from this directory:

```bash
cargo build -p wakaclock-cli --release --target aarch64-apple-darwin
npm ci
npm run package:target -- darwin-arm64 \
  ../../backend/api/target/aarch64-apple-darwin/release/wakaclock
```

The target name is one of `darwin-x64`, `darwin-arm64`, `win32-x64`, `win32-arm64`,
`linux-x64`, `linux-arm64`, `alpine-x64` or `alpine-arm64`. Alpine targets reuse the
corresponding static musl binary. `package:target` removes any previous binary, writes
`resources/cli-manifest.json` with the SHA-256 of the (already signed) executable, and
calls `vsce package --target`.

Production signing is required before the manifest is generated: Developer ID plus
notarization on macOS and Authenticode on Windows. The GitHub Actions matrix in
`.github/workflows/release-extension.yml` packages all eight targets and blocks
publication when an artifact, checksum or signature is missing.

GitHub-hosted runners are ephemeral, so the workflow imports the signing certificates on every
release. Configure these repository/environment secrets before tagging a release:

- `MACOS_CERTIFICATE_BASE64` — base64-encoded Developer ID `.p12` including its private key;
- `MACOS_CERTIFICATE_PASSWORD` — password protecting that `.p12`;
- `MACOS_SIGNING_IDENTITY` — Developer ID Application identity used by `codesign`;
- `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` — notarization credentials;
- `WINDOWS_CERTIFICATE_BASE64` — base64-encoded Authenticode `.pfx` including its private key;
- `WINDOWS_CERTIFICATE_PASSWORD` — password protecting that `.pfx`;
- `VSCE_PAT` — Azure DevOps token with Marketplace → Manage scope for publisher `atoaxis`;
- `OVSX_PAT` — optional Open VSX access token; the Open VSX step is skipped when it is unset.

Gallery publishing steps and the pre-release checklist are in [PUBLISHING.md](PUBLISHING.md).

The Windows certificate thumbprint is derived from the certificate imported into the runner; it
is not stored as a separate secret.

For a local CLI smoke test (without changing the user's config), point the extension
at a development override and use the new machine-readable probe:

```bash
WAKACLOCK_SERVER_URL=https://api.atoaxis.com \
  ./wakaclock verify --json
```

## Local development

Use Node.js 24 for build and packaging, matching CI. The development dependency
`@vscode/vsce` 4 requires Node.js 22 or newer; this does not change the minimum
VS Code version for installed extensions.

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension host. If the extension is already
running from the symlinked checkout, run **Developer: Reload Window** after compiling;
the Extension Host keeps the previously loaded JavaScript until the window reloads.
