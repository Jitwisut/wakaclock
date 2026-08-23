#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const target = process.argv[2];
const binary = process.argv[3] || (process.platform === "win32" ? "wakaclock.exe" : "wakaclock");
const version = process.argv[4] || process.env.CLI_VERSION || "0.1.0";
if (!target) {
  throw new Error("usage: generate-cli-manifest.js <target> [binary] [version]");
}

const root = path.resolve(__dirname, "..");
const binaryPath = path.join(root, "resources", "bin", binary);
if (!fs.existsSync(binaryPath)) {
  throw new Error(`CLI binary not found: ${binaryPath}`);
}
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(binaryPath)).digest("hex");
const manifest = {
  schemaVersion: 1,
  cliVersion: version,
  protocolVersion: 1,
  target,
  binary,
  sha256,
};
fs.mkdirSync(path.dirname(path.join(root, "resources", "cli-manifest.json")), { recursive: true });
fs.writeFileSync(
  path.join(root, "resources", "cli-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o644 },
);
console.log(JSON.stringify(manifest));
