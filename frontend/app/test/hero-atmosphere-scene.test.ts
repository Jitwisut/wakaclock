import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createAtmosphere } from '@/components/marketing/hero-atmosphere-scene';

const three = vi.hoisted(() => {
  const record = {
    renderers: [] as {
      dispose: ReturnType<typeof vi.fn>;
      domElement: HTMLCanvasElement;
      forceContextLoss: ReturnType<typeof vi.fn>;
      pixelRatio: number;
      render: ReturnType<typeof vi.fn>;
      setSize: ReturnType<typeof vi.fn>;
    }[],
    materials: [] as {
      dispose: ReturnType<typeof vi.fn>;
      uniforms: Record<string, { value: unknown }>;
    }[],
    geometries: [] as {
      attributes: Record<string, { array: Float32Array }>;
      dispose: ReturnType<typeof vi.fn>;
    }[],
    textures: [] as { dispose: ReturnType<typeof vi.fn> }[],
    cameras: [] as { aspect: number; position: { y: number; z: number } }[],
    groups: [] as { rotation: { x: number; y: number; z: number } }[],
  };
  const vector = () => {
    const position = {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        Object.assign(position, { x, y, z });
      },
    };
    return position;
  };
  return {
    record,
    module: {
      AdditiveBlending: 2,
      BufferAttribute: class {
        constructor(
          public array: Float32Array,
          public itemSize: number
        ) {}
      },
      BufferGeometry: class {
        attributes: Record<string, { array: Float32Array }> = {};
        dispose = vi.fn();
        constructor() {
          record.geometries.push(this);
        }
        setAttribute(name: string, attribute: { array: Float32Array }) {
          this.attributes[name] = attribute;
        }
      },
      CanvasTexture: class {
        dispose = vi.fn();
        constructor() {
          record.textures.push(this);
        }
      },
      Color: class {
        constructor(public value: string) {}
      },
      Group: class {
        rotation = { x: 0, y: 0, z: 0 };
        add = vi.fn();
        constructor() {
          record.groups.push(this);
        }
      },
      PerspectiveCamera: class {
        aspect = 1;
        position = vector();
        lookAt = vi.fn();
        updateProjectionMatrix = vi.fn();
        constructor() {
          record.cameras.push(this);
        }
      },
      Points: class {},
      Scene: class {
        add = vi.fn();
      },
      ShaderMaterial: class {
        uniforms: Record<string, { value: unknown }>;
        dispose = vi.fn();
        constructor(parameters: { uniforms: Record<string, { value: unknown }> }) {
          this.uniforms = parameters.uniforms;
          record.materials.push(this);
        }
      },
      WebGLRenderer: class {
        domElement = document.createElement('canvas');
        pixelRatio = 1;
        render = vi.fn();
        setSize = vi.fn();
        dispose = vi.fn();
        forceContextLoss = vi.fn();
        setClearColor = vi.fn();
        constructor() {
          record.renderers.push(this);
        }
        setPixelRatio(value: number) {
          this.pixelRatio = value;
        }
        getPixelRatio() {
          return this.pixelRatio;
        }
      },
    },
  };
});

vi.mock('three', () => three.module);

let frames: FrameRequestCallback[] = [];
let visibility: (entries: { isIntersecting: boolean }[]) => void = () => {};
let resized: () => void = () => {};
const observe = vi.fn();
const disconnect = vi.fn();

function step(now: number) {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(now);
}

function host(width = 800, height = 400) {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
  document.body.append(element);
  return {
    element,
    size(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
      resized();
    },
  };
}

beforeEach(() => {
  for (const list of Object.values(three.record)) list.length = 0;
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames = [];
  });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  window.IntersectionObserver = class {
    observe = observe;
    disconnect = disconnect;
    constructor(callback: typeof visibility) {
      visibility = callback;
    }
  } as unknown as typeof IntersectionObserver;
  window.ResizeObserver = class {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(callback: () => void) {
      resized = callback;
    }
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('builds one point field of dial rings and renders it while on screen', () => {
  const random = vi.spyOn(Math, 'random');
  let call = 0;
  random.mockImplementation(() => (call++ % 2 === 0 ? 0.05 : 0.9));
  const { element } = host();
  createAtmosphere(element, { count: 14, maxDpr: 1.5, pointer: false });

  const [renderer] = three.record.renderers;
  expect(element.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  expect(renderer?.setSize).toHaveBeenCalledWith(800, 400, false);
  expect(three.record.cameras[0]?.aspect).toBe(2);
  const tones = three.record.geometries[0]?.attributes.aTone?.array;
  expect(tones).toHaveLength(14);
  // Both mark colours are present.
  expect(new Set(tones)).toEqual(new Set([0, 1]));

  expect(frames).toHaveLength(1);
  step(16);
  expect(renderer?.render).toHaveBeenCalledOnce();
  expect(frames).toHaveLength(1);
});

it('caps the pixel ratio and falls back to 1 when the device reports none', () => {
  const { element } = host();
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
  createAtmosphere(element, { count: 1, maxDpr: 1.5, pointer: false });
  expect(three.record.renderers[0]?.pixelRatio).toBe(1.5);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
  createAtmosphere(element, { count: 1, maxDpr: 1.5, pointer: false });
  expect(three.record.renderers[1]?.pixelRatio).toBe(1);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
});

it('draws a soft sprite when 2D canvas is available', () => {
  const fillRect = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => gradient,
    fillRect,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
  const { element } = host();
  createAtmosphere(element, { count: 1, maxDpr: 1, pointer: false });
  expect(gradient.addColorStop).toHaveBeenCalledTimes(3);
  expect(fillRect).toHaveBeenCalledWith(0, 0, 64, 64);
});

it('skips sizing until the host has a size, and follows later resizes', () => {
  const { element, size } = host(0, 0);
  createAtmosphere(element, { count: 1, maxDpr: 1, pointer: false });
  const [renderer] = three.record.renderers;
  expect(renderer?.setSize).not.toHaveBeenCalled();
  size(300, 0);
  expect(renderer?.setSize).not.toHaveBeenCalled();
  size(300, 150);
  expect(renderer?.setSize).toHaveBeenCalledWith(300, 150, false);
});

it('leans toward the pointer and recedes as the page scrolls', () => {
  const { element } = host();
  createAtmosphere(element, { count: 1, maxDpr: 1, pointer: true });
  const [group] = three.record.groups;
  const [camera] = three.record.cameras;
  const [material] = three.record.materials;

  window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth, clientY: 0 }));
  Object.defineProperty(window, 'scrollY', { configurable: true, value: window.innerHeight * 3 });
  for (let now = 50; now <= 2000; now += 50) step(now);

  expect(group?.rotation.y).toBeCloseTo(0.16, 2);
  expect(camera?.position.z).toBeCloseTo(15, 1);
  expect(camera?.position.y).toBeCloseTo(-1.2, 1);
  expect(material?.uniforms.uFade?.value).toBeCloseTo(0.25, 2);
});

it('ignores the pointer when interaction is off', () => {
  const { element } = host();
  createAtmosphere(element, { count: 1, maxDpr: 1, pointer: false });
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: window.innerWidth, clientY: 0 }));
  for (let now = 50; now <= 1000; now += 50) step(now);
  expect(three.record.groups[0]?.rotation.y).toBe(0);
});

it('stops drawing offscreen or in a hidden tab, resumes once, and disposes everything', () => {
  const { element } = host();
  const atmosphere = createAtmosphere(element, { count: 1, maxDpr: 1, pointer: true });
  const [renderer] = three.record.renderers;
  expect(observe).toHaveBeenCalledWith(element);

  visibility([{ isIntersecting: false }]);
  expect(frames).toHaveLength(0);
  // An empty batch counts as offscreen; staying offscreen changes nothing.
  visibility([]);
  expect(frames).toHaveLength(0);

  visibility([{ isIntersecting: true }]);
  expect(frames).toHaveLength(1);
  // Already running: a second "visible" does not queue another loop.
  visibility([{ isIntersecting: true }]);
  expect(frames).toHaveLength(1);

  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(frames).toHaveLength(0);

  atmosphere.dispose();
  expect(disconnect).toHaveBeenCalled();
  expect(three.record.geometries[0]?.dispose).toHaveBeenCalledOnce();
  expect(three.record.materials[0]?.dispose).toHaveBeenCalledOnce();
  expect(three.record.textures[0]?.dispose).toHaveBeenCalledOnce();
  expect(renderer?.forceContextLoss).toHaveBeenCalledOnce();
  expect(renderer?.dispose).toHaveBeenCalledOnce();
  expect(element.querySelector('canvas')).toBeNull();
});
