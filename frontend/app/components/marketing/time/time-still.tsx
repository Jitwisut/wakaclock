import { arcPath, generateDemoDays, MINUTES_PER_DAY, pointOnRing, sliceRuns } from './time-data';

const C = 400;
const R = 300;
const DAYS = 7;
const SLICES = generateDemoDays(DAYS);
const TODAY_RUNS = sliceRuns(SLICES, 0);

/**
 * Server-rendered still of the time ring. It is the whole visual for reduced motion, data
 * saver and devices without WebGL, and the first frame for everyone else until the 3D scene
 * has painted over it. Same demo data and same dial geometry as the scene.
 */
export function TimeStill() {
  const ticks = Array.from({ length: 96 }, (_, index) => index * (MINUTES_PER_DAY / 96));
  return (
    <svg className="tx-still" viewBox="0 0 800 800">
      {/* earlier days recede up and to the right, toward a vanishing point */}
      {Array.from({ length: DAYS - 1 }, (_, index) => DAYS - 1 - index).map((day) => (
        <g key={day} opacity={Math.max(0.12, 0.5 - day * 0.06)}>
          <circle className="tx-still-ring" cx={C + day * 16} cy={C - day * 10} r={R - day * 24} />
          {sliceRuns(SLICES, day).map((run) => (
            <path
              className="tx-still-arc"
              d={arcPath(C + day * 16, C - day * 10, R - day * 24, run.start, run.end)}
              data-kind={run.kind}
              key={`${day}-${run.start}`}
            />
          ))}
        </g>
      ))}

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
    </svg>
  );
}
