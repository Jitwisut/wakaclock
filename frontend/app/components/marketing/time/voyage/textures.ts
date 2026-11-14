import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';

import { seededRandom } from '../time-data';

/**
 * Procedural surface textures, painted once into canvases: no image downloads. Each
 * returns a texture even where canvas 2D is unavailable (tests), just blank.
 */

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return { element, context: element.getContext('2d') };
}

function texture(element: HTMLCanvasElement, srgb = true) {
  const map = new CanvasTexture(element);
  if (srgb) map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

/** Hull height range the hull texture covers (metres): keel to above the stern rail. */
export const HULL_TEXTURE_Y = { from: -2.5, to: 4.2 } as const;
/** Metres of hull length one copy of the texture spans. */
export const HULL_TEXTURE_LENGTH = 8;

function yToRow(y: number, height: number) {
  const { from, to } = HULL_TEXTURE_Y;
  return height - ((y - from) / (to - from)) * height;
}

/**
 * The hull's paint: oxblood anti-fouling below the boot-top, a black waterline band,
 * weathered black-brown planking with two heavy wales and an ochre strake along the gun
 * deck. Plank seams and staggered butt joints are drawn per strake.
 */
export function hullTexture() {
  const width = 1024;
  const height = 768;
  const { element, context: g } = canvas(width, height);
  const map = texture(element);
  map.wrapS = RepeatWrapping;
  map.wrapT = ClampToEdgeWrapping;
  map.repeat.set(1 / HULL_TEXTURE_LENGTH, 1 / (HULL_TEXTURE_Y.to - HULL_TEXTURE_Y.from));
  map.offset.set(0, -HULL_TEXTURE_Y.from / (HULL_TEXTURE_Y.to - HULL_TEXTURE_Y.from));
  if (!g) return map;
  const random = seededRandom(31);
  const band = (from: number, to: number, color: string) => {
    g.fillStyle = color;
    const top = yToRow(to, height);
    g.fillRect(0, top, width, yToRow(from, height) - top);
  };
  band(-3, 0.22, '#4b2620');
  band(0.22, 0.34, '#141112');
  band(0.34, 4.5, '#3f2d20');
  band(1.48, 2.02, '#8c6431');
  // Strakes: individual plank tone, grain streaks and butt joints.
  const plank = 0.29;
  for (let y = HULL_TEXTURE_Y.from; y < HULL_TEXTURE_Y.to; y += plank) {
    const top = yToRow(y + plank, height);
    const bottom = yToRow(y, height);
    const tone = random() * 0.16 - 0.08;
    g.fillStyle = tone > 0 ? `rgba(255,236,210,${tone})` : `rgba(0,0,0,${-tone})`;
    g.fillRect(0, top, width, bottom - top);
    for (let streak = 0; streak < 26; streak += 1) {
      g.fillStyle = `rgba(0,0,0,${0.04 + random() * 0.06})`;
      g.fillRect(random() * width, top + random() * (bottom - top), 30 + random() * 160, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, top, width, 1.6);
    let x = random() * 180;
    while (x < width) {
      g.fillRect(x, top, 2, bottom - top);
      x += 180 + random() * 260;
    }
  }
  // Wales: heavy dark bands that run the hull's length.
  for (const y of [0.92, 1.42, 2.08]) {
    const top = yToRow(y + 0.14, height);
    g.fillStyle = '#16100c';
    g.fillRect(0, top, width, yToRow(y, height) - top);
    g.fillStyle = 'rgba(255,220,170,0.08)';
    g.fillRect(0, top, width, 2);
  }
  // Weathering: salt bloom low on the topsides and darker streaks running down.
  for (let index = 0; index < 160; index += 1) {
    const x = random() * width;
    const y = yToRow(0.4 + random() * 2.6, height);
    g.fillStyle = `rgba(210,200,180,${random() * 0.05})`;
    g.fillRect(x, y, 2 + random() * 3, 10 + random() * 50);
  }
  return map;
}

/** Deck planking: narrow planks fore-and-aft, dark caulking, staggered butts, sun-bleached. */
export function deckTexture() {
  const width = 1024;
  const height = 512;
  const { element, context: g } = canvas(width, height);
  const map = texture(element);
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  // u = x metres, v = z metres: 6 m along, 2.4 m across per copy.
  map.repeat.set(1 / 6, 1 / 2.4);
  if (!g) return map;
  const random = seededRandom(57);
  g.fillStyle = '#8d6d4c';
  g.fillRect(0, 0, width, height);
  const plankHeight = height / 13;
  for (let row = 0; row < 13; row += 1) {
    const top = row * plankHeight;
    const tone = random() * 0.2 - 0.1;
    g.fillStyle = tone > 0 ? `rgba(255,238,210,${tone})` : `rgba(40,20,5,${-tone})`;
    g.fillRect(0, top, width, plankHeight);
    for (let streak = 0; streak < 40; streak += 1) {
      g.fillStyle = `rgba(60,35,15,${0.05 + random() * 0.08})`;
      g.fillRect(random() * width, top + random() * plankHeight, 40 + random() * 220, 1);
    }
    g.fillStyle = 'rgba(25,15,8,0.8)';
    g.fillRect(0, top, width, 2);
    let x = random() * 300;
    while (x < width) {
      g.fillRect(x, top, 2, plankHeight);
      // Treenails at each butt.
      g.fillStyle = 'rgba(30,18,8,0.6)';
      g.fillRect(x + 6, top + plankHeight * 0.3, 3, 3);
      g.fillRect(x + 6, top + plankHeight * 0.65, 3, 3);
      g.fillStyle = 'rgba(25,15,8,0.8)';
      x += 260 + random() * 340;
    }
  }
  return map;
}

/** Aged sailcloth: cloths with seams and stitching, a reinforced head and soft stains. */
export function sailTexture() {
  const width = 512;
  const height = 512;
  const { element, context: g } = canvas(width, height);
  const map = texture(element);
  if (!g) return map;
  const random = seededRandom(83);
  g.fillStyle = '#e7dbc1';
  g.fillRect(0, 0, width, height);
  const cloths = 11;
  for (let index = 0; index < cloths; index += 1) {
    const x = (index / cloths) * width;
    const tone = random() * 0.08 - 0.04;
    g.fillStyle = tone > 0 ? `rgba(255,255,245,${tone})` : `rgba(90,70,40,${-tone})`;
    g.fillRect(x, 0, width / cloths, height);
    // A seam: a darker fold line with two rows of stitches.
    g.fillStyle = 'rgba(110,90,60,0.35)';
    g.fillRect(x, 0, 2, height);
    for (let y = 0; y < height; y += 6) {
      g.fillStyle = 'rgba(95,75,50,0.35)';
      g.fillRect(x - 4, y, 1, 3);
      g.fillRect(x + 5, y + 3, 1, 3);
    }
  }
  // Reinforced head (top) and reef band.
  g.fillStyle = 'rgba(120,95,60,0.3)';
  g.fillRect(0, 0, width, 14);
  g.fillRect(0, height * 0.24, width, 4);
  for (let x = 8; x < width; x += 22) {
    g.fillStyle = 'rgba(70,55,35,0.5)';
    g.fillRect(x, height * 0.24 - 3, 2, 10);
  }
  // Weather stains: soft, low-contrast, mostly toward the foot.
  for (let index = 0; index < 28; index += 1) {
    const gradient = g.createRadialGradient(0, 0, 0, 0, 0, 40 + random() * 90);
    gradient.addColorStop(0, `rgba(120,95,55,${0.04 + random() * 0.06})`);
    gradient.addColorStop(1, 'rgba(120,95,55,0)');
    g.save();
    g.translate(random() * width, height * (0.3 + random() * 0.7));
    g.fillStyle = gradient;
    g.fillRect(-140, -140, 280, 280);
    g.restore();
  }
  return map;
}
