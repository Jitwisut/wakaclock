'use client';

import * as React from 'react';

import { motion } from 'motion/react';

import { PresenceSprite } from '@/components/presence/PresenceSprite';
import type { PresenceUser } from '@/types/presence';

import type { PanInfo } from 'motion/react';

/** Assigns each user a stable shirt colour by hashing their id — same person, same
 * colour, every time they appear, without the server needing to send or track one. */
const SHIRT_PALETTE = ['#2e86de', '#e0342b', '#b24bf3', '#1e9e52', '#f5c445', '#ff8fa3'] as const;

export function shirtColorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return SHIRT_PALETTE[hash % SHIRT_PALETTE.length];
}

/** How far one arrow-key press moves the player, in playground-percentage units — the
 * keyboard-equivalent of a small drag, since Framer Motion's `drag` prop (used for
 * pointer/touch) has no keyboard interaction of its own. */
const KEYBOARD_STEP_PERCENT = 3;

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

interface PresencePlayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isNearby?: boolean;
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
 * Keyed by its own position (`key={`${x}-${y}`}` at the call site in
 * `PresencePlayground`) — after a drag ends and the position is updated, that forces a
 * clean remount so Framer Motion's internal drag transform resets to zero instead of
 * stacking on top of the new `left`/`top`.
 */
export function PresencePlayer({ containerRef, isNearby, onMove, reducedMotion, user }: PresencePlayerProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const shirtColor = shirtColorFor(user.id);

  // `PanInfo.point` is page-relative (includes scroll), `getBoundingClientRect()` is
  // viewport-relative — add the scroll offset back in so the two are comparable.
  const reportPoint = React.useCallback(
    (pagePoint: { x: number; y: number }) => {
      const container = containerRef.current;
      if (!container || !onMove) return;
      const rect = container.getBoundingClientRect();
      const left = rect.left + window.scrollX;
      const top = rect.top + window.scrollY;
      onMove({
        x: clampPercent(((pagePoint.x - left) / rect.width) * 100),
        y: clampPercent(((pagePoint.y - top) / rect.height) * 100),
      });
    },
    [containerRef, onMove]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -KEYBOARD_STEP_PERCENT],
        ArrowDown: [0, KEYBOARD_STEP_PERCENT],
        ArrowLeft: [-KEYBOARD_STEP_PERCENT, 0],
        ArrowRight: [KEYBOARD_STEP_PERCENT, 0],
      };
      const delta = deltas[event.key];
      if (!delta || !onMove) return;
      event.preventDefault();
      onMove({ x: clampPercent(user.x + delta[0]), y: clampPercent(user.y + delta[1]) });
    },
    [onMove, user.x, user.y]
  );

  const wrapperStyle: React.CSSProperties = {
    left: `${user.x}%`,
    top: `${user.y}%`,
    transform: 'translate(-50%, -50%)',
  };

  if (!user.isCurrentUser) {
    return (
      <div className="absolute flex flex-col items-center gap-1" style={wrapperStyle}>
        <PresenceSprite color={shirtColor} reducedMotion={reducedMotion} status={user.status} />
        <NameTag isCurrentUser={false} nearby={isNearby} username={user.username} />
      </div>
    );
  }

  return (
    <motion.button
      aria-label={`You, ${user.status}. Drag, or focus and use arrow keys, to move.`}
      className="presence-pixel-press absolute flex touch-none flex-col items-center gap-1 rounded-none border-none bg-transparent p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      drag
      dragConstraints={containerRef}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={(_event, info: PanInfo) => {
        setIsDragging(false);
        reportPoint(info.point);
      }}
      onDragStart={() => setIsDragging(true)}
      onKeyDown={handleKeyDown}
      style={{ ...wrapperStyle, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      type="button"
      whileDrag={{ scale: 1.03 }}
      whileTap={{ scale: 1.03 }}
    >
      <PresenceSprite color={shirtColor} isDragging={isDragging} reducedMotion={reducedMotion} status={user.status} />
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
      className="presence-pixel-shadow-sm max-w-24 truncate border-2 px-2 py-0.5 text-[10px] font-bold text-white"
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
