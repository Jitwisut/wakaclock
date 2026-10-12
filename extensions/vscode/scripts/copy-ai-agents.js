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

function main(sourceDir = SOURCE_DIR, targetDir = TARGET_DIR) {
  if (!fs.existsSync(sourceDir)) {
    console.error(`copy-ai-agents: source dir not found at ${sourceDir}`);
    process.exit(1);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, filter: source => {
    const name = path.basename(source);
    return !["node_modules", "__pycache__", ".git", ".DS_Store"].includes(name) && !/\.(pyc|pyo)$/.test(name);
  } });
  // Ship the same shared spool implementation as CommonJS for the VS Code host.
  // Runtime must not depend on the source checkout or a TS loader.
  const ts = require("typescript");
  const shared = path.join(targetDir, "common", "activity-spool.ts");
  const compiled = ts.transpileModule(fs.readFileSync(shared, "utf8"), { compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}, reportDiagnostics:true });
  if ((compiled.diagnostics || []).some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error("shared spool compilation failed");
  fs.writeFileSync(path.join(targetDir,"common","activity-spool.js"),compiled.outputText);
  makeShellScriptsExecutable(targetDir);

  console.log(`copy-ai-agents: copied ${sourceDir} -> ${targetDir}`);
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

if (require.main === module) main();
module.exports = { copyAiAgents: main };
