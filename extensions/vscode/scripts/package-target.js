#!/usr/bin/env node

// CI entry point for platform-specific Marketplace packages. A target VSIX contains
// exactly one native executable; the managed CLI verifies the matching manifest at
// activation time before copying it into global storage.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const target = process.argv[2];
const artifact = process.argv[3];
if (!target || !artifact) {
  throw new Error("usage: package-target.js <target> <release-binary>");
}
const root = path.resolve(__dirname, "..");
const binary = target.startsWith("win32-") ? "wakaclock.exe" : "wakaclock";
const binDir = path.join(root, "resources", "bin");
fs.rmSync(binDir, { recursive: true, force: true });
fs.mkdirSync(binDir, { recursive: true });
fs.copyFileSync(path.resolve(artifact), path.join(binDir, binary));
if (process.platform !== "win32") {
  fs.chmodSync(path.join(binDir, binary), 0o755);
}
execFileSync(process.execPath, [path.join(__dirname, "generate-cli-manifest.js"), target, binary], {
  cwd: root,
  stdio: "inherit",
});
const vsce = process.env.VSCE_BIN || "npx";
const vsceArgs = vsce === "npx"
  ? ["--yes", "@vscode/vsce", "package", "--allow-missing-repository", "--target", target, "--out", `atoaxis-vscode-${target}.vsix`]
  : ["package", "--allow-missing-repository", "--target", target, "--out", `atoaxis-vscode-${target}.vsix`];
execFileSync(vsce, vsceArgs, { cwd: root, stdio: "inherit" });
