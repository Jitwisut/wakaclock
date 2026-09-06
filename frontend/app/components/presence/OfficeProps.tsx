import type * as React from 'react';

/**
 * Pixel-art office props (water cooler, ficus, whiteboard, server rack, desk cluster) —
 * plain inline SVG built from small pixel grids, not image assets, so there is nothing
 * under `/public` to swap later; a future real sprite sheet can replace `pixelGrid`
 * callers one at a time without touching where these are placed on the floor.
 *
 * Same technique as `PresenceDecoration`: every left-right symmetric shape is authored
 * as a LEFT HALF only and mirrored into the full width (`mirrorRow`), which guarantees
 * symmetry without hand-counting characters in an ASCII grid. The whiteboard and the
 * server rack are deliberately asymmetric, so those author full rows through `pixelGrid`
 * and skip the mirroring step.
 *
 * Everything here is presentational and `aria-hidden`. Callers own layout: pass the
 * absolute positioning through `className`, and add `pointer-events-none` there too when
 * the prop sits under a draggable/clickable floor layer (as `PixelDeskCluster` does).
 */

function mirrorRow(left: string): string {
  return left + [...left].reverse().join('');
}

function pixelGrid(
  rows: readonly string[],
  colorFor: Record<string, string>,
  cell: number,
  extra?: React.ReactNode
) {
  const cols = rows[0]?.length ?? 0;
  const pixels: React.ReactNode[] = [];

  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x += 1) {
      const fill = colorFor[row[x]];
      if (!fill) continue;
      pixels.push(
        <rect fill={fill} height={cell} key={`${x}-${y}`} width={cell} x={x * cell} y={y * cell} />
      );
    }
  }

  return (
    <svg
      aria-hidden
      height={rows.length * cell}
      shapeRendering="crispEdges"
      viewBox={`0 0 ${cols * cell} ${rows.length * cell}`}
      width={cols * cell}
    >
      {pixels}
      {extra}
    </svg>
  );
}

function pixelGridSvg(
  leftHalves: readonly string[],
  colorFor: Record<string, string>,
  cell: number,
  extra?: React.ReactNode
) {
  return pixelGrid(leftHalves.map(mirrorRow), colorFor, cell, extra);
}

/* -------------------------------------------------------------------------- */
/* Water cooler                                                               */
/* -------------------------------------------------------------------------- */

const COOLER_ROWS = [
  '..OO',
  '..OP',
  '.OWW',
  '.OWP',
  '.OWW',
  '.OWW',
  'MMMM',
  'OLLL',
  'OLLO',
  'OLLL',
  'OMMM',
  'OOOO',
] as const;

const COOLER_COLORS = {
  L: '#c3c3d6',
  M: '#8a8a9e',
  O: '#151442',
  P: '#bde6ff',
  W: '#4fb3e8',
};

export function PixelWaterCooler({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGridSvg(
        COOLER_ROWS,
        COOLER_COLORS,
        5,
        <rect fill="#bde6ff" height={5} opacity={0.7} width={5} x={2 * 5} y={4 * 5} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ficus                                                                      */
/* -------------------------------------------------------------------------- */

const FICUS_ROWS = [
  '...G',
  '..Gg',
  '.Ggl',
  'Gggl',
  '.Ggl',
  '..GG',
  '...G',
  '...G',
  '.RRR',
  '.TTT',
  '.TTT',
  '..TT',
] as const;

const FICUS_COLORS = {
  G: '#2f8f4e',
  R: '#d97343',
  T: '#b25329',
  g: '#4caf6b',
  l: '#79d896',
};

export function PixelFicus({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGridSvg(
        FICUS_ROWS,
        FICUS_COLORS,
        5,
        <rect fill="#79d896" height={5} opacity={0.75} width={5} x={2 * 5} y={1 * 5} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Whiteboard — asymmetric (flow chart reads left to right), full rows         */
/* -------------------------------------------------------------------------- */

const WHITEBOARD_ROWS = [
  'FFFFFFFFFFFFFFFFFF',
  'FBBBBBBBBBBBBBBBBF',
  'FBbbbBBgggBByyyBBF',
  'FBbbbFFgggFFyyyBBF',
  'FBbbbBBgggBByyyBBF',
  'FBBBBBBBBBBBBBBBBF',
  'FBFFFFFFBBBBBBBBBF',
  'FBFFFFBBBBBBBBBBBF',
  'FFFFFFFFFFFFFFFFFF',
  '...MM.......MM....',
  '...MM.......MM....',
] as const;

const WHITEBOARD_COLORS = {
  B: '#f7f7fb',
  F: '#151442',
  M: '#8a8a9e',
  b: '#4fb3e8',
  g: '#4caf6b',
  y: '#f5c445',
};

export function PixelWhiteboard({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGrid(
        WHITEBOARD_ROWS,
        WHITEBOARD_COLORS,
        4,
        <rect fill="#c3c3d6" height={4} opacity={0.55} width={4} x={16 * 4} y={1 * 4} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Server rack — asymmetric (drive handles sit on one side), full rows         */
/* -------------------------------------------------------------------------- */

const RACK_ROWS = [
  'OOOOOOOO',
  'OMMMMMMO',
  'ODGADDDO',
  'ODDDDDLO',
  'ODGBDDDO',
  'ODDDDDLO',
  'ODGGADDO',
  'ODDDDDLO',
  'ODRADDDO',
  'ODDDDDLO',
  'ODGBDDDO',
  'ODDDDDLO',
  'ODGGDDDO',
  'ODDDDDLO',
  'OMMMMMMO',
  'OOOOOOOO',
] as const;

const RACK_COLORS = {
  A: '#f5c445',
  B: '#4fb3e8',
  D: '#12101f',
  G: '#28b65a',
  L: '#c3c3d6',
  M: '#8a8a9e',
  O: '#151442',
  R: '#ff4438',
};

export function PixelServerRack({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGrid(
        RACK_ROWS,
        RACK_COLORS,
        4,
        <rect fill="#8a8a9e" height={4} opacity={0.45} width={4} x={1 * 4} y={8 * 4} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desk cluster — top-down desk + monitor + chair                             */
/* -------------------------------------------------------------------------- */

const DESK_ROWS = [
  '..ommm',
  '..omzz',
  '..omzz',
  '..ommm',
  '....oo',
  'oddddd',
  'odhhhh',
  'oddddd',
  'osssss',
  'oeeeee',
  '...ctt',
  '..cttt',
  '...ccc',
  '....cc',
] as const;

const DESK_COLORS = {
  c: '#1d5c37',
  d: '#ba7d48',
  e: '#4d2b13',
  h: '#f1b37b',
  m: '#8a8a9e',
  o: '#151442',
  s: '#784824',
  t: '#388b58',
};

export function PixelDeskCluster({
  className,
  screenTone = '#0a1f13',
}: {
  className?: string;
  screenTone?: string;
}) {
  return (
    <div className={className}>
      {pixelGridSvg(
        DESK_ROWS,
        { ...DESK_COLORS, z: screenTone },
        4,
        <rect fill="#c3c3d6" height={4} opacity={0.3} width={4} x={4 * 4} y={1 * 4} />
      )}
    </div>
  );
}
