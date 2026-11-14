/**
 * The sky, shared GLSL: a painterly sunset gradient that cools to night as the sun sinks,
 * a soft sun with its haze, layered procedural clouds lit from beneath by the sun, and
 * stars after dark. The ocean reflects the same gradient, so the water's colours always
 * belong to the sky above it.
 *
 * Colours are authored in sRGB and converted to linear once (`srgb()`), because the scene
 * is tone-mapped filmically.
 */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uSunElev;
uniform float uDaylight;
uniform float uStars;
uniform float uTime;
uniform float uFog;

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum;
}

/** The clear-sky gradient for a view direction (no clouds): cheap enough for reflections. */
vec3 skyGradient(vec3 dir) {
  float h = clamp(dir.y, -0.05, 1.0);
  float toSun = max(dot(normalize(vec3(dir.x, 0.0, dir.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);

  // Golden hour: deep desaturated blue → lavender → dusty rose → peach/amber at the horizon.
  vec3 zenith = srgb(vec3(0.23, 0.30, 0.46));
  vec3 upper = srgb(vec3(0.50, 0.48, 0.66));
  vec3 middle = srgb(vec3(0.84, 0.58, 0.56));
  vec3 horizon = srgb(vec3(0.98, 0.70, 0.47));
  vec3 day = mix(horizon, middle, smoothstep(0.0, 0.09, h));
  day = mix(day, upper, smoothstep(0.07, 0.3, h));
  day = mix(day, zenith, smoothstep(0.25, 0.9, h));
  // Warmer and brighter toward the sun along the horizon.
  day += srgb(vec3(1.0, 0.62, 0.3)) * pow(toSun, 3.0) * (1.0 - smoothstep(0.0, 0.35, h)) * 0.55;

  // Night: a deep navy dome with a faint violet afterglow on the horizon.
  vec3 nightZenith = srgb(vec3(0.02, 0.03, 0.07));
  vec3 nightHorizon = srgb(vec3(0.09, 0.09, 0.17)) + srgb(vec3(0.24, 0.12, 0.16)) * pow(toSun, 4.0) * 0.6;
  vec3 night = mix(nightHorizon, nightZenith, smoothstep(0.0, 0.5, h));

  return mix(night, day, uDaylight);
}

/** The sun's haze and disc, added on top of the gradient. */
vec3 sunLight(vec3 dir, float sharp) {
  float d = max(dot(dir, uSunDir), 0.0);
  float above = smoothstep(-0.03, 0.02, uSunElev);
  vec3 warm = srgb(vec3(1.0, 0.72, 0.42));
  vec3 haze = warm * (pow(d, 6.0) * 0.45 + pow(d, 48.0) * 0.9) * (0.25 + 0.75 * above);
  float disc = smoothstep(0.99935, 0.99975, d) * sharp * above;
  return (haze * uDaylight + srgb(vec3(1.0, 0.86, 0.62)) * disc * 9.0);
}

/** Clouds: wispy high streaks and heavier mid-level masses, lit warm on the sun side. */
vec4 clouds(vec3 dir) {
  if (dir.y <= 0.0) return vec4(0.0);
  vec2 high = dir.xz / (dir.y + 0.08) * 0.55 + vec2(uTime * 0.004, 0.0);
  vec2 mid = dir.xz / (dir.y + 0.18) * 1.1 + vec2(uTime * 0.008, uTime * 0.002);
  float wisps = fbm(high * vec2(1.0, 4.0)) ;
  float masses = fbm(mid);
  float highCover = smoothstep(0.55, 0.85, wisps) * 0.55;
  float midCover = smoothstep(0.52, 0.78, masses);
  // Clouds thin out overhead and gather toward the horizon.
  float band = smoothstep(0.0, 0.05, dir.y) * (1.0 - smoothstep(0.3, 0.75, dir.y) * 0.6);
  float cover = clamp(max(highCover, midCover) * band, 0.0, 1.0);

  float toSun = max(dot(dir, uSunDir), 0.0);
  vec3 lit = srgb(vec3(1.0, 0.66, 0.42)) * (0.75 + 1.2 * pow(toSun, 6.0));
  vec3 shade = srgb(vec3(0.42, 0.33, 0.45));
  // Undersides catch the low sun: the thinner the cloud, the more it glows.
  float edge = 1.0 - smoothstep(0.5, 1.0, cover);
  vec3 color = mix(shade, lit, clamp(edge * 0.8 + pow(toSun, 3.0) * 0.5, 0.0, 1.0));
  vec3 nightColor = srgb(vec3(0.06, 0.06, 0.1));
  color = mix(nightColor, color, uDaylight);
  return vec4(color, cover * (0.55 + 0.4 * uDaylight));
}

float stars(vec3 dir) {
  if (dir.y <= 0.02) return 0.0;
  vec2 grid = dir.xz / (dir.y + 0.4) * 140.0;
  vec2 cell = floor(grid);
  float h = hash12(cell);
  float s = step(0.9965, h);
  vec2 f = fract(grid) - 0.5;
  float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
  return s * smoothstep(0.32, 0.0, length(f)) * twinkle * smoothstep(0.02, 0.2, dir.y);
}
`;
