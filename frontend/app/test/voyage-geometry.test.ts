import { describe, expect, it } from 'vitest';

import {
  BOW_X,
  buildHull,
  deckHeight,
  gunwalePoints,
  halfBeam,
  halfWidthAt,
  keelDepth,
  sheerHeight,
  STERN_X,
} from '@/components/marketing/time/voyage/hull';
import {
  buildSailGeometry,
  sailBillow,
  type SailSpec,
} from '@/components/marketing/time/voyage/sails';
import {
  displacement,
  GERSTNER_GLSL,
  MAX_WAVE_HEIGHT,
  SHIP_SPEED,
  surfaceHeight,
  WAVES,
} from '@/components/marketing/time/voyage/waves';

/*
 * The Voyage Log's pure geometry: the wave field the ocean shader and the buoyancy share,
 * the lofted hull and the anchored sails.
 */

describe('wave field', () => {
  it('keeps crests from looping and stays within its amplitude', () => {
    const steepness = WAVES.reduce((sum, wave) => sum + wave.steepness, 0);
    expect(steepness).toBeLessThan(1);
    for (let index = 0; index < 50; index += 1) {
      const y = surfaceHeight(index * 3.7 - 90, index * 1.3 - 30, index * 0.41);
      expect(Math.abs(y)).toBeLessThanOrEqual(MAX_WAVE_HEIGHT + 1e-9);
    }
  });

  it('finds the surface point that actually lies over a world position', () => {
    const t = 12.3;
    const x = 4;
    const z = -2;
    // Re-run the fixed-point search by hand and confirm the displaced point lands on (x, z).
    let px = x;
    let pz = z;
    for (let index = 0; index < 8; index += 1) {
      const [dx, , dz] = displacement(px, pz, t);
      px = x - (dx as number);
      pz = z - (dz as number);
    }
    const [dx, dy, dz] = displacement(px, pz, t);
    expect(px + (dx as number)).toBeCloseTo(x, 3);
    expect(pz + (dz as number)).toBeCloseTo(z, 3);
    expect(surfaceHeight(x, z, t, 8)).toBeCloseTo(dy as number, 4);
  });

  it('streams the sea past the ship: an offset is exactly a shift of the field', () => {
    const out = [0, 0, 0];
    const shifted = [...displacement(3, -1, 7.5, out, 12)];
    expect(displacement(15, -1, 7.5, [0, 0, 0], 0)).toEqual(shifted);
    // By default the sea runs at the sailing speed.
    expect(displacement(0, 0, 2)).toEqual(displacement(0, 0, 2, [0, 0, 0], SHIP_SPEED * 2));
  });

  it('compiles the same table into the shader source', () => {
    expect(GERSTNER_GLSL).toContain(`WAVE_COUNT = ${WAVES.length}`);
    expect(GERSTNER_GLSL).toContain(
      'vec3 gerstner(vec2 p, float t, float distanceToEye, out vec3 normal)'
    );
    expect(GERSTNER_GLSL).not.toMatch(/NaN|Infinity/);
  });
});

describe('hull', () => {
  it('is broad amidships, fine at the bow and raised aft', () => {
    expect(halfBeam(0.42)).toBeGreaterThan(halfBeam(0));
    expect(halfBeam(1)).toBeCloseTo(0);
    expect(deckHeight(0.1)).toBeGreaterThan(deckHeight(0.5));
    expect(sheerHeight(0.5)).toBeGreaterThan(deckHeight(0.5));
    expect(keelDepth(0.98)).toBeLessThan(keelDepth(0.5));
    expect(halfWidthAt(0.5, -keelDepth(0.5))).toBeCloseTo(0, 5);
    expect(halfWidthAt(0.5, 0)).toBeCloseTo(halfBeam(0.5));
  });

  it('lofts finite geometry with unit normals', () => {
    const { deck, hull } = buildHull(24, 10);
    for (const geometry of [hull, deck]) {
      const positions = geometry.getAttribute('position').array;
      const normals = geometry.getAttribute('normal').array;
      expect([...positions].every(Number.isFinite)).toBe(true);
      for (let index = 0; index < normals.length; index += 3) {
        const length = Math.hypot(
          normals[index] as number,
          normals[index + 1] as number,
          normals[index + 2] as number
        );
        expect(length).toBeGreaterThan(0.99);
        expect(length).toBeLessThan(1.01);
      }
    }
    const box = hull.boundingSphere;
    expect(box?.radius).toBeGreaterThan(8);
    hull.dispose();
    deck.dispose();
  });

  it('puts the gunwale between stern and bow on the right side', () => {
    const points = gunwalePoints(10, -1);
    expect(points).toHaveLength(10);
    for (const [x, y, z] of points) {
      expect(x).toBeGreaterThan(STERN_X - 1);
      expect(x).toBeLessThan(BOW_X + 2);
      expect(y).toBeGreaterThan(1);
      expect(z).toBeLessThanOrEqual(0);
    }
  });
});

describe('sails', () => {
  const spec: SailSpec = { head: 6, foot: 7, height: 4, depth: 0.9, phase: 1.3 };

  it('never moves the head away from its yard', () => {
    for (const t of [0, 1.7, 33.3]) {
      for (const u of [0, 0.25, 0.5, 1]) {
        expect(sailBillow(u, 0, t, spec)).toBeCloseTo(0, 10);
      }
    }
  });

  it('fills deepest in the middle and goes slack without wind', () => {
    expect(sailBillow(0.5, 0.8, 0, spec)).toBeGreaterThan(sailBillow(0.05, 0.8, 0, spec));
    expect(sailBillow(0.5, 0.8, 0, spec, 0)).toBe(0);
    expect(Math.abs(sailBillow(0.5, 1, 4, spec))).toBeLessThan(spec.depth * 1.2);
  });

  it('builds a grid hanging below the yard', () => {
    const geometry = buildSailGeometry(spec, 6, 5);
    const positions = geometry.getAttribute('position');
    expect(positions.count).toBe(7 * 6);
    expect(geometry.getAttribute('sail').count).toBe(positions.count);
    expect(positions.getY(0)).toBe(0);
    expect(positions.getY(positions.count - 1)).toBeLessThan(-spec.height + 0.2);
    geometry.dispose();
  });
});
