import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { Logger } from "./logging";
import type { WakaclockConfigSnapshot } from "./types";

const execFileAsync = promisify(execFile);

export interface CliManifest {
  schemaVersion: number;
  cliVersion: string;
  protocolVersion: number;
  target: string;
  binary: string;
  sha256: string;
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
 * copied out of VS Code's versioned extension directory before it is used by an
 * agent service; updates therefore never leave LaunchAgent/systemd pointing at a
 * path that VS Code has just removed.
 */
export class ManagedCliManager implements CliPathResolver {
  private ready?: Promise<string>;
  private currentPath?: string;

  public constructor(
    private readonly context: ManagedCliContext,
    private readonly getConfig: () => WakaclockConfigSnapshot,
    private readonly logger: Logger,
  ) {}

  public getCurrentPath(): string | undefined {
    return this.currentPath;
  }

  public ensureReady(): Promise<string> {
    if (!this.ready) {
      this.ready = this.bootstrap().catch((error) => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  private async bootstrap(): Promise<string> {
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

    const version = manifest.cliVersion || this.context.extensionVersion || "unknown";
    const destinationDir = path.join(this.context.globalStoragePath, "cli", version);
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
      if (process.platform === "win32") {
        await fs.rm(destination, { force: true }).catch(() => undefined);
      }
      await fs.rename(temporary, destination);
    }

    await assertExecutable(destination);
    try {
      const result = await execFileAsync(destination, ["--version"], { timeout: 10_000 });
      this.logger.debug("managed AtoAxis CLI ready", {
        target,
        version,
        versionOutput: result.stdout.trim(),
      });
    } catch (error) {
      throw new Error(
        `Bundled AtoAxis CLI could not start: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

export const managedCliInternals = { readManifest, resolveTarget, sha256 };
