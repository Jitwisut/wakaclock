# Publishing to the VS Code Marketplace and Open VSX

Status on 2026-10-19: neither gallery lists `atoaxis.atoaxis-vscode` yet, but the
website setup steps already tell people to install it from the Marketplace.

Only the owner can create the publisher accounts, sign the agreements and mint
tokens. Nobody else should publish on the owner's behalf.

## 1. Decide before the first publish

- [x] **Public listing while access is invite-only.** Decided by the owner on
      2026-10-19: list publicly with the Preview badge, and ship the first-run
      Join Early Access prompt described below before the first publish. Do not
      publish a build without that prompt. Background: anyone can install a public
      listing, and someone without a key gets an extension that does nothing. That
      tends to produce 1-star reviews. The listing is marked `preview: true`, and the
      description and README state the invite-only requirement up front. The
      first-run prompt is in `src/apiKeyPrompt.ts`. On the first activation with no
      key, it shows a notification once per install, with **Set API Key**,
      **Join Early Access** (`https://www.atoaxis.com/join`) and
      **Don't show again**. The `AtoAxis: Set API Key` input box also links to
      `/join`. Before publishing, still check it manually by installing on a clean
      VS Code profile with no key.
- [ ] **End-user license.** `package.json` says `SEE LICENSE IN LICENSE`, but the
      package has no license file (vsce warns `LICENSE not found` and continues).
      The repository-root `LICENSE` is a confidential "all use prohibited" notice.
      Copying it into a public listing would mean nobody is licensed to run what
      they install. `/terms` currently covers the website and hosted service, not
      the client software. Add an extension EULA as `extensions/vscode/LICENSE.md`,
      or extend `/terms` to cover the client and point to it.
- [ ] **Signing.** The release workflow refuses to package macOS or Windows targets
      without a Developer ID certificate, Apple notarization credentials and an
      Authenticode certificate. Either buy and configure them (see BUILDING.md), or
      decide to ship unsigned binaries for Early Access and relax that guard.
- [ ] **Screenshots.** The README has no images. Gallery images must be absolute
      `https` URLs, and the GitHub repo is private, so relative paths will not
      resolve. Capture real shots (status bar states, dashboard daily view, AI vs
      human lines, the AI-consent dialog), host them under `https://www.atoaxis.com/`,
      and reference them by full URL. Do not use the 3D marketing renders as
      "screenshots".
- [ ] **README timing copy.** The README says gaps over 120 seconds are never
      counted, while `package.json` describes a fixed 15-second Active lease. That
      text sits behind the heartbeat-safety approval gate. Confirm which wording is
      correct before it goes public.

## 2. Build matrix

| Target | Needed | Built by `release-extension.yml` | Exists today |
| --- | --- | --- | --- |
| darwin-arm64 | yes | yes (macos-14) | local only, stale, ad-hoc signed: do not publish |
| darwin-x64 | yes | yes (now `macos-15-intel`; `macos-13` was retired 2025-12-04) | no |
| linux-x64 | yes | yes (musl, static) | no |
| linux-arm64 | yes | yes (musl via `cross`) | no |
| win32-x64 | yes | yes (windows-2022) | no |
| win32-arm64 | nice to have | yes | no |
| alpine-x64 / alpine-arm64 | nice to have | yes (reuses the musl binary) | no |

There is no untargeted fallback VSIX, so platforms outside the table (for example
linux-armhf) see "not compatible". The workflow has never run. It triggers on any
`v*` tag push and then **publishes automatically**, so do not push a tag until
everything in section 1 is settled.

When packaging by hand, work from a copy outside the repo. vsce finds 0 files under
the UUID worktree paths.

```bash
mkdir -p /tmp/atoaxis-pkg/extensions
rsync -a --exclude node_modules extensions/vscode extensions/ai-agents /tmp/atoaxis-pkg/extensions/
cd /tmp/atoaxis-pkg/extensions/vscode && npm ci && npm run build:resources
CLI_VERSION=0.2.0 npm run package:target -- linux-x64 /path/to/signed/wakaclock
```

The darwin-arm64 VSIX is about 24 MB compressed. The CLI inside is about 150 MB
uncompressed, which vsce flags as large but accepts.

## 3. VS Code Marketplace (owner)

1. Sign in at <https://dev.azure.com> with the Microsoft account that will own the
   publisher, then create a Personal Access Token. Set Organization to
   **All accessible organizations**, choose Scopes → Custom defined →
   **Marketplace → Manage**, and copy the token.
   *Azure DevOps retires global PATs on **2026-12-01**.* A token made now will stop
   working then. Plan to move CI to Entra ID publishing
   (`vsce publish --azure-credential`, using a managed identity added to the
   publisher as Contributor) before that date.
2. At <https://marketplace.visualstudio.com/manage>, choose **Create publisher**
   with ID `atoaxis`, which must match `package.json` and cannot be changed later,
   and display name `AtoAxis`. Add the website and support links, and verify the
   `atoaxis.com` domain for the verified badge.
3. Check the token locally: `npx @vscode/vsce login atoaxis`, then paste the PAT.
4. Publish each signed target VSIX:

   ```bash
   for f in atoaxis-vscode-*.vsix; do npx @vscode/vsce publish --packagePath "$f"; done
   ```

   Or store the PAT as the `VSCE_PAT` secret and let the tag-triggered workflow
   publish all eight.

## 4. Open VSX (owner)

1. Create an Eclipse account and enter your GitHub username in its GitHub field.
2. Sign in at <https://open-vsx.org> with GitHub. Under Settings, choose
   **Log in with Eclipse** and accept the **Publisher Agreement**.
3. Under Settings → Access Tokens, generate a token.
4. `npx ovsx create-namespace atoaxis -p <token>`, then claim ownership of the
   namespace (Open VSX "Namespace Access" process) so it shows as verified.
5. Publish each VSIX (the target platform is read from the package):

   ```bash
   for f in atoaxis-vscode-*.vsix; do npx ovsx publish "$f" -p <token>; done
   ```

   Or store the token as the `OVSX_PAT` secret. The release workflow publishes to
   Open VSX only when that secret is set.

## 5. After publishing

- [ ] `https://marketplace.visualstudio.com/items?itemName=atoaxis.atoaxis-vscode`
      and `https://open-vsx.org/extension/atoaxis/atoaxis-vscode` load.
- [ ] Install on a clean machine without a key: confirm the listing and first run
      point the user to `/join`.
- [ ] Then switch the website setup steps and launch kit to real install links.
