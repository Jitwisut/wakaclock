/**
 * The ocean's wave field: a sum of Gerstner waves, defined once and used twice — compiled
 * into the ocean's vertex shader (GLSL below) and sampled in JavaScript for the ship's
 * buoyancy and for anything floating on the water. Both forms read the same table, so
 * the ship always sits on the surface that is actually drawn.
 *
 * The ship holds still at the origin, bow toward +X; the sea streams past it toward −X at
 * SHIP_SPEED. Every wave is evaluated at the "sea" coordinate x + SHIP_SPEED·t, which is
 * what makes wake, foam and swells read as forward travel rather than a model in a tank.
 */

export const GRAVITY = 9.81;
/** Metres per second: a steady eight knots or so. */
export const SHIP_SPEED = 4.2;

export interface Wave {
  /** Unit travel direction on the water plane (x, z). */
  direction: readonly [number, number];
  /** Crest-to-crest length in metres. */
  length: number;
  /** Gerstner steepness, 0–1; the table's sum stays below 1 so crests never loop. */
  steepness: number;
}

function unit(x: number, z: number): readonly [number, number] {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
}

/** Long swells first, then crossing seas, then wind chop. */
export const WAVES: readonly Wave[] = [
  { direction: unit(1, 0.18), length: 62, steepness: 0.15 },
  { direction: unit(0.78, -0.62), length: 33, steepness: 0.15 },
  { direction: unit(0.55, 0.84), length: 19, steepness: 0.13 },
  { direction: unit(1, -0.25), length: 9.5, steepness: 0.11 },
  { direction: unit(0.25, 1), length: 5.2, steepness: 0.09 },
  { direction: unit(-0.4, 0.9), length: 3.1, steepness: 0.07 },
];

export function waveNumber(wave: Wave) {
  return (Math.PI * 2) / wave.length;
}

export function waveSpeed(wave: Wave) {
  return Math.sqrt(GRAVITY / waveNumber(wave));
}

export function waveAmplitude(wave: Wave) {
  return wave.steepness / waveNumber(wave);
}

/**
 * Gerstner displacement of the undisturbed sea point (x, z) at time t: where that point of
 * water has moved to. `sea` is how far the sea has streamed past the ship (∫ speed dt);
 * it defaults to a steady SHIP_SPEED. Writes [dx, dy, dz] into `out` to avoid allocation.
 */
export function displacement(
  x: number,
  z: number,
  t: number,
  out: number[] = [0, 0, 0],
  sea = SHIP_SPEED * t
) {
  const seaX = x + sea;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  for (const wave of WAVES) {
    const k = waveNumber(wave);
    const a = waveAmplitude(wave);
    const [ux, uz] = wave.direction;
    const phase = k * (ux * seaX + uz * z - waveSpeed(wave) * t);
    const cos = Math.cos(phase);
    dx += ux * a * cos;
    dz += uz * a * cos;
    dy += a * Math.sin(phase);
  }
  out[0] = dx;
  out[1] = dy;
  out[2] = dz;
  return out;
}

const scratch = [0, 0, 0];

/**
 * Height of the drawn surface above the fixed world point (x, z). Gerstner waves also move
 * water sideways, so the sea point that ends up over (x, z) is found by a few fixed-point
 * iterations before its height is read.
 */
export function surfaceHeight(
  x: number,
  z: number,
  t: number,
  iterations = 3,
  sea = SHIP_SPEED * t
): number {
  let px = x;
  let pz = z;
  for (let index = 0; index < iterations; index += 1) {
    displacement(px, pz, t, scratch, sea);
    px = x - (scratch[0] as number);
    pz = z - (scratch[2] as number);
  }
  return displacement(px, pz, t, scratch, sea)[1] as number;
}

/** Largest possible crest height: the sum of all amplitudes. */
export const MAX_WAVE_HEIGHT = WAVES.reduce((sum, wave) => sum + waveAmplitude(wave), 0);

function glslFloat(value: number) {
  const text = value.toFixed(6);
  return text.includes('.') ? text : `${text}.0`;
}

/**
 * The same field in GLSL (`uSea` is the same sea offset): `gerstner(p, t, fade)` returns the displacement and the surface
 * normal for the sea point p. `fade` thins short waves with distance so far water does not
 * alias into shimmer.
 */
export const GERSTNER_GLSL = /* glsl */ `
uniform float uSea;
const int WAVE_COUNT = ${WAVES.length};
// direction.x, direction.y, k, amplitude
const vec4 WAVE_SHAPE[${WAVES.length}] = vec4[](
${WAVES.map(
  (wave) =>
    `  vec4(${glslFloat(wave.direction[0])}, ${glslFloat(wave.direction[1])}, ${glslFloat(waveNumber(wave))}, ${glslFloat(waveAmplitude(wave))})`
).join(',\n')}
);
const float WAVE_SPEED[${WAVES.length}] = float[](${WAVES.map((wave) => glslFloat(waveSpeed(wave))).join(', ')});

vec3 gerstner(vec2 p, float t, float distanceToEye, out vec3 normal) {
  vec2 sea = vec2(p.x + uSea, p.y);
  vec3 offset = vec3(0.0);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec4 shape = WAVE_SHAPE[i];
    vec2 d = shape.xy;
    float k = shape.z;
    float wavelength = 6.2831853 / k;
    float fade = 1.0 - smoothstep(wavelength * 9.0, wavelength * 26.0, distanceToEye);
    float a = shape.w * fade;
    float f = k * (dot(d, sea) - WAVE_SPEED[i] * t);
    float c = cos(f);
    float s = sin(f);
    float steep = k * a;
    offset += vec3(d.x * a * c, a * s, d.y * a * c);
    tangent += vec3(-d.x * d.x * steep * s, d.x * steep * c, -d.x * d.y * steep * s);
    binormal += vec3(-d.x * d.y * steep * s, d.y * steep * c, -d.y * d.y * steep * s);
  }
  normal = normalize(cross(binormal, tangent));
  return offset;
}
`;
