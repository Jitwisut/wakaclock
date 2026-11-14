/**
 * The Code Universe palette (owner decision 2026-11-14): a dark spatial void lit by two
 * energies. Cyan is human work, amber is AI-assisted work, structural metal is
 * unattributed — human and AI stay distinguishable by hue, and the scene also patterns
 * them differently.
 */
export const SCENE = {
  bg: '#05070b',
  ink: '#eef1f4',
  human: '#66d9f7',
  ai: '#e8a66a',
  unattributed: '#4a5562',
  highlight: '#d8f6ff',
} as const;

/** Physically based materials for the structures. */
export const MATERIALS = {
  /** Brushed titanium: the machined rings. */
  titanium: '#5d6672',
  /** Anodized dark aluminium: stabilisers, tunnel ribs. */
  aluminium: '#242b35',
  /** Rough ceramic: the outer shell fragments. */
  ceramic: '#151a21',
  /** Deep graphite: shards and housings. */
  graphite: '#10141b',
} as const;

/**
 * The page no longer turns to daylight below the story: the whole site lives in the void.
 * `DAY` keeps its shape for the components that still blend towards it, and equals the
 * night palette, so any blend is a no-op.
 */
export const DAY = { ...SCENE } as const;
