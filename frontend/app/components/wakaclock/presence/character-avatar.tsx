import type * as React from 'react';

import type { PresenceState } from '@/lib/wakaclock/types';

interface CharacterAvatarProps {
  color: string;
  reducedMotion: boolean;
  size?: number;
  state: PresenceState;
  username: string;
}

const GRID_COLS = 10;
const GRID_ROWS = 12;
const CELL = 6;

const OUTLINE = '#1a1330';
const SKIN = '#f4c99b';
const HAIR = '#2b2140';
const PANTS = '#33294f';
const EYE_COLOR = '#1a1330';

/**
 * 10x12 pixel-grid sprite, front-facing, one character per grid cell: 'O' outline,
 * 'H' hair, 'F' face, 'B' body (the per-user hashed colour, plugged in at render time),
 * 'L' legs, '.' transparent. Eyes and mouth are NOT baked into this pattern — they're
 * drawn as separate overlay rects on top of the 'F' face cells in `EyesAndMouth` below,
 * so their shape alone can change per `PresenceState` without needing a different sprite
 * per state (i.e. no multi-frame sprite sheet to keep in sync).
 */
const SPRITE_ROWS = [
  '..OOOOOO..',
  '.OHHHHHHO.',
  '.OHHHHHHO.',
  '.OFFFFFFO.',
  '.OFFFFFFO.',
  '.OFFFFFFO.',
  '..OBBBBO..',
  '.OBBBBBBO.',
  '.OBBBBBBO.',
  '..OLLLLO..',
  '..OL..LO..',
  '..OO..OO..',
] as const;

/** Turns `SPRITE_ROWS` into `<rect>` pixels — plain data-to-markup, not a component,
 * since it's called once per render and the result is inlined directly into the SVG. */
function spritePixels(bodyColor: string): React.ReactNode[] {
  const colorFor: Record<string, string> = {
    O: OUTLINE,
    H: HAIR,
    F: SKIN,
    B: bodyColor,
    L: PANTS,
  };

  const pixels: React.ReactNode[] = [];
  for (const [row, pattern] of SPRITE_ROWS.entries()) {
    for (let col = 0; col < pattern.length; col += 1) {
      const symbol = pattern[col];
      const fill = colorFor[symbol];
      if (!fill) continue;
      pixels.push(
        <rect fill={fill} height={CELL} key={`${row}-${col}`} width={CELL} x={col * CELL} y={row * CELL} />
      );
    }
  }
  return pixels;
}

/** Eye openness and mouth shape are the only things that change per state — drawn as
 * overlay rects on top of the base sprite's face pixels (row 4 for eyes, row 5 for
 * mouth), at the same 6px cell grid the sprite itself uses. */
const EYE_HEIGHT_BY_STATE: Record<PresenceState, number> = {
  coding: CELL,
  idle: CELL / 2,
  offline: CELL / 4,
};

function EyesAndMouth({ state }: { state: PresenceState }) {
  const eyeHeight = EYE_HEIGHT_BY_STATE[state];
  const eyeY = 4 * CELL + (CELL - eyeHeight);

  return (
    <>
      <rect fill={EYE_COLOR} height={eyeHeight} width={CELL} x={3 * CELL} y={eyeY} />
      <rect fill={EYE_COLOR} height={eyeHeight} width={CELL} x={6 * CELL} y={eyeY} />
      {state === 'offline' ? null : (
        <rect fill={EYE_COLOR} height={CELL} width={2 * CELL} x={4 * CELL} y={5 * CELL} />
      )}
    </>
  );
}

/**
 * A tiny status LED in the sprite's top-right corner instead of a blurred "glow" aura —
 * blur breaks the pixel-art illusion, a blinking 2x2-pixel square doesn't. Blinks via
 * the `wakaclock-pixel-blink` CSS keyframe (game-theme.css), gated by `reducedMotion`.
 */
function StatusLed({ animate, color }: { animate: boolean; color: string }) {
  return (
    <rect
      className={animate ? 'wakaclock-pixel-blink' : undefined}
      fill={color}
      height={CELL * 1.5}
      shapeRendering="crispEdges"
      width={CELL * 1.5}
      x={GRID_COLS * CELL - CELL * 1.5}
      y={0}
    />
  );
}

const LED_COLOR: Record<PresenceState, null | string> = {
  coding: '#1e9e52',
  idle: '#9a8fc2',
  offline: null,
};

const MOTION_CLASS: Record<PresenceState, string | undefined> = {
  coding: 'wakaclock-pixel-bob',
  idle: 'wakaclock-pixel-sway',
  offline: undefined,
};

const OPACITY_BY_STATE: Record<PresenceState, number> = { coding: 1, idle: 1, offline: 0.5 };

/**
 * A small pixel-grid sprite whose pose and colour are entirely a function of `state` —
 * this is the one place the ambient presence signal from Phase 7's SSE stream becomes
 * something a person glances at and reads instantly. See `plan.md` 7.5.
 *
 * Motion is CSS `steps()` easing, not smoothly-interpolated animation — see
 * `game-theme.css` for why: discrete "frame flips" are what make this read as 8-bit
 * rather than a smooth shape wearing pixel colours. Only "coding" and "idle" animate;
 * "offline" holds still and desaturates, so in a typical room only people actively
 * coding right now are visibly moving (an infinite-animation-on-everything anti-pattern
 * this project avoids elsewhere too).
 */
export function CharacterAvatar({
  color,
  reducedMotion,
  size = 72,
  state,
  username,
}: CharacterAvatarProps) {
  const motionClass = reducedMotion ? undefined : MOTION_CLASS[state];
  const ledColor = LED_COLOR[state];

  return (
    <div className="relative flex flex-col items-center gap-1.5 select-none" style={{ width: size }}>
      <svg
        aria-hidden
        className={motionClass}
        height={size * (GRID_ROWS / GRID_COLS)}
        shapeRendering="crispEdges"
        style={{ opacity: OPACITY_BY_STATE[state], filter: state === 'offline' ? 'grayscale(1)' : undefined }}
        viewBox={`0 0 ${GRID_COLS * CELL} ${GRID_ROWS * CELL}`}
        width={size}
      >
        {spritePixels(color)}
        <EyesAndMouth state={state} />
        {ledColor ? <StatusLed animate={!reducedMotion} color={ledColor} /> : null}
      </svg>

      {state === 'offline' ? (
        <span
          aria-hidden
          className="text-muted-foreground absolute -top-1 right-0 text-xs font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-game-heading)', fontSize: '8px' }}
        >
          zzz
        </span>
      ) : null}

      <span className="max-w-full truncate text-sm font-bold" title={username}>
        {username}
      </span>
    </div>
  );
}
