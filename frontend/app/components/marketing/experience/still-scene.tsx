import { DEMO_BLOCKS } from './experience-data';
import { PALETTE } from './scene/palette-tokens';

const TAU = Math.PI * 2;
const DAYS = 14;
/** Server and browser can differ in the last float digit; round so hydration matches. */
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The still composition: the same demo fortnight drawn as a 2D projection of the spiral.
 *
 * It is what reduced-motion visitors and devices without WebGL see, and it is also the
 * first paint for everyone else while the 3D scene loads, so the stage is never an empty
 * rectangle and swapping to the canvas causes no layout shift.
 */
export function StillScene() {
  const marks = DEMO_BLOCKS.map((block, index) => {
    const mid = (block.startMin + block.durationMin / 2) / 1440;
    const angle = mid * TAU;
    const radius = 260 + block.project * 18;
    const depth = Math.sin(angle);
    const x = Math.cos(angle) * radius;
    const y = (DAYS / 2 - block.day - mid) * 34 + depth * 46;
    const length = Math.max(3, (block.durationMin / 1440) * TAU * radius * Math.abs(depth) + 2);
    const color = [PALETTE.day.human, PALETTE.day.ai, PALETTE.day.unknown][block.kind];
    return {
      index,
      x: round(x),
      y: round(y),
      length: round(length),
      color,
      depth: round(depth),
      kind: block.kind,
    };
  }).sort((a, b) => a.depth - b.depth);

  return (
    <svg className="axx-still" preserveAspectRatio="xMidYMid slice" viewBox="-900 -520 1800 1040">
      <line className="axx-still-axis" x1="0" x2="0" y1="-520" y2="520" />
      <g transform="translate(360 0)">
        {marks.map((mark) => (
          <rect
            fill={mark.color}
            height={mark.kind === 2 ? 3 : 6}
            key={mark.index}
            opacity={round(0.35 + (mark.depth + 1) * 0.3)}
            strokeDasharray={mark.kind === 1 ? '6 3' : undefined}
            width={mark.length}
            x={round(mark.x - mark.length / 2)}
            y={mark.y}
          />
        ))}
      </g>
    </svg>
  );
}
