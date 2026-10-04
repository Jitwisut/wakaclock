import { DEMO_BLOCKS } from './experience-data';
import { PALETTE } from './scene/palette-tokens';

const TAU = Math.PI * 2;
const DAYS = 14;
/** Opacity levels the marks are bucketed into; each (kind, level) pair is one <path>. */
const LEVELS = 5;
const KIND_COLORS = [PALETTE.day.human, PALETTE.day.ai, PALETTE.day.unknown] as const;
/** Server and browser can differ in the last float digit; round so hydration matches. */
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Builds the still composition once per module load. Every mark used to be its own <rect>,
 * which put ~800 elements into the homepage HTML before the hero. Marks that share a kind
 * and an opacity level are now one path of rectangle subpaths: the same picture, ~15 nodes.
 */
function buildLayers() {
  const groups = new Map<string, { d: string[]; kind: number; level: number }>();
  for (const block of DEMO_BLOCKS) {
    const mid = (block.startMin + block.durationMin / 2) / 1440;
    const angle = mid * TAU;
    const radius = 260 + block.project * 18;
    const depth = Math.sin(angle);
    const x = Math.cos(angle) * radius;
    const y = round((DAYS / 2 - block.day - mid) * 34 + depth * 46);
    const width = round(
      Math.max(3, (block.durationMin / 1440) * TAU * radius * Math.abs(depth) + 2)
    );
    const height = block.kind === 2 ? 3 : 6;
    const level = Math.min(LEVELS - 1, Math.floor(((depth + 1) / 2) * LEVELS));
    const key = `${level}:${block.kind}`;
    const group = groups.get(key) ?? { d: [], kind: block.kind, level };
    group.d.push(`M${round(x - width / 2)} ${y}h${width}v${height}h${-width}z`);
    groups.set(key, group);
  }
  // Back to front, as the per-mark version sorted by depth.
  return [...groups.values()]
    .sort((a, b) => a.level - b.level || a.kind - b.kind)
    .map((group) => ({
      d: group.d.join(''),
      fill: KIND_COLORS[group.kind],
      key: `${group.level}:${group.kind}`,
      opacity: round(0.35 + ((group.level + 0.5) / LEVELS) * 0.6),
    }));
}
const LAYERS = buildLayers();

/**
 * The still composition: the same demo fortnight drawn as a 2D projection of the spiral.
 *
 * It is what reduced-motion visitors and devices without WebGL see, and it is also the
 * first paint for everyone else while the 3D scene loads, so the stage is never an empty
 * rectangle and swapping to the canvas causes no layout shift.
 */
export function StillScene() {
  return (
    <svg className="axx-still" preserveAspectRatio="xMidYMid slice" viewBox="-900 -520 1800 1040">
      <line className="axx-still-axis" x1="0" x2="0" y1="-520" y2="520" />
      <g transform="translate(360 0)">
        {LAYERS.map((layer) => (
          <path d={layer.d} fill={layer.fill} key={layer.key} opacity={layer.opacity} />
        ))}
      </g>
    </svg>
  );
}
