'use client';

import * as React from 'react';

import { appearanceFor } from '@/components/presence/appearance';
import { DeskWorkstation } from '@/components/presence/DeskWorkstation';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceUser } from '@/types/presence';

/** How far one arrow-key press moves the player, in playground-percentage units — the
 * keyboard-equivalent of a small drag, since Framer Motion's `drag` prop (used for
 * pointer/touch) has no keyboard interaction of its own. */
const KEYBOARD_STEP_PERCENT = 3;

/** Non-finite means an upstream calculation already broke (a 0-width container, a
 * corrupt server position); recover to the field centre rather than the 0,0 corner. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

/** `DEFAULT_SPAWN_POSITION` in `@/types/presence` — kept local to avoid the import cycle. */
const SAFE_CENTRE = 46;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

interface PresencePlayerProps {
  atDesk?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDeskPosition?: (position: { x: number; y: number }) => boolean;
  isNearby?: boolean;
  onEnterZone?: () => void;
  onMove?: (next: { x: number; y: number }) => void;
  reducedMotion: boolean;
  /** Where a pointer drop actually lands — used to snap a drop inside a pod onto a desk
   * slot. Applied to the drag preview as well as to `onMove`, so the sprite does not
   * flash at the raw pointer position before the server echoes the seat back. */
  resolveDrop?: (position: { x: number; y: number }) => { x: number; y: number };
  user: PresenceUser;
}

/**
 * One character on the field. Only `user.isCurrentUser` renders as draggable — dragging
 * always reports the *authenticated* caller's own new position (see `onMove`, wired to
 * a real `POST .../position` call by `PresencePlayground`), so a read-only player for
 * everyone else is what prevents silently moving your own marker while trying to drag
 * a teammate's.
 *
 * The gesture is tracked with `window` listeners rather than `setPointerCapture`.
 * Capture is bound to the DOM node, and this node lives in a list that re-renders on
 * every SSE roster snapshot: any snapshot that reorders the roster makes React move the
 * button with `insertBefore`, which drops the capture. That fired `lostpointercapture`
 * mid-drag, and the `pointerup` that followed no longer had a gesture to commit — the
 * drop was silently discarded and the sprite snapped back to its server position, which
 * looked exactly like "I cannot drag myself out of this pod". Window listeners survive
 * the node move.
 *
 * Local coordinates preview movement until a new server position arrives.
 */
export function PresencePlayer({
  containerRef,
  isNearby,
  onEnterZone,
  onMove,
  reducedMotion,
  resolveDrop,
  user,
  atDesk = Boolean(user.zoneId),
  isDeskPosition,
}: PresencePlayerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [localPosition, setLocalPosition] = React.useState<{
    serverX: number;
    serverY: number;
    x: number;
    y: number;
  } | null>(null);
  const gesture = React.useRef<{
    clientX: number;
    clientY: number;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  /** Last previewed point, so a gesture that ends without usable coordinates (a
   * `pointercancel`, a release the browser reports outside the floor) still commits
   * where the character was actually dragged to instead of throwing the drag away. */
  const lastPreview = React.useRef<{ x: number; y: number } | null>(null);
  const appearance = appearanceFor(user.id);
  const pendingPosition =
    localPosition?.serverX === user.x && localPosition.serverY === user.y ? localPosition : null;
  const safeX = pendingPosition?.x ?? finiteOr(user.x, SAFE_CENTRE);
  const safeY = pendingPosition?.y ?? finiteOr(user.y, SAFE_CENTRE);

  // Use viewport deltas from pointer-down so scrolling does not mix page and
  // viewport coordinates. Keep the same captured button throughout the gesture.
  const pointerPosition = React.useCallback(
    (event: { clientX: number; clientY: number; pointerId: number }) => {
      const start = gesture.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!start || event.pointerId !== start.pointerId || !rect?.width || !rect.height) {
        return null;
      }
      return {
        x: clampPercent(start.x + ((event.clientX - start.clientX) / rect.width) * 100),
        y: clampPercent(start.y + ((event.clientY - start.clientY) / rect.height) * 100),
      };
    },
    [containerRef]
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const preview = (position: { x: number; y: number }) => {
      lastPreview.current = position;
      setLocalPosition({ ...position, serverX: user.x, serverY: user.y });
    };

    const handlePointerMove = (event: PointerEvent) => {
      const position = pointerPosition(event);
      if (position) preview(position);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const start = gesture.current;
      if (start && event.pointerId !== start.pointerId) return;
      const dropped = pointerPosition(event) ?? lastPreview.current;
      gesture.current = null;
      lastPreview.current = null;
      setIsDragging(false);
      if (!dropped) return;
      const resolved = resolveDrop ? resolveDrop(dropped) : dropped;
      preview(resolved);
      onMove?.(resolved);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isDragging, onMove, pointerPosition, resolveDrop, user.x, user.y]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && onEnterZone) {
        event.preventDefault();
        onEnterZone();
        return;
      }
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -KEYBOARD_STEP_PERCENT],
        ArrowDown: [0, KEYBOARD_STEP_PERCENT],
        ArrowLeft: [-KEYBOARD_STEP_PERCENT, 0],
        ArrowRight: [KEYBOARD_STEP_PERCENT, 0],
      };
      const delta = deltas[event.key];
      if (!delta || !onMove) return;
      event.preventDefault();
      // Deliberately not routed through `resolveDrop`: snapping every step onto the desk
      // slot would pin a seated keyboard user to their chair, since one 3% step never
      // clears the pod.
      onMove({ x: clampPercent(safeX + delta[0]), y: clampPercent(safeY + delta[1]) });
    },
    [onEnterZone, onMove, safeX, safeY]
  );

  const wrapperStyle: React.CSSProperties = {
    left: `${safeX}%`,
    top: `${safeY}%`,
    transform: 'translate(-50%, -50%)',
  };

  // Inside a pod the character drops into a desk and starts working. It stays wrapped
  // in the same draggable button below, so dragging back out stands it up again.
  const seatedInZone = isDeskPosition ? isDeskPosition({ x: safeX, y: safeY }) : atDesk;

  if (!user.isCurrentUser) {
    return (
      <div className="absolute flex flex-col items-center gap-1" style={wrapperStyle}>
        <PresenceSprite
          accentColor={appearance.accentColor}
          accessory={appearance.accessory}
          color={appearance.shirtColor}
          hairColor={appearance.hairColor}
          hairStyle={appearance.hairStyle}
          outfit={appearance.outfit}
          reducedMotion={reducedMotion}
          skinColor={appearance.skinColor}
          status={user.status}
        />
        <NameTag isCurrentUser={false} nearby={isNearby} username={user.username} />
      </div>
    );
  }

  return (
    <button
      aria-label={`You, ${seatedInZone && !isDragging ? 'seated at desk' : 'standing'}, ${user.status}. Drag, or focus and use arrow keys, to move.`}
      className="presence-character-control absolute flex touch-none flex-col items-center gap-1 rounded-none border-none bg-transparent p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      data-pose={seatedInZone && !isDragging ? 'seated' : 'standing'}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || gesture.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        gesture.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          x: safeX,
          y: safeY,
        };
        lastPreview.current = { x: safeX, y: safeY };
        setIsDragging(true);
      }}
      style={{
        ...wrapperStyle,
        width: 112,
        height: 144,
        justifyContent: 'flex-end',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: isDragging ? 30 : 10,
      }}
      type="button"
    >
      {seatedInZone && !isDragging ? (
        <DeskWorkstation
          appearance={appearance}
          emphasis
          entering
          reducedMotion={reducedMotion}
          size={104}
          status={user.status}
          working
        />
      ) : (
        <PresenceSprite
          accentColor={appearance.accentColor}
          accessory={appearance.accessory}
          color={appearance.shirtColor}
          hairColor={appearance.hairColor}
          hairStyle={appearance.hairStyle}
          isDragging={isDragging}
          outfit={appearance.outfit}
          reducedMotion
          skinColor={appearance.skinColor}
          status={user.status}
        />
      )}
      <NameTag isCurrentUser nearby={isNearby} username={user.username} />
    </button>
  );
}

function NameTag({
  isCurrentUser,
  nearby,
  username,
}: {
  isCurrentUser: boolean;
  nearby?: boolean;
  username: string;
}) {
  return (
    <span
      className="presence-character-name max-w-28 truncate border px-2.5 py-1 text-[10px] font-bold text-white"
      style={{
        background: nearby ? 'var(--presence-live)' : 'var(--presence-border)',
        borderColor: 'var(--presence-border)',
      }}
    >
      {username}
      {isCurrentUser ? ' (you)' : ''}
    </span>
  );
}
