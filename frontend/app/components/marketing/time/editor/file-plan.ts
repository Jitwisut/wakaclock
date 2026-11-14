import { seededRandom } from '../time-data';

/**
 * The editor world (owner decision 2026-11-15): the homepage's 3D scene is one enormous
 * source file seen as a landscape. Every line of code is a step going down the file, the
 * body of every block sits in a valley (its indentation), and the visitor travels with the
 * cursor. This file is the plan of that landscape, shared by the scene, the camera and the
 * page's markers: pure data, no three.js.
 *
 * Nothing here is real code and nothing is drawn as text: tokens are coloured bars, the way
 * an editor's minimap shows them.
 */

/** Stops along the file: the map (line 0), then one per place of the tour. */
export const STOP_COUNT = 10;
/** Lines of code between two stops, and the distance from one line to the next (m). */
export const LINES_PER_STOP = 40;
export const LINE_GAP = 1.5;
/** How far the file runs between two stops. */
export const STOP_GAP = LINES_PER_STOP * LINE_GAP;
/** Lines past the last stop, so the file does not end at the final landmark. */
export const TAIL_LINES = 26;
export const LINE_COUNT = STOP_COUNT * LINES_PER_STOP + TAIL_LINES;

/** The text area: where a line starts (before indentation) and the widest it gets. */
export const TEXT_LEFT = -20;
export const TEXT_RIGHT = 26;
export const INDENT = 3.2;
/** Each line is a step this much lower than the one before; each indent level sinks it more. */
export const STEP_DROP = 0.2;
export const VALLEY_DROP = 0.85;
/** Landmarks stand in the left margin, beyond the gutter. */
export const LANDMARK_X = -38;

export type TokenKind = 'comment' | 'keyword' | 'name' | 'number' | 'string';

export interface Token {
  kind: TokenKind;
  width: number;
  /** Left edge of the token on its line. */
  x: number;
}

export interface Line {
  /** Written by the AI: its tokens glow sea-teal and are typed ahead of the cursor. */
  ai: boolean;
  /** Indentation level: how deep in the valley the line lies. */
  depth: number;
  /** Right edge of the last token (the line's start when it is blank). */
  end: number;
  index: number;
  tokens: Token[];
}

const KINDS: readonly TokenKind[] = ['keyword', 'name', 'name', 'name', 'string', 'number'];

/** One line's tokens from `start`: a single long comment, or a few words of code. */
function writeLine(random: () => number, start: number, comment: boolean): Token[] {
  if (comment) return [{ kind: 'comment', x: start, width: 8 + random() * 16 }];
  const tokens: Token[] = [];
  const words = 2 + Math.floor(random() * 5);
  let x = start;
  for (let word = 0; word < words && x < TEXT_RIGHT - 3; word += 1) {
    const width = Math.min(TEXT_RIGHT - x, 1.3 + random() * 4.6);
    const kind = word === 0 && random() < 0.6 ? 'keyword' : KINDS[Math.floor(random() * 6)];
    tokens.push({ kind: kind ?? 'name', x, width });
    x += width + 0.7;
  }
  return tokens;
}

/** The whole file: blocks that open, nest and close, with comments and blank lines between. */
export function generateLines(count = LINE_COUNT, seed = 2026): Line[] {
  const random = seededRandom(seed);
  const lines: Line[] = [];
  let depth = 0;
  let aiLeft = 0;
  for (let index = 0; index < count; index += 1) {
    // Every stop begins a new top-level block: the landmark stands at a function's head.
    if (index % LINES_PER_STOP === 0) depth = 0;
    const roll = random();
    const blank = index % LINES_PER_STOP !== 0 && roll < 0.1;
    if (aiLeft === 0 && random() < 0.07) aiLeft = 4 + Math.floor(random() * 7);
    const ai = aiLeft > 0;
    if (ai) aiLeft -= 1;
    const start = TEXT_LEFT + depth * INDENT;
    const tokens = blank ? [] : writeLine(random, start, roll > 0.88);
    const last = tokens.at(-1);
    const x = last ? last.x + last.width : start;
    lines.push({ index, depth, ai, tokens, end: x });
    // Open or close a block for the next line.
    const turn = random();
    if (!blank && turn < 0.24 && depth < 3) depth += 1;
    else if (turn > 0.8 && depth > 0) depth -= 1;
  }
  return lines;
}

export const LINES: readonly Line[] = generateLines();

function lineAtIndex(index: number) {
  return LINES[Math.min(LINES.length - 1, Math.max(0, index))] as Line;
}

/** Distance down the file (world z) of a line. The file runs toward -z. */
export function lineZ(line: number) {
  return -line * LINE_GAP;
}

/** Height (world y) of a line's step: lower with every line, lower again inside a block. */
export function lineY(line: number) {
  const floor = Math.floor(line);
  const here = lineAtIndex(floor);
  const next = lineAtIndex(floor + 1);
  const t = Math.min(1, Math.max(0, line - floor));
  const depth = here.depth + (next.depth - here.depth) * t;
  return -line * STEP_DROP - depth * VALLEY_DROP;
}

/** The line a tour position is on: stop n is the head of block n. */
export function lineAtTour(tour: number) {
  return Math.min(LINE_COUNT - 1, Math.max(0, tour * LINES_PER_STOP));
}

/**
 * Where the cursor is for a (fractional) line: it runs along each line from its
 * indentation to its end as that line is typed, then drops to the next.
 */
export function cursorAt(line: number): [number, number, number] {
  const floor = Math.floor(line);
  const here = lineAtIndex(floor);
  const start = TEXT_LEFT + here.depth * INDENT;
  const typed = Math.min(1, Math.max(0, line - floor));
  return [start + (here.end - start) * typed, lineY(line), lineZ(line)];
}

/** World position of a stop's landmark base: in the left margin, level with its line. */
export function stopBase(stop: number): [number, number, number] {
  const line = stop * LINES_PER_STOP;
  return [LANDMARK_X, lineY(line), lineZ(line)];
}

/* ---------- landmarks: one glyph per place, built from cubes ---------- */

export const GLYPH_COLUMNS = 7;
export const GLYPH_ROWS = 9;
/** Edge of one cube of a landmark glyph. */
export const GLYPH_CUBE = 2.1;

/**
 * Seven by nine cells, top row first. Each place's landmark is a sign an editor would
 * recognise, not a word: a pulse, a dial, two carets, a grid of panels, run, a prompt,
 * info, a split view, braces, a question.
 */
export const GLYPHS: Record<string, readonly string[]> = {
  lighthouse: [
    '...#...',
    '...#...',
    '..#.#..',
    '..#.#..',
    '##..#.#',
    '....#.#',
    '....##.',
    '.....#.',
    '.......',
  ],
  clocktower: [
    '.#####.',
    '#.....#',
    '#..#..#',
    '#..#..#',
    '#..###.',
    '#.....#',
    '#.....#',
    '#.....#',
    '.#####.',
  ],
  twinlights: [
    '###.###',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '###.###',
  ],
  market: [
    '###.###',
    '###.###',
    '###.###',
    '.......',
    '###.###',
    '###.###',
    '###.###',
    '.......',
    '#######',
  ],
  ship: [
    '#......',
    '##.....',
    '###....',
    '####...',
    '#####..',
    '####...',
    '###....',
    '##.....',
    '#......',
  ],
  dock: [
    '#......',
    '.#.....',
    '..#....',
    '...#...',
    '..#....',
    '.#.....',
    '#......',
    '.......',
    '...####',
  ],
  library: [
    '...#...',
    '.......',
    '..##...',
    '...#...',
    '...#...',
    '...#...',
    '...#...',
    '...#...',
    '..###..',
  ],
  signal: [
    '###.###',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '###.###',
  ],
  trading: [
    '..#.#..',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '#.....#',
    '.#...#.',
    '.#...#.',
    '.#...#.',
    '..#.#..',
  ],
  tavern: [
    '.#####.',
    '#.....#',
    '......#',
    '.....#.',
    '....#..',
    '...#...',
    '...#...',
    '.......',
    '...#...',
  ],
};

/** Cells of a glyph as [column, row-from-the-bottom], left to right, bottom to top. */
export function glyphCells(id: string): [number, number][] {
  const rows = GLYPHS[id] ?? [];
  const cells: [number, number][] = [];
  for (const [row, text] of rows.entries()) {
    for (let column = 0; column < text.length; column += 1) {
      if (text[column] === '#') cells.push([column, rows.length - 1 - row]);
    }
  }
  return cells;
}

/** Height of a landmark above its base: the glyph on its plinth. */
export const LANDMARK_HEIGHT = GLYPH_ROWS * GLYPH_CUBE + 3;
