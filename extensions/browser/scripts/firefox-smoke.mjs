/**
 * Official Firefox + geckodriver; disposable profile and synthetic loopback API only.
 * From extensions/browser:
 * ATOAXIS_FIREFOX_BINARY=/path/to/Firefox.app/Contents/MacOS/firefox \
 * ATOAXIS_GECKODRIVER=/path/to/geckodriver node scripts/firefox-smoke.mjs
 * Requires Node 22+, Python 3, installed package dependencies, Firefox and geckodriver.
 * macOS uses LaunchServices; other platforms use geckodriver's native launcher.
 * Report: dist/smoke-report-firefox.json; screenshot: dist/screenshots/firefox-popup.png.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect } from "@playwright/test";

const binary = process.env.ATOAXIS_FIREFOX_BINARY;
const driverBinary = process.env.ATOAXIS_GECKODRIVER ?? "geckodriver";
if (!binary)
    throw new Error(
        "Set ATOAXIS_FIREFOX_BINARY to the official Firefox executable.",
    );
let available = true;
const received = [],
    requests = [];
const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push(req.url);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/oauth/device/code")
        return res.end(
            JSON.stringify({
                device_code: "fixture-code",
                user_code: "TEST-CODE",
                verification_uri: api + "/approval",
                expires_in: 300,
                interval: 5,
            }),
        );
    if (req.url === "/oauth/device/token" || req.url === "/oauth/token")
        return res.end(
            JSON.stringify({
                access_token: "fixture-access",
                refresh_token: "fixture-refresh",
                expires_in: 3600,
            }),
        );
    if (req.url === "/oauth/revoke") return res.end("{}");
    if (req.url.startsWith("/approval")) {
        res.setHeader("Content-Type", "text/html");
        return res.end("<h1>Synthetic authorization fixture</h1>");
    }
    if (req.url === "/api/v1/users/current/projects")
        return res.end(JSON.stringify({ data: [{ name: "Documentation" }] }));
    if (req.url === "/api/v1/heartbeats.bulk") {
        if (!available) {
            res.statusCode = 503;
            return res.end("{}");
        }
        const payload = JSON.parse(Buffer.concat(chunks).toString());
        received.push(...payload);
        res.statusCode = 202;
        return res.end(
            JSON.stringify({
                responses: payload.map((p) => [
                    { data: { id: p.heartbeat_id } },
                    201,
                ]),
            }),
        );
    }
    res.statusCode = 404;
    res.end("{}");
});
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "atoaxis-firefox-smoke-"));
const nativeProfile = path.join(temporaryRoot, "profile");
let api, archive;
let driver,
    driverUrl,
    session,
    capabilities,
    options,
    site,
    socket,
    optionsContext;
let bidiId = 0;
const pending = new Map();
function bidi(method, params = {}) {
    const id = ++bidiId;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pending.delete(id);
            reject(new Error("BiDi timed out: " + method));
        }, 15_000);
        pending.set(id, {
            resolve: (result) => {
                clearTimeout(timeout);
                resolve(result);
            },
            reject: (error) => {
                clearTimeout(timeout);
                reject(error);
            },
        });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function wire(method, route, data) {
    const response = await fetch(driverUrl + route, {
        method,
        headers: { "Content-Type": "application/json" },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json();
    if (!response.ok)
        throw new Error(
            "WebDriver " +
                route +
                ": " +
                result.value?.error +
                " " +
                result.value?.message,
        );
    return result.value;
}
const wd = (method, route, data) =>
    wire(method, "/session/" + session + route, data);
const execute = (script, args = []) =>
    wd("POST", "/execute/sync", { script, args });
const select = (handle) => wd("POST", "/window", { handle });
const navigate = (url) => wd("POST", "/url", { url });
async function command(message) {
    // BiDi targets the extension document without activating it or disturbing the foreground website.
    const result = await bidi("script.evaluate", {
        expression:
            "(async () => JSON.stringify(await browser.runtime.sendMessage(" +
            JSON.stringify(message) +
            ")))()",
        target: { context: optionsContext },
        awaitPromise: true,
    });
    if (result.type !== "success")
        throw new Error("Extension command failed: " + result.type);
    return JSON.parse(result.result.value);
}
async function freePort() {
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    return port;
}
let cleaned = false;
async function cleanup() {
    if (cleaned) return;
    cleaned = true;
    const fixturePids = new Set();
    if (Number.isInteger(capabilities?.["moz:processID"])) fixturePids.add(capabilities["moz:processID"]);
    // LaunchServices owns the browser process, including if session creation fails.
    if (process.platform === "darwin") {
        for (const line of execFileSync("ps", ["-axo", "pid=,args="], { encoding: "utf8" }).split("\n")) {
            const match = line.trim().match(/^(\d+) (.*)$/);
            if (match && match[2].startsWith(binary + " ") && match[2].includes("-profile " + nativeProfile + " ")) fixturePids.add(Number(match[1]));
        }
    }
    if (session) await wd("DELETE", "").catch(() => undefined);
    socket?.close();
    driver?.kill();
    for (const pid of fixturePids) {
        try { process.kill(pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (let i = 0; i < 50 && [...fixturePids].some(alive); i++) await new Promise(resolve => setTimeout(resolve, 100));
    for (const pid of fixturePids) if (alive(pid)) process.kill(pid, "SIGKILL");
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(temporaryRoot, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void cleanup().finally(() => process.exit(1)); });
try {
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
api = "http://127.0.0.1:" + server.address().port;
execFileSync(process.execPath, ["scripts/build.mjs"], {
    env: {
        ...process.env,
        ATOAXIS_BROWSER_API_URL: api,
        ATOAXIS_BROWSER_BUILD_DIR: "dist/firefox-smoke",
    },
});
archive = path.join(temporaryRoot, "addon.zip");
execFileSync(process.platform === "win32" ? "python" : "python3", [
    "-c",
    'from pathlib import Path; import zipfile,sys; root=Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
    path.resolve("dist/firefox-smoke/firefox"),
    archive,
]);
    const port = await freePort();
    const marionettePort = await freePort();
    const bidiPort = await freePort();
    const profileRoot = temporaryRoot;
    if (process.platform === "darwin") {
        assert(binary.endsWith(".app/Contents/MacOS/firefox"), "Use the executable inside a signed Firefox.app");
        await mkdir(nativeProfile);
        await writeFile(path.join(nativeProfile, "user.js"), `user_pref("marionette.port", ${marionettePort});\nuser_pref("browser.shell.checkDefaultBrowser", false);\n`);
        execFileSync("open", ["-n", "--env", "MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1", "-a", binary.slice(0, -"/Contents/MacOS/firefox".length), "--args", "-headless", "-no-remote", "-marionette", "--remote-debugging-port", String(bidiPort), "-profile", nativeProfile, "about:blank"]);
    }
    driver = spawn(
        driverBinary,
        [
            ...(process.platform === "darwin" ? ["--connect-existing", "--marionette-port", String(marionettePort)] : []),
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--allow-system-access",
            "--profile-root",
            profileRoot,
            "--log",
            "warn",
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
    );
    const driverLog = createWriteStream("dist/firefox-smoke/driver.log");
    driver.stdout.pipe(driverLog, { end: false });
    driver.stderr.pipe(driverLog, { end: false });
    driver.on("error", (error) => { driverLog.write(String(error) + "\n"); });
    driver.on("exit", () => driverLog.end());
    driverUrl = "http://127.0.0.1:" + port;
    await expect
        .poll(
            async () => {
                try {
                    return (await wire("GET", "/status")).ready;
                } catch {
                    return false;
                }
            },
            { timeout: 20_000 },
        )
        .toBe(true);
    const created = await wire("POST", "/session", {
        capabilities: {
            alwaysMatch: {
                browserName: "firefox",
                webSocketUrl: true,
                "moz:firefoxOptions": {
                    binary,
                    args: ["-headless"],
                    prefs: { "browser.shell.checkDefaultBrowser": false },
                },
            },
        },
    });
    session = created.sessionId;
    capabilities = created.capabilities;
    socket = new WebSocket(capabilities.webSocketUrl);
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        const request = pending.get(message.id);
        if (request) {
            pending.delete(message.id);
            if (message.type === "error")
                request.reject(
                    new Error(message.error + ": " + message.message),
                );
            else request.resolve(message.result);
        } else if (
            message.method === "network.beforeRequestSent" &&
            message.params.isBlocked && new URL(message.params.request.url).hostname === "example.com"
        ) {
            void bidi("network.provideResponse", {
                request: message.params.request.request,
                statusCode: 200,
                headers: [
                    {
                        name: "Content-Type",
                        value: { type: "string", value: "text/html" },
                    },
                ],
                body: {
                    type: "string",
                    value: "<h1>Synthetic documentation fixture</h1>",
                },
            }).catch(() => undefined);
        }
    });
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
    });
    await bidi("session.subscribe", { events: ["network.beforeRequestSent"] });
    await bidi("network.addIntercept", {
        phases: ["beforeRequestSent"],
        urlPatterns: [
            { type: "pattern", protocol: "https", hostname: "example.com" },
        ],
    });
    assert.equal(
        await wd("POST", "/moz/addon/install", {
            path: archive,
            temporary: true,
        }),
        "browser@atoaxis.com",
    );
    await wd("POST", "/moz/context", { context: "chrome" });
    const uuids = JSON.parse(await execute('return Services.prefs.getStringPref("extensions.webextensions.uuids");'));
    await wd("POST", "/moz/context", { context: "content" });
    const origin = "moz-extension://" + uuids["browser@atoaxis.com"];
    options = await wd("GET", "/window");
    await navigate(origin + "/options.html");
    optionsContext = (await bidi("browsingContext.getTree", {})).contexts.find(
        (context) => context.url === origin + "/options.html",
    ).context;
    await expect
        .poll(() =>
            execute(
                'return document.querySelector("#connection")?.textContent;',
            ),
        )
        .toContain("Connect your");
    assert.equal(await execute("return browser.permissions.contains({origins: [arguments[0]]});", ["http://127.0.0.1/*"]), true);
    assert.deepEqual(await command({ type: "connect" }), { ok: true });
    await expect
        .poll(() => command({ type: "status" }), { timeout: 20_000 })
        .toMatchObject({ connected: true });
    await command({ type: "projects" });
    const settings = {
        ...(await command({ type: "status" })).settings,
        enabled: true,
        afkTimeoutMs: 86_400_000,
        rules: [
            {
                domain: "example.com",
                includeSubdomains: false,
                pathPrefix: "/docs",
                project: "Documentation",
            },
        ],
    };
    assert.deepEqual(await command({ type: "settings", settings }), {
        ok: true,
    });
    site = (await wd("POST", "/window/new", { type: "tab" })).handle;
    await select(site);
    await navigate("https://example.com/docs/first?secret=never-send#private");
    await expect
        .poll(() => command({ type: "status" }), { timeout: 15_000 })
        .toMatchObject({
            tracking: true,
            domain: "example.com",
            project: "Documentation",
        });
    await select(site);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await command({
        type: "settings",
        settings: { ...settings, enabled: false },
    });
    await expect.poll(() => received.length).toBeGreaterThan(0);
    assert.equal(received[0].entity, "example.com");
    assert.equal(received[0].project, "Documentation");
    assert.doesNotMatch(
        JSON.stringify(received),
        /secret|private|\/docs|title|cookie/,
    );
    const paused = await command({ type: "status" });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal((await command({ type: "status" })).seconds, paused.seconds);
    available = false;
    await select(site);
    await command({ type: "settings", settings });
    await select(site);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await command({
        type: "settings",
        settings: { ...settings, enabled: false },
    });
    await expect
        .poll(async () => (await command({ type: "status" })).pending)
        .toBeGreaterThan(0);
    available = true;
    await command({ type: "retry" });
    await expect
        .poll(async () => (await command({ type: "status" })).pending)
        .toBe(0);
    await select(options);
    await navigate(origin + "/popup.html");
    await expect
        .poll(() =>
            execute(
                'return document.querySelector("#connection")?.textContent;',
            ),
        )
        .toContain("Connected");
    await mkdir("dist/screenshots", { recursive: true });
    const screenshot = await wd("GET", "/screenshot");
    await writeFile(
        "dist/screenshots/firefox-popup.png",
        Buffer.from(screenshot, "base64"),
    );
    await command({ type: "disconnect" });
    assert.deepEqual(
        {
            connected: (await command({ type: "status" })).connected,
            pending: (await command({ type: "status" })).pending,
        },
        { connected: false, pending: 0 },
    );
    assert(requests.includes("/oauth/revoke"));
    const report = {
        browser: "Firefox",
        version: capabilities.browserVersion,
        platform: process.platform,
        architecture: process.arch,
        run_at: new Date().toISOString(),
        fixture: true,
        fixture_afk_minutes: 1440,
        passed: [
            "temporary-install",
            "background-event-page",
            "device-login",
            "project-mapping",
            "domain-only-payload",
            "pause-freezes-time",
            "offline-replay",
            "disconnect",
            "popup",
            "settings",
        ],
        record_count: received.length,
    };
    await writeFile(
        "dist/smoke-report-firefox.json",
        JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
 } finally {
    await cleanup();
}
