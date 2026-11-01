import * as THREE from 'three';

import type { CityLayout, CityTower } from '@/lib/wakaclock/project-city';
import {
  heatColour,
  heatOf,
  languageColour,
  moduleStateAt,
  towerFootprint,
} from '@/lib/wakaclock/project-city';

export type CityLens = 'complexity' | 'language';
export type CityBurstTone = 'failure' | 'success';

export interface CityView {
  activePath: null | string;
  day: number;
  lens: CityLens;
  playing: boolean;
  progress: number;
  selectedPath: null | string;
}

export interface CityScene {
  burst(tone: CityBurstTone): void;
  dispose(): void;
  update(view: CityView): void;
  zoom(factor: number): void;
}

interface CitySceneOptions {
  canvas: HTMLCanvasElement;
  layout: CityLayout;
  maxDpr: number;
  onHover(tower: CityTower | null, event: PointerEvent): void;
  onSelect(tower: CityTower): void;
}

const FLOOR_HEIGHT = 0.42;
const BURST_POINTS = 80;
const BURST_LIFE = 1.6;
const BURST_COLOURS = { failure: 0xff_4b_37, success: 0x41_e0_8f };
const SKY_STOPS: Array<[number, number]> = [
  [0, 0x0c_22_30],
  [0.18, 0x1f_55_70],
  [0.5, 0x4f_9c_c0],
  [0.76, 0x4f_9c_c0],
  [0.88, 0xd9_8a_58],
  [0.95, 0x3a_35_60],
  [1, 0x12_17_33],
];

function floorTexture(glow: boolean) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = glow ? '#000000' : '#ffffff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = glow ? '#ffc877' : '#5d6f78';
    for (let window = 0; window < 4; window += 1) context.fillRect(5 + window * 14.5, 16, 10, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function groundLabel(text: string, width: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#eef6ea';
    context.font = '600 46px ui-monospace, Menlo, monospace';
    context.textBaseline = 'middle';
    context.fillText(text, 4, 38, 504);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 7.1),
    new THREE.MeshBasicMaterial({ depthWrite: false, map: texture, transparent: true })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Plain three.js behind a small interface, so the page can load it only when 3D is allowed. */
export function createCityScene({
  canvas,
  layout,
  maxDpr,
  onHover,
  onSelect,
}: CitySceneOptions): CityScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const sky = new THREE.Color(SKY_STOPS[0][1]);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 60, 150);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 800);
  const orbit = { azimuth: 0.66, elevation: 0.48, radius: 60, zoom: 1 };
  const focus = new THREE.Vector3(0, 3, 0);
  const lookTarget = new THREE.Vector3(0, 3, 0);

  const hemisphere = new THREE.HemisphereLight(0xdc_ec_ff, 0x31_43_3c, 1.5);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xff_ff_ff, 2.4);
  const reach = Math.max(layout.width, layout.depth, 30);
  sun.position.set(reach * 0.7, reach * 1.1, reach * 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    bottom: -reach,
    far: reach * 3.5,
    left: -reach,
    near: 1,
    right: reach,
    top: reach,
  });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(layout.width + 7, 0.6, layout.depth + 7),
    new THREE.MeshStandardMaterial({ color: 0x0d_20_24, roughness: 0.9 })
  );
  ground.position.y = -0.31;
  ground.receiveShadow = true;
  scene.add(ground);

  const half = layout.cell / 2;
  for (const district of layout.districts) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(district.size + 0.5, 0.12, district.size + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a_3a_3a, roughness: 0.9 })
    );
    plate.position.set(
      district.x + district.size / 2 - half,
      0.06,
      district.z + district.size / 2 - half
    );
    plate.receiveShadow = true;
    scene.add(plate);
    const label = groundLabel(district.area, 10);
    label.position.set(district.x - half + 4.8, 0.03, district.z + district.size - half + 1.2);
    scene.add(label);
  }
  for (const tower of layout.towers) {
    const label = groundLabel(tower.short, 4.3);
    label.position.set(tower.x + 0.15, 0.14, tower.z + 2);
    scene.add(label);
  }

  /* Each tower owns a fixed run of floors. Floors it does not have yet are scaled to nothing. */
  const floorRuns = layout.towers.map((tower) => {
    const peak = Math.max(0, ...tower.module.series.map((point) => point.lines));
    return { capacity: Math.ceil(peak / layout.linesPerFloor) + 2, height: 0, foot: 0, tower };
  });
  const capacity = floorRuns.reduce((sum, run) => sum + run.capacity, 0);
  const owner: CityTower[] = floorRuns.flatMap((run) =>
    Array.from({ length: run.capacity }, () => run.tower)
  );
  const floorMaterial = new THREE.MeshStandardMaterial({
    emissive: 0xff_ff_ff,
    emissiveIntensity: 0,
    emissiveMap: floorTexture(true),
    map: floorTexture(false),
    roughness: 0.7,
  });
  const floorGeometry = new THREE.BoxGeometry(1, 1, 1);
  const city = new THREE.InstancedMesh(floorGeometry, floorMaterial, capacity);
  city.castShadow = true;
  city.receiveShadow = true;
  city.frustumCulled = false;
  city.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const colour = new THREE.Color();
  for (let index = 0; index < capacity; index += 1) city.setColorAt(index, colour);
  scene.add(city);

  const beamMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: 0x63_d6_c0,
    depthWrite: false,
    opacity: 0.14,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 18, 1, true), beamMaterial);
  beam.scale.y = 44;
  beam.visible = false;
  scene.add(beam);
  const outline = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xff_ff_ff, wireframe: true })
  );
  outline.visible = false;
  scene.add(outline);

  const burstPositions = new Float32Array(BURST_POINTS * 3);
  const burstVelocities = new Float32Array(BURST_POINTS * 3);
  const burstGeometry = new THREE.BufferGeometry();
  burstGeometry.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
  const burstMaterial = new THREE.PointsMaterial({
    depthWrite: false,
    opacity: 0,
    size: 0.55,
    transparent: true,
  });
  const burstPoints = new THREE.Points(burstGeometry, burstMaterial);
  burstPoints.frustumCulled = false;
  scene.add(burstPoints);
  let burstAge = BURST_LIFE;

  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const dummy = new THREE.Object3D();
  let view: CityView = {
    activePath: null,
    day: 0,
    lens: 'complexity',
    playing: false,
    progress: 0,
    selectedPath: null,
  };
  let drawnKey = '';

  function drawTowers() {
    const key = `${view.day}:${view.lens}`;
    if (key === drawnKey) return;
    drawnKey = key;
    let first = 0;
    for (const run of floorRuns) {
      const { module, x, z } = run.tower;
      const state = moduleStateAt(module, view.day);
      const floors = state.lines / layout.linesPerFloor;
      const whole = Math.floor(floors);
      const part = floors - whole;
      run.foot = towerFootprint(state.files);
      run.height = floors * FLOOR_HEIGHT;
      colour.set(
        view.lens === 'complexity'
          ? heatColour(heatOf(state.dependencies, layout.maxDependencies))
          : languageColour(module.language)
      );
      for (let level = 0; level < run.capacity; level += 1) {
        const index = first + level;
        city.setColorAt(index, colour);
        if (level > whole || (level === whole && part < 0.02) || !run.foot) {
          city.setMatrixAt(index, hidden);
          continue;
        }
        const scaleY = level === whole ? part : 1;
        dummy.position.set(x, 0.12 + (level + scaleY / 2) * FLOOR_HEIGHT, z);
        dummy.scale.set(run.foot, FLOOR_HEIGHT * scaleY * 0.94, run.foot);
        dummy.updateMatrix();
        city.setMatrixAt(index, dummy.matrix);
      }
      first += run.capacity;
    }
    city.instanceMatrix.needsUpdate = true;
    (city.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  function paintSky() {
    const { progress } = view;
    const after = SKY_STOPS.findIndex(([stop]) => progress <= stop);
    const [from, fromColour] = SKY_STOPS[Math.max(after - 1, 0)];
    const [to, toColour] = SKY_STOPS[after];
    sky
      .setHex(fromColour)
      .lerp(new THREE.Color(toColour), to > from ? (progress - from) / (to - from) : 0);
    (scene.fog as THREE.Fog).color.copy(sky);
    const dusk = Math.max(0, (progress - 0.86) / 0.14);
    sun.intensity = 2.4 - dusk * 1.8;
    hemisphere.intensity = 1.5 - dusk * 0.6;
    floorMaterial.emissiveIntensity = dusk * 1.5;
  }

  function resize() {
    const { clientHeight, clientWidth } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    const spread = Math.max(layout.width, layout.depth, 14);
    let distance = 1.75;
    if (camera.aspect < 1) distance = 3;
    else if (camera.aspect < 1.5) distance = 2.25;
    orbit.radius = spread * distance;
    const fog = scene.fog as THREE.Fog;
    fog.near = orbit.radius * 1.5;
    fog.far = orbit.radius * 3.4;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let dragging: { moved: number; x: number; y: number } | null = null;
  let hoverAt = 0;

  function towerUnder(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(city, false)[0];
    return hit?.instanceId === undefined ? null : owner[hit.instanceId];
  }
  const onPointerDown = (event: PointerEvent) => {
    dragging = { moved: 0, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent) => {
    const clicked = dragging && dragging.moved < 5;
    dragging = null;
    if (!clicked) return;
    const tower = towerUnder(event);
    if (tower) onSelect(tower);
  };
  const onPointerCancel = () => {
    dragging = null;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (dragging) {
      const moveX = event.clientX - dragging.x;
      const moveY = event.clientY - dragging.y;
      orbit.azimuth -= moveX * 0.006;
      orbit.elevation = Math.max(0.12, Math.min(1.35, orbit.elevation + moveY * 0.004));
      dragging = {
        moved: dragging.moved + Math.abs(moveX) + Math.abs(moveY),
        x: event.clientX,
        y: event.clientY,
      };
      return;
    }
    if (event.pointerType !== 'mouse') return;
    const now = performance.now();
    if (now - hoverAt < 70) return;
    hoverAt = now;
    onHover(towerUnder(event), event);
  };
  const onPointerLeave = (event: PointerEvent) => onHover(null, event);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  function runFor(path: null | string) {
    return floorRuns.find((run) => run.tower.module.path === path);
  }

  let frame = 0;
  let last = performance.now();
  function render(now: number) {
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    drawTowers();
    paintSky();

    const active = runFor(view.activePath);
    beam.visible = Boolean(active);
    if (active) beam.position.set(active.tower.x, 22, active.tower.z);

    const chosen = runFor(view.selectedPath);
    outline.visible = Boolean(chosen && chosen.height > 0.05);
    if (chosen) {
      outline.scale.set(chosen.foot + 0.3, chosen.height + 0.3, chosen.foot + 0.3);
      outline.position.set(chosen.tower.x, 0.12 + chosen.height / 2, chosen.tower.z);
    }

    if (burstAge < BURST_LIFE) {
      burstAge += delta;
      for (let index = 0; index < BURST_POINTS * 3; index += 1) {
        if (index % 3 === 1) burstVelocities[index] -= 9 * delta;
        burstPositions[index] += burstVelocities[index] * delta;
      }
      burstGeometry.attributes.position.needsUpdate = true;
    }
    burstMaterial.opacity = Math.max(0, 1 - burstAge / BURST_LIFE);

    if (view.playing && !dragging) orbit.azimuth += delta * 0.07;
    const follow = view.playing ? active : undefined;
    lookTarget.set(follow ? follow.tower.x * 0.45 : 0, 3, follow ? follow.tower.z * 0.45 : 0);
    focus.lerp(lookTarget, Math.min(1, delta * 1.4));
    const radius = orbit.radius * orbit.zoom;
    camera.position.set(
      focus.x + radius * Math.cos(orbit.elevation) * Math.sin(orbit.azimuth),
      focus.y + radius * Math.sin(orbit.elevation),
      focus.z + radius * Math.cos(orbit.elevation) * Math.cos(orbit.azimuth)
    );
    camera.lookAt(focus);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);

  return {
    burst(tone) {
      burstMaterial.color.setHex(BURST_COLOURS[tone]);
      for (let index = 0; index < BURST_POINTS; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const spread = 1 + Math.random() * 6;
        burstPositions.set([0, 6, 0], index * 3);
        burstVelocities.set(
          [Math.cos(angle) * spread, 4 + Math.random() * 8, Math.sin(angle) * spread],
          index * 3
        );
      }
      burstAge = 0;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = [mesh.material].flat() as Array<THREE.Material | undefined>;
        for (const material of materials) {
          const textured = material as
            | ({ map?: null | THREE.Texture } & THREE.Material)
            | undefined;
          textured?.map?.dispose();
          material?.dispose();
        }
      });
      city.dispose();
      renderer.dispose();
    },
    update(next) {
      view = next;
    },
    zoom(factor) {
      orbit.zoom = Math.max(0.35, Math.min(1.5, orbit.zoom * factor));
    },
  };
}
