export interface TimeSceneQuality {
  /** Film-style glow (post-processing). Desktop-class devices only. */
  bloom: boolean;
  /** Days drawn as rings, today included. */
  days: number;
  /** Metal shards drifting around the core. */
  debris: number;
  /** Particles in a place's opening effect. */
  fxParticles: number;
  /** Upper bound on nodes per project cluster in the galaxy. */
  galaxyNodes: number;
  /** Extra island dressing (shore rocks, lamps, denser trees): 0 none → 1 full. */
  islandDetail: number;
  /** Upper bound for the device pixel ratio; the performance monitor may lower it. */
  maxDpr: number;
  /** Ocean grid resolution (segments per side); the grid is densest under the camera. */
  oceanSegments: number;
  /** Pointer parallax on the camera. Off for touch screens. */
  parallax: boolean;
  /** Heartbeat particles travelling around today's ring. */
  particles: number;
  /** Sun shadows from sails and rigging onto the deck. */
  shadows: boolean;
  /** Spray droplets off the bow. */
  spray: number;
  /** Streamers in the AI wind (chapter 04). */
  wind: number;
}

export const QUALITY_TIERS = {
  full: {
    bloom: true,
    days: 7,
    maxDpr: 2,
    fxParticles: 220,
    islandDetail: 1,
    particles: 180,
    parallax: true,
    debris: 70,
    galaxyNodes: 90,
    oceanSegments: 320,
    shadows: true,
    spray: 260,
    wind: 160,
  },
  low: {
    bloom: false,
    days: 5,
    maxDpr: 1.5,
    fxParticles: 140,
    islandDetail: 0.6,
    particles: 90,
    parallax: true,
    debris: 36,
    galaxyNodes: 50,
    oceanSegments: 220,
    shadows: false,
    spray: 150,
    wind: 90,
  },
  compact: {
    bloom: false,
    days: 4,
    maxDpr: 1.5,
    fxParticles: 90,
    islandDetail: 0.35,
    particles: 60,
    parallax: false,
    debris: 16,
    galaxyNodes: 30,
    oceanSegments: 170,
    shadows: false,
    spray: 90,
    wind: 50,
  },
} as const satisfies Record<string, TimeSceneQuality>;

export interface DeviceSignals {
  compact: boolean;
  cores: number | undefined;
  memory: number | undefined;
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
}

/**
 * Picks a tier from what the device reports. `null` means "show the still drawing": reduced
 * motion, data saver and missing WebGL never get a canvas. Phones still get the 3D scene,
 * lighter, as the visitor asked.
 */
export function chooseTimeQuality(signals: DeviceSignals): null | TimeSceneQuality {
  if (signals.reducedMotion || signals.saveData || !signals.webgl) return null;
  if (signals.compact) return QUALITY_TIERS.compact;
  const lowPower = (signals.memory ?? 8) <= 4 || (signals.cores ?? 8) <= 4;
  return lowPower ? QUALITY_TIERS.low : QUALITY_TIERS.full;
}

/** Reads the signals from the browser. Kept separate so the decision above stays pure. */
export function readDeviceSignals(): DeviceSignals {
  const nav = navigator as {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  } & typeof navigator;
  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return {
    compact: window.matchMedia('(max-width: 767px), (pointer: coarse)').matches,
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    webgl,
  };
}
