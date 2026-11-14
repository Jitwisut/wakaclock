import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { generateDemoDays } from '@/components/marketing/time/time-data';
import { resetTimeUi, setTimeUi, timeMotion } from '@/components/marketing/time/time-store';
import {
  AiWind,
  Spray,
  VoyageDirector,
  VoyageLights,
} from '@/components/marketing/time/voyage/director';
import { Ocean, oceanGrid, SkyDome } from '@/components/marketing/time/voyage/environment';
import { HotspotProjector } from '@/components/marketing/time/voyage/hotspot-projector';
import { Islands } from '@/components/marketing/time/voyage/islands';
import {
  ChipLog,
  Helm,
  Lanterns,
  lanternSpots,
} from '@/components/marketing/time/voyage/log-props';
import { Ship } from '@/components/marketing/time/voyage/ship';
import { resetVoyage, voyage } from '@/components/marketing/time/voyage/state';
import { bowFoamGeometry, Wake, wakeGeometry } from '@/components/marketing/time/voyage/wake';

/*
 * The Voyage Log scene, mounted without a GPU by @react-three/test-renderer: every part
 * builds, runs its frame loop and cleans up.
 */

const slices = generateDemoDays(2);

afterEach(() => {
  resetTimeUi();
  resetVoyage();
  timeMotion.world = false;
  document.body.innerHTML = '';
});

describe('voyage scene', () => {
  it('mounts the whole world and runs the director', async () => {
    const hotspot = document.createElement('li');
    hotspot.dataset.hotspot = 'lighthouse';
    hotspot.append(document.createElement('button'));
    document.body.append(hotspot);
    timeMotion.hand = 13 * 60;
    timeMotion.world = true;
    setTimeUi({ focus: 'ai' });
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <VoyageDirector lanterns={51} slices={slices} />
        <VoyageLights shadows />
        <SkyDome />
        <Ocean segments={16} />
        <Wake />
        <ChipLog slices={slices} />
        <Ship>
          <Helm slices={slices} />
          <Lanterns />
        </Ship>
        <Islands slices={slices} />
        <HotspotProjector />
        <Spray count={12} />
        <AiWind count={8} />
      </>
    );
    await renderer.advanceFrames(4, 0.05);
    expect(voyage.time).toBeGreaterThan(0);
    expect(voyage.sea).toBeGreaterThan(0);
    // Drifting among the islands, slower than the story's sailing speed.
    expect(voyage.speed).toBeLessThan(4.2);
    expect(voyage.ai).toBeGreaterThan(voyage.human);
    expect(hotspot.dataset.visible).toBeDefined();
    const meshes = renderer.scene.findAll((node) => node.instance instanceof THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(50);
    await renderer.unmount();
  });

  it('builds the ocean, wake and lantern layouts', () => {
    const grid = oceanGrid(8, 100);
    expect(grid.getAttribute('position').count).toBe(81);
    const wake = wakeGeometry(10, 4);
    expect(wake.getAttribute('wake').count).toBe(11 * 5);
    const bow = bowFoamGeometry(10, 3);
    expect(bow.getAttribute('foam').count).toBe(2 * 11 * 4);
    expect(lanternSpots(51)).toHaveLength(54);
    for (const geometry of [grid, wake, bow]) geometry.dispose();
  });
});
