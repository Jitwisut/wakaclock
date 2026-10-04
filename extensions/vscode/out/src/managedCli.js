"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.managedCliInternals = exports.ManagedCliManager = void 0;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs/promises"));
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const SUPPORTED_CLI_PROTOCOL_VERSION = 1;
const SAFE_CLI_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/**
 * Owns the lifecycle of the native CLI shipped in the VSIX. The executable is
 * copied out of VS Code's versioned extension directory before it is used by
 * event-triggered hooks; updates therefore never depend on a service manifest
 * pointing at a path that VS Code has just removed.
 */
class ManagedCliManager {
    context;
    getConfig;
    logger;
    ready;
    currentPath;
    constructor(context, getConfig, logger) {
        this.context = context;
        this.getConfig = getConfig;
        this.logger = logger;
    }
    getCurrentPath() {
        return this.currentPath;
    }
    ensureReady() {
        if (!this.ready) {
            this.ready = this.bootstrap().catch((error) => {
                this.ready = undefined;
                throw error;
            });
        }
        return this.ready;
    }
    async bootstrap() {
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
            throw new Error(`Bundled AtoAxis CLI protocol ${manifest.protocolVersion} is not supported by this Extension.`);
        }
        if (this.context.extensionVersion && manifest.cliVersion !== this.context.extensionVersion) {
            throw new Error(`Bundled AtoAxis CLI version ${manifest.cliVersion} does not match Extension ${this.context.extensionVersion}.`);
        }
        if (manifest.target !== target) {
            throw new Error(`Bundled AtoAxis CLI targets ${manifest.target}, but this Extension Host requires ${target}. ` +
                "Install the platform-specific AtoAxis package for this machine.");
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
        }
        catch {
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
        }
        catch (error) {
            throw new Error(`Bundled AtoAxis CLI could not start: ${error instanceof Error ? error.message : String(error)}`);
        }
        this.currentPath = destination;
        return destination;
    }
}
exports.ManagedCliManager = ManagedCliManager;
async function readManifest(file) {
    let parsed;
    try {
        parsed = JSON.parse(await fs.readFile(file, "utf8"));
    }
    catch (error) {
        throw new Error(`AtoAxis CLI manifest is missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!parsed || typeof parsed !== "object") {
        throw new Error("AtoAxis CLI manifest is invalid.");
    }
    const manifest = parsed;
    if (manifest.schemaVersion !== 1 ||
        typeof manifest.cliVersion !== "string" ||
        !SAFE_CLI_VERSION.test(manifest.cliVersion) ||
        typeof manifest.protocolVersion !== "number" ||
        typeof manifest.target !== "string" ||
        typeof manifest.binary !== "string" ||
        !/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? "")) {
        throw new Error("AtoAxis CLI manifest is missing required fields.");
    }
    return manifest;
}
async function sha256(file) {
    const hash = crypto.createHash("sha256");
    const content = await fs.readFile(file);
    hash.update(content);
    return hash.digest("hex");
}
async function assertExecutable(file) {
    try {
        await fs.access(file);
    }
    catch (error) {
        throw new Error(`AtoAxis CLI is unavailable at ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function resolveTarget() {
    if (process.platform === "darwin") {
        if (process.arch === "arm64")
            return "darwin-arm64";
        if (process.arch === "x64")
            return "darwin-x64";
    }
    if (process.platform === "win32") {
        if (process.arch === "arm64")
            return "win32-arm64";
        if (process.arch === "x64")
            return "win32-x64";
    }
    if (process.platform === "linux") {
        const alpine = await fs
            .access("/etc/alpine-release")
            .then(() => true)
            .catch(() => false);
        if (alpine) {
            if (process.arch === "arm64")
                return "alpine-arm64";
            if (process.arch === "x64")
                return "alpine-x64";
        }
        else {
            if (process.arch === "arm64")
                return "linux-arm64";
            if (process.arch === "x64")
                return "linux-x64";
        }
    }
    throw new Error(`Unsupported AtoAxis platform: ${process.platform}/${process.arch}`);
}
exports.managedCliInternals = {
    readManifest,
    resolveTarget,
    sha256,
    SAFE_CLI_VERSION,
    SUPPORTED_CLI_PROTOCOL_VERSION,
};
//# sourceMappingURL=managedCli.js.map