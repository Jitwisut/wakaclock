import { buildHeartbeat, type BrowserHeartbeat } from "../shared/tracker";
export interface Checkpoint {
    at: number;
    domain: string;
    project: string | null;
    context: string;
    monotonic?: number;
    clockOrigin?: number;
}
export interface Observation {
    at: number;
    page: { domain: string; project: string | null } | null;
    context: string;
    verified?: boolean;
    monotonic?: number;
    clockOrigin?: number;
}
/** An event closes the OLD page at its timestamp before establishing the next page. */
export function advance(
    previous: Checkpoint | null,
    next: Observation,
    editor: string,
    id: string,
): { checkpoint: Checkpoint | null; heartbeat: BrowserHeartbeat | null } {
    const gap = previous ? next.at - previous.at : 0;
    const clockGap =
        previous?.clockOrigin === next.clockOrigin &&
        previous?.monotonic !== undefined &&
        next.monotonic !== undefined
            ? next.monotonic - previous.monotonic
            : gap;
    const heartbeat =
        previous &&
        next.verified !== false &&
        gap > 0 &&
        gap <= 90_000 &&
        Math.abs(gap - clockGap) < 2000
            ? buildHeartbeat(previous, previous.at, next.at, editor, id)
            : null;
    return {
        heartbeat,
        checkpoint:
            next.verified !== false && next.page
                ? {
                      ...next.page,
                      at: next.at,
                      context: next.context,
                      monotonic: next.monotonic,
                      clockOrigin: next.clockOrigin,
                  }
                : null,
    };
}
export function localDay(at: number): string {
    const d = new Date(at);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
    ].join("-");
}
export function dailySeconds(
    heartbeat: BrowserHeartbeat,
): Array<[string, number]> {
    const s = heartbeat.activity_segments[0];
    const results: Array<[string, number]> = [];
    let cursor = s.start * 1000;
    const end = s.end * 1000;
    while (cursor < end) {
        const boundary = new Date(cursor);
        boundary.setHours(24, 0, 0, 0);
        const next = Math.min(end, boundary.getTime());
        results.push([localDay(cursor), (next - cursor) / 1000]);
        cursor = next;
    }
    return results;
}
