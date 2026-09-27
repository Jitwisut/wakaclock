/**
 * The choreography of the experience, expressed against one number: the story position
 * `g`, which runs 0 → 6 as the visitor scrolls through the six chapters.
 *
 * Everything the scene does is a function of `g`, so scrolling back up replays the story
 * in reverse and a reload at any scroll position lands on the right composition.
 *
 * Geometry states (the `stage` value the shader reads):
 *   0 latent  — the marks folded tight around one axis: the work you cannot see
 *   1 spiral  — each ring one day, each mark one duration block, projects as strata
 *   2 split   — human inner, AI agents outer, Unattributed between, still time-aligned
 *   3 flat    — the spiral unrolled into lanes: the activity timeline
 *   4 dial    — every day laid out as rings on one calm plane: the bigger picture
 */

type Key = readonly [g: number, value: number];

/** Piecewise hold-and-ease: values rest on each key and ease between them. */
function track(keys: readonly Key[], g: number) {
  if (g <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index += 1) {
    const [g1, v1] = keys[index];
    if (g <= g1) {
      const [g0, v0] = keys[index - 1];
      const t = (g - g0) / (g1 - g0);
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      return v0 + (v1 - v0) * eased;
    }
  }
  return keys.at(-1)![1];
}

const STAGE: readonly Key[] = [
  [0, 0],
  [0.45, 0],
  [1.35, 1],
  [2.15, 1],
  [2.75, 2],
  [3.05, 2],
  [3.5, 3],
  [5, 3],
  [5.55, 4],
];

/** 0 = ivory daylight, 1 = forest dusk. The Human + AI chapter happens at dusk. */
const DUSK: readonly Key[] = [
  [0, 0],
  // Finished before chapter 3's heading is in reading position, so text never sits on
  // the half-way tone where neither the light nor the dark ink has contrast.
  [1.62, 0],
  [1.9, 1],
  [2.95, 1],
  [3.3, 0],
];

/** How strongly the kind colours show; before the split every mark shares one ink. */
const KIND_MIX: readonly Key[] = [
  [0, 0],
  [2.1, 0],
  [2.5, 1],
];

/** Scene presence. It recedes behind the product chapter so the interface leads. */
const PRESENCE: readonly Key[] = [
  [0, 1],
  [3.8, 1],
  [4.1, 0.16],
  [5, 0.16],
  [5.35, 0.72],
];

export function sceneStateAt(g: number) {
  return {
    stage: track(STAGE, g),
    dusk: track(DUSK, g),
    kindMix: track(KIND_MIX, g),
    presence: track(PRESENCE, g),
  };
}

/**
 * Camera compositions. Each chapter has an intentional framing; between them the camera
 * travels along a Catmull-Rom spline through these points. `g` values are where the
 * camera comes to rest, and the easing makes it settle rather than drift at constant speed.
 */
export const CAMERA_KEYS: readonly {
  g: number;
  look: readonly [number, number, number];
  pos: readonly [number, number, number];
}[] = [
  // 01 — a monolith, seen low and slightly off-axis, set to the right of the headline.
  { g: 0, pos: [1.6, 0.2, 8.8], look: [-1.55, 0.35, 0] },
  // 02 — the spiral opens; the camera steps inside it so the timeline forms around you.
  { g: 1.15, pos: [3.4, 1.6, 6.4], look: [-0.9, 0.1, 0] },
  { g: 1.85, pos: [2.9, 1.3, 6.4], look: [-1.9, 0.2, -0.4] },
  // 03 — pulled back at dusk to see both systems side by side.
  { g: 2.6, pos: [0.4, 4.8, 12.2], look: [-1.9, -0.2, 0] },
  { g: 3, pos: [0.2, 5.6, 11.2], look: [-1.7, -0.3, 0] },
  // 04 — square to the unrolled timeline, then closing in as it becomes the interface.
  { g: 3.45, pos: [0, 0.1, 11.5], look: [0, 0, 0] },
  { g: 3.8, pos: [0, 0.05, 8.4], look: [0, 0.05, 0] },
  // 05 — the scene recedes behind the product.
  { g: 4.9, pos: [0, 3.2, 14], look: [0, 0, -2] },
  // 06 — the whole fortnight from above: calm, centred, one message.
  { g: 5.6, pos: [0, 16.5, 3.4], look: [0, -0.4, 0.2] },
  { g: 6, pos: [0, 17.5, 3], look: [0, -0.4, 0.2] },
];

/** Maps `g` onto the spline parameter so the camera rests on each key. */
export function cameraParameterAt(g: number) {
  const last = CAMERA_KEYS.length - 1;
  if (g <= CAMERA_KEYS[0].g) return 0;
  for (let index = 1; index <= last; index += 1) {
    const current = CAMERA_KEYS[index];
    if (g <= current.g) {
      const previous = CAMERA_KEYS[index - 1];
      const t = (g - previous.g) / (current.g - previous.g);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      return (index - 1 + eased) / last;
    }
  }
  return 1;
}

export function chapterAt(g: number) {
  return Math.min(5, Math.max(0, Math.floor(g + 0.35)));
}
