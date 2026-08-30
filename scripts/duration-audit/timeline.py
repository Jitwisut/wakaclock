"""Faithful Python port of backend/api/src/services/activity_timeline.rs plus a
reference implementation of WakaTime's duration builder, so the two can be run
over the same heartbeat stream and compared.

Keep this file in lock-step with production Rust. ``verify_port.py`` contains
regression cases for the heartbeat-anchor and human/AI handover behaviour that
previously drifted here and produced a false duration regression.
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
    actor_type: Optional[str] = None
    actor_confidence: float = 0.0


def normalized_source(
    source: Optional[str], is_ai: bool = False, actor_type: Optional[str] = None
) -> str:
    # New rows are classified by the canonical enum. Keep the boolean/source fallback
    # for legacy fixtures so this port can still replay pre-Phase-1 exports.
    if actor_type is not None:
        actor = actor_type.strip().lower()
        if actor == "human":
            return "editor"
        if actor in ("ai_verified", "ai_inferred"):
            return "ai"
        return "other"
    # A missing source is not positive editor evidence.  The old port treated every
    # legacy, non-AI heartbeat with no source as an editor interval, which made a raw
    # shell mutation look Human during replay.  Only an explicit source (or the legacy
    # AI boolean) is allowed to choose an owning stream.
    s = source if source is not None else ("ai" if is_ai else "other")
    low = s.lower()
    if low in ("human", "editor"):
        return "editor"
    if low == "ai" or "agent" in low:
        return "ai"
    return "other"


def _nonempty(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _legacy_boolean(row, expected: bool) -> bool:
    value = row.get("is_ai_generated")
    if isinstance(value, bool):
        return value is expected
    if isinstance(value, (int, float)):
        return bool(value) is expected
    return False


def _positive(row, key: str) -> bool:
    value = row.get(key)
    return isinstance(value, (int, float)) and value > 0


def _legacy_actor_type(row, source: Optional[str] = None) -> str:
    """Evidence-based fallback for pre-Phase-1 exports.

    This intentionally does not use ``is_ai_generated == false`` as Human evidence.
    It mirrors the ClickHouse default expression: explicit AI metadata wins, positive
    editor counters/source can prove Human, and everything else remains Unknown.
    """
    explicit = row.get("actor_type")
    if isinstance(explicit, str) and explicit.strip().lower() in {
        "human", "ai_verified", "ai_inferred", "unknown"
    }:
        return explicit.strip().lower()

    ai_evidence = (
        _legacy_boolean(row, True)
        or _nonempty(row.get("ai_agent"))
        or _nonempty(row.get("ai_event_id"))
        or str(row.get("ai_source") or "").lower() in ("agent_hook", "mcp")
        or str(source or "").lower() == "ai"
        or "agent" in str(source or "").lower()
        or _positive(row, "ai_lines_added")
        or _positive(row, "ai_lines_deleted")
    )
    if ai_evidence:
        if (
            str(row.get("ai_confidence") or "").lower() == "verified"
            or str(row.get("ai_source") or "").lower() in ("agent_hook", "mcp")
        ):
            return "ai_verified"
        return "ai_inferred"

    ambiguous = _positive(row, "unattributed_lines_added") or _positive(
        row, "unattributed_lines_deleted"
    )
    human_evidence = any(
        _positive(row, key)
        for key in (
            "human_lines_added",
            "human_lines_deleted",
            "keystrokes",
            "chars_added",
            "chars_deleted",
        )
    )
    if ambiguous:
        return "unknown"
    if human_evidence or str(source or "").lower() in ("human", "editor"):
        return "human"
    return "unknown"


def _actor_confidence(row, actor_type: str) -> float:
    value = row.get("actor_confidence")
    if isinstance(value, (int, float)) and value == value and 0.0 <= value <= 1.0:
        return float(value)
    if actor_type == "human":
        return 1.0
    if actor_type == "ai_verified":
        return 0.95 if str(row.get("ai_source") or "").lower() == "mcp" else 1.0
    if actor_type == "ai_inferred":
        return 0.8 if str(row.get("ai_confidence") or "").lower() == "correlated" else 0.6
    return 0.0


def _resolved_actor(row, source: Optional[str] = None):
    actor_type = _legacy_actor_type(row, source)
    return actor_type, _actor_confidence(row, actor_type)


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
        actor_type, actor_confidence = _resolved_actor(row, row.get("source"))
        intervals.append(Interval(
            row["segment_id"], row["heartbeat_id"], s, e,
            normalized_source(row.get("source"), False, actor_type),
            row["entity"], row.get("project"), row.get("language"), row["category"],
            actor_type, actor_confidence,
        ))

    for row in raw_rows:
        hb_id = row.get("heartbeat_id")
        if hb_id is None:
            hb_id = f"legacy:{row['entity']}:{row['time']:.6f}"
        already_projected = hb_id in seen_hb
        seen_hb.add(hb_id)
        actor_type, actor_confidence = _resolved_actor(row)

        # Every heartbeat proves activity at its own timestamp, even if its buffered
        # segments describe an older window. The zero-length anchor contributes no time
        # by itself; it only lets idle bridging reach the next observation like WakaTime.
        if start <= row["time"] < end:
            anchor_id = f"{hb_id}:anchor"
            if anchor_id not in seen_seg:
                seen_seg.add(anchor_id)
                intervals.append(Interval(
                    anchor_id, hb_id, row["time"], row["time"],
                    normalized_source(
                        None, _legacy_boolean(row, True), actor_type
                    ),
                    row["entity"], row.get("project"), row.get("language"), row["category"],
                    actor_type, actor_confidence,
                ))

        # activity_intervals already contains this heartbeat's measured windows. Keep
        # the raw heartbeat above only for its timestamp anchor.
        if already_projected:
            continue

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
            segment_actor_type, segment_actor_confidence = _resolved_actor(
                row, seg.get("source")
            )
            intervals.append(Interval(
                seg_id, hb_id, s, e,
                normalized_source(
                    seg.get("source"), _legacy_boolean(row, True),
                    segment_actor_type,
                ),
                row["entity"], row.get("project"), row.get("language"), row["category"],
                segment_actor_type, segment_actor_confidence,
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
    events += [(a.start, 1, replace(a, start=a.start, end=a.start), True)
               for a in anchors if a.start == a.start]
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
    """Port of production Rust's combined attendance bridge.

    A pause gets the human timeout when a human editor event is on either side.
    Agent-to-agent pauses use the short agent timeout. Human/agent handovers are
    counted as real work but attributed to ``other`` so neither side claims time
    it cannot prove.
    """
    if not (idle_timeout_seconds == idle_timeout_seconds) or idle_timeout_seconds <= 0:
        return canonical

    events = [(iv.start, 0, replace(iv), False) for iv in canonical]
    events += [(a.start, 1, replace(a, start=a.start, end=a.start), True)
               for a in anchors if a.start == a.start]
    events.sort(key=lambda e: (e[0], e[1]))

    result = []
    previous_source = None
    for at, _kind, candidate, is_anchor in events:
        timeout = idle_timeout_seconds
        inserted_handover = False
        if result:
            previous = result[-1]
            real_previous_source = previous_source or previous.source
            gap = at - previous.end
            timeout = (idle_timeout_seconds
                       if (_is_attended(real_previous_source) or _is_attended(candidate.source))
                       else agent_idle_timeout_seconds)
            if 0 < gap <= timeout:
                if real_previous_source == candidate.source:
                    previous.end = at
                else:
                    result.append(replace(
                        previous,
                        source="other",
                        actor_type="unknown",
                        actor_confidence=0.0,
                        start=previous.end,
                        end=at,
                    ))
                    inserted_handover = True

        if result:
            previous = result[-1]
            if (previous.heartbeat_id == candidate.heartbeat_id
                    and previous.segment_id == candidate.segment_id
                    and previous.source == candidate.source
                    and previous.end >= candidate.start):
                previous.end = max(previous.end, candidate.end)
                previous_source = candidate.source
                continue
            if previous.end > candidate.start:
                previous.end = candidate.start
            if is_anchor and not inserted_handover and at - previous.end <= timeout:
                previous_source = candidate.source
                continue

        previous_source = candidate.source
        result.append(candidate)

    return [iv for iv in result if iv.end > iv.start]


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
