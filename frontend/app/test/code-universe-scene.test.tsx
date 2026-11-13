import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';

import { awakening, IntelligenceCore } from '@/components/marketing/time/scene/core';
import { buildClusters, CLUSTER_CENTERS, Galaxy } from '@/components/marketing/time/scene/galaxy';
import { DAY, SCENE } from '@/components/marketing/time/scene/scene-palette';
import {
  buildTunnelEvents,
  TimeTunnel,
  tunnelDepth,
} from '@/components/marketing/time/scene/tunnel';
import { generateDemoDays, PROJECT_COUNT } from '@/components/marketing/time/time-data';
import {
  CAMERA_KEYS,
  galaxyVisibility,
  TUNNEL_DAY_LENGTH,
  TUNNEL_START,
  tunnelVisibility,
} from '@/components/marketing/time/time-keyframes';
import { QUALITY_TIERS } from '@/components/marketing/time/time-quality';
import { resetTimeUi, setTimeUi, timeMotion } from '@/components/marketing/time/time-store';

/*
 * The Code Universe scene: the Intelligence Core, the project galaxy and the time tunnel.
 * Pure helpers are checked directly; the components render through
 * @react-three/test-renderer (no GPU) with frames advanced by hand.
 */

const SLICES = generateDemoDays(7);

afterEach(() => {
  resetTimeUi();
});

describe('palette', () => {
  it('lights human work cyan and AI work amber, and never turns to daylight', () => {
    expect(SCENE.human).toBe('#66d9f7');
    expect(SCENE.ai).toBe('#e8a66a');
    expect(SCENE.bg).toBe('#05070b');
    expect(DAY).toEqual(SCENE);
  });
});

describe('awakening', () => {
  it('wakes the metal first, then the energy lines, then the nucleus', () => {
    expect(awakening(0)).toEqual({ metal: 0, lines: 0, nucleus: 0 });
    const early = awakening(0.4);
    expect(early.metal).toBeGreaterThan(early.lines);
    expect(early.nucleus).toBe(0);
    const late = awakening(0.8);
    expect(late.metal).toBe(1);
    expect(late.lines).toBe(1);
    expect(late.nucleus).toBeGreaterThan(0);
    expect(awakening(1)).toEqual({ metal: 1, lines: 1, nucleus: 1 });
  });
});

describe('camera and visibility', () => {
  it('keeps one composition per chapter and ends deep in the tunnel facing the core', () => {
    expect(CAMERA_KEYS).toHaveLength(6);
    const last = CAMERA_KEYS.at(-1);
    expect(last?.pos[2]).toBeLessThan(TUNNEL_START);
    expect(last?.look).toEqual([0, 0, 0]);
  });

  it('shows the galaxy around chapter 03 and the tunnel from chapter 05', () => {
    expect(galaxyVisibility(0)).toBe(0);
    expect(galaxyVisibility(2.5)).toBe(1);
    expect(galaxyVisibility(4.5)).toBe(0);
    expect(tunnelVisibility(2)).toBe(0);
    expect(tunnelVisibility(4)).toBe(1);
    expect(tunnelVisibility(3.45)).toBeGreaterThan(0);
  });
});

describe('galaxy clusters', () => {
  it('builds one deterministic cluster per demo project, capped in size', () => {
    const clusters = buildClusters(SLICES, 20);
    expect(clusters).toHaveLength(PROJECT_COUNT);
    expect(CLUSTER_CENTERS).toHaveLength(PROJECT_COUNT);
    for (const nodes of clusters) expect(nodes.length).toBeLessThanOrEqual(20);
    expect(buildClusters(SLICES, 20)).toEqual(clusters);
    const kinds = new Set(clusters.flat().map((node) => node.kind));
    expect(kinds.has('human')).toBe(true);
  });

  it('returns empty clusters without activity', () => {
    expect(buildClusters([], 10).every((nodes) => nodes.length === 0)).toBe(true);
  });
});

describe('time tunnel', () => {
  it('places today nearest the core and earlier days further down', () => {
    expect(tunnelDepth(0, 0)).toBe(TUNNEL_START);
    expect(tunnelDepth(1, 0)).toBe(TUNNEL_START - TUNNEL_DAY_LENGTH);
    expect(tunnelDepth(0, 720)).toBe(TUNNEL_START - TUNNEL_DAY_LENGTH / 2);
  });

  it('turns demo activity into pulses, sessions and commits inside the tunnel', () => {
    const events = buildTunnelEvents(SLICES, 100);
    expect(events.pulses.length).toBeGreaterThan(0);
    expect(events.pulses.length).toBeLessThanOrEqual(101);
    expect(events.sessions.length).toBeGreaterThan(events.commits.length / 2);
    expect(events.commits.length).toBeLessThanOrEqual(events.sessions.length);
    for (const marker of [...events.pulses, ...events.sessions, ...events.commits]) {
      expect(marker.z).toBeLessThanOrEqual(TUNNEL_START);
      expect(Math.hypot(marker.x, marker.y)).toBeLessThan(3.6);
    }
  });

  it('builds nothing from no activity', () => {
    expect(buildTunnelEvents([], 10)).toEqual({ pulses: [], sessions: [], commits: [] });
  });
});

describe('scene components', () => {
  it('renders the core and wakes it frame by frame', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <IntelligenceCore debris={QUALITY_TIERS.full.debris} shell />
    );
    timeMotion.wake = 0.9;
    await renderer.advanceFrames(3, 0.016);
    const lights = renderer.scene.findAll((node) => node.type === 'PointLight');
    expect(lights).toHaveLength(1);
    expect((lights[0]?.instance as THREE.PointLight).intensity).toBeGreaterThan(2);
    const instanced = renderer.scene.findAll((node) => node.instance instanceof THREE.InstancedMesh);
    expect(instanced.length).toBeGreaterThanOrEqual(3);
    await renderer.unmount();
  });

  it('renders a lighter core without shell or debris', async () => {
    const renderer = await ReactThreeTestRenderer.create(<IntelligenceCore debris={0} shell={false} />);
    await renderer.advanceFrames(1, 0.016);
    expect(renderer.scene.findAll((node) => node.type === 'PointLight')).toHaveLength(1);
    await renderer.unmount();
  });

  it('shows the galaxy only in its chapters and dims it for a focused kind', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Galaxy maxNodes={12} slices={SLICES} />);
    timeMotion.current = 0;
    await renderer.advanceFrames(1, 0.016);
    const groups = () =>
      renderer.scene
        .findAll((node) => node.type === 'Group')
        .map((node) => node.instance as THREE.Group)
        .filter((group) => group.position.lengthSq() > 0);
    expect(groups().every((group) => !group.visible)).toBe(true);
    timeMotion.current = 2.5;
    setTimeUi({ focus: 'ai' });
    await renderer.advanceFrames(1, 0.016);
    expect(groups().some((group) => group.visible)).toBe(true);
    await renderer.unmount();
  });

  it('lights tunnel markers as the camera reaches them', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TimeTunnel days={3} maxPulses={40} slices={generateDemoDays(3)} />
    );
    timeMotion.current = 0;
    await renderer.advanceFrames(1, 0.016);
    timeMotion.current = 4.5;
    setTimeUi({ focus: 'human' });
    await renderer.advanceFrames(2, 0.016);
    const markers = renderer.scene
      .findAll((node) => node.instance instanceof THREE.InstancedMesh)
      .map((node) => node.instance as THREE.InstancedMesh);
    expect(markers.length).toBeGreaterThanOrEqual(3);
    expect(markers.some((mesh) => mesh.instanceColor !== null)).toBe(true);
    await renderer.unmount();
  });
});
