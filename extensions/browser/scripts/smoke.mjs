/** Isolated browser profile and local OAuth/ingest fixture. No real credentials. */
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const received = [],
    requests = [];
let available = true;
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
                verification_uri: "https://atoaxis.com/device",
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
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
execFileSync(process.execPath, ["scripts/build.mjs"], {
    env: {
        ...process.env,
        ATOAXIS_BROWSER_API_URL: "http://127.0.0.1:" + port,
        ATOAXIS_BROWSER_BUILD_DIR: "dist/smoke",
    },
});
const profile = await mkdtemp(path.join(tmpdir(), "atoaxis-browser-smoke-"));
const extension = path.resolve("dist/smoke/chromium");
const errors = [];
const channel = process.env.ATOAXIS_BROWSER_CHANNEL ?? "chromium";
let context;
async function launch() {
    const instance = await chromium.launchPersistentContext(profile, {
        channel,
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        args:
            channel === "chromium"
                ? [
                      "--disable-extensions-except=" + extension,
                      "--load-extension=" + extension,
                  ]
                : ["--enable-unsafe-extension-debugging"],
    });
    let loadedId;
    if (channel !== "chromium") {
        const cdp = await instance.browser().newBrowserCDPSession();
        loadedId = (
            await cdp.send("Extensions.loadUnpacked", { path: extension })
        ).id;
    }
    await instance.route("https://atoaxis.com/**", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<h1>Local authorization fixture</h1>",
        }),
    );
    await instance.route("https://example.com/**", (route) =>
        route.fulfill({
            contentType: "text/html",
            body: "<h1>Documentation fixture</h1><p>Only the URL is observed.</p>",
        }),
    );
    instance.on("page", (page) =>
        page.on("pageerror", (error) => errors.push(error.message)),
    );
    const id =
        loadedId ??
        new URL(
            (
                instance.serviceWorkers()[0] ??
                (await instance.waitForEvent("serviceworker"))
            ).url(),
        ).host;
    return { instance, id };
}
try {
    const initial = await launch();
    context = initial.instance;
    const id = initial.id;
    let ui = await context.newPage();
    ui.on("pageerror", (error) => errors.push(error.message));
    await ui.goto("chrome-extension://" + id + "/options.html");
    await expect(ui.locator("#connection")).toContainText("Connect your");
    await ui.locator("#connect").click();
    await expect(ui.locator("#device")).toContainText("TEST-CODE");
    await expect
        .poll(
            async () =>
                ui.evaluate(() =>
                    chrome.runtime.sendMessage({ type: "status" }),
                ),
            { timeout: 20_000 },
        )
        .toMatchObject({ connected: true });
    await ui.reload();
    await expect(ui.locator("#toggle")).toBeEnabled();
    await ui.locator("#load-projects").click();
    await expect(ui.locator("#rule-project")).toContainText("Documentation");
    await ui.locator("#rule-domain").fill("example.com");
    await ui.locator("#rule-path").fill("/docs");
    await ui.locator("#rule-project").selectOption("Documentation");
    await ui.locator("#add-rule").click();
    // Automated headless navigation must not depend on the host user's physical input.
    // Verify the shipped default, then extend AFK for this fixture; native AFK/lock are manual gates.
    await expect(ui.locator("#afk")).toHaveValue("5");
    await ui.locator("#afk").fill("1440");
    await ui.locator("#save").click();
    await expect(ui.locator("#saved")).toHaveText("Settings saved.");
    await ui.locator("#toggle").click();
    const site = await context.newPage();
    await site.goto("https://example.com/docs/first?secret=never-send#private");
    await site.bringToFront();
    await expect
        .poll(
            async () =>
                ui.evaluate(() =>
                    chrome.runtime.sendMessage({ type: "status" }),
                ),
            { timeout: 10_000 },
        )
        .toMatchObject({
            tracking: true,
            domain: "example.com",
            project: "Documentation",
        });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await site.goto("https://example.com/docs/second");
    await expect
        .poll(() => received.length, { timeout: 10_000 })
        .toBeGreaterThan(0);
    expect(received[0]).toMatchObject({
        entity: "example.com",
        entity_type: "domain",
        category: "browsing",
        project: "Documentation",
        actor_type: "unknown",
    });
    expect(JSON.stringify(received)).not.toMatch(
        /secret|private|\/docs|title|cookie/,
    );
    available = false;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await site.goto("https://example.com/docs/offline");
    await expect
        .poll(
            async () =>
                (
                    await ui.evaluate(() =>
                        chrome.runtime.sendMessage({ type: "status" }),
                    )
                ).pending,
        )
        .toBeGreaterThan(0);
    const offlineState = await ui.evaluate(() =>
        chrome.runtime.sendMessage({ type: "status" }),
    );
    // A full process restart loses the worker, while the same isolated profile retains IndexedDB.
    // Native worker termination remains a manual release check; CDP does not reliably stop extension workers.
    await context.close();
    const restarted = await launch();
    context = restarted.instance;
    expect(restarted.id).toBe(id);
    ui = await context.newPage();
    await ui.goto("chrome-extension://" + id + "/options.html");
    await expect(ui.locator("#connection")).toContainText("Connected");
    await expect
        .poll(
            async () =>
                (
                    await ui.evaluate(() =>
                        chrome.runtime.sendMessage({ type: "status" }),
                    )
                ).pending,
        )
        .toBeGreaterThan(0);
    available = true;
    await ui.evaluate(() => chrome.runtime.sendMessage({ type: "retry" }));
    await expect
        .poll(
            async () =>
                (
                    await ui.evaluate(() =>
                        chrome.runtime.sendMessage({ type: "status" }),
                    )
                ).pending,
        )
        .toBe(0);
    await ui.evaluate(
        (settings) =>
            chrome.runtime.sendMessage({
                type: "settings",
                settings: { ...settings, enabled: false },
            }),
        offlineState.settings,
    );
    await expect
        .poll(
            async () =>
                (
                    await ui.evaluate(() =>
                        chrome.runtime.sendMessage({ type: "status" }),
                    )
                ).tracking,
        )
        .toBe(false);
    await ui.bringToFront();
    await ui.reload();
    await mkdir("dist/screenshots", { recursive: true });
    await ui.screenshot({
        path: "dist/screenshots/options.png",
        fullPage: true,
    });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await expect(popup.locator("#connection")).toContainText("Connected");
    await popup
        .locator("body")
        .screenshot({ path: "dist/screenshots/popup.png" });
    await ui.evaluate(() => chrome.runtime.sendMessage({ type: "disconnect" }));
    expect(
        await ui.evaluate(() => chrome.runtime.sendMessage({ type: "status" })),
    ).toMatchObject({ connected: false, pending: 0, seconds: 0 });
    expect(requests).toContain("/oauth/revoke");
    expect(errors).toEqual([]);
    const report = {
        browser: channel === "chromium" ? "Chromium" : channel,
        version: context.browser()?.version(),
        platform: process.platform,
        architecture: process.arch,
        run_at: new Date().toISOString(),
        fixture: true,
        fixture_afk_minutes: 1440,
        passed: [
            "device-login",
            "project-mapping",
            "domain-only-payload",
            "foreground-navigation",
            "offline-replay",
            "browser-restart",
            "pause",
            "disconnect",
            "popup",
            "settings",
        ],
        record_count: received.length,
    };
    await writeFile(
        "dist/smoke-report-" + channel + ".json",
        JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
} catch (error) {
    console.error("Fixture request paths: " + JSON.stringify(requests));
    throw error;
} finally {
    await context?.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
}
