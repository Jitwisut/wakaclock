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
/**
 * Each line is a step this much lower than the one before; each indent level sinks it more.
 * Gentle, so the whole file sits on its model base on the desk (owner decision 2026-11-15).
 */
export const STEP_DROP = 0.05;
export const VALLEY_DROP = 0.85;
/**
 * Landmarks stand in the left margin, beyond the gutter. Moved out from −38 when the islands
 * grew 40% (owner 2026-11-27), so their rims still clear the line numbers.
 */
export const LANDMARK_X = -43;

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

/** Right edge of the line numbers in the gutter, and the space one digit takes. */
export const GUTTER_RIGHT = TEXT_LEFT - 2.2;
export const DIGIT_STEP = 0.6;

export interface NumberBlock {
  /** Centre of the digit's block along the line (world x). */
  centre: number;
  /** A "1" is narrow, as in a real font. */
  width: number;
}

/**
 * Line `index`'s number (lines count from 1) as one block per digit, right-aligned in the
 * gutter. Not text: it reads as line numbers the way an editor's minimap reads as code.
 */
export function lineNumberBlocks(index: number): NumberBlock[] {
  const digits = String(index + 1);
  return [...digits].map((digit, place) => ({
    centre: GUTTER_RIGHT - (digits.length - 1 - place) * DIGIT_STEP - DIGIT_STEP / 2,
    width: digit === '1' ? 0.2 : 0.44,
  }));
}

/* ---------- the model on the desk ---------- */

/** How far below a line's steps the desk lies (m): the model base's thickness. */
export const BASE_DEPTH = 7;

/**
 * Height of the desk under file position `z`. It follows the file's average slope (under two
 * degrees, invisible at the horizon), so the base is equally thick from the first line to the
 * last.
 */
export function deskY(z: number) {
  return (z / LINE_GAP) * STEP_DROP - BASE_DEPTH;
}

/* ---------- landmarks: a bar chart on a floating island per place ---------- */

/** The island's grass above its own origin, and how high it floats over its line (m). */
export const ISLAND_TOP = 2.9;
export const ISLAND_LIFT = 9;
/** The tallest a place's chart may stand on its island (m). */
export const CHART_HEIGHT = 15;

/** Height of a landmark above its line: lift, island and chart. */
export const LANDMARK_HEIGHT = ISLAND_LIFT + ISLAND_TOP + CHART_HEIGHT;
