"""Faithful Python port of backend/api/src/services/activity_timeline.rs plus a
reference implementation of WakaTime's duration builder, so the two can be run
over the same heartbeat stream and compared.

Ported from (read at commit 88685bd):
  ActivityTimelineService::intervals
  canonicalize
  bridge_idle_gaps_with_anchors
  canonicalize_bridged
"""
from __future__ import annotations
import json
from dataclasses import dataclass, replace
from typing import Optional

MAX_ACTIVITY_GAP_SECONDS = 120.0


@dataclass
class Interval:
    segment_id: str
    heartbeat_id: str
    start: float
    end: float
    source: str
    entity: str
    project: Optional[str]
    language: Optional[str]
    category: str


def normalized_source(source: Optional[str], is_ai: bool) -> str:
    s = source if source is not None else ("ai" if is_ai else "editor")
    low = s.lower()
    if low in ("human", "editor"):
        return "editor"
    if low == "ai" or "agent" in low:
        return "ai"
    return "other"


def _source_priority(source: str) -> int:
    return {"editor": 0, "ai": 1}.get(source, 2)


# ---------------------------------------------------------------- intervals()

def build_intervals(projected_rows, raw_rows, start: float, end: float):
    """projected_rows: rows of wakaclock.activity_intervals overlapping [start,end).
    raw_rows: rows of wakaclock.heartbeats in [start-120, end+120)."""
    seen_hb, seen_seg, intervals = set(), set(), []

    for row in projected_rows:
        s = max(row["start"], start)
        e = min(row["end"], end)
        if e <= s:
            continue
        seen_hb.add(row["heartbeat_id"])
        if row["segment_id"] in seen_seg:
            continue
        seen_seg.add(row["segment_id"])
        intervals.append(Interval(
            row["segment_id"], row["heartbeat_id"], s, e,
            normalized_source(row.get("source"), False),
            row["entity"], row.get("project"), row.get("language"), row["category"],
        ))

    for row in raw_rows:
        hb_id = row.get("heartbeat_id")
        if hb_id is None:
            hb_id = f"legacy:{row['entity']}:{row['time']:.6f}"
        if hb_id in seen_hb:
            continue
        seen_hb.add(hb_id)

        raw_segments = row.get("activity_segments") or ""
        try:
            segments = json.loads(raw_segments) if raw_segments else []
            if not isinstance(segments, list):
                segments = []
        except Exception:
            segments = []

        if not segments:
            active = row.get("active_seconds")
            if active is not None and active > 0:
                seconds = min(active, MAX_ACTIVITY_GAP_SECONDS)
                segments = [{
                    "segment_id": f"{hb_id}:legacy-segment",
                    "start": max(row["time"] - seconds, start),
                    "end": min(row["time"], end),
                    "source": None,
                }]

        if not segments:
            if start <= row["time"] < end:
                intervals.append(Interval(
                    f"{hb_id}:anchor", hb_id, row["time"], row["time"],
                    normalized_source(None, row["is_ai_generated"]),
                    row["entity"], row.get("project"), row.get("language"), row["category"],
                ))
            continue

        for seg in segments:
            clamped_start = max(seg["start"], seg["end"] - MAX_ACTIVITY_GAP_SECONDS)
            s = max(clamped_start, start)
            e = min(seg["end"], end)
            if e <= s:
                continue
            seg_id = seg.get("segment_id") or ""
            if not seg_id.strip():
                seg_id = f"{hb_id}:{seg['start']:.6f}:{seg['end']:.6f}"
            if seg_id in seen_seg:
                continue
            seen_seg.add(seg_id)
            intervals.append(Interval(
                seg_id, hb_id, s, e,
                normalized_source(seg.get("source"), row["is_ai_generated"]),
                row["entity"], row.get("project"), row.get("language"), row["category"],
            ))
    return intervals


# --------------------------------------------------------------- canonicalize

def canonicalize(intervals):
    boundaries = sorted({b for iv in intervals for b in (iv.start, iv.end)})
    deduped = []
    for b in boundaries:
        if deduped and abs(b - deduped[-1]) < 1e-6:
            continue
        deduped.append(b)

    result = []
    for a, b in zip(deduped, deduped[1:]):
        if b <= a:
            continue
        owners = [iv for iv in intervals if iv.start <= a and iv.end >= b]
        if not owners:
            continue
        owner = min(owners, key=lambda iv: (_source_priority(iv.source), iv.heartbeat_id, iv.segment_id))
        if result:
            p = result[-1]
            if p.end == a and p.heartbeat_id == owner.heartbeat_id and p.segment_id == owner.segment_id:
                p.end = b
                continue
        result.append(replace(owner, start=a, end=b))
    return result


def bridge_idle_gaps_with_anchors(intervals, anchors, idle_timeout_seconds: float):
    if not (idle_timeout_seconds == idle_timeout_seconds) or idle_timeout_seconds <= 0:
        return intervals
    events = [(iv.start, 0, replace(iv), False) for iv in intervals]
    events += [(a.start, 1, replace(a, start=a.start, end=a.start), True) for a in anchors]
    events.sort(key=lambda e: (e[0], e[1]))

    result = []
    for at, _kind, candidate, is_anchor in events:
        if result:
            prev = result[-1]
            gap = at - prev.end
            if 0 < gap <= idle_timeout_seconds:
                prev.end = at
            if (prev.heartbeat_id == candidate.heartbeat_id
                    and prev.segment_id == candidate.segment_id
                    and prev.end >= candidate.start):
                prev.end = max(prev.end, candidate.end)
                continue
            if prev.end > candidate.start:
                prev.end = candidate.start
            if is_anchor and gap <= idle_timeout_seconds:
                continue
        result.append(candidate)
    return [iv for iv in result if iv.end > iv.start]


def _is_attended(source: str) -> bool:
    """Only human editor activity proves the developer was at the keyboard."""
    return source == "editor"


def bridge_by_attendance(canonical, anchors, idle_timeout_seconds: float,
                         agent_idle_timeout_seconds: float):
    """Port of `bridge_by_attendance` in activity_timeline.rs.

    Human and agent streams are bridged on their own timelines, then swept together
    again so an agent interval cannot grow across a window the human already owns.
    """
    attended = [iv for iv in canonical if _is_attended(iv.source)]
    unattended = [iv for iv in canonical if not _is_attended(iv.source)]
    attended_anchors = [a for a in anchors if _is_attended(a.source)]
    unattended_anchors = [a for a in anchors if not _is_attended(a.source)]

    merged = bridge_idle_gaps_with_anchors(attended, attended_anchors, idle_timeout_seconds)
    merged = merged + bridge_idle_gaps_with_anchors(
        unattended, unattended_anchors, agent_idle_timeout_seconds
    )
    return canonicalize(merged)


def canonicalize_bridged(intervals, idle_timeout_seconds: float,
                         agent_idle_timeout_seconds: Optional[float] = None):
    """`agent_idle_timeout_seconds=None` is the single-stream behaviour; pass a number
    to replay the split bridge the server actually ships (AGENT_IDLE_TIMEOUT_MINUTES)."""
    anchors = [iv for iv in intervals if iv.end <= iv.start]
    canonical = canonicalize(intervals)
    if agent_idle_timeout_seconds is None:
        return bridge_idle_gaps_with_anchors(canonical, anchors, idle_timeout_seconds)
    return bridge_by_attendance(
        canonical, anchors, idle_timeout_seconds, agent_idle_timeout_seconds
    )


def total_seconds(intervals) -> float:
    return sum(iv.end - iv.start for iv in intervals)


def union_seconds(intervals) -> float:
    ordered = sorted(((iv.start, iv.end) for iv in intervals if iv.end > iv.start))
    total, cur = 0.0, None
    for s, e in ordered:
        if cur is None:
            cur = [s, e]
        elif s > cur[1]:
            total += cur[1] - cur[0]
            cur = [s, e]
        else:
            cur[1] = max(cur[1], e)
    if cur:
        total += cur[1] - cur[0]
    return total


# ------------------------------------------------- WakaTime reference builder

def wakatime_durations(heartbeats, timeout_seconds: float = 900.0):
    """WakaTime's documented duration builder.

    Sort heartbeats by time; consecutive heartbeats closer together than the
    timeout belong to one block; a block's duration is last.time - first.time.
    A lone heartbeat is worth 0. Equivalently: sum of every consecutive gap that
    is <= timeout.

    `heartbeats` is a list of dicts with at least `time`. Returns
    (total_seconds, blocks) where blocks are (start, end) pairs.
    """
    times = sorted(h["time"] for h in heartbeats)
    if not times:
        return 0.0, []
    blocks, block_start, prev = [], times[0], times[0]
    for t in times[1:]:
        if t - prev > timeout_seconds:
            blocks.append((block_start, prev))
            block_start = t
        prev = t
    blocks.append((block_start, prev))
    return sum(e - s for s, e in blocks), blocks


def wakatime_per_key(heartbeats, key, timeout_seconds: float = 900.0):
    """WakaTime attributes each mini-duration to the *earlier* heartbeat, so a
    project's time is the sum of gaps that start on one of its heartbeats."""
    rows = sorted(heartbeats, key=lambda h: h["time"])
    totals = {}
    for a, b in zip(rows, rows[1:]):
        gap = b["time"] - a["time"]
        if 0 < gap <= timeout_seconds:
            totals[key(a)] = totals.get(key(a), 0.0) + gap
    return totals
