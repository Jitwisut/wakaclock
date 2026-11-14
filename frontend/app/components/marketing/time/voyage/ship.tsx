'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo, useRef } from 'react';

import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  type InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';

import { dampFactor } from '../time-keyframes';

import {
  buildHull,
  deckHeight,
  gunwalePoints,
  halfWidthAt,
  hullX,
  sheerHeight,
  stationAt,
  STERN_X,
} from './hull';
import { barrelProfile, cannonProfile, fillSegments, lathe, unitCylinder } from './parts';
import {
  BOWSPRIT,
  buildRigging,
  buildYards,
  MAST_LEVELS,
  mastPoint,
  MASTS,
  type Vec3,
} from './rig-plan';
import { Sails } from './sail-mesh';
import { voyage } from './state';
import { deckTexture, hullTexture } from './textures';
import { surfaceHeight } from './waves';

const dummy = new Object3D();

/** Every material the ship is made of, shared across its parts. */
function useShipMaterials() {
  const materials = useMemo(() => {
    const hull = new MeshStandardMaterial({
      map: hullTexture(),
      roughness: 0.78,
      metalness: 0.04,
      side: DoubleSide,
    });
    const deck = new MeshStandardMaterial({ map: deckTexture(), roughness: 0.86, metalness: 0 });
    const timber = new MeshStandardMaterial({ color: '#4a3424', roughness: 0.8 });
    const darkTimber = new MeshStandardMaterial({ color: '#241912', roughness: 0.82 });
    const trim = new MeshStandardMaterial({ color: '#8c6431', roughness: 0.6, metalness: 0.15 });
    const brass = new MeshStandardMaterial({ color: '#b08445', roughness: 0.36, metalness: 0.85 });
    const iron = new MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.48, metalness: 0.75 });
    const rope = new MeshStandardMaterial({ color: '#3a2c1e', roughness: 0.95 });
    const mast = new MeshStandardMaterial({ color: '#6b4d33', roughness: 0.7 });
    const glass = new MeshStandardMaterial({
      color: '#2a1606',
      emissive: new Color('#ffae55'),
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    return { hull, deck, timber, darkTimber, trim, brass, iron, rope, mast, glass };
  }, []);
  useEffect(
    () => () => {
      for (const material of Object.values(materials)) {
        material.map?.dispose();
        material.dispose();
      }
    },
    [materials]
  );
  return materials;
}

type Materials = ReturnType<typeof useShipMaterials>;

function useDisposable<T extends { dispose: () => void }>(factory: () => T, deps: unknown[] = []) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass their own deps
  const value = useMemo(factory, deps);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

/* ---------- hull, deck, bulkheads and rails ---------- */

function HullBody({ materials }: { materials: Materials }) {
  const { deck, hull } = useMemo(() => buildHull(64, 22), []);
  useEffect(
    () => () => {
      hull.dispose();
      deck.dispose();
    },
    [deck, hull]
  );
  // The keel: a deep timber fin along the bottom, running up into the stem.
  const keel = useDisposable(() => {
    const points = Array.from({ length: 24 }, (_, index) => {
      const s = index / 23;
      return new Vector3(hullX(s, 0.02), -2.35 + 1.6 * Math.max(0, s - 0.72) ** 1.3 * 3, 0);
    });
    return new TubeGeometry(new CatmullRomCurve3(points), 64, 0.14, 6, false);
  });
  return (
    <group>
      <mesh castShadow geometry={hull} material={materials.hull} receiveShadow />
      <mesh geometry={deck} material={materials.deck} receiveShadow />
      <mesh geometry={keel} material={materials.darkTimber} />
    </group>
  );
}

/** Cap rails along both sheers and the breaks of the quarterdeck and forecastle. */
function RailsAndBulkheads({ materials }: { materials: Materials }) {
  const rails = useDisposable(() => {
    const geometries = ([1, -1] as const).map(
      (side) =>
        new TubeGeometry(
          new CatmullRomCurve3(
            gunwalePoints(40, side, 0, 0.985).map((p) => new Vector3(p[0], p[1] + 0.05, p[2]))
          ),
          160,
          0.075,
          6,
          false
        )
    );
    return { geometries, dispose: () => geometries.forEach((geometry) => geometry.dispose()) };
  });
  // Balusters along the front of the quarterdeck and forecastle, and their rails.
  const balusterMesh = useRef<InstancedMesh>(null);
  const balusters = useMemo(() => {
    const posts: { from: Vec3; radius: number; to: Vec3 }[] = [];
    for (const s of [0.315, 0.83]) {
      const x = STERN_X + s * 17;
      const y = deckHeight(s + (s < 0.5 ? -0.05 : 0.05));
      const width = halfWidthAt(s, y) - 0.15;
      for (let z = -width; z <= width; z += 0.32) {
        if (Math.abs(z) < 0.9 && s < 0.5) continue; // the stair opening amidships
        posts.push({ from: [x, y, z], to: [x, y + 0.85, z], radius: 0.035 });
      }
    }
    return posts;
  }, []);
  const balusterGeometry = useDisposable(() => new CylinderGeometry(1, 0.8, 1, 6));
  useEffect(() => {
    if (balusterMesh.current) fillSegments(balusterMesh.current, balusters);
  }, [balusters]);
  const bulkheads = useMemo(
    () =>
      [0.315, 0.83].map((s) => {
        const low = deckHeight(s < 0.5 ? s + 0.05 : s - 0.05);
        const high = deckHeight(s < 0.5 ? s - 0.05 : s + 0.05);
        const width = halfWidthAt(s, high) * 2 - 0.1;
        return { x: STERN_X + s * 17, y: (low + high) / 2, height: high - low, width };
      }),
    []
  );
  return (
    <group>
      {rails.geometries.map((geometry) => (
        <mesh castShadow geometry={geometry} key={geometry.uuid} material={materials.timber} />
      ))}
      <instancedMesh
        args={[balusterGeometry, materials.timber, balusters.length]}
        castShadow
        ref={balusterMesh}
      />
      {bulkheads.map((bulkhead) => (
        <group key={bulkhead.x}>
          <mesh material={materials.darkTimber} position={[bulkhead.x, bulkhead.y, 0]}>
            <boxGeometry args={[0.12, bulkhead.height, bulkhead.width]} />
          </mesh>
          {/* Hand rail on top of the balusters. */}
          <mesh
            material={materials.trim}
            position={[bulkhead.x, bulkhead.y + bulkhead.height / 2 + 0.88, 0]}
          >
            <boxGeometry args={[0.1, 0.07, bulkhead.width - 0.2]} />
          </mesh>
        </group>
      ))}
      <Stairs materials={materials} />
    </group>
  );
}

/** Two short companionways from the main deck up to the quarterdeck. */
function Stairs({ materials }: { materials: Materials }) {
  const mesh = useRef<InstancedMesh>(null);
  const steps = useMemo(() => {
    const s = 0.315;
    const low = deckHeight(s + 0.05);
    const high = deckHeight(s - 0.05);
    const x = STERN_X + s * 17;
    const count = 6;
    return [-0.5, 0.5].flatMap((z) =>
      Array.from({ length: count }, (_, index) => ({
        position: [
          x + 0.25 + (count - index) * 0.2,
          low + ((index + 1) * (high - low)) / count - 0.05,
          z,
        ] as Vec3,
      }))
    );
  }, []);
  const geometry = useDisposable(() => new BoxGeometry(0.24, 0.06, 0.62));
  useEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    for (const [index, step] of steps.entries()) {
      dummy.position.set(...step.position);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
    }
    instance.instanceMatrix.needsUpdate = true;
  }, [steps]);
  return <instancedMesh args={[geometry, materials.timber, steps.length]} castShadow ref={mesh} />;
}

/* ---------- guns ---------- */

const GUNS_PER_SIDE = 6;

function gunPositions() {
  return ([1, -1] as const).flatMap((side) =>
    Array.from({ length: GUNS_PER_SIDE }, (_, index) => {
      const x = -2.3 + index * 1.15;
      const s = stationAt(x);
      const y = deckHeight(s) + 0.45;
      const z = side * halfWidthAt(s, y);
      // The hull's slope at this station, so ports sit flush to the planking.
      const ahead = halfWidthAt(stationAt(x + 0.3), y);
      const behind = halfWidthAt(stationAt(x - 0.3), y);
      const yaw = Math.atan2(ahead - behind, 0.6) * side;
      return { side, x, y, z, yaw };
    })
  );
}

/** Gunports framed in the hull, cannon barrels run out through them, carriages inboard. */
function Guns({ materials }: { materials: Materials }) {
  const guns = useMemo(() => gunPositions(), []);
  const portFrame = useRef<InstancedMesh>(null);
  const portHole = useRef<InstancedMesh>(null);
  const lid = useRef<InstancedMesh>(null);
  const barrel = useRef<InstancedMesh>(null);
  const carriage = useRef<InstancedMesh>(null);
  const wheels = useRef<InstancedMesh>(null);
  const geometries = useDisposable(() => {
    const parts = {
      frame: new BoxGeometry(0.62, 0.56, 0.08),
      hole: new BoxGeometry(0.46, 0.4, 0.1),
      lid: new BoxGeometry(0.6, 0.54, 0.05),
      barrel: lathe(cannonProfile(), 14),
      carriage: new BoxGeometry(0.62, 0.22, 0.46),
      wheel: new CylinderGeometry(0.11, 0.11, 0.06, 10),
    };
    return {
      ...parts,
      dispose: () => Object.values(parts).forEach((geometry) => geometry.dispose()),
    };
  });

  useEffect(() => {
    const set = (
      mesh: InstancedMesh | null,
      index: number,
      apply: (gun: (typeof guns)[number]) => void,
      gun: (typeof guns)[number]
    ) => {
      if (!mesh) return;
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      apply(gun);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    for (const [index, gun] of guns.entries()) {
      const out = gun.side * 0.02;
      set(
        portFrame.current,
        index,
        (g) => {
          dummy.position.set(g.x, g.y, g.z + out);
          dummy.rotation.set(0, -g.yaw, 0);
        },
        gun
      );
      set(
        portHole.current,
        index,
        (g) => {
          dummy.position.set(g.x, g.y, g.z + out * 2.5);
          dummy.rotation.set(0, -g.yaw, 0);
        },
        gun
      );
      // Port lids hinged at the top, swung open.
      set(
        lid.current,
        index,
        (g) => {
          dummy.position.set(g.x, g.y + 0.42, g.z + g.side * 0.2);
          dummy.rotation.set(g.side * -0.95, -g.yaw, 0);
        },
        gun
      );
      set(
        barrel.current,
        index,
        (g) => {
          dummy.position.set(g.x, g.y - 0.02, g.z - g.side * 0.12);
          dummy.rotation.set(g.side * (Math.PI / 2), 0, 0);
          dummy.scale.setScalar(1.15);
        },
        gun
      );
      set(
        carriage.current,
        index,
        (g) => {
          dummy.position.set(g.x, g.y - 0.3, g.z - g.side * 0.75);
        },
        gun
      );
      for (let w = 0; w < 4; w += 1) {
        const wheelIndex = index * 4 + w;
        set(
          wheels.current,
          wheelIndex,
          (g) => {
            dummy.position.set(
              g.x + (w % 2 === 0 ? -0.3 : 0.3),
              g.y - 0.4,
              g.z - g.side * (w < 2 ? 0.58 : 0.92)
            );
            dummy.rotation.set(0, 0, Math.PI / 2);
          },
          gun
        );
      }
    }
    for (const mesh of [portFrame, portHole, lid, barrel, carriage, wheels]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [guns]);

  const holeMaterial = useDisposable(
    () => new MeshStandardMaterial({ color: '#050403', roughness: 1 })
  );
  return (
    <group>
      <instancedMesh args={[geometries.frame, materials.trim, guns.length]} ref={portFrame} />
      <instancedMesh args={[geometries.hole, holeMaterial, guns.length]} ref={portHole} />
      <instancedMesh
        args={[geometries.lid, materials.darkTimber, guns.length]}
        castShadow
        ref={lid}
      />
      <instancedMesh
        args={[geometries.barrel, materials.iron, guns.length]}
        castShadow
        ref={barrel}
      />
      <instancedMesh args={[geometries.carriage, materials.timber, guns.length]} ref={carriage} />
      <instancedMesh
        args={[geometries.wheel, materials.darkTimber, guns.length * 4]}
        ref={wheels}
      />
    </group>
  );
}

/* ---------- the stern ---------- */

/** The stern: lit gallery windows, a balcony, carved trim and quarter galleries. */
function Stern({ materials }: { materials: Materials }) {
  const deck = deckHeight(0);
  const sheer = sheerHeight(0);
  const windowRows = useMemo(
    () =>
      [deck - 0.55, deck + 0.55].flatMap((y, row) =>
        Array.from({ length: 5 }, (_, index) => {
          const z = (index - 2) * 0.55;
          const v = (y + 2.25) / (sheer + 2.25);
          return { position: [hullX(0, v) - 0.04, y, z] as Vec3, row };
        })
      ),
    [deck, sheer]
  );
  const trim = useDisposable(() => {
    const points = Array.from({ length: 17 }, (_, index) => {
      const t = index / 16;
      const z = (t - 0.5) * 2 * (halfWidthAt(0, sheer) - 0.05);
      const y = sheer + 0.12 + Math.cos((t - 0.5) * Math.PI) * 0.35;
      return new Vector3(hullX(0, 1) - 0.05, y, z);
    });
    return new TubeGeometry(new CatmullRomCurve3(points), 48, 0.07, 6, false);
  });
  const balconyZ = halfWidthAt(0, deck) * 2 - 0.3;
  return (
    <group>
      {windowRows.map(({ position, row }) => (
        <group key={`${row}:${position[2]}`} position={position}>
          <mesh material={materials.glass}>
            <boxGeometry args={[0.04, 0.42, 0.36]} />
          </mesh>
          <mesh material={materials.trim} position={[-0.02, 0, 0]}>
            <boxGeometry args={[0.03, 0.5, 0.05]} />
          </mesh>
          <mesh material={materials.trim} position={[-0.02, 0.24, 0]}>
            <boxGeometry args={[0.03, 0.05, 0.44]} />
          </mesh>
        </group>
      ))}
      {/* The stern gallery: a walkway with a turned balustrade. */}
      <mesh material={materials.darkTimber} position={[hullX(0, 0.62) - 0.35, deck - 0.95, 0]}>
        <boxGeometry args={[0.7, 0.08, balconyZ]} />
      </mesh>
      <mesh material={materials.trim} position={[hullX(0, 0.62) - 0.68, deck - 0.5, 0]}>
        <boxGeometry args={[0.06, 0.06, balconyZ]} />
      </mesh>
      {Array.from({ length: 11 }, (_, index) => (
        <mesh
          key={index}
          material={materials.timber}
          position={[hullX(0, 0.62) - 0.68, deck - 0.72, (index / 10 - 0.5) * (balconyZ - 0.1)]}
        >
          <cylinderGeometry args={[0.025, 0.03, 0.42, 6]} />
        </mesh>
      ))}
      <mesh geometry={trim} material={materials.brass} />
      {/* Quarter galleries: small enclosed bays on each quarter, with their own lights. */}
      {([1, -1] as const).map((side) => (
        <group
          key={side}
          position={[STERN_X + 1.2, deck - 0.1, side * (halfWidthAt(0.07, deck) + 0.2)]}
        >
          <mesh castShadow material={materials.darkTimber}>
            <boxGeometry args={[1.6, 1.5, 0.4]} />
          </mesh>
          <mesh material={materials.glass} position={[0.1, 0.1, side * 0.21]}>
            <boxGeometry args={[0.9, 0.4, 0.02]} />
          </mesh>
          <mesh material={materials.trim} position={[0, 0.8, 0]}>
            <boxGeometry args={[1.7, 0.1, 0.48]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- deck furniture ---------- */

function DeckFurniture({ materials }: { materials: Materials }) {
  const barrels = useRef<InstancedMesh>(null);
  const hoops = useRef<InstancedMesh>(null);
  const crates = useRef<InstancedMesh>(null);
  const coils = useRef<InstancedMesh>(null);
  const pins = useRef<InstancedMesh>(null);
  const geometries = useDisposable(() => {
    const parts = {
      barrel: lathe(barrelProfile(), 14),
      hoop: new TorusGeometry(0.4, 0.018, 5, 18),
      crate: new BoxGeometry(0.6, 0.5, 0.6),
      coil: new TorusGeometry(0.24, 0.06, 6, 18),
      pin: new CylinderGeometry(0.02, 0.025, 0.36, 5),
    };
    return {
      ...parts,
      dispose: () => Object.values(parts).forEach((geometry) => geometry.dispose()),
    };
  });
  const layout = useMemo(() => {
    const main = deckHeight(0.55);
    const fore = deckHeight(0.9);
    const quarter = deckHeight(0.15);
    const barrelSpots: Vec3[] = [
      [-1.9, main + 0.32, 1.35],
      [-1.35, main + 0.32, 1.5],
      [-1.6, main + 0.32, 0.85],
      [-1.6, main + 0.96, 1.2],
      [6.6, fore + 0.32, -0.9],
      [6.9, fore + 0.32, -0.35],
    ];
    const crateSpots: [number, number, number, number][] = [
      [2.8, main + 0.25, -1.4, 0.2],
      [3.4, main + 0.25, -1.35, -0.15],
      [3.1, main + 0.75, -1.38, 0.05],
      [-6.9, quarter + 0.25, 1.1, 0.3],
    ];
    const coilSpots: Vec3[] = MASTS.flatMap((mast) => [
      [mast.x - 0.7, mast.deck + 0.07, 0.55],
      [mast.x - 0.7, mast.deck + 0.07, -0.55],
    ]);
    // Fife rails: a ring of belaying pins around each mast foot.
    const pinSpots: Vec3[] = MASTS.flatMap((mast) =>
      Array.from({ length: 10 }, (_, index) => {
        const z = (index / 9 - 0.5) * 1.5;
        return [mast.x + 0.65, mast.deck + 0.95, z] as Vec3;
      })
    );
    return { barrelSpots, crateSpots, coilSpots, pinSpots };
  }, []);
  useEffect(() => {
    const place = (
      mesh: InstancedMesh | null,
      index: number,
      position: Vec3,
      rotation: Vec3 = [0, 0, 0],
      size = 1
    ) => {
      if (!mesh) return;
      dummy.position.set(...position);
      dummy.rotation.set(...rotation);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };
    layout.barrelSpots.forEach((spot, index) => {
      place(barrels.current, index, spot, [0, index * 0.7, 0], 0.62);
      place(hoops.current, index * 2, [spot[0], spot[1] + 0.2, spot[2]], [Math.PI / 2, 0, 0], 0.62);
      place(
        hoops.current,
        index * 2 + 1,
        [spot[0], spot[1] - 0.2, spot[2]],
        [Math.PI / 2, 0, 0],
        0.62
      );
    });
    layout.crateSpots.forEach(([x, y, z, yaw], index) =>
      place(crates.current, index, [x, y, z], [0, yaw, 0])
    );
    layout.coilSpots.forEach((spot, index) =>
      place(coils.current, index, spot, [Math.PI / 2, 0, 0])
    );
    layout.pinSpots.forEach((spot, index) => place(pins.current, index, spot));
    for (const mesh of [barrels, hoops, crates, coils, pins]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [layout]);
  const capstan = useDisposable(() =>
    lathe(
      [
        [0, 0],
        [0.42, 0],
        [0.42, 0.12],
        [0.3, 0.16],
        [0.26, 0.6],
        [0.36, 0.66],
        [0.36, 0.78],
        [0, 0.8],
      ],
      16
    )
  );
  const main = deckHeight(0.55);
  return (
    <group>
      <instancedMesh
        args={[geometries.barrel, materials.timber, layout.barrelSpots.length]}
        castShadow
        ref={barrels}
      />
      <instancedMesh
        args={[geometries.hoop, materials.iron, layout.barrelSpots.length * 2]}
        ref={hoops}
      />
      <instancedMesh
        args={[geometries.crate, materials.timber, layout.crateSpots.length]}
        castShadow
        ref={crates}
      />
      <instancedMesh
        args={[geometries.coil, materials.rope, layout.coilSpots.length]}
        ref={coils}
      />
      <instancedMesh args={[geometries.pin, materials.trim, layout.pinSpots.length]} ref={pins} />
      {MASTS.map((mast) => (
        <mesh
          key={mast.name}
          material={materials.timber}
          position={[mast.x + 0.65, mast.deck + 0.78, 0]}
        >
          <boxGeometry args={[0.12, 0.1, 1.7]} />
        </mesh>
      ))}
      {/* The capstan amidships. */}
      <mesh castShadow geometry={capstan} material={materials.timber} position={[2.1, main, 0]} />
      {/* Hatches with gratings. */}
      {[
        [-0.9, 1.3],
        [3.6, 1],
      ].map(([x, length]) => (
        <group key={x} position={[x as number, main + 0.12, 0]}>
          <mesh material={materials.darkTimber}>
            <boxGeometry args={[length as number, 0.22, 1.2]} />
          </mesh>
          <mesh material={materials.timber} position={[0, 0.12, 0]}>
            <boxGeometry args={[(length as number) - 0.16, 0.03, 1.04]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- masts, yards and rigging ---------- */

function Spars({ materials }: { materials: Materials }) {
  const yards = useMemo(() => buildYards(), []);
  const spars = useMemo(() => {
    const segments: { from: Vec3; radius: number; to: Vec3 }[] = [];
    for (const mast of MASTS) {
      const foot: Vec3 = [mast.x, mast.deck - 0.2, 0];
      const top = mastPoint(mast, MAST_LEVELS.top + 0.03);
      const cross = mastPoint(mast, MAST_LEVELS.crosstrees + 0.03);
      const truck = mastPoint(mast, 1);
      // Each upper section overlaps the one below at the doubling, like a real mast.
      segments.push(
        { from: foot, to: top, radius: mast.radius },
        { from: mastPoint(mast, MAST_LEVELS.top - 0.04), to: cross, radius: mast.radius * 0.66 },
        {
          from: mastPoint(mast, MAST_LEVELS.crosstrees - 0.03),
          to: truck,
          radius: mast.radius * 0.42,
        }
      );
    }
    for (const yard of yards) {
      const [x, y] = yard.center;
      segments.push({
        from: [x + 0.25, y, -yard.width / 2],
        to: [x + 0.25, y, yard.width / 2],
        radius: yard.radius,
      });
    }
    segments.push({ from: BOWSPRIT.from, to: BOWSPRIT.to, radius: 0.2 });
    // The spanker's gaff and boom.
    const mizzen = MASTS[2];
    if (mizzen) {
      segments.push(
        {
          from: mastPoint(mizzen, 0.52),
          to: [mizzen.x - 5, mizzen.deck + mizzen.height * 0.6, 0],
          radius: 0.08,
        },
        {
          from: mastPoint(mizzen, 0.12),
          to: [mizzen.x - 5.9, mizzen.deck + mizzen.height * 0.13, 0],
          radius: 0.09,
        }
      );
    }
    return segments;
  }, [yards]);
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useDisposable(() => new CylinderGeometry(1, 1, 1, 10, 1));
  useEffect(() => {
    if (mesh.current) fillSegments(mesh.current, spars);
  }, [spars]);
  return (
    <group>
      <instancedMesh args={[geometry, materials.mast, spars.length]} castShadow ref={mesh} />
      {MASTS.map((mast) => {
        const top = mastPoint(mast, MAST_LEVELS.top);
        const cross = mastPoint(mast, MAST_LEVELS.crosstrees);
        return (
          <group key={mast.name}>
            {/* The top: a platform where the lower mast meets the topmast. */}
            <mesh
              castShadow
              material={materials.darkTimber}
              position={[top[0] - 0.15, top[1] + 0.05, 0]}
            >
              <boxGeometry args={[1.5, 0.12, 2.8]} />
            </mesh>
            <mesh material={materials.darkTimber} position={[cross[0], cross[1] + 0.04, 0]}>
              <boxGeometry args={[0.5, 0.08, 1.4]} />
            </mesh>
            {/* Mast caps and iron bands. */}
            <mesh material={materials.iron} position={[top[0], top[1] + 0.35, 0]}>
              <boxGeometry args={[0.7, 0.18, 0.4]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Rigging({ materials }: { materials: Materials }) {
  const { ratlines, ropes } = useMemo(() => buildRigging(), []);
  const ropeMesh = useRef<InstancedMesh>(null);
  const ratlineMesh = useRef<InstancedMesh>(null);
  const geometry = useDisposable(() => unitCylinder(4));
  useEffect(() => {
    if (ropeMesh.current) fillSegments(ropeMesh.current, ropes);
    if (ratlineMesh.current) fillSegments(ratlineMesh.current, ratlines);
  }, [ratlines, ropes]);
  return (
    <group>
      <instancedMesh args={[geometry, materials.rope, ropes.length]} ref={ropeMesh} />
      <instancedMesh args={[geometry, materials.rope, ratlines.length]} ref={ratlineMesh} />
    </group>
  );
}

/* ---------- buoyancy ---------- */

const PROBES: readonly [number, number][] = [
  [6.2, 0],
  [-6.4, 0],
  [0, 2.2],
  [0, -2.2],
];

/** Draft offset: how far the waterline sits below the ship's origin when floating level. */
const DRAFT = 0;

/**
 * The ship floats on the same wave field the ocean draws: four hull probes give heave,
 * pitch and roll, eased so the hull has weight instead of following every ripple.
 */
function useBuoyancy(group: React.RefObject<Group | null>) {
  const state = useRef({ y: 0, pitch: 0, roll: 0, ready: false });
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = voyage.time;
    // Probes ride with the ship: sample the sea where each one is on the water now.
    const cos = Math.cos(voyage.shipHeading);
    const sin = Math.sin(voyage.shipHeading);
    const [bow, stern, starboard, port] = PROBES.map(([x, z]) =>
      surfaceHeight(
        voyage.shipX + x * cos + z * sin,
        voyage.shipZ - x * sin + z * cos,
        t,
        3,
        voyage.sea
      )
    ) as [number, number, number, number];
    const targetY = (bow + stern + starboard + port) / 4 - DRAFT;
    const targetPitch = Math.atan2(bow - stern, 12.6) * 0.85;
    const targetRoll = Math.atan2(starboard - port, 4.4) * 0.6;
    const { current } = state;
    if (!current.ready) {
      current.y = targetY;
      current.pitch = targetPitch;
      current.roll = targetRoll;
      current.ready = true;
    }
    const heave = dampFactor(delta, 2.4);
    current.y += (targetY - current.y) * heave;
    current.pitch += (targetPitch - current.pitch) * dampFactor(delta, 1.8);
    current.roll += (targetRoll - current.roll) * dampFactor(delta, 1.5);
    const node = group.current;
    if (!node) return;
    node.position.y = current.y;
    // Pitch about Z (bow up = positive), roll about X, a slow yaw for the helmsman's hand.
    node.rotation.set(-current.roll, Math.sin(t * 0.11) * 0.012, current.pitch, 'YZX');
  });
}

/** The whole ship, floating; children (helm, lanterns) ride with it. */
export function Ship({ children }: { children?: React.ReactNode }) {
  const materials = useShipMaterials();
  const group = useRef<Group>(null);
  useBuoyancy(group);
  useFrame(() => {
    // Lantern-lit windows glow brighter as dusk falls.
    materials.glass.emissiveIntensity = 0.6 + voyage.lanterns * 2.2 * (0.6 + 0.4 * voyage.human);
  });
  return (
    <group ref={group}>
      <HullBody materials={materials} />
      <RailsAndBulkheads materials={materials} />
      <Guns materials={materials} />
      <Stern materials={materials} />
      <DeckFurniture materials={materials} />
      <Spars materials={materials} />
      <Rigging materials={materials} />
      <Sails />
      {children}
    </group>
  );
}
