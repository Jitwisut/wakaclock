#!/usr/bin/env node
// Generate the deterministic checksum manifest shipped with an AI adapter
// bundle. The manifest excludes itself and hashes file bytes only, so chmod and
// archive extraction do not change the artifact identity.
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(process.cwd(), process.argv[2] || path.join(__dirname, "..", "resources", "ai-agents"));
const packageVersion = require(path.join(__dirname, "..", "package.json")).version;
const version = process.env.WAKACLOCK_BUNDLE_VERSION || packageVersion;
const manifestPath = path.join(root, "bundle-manifest.json");

function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function collect(current, files) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  )) {
    const full = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symlink in bundle: ${full}`);
    if (entry.isDirectory()) collect(full, files);
    else if (entry.isFile()) {
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (relative !== "bundle-manifest.json") files[relative] = hash(fs.readFileSync(full));
    }
  }
}

if (!fs.existsSync(root)) throw new Error(`bundle directory not found: ${root}`);
const files = {};
collect(root, files);
const digest = hash(Buffer.from(JSON.stringify(files)));
const manifest = { schema_version: 1, bundle_version: version, files, digest };
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`generated ${manifestPath} (${Object.keys(files).length} files, ${digest})`);
