export interface TimeSceneQuality {
  /** Film-style glow (post-processing). Desktop-class devices only. */
  bloom: boolean;
  /** Days drawn as rings, today included. */
  days: number;
  /** Upper bound for the device pixel ratio; the performance monitor may lower it. */
  maxDpr: number;
  /** Pointer parallax on the camera. Off for touch screens. */
  parallax: boolean;
  /** Heartbeat particles travelling around today's ring. */
  particles: number;
}

export const QUALITY_TIERS = {
  full: { bloom: true, days: 7, maxDpr: 1.75, particles: 180, parallax: true },
  low: { bloom: false, days: 5, maxDpr: 1.25, particles: 90, parallax: true },
  compact: { bloom: false, days: 4, maxDpr: 1.25, particles: 60, parallax: false },
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
