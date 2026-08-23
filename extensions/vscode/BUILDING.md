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

For a local CLI smoke test (without changing the user's config), point the extension
at a development override and use the new machine-readable probe:

```bash
WAKACLOCK_SERVER_URL=https://api.atoaxis.com \
  ./wakaclock verify --json
```
