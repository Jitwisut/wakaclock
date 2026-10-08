import browser from "webextension-polyfill";
import {
    normalizeOptions,
    trackedPage,
    type BrowserTrackerOptions,
} from "../shared/tracker";
import { Api } from "./api";
import { API_URL, APP_URL, CLIENT_ID, FAMILY, MAX_QUEUE } from "./config";
import { Database, enqueue } from "./database";
import { deliver } from "./delivery";
import { advance, localDay, type Observation } from "./tracking";
const db = new Database("atoaxis-browser-v1-" + new URL(API_URL).origin);
const api = new Api(db, API_URL, CLIENT_ID);
let tasks = Promise.resolve();
let network: Promise<void> | null = null;
let nativeError: string | null = null;
let projectCache: Array<{ name: string }> = [];
let projectAccount: string | null = null;
function serial<T>(job: () => Promise<T>): Promise<T> {
    const next = tasks.then(job);
    tasks = next.then(
        () => undefined,
        () => undefined,
    );
    return next;
}
async function snapshot(
    at: number,
    settings: BrowserTrackerOptions,
): Promise<Observation> {
    const window = await browser.windows.getLastFocused();
    const tabs =
        window.id === undefined
            ? []
            : await browser.tabs.query({ active: true, windowId: window.id });
    const tab = tabs[0];
    let idle = true;
    nativeError = null;
    if (FAMILY === "safari") {
        try {
            const result = (await browser.runtime.sendNativeMessage(
                "com.atoaxis.browser",
                { command: "status" },
            )) as {
                available?: boolean;
                idleSeconds?: number;
                focused?: boolean;
                sessionActive?: boolean;
            };
            if (
                result.available !== true ||
                !Number.isFinite(result.idleSeconds)
            )
                throw new Error("unavailable");
            idle =
                result.sessionActive !== true ||
                result.focused !== true ||
                Number(result.idleSeconds) * 1000 >= settings.afkTimeoutMs;
        } catch {
            nativeError =
                "Safari companion unavailable. Open the AtoAxis macOS app to resume tracking.";
        }
    } else {
        const status = await browser.idle.queryState(
            Math.ceil(settings.afkTimeoutMs / 1000),
        );
        idle = status !== "active";
    }
    return {
        at,
        verified: nativeError === null,
        monotonic: performance.now(),
        clockOrigin: performance.timeOrigin,
        context: String(window.id) + ":" + String(tab?.id),
        page:
            window.focused && !idle
                ? trackedPage(tab?.url, !!tab?.incognito, settings)
                : null,
    };
}
async function checkpoint(at: number, reset = false): Promise<void> {
    const state = await db.read();
    const observation: Observation =
        state.settings.enabled && state.credential && !state.blocked
            ? await snapshot(at, state.settings)
            : { at, page: null, context: "" };
    await db.update((s) => {
        if (reset) s.checkpoint = null;
        const active = s.credential && !s.blocked && s.queue.length < MAX_QUEUE;
        const next = { ...observation, page: active ? observation.page : null };
        const result = advance(
            s.checkpoint,
            next,
            FAMILY === "chromium"
                ? "AtoAxis Browser (Chromium)"
                : "AtoAxis Browser (" + FAMILY + ")",
            crypto.randomUUID(),
        );
        const saved =
            result.heartbeat && s.credential
                ? enqueue(s, s.credential.account, result.heartbeat)
                : true;
        s.checkpoint =
            saved && s.queue.length < MAX_QUEUE ? result.checkpoint : null;
    });
}
function pump(): void {
    if (network) return;
    network = (async () => {
        await api.poll();
        await deliver(db, api);
        const state = await db.read();
        if (state.device)
            setTimeout(
                pump,
                Math.max(1000, state.device.nextPollAt - Date.now()),
            );
    })()
        .catch(() => undefined)
        .finally(() => {
            network = null;
        });
}
function observe(reset = false): void {
    const at = Date.now();
    void serial(() => checkpoint(at, reset))
        .then(pump)
        .catch(() => {
            nativeError = "Activity status could not be read. Tracking paused.";
            void db.update((s) => {
                s.checkpoint = null;
            });
        });
}
// Register every wake-up listener synchronously before opening storage or making requests.
browser.tabs.onActivated.addListener(() => observe());
browser.tabs.onUpdated.addListener((_id, change) => {
    if (change.url || change.status === "complete") observe();
});
browser.tabs.onRemoved.addListener(() => observe());
browser.windows.onFocusChanged.addListener(() => observe());
if (FAMILY !== "safari")
    browser.idle.onStateChanged.addListener(() => observe());
browser.runtime.onStartup.addListener(() => observe(true));
browser.runtime.onInstalled.addListener(() => observe(true));
browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkpoint") observe();
});
browser.runtime.onMessage.addListener(
    (message: unknown, sender: browser.Runtime.MessageSender) => {
        // No webpage, external extension, or future content script can use the token-bearing controller.
        if (
            sender.id !== browser.runtime.id ||
            !sender.url?.startsWith(browser.runtime.getURL(""))
        )
            return undefined;
        return command(message).catch((error) => ({
            error:
                error instanceof Error &&
                /^(Invalid|Enter|AFK|Too many|Duplicate|Unsupported)/.test(
                    error.message,
                )
                    ? error.message
                    : "Operation failed. Check your connection and try again.",
        }));
    },
);
async function command(raw: unknown): Promise<unknown> {
    if (!raw || typeof raw !== "object") throw new Error("Invalid request");
    const m = raw as Record<string, unknown>;
    if (m.type === "status") {
        // Reading the popup must not itself manufacture a tracking interval.
        await tasks;
        const s = await db.read();
        const account = s.credential?.account;
        return {
            connected: !!s.credential && !s.blocked,
            hasCredential: !!s.credential,
            settings: s.settings,
            domain: s.checkpoint?.domain ?? null,
            project: s.checkpoint?.project ?? null,
            tracking: !!s.checkpoint,
            seconds: account
                ? (s.totals[account]?.[localDay(Date.now())] ?? 0)
                : 0,
            pending: account
                ? s.queue.filter((q) => q.account === account).length
                : 0,
            error:
                nativeError ??
                (s.queue.length >= MAX_QUEUE && !s.blocked
                    ? "Offline queue is full. Tracking paused until delivery resumes."
                    : s.error),
            device: s.device
                ? {
                      userCode: s.device.userCode,
                      verificationUri: s.device.verificationUri,
                      expiresAt: s.device.expiresAt,
                  }
                : null,
        };
    }
    if (m.type === "connect") {
        if ((await db.read()).credential) await api.disconnect();
        const device = await api.connect();
        await browser.tabs.create({ url: device.verificationUri });
        pump();
        return { ok: true };
    }
    if (m.type === "disconnect") {
        await serial(async () => {
            await api.disconnect();
            projectCache = [];
            projectAccount = null;
        });
        return { ok: true };
    }
    if (m.type === "settings") {
        const settings = normalizeOptions(m.settings);
        await serial(async () => {
            await checkpoint(Date.now());
            await db.update((s) => {
                s.settings = settings;
                s.checkpoint = null;
            });
            if (FAMILY !== "safari")
                browser.idle.setDetectionInterval(
                    Math.ceil(settings.afkTimeoutMs / 1000),
                );
            await checkpoint(Date.now());
        });
        pump();
        return { ok: true };
    }
    if (m.type === "exclude") {
        await serial(async () => {
            await checkpoint(Date.now());
            const state = await db.read();
            if (!state.checkpoint) throw new Error("Invalid current website");
            const domain = state.checkpoint.domain;
            await db.update((s) => {
                s.settings.denylist = [
                    ...new Set([...s.settings.denylist, domain]),
                ];
                s.checkpoint = null;
            });
        });
        return { ok: true };
    }
    if (m.type === "projects") {
        const account = (await db.read()).credential?.account;
        if (!account) return { projects: [] };
        const response = (await api.authorized(
            "/api/v1/users/current/projects",
            {},
            account,
        )) as { data?: Array<{ name?: unknown }> };
        const latest = (await db.read()).credential?.account;
        if (latest !== account) return { projects: [] };
        projectCache = Array.isArray(response.data)
            ? response.data
                  .filter((p) => typeof p.name === "string")
                  .map((p) => ({ name: String(p.name) }))
            : [];
        projectAccount = account;
        return { projects: projectAccount === latest ? projectCache : [] };
    }
    if (m.type === "options") {
        await browser.runtime.openOptionsPage();
        return { ok: true };
    }
    if (m.type === "dashboard") {
        await browser.tabs.create({
            url: APP_URL + "/dashboard/wakaclock",
        });
        return { ok: true };
    }
    if (m.type === "retry") {
        await db.update((s) => {
            s.nextRetryAt = 0;
        });
        pump();
        return { ok: true };
    }
    throw new Error("Invalid request");
}
void (async () => {
    const local = browser.storage.local as typeof browser.storage.local & {
        setAccessLevel?: (options: { accessLevel: string }) => Promise<void>;
    };
    if (local.setAccessLevel)
        await local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
    await browser.alarms.create("checkpoint", { periodInMinutes: 1 });
    const state = await db.read();
    if (FAMILY !== "safari")
        browser.idle.setDetectionInterval(
            Math.ceil(state.settings.afkTimeoutMs / 1000),
        );
    // Ordinary worker suspension preserves the checkpoint; startup/onInstalled resets it.
    pump();
})().catch(() => {
    nativeError = "Initialization failed. Reload the extension.";
});
