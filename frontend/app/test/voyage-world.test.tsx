import { act, cleanup, render } from '@testing-library/react';
import { PerspectiveCamera, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateDemoDays } from '@/components/marketing/time/time-data';
import { resetTimeUi, timeMotion } from '@/components/marketing/time/time-store';
import {
  chipLogMarkers,
  DROP_OFFSET,
  lanternFor,
  latestDrop,
  sliceAge,
} from '@/components/marketing/time/voyage/chip-log';
import { focusTargets, windVisibility } from '@/components/marketing/time/voyage/director';
import {
  HOTSPOT_BOUNDS,
  hotspotPosition,
  separate,
} from '@/components/marketing/time/voyage/hotspot-projector';
import { STERN_X } from '@/components/marketing/time/voyage/hull';
import { islandGeometry, PLATEAU } from '@/components/marketing/time/voyage/islands';
import { ringPhase } from '@/components/marketing/time/voyage/place-fx';
import {
  buildRigging,
  buildSails,
  buildYards,
  MASTS,
} from '@/components/marketing/time/voyage/rig-plan';
import { fxBurst, placeFx, resetVoyage, voyage } from '@/components/marketing/time/voyage/state';
import {
  dayProgress,
  daylight,
  lanternLevel,
  starLevel,
  sunDirection,
  sunElevation,
} from '@/components/marketing/time/voyage/time-of-day';
import { WorldMode } from '@/components/marketing/time/voyage/world-mode';
import {
  fromMapView,
  HOME_POSE,
  landmark,
  placeById,
  placeRadius,
  PLACES,
  TOUR,
  tourIndex,
  tourKeys,
  tourStop,
  visitPose,
} from '@/components/marketing/time/voyage/world-places';

/*
 * The Voyage Log world: the archipelago plan, the chip log, the light and the in-page
 * world controller that turns the homepage into places.
 */

afterEach(() => {
  // Each world controller listens on the window: unmount it before the next case.
  cleanup();
  // A followed in-page link leaves its hash behind, which would open that place again.
  window.history.replaceState(null, '', '/');
  resetTimeUi();
  document.body.innerHTML = '';
});

describe('time of day', () => {
  it('opens at golden hour, sets around the middle and reaches night by midnight', () => {
    expect(dayProgress(480)).toBe(0);
    expect(dayProgress(1440)).toBe(1);
    expect(sunElevation(0)).toBeGreaterThan(0.1);
    expect(sunElevation(1)).toBeLessThan(-0.25);
    expect(daylight(sunElevation(0))).toBe(1);
    expect(daylight(sunElevation(1))).toBe(0);
    expect(lanternLevel(sunElevation(1))).toBeGreaterThan(lanternLevel(sunElevation(0)));
    expect(starLevel(sunElevation(1))).toBe(1);
    const [x, y, z] = sunDirection(0.1);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1);
  });
});

describe('chip log', () => {
  const slices = generateDemoDays(3);

  it('drops only the heartbeats the clock has reached, newest just astern', () => {
    const noon = 12 * 60;
    const markers = chipLogMarkers(slices, noon, 51);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every((marker) => marker.age >= 0)).toBe(true);
    const newest = markers.reduce((a, b) => (a.age < b.age ? a : b));
    expect(newest.x).toBeLessThanOrEqual(STERN_X - DROP_OFFSET);
    expect(markers.every((marker) => marker.lantern >= 0 && marker.lantern < 51)).toBe(true);
    // Earlier days float further back: history is never trimmed.
    const yesterday = slices.find((slice) => slice.day === 1);
    if (yesterday) expect(sliceAge(yesterday, noon)).toBeGreaterThan(24 * 60 - 16 * 60);
  });

  it('knows the heartbeat that is due at the hand', () => {
    const first = slices.find((slice) => slice.day === 0);
    expect(first).toBeDefined();
    if (!first) return;
    expect(latestDrop(slices, first.minute + 1)?.minute).toBe(first.minute);
    expect(latestDrop(slices, 0)).toBeUndefined();
    expect(lanternFor(first, 0)).toBe(-1);
  });
});

describe('focus and wind', () => {
  it('raises the focused kind and calls the fog in for unattributed', () => {
    expect(focusTargets('all')).toEqual({ human: 1, ai: 1, fog: 0 });
    expect(focusTargets('human').human).toBeGreaterThan(1);
    expect(focusTargets('ai').ai).toBeGreaterThan(focusTargets('ai').human);
    expect(focusTargets('unattributed').fog).toBe(1);
    expect(windVisibility(0)).toBe(0);
    expect(windVisibility(3)).toBe(1);
    expect(windVisibility(5)).toBe(0);
  });
});

describe('rig plan', () => {
  it('rigs three masts with yards, sails and ropes between real points', () => {
    expect(MASTS).toHaveLength(3);
    expect(buildYards()).toHaveLength(9);
    const sails = buildSails();
    expect(sails.filter((sail) => sail.kind === 'square').length).toBe(8);
    expect(sails.filter((sail) => sail.kind === 'fore-and-aft').length).toBe(3);
    const { ratlines, ropes } = buildRigging();
    expect(ropes.length).toBeGreaterThan(40);
    expect(ratlines.length).toBeGreaterThan(50);
    for (const rope of [...ropes, ...ratlines]) {
      expect([...rope.from, ...rope.to].every(Number.isFinite)).toBe(true);
    }
  });
});

describe('archipelago', () => {
  it('puts every island in the right half of the map view, apart from each other', () => {
    for (const place of PLACES.filter((entry) => entry.building !== 'ship')) {
      const [x, z] = place.at;
      expect(Math.hypot(x - HOME_POSE.pos[0], z - HOME_POSE.pos[2])).toBeGreaterThan(80);
    }
    const [x, z] = fromMapView(0.5, 100);
    const [px, , pz] = HOME_POSE.pos;
    expect(Math.hypot(x - px, z - pz)).toBeCloseTo(100, -1);
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length);
  });

  it('frames each visit with the landmark ahead of the camera', () => {
    for (const place of PLACES) {
      const { look, pos } = visitPose(place);
      expect([...look, ...pos].every(Number.isFinite)).toBe(true);
      const [lx, ly, lz] = landmark(place);
      expect(Number.isFinite(lx + ly + lz)).toBe(true);
    }
    expect(placeById('lighthouse')?.sections).toEqual(['#tx-c1']);
    expect(placeById('nowhere')).toBeUndefined();
  });

  it('lofts islands with a beach at the waterline and a plateau for buildings', () => {
    const geometry = islandGeometry(14, 7);
    const position = geometry.getAttribute('position');
    let top = -Infinity;
    for (let index = 0; index < position.count; index += 1)
      top = Math.max(top, position.getY(index));
    expect(top).toBeGreaterThanOrEqual(PLATEAU);
    expect(geometry.getAttribute('color').count).toBe(position.count);
    geometry.dispose();
  });

  it('keeps hotspot labels from overlapping', () => {
    const element = document.createElement('li');
    const boxes = separate([
      { element, x: 0, y: 0, width: 100, height: 30 },
      { element, x: 20, y: 10, width: 100, height: 30 },
      { element, x: 400, y: 10, width: 100, height: 30 },
    ]);
    const [a, b, c] = boxes;
    expect(b?.y).toBeGreaterThanOrEqual((a?.y ?? 0) + 30);
    expect(c?.y).toBe(10);
  });
});

function homepage() {
  const site = document.createElement('div');
  site.className = 'wakaclock-marketing';
  site.setAttribute('lang', 'en');
  site.innerHTML = `
    <div id="tx-experience">
      <div class="tx-chapters">
        <section id="tx-c0"><h1>Hero</h1></section>
        <section id="tx-c1"><h2 id="tx-beat-title">Every Second Tells a Story.</h2><a href="#faq">faq</a></section>
        <section id="tx-c5"><h2 id="tx-begin-title">Begin</h2></section>
      </div>
    </div>
    <div class="tx-day">
      <section id="faq"><h2>Frequently asked questions</h2><p id="faq-answer">A</p></section>
    </div>`;
  document.body.append(site);
  return site;
}

describe('world mode', () => {
  it('tags sections with their places and labels hotspots from the page', () => {
    const site = homepage();
    const { container, unmount } = render(<WorldMode rootId="tx-experience" />);
    expect(site.dataset.world).toBe('on');
    expect(timeMotion.world).toBe(true);
    expect(site.querySelector('#tx-c1')?.getAttribute('data-world-place')).toBe('lighthouse');
    expect(site.querySelector('#tx-c0')?.getAttribute('data-world-place')).toBe('home');
    expect(site.querySelector('#tx-c0')?.hasAttribute('data-world-open')).toBe(true);
    const lighthouse = container.querySelector('[data-hotspot="lighthouse"] button');
    expect(lighthouse?.textContent).toContain('Every Second Tells a Story.');
    // Far islands link to the existing pages.
    expect(container.querySelector('[data-hotspot="far-docs"] a')?.getAttribute('href')).toBe(
      '/docs'
    );
    unmount();
    expect(site.dataset.world).toBeUndefined();
    expect(timeMotion.world).toBe(false);
  });

  it('opens a place once the camera has had time to arrive, and closes it with Escape', () => {
    vi.useFakeTimers();
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    act(() => {
      (container.querySelector('[data-hotspot="lighthouse"] button') as HTMLButtonElement).click();
    });
    // In flight: the camera is on its way, nothing is open yet.
    expect(timeMotion.tour).toBe(tourIndex('lighthouse'));
    expect(site.dataset.worldOpen).toBe('travel');
    expect(timeMotion.place).toBe('');
    expect(site.querySelector('#tx-c0')?.hasAttribute('data-world-open')).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(site.dataset.worldOpen).toBe('lighthouse');
    expect(timeMotion.place).toBe('lighthouse');
    expect(site.querySelector('#tx-c1')?.hasAttribute('data-world-open')).toBe(true);
    expect(container.querySelector('.tx-world-close')).not.toBeNull();

    act(() => {
      (site.querySelector('a[href="#faq"]') as HTMLAnchorElement).click();
      vi.advanceTimersByTime(1600);
    });
    expect(site.dataset.worldOpen).toBe('tavern');
    expect(timeMotion.tour).toBe(tourIndex('tavern'));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(site.dataset.worldOpen).toBe('');
    expect(timeMotion.tour).toBe(0);
    expect(site.querySelector('#tx-c0')?.hasAttribute('data-world-open')).toBe(true);
    vi.useRealTimers();
  });

  it('scrolls along the tour, locks onto the nearest stop and opens it', () => {
    vi.useFakeTimers();
    const site = homepage();
    render(<WorldMode rootId="tx-experience" />);
    const wheel = (deltaY: number) =>
      act(() => {
        window.dispatchEvent(new WheelEvent('wheel', { deltaY }));
      });
    // A nudge that does not commit falls back to the map.
    wheel(40);
    expect(timeMotion.tour).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(timeMotion.tour).toBe(0);
    expect(site.dataset.worldOpen).toBe('');

    // A real scroll leaves the map, flies on and opens the first stop.
    wheel(300);
    expect(site.dataset.worldOpen).toBe('travel');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(timeMotion.tour).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(site.dataset.worldOpen).toBe(TOUR[0]);

    // Keys step one stop at a time and stay inside the tour.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    });
    expect(timeMotion.tour).toBe(2);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(timeMotion.tour).toBe(TOUR.length);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    });
    expect(timeMotion.tour).toBe(0);
    expect(site.dataset.worldOpen).toBe('');
    vi.useRealTimers();
  });

  it('visits every place that holds sections, in page order, and keeps the camera clear', () => {
    expect(tourIndex('')).toBe(0);
    expect(tourStop(0)).toBe('');
    expect(tourStop(1)).toBe(TOUR[0]);
    expect(tourStop(99)).toBe(TOUR.at(-1));
    const reading = PLACES.filter((place) => place.sections.length > 0).map((place) => place.id);
    expect([...TOUR].sort()).toEqual([...reading].sort());
    const keys = tourKeys();
    expect(keys).toHaveLength(TOUR.length + 1);
    expect(keys[0]?.pos).toEqual(HOME_POSE.pos);
    // No visiting camera stands on a neighbouring island.
    for (const [index, id] of TOUR.entries()) {
      const key = keys[index + 1] as (typeof keys)[number];
      for (const other of PLACES) {
        if (other.id === id || other.building === 'ship') continue;
        const gap = Math.hypot(key.pos[0] - other.at[0], key.pos[2] - other.at[1]);
        expect(gap, `${id} camera over ${other.id}`).toBeGreaterThan(placeRadius(other));
      }
    }
  });

  it('does nothing without its story root', () => {
    const { container } = render(<WorldMode rootId="missing" />);
    expect(container.querySelectorAll('[data-hotspot]')).toHaveLength(0);
    expect(timeMotion.world).toBe(false);
  });
});

describe('hotspot reachability', () => {
  function mapCamera(width: number, height: number) {
    const camera = new PerspectiveCamera(38, width / height, 0.1, 4000);
    const pos = new Vector3(...HOME_POSE.pos);
    const look = new Vector3(...HOME_POSE.look);
    // The rig steps back along the line of sight on portrait screens.
    if (width < height) pos.addScaledVector(pos.clone().sub(look), 0.32);
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    return camera;
  }

  it.each([
    [1440, 900],
    [768, 1024],
    [375, 812],
  ])('keeps every place on screen and inside the margins at %ix%i', (width, height) => {
    const camera = mapCamera(width, height);
    const edges: string[] = [];
    for (const place of PLACES) {
      const point = new Vector3(...landmark(place)).project(camera);
      const spot = hotspotPosition(point.x, point.y, point.z > 1, width, height);
      expect(spot.x).toBeGreaterThanOrEqual(HOTSPOT_BOUNDS.side);
      expect(spot.x).toBeLessThanOrEqual(width - HOTSPOT_BOUNDS.side);
      expect(spot.y).toBeGreaterThanOrEqual(HOTSPOT_BOUNDS.top);
      expect(spot.y).toBeLessThanOrEqual(height - HOTSPOT_BOUNDS.bottom);
      if (spot.edge) edges.push(place.id);
    }
    // On a desktop frame the whole archipelago is in view; narrower screens use the edges.
    if (width > height) expect(edges).toEqual([]);
  });

  it('sends markers behind the camera to the side they are on', () => {
    expect(hotspotPosition(0.4, 0, true, 800, 600).edge).toBe('left');
    expect(hotspotPosition(-0.4, 0, true, 800, 600).edge).toBe('right');
  });

  it('returns keyboard focus to the place that was just read', () => {
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    const button = container.querySelector(
      '[data-hotspot="lighthouse"] button'
    ) as HTMLButtonElement;
    site.append(container);
    vi.useFakeTimers();
    act(() => {
      button.click();
      vi.advanceTimersByTime(1600);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.activeElement).toBe(button);
    vi.useRealTimers();
  });
});

describe('place effects', () => {
  it('runs a clock only for the place that is open', () => {
    resetVoyage();
    expect(placeFx('lighthouse')).toEqual({ age: 99, on: 0 });
    voyage.fxPlace = 'lighthouse';
    voyage.fxAge = 1;
    voyage.fxOn = 0.5;
    expect(placeFx('lighthouse')).toEqual({ age: 1, on: 0.5 });
    expect(placeFx('tavern')).toEqual({ age: 99, on: 0 });
    resetVoyage();
  });

  it('bursts right after opening and has faded when its time is up', () => {
    expect(fxBurst(0)).toBe(0);
    expect(fxBurst(0.3)).toBeGreaterThan(0.5);
    expect(fxBurst(2.5)).toBeLessThan(fxBurst(0.5));
    expect(fxBurst(3)).toBe(0);
    expect(fxBurst(9, 4)).toBe(0);
  });

  it('spaces the rings evenly through their cycle', () => {
    expect(ringPhase(0, 2, 0, 4)).toBe(0);
    expect(ringPhase(0, 2, 1, 4)).toBeCloseTo(0.25);
    expect(ringPhase(1, 2, 0, 4)).toBeCloseTo(0.5);
    expect(ringPhase(-0.5, 2, 0, 4)).toBeCloseTo(0.75);
  });
});
