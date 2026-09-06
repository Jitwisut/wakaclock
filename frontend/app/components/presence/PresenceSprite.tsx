import type * as React from 'react';

import type { SpriteAccessory } from '@/components/presence/appearance';
import type { PresenceState } from '@/lib/wakaclock/types';

interface PresenceSpriteProps {
  accentColor?: string;
  accessory?: SpriteAccessory;
  color: string;
  hairColor?: string;
  isDragging?: boolean;
  reducedMotion: boolean;
  size?: number;
  status: PresenceState;
}

const GRID_COLS = 14;
const GRID_ROWS = 17;
const CELL = 6;
const HALF_COLS = GRID_COLS / 2;

const OUTLINE = '#151442';
const SKIN = '#f5c48e';
const HAIR = '#151442';
const PANTS = '#151442';

/**
 * Only the LEFT half of each row is authored here; `spritePixels` mirrors it into the
 * full 14-wide row (guarantees symmetry without hand-counting an ASCII grid — see
 * `PresenceDecoration.tsx` for the same technique applied to the field scenery).
 *
 * The hair (`H`) fill and an optional headset/cap overlay come from `appearance.ts`
 * (hashed from the user id) so the roster reads as distinct people, the way the
 * PixelOffice reference workstations do; the shirt colour (`B`, via `color`) still
 * carries most of the per-user variety.
 */
const LEFT_HALVES = [
  '..OOOOO',
  '.OHHHHH',
  'OHHHHHH',
  'OHHHHHH',
  'OFFFFFF',
  'OFFFFFF',
  'OFFFFFF',
  'OFFFFFF',
  '.OFFFFF',
  '..OOOOO',
  '.OBBBBB',
  'OBBBBBB',
  'OBBBBBB',
  '.OBBBBB',
  '..OLLLL',
  '..OLL..',
  '..OOO..',
] as const;

function mirrorRow(left: string): string {
  return left + [...left].reverse().join('');
}

const SPRITE_ROWS: string[] = LEFT_HALVES.map(mirrorRow);

function spritePixels(shirtColor: string, hairColor: string): React.ReactNode[] {
  const colorFor: Record<string, string> = {
    B: shirtColor,
    F: SKIN,
    H: hairColor,
    L: PANTS,
    O: OUTLINE,
  };
  const pixels: React.ReactNode[] = [];
  for (const [row, pattern] of SPRITE_ROWS.entries()) {
    for (let col = 0; col < pattern.length; col += 1) {
      const fill = colorFor[pattern[col]];
      if (!fill) continue;
      pixels.push(
        <rect fill={fill} height={CELL} key={`${row}-${col}`} width={CELL} x={col * CELL} y={row * CELL} />
      );
    }
  }
  return pixels;
}

/**
 * Headset (band + two earcups) or backward cap (crown + brim), drawn over the base
 * grid. Both sit on the head rows (0-4) and use the per-user accent colour.
 */
function AccessoryPixels({
  accentColor,
  accessory,
}: {
  accentColor: string;
  accessory: SpriteAccessory;
}) {
  if (accessory === 'headset') {
    return (
      <>
        <rect fill={accentColor} height={CELL} width={12 * CELL} x={CELL} y={0} />
        <rect fill={accentColor} height={2 * CELL} width={CELL} x={0} y={3 * CELL} />
        <rect fill={accentColor} height={2 * CELL} width={CELL} x={(GRID_COLS - 1) * CELL} y={3 * CELL} />
      </>
    );
  }
  if (accessory === 'cap') {
    return (
      <>
        <rect fill="#181a20" height={1.5 * CELL} width={12 * CELL} x={CELL} y={0} />
        <rect fill="#181a20" height={CELL} width={2.5 * CELL} x={(GRID_COLS - 1) * CELL} y={CELL} />
        <rect fill={accentColor} height={CELL} width={CELL} x={HALF_COLS * CELL - CELL / 2} y={CELL / 2} />
      </>
    );
  }
  return null;
}

const EYE_ROW = 5;
const EYE_COL_LEFT = 3;
const EYE_COL_RIGHT = GRID_COLS - 1 - EYE_COL_LEFT;
const MOUTH_ROW = 7;
const MOUTH_COL = HALF_COLS - 1;
/** Eyes/mouth sit on the light `SKIN` fill, so they need a dark mark, not a light one —
 * reuse `OUTLINE` rather than inventing a third near-black tone. */
const FACE_MARK_COLOR = OUTLINE;

const EYE_HEIGHT_BY_STATUS: Record<PresenceState, number> = {
  coding: CELL,
  idle: CELL / 2,
  offline: CELL / 4,
};

function EyesAndMouth({ status }: { status: PresenceState }) {
  const eyeHeight = EYE_HEIGHT_BY_STATUS[status];
  const eyeY = EYE_ROW * CELL + (CELL - eyeHeight);

  return (
    <>
      <rect fill={FACE_MARK_COLOR} height={eyeHeight} width={CELL} x={EYE_COL_LEFT * CELL} y={eyeY} />
      <rect fill={FACE_MARK_COLOR} height={eyeHeight} width={CELL} x={EYE_COL_RIGHT * CELL} y={eyeY} />
      {status === 'offline' ? null : (
        <rect fill={FACE_MARK_COLOR} height={CELL} width={2 * CELL} x={MOUTH_COL * CELL} y={MOUTH_ROW * CELL} />
      )}
    </>
  );
}

function ShinePixel({ status }: { status: PresenceState }) {
  if (status === 'offline') return null;
  return <rect fill="white" height={CELL} opacity={0.3} width={CELL} x={3 * CELL} y={11 * CELL} />;
}

const LED_COLOR: Record<PresenceState, null | string> = {
  coding: '#28b65a',
  idle: '#8f8fb8',
  offline: null,
};

const MOTION_CLASS: Record<PresenceState, string | undefined> = {
  coding: 'presence-player-coding',
  idle: 'presence-player-idle',
  offline: undefined,
};

const OPACITY_BY_STATUS: Record<PresenceState, number> = { coding: 1, idle: 1, offline: 0.55 };

/**
 * The pixel-grid character itself, with no drag/position logic — `PresencePlayer` wraps
 * this with the actual draggable behaviour and name tag. Pose/colour are entirely a
 * function of `status`, mirroring the same live-activity signal design used throughout
 * this page: only people who are actually coding right now visibly move. Hair/accessory
 * are a function of the user id (see `appearance.ts`).
 */
export function PresenceSprite({
  accentColor = '#151442',
  accessory = 'none',
  color,
  hairColor = HAIR,
  isDragging,
  reducedMotion,
  size = 84,
  status,
}: PresenceSpriteProps) {
  const motionClass = reducedMotion || isDragging ? undefined : MOTION_CLASS[status];
  const ledColor = LED_COLOR[status];

  return (
    <svg
      aria-hidden
      className={motionClass}
      height={size * (GRID_ROWS / GRID_COLS)}
      shapeRendering="crispEdges"
      style={{ opacity: OPACITY_BY_STATUS[status], filter: status === 'offline' ? 'grayscale(1)' : undefined }}
      viewBox={`0 0 ${GRID_COLS * CELL} ${GRID_ROWS * CELL}`}
      width={size}
    >
      {spritePixels(color, hairColor)}
      <AccessoryPixels accentColor={accentColor} accessory={accessory} />
      <ShinePixel status={status} />
      <EyesAndMouth status={status} />
      {ledColor ? (
        <rect
          className={reducedMotion ? undefined : 'presence-status-blink'}
          fill={ledColor}
          height={CELL * 1.5}
          shapeRendering="crispEdges"
          width={CELL * 1.5}
          x={GRID_COLS * CELL - CELL * 1.5}
          y={0}
        />
      ) : null}
    </svg>
  );
}
