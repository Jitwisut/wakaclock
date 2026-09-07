'use client';

import * as React from 'react';

import { motion } from 'motion/react';

import { appearanceFor } from '@/components/presence/appearance';
import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceUser } from '@/types/presence';

import type { PanInfo } from 'motion/react';

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
  containerRef: React.RefObject<HTMLDivElement | null>;
  isNearby?: boolean;
  onEnterZone?: () => void;
  onMove?: (next: { x: number; y: number }) => void;
  reducedMotion: boolean;
  user: PresenceUser;
}

/**
 * One character on the field. Only `user.isCurrentUser` renders as draggable — dragging
 * always reports the *authenticated* caller's own new position (see `onMove`, wired to
 * a real `POST .../position` call by `PresencePlayground`), so a read-only player for
 * everyone else is what prevents silently moving your own marker while trying to drag
 * a teammate's.
 *
 * The player keeps a stable React key while its position changes. Framer Motion receives
 * the shared server position through props, preserving drag/animation state across updates.
 */
export function PresencePlayer({
  containerRef,
  isNearby,
  onEnterZone,
  onMove,
  reducedMotion,
  user,
}: PresencePlayerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const appearance = appearanceFor(user.id);
  const safeX = finiteOr(user.x, SAFE_CENTRE);
  const safeY = finiteOr(user.y, SAFE_CENTRE);

  // Position from the drag *offset* (pixels moved since the gesture started), not
  // `PanInfo.point`. `point` is documented as "relative to the device or page" — which
  // one varies — so converting it against `getBoundingClientRect()` broke whenever the
  // dashboard was scrolled: the result went negative and clamped every drop to 0,0.
  // The offset is a pure delta and is unaffected by scroll or the page/viewport frame.
  const reportDragOffset = React.useCallback(
    (offset: { x: number; y: number }) => {
      const container = containerRef.current;
      if (!container || !onMove) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      onMove({
        x: clampPercent(safeX + (offset.x / rect.width) * 100),
        y: clampPercent(safeY + (offset.y / rect.height) * 100),
      });
    },
    [containerRef, onMove, safeX, safeY]
  );

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
      onMove({ x: clampPercent(safeX + delta[0]), y: clampPercent(safeY + delta[1]) });
    },
    [onEnterZone, onMove, safeX, safeY]
  );

  const wrapperStyle: React.CSSProperties = {
    left: `${safeX}%`,
    top: `${safeY}%`,
    transform: 'translate(-50%, -50%)',
  };

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
    <motion.button
      aria-label={`You, ${user.status}. Drag, or focus and use arrow keys, to move.`}
      className="presence-character-control absolute flex touch-none flex-col items-center gap-1 rounded-none border-none bg-transparent p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      drag
      dragConstraints={containerRef}
      dragElastic={0.06}
      dragMomentum={false}
      // Snap the Motion transform back to 0 on release; the final resting place comes
      // entirely from the `left`/`top` percentages the server round-trip updates, so the
      // drag translation must not linger and stack on top of the new position.
      dragSnapToOrigin
      onDragEnd={(_event, info: PanInfo) => {
        setIsDragging(false);
        reportDragOffset(info.offset);
      }}
      onDragStart={() => setIsDragging(true)}
      onKeyDown={handleKeyDown}
      style={{ ...wrapperStyle, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      type="button"
      whileDrag={{ scale: 1.03 }}
      whileTap={{ scale: 1.03 }}
    >
      <PresenceSprite
        accentColor={appearance.accentColor}
        accessory={appearance.accessory}
        color={appearance.shirtColor}
        hairColor={appearance.hairColor}
        hairStyle={appearance.hairStyle}
        isDragging={isDragging}
        outfit={appearance.outfit}
        reducedMotion={reducedMotion}
        skinColor={appearance.skinColor}
        status={user.status}
      />
      <NameTag isCurrentUser nearby={isNearby} username={user.username} />
    </motion.button>
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
