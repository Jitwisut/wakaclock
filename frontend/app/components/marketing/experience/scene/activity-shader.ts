/**
 * One instanced draw call renders every duration block in every chapter.
 *
 * Each instance carries only its data (day, start minute, duration, project, kind) and the
 * vertex shader derives all five geometry states from it, then blends between them with a
 * per-instance stagger. Keeping the layouts in GLSL means no per-frame CPU work and no
 * attribute uploads while scrolling — the only thing that changes per frame is uniforms.
 *
 * Human, AI and Unattributed marks differ by *pattern* as well as colour (solid, segmented,
 * faint), so the distinction survives for colour-blind visitors and in greyscale.
 */

export const activityVertexShader = /* glsl */ `
  #define TAU 6.28318530718

  attribute vec4 aBlock;   // day, startMin, durationMin, project
  attribute vec3 aMeta;    // kind, seed, index

  uniform float uStage;
  uniform float uDays;
  uniform float uTime;
  uniform float uHoverBlock;
  uniform float uHoverProject;
  uniform vec4 uFocus;     // emphasis for human, ai, unattributed, (unused)
  uniform float uKindMix;

  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vAlong;
  varying float vLength;
  varying float vKind;
  varying float vEmphasis;
  varying float vHover;
  varying float vProject;

  const float RADIUS = 2.6;
  const float DAY_HEIGHT = 0.34;
  const float FLAT_WIDTH = 9.6;

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  // Staggered progress of the transition from state k to k + 1.
  float step_(float k, float seed) {
    return ease(clamp((uStage - k) * 1.7 - seed * 0.7, 0.0, 1.0));
  }

  mat3 rotY(float a) {
    float c = cos(a); float s = sin(a);
    return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
  }

  void main() {
    float day = aBlock.x;
    float startMin = aBlock.y;
    float dur = aBlock.z;
    float project = aBlock.w;
    float kind = aMeta.x;
    float seed = aMeta.y;

    float mid = (startMin + dur * 0.5) / 1440.0;
    float angle = mid * TAU;
    float dayPos = day + mid - uDays * 0.5;
    float arc = dur / 1440.0 * TAU;

    // 0 latent: a tall, dense column turning slowly — the work folded out of sight.
    float rLatent = 0.62 + project * 0.035;
    // Wrapped to [-π, π] so leaving the column never unwinds a long accumulated spin.
    float spin = mod(uTime * 0.08 + TAU * 0.5, TAU) - TAU * 0.5;
    float drift = angle + spin;
    vec3 pLatent = vec3(cos(drift) * rLatent, dayPos * 0.3 + mid * 0.3, sin(drift) * rLatent);
    vec3 sLatent = vec3(max(arc * rLatent * 2.6, 0.035), 0.028, 0.03);

    // 1 spiral: one ring per day, projects as concentric strata.
    float rSpiral = RADIUS + project * 0.2;
    float breathe = sin(uTime * 0.6 + day * 0.7) * 0.02;
    vec3 pSpiral = vec3(cos(angle) * rSpiral, dayPos * DAY_HEIGHT + breathe, sin(angle) * rSpiral);
    vec3 sSpiral = vec3(max(arc * rSpiral, 0.02), 0.042, 0.042);

    // 2 split: human inside, AI agents outside, Unattributed between. Time stays aligned
    // so a human block and the agent run that followed it still face each other.
    float rSplit = kind < 0.5 ? RADIUS * 0.66 : (kind < 1.5 ? RADIUS * 1.32 : RADIUS * 0.99);
    vec3 pSplit = vec3(cos(angle) * rSplit, dayPos * DAY_HEIGHT, sin(angle) * rSplit);
    vec3 sSplit = vec3(max(arc * rSplit, 0.02), kind > 1.5 ? 0.022 : 0.05, 0.05);

    // 3 flat: the spiral unrolled — x is time of day, each lane one day.
    float lane = (uDays * 0.5 - day - 0.5) * (4.6 / uDays);
    float laneOffset = (kind - 1.0) * 0.045;
    vec3 pFlat = vec3((mid - 0.5) * FLAT_WIDTH, lane + laneOffset, 0.0);
    vec3 sFlat = vec3(max(dur / 1440.0 * FLAT_WIDTH, 0.012), 4.6 / uDays * 0.5, 0.05);

    // 4 dial: each day a ring on one plane, wide enough to frame the closing message.
    // Turned so the quiet night hours sit at the bottom and the working day arcs over the top.
    float dialAngle = angle + TAU * 0.09;
    float rDial = 2.7 + day * (2.4 / uDays);
    vec3 pDial = vec3(cos(dialAngle) * rDial, -0.4, sin(dialAngle) * rDial);
    vec3 sDial = vec3(max(arc * rDial, 0.015), 0.03, 2.4 / uDays * 0.55);

    float t1 = step_(0.0, seed);
    float t2 = step_(1.0, seed);
    float t3 = step_(2.0, seed);
    float t4 = step_(3.0, seed);

    vec3 center = pLatent;
    center = mix(center, pSpiral, t1);
    center = mix(center, pSplit, t2);
    center = mix(center, pFlat, t3);
    center = mix(center, pDial, t4);

    vec3 size = sLatent;
    size = mix(size, sSpiral, t1);
    size = mix(size, sSplit, t2);
    size = mix(size, sFlat, t3);
    size = mix(size, sDial, t4);

    // Circular layouts face along the tangent; the flat timeline faces the camera.
    float tangent = -angle - TAU * 0.25;
    float rotation = tangent - spin * (1.0 - t1);
    rotation = mix(rotation, 0.0, t3);
    rotation = mix(rotation, -dialAngle - TAU * 0.25, t4);

    float emphasis = kind < 0.5 ? uFocus.x : (kind < 1.5 ? uFocus.y : uFocus.z);
    emphasis = mix(1.0, emphasis, uKindMix);
    bool hovered = abs(aMeta.z - uHoverBlock) < 0.5;
    bool projectHovered = abs(project - uHoverProject) < 0.5;
    vHover = hovered ? 1.0 : (projectHovered ? 0.55 : 0.0);
    if (uHoverProject > -0.5 && !projectHovered) emphasis *= 0.35;

    vec3 local = position * size * (hovered ? 1.8 : 1.0);
    mat3 rot = rotY(rotation);
    vec3 world = rot * local + center;

    vec4 worldPosition = modelMatrix * vec4(world, 1.0);
    vWorld = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * (rot * normal));
    vAlong = position.x + 0.5;
    vLength = size.x;
    vKind = kind;
    vEmphasis = emphasis;
    vProject = project;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const activityFragmentShader = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uInk;
  uniform vec3 uHuman;
  uniform vec3 uAi;
  uniform vec3 uUnknown;
  uniform vec3 uHighlight;
  uniform float uKindMix;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uPresence;

  varying vec3 vNormal;
  varying vec3 vWorld;
  varying float vAlong;
  varying float vLength;
  varying float vKind;
  varying float vEmphasis;
  varying float vHover;
  varying float vProject;

  void main() {
    // AI agent marks are segmented: a dash every ~9 cm of scene space.
    if (uKindMix > 0.5 && vKind > 0.5 && vKind < 1.5) {
      float dash = fract(vAlong * vLength * 11.0);
      if (dash > 0.62 && vLength > 0.06) discard;
    }

    vec3 kindColor = vKind < 0.5 ? uHuman : (vKind < 1.5 ? uAi : uUnknown);
    // Before the split, projects read as tonal strata of one ink.
    vec3 strata = mix(uInk, uBg, vProject * 0.1);
    vec3 base = mix(strata, kindColor, uKindMix);

    vec3 n = normalize(vNormal);
    vec3 key = normalize(vec3(-0.45, 0.8, 0.55));
    float diffuse = max(dot(n, key), 0.0);
    float rim = pow(1.0 - abs(n.z), 3.0) * 0.12;
    vec3 color = base * (0.62 + diffuse * 0.48) + rim;

    color = mix(color, uHighlight, vHover * 0.85);

    float fogDepth = distance(cameraPosition, vWorld);
    float fog = smoothstep(uFogNear, uFogFar, fogDepth);
    float fade = 1.0 - clamp(vEmphasis, 0.0, 1.0);
    color = mix(color, uBg, clamp(fog * 0.85 + fade * 0.82, 0.0, 0.94));
    color = mix(uBg, color, uPresence);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
