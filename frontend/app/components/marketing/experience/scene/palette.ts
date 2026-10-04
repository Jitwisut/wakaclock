import { Color } from 'three';

import { PALETTE } from './palette-tokens';

type Swatch = keyof (typeof PALETTE)['day'];

const DAY = Object.fromEntries(
  Object.entries(PALETTE.day).map(([key, value]) => [key, new Color(value)])
) as Record<Swatch, Color>;
const DUSK = Object.fromEntries(
  Object.entries(PALETTE.dusk).map(([key, value]) => [key, new Color(value)])
) as Record<Swatch, Color>;

/** Writes the blended swatch into `target` without allocating. */
export function blendSwatch(target: Color, swatch: Swatch, dusk: number) {
  return target.copy(DAY[swatch]).lerp(DUSK[swatch], dusk);
}
