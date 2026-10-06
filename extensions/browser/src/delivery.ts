import { Api, ApiError } from "./api";
import type { Database } from "./database";
export function acceptedIndices(payload: unknown, length: number): number[] {
    if (!payload || typeof payload !== "object") return [];
    const responses = (payload as { responses?: unknown }).responses;
    if (!Array.isArray(responses) || responses.length !== length) return [];
    return responses.flatMap((r: unknown, i) =>
        Array.isArray(r) &&
        typeof r[1] === "number" &&
        r[1] >= 200 &&
        r[1] < 300
            ? [i]
            : [],
    );
}
export async function deliver(
    db: Database,
    api: Api,
    now = Date.now(),
): Promise<void> {
    const state = await db.read();
    if (!state.credential || state.blocked || state.nextRetryAt > now) return;
    const account = state.credential.account;
    const batch = state.queue
        .filter((q) => q.account === account)
        .slice(0, 100);
    if (!batch.length) return;
    try {
        const response = await api.authorized(
            "/api/v1/heartbeats.bulk",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(batch.map((q) => q.heartbeat)),
            },
            account,
        );
        const accepted = new Set(
            acceptedIndices(response, batch.length).map(
                (i) => batch[i].heartbeat.heartbeat_id,
            ),
        );
        await db.update((s) => {
            // A late response must not clear another account's queue or UI status.
            s.queue = s.queue.filter(
                (q) =>
                    !(
                        q.account === account &&
                        accepted.has(q.heartbeat.heartbeat_id)
                    ),
            );
            if (s.credential?.account !== account) return;
            s.retryCount =
                accepted.size === batch.length ? 0 : s.retryCount + 1;
            s.nextRetryAt = accepted.size === batch.length ? 0 : now + 60_000;
            if (accepted.size === batch.length) s.error = null;
            else
                s.error =
                    "Some activity is awaiting delivery. Retrying safely.";
        });
    } catch (error) {
        await db.update((s) => {
            if (s.credential?.account !== account || s.blocked) return;
            s.retryCount += 1;
            const retry = error instanceof ApiError ? error.retryAfterMs : 0;
            s.nextRetryAt =
                now +
                Math.max(
                    retry,
                    Math.min(
                        3_600_000,
                        30_000 * 2 ** Math.min(7, s.retryCount),
                    ),
                );
            s.error =
                error instanceof ApiError &&
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 429
                    ? "Server rejected activity. Queue retained; check account access and server version."
                    : "Offline or service unavailable. Activity is saved on this device.";
        });
    }
}
