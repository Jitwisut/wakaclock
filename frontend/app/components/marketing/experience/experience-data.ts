/**
 * Deterministic, illustrative activity used by the homepage experience.
 *
 * Nothing here is customer data or a measurement. It is generated from a fixed seed so the
 * server render, the WebGL scene and the HTML alternatives all describe the same fictional
 * fortnight, and every surface that shows a number from it carries a "demo data" label.
 *
 * The shape mirrors the product's model: a heartbeat-derived *duration block* belongs to
 * one project and is attributed to a human, an AI agent, or left Unattributed.
 */

export const DEMO_PROJECTS = ['atoaxis-web', 'api-server', 'cli', 'docs', 'experiments'] as const;
export const DEMO_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DEMO_DAYS_TH = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'] as const;

/** 0 human · 1 AI agent · 2 Unattributed — matches the order used by the shader. */
export type DemoKind = 0 | 1 | 2;

export interface DemoBlock {
  /** Day index, 0 = oldest. */
  day: number;
  durationMin: number;
  kind: DemoKind;
  project: number;
  session: number;
  startMin: number;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = Math.trunc(state + 1_831_565_813);
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const PROJECT_WEIGHTS = [0.34, 0.27, 0.17, 0.12, 0.1];

function pickProject(random: () => number) {
  let roll = random();
  for (const [index, weight] of PROJECT_WEIGHTS.entries()) {
    roll -= weight;
    if (roll <= 0) return index;
  }
  return 0;
}

/** One session: consecutive short blocks, with AI activity arriving in runs. */
function pushSession(
  blocks: DemoBlock[],
  random: () => number,
  session: { day: number; end: number; id: number; project: number; start: number }
) {
  let aiRun = 0;
  let minute = session.start;
  while (minute < session.end) {
    const duration = Math.min(2 + Math.floor(random() * 7), session.end - minute);
    if (duration <= 0) break;
    if (aiRun === 0 && random() < 0.11) aiRun = 2 + Math.floor(random() * 6);
    let kind: DemoKind = 0;
    if (aiRun > 0) {
      kind = 1;
      aiRun -= 1;
    } else if (random() < 0.09) {
      kind = 2;
    }
    blocks.push({
      day: session.day,
      durationMin: duration,
      kind,
      project: session.project,
      session: session.id,
      startMin: minute,
    });
    minute += duration + (random() < 0.2 ? 1 + Math.floor(random() * 3) : 0.35);
  }
}

/**
 * Builds `days` days of sessions. Each session is split into short blocks with small gaps
 * so that the scene reads as many discrete marks, like duration blocks on a real timeline.
 * AI activity arrives in runs (an agent working through a task), not as isolated noise.
 */
export function generateDemoActivity(days = 14, seed = 20_260_925): DemoBlock[] {
  const random = mulberry32(seed);
  const blocks: DemoBlock[] = [];
  let id = 0;
  for (let day = 0; day < days; day += 1) {
    const weekend = day % 7 >= 5;
    const sessions = weekend ? 1 + Math.floor(random() * 2) : 3 + Math.floor(random() * 3);
    let cursor = 8 * 60 + Math.floor(random() * 90);
    for (let s = 0; s < sessions && cursor < 23 * 60; s += 1) {
      const project = pickProject(random);
      const length = 35 + Math.floor(random() * (weekend ? 70 : 140));
      const end = Math.min(cursor + length, 23 * 60 + 50);
      pushSession(blocks, random, { day, end, id, project, start: cursor });
      id += 1;
      cursor = end + 25 + Math.floor(random() * 110);
    }
  }
  return blocks;
}

export interface DemoSummary {
  byKind: [number, number, number];
  byProject: number[];
  totalMin: number;
}

export function summarize(blocks: readonly DemoBlock[]): DemoSummary {
  const byKind: [number, number, number] = [0, 0, 0];
  const byProject = DEMO_PROJECTS.map(() => 0);
  let totalMin = 0;
  for (const block of blocks) {
    byKind[block.kind] += block.durationMin;
    byProject[block.project] += block.durationMin;
    totalMin += block.durationMin;
  }
  return { byKind, byProject, totalMin };
}

export function formatMinutes(total: number, locale: 'en' | 'th' = 'en') {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (locale === 'th') return hours > 0 ? `${hours}ชม. ${minutes}น.` : `${minutes}น.`;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatClock(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60) % 24;
  const minutes = Math.floor(minuteOfDay % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** The HTML surfaces render this once at module scope; it is cheap and deterministic. */
export const DEMO_BLOCKS = generateDemoActivity();
export const DEMO_SUMMARY = summarize(DEMO_BLOCKS);
