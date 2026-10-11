import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Logger } from "./logging";
import type { WakaclockConfigSnapshot } from "./types";
import { HeartbeatJournal } from "./heartbeatJournal";

const execFileAsync = promisify(execFile);
const SUPPORTED_CLI_PROTOCOL_VERSION = 1;
const SAFE_CLI_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export interface CliManifest {
  schemaVersion: number;
  cliVersion: string;
  protocolVersion: number;
  target: string;
  binary: string;
  sha256: string;
  capabilities?: string[];
}

interface RuntimePointer {
  active: string;
  previous?: string;
  sha256: string;
  previousSha256?: string;
  // An explicit rollback or failed candidate remains selected across host
  // restarts. Only the user's Upgrade command releases this selection.
  pinned?: boolean;
}

export interface ManagedCliContext {
  extensionPath: string;
  globalStoragePath: string;
  extensionVersion?: string;
}

export interface CliPathResolver {
  ensureReady(): Promise<string>;
  getCurrentPath(): string | undefined;
}

/**
 * Owns the lifecycle of the native CLI shipped in the VSIX. The executable is
 * copied out of VS Code's versioned extension directory before it is used by
 * event-triggered hooks; updates therefore never depend on a service manifest
 * pointing at a path that VS Code has just removed.
 */
export class ManagedCliManager implements CliPathResolver {
  private ready?: Promise<string>;
  private currentPath?: string;
  private selectedOverride?: string;

  public constructor(
    private readonly context: ManagedCliContext,
    private readonly getConfig: () => WakaclockConfigSnapshot,
    private readonly logger: Logger,
  ) {}

  public getCurrentPath(): string | undefined {
    return this.currentPath;
  }

  public ensureReady(): Promise<string> {
    const override = this.getConfig().cliPath.trim();
    if (this.selectedOverride !== override) { this.ready = undefined; this.selectedOverride = override; }
    if (!this.ready) {
      this.ready = this.bootstrap().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  public async rollback(): Promise<string> {
    if (this.getConfig().cliPath.trim()) throw new Error("Custom CLI paths must be managed by their owner.");
    const journal = await this.openPointer();
    try {
      const current = journal.read();
      if (!current?.previous || !current.previousSha256) throw new Error("No previous managed CLI is available.");
      const relative = path.relative(path.join(this.context.globalStoragePath, "cli"), current.previous);
      if (relative.startsWith("..") || path.isAbsolute(relative) || await sha256(current.previous) !== current.previousSha256) throw new Error("Previous managed CLI failed verification.");
      await assertExecutable(current.previous);
      await execFileAsync(current.previous, ["--version"], { timeout: 10_000 });
      await this.assertHandoffCapability(current.previous);
      journal.append({ active: current.previous, sha256: current.previousSha256, previous: current.active, previousSha256: current.sha256, pinned: true }, 0);
      this.currentPath = current.previous;
      this.selectedOverride = "";
      this.ready = Promise.resolve(current.previous);
      return current.previous;
    } finally { journal.close(); }
  }

  public async upgrade(): Promise<string> {
    if (this.getConfig().cliPath.trim()) throw new Error("Custom CLI paths must be managed by their owner.");
    // Keep the existing pin until the replacement is verified and committed.
    this.ready = undefined;
    const binary = await this.bootstrap(true);
    this.selectedOverride = "";
    this.ready = Promise.resolve(binary);
    return binary;
  }

  private async assertHandoffCapability(binary: string): Promise<void> {
    const capability = JSON.parse((await execFileAsync(binary, ["journal-scope"], { timeout: 10_000 })).stdout);
    if (!capability.capabilities?.includes("editor_durable_ack_v1")) throw new Error("CLI durable handoff capability mismatch.");
  }

  private async openPointer(): Promise<HeartbeatJournal<RuntimePointer>> {
    const deadline = Date.now() + 5_000;
    for (;;) {
      try { return new HeartbeatJournal<RuntimePointer>(path.join(this.context.globalStoragePath, "cli", "runtime-pointer")); }
      catch (error) {
        if (!(error instanceof Error) || error.message !== "journal_locked" || Date.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  private async recoverActiveRuntime(pin = false, onlyPinned = false): Promise<string | undefined> {
    const pointer = await this.openPointer();
    try {
      if (pointer.health().status !== "ready") return undefined;
      const previous = pointer.read();
      if (!previous) return undefined;
      if (onlyPinned && !previous.pinned) return undefined;
      const relative = path.relative(path.join(this.context.globalStoragePath, "cli"), previous.active);
      if (relative.startsWith("..") || path.isAbsolute(relative) || await sha256(previous.active) !== previous.sha256) {
        if (previous.pinned) throw new Error("Selected managed CLI failed verification; use recovery diagnostics.");
        return undefined;
      }
      await assertExecutable(previous.active);
      await execFileAsync(previous.active, ["--version"], { timeout: 10_000 });
      await this.assertHandoffCapability(previous.active);
      if (pin) pointer.append({ ...previous, pinned: true }, 0);
      this.currentPath = previous.active;
      return previous.active;
    } finally { pointer.close(); }
  }

  private async bootstrap(allowUpgrade = false): Promise<string> {
    const configured = this.getConfig().cliPath.trim();
    if (configured) {
      await assertExecutable(configured);
      this.currentPath = configured;
      return configured;
    }

    const target = await resolveTarget();
    const binaryName = process.platform === "win32" ? "wakaclock.exe" : "wakaclock";
    const sourceBinary = path.join(this.context.extensionPath, "resources", "bin", binaryName);
    const manifestPath = path.join(this.context.extensionPath, "resources", "cli-manifest.json");
    const manifest = await readManifest(manifestPath);
    if (manifest.protocolVersion !== SUPPORTED_CLI_PROTOCOL_VERSION) {
      throw new Error(
        `Bundled AtoAxis CLI protocol ${manifest.protocolVersion} is not supported by this Extension.`,
      );
    }
    if (this.context.extensionVersion && manifest.cliVersion !== this.context.extensionVersion) {
      throw new Error(
        `Bundled AtoAxis CLI version ${manifest.cliVersion} does not match Extension ${this.context.extensionVersion}.`,
      );
    }
    if (manifest.target !== target) {
      throw new Error(
        `Bundled AtoAxis CLI targets ${manifest.target}, but this Extension Host requires ${target}. ` +
          "Install the platform-specific AtoAxis package for this machine.",
      );
    }
    if (manifest.binary !== binaryName) {
      throw new Error("Bundled AtoAxis CLI manifest does not match the platform binary.");
    }
    const sourceHash = await sha256(sourceBinary);
    if (sourceHash !== manifest.sha256.toLowerCase()) {
      throw new Error("Bundled AtoAxis CLI failed its checksum verification and was not executed.");
    }
    if (!allowUpgrade) {
      const selected = await this.recoverActiveRuntime(false, true);
      if (selected) return selected;
    }

    const version = manifest.cliVersion || this.context.extensionVersion || "unknown";
    const destinationDir = path.join(this.context.globalStoragePath, "cli", version, sourceHash);
    const destination = path.join(destinationDir, binaryName);
    await fs.mkdir(destinationDir, { recursive: true });

    let destinationUsable = false;
    try {
      destinationUsable = (await sha256(destination)) === sourceHash;
    } catch {
      destinationUsable = false;
    }
    if (!destinationUsable) {
      const temporary = `${destination}.tmp-${process.pid}`;
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      await fs.copyFile(sourceBinary, temporary);
      if (process.platform !== "win32") {
        await fs.chmod(temporary, 0o755);
      }
      // Never overwrite an executable in use. A same-version build has a new
      // hash directory; a corrupt existing file is quarantined, not deleted.
      try { await fs.rename(destination, `${destination}.invalid-${Date.now()}`); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Managed CLI is locked; stop the owned runtime before repairing it.");
      }
      await fs.rename(temporary, destination);
    }

    await assertExecutable(destination);
    try {
      const result = await execFileAsync(destination, ["--version"], { timeout: 10_000 });
      if (manifest.capabilities?.includes("editor_durable_ack_v1")) {
        const probe = JSON.parse((await execFileAsync(destination, ["journal-scope"], { timeout: 10_000 })).stdout);
        if (!probe.capabilities?.includes("editor_durable_ack_v1")) throw new Error("CLI durable handoff capability mismatch.");
      }
      this.logger.debug("managed AtoAxis CLI ready", {
        target,
        version,
        versionOutput: result.stdout.trim(),
      });
    } catch (error) {
      const previous = await this.recoverActiveRuntime(true);
      if (previous) {
        this.logger.warn("Candidate CLI could not start; the previous verified executable remains active.");
        return previous;
      }
      throw new Error(`Bundled AtoAxis CLI could not start: ${error instanceof Error ? error.message : String(error)}`);
    }
    const pointer = await this.openPointer();
    try {
      if (pointer.health().status !== "ready") throw new Error("Managed CLI pointer is corrupt; use recovery diagnostics.");
      const previous = pointer.read();
      pointer.append({ active: destination, sha256: sourceHash,
        previous: previous?.active === destination ? previous.previous : previous?.active,
        previousSha256: previous?.active === destination ? previous.previousSha256 : previous?.sha256 }, 0);
    } finally { pointer.close(); }
    this.currentPath = destination;
    return destination;
  }
}

async function readManifest(file: string): Promise<CliManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `AtoAxis CLI manifest is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AtoAxis CLI manifest is invalid.");
  }
  const manifest = parsed as Partial<CliManifest>;
  if (
    manifest.schemaVersion !== 1 ||
    typeof manifest.cliVersion !== "string" ||
    !SAFE_CLI_VERSION.test(manifest.cliVersion) ||
    typeof manifest.protocolVersion !== "number" ||
    typeof manifest.target !== "string" ||
    typeof manifest.binary !== "string" ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? "")
  ) {
    throw new Error("AtoAxis CLI manifest is missing required fields.");
  }
  return manifest as CliManifest;
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const content = await fs.readFile(file);
  hash.update(content);
  return hash.digest("hex");
}

async function assertExecutable(file: string): Promise<void> {
  try {
    await fs.access(file);
  } catch (error) {
    throw new Error(
      `AtoAxis CLI is unavailable at ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function resolveTarget(): Promise<string> {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") return "darwin-arm64";
    if (process.arch === "x64") return "darwin-x64";
  }
  if (process.platform === "win32") {
    if (process.arch === "arm64") return "win32-arm64";
    if (process.arch === "x64") return "win32-x64";
  }
  if (process.platform === "linux") {
    const alpine = await fs
      .access("/etc/alpine-release")
      .then(() => true)
      .catch(() => false);
    if (alpine) {
      if (process.arch === "arm64") return "alpine-arm64";
      if (process.arch === "x64") return "alpine-x64";
    } else {
      if (process.arch === "arm64") return "linux-arm64";
      if (process.arch === "x64") return "linux-x64";
    }
  }
  throw new Error(`Unsupported AtoAxis platform: ${process.platform}/${process.arch}`);
}

export const managedCliInternals = {
  readManifest,
  resolveTarget,
  sha256,
  SAFE_CLI_VERSION,
  SUPPORTED_CLI_PROTOCOL_VERSION,
};
