import type { TimeCoreModel } from '@/lib/wakaclock/time-core';

import { RING_BASE_RADIUS, RING_SPACING } from './time-core-geometry';

/**
 * The same dial in flat SVG: the fallback when WebGL is unavailable, and the placeholder
 * that holds the stage's shape while the 3D scene loads (so nothing shifts when it
 * arrives). Hidden from assistive technology — the project list beside it carries the
 * same data as text.
 */
export function TimeCoreDial({
  focusedRing,
  model,
}: {
  focusedRing: null | number;
  model: null | TimeCoreModel;
}) {
  const scale = 46;
  const outer = (RING_BASE_RADIUS + RING_SPACING * 6 + 0.18) * scale;
  const size = outer * 2 + 80;
  const c = size / 2;
  // Rounded so server and browser trig agree to the digit (otherwise hydration differs).
  const point = (angle: number, r: number) =>
    `${(c + Math.sin(angle) * r).toFixed(2)},${(c - Math.cos(angle) * r).toFixed(2)}`;

  return (
    <svg
      aria-hidden
      className="h-full w-full"
      data-testid="time-core-dial"
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle cx={c} cy={c} fill="none" r={outer} stroke="var(--stage-line)" />
      {Array.from({ length: 24 }, (_, hour) => {
        const angle = (hour / 24) * Math.PI * 2;
        const major = hour % 6 === 0;
        const [x1, y1] = point(angle, outer + 4).split(',');
        const [x2, y2] = point(angle, outer + (major ? 16 : 9)).split(',');
        return (
          <line
            key={hour}
            stroke="var(--stage-muted)"
            strokeWidth={major ? 1.5 : 1}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        );
      })}
      {[0, 6, 12, 18].map((hour) => {
        const [x, y] = point((hour / 24) * Math.PI * 2, outer + 30).split(',');
        return (
          <text
            className="time-core-hour"
            dominantBaseline="middle"
            fill="var(--stage-muted)"
            key={hour}
            textAnchor="middle"
            x={x}
            y={y}
          >
            {String(hour).padStart(2, '0')}
          </text>
        );
      })}
      {model?.rings.map((ring, index) => {
        const r = (RING_BASE_RADIUS + index * RING_SPACING) * scale;
        return (
          <g key={ring.label} opacity={focusedRing !== null && focusedRing !== index ? 0.25 : 1}>
            <circle cx={c} cy={c} fill="none" r={r} stroke="var(--stage-line)" />
            {ring.arcs.map((arc) => {
              const sweep = Math.max(0.012, arc.endAngle - arc.startAngle);
              const large = sweep > Math.PI ? 1 : 0;
              return (
                <path
                  d={`M ${point(arc.startAngle, r)} A ${r} ${r} 0 ${large} 1 ${point(arc.startAngle + sweep, r)}`}
                  fill="none"
                  key={arc.id}
                  stroke={ring.cssColor}
                  strokeLinecap="butt"
                  strokeWidth={9}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
