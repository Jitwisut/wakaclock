#!/usr/bin/env node
// Copies extensions/ai-agents/ (a sibling of this package, outside vsce's package
// root) into resources/ai-agents/ so it ships inside the VSIX. Runs before
// `vsce package` via the `vscode:prepublish` script; agentSetup.ts reads from
// resources/ai-agents/ at runtime and never touches the sibling dir directly.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_DIR = path.join(__dirname, "..", "..", "ai-agents");
const TARGET_DIR = path.join(__dirname, "..", "resources", "ai-agents");

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`copy-ai-agents: source dir not found at ${SOURCE_DIR}`);
    process.exit(1);
  }

  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(TARGET_DIR), { recursive: true });
  fs.cpSync(SOURCE_DIR, TARGET_DIR, { recursive: true });
  makeShellScriptsExecutable(TARGET_DIR);

  console.log(`copy-ai-agents: copied ${SOURCE_DIR} -> ${TARGET_DIR}`);
}

function makeShellScriptsExecutable(rootDir) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      makeShellScriptsExecutable(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sh")) {
      fs.chmodSync(entryPath, 0o755);
    }
  }
}

main();
