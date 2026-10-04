import type * as React from 'react';

/**
 * Pixel-art field decorations (tree, bush, rock, flower) — plain inline SVG built from
 * small symmetric pixel grids, not image assets, so there's nothing under `/public` to
 * swap later; a future real sprite sheet can replace `pixelGridSvg` callers one at a
 * time without touching where these are placed on the field (see `PresencePlayground`).
 *
 * Every multi-column shape is authored as a LEFT HALF only and mirrored into the full
 * width (`mirrorRow`) — the same technique `CharacterAvatar` uses, for the same reason:
 * it guarantees left-right symmetry without hand-counting characters in an ASCII grid.
 */

function mirrorRow(left: string): string {
  return left + [...left].reverse().join('');
}

function pixelGridSvg(
  leftHalves: readonly [string, ...string[]],
  colorFor: Record<string, string>,
  cell: number,
  extra?: React.ReactNode
) {
  const rows = leftHalves.map(mirrorRow);
  const cols = leftHalves[0].length * 2;
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

const TREE_ROWS = ['...CC', '..CCC', '.CCCC', 'CCCCC', 'CCCCC', '.CCCC', '...TT', '...TT'] as const;
const TREE_COLORS = { C: '#2f8f4e', T: '#6b4a2f' };

export function PixelTree({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGridSvg(
        TREE_ROWS,
        TREE_COLORS,
        7,
        <rect fill="#4caf6b" height={7} opacity={0.8} width={7} x={2 * 7} y={2 * 7} />
      )}
    </div>
  );
}

const BUSH_ROWS = ['..BB', '.BBB', 'BBBB', '.BBB'] as const;
const BUSH_COLORS = { B: '#4caf6b' };

export function PixelBush({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGridSvg(
        BUSH_ROWS,
        BUSH_COLORS,
        7,
        <rect fill="#79d896" height={7} opacity={0.7} width={7} x={1 * 7} y={1 * 7} />
      )}
    </div>
  );
}

const ROCK_ROWS = ['.RR', 'RRR', '.RR'] as const;
const ROCK_COLORS = { R: '#8a8a9e' };

export function PixelRock({ className }: { className?: string }) {
  return (
    <div className={className}>
      {pixelGridSvg(
        ROCK_ROWS,
        ROCK_COLORS,
        7,
        <rect fill="#c3c3d6" height={7} opacity={0.8} width={7} x={1 * 7} y={0} />
      )}
    </div>
  );
}

const FLOWER_ROWS = ['.P', 'S.'] as const;

const FLOWER_PALETTES = ['#ff8fa3', '#ffd166', '#ffffff'] as const;

export function PixelFlower({ className, variant = 0 }: { className?: string; variant?: number }) {
  const petal = FLOWER_PALETTES[variant % FLOWER_PALETTES.length];
  return (
    <div className={className}>{pixelGridSvg(FLOWER_ROWS, { P: petal, S: '#2f8f4e' }, 6)}</div>
  );
}
