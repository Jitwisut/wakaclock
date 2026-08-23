"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ACTIVITY_GAP_MS = exports.MAX_ACTIVITY_GAP_SECONDS = void 0;
exports.unionSeconds = unionSeconds;
exports.appendSegment = appendSegment;
/** The strict activity window used by the editor and AI integrations. */
exports.MAX_ACTIVITY_GAP_SECONDS = 120;
exports.MAX_ACTIVITY_GAP_MS = exports.MAX_ACTIVITY_GAP_SECONDS * 1000;
/** Return the length covered by the union of valid activity intervals. */
function unionSeconds(segments) {
    const ordered = segments
        .filter((segment) => Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start)
        .map((segment) => ({ start: segment.start, end: segment.end }))
        .sort((left, right) => left.start - right.start || left.end - right.end);
    let total = 0;
    let currentStart;
    let currentEnd;
    for (const segment of ordered) {
        if (currentStart === undefined || currentEnd === undefined) {
            currentStart = segment.start;
            currentEnd = segment.end;
            continue;
        }
        if (segment.start > currentEnd) {
            total += currentEnd - currentStart;
            currentStart = segment.start;
            currentEnd = segment.end;
            continue;
        }
        currentEnd = Math.max(currentEnd, segment.end);
    }
    if (currentStart !== undefined && currentEnd !== undefined) {
        total += currentEnd - currentStart;
    }
    return Math.max(0, total);
}
/** Merge a segment into a list while preserving the list's canonical union. */
function appendSegment(segments, segment) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.end <= segment.start) {
        return;
    }
    const last = segments[segments.length - 1];
    // Keep each wire segment inside the strict activity window. A continuously typed
    // file can span many minutes; merging every touching pair into one giant interval
    // would make it look like a legacy long-gap heartbeat and the backend would reject
    // it. Union readers still combine adjacent chunks when calculating total time.
    if (last &&
        last.end >= segment.start &&
        last.source === segment.source &&
        segment.end - last.start <= exports.MAX_ACTIVITY_GAP_SECONDS) {
        last.end = Math.max(last.end, segment.end);
        return;
    }
    segments.push(segment);
}
//# sourceMappingURL=activity.js.map