'use client';

import * as React from 'react';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

import { leaveSession, startOrJoinSession, updatePresencePosition } from '@/lib/wakaclock/endpoints';
import type { PresencePoint, PresenceRosterEntry } from '@/lib/wakaclock/types';

import { CelebrationBurst } from './celebration-burst';
import { CharacterAvatar } from './character-avatar';
import { characterColorFor } from './character-colors';

import type { DragEndEvent } from '@dnd-kit/core';

/** Euclidean distance under which two characters count as "together". */
const PROXIMITY_THRESHOLD = 70;

/** Matches the answer given when scoping this feature: apart briefly still counts as
 * the same session, only a sustained 3-minute separation ends it. */
const LEAVE_GRACE_MS = 3 * 60 * 1000;

function distance(a: PresencePoint, b: PresencePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Read-only rendering for everyone except the current user — see the module doc for
 * why only your own character may be dragged. */
function StaticCharacter({ entry }: { entry: PresenceRosterEntry }) {
  return (
    <CharacterAvatar
      color={characterColorFor(entry.user_id)}
      reducedMotion={false}
      state={entry.state}
      username={entry.username}
    />
  );
}

function DraggableCharacter({
  entry,
  nodeRef,
  reducedMotion,
}: {
  entry: PresenceRosterEntry;
  nodeRef: (node: HTMLElement | null) => void;
  reducedMotion: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.user_id,
  });

  const setRefs = React.useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      nodeRef(node);
    },
    [setNodeRef, nodeRef]
  );

  return (
    <button
      {...attributes}
      {...listeners}
      aria-label={`You, ${entry.state}. Drag, or focus and use arrow keys, to move.`}
      className="focus-visible:ring-offset-2 focus-visible:ring-2 focus-visible:outline-none p-1 cursor-grab active:cursor-grabbing"
      ref={setRefs}
      style={
        {
          touchAction: 'none',
          transform: transform ? CSS.Translate.toString(transform) : undefined,
          zIndex: isDragging ? 30 : undefined,
          // shadcn's ring utilities read from --tw-ring-color; this page has its own
          // accent, so the focus ring colour is set inline rather than fighting the
          // dashboard's token with a one-off Tailwind ring-* class.
          '--tw-ring-color': 'var(--game-primary)',
        } as React.CSSProperties
      }
      type="button"
    >
      <CharacterAvatar
        color={characterColorFor(entry.user_id)}
        reducedMotion={reducedMotion}
        state={entry.state}
        username={entry.username}
      />
    </button>
  );
}

/**
 * The room "floor". Positions are synced server-side (plan.md 7.4's prerequisite fix —
 * see plan.md's Phase 7 notes on why the first version of this canvas, with per-browser
 * local-only positions, was not trustworthy enough to build co-working sessions on top
 * of): every member's `roster[].position` comes from the same SSE stream everyone reads,
 * so everyone sees the same arrangement, not their own private rearrangement of others.
 *
 * Only the current user's own character is draggable. Dragging always reports the
 * *authenticated* caller's new position to the server (see `update_position` on the
 * backend) — there is no way to move someone else's character, so it is never rendered
 * as draggable in the first place; doing otherwise would silently move your own marker
 * to wherever you dropped theirs.
 *
 * Proximity → co-working sessions: on every roster update (SSE tick), this checks the
 * distance from the current user to everyone else with a position. Newly-close people
 * trigger `startOrJoinSession`; losing proximity to everyone starts a 3-minute grace
 * timer (per the scoping decision — "apart briefly still counts as the same session")
 * before calling `leaveSession`. This runs independently in every connected browser,
 * each reporting only its own user's proximity — there is no central arbiter, which is
 * fine because the actual clustering/session logic lives server-side
 * (`CoworkingSessionService::start_or_join`) and is idempotent.
 */
export function RoomCanvas({
  currentUserId,
  reducedMotion,
  roomId,
  roster,
}: {
  currentUserId: string;
  reducedMotion: boolean;
  roomId: string;
  roster: PresenceRosterEntry[];
}) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  // Only the current user's character is ever draggable, so one ref is enough — this is
  // set by whichever `DraggableCharacter` instance is currently mounted (the flow-layer
  // one or the positioned-layer one, never both at once).
  const myNodeRef = React.useRef<HTMLElement | null>(null);
  const setMyNodeRef = React.useCallback((node: HTMLElement | null) => {
    myNodeRef.current = node;
  }, []);
  const [burst, setBurst] = React.useState<{ key: number; point: PresencePoint } | null>(null);
  const burstKeyRef = React.useRef(0);

  // Client-side de-dup cache only — avoids re-sending `startOrJoinSession` every tick
  // for a pairing already reported. The real session state lives on the server; losing
  // or over-counting entries here only risks a harmless redundant call, never incorrect
  // session data.
  const clusteredWithRef = React.useRef(new Set<string>());
  const leaveTimerRef = React.useRef<null | number>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  // `DragEndEvent`'s own delta isn't used — the dropped element's actual DOM rect,
  // measured after the drag settles, is the authoritative source for where it landed.
  const handleDragEnd = React.useCallback(
    (_event: DragEndEvent) => {
      const node = myNodeRef.current;
      const canvas = canvasRef.current;
      if (!node || !canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      const point: PresencePoint = {
        x: Math.max(0, Math.min(nodeRect.left - canvasRect.left, canvasRect.width - nodeRect.width)),
        y: Math.max(0, Math.min(nodeRect.top - canvasRect.top, canvasRect.height - nodeRect.height)),
      };

      void updatePresencePosition(roomId, point.x, point.y);
    },
    [roomId]
  );

  // Proximity → session detection, re-evaluated whenever the roster changes.
  React.useEffect(() => {
    const me = roster.find((entry) => entry.user_id === currentUserId);
    if (!me?.position) return;

    const mePosition = me.position;
    const closeOthers = roster.filter(
      (entry) =>
        entry.user_id !== currentUserId &&
        entry.position &&
        distance(mePosition, entry.position) < PROXIMITY_THRESHOLD
    );

    if (closeOthers.length > 0) {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }

      for (const other of closeOthers) {
        if (clusteredWithRef.current.has(other.user_id)) continue;

        clusteredWithRef.current.add(other.user_id);
        void startOrJoinSession(roomId, other.user_id);

        if (!reducedMotion && other.position) {
          burstKeyRef.current += 1;
          setBurst({
            key: burstKeyRef.current,
            point: { x: (mePosition.x + other.position.x) / 2, y: (mePosition.y + other.position.y) / 2 },
          });
          window.setTimeout(() => setBurst(null), 750);
        }
      }
    } else if (clusteredWithRef.current.size > 0 && leaveTimerRef.current === null) {
      leaveTimerRef.current = window.setTimeout(() => {
        clusteredWithRef.current.clear();
        leaveTimerRef.current = null;
        void leaveSession(roomId);
      }, LEAVE_GRACE_MS);
    }
  }, [roster, currentUserId, roomId, reducedMotion]);

  // Clear a pending grace timer on unmount so it doesn't fire (and call leaveSession)
  // after the component navigating away already left the room some other way.
  React.useEffect(() => () => {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    }, []);

  const flowing = roster.filter((entry) => !entry.position);
  const positioned = roster.filter((entry) => entry.position);

  return (
    <DndContext modifiers={[restrictToParentElement]} onDragEnd={handleDragEnd} sensors={sensors}>
      <div
        className="wakaclock-game-canvas relative min-h-80 w-full overflow-hidden border-4"
        ref={canvasRef}
        style={{ borderColor: 'var(--game-surface-border)' }}
      >
        {/* Not-yet-positioned members sit in a natural wrapping grid; anyone with a
            synced position is layered on top at their exact coordinates. */}
        <div className="flex flex-wrap gap-4 p-4">
          {flowing.map((entry) =>
            entry.user_id === currentUserId ? (
              <DraggableCharacter
                entry={entry}
                key={entry.user_id}
                nodeRef={setMyNodeRef}
                reducedMotion={reducedMotion}
              />
            ) : (
              <StaticCharacter entry={entry} key={entry.user_id} />
            )
          )}
        </div>

        <div className="pointer-events-none absolute inset-0">
          {positioned.map((entry) => (
            <div
              className="pointer-events-auto absolute"
              key={entry.user_id}
              style={{ left: entry.position?.x, top: entry.position?.y }}
            >
              {entry.user_id === currentUserId ? (
                <DraggableCharacter entry={entry} nodeRef={setMyNodeRef} reducedMotion={reducedMotion} />
              ) : (
                <StaticCharacter entry={entry} />
              )}
            </div>
          ))}

          {burst && !reducedMotion ? (
            <div className="absolute" key={burst.key} style={{ left: burst.point.x, top: burst.point.y }}>
              <CelebrationBurst />
            </div>
          ) : null}
        </div>
      </div>
    </DndContext>
  );
}
