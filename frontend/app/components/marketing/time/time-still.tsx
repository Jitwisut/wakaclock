import { arcPath, generateDemoDays, MINUTES_PER_DAY, pointOnRing, sliceRuns } from './time-data';

const C = 400;
const R = 300;
const SLICES = generateDemoDays(1);
const TODAY_RUNS = sliceRuns(SLICES, 0);

/** Sun glints on the water under the low sun: [x, y, length]. */
const GLINTS: readonly [number, number, number][] = [
  [548, 452, 46],
  [576, 468, 30],
  [532, 486, 64],
  [590, 502, 38],
  [520, 524, 86],
  [600, 548, 52],
  [506, 572, 110],
  [618, 604, 64],
];

/**
 * Server-rendered still of the Voyage Log: the ship under sail against a low sun, with the
 * ship's wheel — today's demo day as a 24-hour ring — in the corner. It is the whole visual
 * for reduced motion, data saver and devices without WebGL, and the first frame for
 * everyone else until the 3D scene has painted over it.
 */
export function TimeStill() {
  const ticks = Array.from({ length: 96 }, (_, index) => index * (MINUTES_PER_DAY / 96));
  return (
    <svg className="tx-still" viewBox="0 0 800 800">
      <g className="tx-still-sea">
        <g className="tx-still-sun">
          {[110, 76, 52].map((radius, index) => (
            <circle cx="560" cy="380" key={radius} opacity={0.12 + index * 0.12} r={radius} />
          ))}
        </g>
        <path className="tx-still-horizon" d="M0 440H800" />
        {GLINTS.map(([x, y, length]) => (
          <path
            className="tx-still-glint"
            d={`M${x - length / 2} ${y}h${length}`}
            key={`${x}:${y}`}
          />
        ))}
      </g>
      {/* The ship in silhouette: hull, three masts, square sails and a jib. */}
      <g className="tx-still-ship">
        <path d="M150 512 L196 548 L520 548 L566 500 L590 470 L548 486 L520 492 L196 492 L168 470 Z" />
        <path d="M168 470 L196 470 L196 492 L168 492 Z" />
        <path className="tx-still-spar" d="M262 492V196M386 492V150M492 492V214M560 486L700 410" />
        <path d="M226 236h72v66h-72zM214 312h96v80h-96zM206 402h112v70h-112z" />
        <path d="M344 190h84v70h-84zM330 270h112v84h-112zM318 364h136v96h-136z" />
        <path d="M462 252h60v56h-60zM452 318h80v68h-80zM444 396h96v64h-96z" />
        <path d="M546 300L690 414L560 470Z" />
      </g>
      {/* The ship's wheel: today's ring, midnight at the top, the hand at the scrolled time. */}
      <g className="tx-still-wheel" transform="translate(40 560) scale(0.28)">
        <circle className="tx-still-ring tx-still-ring--today" cx={C} cy={C} r={R} />
        {ticks.map((minute) => {
          const major = minute % 60 === 0;
          const [x1, y1] = pointOnRing(minute, R + 10);
          const [x2, y2] = pointOnRing(minute, R + (major ? 26 : 16));
          return (
            <path
              className={major ? 'tx-still-tick tx-still-tick--major' : 'tx-still-tick'}
              d={`M${(C + x1).toFixed(1)} ${(C - y1).toFixed(1)}L${(C + x2).toFixed(1)} ${(C - y2).toFixed(1)}`}
              key={minute}
            />
          );
        })}
        {TODAY_RUNS.map((run) => (
          <path
            className="tx-still-arc tx-still-arc--today"
            d={arcPath(C, C, R, run.start, run.end)}
            data-kind={run.kind}
            key={run.start}
          />
        ))}
        {[0, 6, 12, 18].map((hour) => {
          const [x, y] = pointOnRing(hour * 60, R + 50);
          return (
            <text className="tx-still-hour" key={hour} textAnchor="middle" x={C + x} y={C - y + 4}>
              {String(hour).padStart(2, '0')}
            </text>
          );
        })}
        {/* Drawn pointing at midnight; CSS turns it to the scrolled time (--tx-hand). */}
        <path className="tx-still-hand" d={`M${C} ${C}V${C - R + 26}`} />
        <circle className="tx-still-hub" cx={C} cy={C} r="6" />
        <circle className="tx-still-ring" cx={C} cy={C} r="40" />
      </g>
    </svg>
  );
}
