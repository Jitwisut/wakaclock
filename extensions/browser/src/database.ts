import {
    DEFAULT_BROWSER_TRACKER_OPTIONS,
    type BrowserHeartbeat,
    type BrowserTrackerOptions,
} from "../shared/tracker";
import { dailySeconds, type Checkpoint } from "./tracking";
export interface Credential {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    account: string;
}
export interface DeviceGrant {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    expiresAt: number;
    intervalMs: number;
    nextPollAt: number;
}
export interface State {
    settings: BrowserTrackerOptions;
    credential: Credential | null;
    device: DeviceGrant | null;
    checkpoint: Checkpoint | null;
    queue: Array<{ account: string; heartbeat: BrowserHeartbeat }>;
    totals: Record<string, Record<string, number>>;
    error: string | null;
    blocked: boolean;
    nextRetryAt: number;
    retryCount: number;
}
export function initialState(): State {
    return {
        settings: structuredClone(DEFAULT_BROWSER_TRACKER_OPTIONS),
        credential: null,
        device: null,
        checkpoint: null,
        queue: [],
        totals: {},
        error: null,
        blocked: false,
        nextRetryAt: 0,
        retryCount: 0,
    };
}
export class Database {
    private db: Promise<IDBDatabase>;
    constructor(name = "atoaxis-browser-v1") {
        this.db = new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () =>
                request.result.createObjectStore("state");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async update<T>(fn: (state: State) => T): Promise<T> {
        const db = await this.db;
        return new Promise((resolve, reject) => {
            const tx = db.transaction("state", "readwrite");
            const store = tx.objectStore("state");
            const request = store.get("current");
            let result: T;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () =>
                reject(tx.error ?? new Error("Storage transaction aborted"));
            tx.oncomplete = () => resolve(result);
            request.onsuccess = () => {
                try {
                    const state: State = request.result ?? initialState();
                    result = fn(state);
                    store.put(state, "current");
                } catch (error) {
                    tx.abort();
                    reject(error);
                }
            };
        });
    }
    async read(): Promise<State> {
        const db = await this.db;
        return new Promise((resolve, reject) => {
            const request = db
                .transaction("state")
                .objectStore("state")
                .get("current");
            request.onsuccess = () => resolve(request.result ?? initialState());
            request.onerror = () => reject(request.error);
        });
    }
}
export function enqueue(
    state: State,
    account: string,
    heartbeat: BrowserHeartbeat,
): boolean {
    if (
        state.queue.some(
            (q) => q.heartbeat.heartbeat_id === heartbeat.heartbeat_id,
        )
    )
        return true;
    if (state.queue.length >= 10_000) {
        state.error =
            "Offline queue is full. Tracking paused until delivery resumes.";
        return false;
    }
    state.queue.push({ account, heartbeat });
    if (state.queue.length === 10_000)
        state.error =
            "Offline queue is full. Tracking paused until delivery resumes.";
    const totals = (state.totals[account] ??= {});
    for (const [day, seconds] of dailySeconds(heartbeat))
        totals[day] = (totals[day] ?? 0) + seconds;
    const days = Object.keys(totals).sort();
    for (const day of days.slice(0, Math.max(0, days.length - 35)))
        delete totals[day];
    return true;
}
