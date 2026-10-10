import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

export interface AtmosphereOptions {
  /** Marks in the field. */
  count: number;
  /** Upper bound for the device pixel ratio. */
  maxDpr: number;
  /** Whether the field follows the pointer. */
  pointer: boolean;
}

export interface Atmosphere {
  dispose: () => void;
}

const TAU = Math.PI * 2;
/** Frame-rate independent easing toward a target. */
const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** A soft round sprite, drawn once, so the marks read as light rather than squares. */
function dotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/**
 * Concentric rings of fine marks — the product's 24-hour dial, seen as dust — that turn
 * slowly, lean toward the pointer and recede as the visitor scrolls the opening away.
 *
 * Plain three.js with one draw call: no React renderer, no post-processing.
 */
export function createAtmosphere(host: HTMLElement, options: AtmosphereOptions): Atmosphere {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.maxDpr));
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 0, 11);

  const positions = new Float32Array(options.count * 3);
  const seeds = new Float32Array(options.count);
  const tones = new Float32Array(options.count);
  const rings = 7;
  for (let index = 0; index < options.count; index++) {
    const ring = index % rings;
    const radius = 1.7 + ring * 0.44 + (Math.random() - 0.5) * 0.14;
    const angle = Math.random() * TAU;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = Math.sin(angle) * radius;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 0.6 - ring * 0.18;
    seeds[index] = Math.random();
    // A few lime "now" marks among the forest ones, like the dial's live hour.
    tones[index] = Math.random() < 0.14 ? 1 : 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aTone', new BufferAttribute(tones, 1));

  const texture = dotTexture();
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: 1 },
      uTex: { value: texture },
      uForest: { value: new Color('#2f7d55') },
      uLime: { value: new Color('#9ccf5a') },
      uFade: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aTone;
      uniform float uTime;
      uniform float uPx;
      varying float vAlpha;
      varying float vTone;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
        vAlpha = twinkle;
        vTone = aTone;
        gl_PointSize = (2.2 + aSeed * 2.6 + aTone * 1.6) * uPx * (10.0 / -view.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform vec3 uForest;
      uniform vec3 uLime;
      uniform float uFade;
      varying float vAlpha;
      varying float vTone;
      void main() {
        float shape = texture2D(uTex, gl_PointCoord).a;
        vec3 colour = mix(uForest, uLime, vTone);
        gl_FragColor = vec4(colour, shape * vAlpha * uFade * (0.32 + vTone * 0.3));
      }
    `,
  });

  const group = new Group();
  group.rotation.x = -0.55;
  group.add(new Points(geometry, material));
  scene.add(group);

  let width = 0;
  let height = 0;
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    material.uniforms.uPx.value = renderer.getPixelRatio();
  };
  const sizes = new ResizeObserver(resize);
  sizes.observe(host);
  resize();

  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0, scroll: 0 };
  const onPointer = (event: PointerEvent) => {
    target.x = (event.clientX / window.innerWidth) * 2 - 1;
    target.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  if (options.pointer) window.addEventListener('pointermove', onPointer, { passive: true });

  let raf = 0;
  let last = performance.now();
  let running = false;
  let visible = true;

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    material.uniforms.uTime.value += dt;
    // How far the opening has been scrolled away, 0 → 1 over one screen.
    const scrolled = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
    eased.x = damp(eased.x, target.x, 2.6, dt);
    eased.y = damp(eased.y, target.y, 2.6, dt);
    eased.scroll = damp(eased.scroll, scrolled, 5.2, dt);

    group.rotation.z += dt * 0.035;
    group.rotation.x = -0.55 + eased.y * 0.12 + eased.scroll * 0.35;
    group.rotation.y = eased.x * 0.16;
    camera.position.z = 11 + eased.scroll * 4;
    camera.position.y = eased.scroll * -1.2;
    camera.lookAt(0, 0, 0);
    material.uniforms.uFade.value = 1 - eased.scroll * 0.75;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    const should = visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const onscreen = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    sync();
  });
  onscreen.observe(host);
  document.addEventListener('visibilitychange', sync);
  sync();

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      onscreen.disconnect();
      sizes.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pointermove', onPointer);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      // Give the GL context back now rather than at garbage collection: client-side
      // navigation between content pages would otherwise pile up live contexts.
      renderer.forceContextLoss();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
