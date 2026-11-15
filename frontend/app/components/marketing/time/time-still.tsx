import { chartBars } from './editor/charts';
import { lineNumberBlocks, LINES } from './editor/file-plan';
import { arcPath, generateDemoDays, MINUTES_PER_DAY, pointOnRing, sliceRuns } from './time-data';

const C = 400;
const R = 300;
const SLICES = generateDemoDays(1);
const TODAY_RUNS = sliceRuns(SLICES, 0);

/*
 * The editor world, drawn flat: the first lines of the file receding up the page, the
 * visitor's gold cursor and the AI's teal one, and the first place's chart on its floating
 * island. Same plan as the 3D scene (file-plan.ts), so the hand-off does not jump in kind.
 */

const STILL_LINES = LINES.slice(0, 24);
const FAR = 250;
const NEAR = 770;

/** Where row `row` of the still sits: its baseline, its scale, and the x of file position `x`. */
function rowAt(row: number) {
  const t = row / (STILL_LINES.length - 1);
  const scale = 0.42 + 0.58 * t ** 1.15;
  const y = FAR + (NEAR - FAR) * t ** 1.35;
  return { scale, x: (at: number) => 470 + (at - 3) * 9.6 * scale, y };
}

const CARET_ROW = 15;
const AI_ROW = 9;

/** The island's chart (a week of coding, gold human with the AI's teal on top), 8 px a metre. */
const STILL_BARS = chartBars('market');
const STILL_SCALE = 8;

/**
 * Server-rendered still of the editor world. It is the whole visual for reduced motion,
 * data saver and devices without WebGL, and the first frame for everyone else until the
 * 3D scene has painted over it.
 */
export function TimeStill() {
  const ticks = Array.from({ length: 96 }, (_, index) => index * (MINUTES_PER_DAY / 96));
  const caret = rowAt(CARET_ROW);
  const caretLine = STILL_LINES[CARET_ROW];
  const ai = rowAt(AI_ROW);
  const aiLine = STILL_LINES[AI_ROW];
  return (
    <svg className="tx-still" viewBox="0 0 800 800">
      {/* The file: one step per line, coloured token bars, numbers in the gutter. */}
      <g className="tx-still-file">
        {STILL_LINES.map((line, row) => {
          const { scale, x, y } = rowAt(row);
          const height = 9 * scale;
          return (
            <g key={line.index}>
              <path
                className="tx-still-step"
                d={`M${x(-25).toFixed(1)} ${(y + height * 0.9).toFixed(1)}H${x(35).toFixed(1)}`}
              />
              {lineNumberBlocks(line.index).map((block) => (
                <rect
                  className={
                    row === CARET_ROW ? 'tx-still-number tx-still-number--here' : 'tx-still-number'
                  }
                  height={(height * 0.4).toFixed(1)}
                  key={block.centre}
                  width={(block.width * 9.6 * scale).toFixed(1)}
                  x={x(block.centre - block.width / 2).toFixed(1)}
                  y={(y + height * 0.3).toFixed(1)}
                />
              ))}
              {line.tokens.map((token) => (
                <rect
                  className="tx-still-token"
                  data-ai={line.ai ? 'true' : undefined}
                  data-kind={token.kind}
                  height={(token.kind === 'comment' ? height * 0.6 : height).toFixed(1)}
                  key={token.x}
                  rx={(1.4 * scale).toFixed(1)}
                  width={(token.width * 9.6 * scale).toFixed(1)}
                  x={x(token.x).toFixed(1)}
                  y={(
                    y -
                    (token.kind === 'comment' ? height * 0.6 : height) +
                    height * 0.8
                  ).toFixed(1)}
                />
              ))}
            </g>
          );
        })}
        {/* The visitor's cursor at the end of its line; the AI's a few lines ahead. */}
        <g className="tx-still-caret" data-kind="human">
          <rect
            height={34 * caret.scale}
            width={3.4 * caret.scale}
            x={caret.x(caretLine?.end ?? 0) + 3}
            y={caret.y - 30 * caret.scale}
          />
          <rect
            height={7 * caret.scale}
            width={13 * caret.scale}
            x={caret.x(caretLine?.end ?? 0) + 3}
            y={caret.y - 30 * caret.scale}
          />
        </g>
        <g className="tx-still-caret" data-kind="ai">
          <rect
            height={34 * ai.scale}
            width={3.4 * ai.scale}
            x={ai.x(aiLine?.end ?? 0) + 3}
            y={ai.y - 30 * ai.scale}
          />
          <rect
            height={7 * ai.scale}
            width={13 * ai.scale}
            x={ai.x(aiLine?.end ?? 0) + 3}
            y={ai.y - 30 * ai.scale}
          />
        </g>
      </g>
      {/* A place: its chart on a floating island in the margin. */}
      <g className="tx-still-island" transform="translate(650 120) scale(0.85)">
        <path
          className="tx-still-rock"
          d="M-118 92 L-96 132 L-60 170 L-18 236 L6 196 L40 214 L70 150 L104 120 L120 94 Z"
        />
        <path className="tx-still-earth" d="M-122 84 Q0 120 124 86 L120 98 Q0 136 -118 98 Z" />
        <ellipse className="tx-still-grass" cx="0" cy="80" rx="124" ry="26" />
        <path
          className="tx-still-tree"
          d="M-92 70 L-80 30 L-68 70 Z M74 66 L88 22 L102 66 Z M-60 66 L-52 40 L-44 66 Z"
        />
        <ellipse className="tx-still-shade" cx="0" cy="80" rx="62" ry="10" />
        {STILL_BARS.map((bar) => (
          <g key={bar.x}>
            <rect
              className="tx-still-cell"
              height={bar.human * STILL_SCALE}
              rx="2"
              width={bar.width * STILL_SCALE}
              x={(bar.x - bar.width / 2) * STILL_SCALE}
              y={78 - bar.human * STILL_SCALE}
            />
            <rect
              className="tx-still-cell"
              data-kind="ai"
              height={bar.ai * STILL_SCALE}
              rx="2"
              width={bar.width * STILL_SCALE}
              x={(bar.x - bar.width / 2) * STILL_SCALE}
              y={78 - (bar.human + bar.ai) * STILL_SCALE}
            />
          </g>
        ))}
      </g>
      {/* The day ring: today's ring, midnight at the top, the hand at the scrolled time. */}
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
