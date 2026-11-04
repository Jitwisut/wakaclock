import * as THREE from 'three';

import type {
  UniverseLayout,
  UniverseSelection,
  UniverseState,
} from '@/lib/wakaclock/agent-universe';
import { agentColour, edgeKey } from '@/lib/wakaclock/agent-universe';
import type { AgentUniverseResponse } from '@/lib/wakaclock/analytics';

export interface UniverseView {
  hidden: ReadonlySet<number>;
  playing: boolean;
  selection: null | UniverseSelection;
  state: UniverseState;
}

export interface UniverseScene {
  dispose(): void;
  update(view: UniverseView): void;
  zoom(factor: number): void;
}

interface UniverseSceneOptions {
  canvas: HTMLCanvasElement;
  data: AgentUniverseResponse;
  labels: HTMLElement;
  layout: UniverseLayout;
  maxDpr: number;
  onSelect(selection: null | UniverseSelection): void;
  reducedMotion: boolean;
}

const MAX_COMETS = 24;
const TAIL = 7;
const PLANET_COLOURS = [
  '#4c6b7a',
  '#6a5d7f',
  '#3f7a6a',
  '#7f6a4c',
  '#5a7f4c',
  '#7a4c5d',
  '#4c5d7a',
];

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,.75)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** Plain three.js behind a small interface, so the page can load it only when 3D is allowed. */
export function createUniverseScene({
  canvas,
  data,
  labels,
  layout,
  maxDpr,
  onSelect,
  reducedMotion,
}: UniverseSceneOptions): UniverseScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05090f');
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
  const orbit = { azimuth: 0.5, elevation: 0.38, radius: 50, zoom: 1 };
  scene.add(new THREE.AmbientLight('#8fa8b8', 0.8));
  scene.add(new THREE.PointLight('#ffffff', 900, 120));

  const skyPositions = new Float32Array(1400 * 3);
  for (let index = 0; index < 1400; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const tilt = Math.acos(2 * Math.random() - 1);
    const far = 110 + Math.random() * 120;
    skyPositions.set(
      [
        far * Math.sin(tilt) * Math.cos(angle),
        far * Math.cos(tilt),
        far * Math.sin(tilt) * Math.sin(angle),
      ],
      index * 3
    );
  }
  const skyGeometry = new THREE.BufferGeometry();
  skyGeometry.setAttribute('position', new THREE.BufferAttribute(skyPositions, 3));
  scene.add(
    new THREE.Points(
      skyGeometry,
      new THREE.PointsMaterial({ color: '#9fb6c6', opacity: 0.55, size: 0.7, transparent: true })
    )
  );

  const glow = glowTexture();
  const pickable: THREE.Object3D[] = [];
  const addLabel = (text: string, agent: boolean) => {
    const element = document.createElement('div');
    element.textContent = text;
    element.dataset.kind = agent ? 'agent' : 'project';
    labels.append(element);
    return element;
  };

  const stars = data.agents.map((agent, index) => {
    const position = new THREE.Vector3(...layout.agents[index]);
    const colour = new THREE.Color(agentColour(agent.name, index));
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 18),
      new THREE.MeshBasicMaterial({ color: colour })
    );
    core.position.copy(position);
    core.userData.selection = { index, kind: 'agent' } satisfies UniverseSelection;
    scene.add(core);
    pickable.push(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: colour,
        depthWrite: false,
        map: glow,
        transparent: true,
      })
    );
    halo.position.copy(position);
    scene.add(halo);
    return { core, halo, label: addLabel(agent.name, true), position };
  });

  const planets = data.projects.map((project, index) => {
    const position = new THREE.Vector3(...layout.projects[index]);
    const tone = PLANET_COLOURS[index % PLANET_COLOURS.length];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 20),
      new THREE.MeshStandardMaterial({
        color: tone,
        emissive: tone,
        emissiveIntensity: 0.12,
        roughness: 0.75,
      })
    );
    mesh.position.copy(position);
    mesh.userData.selection = { index, kind: 'project' } satisfies UniverseSelection;
    scene.add(mesh);
    pickable.push(mesh);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.03, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0, transparent: true })
    );
    ring.position.copy(position);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);
    return { label: addLabel(project.name, false), mesh, position, ring };
  });

  const edges = new Map<
    string,
    {
      agent: number;
      curve: THREE.QuadraticBezierCurve3;
      line: THREE.Line;
      material: THREE.LineBasicMaterial;
      project: number;
    }
  >();
  data.agents.forEach((agent, agentIndex) => {
    planets.forEach((planet, projectIndex) => {
      const start = stars[agentIndex].position;
      const middle = start.clone().add(planet.position).multiplyScalar(0.5);
      middle.y += 3 + start.distanceTo(planet.position) * 0.08;
      const curve = new THREE.QuadraticBezierCurve3(start.clone(), middle, planet.position.clone());
      const material = new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: agentColour(agent.name, agentIndex),
        depthWrite: false,
        opacity: 0,
        transparent: true,
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(36)),
        material
      );
      line.visible = false;
      scene.add(line);
      edges.set(edgeKey(agentIndex, projectIndex), {
        agent: agentIndex,
        curve,
        line,
        material,
        project: projectIndex,
      });
    });
  });

  const comets = Array.from({ length: MAX_COMETS }, () =>
    Array.from({ length: TAIL }, (_, step) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          map: glow,
          opacity: 1 - step / TAIL,
          transparent: true,
        })
      );
      sprite.scale.setScalar(1.2 - step * 0.13);
      sprite.visible = false;
      scene.add(sprite);
      return sprite;
    })
  );

  const outline = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.02, 8, 64),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  outline.visible = false;
  scene.add(outline);

  function resize() {
    const { clientHeight, clientWidth } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    orbit.radius = 50;
    if (camera.aspect < 1.5) orbit.radius = 60;
    if (camera.aspect < 1) orbit.radius = 78;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let dragging: { moved: number; x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    dragging = { moved: 0, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent) => {
    const clicked = dragging && dragging.moved < 5;
    dragging = null;
    if (!clicked) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    onSelect((hit?.object.userData.selection as undefined | UniverseSelection) ?? null);
  };
  const onPointerCancel = () => {
    dragging = null;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const moveX = event.clientX - dragging.x;
    const moveY = event.clientY - dragging.y;
    orbit.azimuth -= moveX * 0.006;
    orbit.elevation = Math.max(-0.2, Math.min(1.3, orbit.elevation + moveY * 0.004));
    dragging = {
      moved: dragging.moved + Math.abs(moveX) + Math.abs(moveY),
      x: event.clientX,
      y: event.clientY,
    };
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointermove', onPointerMove);

  const projected = new THREE.Vector3();
  function placeLabel(
    element: HTMLElement,
    position: THREE.Vector3,
    offset: number,
    opacity: number
  ) {
    projected.copy(position);
    projected.y -= offset;
    projected.project(camera);
    element.style.left = `${((projected.x + 1) / 2) * labels.clientWidth}px`;
    element.style.top = `${((1 - projected.y) / 2) * labels.clientHeight}px`;
    element.style.opacity = String(projected.z < 1 ? opacity : 0);
  }

  let view: null | UniverseView = null;
  let frame = 0;
  let last = performance.now();
  function render(now: number) {
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (view) drawView(view, now, delta);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  function drawView(
    { hidden, playing, selection, state }: UniverseView,
    now: number,
    delta: number
  ) {
    const largestAgent = Math.max(1, ...state.agentTokens);
    const largestProject = Math.max(1, ...state.projectTokens);
    const liveAgents = new Set(state.live.map((item) => item.agent));
    const liveProjects = new Set(state.live.map((item) => item.project));
    const pulse = reducedMotion ? 1 : 1 + Math.sin(now * 0.004) * 0.07;

    stars.forEach((star, index) => {
      const off = hidden.has(index);
      const size = 0.55 + 0.85 * Math.sqrt(state.agentTokens[index] / largestAgent);
      star.core.visible = !off;
      star.halo.visible = !off;
      star.core.scale.setScalar(size);
      star.halo.scale.setScalar(size * (liveAgents.has(index) ? 9 * pulse : 6));
      star.halo.material.opacity = liveAgents.has(index) ? 0.95 : 0.5;
      placeLabel(star.label, star.position, size + 1.4, off ? 0 : 1);
    });
    const ripple = reducedMotion ? 0 : (now * 0.0008) % 0.5;
    planets.forEach((planet, index) => {
      const tokens = state.projectTokens[index];
      const size = tokens ? 0.6 + 1.1 * Math.sqrt(tokens / largestProject) : 0.4;
      const live = liveProjects.has(index);
      planet.mesh.scale.setScalar(size);
      planet.mesh.material.emissiveIntensity = live ? 0.5 : 0.12;
      planet.ring.visible = live;
      planet.ring.scale.setScalar(size * (1 + ripple));
      planet.ring.material.opacity = 0.5 * (1 - ripple / 0.5);
      placeLabel(planet.label, planet.position, size + 1, tokens ? 0.95 : 0.4);
    });
    for (const [key, edge] of edges) {
      const facts = state.edges.get(key);
      edge.line.visible = Boolean(facts);
      if (!facts) continue;
      const related =
        !selection ||
        (selection.kind === 'agent'
          ? selection.index === edge.agent
          : selection.index === edge.project);
      const strength = 0.22 + Math.min(facts.sessions.size / 30, 1) * 0.3;
      edge.material.opacity =
        (strength + (state.liveHeat.get(key) ?? 0) * 0.48) * (related ? 1 : 0.12);
    }

    comets.forEach((tail, index) => {
      const item = state.live[index];
      tail.forEach((sprite, step) => {
        sprite.visible = Boolean(item);
        if (!item) return;
        const edge = edges.get(edgeKey(item.agent, item.project));
        if (!edge) return;
        const phase = reducedMotion ? 0.55 : (now * 0.000_28 + index * 0.137) % 1;
        sprite.position.copy(edge.curve.getPoint(Math.max(0, phase - step * 0.014)));
        sprite.material.color.set(edge.material.color);
      });
    });

    outline.visible = Boolean(selection);
    if (selection) {
      const node =
        selection.kind === 'agent' ? stars[selection.index].core : planets[selection.index].mesh;
      outline.position.copy(node.position);
      outline.scale.setScalar(node.scale.x * 1.8);
      outline.quaternion.copy(camera.quaternion);
    }

    if (playing && !dragging && !reducedMotion) orbit.azimuth += delta * 0.06;
    const radius = orbit.radius * orbit.zoom;
    camera.position.set(
      radius * Math.cos(orbit.elevation) * Math.sin(orbit.azimuth),
      radius * Math.sin(orbit.elevation),
      radius * Math.cos(orbit.elevation) * Math.cos(orbit.azimuth)
    );
  }
  frame = requestAnimationFrame(render);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('pointermove', onPointerMove);
      labels.replaceChildren();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | undefined;
        material?.dispose();
      });
      glow.dispose();
      renderer.dispose();
    },
    update(next) {
      view = next;
    },
    zoom(factor) {
      orbit.zoom = Math.max(0.4, Math.min(1.5, orbit.zoom * factor));
    },
  };
}
