#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ALLOWED_TARGETS = new Set([
  "darwin-x64",
  "darwin-arm64",
  "win32-x64",
  "win32-arm64",
  "linux-x64",
  "linux-arm64",
  "alpine-x64",
  "alpine-arm64",
]);
const SAFE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const target = process.argv[2];
const binary = process.argv[3] || (process.platform === "win32" ? "wakaclock.exe" : "wakaclock");
const version = process.argv[4] || process.env.CLI_VERSION || "0.2.0";
if (!target) {
  throw new Error("usage: generate-cli-manifest.js <target> [binary] [version]");
}
if (!ALLOWED_TARGETS.has(target)) {
  throw new Error(`unsupported VS Code target: ${target}`);
}
if (!SAFE_VERSION.test(version)) {
  throw new Error(`invalid CLI version: ${version}`);
}
const expectedBinary = target.startsWith("win32-") ? "wakaclock.exe" : "wakaclock";
if (binary !== expectedBinary) {
  throw new Error(`target ${target} requires ${expectedBinary}, got ${binary}`);
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
if (process.env.INTERNAL_CANDIDATE === "1") {
  if (!/^[0-9a-f]{40}$/.test(process.env.SOURCE_COMMIT || "")) throw new Error("Internal candidates require a full source commit.");
  manifest.sourceCommit = process.env.SOURCE_COMMIT;
  manifest.buildProfile = "release";
  manifest.releaseChannel = "internal";
  manifest.signing = "unsigned";
  manifest.capabilities = ["editor_durable_ack_v1", "activity_envelope_v3", "persistent_runtime_intent_v1", "native_activity_hook_v1"];
  const repository = path.resolve(root, "../..");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
  if (head !== manifest.sourceCommit) throw new Error("candidate_source_commit_mismatch");
  const sourceFiles = execFileSync("git", ["ls-files", "backend/api", "extensions/vscode/src", "extensions/vscode/scripts", "extensions/ai-agents", "extensions/vscode/tsconfig.json", "extensions/vscode/package.json", "extensions/vscode/package-lock.json"], { cwd: repository, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim().split("\n").filter(name => name && !name.includes("/target/"));
  const sourceInputs = {};
  for (const name of sourceFiles.sort()) {
    const committed = execFileSync("git", ["show", `${head}:${name}`], { cwd: repository, maxBuffer: 16 * 1024 * 1024 });
    const observed = fs.readFileSync(path.join(repository, name));
    if (!observed.equals(committed)) throw new Error("candidate_source_input_changed");
    sourceInputs[name] = crypto.createHash("sha256").update(observed).digest("hex");
  }
  manifest.sourceTreeDigest = crypto.createHash("sha256").update(JSON.stringify(sourceInputs)).digest("hex");
  manifest.compiledSha256 = {};
  function recordCompiled(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) recordCompiled(absolute);
      else if (entry.isFile() && entry.name.endsWith(".js")) {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        manifest.compiledSha256[relative] = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
      }
    }
  }
  recordCompiled(path.join(root, "out", "src"));
  if (!Object.keys(manifest.compiledSha256).length) throw new Error("candidate_compiled_inputs_missing");
}
fs.mkdirSync(path.dirname(path.join(root, "resources", "cli-manifest.json")), { recursive: true });
fs.writeFileSync(
  path.join(root, "resources", "cli-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o644 },
);
console.log(JSON.stringify(manifest));
