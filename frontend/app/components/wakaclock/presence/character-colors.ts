/**
 * A small palette of saturated, limited-hue "sprite shirt" colours — closer to an NES
 * cartridge's palette than a candy-pastel one — assigned per user by hashing their id so
 * the same person gets the same colour every time they appear — across rooms, across
 * page reloads, without the server needing to track or send a colour at all.
 */
const PALETTE = [
  '#E0342B', // NES red
  '#2E86DE', // arcade blue
  '#F5C945', // coin gold
  '#1E9E52', // 1-up green
  '#B24BF3', // magic purple
  '#F07C2C', // power orange
  '#2FBFA0', // pipe teal
  '#F0568C', // bonus pink
] as const;

export function characterColorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
