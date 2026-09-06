/**
 * Per-user sprite appearance, derived only from the user id — the backend has no
 * avatar/appearance data (`toPresenceUser` gives id / username / status / position),
 * so the same person gets the same look every time without the server tracking one.
 * The ~10 "looks" are lifted from the PixelOffice reference workstations (blonde +
 * pink headset, dark curly, silver, spiky, backward cap, and so on).
 */
export interface SpriteAppearance {
  accentColor: string;
  accessory: SpriteAccessory;
  hairColor: string;
  shirtColor: string;
}

export type SpriteAccessory = 'cap' | 'headset' | 'none';

interface LookPreset {
  accentColor: string;
  accessory: SpriteAccessory;
  hairColor: string;
}

const SHIRT_PALETTE = [
  '#2e86de',
  '#e0342b',
  '#b24bf3',
  '#1e9e52',
  '#f5c445',
  '#ff8fa3',
  '#e2e8f0',
  '#c2410c',
] as const;

const LOOKS: LookPreset[] = [
  { accentColor: '#ec4899', accessory: 'headset', hairColor: '#d9a24c' },
  { accentColor: '#111827', accessory: 'none', hairColor: '#1b1c20' },
  { accentColor: '#38bdf8', accessory: 'none', hairColor: '#e2e8f0' },
  { accentColor: '#f97316', accessory: 'none', hairColor: '#452718' },
  { accentColor: '#b91c1c', accessory: 'cap', hairColor: '#181a20' },
  { accentColor: '#22d3ee', accessory: 'headset', hairColor: '#f1f5f9' },
  { accentColor: '#1e293b', accessory: 'none', hairColor: '#3a2012' },
  { accentColor: '#2563eb', accessory: 'none', hairColor: '#b45309' },
  { accentColor: '#f59e0b', accessory: 'cap', hairColor: '#171717' },
  { accentColor: '#14b8a6', accessory: 'headset', hairColor: '#a16207' },
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash;
}

export function shirtColorFor(userId: string): string {
  return SHIRT_PALETTE[hashUserId(userId) % SHIRT_PALETTE.length];
}

export function appearanceFor(userId: string): SpriteAppearance {
  const seed = hashUserId(userId);
  const look = LOOKS[seed % LOOKS.length];
  return {
    accentColor: look.accentColor,
    accessory: look.accessory,
    hairColor: look.hairColor,
    // Offset so two people who land on the same look still differ by shirt.
    shirtColor: SHIRT_PALETTE[(seed >> 3) % SHIRT_PALETTE.length],
  };
}
