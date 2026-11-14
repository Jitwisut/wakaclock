import { LANDMARK_HEIGHT, LINE_GAP, lineY, STOP_GAP, stopBase } from '../editor/file-plan';

/**
 * The archipelago (owner decision 2026-11-14): the homepage as a world of places around the
 * ship. Each place opens existing homepage sections in a reading panel, or — for the far
 * islands — links to an existing page. Labels are read from the page's own headings and
 * nav links at runtime, so the world adds no copy of its own.
 */

export type Building =
  | 'clocktower'
  | 'dock'
  | 'far'
  | 'library'
  | 'lighthouse'
  | 'market'
  | 'ship'
  | 'signal'
  | 'tavern'
  | 'trading'
  | 'twinlights';

export type Vec3 = [number, number, number];

/** The sky a place keeps: clear, sea mist, a drizzle, the aurora or shooting stars. */
export type Weather = 'aurora' | 'clear' | 'meteors' | 'mist' | 'rain';

/**
 * Islands are built at their plan size and drawn this much larger, so the landmarks read
 * clearly from the map. `radius` and `height` below are the plan size; use `placeRadius` and
 * `placeHeight` for the size in the world.
 */
export const ISLAND_SCALE = 1.3;

export function placeRadius(place: Place) {
  return place.building === 'ship' ? place.radius : place.radius * ISLAND_SCALE;
}

export function placeHeight(place: Place) {
  return place.building === 'ship' ? place.height : place.height * ISLAND_SCALE;
}

export interface Place {
  /** Metres the visiting camera's subject sits out from the island's centre, toward the ship. */
  aim?: number;
  /** Island centre on the water (x, z). The ship lies at the origin. */
  at: [number, number];
  building: Building;
  /** Time of day while here, 0 golden hour → 1 midnight (drives sun and lanterns). */
  dusk: number;
  /** Height of the landmark: where the hotspot sits and the camera looks. */
  height: number;
  /** For far islands: the existing page this island links to. */
  href?: string;
  id: string;
  /** Where the label text comes from: a heading in the page. */
  labelFrom?: string;
  /** Island radius in metres (0 for the ship). */
  radius: number;
  /** Elements this place opens (selectors, all inside one homepage container). */
  sections: readonly string[];
  /** How far back the visiting camera stands, as a multiple of the usual distance. */
  stand?: number;
  /**
   * Angle (radians) the visiting camera swings round from the line to the ship. Chosen per
   * place so that no neighbouring island stands between the camera and its landmark.
   */
  swing?: number;
  /** The weather over this place (clear when absent). */
  weather?: Weather;
}

/** The view of the whole archipelago with the ship in front: the hero's composition. */
export const HOME_POSE: { look: Vec3; pos: Vec3 } = { pos: [-24, 13, 30], look: [12, -5, -44] };
/** The whole file from above: the camera high over its middle, tilted a little. */
export const CHART_POSE: { look: Vec3; pos: Vec3 } = {
  pos: [2, 930, -STOP_GAP * 3.7],
  look: [2, 0, -STOP_GAP * 5.55],
};
/** Time of day on the map view: late golden hour. */
export const HOME_DUSK = 0.3;
/** Horizontal field of view of the map camera (38° vertical at 16:10). */
const HOME_HALF_FOV = Math.atan(Math.tan((19 * Math.PI) / 180) * 1.6);

/**
 * Lays an island out from the map view: `screenX` (0 left → 1 right) and its distance from
 * the camera. Every place sits in the right half, so the hero copy on the left stays clear
 * and the archipelago reads as one view behind the ship.
 */
export function fromMapView(screenX: number, distance: number): [number, number] {
  const [px, , pz] = HOME_POSE.pos;
  const [lx, , lz] = HOME_POSE.look;
  const length = Math.hypot(lx - px, lz - pz);
  const vx = (lx - px) / length;
  const vz = (lz - pz) / length;
  // Right-hand vector on the water plane for a camera looking along (vx, vz).
  const rx = -vz;
  const rz = vx;
  const offset = Math.atan((screenX - 0.5) * 2 * Math.tan(HOME_HALF_FOV));
  const dx = Math.cos(offset) * vx + Math.sin(offset) * rx;
  const dz = Math.cos(offset) * vz + Math.sin(offset) * rz;
  return [Math.round(px + dx * distance), Math.round(pz + dz * distance)];
}

const PLAN: readonly Place[] = [
  {
    id: 'ship',
    building: 'ship',
    at: [0, 0],
    radius: 0,
    height: 12,
    sections: ['#tx-c5'],
    labelFrom: '#tx-begin-title',
    dusk: 0.55,
  },
  {
    id: 'lighthouse',
    building: 'lighthouse',
    at: fromMapView(0.68, 118),
    radius: 15,
    height: 24,
    sections: ['#tx-c1'],
    labelFrom: '#tx-beat-title',
    swing: 0.9,
    dusk: 0.52,
  },
  {
    id: 'clocktower',
    building: 'clocktower',
    at: fromMapView(0.58, 195),
    radius: 17,
    height: 26,
    sections: ['#tx-c2'],
    labelFrom: '#tx-ring-title',
    dusk: 0.3,
  },
  {
    id: 'twinlights',
    building: 'twinlights',
    at: fromMapView(0.76, 270),
    radius: 15,
    height: 15,
    sections: ['#tx-c3'],
    labelFrom: '#tx-ai-title',
    swing: 1.3,
    weather: 'aurora',
    dusk: 0.6,
  },
  {
    id: 'market',
    building: 'market',
    at: fromMapView(0.93, 325),
    radius: 22,
    height: 12,
    sections: ['#tx-c4'],
    labelFrom: '#tx-product-title',
    swing: 1.2,
    dusk: 0.35,
  },
  {
    id: 'dock',
    building: 'dock',
    at: fromMapView(0.955, 190),
    radius: 14,
    height: 12,
    sections: ['#quick-start'],
    labelFrom: '#quick-start h2',
    // Round to the slipway side, clear of the crane's mast.
    stand: 1.2,
    swing: -0.35,
    weather: 'rain',
    dusk: 0.42,
  },
  {
    id: 'library',
    building: 'library',
    at: fromMapView(0.5, 300),
    radius: 18,
    height: 22,
    sections: ['.axis-briefing', '.axis-evidence', '#answer-guide'],
    labelFrom: '#what-is-atoaxis h2',
    weather: 'meteors',
    dusk: 0.6,
  },
  {
    id: 'signal',
    building: 'signal',
    at: fromMapView(0.83, 156),
    radius: 12,
    height: 22,
    sections: ['#compare'],
    labelFrom: '#compare h2',
    stand: 1.15,
    swing: -0.3,
    dusk: 0.25,
  },
  {
    id: 'trading',
    building: 'trading',
    at: fromMapView(0.64, 375),
    radius: 18,
    height: 11,
    sections: ['#pricing', '.axis-cta'],
    labelFrom: '#pricing h2',
    swing: 0.1,
    dusk: 0.32,
  },
  {
    id: 'tavern',
    building: 'tavern',
    at: fromMapView(0.92, 240),
    radius: 16,
    height: 11,
    sections: ['#faq'],
    labelFrom: '#faq h2',
    swing: 1.1,
    weather: 'mist',
    dusk: 0.58,
  },
  {
    id: 'far-ai',
    building: 'far',
    at: fromMapView(0.56, 480),
    radius: 11,
    height: 12,
    sections: [],
    href: '/ai-coding-tracker',
    dusk: 0.3,
  },
  {
    id: 'far-analytics',
    building: 'far',
    at: fromMapView(0.74, 490),
    radius: 11,
    height: 12,
    sections: [],
    href: '/developer-analytics',
    dusk: 0.3,
  },
  {
    id: 'far-teams',
    building: 'far',
    at: fromMapView(0.9, 440),
    radius: 11,
    height: 12,
    sections: [],
    href: '/teams',
    dusk: 0.3,
  },
  {
    id: 'far-integrations',
    building: 'far',
    at: fromMapView(0.46, 560),
    radius: 11,
    height: 12,
    sections: [],
    href: '/integrations',
    dusk: 0.3,
  },
  {
    id: 'far-docs',
    building: 'far',
    at: fromMapView(0.82, 580),
    radius: 11,
    height: 12,
    sections: [],
    href: '/docs',
    dusk: 0.3,
  },
];

/** Far places (links to other pages) stand in the right margin, spaced down the file. */
const FAR_X = 44;

/**
 * The editor world's layout (owner decision 2026-11-15): every place of the tour stands in
 * the left margin of the file, level with the head of its block; the far places stand in the
 * right margin. The archipelago's own positions above are kept for the sea scene, which is no
 * longer mounted.
 */
function inEditor(place: Place): Place {
  const stop = TOUR_ORDER.indexOf(place.id) + 1;
  if (stop > 0) {
    const [x, , z] = stopBase(stop);
    return { ...place, at: [x, z] };
  }
  const far = PLAN.filter((entry) => entry.href).indexOf(place);
  return { ...place, at: [FAR_X, -(far * 2 + 2) * STOP_GAP] };
}

const TOUR_ORDER: readonly string[] = [
  'lighthouse',
  'clocktower',
  'twinlights',
  'market',
  'ship',
  'dock',
  'library',
  'signal',
  'trading',
  'tavern',
];

export const PLACES: readonly Place[] = PLAN.map((place) => inEditor(place));

export function placeById(id: string) {
  return PLACES.find((place) => place.id === id);
}

/**
 * The scroll tour: the map first, then every place that holds homepage sections, in the
 * order those sections appear in the page. Scrolling moves along it; far islands are links,
 * not stops.
 */
export const TOUR: readonly string[] = TOUR_ORDER;

/** Tour position of a place: 0 is the map, 1… are the stops. -1 for places off the tour. */
export function tourIndex(id: string) {
  return id ? TOUR.indexOf(id) + 1 : 0;
}

/** The place at a tour stop ('' for the map). */
export function tourStop(index: number) {
  return index <= 0 ? '' : (TOUR[Math.min(TOUR.length, index) - 1] ?? '');
}

/** Camera pose and time of day at each tour stop, the map first. */
export function tourKeys(): {
  center: Vec3;
  dusk: number;
  look: Vec3;
  /** Where the ship lies while this stop is visited (x, z). */
  moor: [number, number];
  pos: Vec3;
  weather: Weather;
}[] {
  return [
    { ...HOME_POSE, center: HOME_POSE.look, dusk: HOME_DUSK, moor: [0, 0], weather: 'clear' },
    ...TOUR.map((id) => {
      const place = placeById(id) as Place;
      return {
        ...visitPose(place),
        dusk: place.dusk,
        moor: mooring(place),
        weather: place.weather ?? 'clear',
      };
    }),
  ];
}

/**
 * Where the ship lies off a place: beside the island as the visiting camera sees it, on the
 * side the frame leaves open, a little beyond the landmark. The ship's own stop, and the
 * map, are her starting berth at the origin.
 */
export function mooring(place: Place): [number, number] {
  if (place.building === 'ship') return [0, 0];
  const { center, pos } = visitPose(place);
  const length = Math.hypot(center[0] - pos[0], center[2] - pos[2]) || 1;
  const viewX = (center[0] - pos[0]) / length;
  const viewZ = (center[2] - pos[2]) / length;
  const out = placeRadius(place) + 24;
  // Right of the view is (-viewZ, viewX); a few metres further from the camera.
  return keepOffIslands(
    place.at[0] - viewZ * out + viewX * 6,
    place.at[1] + viewX * out + viewZ * 6
  );
}

/** Pushes a point on the water out of every island's shallows (the ship never runs aground). */
export function keepOffIslands(x: number, z: number): [number, number] {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const place of PLACES) {
      if (place.building === 'ship') continue;
      const clear = placeRadius(place) * 1.2 + 12;
      const dx = px - place.at[0];
      const dz = pz - place.at[1];
      const distance = Math.hypot(dx, dz);
      if (distance >= clear) continue;
      const scale = clear / (distance || 1);
      px = place.at[0] + (distance ? dx : 1) * scale;
      pz = place.at[1] + dz * scale;
    }
  }
  return [px, pz];
}

/** Height of the ground at a place: the step its block starts on (0 for the far places). */
function groundAt(place: Place) {
  const stop = TOUR_ORDER.indexOf(place.id) + 1;
  return stop > 0 ? stopBase(stop)[1] : lineY(-place.at[1] / LINE_GAP);
}

/** The landmark's top: where the marker floats and the camera aims. */
export function landmark(place: Place): Vec3 {
  return [place.at[0], groundAt(place) + LANDMARK_HEIGHT, place.at[1]];
}

/**
 * Camera pose for visiting a place: approach from the ship's side, a little above, and
 * aim slightly right of the landmark so it sits on the left of the frame — clear of the
 * reading panel on the right.
 */
export function visitPose(place: Place): { center: Vec3; look: Vec3; pos: Vec3 } {
  const [x, z] = place.at;
  const ground = groundAt(place);
  // Behind and above the cursor's line, turned a little toward the landmark in the margin:
  // it fills the left of the frame and leaves the right for the title card and the panel.
  const pos: Vec3 = [24, ground + 21, z + 54];
  const look: Vec3 = [x + 22, ground + 9, z - 4];
  return { pos, look, center: [x, ground + LANDMARK_HEIGHT * 0.55, z] };
}

/** Which place an element belongs to (closest tagged ancestor), for in-page links. */
export const PLACE_ATTRIBUTE = 'data-world-place';
