import browser from "webextension-polyfill";
import { FAMILY } from "./config";
import {
    exportSettings,
    importSettings,
    normalizeOptions,
    type BrowserTrackerOptions,
    type ProjectRule,
} from "../shared/tracker";
interface Status {
    connected: boolean;
    hasCredential: boolean;
    settings: BrowserTrackerOptions;
    domain: string | null;
    project: string | null;
    tracking: boolean;
    seconds: number;
    pending: number;
    error: string | null;
    device: { userCode: string } | null;
}
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
let current: Status | null = null;
let rules: ProjectRule[] = [];
let actionError: string | null = null;
function showError(message: string | null) {
    actionError = message;
    el("error").textContent = actionError ?? current?.error ?? "";
}
async function send<T>(message: unknown): Promise<T> {
    const response = (await browser.runtime.sendMessage(message)) as T & {
        error?: unknown;
    };
    if (typeof response?.error === "string" && !("connected" in response))
        throw new Error(response.error);
    return response;
}
function on(id: string, action: () => Promise<void> | void): void {
    el(id)?.addEventListener("click", () => {
        showError(null);
        void Promise.resolve()
            .then(action)
            .catch((e) =>
                showError(e instanceof Error ? e.message : "Operation failed"),
            );
    });
}
async function refresh(fill = false): Promise<void> {
    current = await send<Status>({ type: "status" });
    const s = current;
    el("connection").textContent = s.connected
        ? "Connected to AtoAxis"
        : "Connect your AtoAxis account";
    el("state").textContent = s.tracking
        ? "Tracking"
        : s.settings.enabled
          ? "Waiting for an eligible active website"
          : "Paused";
    el("domain").textContent = s.domain ?? "—";
    el("project").textContent = s.project ?? "Unassigned";
    el("seconds").textContent =
        Math.floor(s.seconds / 3600) +
        "h " +
        Math.floor((s.seconds % 3600) / 60) +
        "m";
    el("pending").textContent =
        s.pending + " activity records awaiting delivery";
    el("device").textContent = s.device
        ? "Approve code " + s.device.userCode + " in the opened AtoAxis tab."
        : "";
    el<HTMLButtonElement>("toggle").textContent = s.settings.enabled
        ? "Pause tracking"
        : "Enable tracking";
    el<HTMLButtonElement>("toggle").disabled = !s.connected;
    el<HTMLButtonElement>("exclude").disabled = !s.domain;
    el("privacy").hidden = s.settings.enabled;
    el("disconnect").hidden = !s.hasCredential && !s.device;
    el("connect").hidden = s.connected || !!s.device;
    el("error").textContent = actionError ?? s.error ?? "";
    if (fill && el("afk")) {
        el<HTMLInputElement>("afk").value = String(
            s.settings.afkTimeoutMs / 60_000,
        );
        el<HTMLTextAreaElement>("denylist").value =
            s.settings.denylist.join("\n");
        rules = structuredClone(s.settings.rules);
        renderRules();
    }
}
function renderRules(): void {
    const root = el("rules");
    root.replaceChildren();
    for (const [i, rule] of rules.entries()) {
        const row = document.createElement("li"),
            label = document.createElement("span"),
            remove = document.createElement("button");
        label.textContent =
            rule.domain +
            (rule.includeSubdomains ? " (+ subdomains)" : "") +
            rule.pathPrefix +
            " → " +
            rule.project;
        remove.textContent = "Remove";
        remove.type = "button";
        remove.addEventListener("click", () => {
            rules.splice(i, 1);
            renderRules();
        });
        row.append(label, remove);
        root.append(row);
    }
}
on("connect", async () => {
    if (
        current?.hasCredential &&
        !confirm(
            "Reconnect starts a new connection and clears unsent activity from the previous session. Continue?",
        )
    )
        return;
    await send({ type: "connect" });
    await refresh();
});
on("disconnect", async () => {
    if (!confirm("Disconnect and delete unsent activity and local totals?"))
        return;
    await send({ type: "disconnect" });
    await refresh();
});
on("toggle", async () => {
    if (!current) return;
    if (FAMILY === "safari" && !current.settings.enabled) {
        const granted = await browser.permissions.request({
            origins: ["http://*/*", "https://*/*"],
        });
        if (!granted)
            throw new Error("Website access is required to track Safari tabs.");
    }
    await send({
        type: "settings",
        settings: { ...current.settings, enabled: !current.settings.enabled },
    });
    await refresh();
});
on("exclude", async () => {
    await send({ type: "exclude" });
    await refresh(true);
});
on("options", async () => {
    await send({ type: "options" });
});
on("dashboard", async () => {
    await send({ type: "dashboard" });
});
on("retry", async () => {
    await send({ type: "retry" });
    await refresh();
});
on("save", async () => {
    if (!current) return;
    const settings = normalizeOptions({
        ...current.settings,
        afkTimeoutMs: Number(el<HTMLInputElement>("afk").value) * 60_000,
        denylist: el<HTMLTextAreaElement>("denylist")
            .value.split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        rules,
    });
    await send({ type: "settings", settings });
    await refresh(true);
    el("saved").textContent = "Settings saved.";
});
on("add-rule", () => {
    const candidate = {
        domain: el<HTMLInputElement>("rule-domain").value,
        pathPrefix: el<HTMLInputElement>("rule-path").value || "/",
        project: el<HTMLSelectElement>("rule-project").value,
        includeSubdomains: el<HTMLInputElement>("rule-subdomains").checked,
    };
    rules = normalizeOptions({
        ...current!.settings,
        rules: [...rules, candidate],
    }).rules;
    renderRules();
    el("saved").textContent = "Rule added. Save settings to apply.";
});
on("load-projects", async () => {
    const result = await send<{ projects: Array<{ name: string }> }>({
        type: "projects",
    });
    const select = el<HTMLSelectElement>("rule-project");
    select.replaceChildren();
    for (const p of result.projects) {
        const option = document.createElement("option");
        option.value = p.name;
        option.textContent = p.name;
        select.append(option);
    }
    if (!result.projects.length)
        showError(
            "No projects found. Create a project in AtoAxis, then reload.",
        );
});
on("export", () => {
    if (!current) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
        new Blob([exportSettings(current.settings)], {
            type: "application/json",
        }),
    );
    link.download = "atoaxis-browser-settings.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});
el<HTMLInputElement>("import")?.addEventListener("change", () => {
    void (async () => {
        const file = el<HTMLInputElement>("import").files?.[0];
        if (!file) return;
        if (file.size > 1_000_000)
            throw new Error("Settings file is too large");
        await send({
            type: "settings",
            settings: importSettings(await file.text()),
        });
        await refresh(true);
        el("saved").textContent =
            "Rules imported. Tracking is paused; enable it when ready.";
    })().catch((e) =>
        showError(e instanceof Error ? e.message : "Import failed"),
    );
});
void refresh(true).catch(() =>
    showError("Cannot reach extension. Reload it and try again."),
);
setInterval(() => {
    void refresh().catch(() => undefined);
}, 2000);
