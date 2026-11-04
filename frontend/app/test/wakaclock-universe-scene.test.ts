import { beforeEach, expect, it, vi } from 'vitest';

import { createUniverseScene } from '@/components/wakaclock/agents/universe-scene';
import { layoutUniverse, universeStateAt } from '@/lib/wakaclock/agent-universe';
import type { AgentUniverseResponse } from '@/lib/wakaclock/analytics';

const three = vi.hoisted(() => ({
  disposed: { renderer: 0, textures: 0 },
  hit: [] as unknown[],
  renders: 0,
}));

vi.mock('three', () => {
  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}
    add(other: Vector3) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    copy(other: Vector3) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    }
    distanceTo(other: Vector3) {
      return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    multiplyScalar(value: number) {
      this.x *= value;
      this.y *= value;
      this.z *= value;
      return this;
    }
    project() {
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    setScalar(value: number) {
      return this.set(value, value, value);
    }
  }
  class Part {
    children: Part[] = [];
    dispose = vi.fn();
    position = new Vector3();
    quaternion = { copy: vi.fn() };
    rotation = { x: 0 };
    scale = new Vector3(1, 1, 1);
    userData: Record<string, unknown> = {};
    visible = true;
    constructor(
      public geometry?: Part,
      public material?: Part
    ) {}
    add(child: Part) {
      this.children.push(child);
    }
    lookAt = vi.fn();
    setAttribute = vi.fn();
    setFromPoints() {
      return this;
    }
    traverse(visit: (part: Part) => void) {
      this.children.forEach(visit);
    }
    updateProjectionMatrix = vi.fn();
  }
  class Material extends Part {
    color = { set: vi.fn(), setHex: vi.fn() };
    emissiveIntensity = 0;
    opacity: number;
    constructor(options: { opacity?: number } = {}) {
      super();
      this.opacity = options.opacity ?? 1;
    }
  }
  class Texture extends Part {
    constructor() {
      super();
      this.dispose = vi.fn(() => {
        three.disposed.textures += 1;
      });
    }
  }
  class Light extends Part {
    constructor() {
      super();
    }
  }
  class Sprite extends Part {
    constructor(material: Part) {
      super(undefined, material);
    }
  }
  class Curve {
    getPoint() {
      return new Vector3(1, 2, 3);
    }
    getPoints() {
      return [];
    }
  }
  class WebGLRenderer {
    dispose = vi.fn(() => {
      three.disposed.renderer += 1;
    });
    render = vi.fn(() => {
      three.renders += 1;
    });
    setPixelRatio = vi.fn();
    setSize = vi.fn();
  }
  class Raycaster {
    intersectObjects = () => three.hit;
    setFromCamera = vi.fn();
  }
  class Vector2 {
    set = vi.fn();
  }
  return {
    AdditiveBlending: 2,
    AmbientLight: Light,
    BufferAttribute: Part,
    BufferGeometry: Part,
    CanvasTexture: Texture,
    Color: Part,
    DoubleSide: 2,
    Line: Part,
    LineBasicMaterial: Material,
    Mesh: Part,
    MeshBasicMaterial: Material,
    MeshStandardMaterial: Material,
    PerspectiveCamera: Part,
    PointLight: Light,
    Points: Part,
    PointsMaterial: Material,
    QuadraticBezierCurve3: Curve,
    Raycaster,
    Scene: Part,
    SphereGeometry: Part,
    Sprite,
    SpriteMaterial: Material,
    TorusGeometry: Part,
    Vector2,
    Vector3,
    WebGLRenderer,
  };
});

const HOUR = 1_793_232_000;

const data: AgentUniverseResponse = {
  activity: [
    { agent: 0, hour: HOUR, project: 0, session: 0, tokens: 100 },
    { agent: 1, hour: HOUR, project: 1, session: 1, tokens: 50 },
  ],
  agents: ['claude-code', 'codex'].map((name) => ({
    cost_microusd: null,
    cost_status: 'unavailable',
    events: 1,
    model: null,
    name,
    prompts: null,
    sessions: 1,
    tokens: 100,
  })),
  coverage: {
    events: 2,
    events_with_inferred_project: 0,
    events_without_project: 0,
    last_event_at: HOUR,
    projects_total: 2,
  },
  projects: [
    { key: 'a', name: 'Shop', sessions: 1, tokens: 100 },
    { key: 'b', name: 'Blog', sessions: 1, tokens: 50 },
  ],
  range: { days_included: 1, end: '2026-10-01', start: '2026-10-01', timezone: 'UTC' },
  schema_version: 1,
};

let frames: FrameRequestCallback[];
let observed: ResizeObserverCallback;

function build(reducedMotion = false) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 400 });
  canvas.setPointerCapture = vi.fn();
  canvas.getBoundingClientRect = () => ({ height: 400, left: 0, top: 0, width: 800 }) as DOMRect;
  const labels = document.createElement('div');
  const onSelect = vi.fn();
  const scene = createUniverseScene({
    canvas,
    data,
    labels,
    layout: layoutUniverse(data),
    maxDpr: 1,
    onSelect,
    reducedMotion,
  });
  return { canvas, labels, onSelect, scene };
}

function pointer(canvas: HTMLCanvasElement, type: string, clientX: number) {
  const event = new MouseEvent(type, { clientX, clientY: 10 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  canvas.dispatchEvent(event);
}

function runFrame() {
  const pending = frames;
  frames = [];
  pending.forEach((callback) => callback(performance.now() + 16));
}

beforeEach(() => {
  frames = [];
  three.hit = [];
  three.renders = 0;
  three.disposed = { renderer: 0, textures: 0 };
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      observed = callback;
    }
    disconnect = vi.fn();
    observe = vi.fn();
  } as unknown as typeof ResizeObserver;
});

it('labels every agent and project and renders each frame', () => {
  const { labels } = build();

  expect([...labels.children].map((label) => label.textContent)).toEqual([
    'claude-code',
    'codex',
    'Shop',
    'Blog',
  ]);
  runFrame();
  expect(three.renders).toBe(1);
});

it('draws hidden agents, selections and quiet projects without failing', () => {
  const { labels, scene } = build();
  scene.update({
    hidden: new Set([1]),
    playing: true,
    selection: { index: 0, kind: 'agent' },
    state: universeStateAt(data, HOUR, new Set([1])),
  });
  runFrame();
  expect((labels.children[1] as HTMLElement).style.opacity).toBe('0');
  expect((labels.children[3] as HTMLElement).style.opacity).toBe('0.4');

  scene.update({
    hidden: new Set(),
    playing: false,
    selection: { index: 1, kind: 'project' },
    state: universeStateAt(data, HOUR),
  });
  runFrame();
  expect((labels.children[1] as HTMLElement).style.opacity).toBe('1');
  expect(three.renders).toBe(2);
});

it('holds still when motion is reduced', () => {
  const { scene } = build(true);
  scene.update({
    hidden: new Set(),
    playing: true,
    selection: null,
    state: universeStateAt(data, HOUR),
  });
  runFrame();
  expect(three.renders).toBe(1);
});

it('selects what a click hits and clears on empty space', () => {
  const { canvas, onSelect } = build();

  three.hit = [{ object: { userData: { selection: { index: 1, kind: 'agent' } } } }];
  pointer(canvas, 'pointerdown', 10);
  pointer(canvas, 'pointerup', 10);
  expect(onSelect).toHaveBeenLastCalledWith({ index: 1, kind: 'agent' });

  three.hit = [];
  pointer(canvas, 'pointerdown', 10);
  pointer(canvas, 'pointerup', 10);
  expect(onSelect).toHaveBeenLastCalledWith(null);
});

it('turns a drag into a look around, not a click', () => {
  const { canvas, onSelect } = build();

  pointer(canvas, 'pointermove', 40);
  pointer(canvas, 'pointerdown', 10);
  pointer(canvas, 'pointermove', 60);
  pointer(canvas, 'pointerup', 60);
  expect(onSelect).not.toHaveBeenCalled();

  pointer(canvas, 'pointerdown', 10);
  pointer(canvas, 'pointercancel', 10);
  pointer(canvas, 'pointerup', 10);
  expect(onSelect).not.toHaveBeenCalled();
});

it('moves the camera back on narrow screens and ignores a collapsed canvas', () => {
  const { canvas } = build();

  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 300 });
  observed([], {} as ResizeObserver);
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 500 });
  observed([], {} as ResizeObserver);
  Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 0 });
  expect(() => observed([], {} as ResizeObserver)).not.toThrow();
});

it('releases everything on dispose', () => {
  const { labels, scene } = build();
  scene.zoom(0.1);
  scene.zoom(9);

  scene.dispose();
  expect(three.disposed.renderer).toBe(1);
  expect(three.disposed.textures).toBe(1);
  expect(labels.children).toHaveLength(0);
});
