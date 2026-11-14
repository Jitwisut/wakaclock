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
import {
  courseAt,
  courseXZ,
  focusTargets,
  fxLevel,
  weatherAt,
  WELCOME_LEVEL,
  windVisibility,
} from '@/components/marketing/time/voyage/director';
import {
  HOTSPOT_BOUNDS,
  hotspotPosition,
  separate,
  spyglassAmount,
} from '@/components/marketing/time/voyage/hotspot-projector';
import { STERN_X } from '@/components/marketing/time/voyage/hull';
import { islandGeometry, PLATEAU } from '@/components/marketing/time/voyage/islands';
import { ringPhase } from '@/components/marketing/time/voyage/place-fx';
import { dolphinLeap, routeGeometry } from '@/components/marketing/time/voyage/sea-life';
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
  keepOffIslands,
  landmark,
  mooring,
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

  it("shows a place's title card on arrival and opens its panel on click", () => {
    vi.useFakeTimers();
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    act(() => {
      (container.querySelector('[data-hotspot="lighthouse"] button') as HTMLButtonElement).click();
    });
    // Arrived: the title card speaks for the place; nothing is open until it is asked for.
    expect(timeMotion.tourTarget).toBe(tourIndex('lighthouse'));
    expect(site.dataset.worldOpen).toBe('travel');
    expect(site.dataset.worldAt).toBe('lighthouse');
    expect(timeMotion.place).toBe('');
    expect(site.querySelector('#tx-c0')?.hasAttribute('data-world-open')).toBe(false);
    const card = container.querySelector('.tx-world-card');
    expect(card?.textContent).toContain('Every Second Tells a Story.');
    act(() => {
      (container.querySelector('.tx-world-card-open') as HTMLButtonElement).click();
    });
    expect(site.dataset.worldOpen).toBe('lighthouse');
    expect(timeMotion.place).toBe('lighthouse');
    expect(site.querySelector('#tx-c1')?.hasAttribute('data-world-open')).toBe(true);
    expect(container.querySelector('.tx-world-card')).toBeNull();
    expect(container.querySelector('.tx-world-close')).not.toBeNull();

    // An in-page link sails to its place and opens it once the camera has arrived.
    act(() => {
      (site.querySelector('a[href="#faq"]') as HTMLAnchorElement).click();
    });
    expect(timeMotion.tourTarget).toBe(tourIndex('tavern'));
    expect(site.dataset.worldOpen).toBe('travel');
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(site.dataset.worldOpen).toBe('tavern');

    // Escape steps back one level at a time: the panel, then the island.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(site.dataset.worldOpen).toBe('travel');
    expect(site.dataset.worldAt).toBe('tavern');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(site.dataset.worldOpen).toBe('');
    expect(timeMotion.tourTarget).toBe(0);
    expect(site.querySelector('#tx-c0')?.hasAttribute('data-world-open')).toBe(true);
    vi.useRealTimers();
  });

  it('scrolls along the tour and locks onto the nearest stop', () => {
    vi.useFakeTimers();
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    const wheel = (deltaY: number, target: EventTarget = window) =>
      act(() => {
        target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY }));
      });
    // A nudge that does not commit falls back to the map.
    wheel(120);
    expect(timeMotion.tourTarget).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(timeMotion.tourTarget).toBe(0);
    expect(site.dataset.worldOpen).toBe('');

    // A real scroll leaves the map, sails on and brings up the first stop's card.
    wheel(1300);
    expect(site.dataset.worldOpen).toBe('travel');
    expect(site.dataset.worldAt).toBe('');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(timeMotion.tourTarget).toBe(1);
    expect(site.dataset.worldAt).toBe(TOUR[0]);

    // With the panel open, scrolling over it reads it; it never sails away.
    act(() => {
      (container.querySelector('.tx-world-card-open') as HTMLButtonElement).click();
    });
    wheel(4000, site.querySelector('#tx-c1') as HTMLElement);
    expect(timeMotion.tourTarget).toBe(1);
    expect(site.dataset.worldOpen).toBe(TOUR[0]);
    // Scrolling the scene beside it does.
    wheel(1500);
    expect(site.dataset.worldOpen).toBe('travel');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(timeMotion.tourTarget).toBe(2);

    // Keys step one stop at a time and stay inside the tour.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    });
    expect(timeMotion.tourTarget).toBe(3);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(timeMotion.tourTarget).toBe(TOUR.length);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    });
    expect(timeMotion.tourTarget).toBe(0);
    expect(site.dataset.worldOpen).toBe('');
    vi.useRealTimers();
  });

  it('offers the stops on the compass', () => {
    homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    const stops = [...container.querySelectorAll<HTMLButtonElement>('.tx-world-compass li button')];
    // One per place of the tour that this page has a heading for.
    const places = container.querySelectorAll('.tx-world-hotspots button');
    expect(stops.length).toBe(places.length);
    expect(stops[0]?.getAttribute('aria-label')).toBe('Every Second Tells a Story.');
    act(() => stops[0]?.click());
    expect(timeMotion.tourTarget).toBe(tourIndex('lighthouse'));
    act(() => (container.querySelector('.tx-world-compass-home') as HTMLButtonElement).click());
    expect(timeMotion.tourTarget).toBe(0);
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
    // Places behind the camera or beside the frame wait at the edge; none is ever lost.
    expect(edges.length).toBeLessThanOrEqual(PLACES.length);
  });

  it('sends markers behind the camera to the side they are on', () => {
    expect(hotspotPosition(0.4, 0, true, 800, 600).edge).toBe('left');
    expect(hotspotPosition(-0.4, 0, true, 800, 600).edge).toBe('right');
  });

  it('returns keyboard focus to the button that opened the panel', () => {
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    site.append(container);
    act(() => {
      (container.querySelector('[data-hotspot="lighthouse"] button') as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector('.tx-world-card-open') as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector('.tx-world-close') as HTMLButtonElement).click();
    });
    expect(document.activeElement).toBe(container.querySelector('.tx-world-card-open'));
  });
});

describe('the voyage', () => {
  it('moors the ship off every stop, clear of every island', () => {
    for (const key of tourKeys()) {
      for (const place of PLACES) {
        if (place.building === 'ship') continue;
        const gap = Math.hypot(key.moor[0] - place.at[0], key.moor[1] - place.at[1]);
        expect(gap).toBeGreaterThan(placeRadius(place));
      }
    }
    expect(mooring(placeById('ship') as (typeof PLACES)[number])).toEqual([0, 0]);
    const lighthouse = placeById('lighthouse') as (typeof PLACES)[number];
    const [x, z] = keepOffIslands(lighthouse.at[0], lighthouse.at[1]);
    expect(Math.hypot(x - lighthouse.at[0], z - lighthouse.at[1])).toBeGreaterThan(
      placeRadius(lighthouse)
    );
  });

  it('sails a smooth course through the moorings', () => {
    const values = [0, 10, 30, 20];
    expect(courseAt(values, 0)).toBe(0);
    expect(courseAt(values, 1)).toBe(10);
    expect(courseAt(values, 3)).toBe(20);
    expect(courseAt(values, 9)).toBe(20);
    const mid = courseAt(values, 1.5);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(30);
  });

  it("blends each place's weather along the tour", () => {
    expect(weatherAt(0)).toEqual({ aurora: 0, meteors: 0, mist: 0, rain: 0 });
    expect(weatherAt(tourIndex('lighthouse'))).toEqual({ aurora: 0, meteors: 0, mist: 0, rain: 0 });
    expect(weatherAt(tourIndex('tavern')).mist).toBe(1);
    expect(weatherAt(tourIndex('twinlights')).aurora).toBe(1);
    expect(weatherAt(tourIndex('dock')).rain).toBe(1);
    const between = weatherAt(tourIndex('twinlights') - 0.5);
    expect(between.aurora).toBeCloseTo(0.5);
  });

  it('welcomes an arrival quietly and plays in full once the panel is open', () => {
    expect(fxLevel('', '', '')).toBe(0);
    expect(fxLevel('', 'tavern', 'tavern')).toBe(WELCOME_LEVEL);
    expect(fxLevel('tavern', '', 'tavern')).toBe(1);
    expect(fxLevel('', '', 'tavern')).toBe(0);
    expect(WELCOME_LEVEL).toBeLessThan(1);
  });

  it('draws the route along the whole course and lets the dolphins leap', () => {
    const route = routeGeometry(40);
    const along = route.getAttribute('along');
    expect(along.count).toBe(41 * 2);
    expect(along.getX(0)).toBe(0);
    expect(along.getX(along.count - 1)).toBeCloseTo(TOUR.length);
    route.dispose();
    expect(courseXZ(0)).toEqual([0, 0]);
    expect(dolphinLeap(0.6).y).toBeGreaterThan(1);
    expect(dolphinLeap(2.5).y).toBeLessThan(0);
    expect(dolphinLeap(-0.2).y).toBeLessThan(0);
  });

  it('opens the sea chart from the compass and leaves it on a jump', () => {
    const site = homepage();
    const { container } = render(<WorldMode rootId="tx-experience" />);
    const chart = container.querySelector('.tx-world-compass-chart') as HTMLButtonElement;
    act(() => chart.click());
    expect(site.dataset.worldChart).toBe('on');
    expect(timeMotion.chart).toBe(true);
    // The hero steps aside for the chart.
    expect(site.dataset.worldOpen).toBe('travel');
    act(() => {
      (container.querySelector('[data-hotspot="lighthouse"] button') as HTMLButtonElement).click();
    });
    expect(site.dataset.worldChart).toBe('off');
    expect(site.dataset.worldAt).toBe('lighthouse');
    expect(timeMotion.at).toBe('lighthouse');
    // Reading a place flies its flag and ticks it on the compass.
    act(() => {
      (container.querySelector('.tx-world-card-open') as HTMLButtonElement).click();
    });
    expect(timeMotion.visited).toBe('lighthouse');
    expect(container.querySelectorAll('.tx-world-compass [data-visited]')).toHaveLength(1);
  });

  it('closes the spyglass only while nearing a stop', () => {
    expect(spyglassAmount(0.3, 1)).toBe(0);
    expect(spyglassAmount(0.8, 1)).toBeGreaterThan(0.9);
    expect(spyglassAmount(1, 1)).toBe(0);
    // Leaving a stop, or lying at one, the view stays open.
    expect(spyglassAmount(1.2, 2)).toBe(0);
    expect(spyglassAmount(0.2, 0)).toBe(0);
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
