/** Stable, independently seeded traits keep each coworker's character recognizable. */
import type {
  SpriteAccessory,
  SpriteAppearance,
  SpriteHairStyle,
  SpriteOutfit,
} from '@/types/sprite';

export type {
  SpriteAccessory,
  SpriteAppearance,
  SpriteHairStyle,
  SpriteOutfit,
} from '@/types/sprite';

const SHIRT_PALETTE = [
  '#568be0',
  '#de7767',
  '#9980d9',
  '#53a894',
  '#e1ad52',
  '#cd83aa',
  '#789aaa',
  '#b87e57',
] as const;
const SKIN_PALETTE = ['#f5d1b4', '#e9b48e', '#ca8f68', '#a96e4e', '#794e3c', '#d9a47e'] as const;
const HAIR_PALETTE = ['#302c39', '#654236', '#c58b47', '#d9d9e6', '#8a4c47', '#424c68'] as const;
const ACCENT_PALETTE = ['#f1ba65', '#a6e2d1', '#f09ebc', '#9fc5fc', '#e7ddc7'] as const;
const HAIR_STYLES: SpriteHairStyle[] = ['swept', 'curls', 'bob', 'bun', 'spiky'];
const ACCESSORIES: SpriteAccessory[] = ['headset', 'glasses', 'cap', 'beanie', 'none'];
const OUTFITS: SpriteOutfit[] = ['hoodie', 'jacket', 'overalls'];

function hashUserId(userId: string): number {
  let hash = 2_166_136_261;
  for (const char of userId) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16_777_619) >>> 0;
  }
  return hash;
}

function trait<T>(userId: string, name: string, choices: readonly T[]): T {
  return choices[hashUserId(`${userId}:${name}`) % choices.length];
}

export function shirtColorFor(userId: string): string {
  return trait(userId, 'shirt', SHIRT_PALETTE);
}

export function appearanceFor(userId: string): SpriteAppearance {
  return {
    accentColor: trait(userId, 'accent', ACCENT_PALETTE),
    accessory: trait(userId, 'accessory', ACCESSORIES),
    hairColor: trait(userId, 'hair', HAIR_PALETTE),
    hairStyle: trait(userId, 'style', HAIR_STYLES),
    outfit: trait(userId, 'outfit', OUTFITS),
    shirtColor: shirtColorFor(userId),
    skinColor: trait(userId, 'skin', SKIN_PALETTE),
  };
}
