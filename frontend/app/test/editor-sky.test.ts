import { type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';

import { buildPlace } from '@/components/marketing/time/editor/buildings';
import { ISLAND_LIFT, ISLAND_TOP } from '@/components/marketing/time/editor/file-plan';
import {
  buildIsland,
  buildIslandWater,
  ISLAND_DEPTH,
  ISLAND_RADIUS,
  islandPlan,
} from '@/components/marketing/time/editor/island';
import { noise3, rod } from '@/components/marketing/time/editor/model-kit';
import {
  buildFall,
  buildRainbow,
  cloudPuffs,
  isletPlan,
  overCode,
  overFile,
} from '@/components/marketing/time/editor/sky';
import { TOUR } from '@/components/marketing/time/voyage/world-places';

/*
 * The sky islands (owner 2026-11-27): bigger islands with cliffs, roots and a pond, a themed
 * building for every place, waterfalls into a cotton-wool cloud bank, islets with lanterns.
 */

const SEEDS = TOUR.map((_, index) => (index + 1) * 31 + 7);

function bounds(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position');
  let low = Infinity;
  let high = -Infinity;
  let reach = 0;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
    low = Math.min(low, y);
    high = Math.max(high, y);
    reach = Math.max(reach, Math.hypot(x, z));
  }
  return { high, low, reach };
}

describe('the sky islands', () => {
  it('grew 40% and keeps its rock clear of the desk', () => {
    expect(ISLAND_RADIUS).toBeCloseTo(12.5 * 1.4);
    for (const seed of SEEDS.slice(0, 3)) {
      const island = buildIsland(seed);
      const { low } = bounds(island);
      expect(ISLAND_TOP - low).toBeLessThanOrEqual(ISLAND_DEPTH + 6);
      // Clear of the desk (7 m under the line) on its rod.
      expect(ISLAND_LIFT + low).toBeGreaterThan(-5);
      island.dispose();
    }
  });

  it('thins its dressing on smaller devices', () => {
    const full = buildIsland(38, 1);
    const compact = buildIsland(38, 0.35);
    expect(compact.getAttribute('position').count).toBeLessThan(
      full.getAttribute('position').count
    );
    full.dispose();
    compact.dispose();
  });

  it('plans the waterfall toward the camera, the building to the left, nothing over the file', () => {
    for (const seed of SEEDS) {
      const plan = islandPlan(seed);
      expect(plan).toEqual(islandPlan(seed));
      // +z faces the arriving camera; the file lies toward +x.
      expect(Math.sin(plan.waterfall.angle)).toBeGreaterThan(0.5);
      expect(overFile(plan.waterfall.angle)).toBe(false);
      expect(Math.cos(plan.landmark.angle)).toBeLessThan(-0.9);
      expect(plan.landmark.radius).toBeLessThan(ISLAND_RADIUS - 3);
    }
  });

  it('lays the pond and its stream on the grass, out to the lip', () => {
    const water = buildIslandWater(38);
    const { high, low, reach } = bounds(water);
    expect(low).toBeGreaterThan(ISLAND_TOP);
    expect(high).toBeLessThan(ISLAND_TOP + 0.5);
    expect(reach).toBeGreaterThan(ISLAND_RADIUS);
    water.dispose();
  });

  it('builds every place its own building, with the right moving parts', () => {
    const shapes = new Set<number>();
    for (const [index, id] of TOUR.entries()) {
      const seed = SEEDS[index] as number;
      const built = buildPlace(id, islandPlan(seed), seed);
      const body = bounds(built.body);
      // Stands on the island: only the dock's posts reach a little under the grass.
      expect(body.low).toBeGreaterThan(ISLAND_TOP - 1);
      expect(built.body.getAttribute('color').count).toBe(
        built.body.getAttribute('position').count
      );
      // The pier reaches over the edge; everything else stays on the island.
      if (id !== 'dock') expect(body.reach).toBeLessThan(ISLAND_RADIUS + 0.5);
      expect(built.glow.getAttribute('position').count).toBeGreaterThan(0);
      shapes.add(built.body.getAttribute('position').count);
      expect(Boolean(built.anchors.clock)).toBe(id === 'clocktower');
      if (['lighthouse', 'signal', 'twinlights'].includes(id)) {
        expect(built.anchors.lights.length).toBeGreaterThan(0);
      }
      // Every island has cottages with chimneys; the tavern smokes too.
      expect(built.anchors.smoke.length).toBeGreaterThan(id === 'tavern' ? 1 : 0);
      built.body.dispose();
      built.glow.dispose();
    }
    // Ten different buildings, not one model ten times.
    expect(shapes.size).toBe(TOUR.length);
    // Fewer cottages on small devices.
    const compact = buildPlace('tavern', islandPlan(38), 38, 0.2);
    expect(compact.anchors.smoke.length).toBeLessThan(
      buildPlace('tavern', islandPlan(38), 38, 1).anchors.smoke.length
    );
  });

  it('pours each waterfall off the lip and lets it fade into the clouds', () => {
    const plan = islandPlan(38);
    const fall = buildFall(plan);
    const position = fall.getAttribute('position');
    const colour = fall.getAttribute('color');
    expect(colour.itemSize).toBe(4);
    let top = -Infinity;
    let bottom = Infinity;
    for (let index = 0; index < position.count; index += 1) {
      top = Math.max(top, position.getY(index));
      bottom = Math.min(bottom, position.getY(index));
      const r = Math.hypot(position.getX(index), position.getZ(index));
      expect(r).toBeGreaterThan(ISLAND_RADIUS - 1);
    }
    expect(top).toBeGreaterThan(ISLAND_TOP);
    expect(top - bottom).toBeGreaterThan(8);
    for (let index = 0; index < position.count; index += 1) {
      if (position.getY(index) === bottom) expect(colour.getW(index)).toBe(0);
    }
    fall.dispose();
    const rainbow = buildRainbow(plan);
    expect(rainbow.getAttribute('color').itemSize).toBe(4);
    rainbow.dispose();
  });

  it('keeps clouds and islets off the file and thins them on small devices', () => {
    for (const seed of SEEDS) {
      for (const puff of cloudPuffs(seed, 1)) {
        expect(overCode(puff.at[0], puff.at[2])).toBe(false);
      }
      for (const islet of isletPlan(seed, 1)) {
        expect(overCode(islet.at[0], islet.at[2])).toBe(false);
        expect(Math.hypot(islet.at[0], islet.at[2])).toBeGreaterThan(ISLAND_RADIUS + 3);
      }
      expect(cloudPuffs(seed, 0.35).length).toBeLessThan(cloudPuffs(seed, 1).length);
      expect(isletPlan(seed, 0.35).length).toBeLessThanOrEqual(isletPlan(seed, 1).length);
    }
  });

  it('roughens the same point the same way and points rods where they go', () => {
    expect(noise3(1, 2, 3, 4)).toBe(noise3(1, 2, 3, 4));
    expect(Math.abs(noise3(0.3, 9, -2, 1))).toBeLessThanOrEqual(1);
    const chain = rod([0, 0, 0], [3, 4, 0], 0.1, '#000000');
    const { high, low } = bounds(chain);
    expect(low).toBeCloseTo(-0.1 * 0.8, 0);
    expect(high).toBeCloseTo(4, 0);
    chain.dispose();
  });
});
