import { BOW_X, deckHeight, halfWidthAt, sheerHeight, stationAt } from './hull';

import type { SailSpec } from './sails';

/**
 * The ship's rig as data: masts, yards, sails and every rope as a pair of ship-local points.
 * Components only draw what this plan says, so the rigging always runs between real spars
 * and real attachment points, and a test can check that it does.
 */

export type Vec3 = [number, number, number];

export interface MastPlan {
  /** Whether a course (lowest square sail) is set. The mizzen sets a spanker instead. */
  course: boolean;
  /** Deck height at the mast step. */
  deck: number;
  /** Height of the truck above the deck. */
  height: number;
  name: 'fore' | 'main' | 'mizzen';
  radius: number;
  /** Width of the lowest (course) yard. */
  span: number;
  x: number;
}

/** Heights along a mast, as shares of its height. */
export const MAST_LEVELS = {
  top: 0.47,
  crosstrees: 0.77,
  courseYard: 0.4,
  topsailYard: 0.67,
  gallantYard: 0.88,
} as const;

function mast(
  name: MastPlan['name'],
  x: number,
  height: number,
  radius: number,
  span: number,
  course: boolean
): MastPlan {
  return { name, x, deck: deckHeight(stationAt(x)), height, radius, span, course };
}

export const MASTS: readonly MastPlan[] = [
  mast('fore', 4.9, 17.6, 0.23, 11.4, true),
  mast('main', 0.5, 20.6, 0.27, 13.2, true),
  mast('mizzen', -4.75, 14.2, 0.19, 8.4, false),
];

export interface YardPlan {
  center: Vec3;
  mast: MastPlan['name'];
  radius: number;
  width: number;
}

export interface SailPlan {
  /** 'square' hangs across the ship; 'fore-and-aft' lies along it. */
  kind: 'fore-and-aft' | 'square';
  /** Where the head of the sail hangs (the yard's centre, just below it). */
  origin: Vec3;
  /** Extra rotation (radians, about Z) for fore-and-aft sails following a stay. */
  rake: number;
  spec: SailSpec;
}

export function mastPoint(plan: MastPlan, level: number, z = 0): Vec3 {
  return [plan.x, plan.deck + plan.height * level, z];
}

/** Yards: course, topsail and topgallant on each mast, narrowing aloft. */
export function buildYards(): YardPlan[] {
  return MASTS.flatMap((plan) => [
    {
      mast: plan.name,
      center: mastPoint(plan, MAST_LEVELS.courseYard),
      width: plan.span,
      radius: 0.13,
    },
    {
      mast: plan.name,
      center: mastPoint(plan, MAST_LEVELS.topsailYard),
      width: plan.span * 0.78,
      radius: 0.1,
    },
    {
      mast: plan.name,
      center: mastPoint(plan, MAST_LEVELS.gallantYard),
      width: plan.span * 0.57,
      radius: 0.075,
    },
  ]);
}

/** The bowsprit: from the stem, raking forward and up. */
export const BOWSPRIT: { from: Vec3; to: Vec3 } = {
  from: [BOW_X - 1.2, deckHeight(0.95) + 0.5, 0],
  to: [BOW_X + 6.2, deckHeight(0.95) + 3.4, 0],
};

/** Every sail: square sails between yards, a spanker aft and two jibs forward. */
export function buildSails(): SailPlan[] {
  const sails: SailPlan[] = [];
  let phase = 0.4;
  for (const plan of MASTS) {
    const yardY = (level: number) => plan.deck + plan.height * level;
    const course = yardY(MAST_LEVELS.courseYard);
    const topsail = yardY(MAST_LEVELS.topsailYard);
    const gallant = yardY(MAST_LEVELS.gallantYard);
    if (plan.course) {
      const height = course - (plan.deck + 2.7);
      sails.push({
        kind: 'square',
        origin: [plan.x + 0.2, course - 0.12, 0],
        rake: 0,
        spec: {
          head: plan.span * 0.94,
          foot: plan.span * 1,
          height,
          depth: height * 0.24,
          phase,
        },
      });
      phase += 1.7;
    }
    sails.push(
      {
        kind: 'square',
        origin: [plan.x + 0.2, topsail - 0.1, 0],
        rake: 0,
        spec: {
          head: plan.span * 0.74,
          foot: plan.span * 0.92,
          height: topsail - course - 0.3,
          depth: (topsail - course) * 0.24,
          phase,
        },
      },
      {
        kind: 'square',
        origin: [plan.x + 0.2, gallant - 0.08, 0],
        rake: 0,
        spec: {
          head: plan.span * 0.54,
          foot: plan.span * 0.72,
          height: gallant - topsail - 0.25,
          depth: (gallant - topsail) * 0.22,
          phase: phase + 0.9,
        },
      }
    );
    phase += 2.3;
  }
  const mizzen = MASTS[2] as MastPlan;
  // The spanker: a fore-and-aft sail abaft the mizzen.
  sails.push({
    kind: 'fore-and-aft',
    origin: [mizzen.x - 2.6, mizzen.deck + mizzen.height * 0.5, 0],
    rake: 0,
    spec: { head: 4.6, foot: 5.6, height: mizzen.height * 0.36, depth: 0.7, phase: 5.1 },
  });
  // Two jibs set flying on the fore-topmast stay: each head sits on the stay and the sail is
  // raked so its leading edge (luff) lies along it.
  const fore = MASTS[0] as MastPlan;
  const top = mastPoint(fore, MAST_LEVELS.crosstrees);
  const [tx, ty] = BOWSPRIT.to;
  const stayAngle = Math.atan2(tx - top[0], top[1] - ty);
  for (const [along, height, foot, jibPhase] of [
    [0.1, 7.4, 5, 2.2],
    [0.42, 4.8, 3.7, 3.6],
  ] as const) {
    const head: Vec3 = [top[0] + (tx - top[0]) * along, top[1] + (ty - top[1]) * along, 0];
    sails.push({
      kind: 'fore-and-aft',
      origin: head,
      rake: stayAngle - Math.atan(foot / 2 / height),
      spec: { head: 0.2, foot, height, depth: 0.5, phase: jibPhase },
    });
  }
  return sails;
}

export interface RopePlan {
  from: Vec3;
  radius: number;
  to: Vec3;
}

/** Where a shroud meets the hull: just outboard of the sheer, beside the mast. */
function chainplate(x: number, side: -1 | 1): Vec3 {
  const s = stationAt(x);
  const y = sheerHeight(s) - 0.35;
  return [x, y, side * (halfWidthAt(s, y) + 0.22)];
}

/** Rungs of the rope ladder between two neighbouring shrouds, about every 0.4 m. */
function ratlinesBetween(a?: { from: Vec3; to: Vec3 }, b?: { from: Vec3; to: Vec3 }): RopePlan[] {
  if (!a || !b) return [];
  const rungs: RopePlan[] = [];
  const lerp = (p: Vec3, q: Vec3, t: number): Vec3 => [
    q[0] + (p[0] - q[0]) * t,
    q[1] + (p[1] - q[1]) * t,
    q[2] + (p[2] - q[2]) * t,
  ];
  for (let t = 0.06; t < 0.92; t += 0.055) {
    rungs.push({ from: lerp(a.from, a.to, t), to: lerp(b.from, b.to, t), radius: 0.01 });
  }
  return rungs;
}

/** Standing and running rigging as straight rope segments. */
export function buildRigging(): { ratlines: RopePlan[]; ropes: RopePlan[] } {
  const ropes: RopePlan[] = [];
  const ratlines: RopePlan[] = [];
  const yards = buildYards();
  for (const plan of MASTS) {
    const top = mastPoint(plan, MAST_LEVELS.top);
    const cross = mastPoint(plan, MAST_LEVELS.crosstrees);
    const truck = mastPoint(plan, 0.98);
    for (const side of [1, -1] as const) {
      // Lower shrouds fan from the top to chainplates beside the mast.
      const shrouds: { from: Vec3; to: Vec3 }[] = [];
      for (let k = 0; k < 4; k += 1) {
        const to = chainplate(plan.x - 0.9 + k * 0.6, side);
        const from: Vec3 = [top[0], top[1], side * 0.35];
        shrouds.push({ from, to });
        ropes.push({ from, to, radius: 0.028 });
      }
      // Ratlines: the rope ladder between neighbouring shrouds.
      for (let k = 0; k < shrouds.length - 1; k += 1) {
        ratlines.push(...ratlinesBetween(shrouds[k], shrouds[k + 1]));
      }
      // Topmast shrouds from the crosstrees to the edge of the top.
      for (let k = 0; k < 3; k += 1) {
        ropes.push({
          from: [cross[0], cross[1], side * 0.2],
          to: [top[0] - 0.5 + k * 0.5, top[1] + 0.1, side * 1.35],
          radius: 0.02,
        });
      }
      // Backstays from the truck down to the hull, well aft of the mast.
      ropes.push({
        from: [truck[0], truck[1], side * 0.12],
        to: chainplate(plan.x - 3.4, side),
        radius: 0.024,
      });
    }
    // Lifts and braces for each yard.
    for (const yard of yards.filter((entry) => entry.mast === plan.name)) {
      for (const side of [1, -1] as const) {
        const end: Vec3 = [yard.center[0], yard.center[1], side * (yard.width / 2 - 0.15)];
        ropes.push({
          from: [yard.center[0], yard.center[1] + 2.2, side * 0.15],
          to: end,
          radius: 0.014,
        });
        ropes.push({
          from: end,
          to: chainplate(Math.max(yard.center[0] - 5.5, -7.6), side),
          radius: 0.013,
        });
      }
    }
  }
  const [fore, main, mizzen] = MASTS as [MastPlan, MastPlan, MastPlan];
  // Stays run forward, from each masthead to the mast (or bowsprit) ahead of it.
  ropes.push(
    { from: mastPoint(fore, MAST_LEVELS.top), to: BOWSPRIT.from, radius: 0.04 },
    { from: mastPoint(fore, MAST_LEVELS.crosstrees), to: BOWSPRIT.to, radius: 0.03 },
    { from: mastPoint(fore, 0.98), to: BOWSPRIT.to, radius: 0.022 },
    { from: mastPoint(main, MAST_LEVELS.top), to: [fore.x, fore.deck + 0.8, 0], radius: 0.04 },
    {
      from: mastPoint(main, MAST_LEVELS.crosstrees),
      to: mastPoint(fore, MAST_LEVELS.top),
      radius: 0.028,
    },
    { from: mastPoint(main, 0.98), to: mastPoint(fore, MAST_LEVELS.crosstrees), radius: 0.02 },
    { from: mastPoint(mizzen, MAST_LEVELS.top), to: [main.x, main.deck + 0.8, 0], radius: 0.032 },
    {
      from: mastPoint(mizzen, MAST_LEVELS.crosstrees),
      to: mastPoint(main, MAST_LEVELS.top),
      radius: 0.022,
    }
  );
  // Bobstay: under the bowsprit to the stem.
  ropes.push({ from: BOWSPRIT.to, to: [BOW_X + 0.3, 0.4, 0], radius: 0.03 });
  return { ropes, ratlines };
}
