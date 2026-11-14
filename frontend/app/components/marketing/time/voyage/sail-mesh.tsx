'use client';

/* eslint-disable react/no-unknown-property -- React Three Fiber elements take three.js props. */

import { useEffect, useMemo } from 'react';

import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, MeshStandardMaterial, Vector3 } from 'three';

import { buildSails, type SailPlan } from './rig-plan';
import { buildSailGeometry, SAIL_GLSL } from './sails';
import { voyage } from './state';
import { sailTexture } from './textures';

const WIND_TEAL = new Color('#4fd1c5');
const toSun = new Vector3();
const view = new Vector3();
const windGlow = new Color();

interface SailUniforms {
  uDepth: { value: number };
  uGlow: { value: Color };
  uHeight: { value: number };
  uPhase: { value: number };
  uTime: { value: number };
  uWidth: { value: number };
  uWind: { value: number };
}

/**
 * A sailcloth material whose vertex shader billows the cloth (the closed-form belly in
 * sails.ts, zero at the head) and recomputes the normal from the same function, so light
 * follows every fold. Backlit cloth glows with the sun behind it.
 */
function sailMaterial(plan: SailPlan, map: MeshStandardMaterial['map']) {
  const uniforms: SailUniforms = {
    uTime: { value: 0 },
    uWind: { value: 1 },
    uDepth: { value: plan.spec.depth },
    uPhase: { value: plan.spec.phase },
    uWidth: { value: (plan.spec.head + plan.spec.foot) / 2 },
    uHeight: { value: plan.spec.height },
    uGlow: { value: new Color(0, 0, 0) },
  };
  const material = new MeshStandardMaterial({
    color: '#efe4cc',
    map,
    roughness: 0.92,
    metalness: 0,
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      `${SAIL_GLSL}\nuniform float uWidth;\nuniform float uHeight;\n${shader.vertexShader}`
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
        float sailE = 0.02;
        float sailD = sailBillow(sail);
        float sailDu = (sailBillow(sail + vec2(sailE, 0.0)) - sailD) / sailE;
        float sailDv = (sailBillow(sail + vec2(0.0, sailE)) - sailD) / sailE;
        vec3 objectNormal = normalize(cross(vec3(sailDv, -uHeight, 0.0), vec3(sailDu, 0.0, uWidth)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(0.0, 0.0, 1.0);
        #endif
        `
        )
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = vec3(position) + vec3(sailBillow(sail), 0.0, 0.0);'
        );
    shader.fragmentShader = `uniform vec3 uGlow;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += uGlow * diffuseColor.rgb;'
    );
  };
  return { material, uniforms };
}

/** Every sail in the plan, billowing on its yard or stay. */
export function Sails() {
  const plans = useMemo(() => buildSails(), []);
  const map = useMemo(() => sailTexture(), []);
  const sails = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        geometry: buildSailGeometry(plan.spec, plan.kind === 'square' ? 20 : 12, 16),
        ...sailMaterial(plan, map),
      })),
    [map, plans]
  );
  useEffect(
    () => () => {
      for (const sail of sails) {
        sail.geometry.dispose();
        sail.material.dispose();
      }
      map.dispose();
    },
    [map, sails]
  );
  useFrame(({ camera }) => {
    // Sunlight through the cloth: strongest when the camera looks toward the sun.
    toSun.copy(voyage.sunDir);
    camera.getWorldDirection(view);
    const backlit = Math.max(0, view.dot(toSun)) ** 2 * voyage.daylight;
    for (const { uniforms } of sails) {
      uniforms.uTime.value = voyage.time;
      // AI focus: the wind from the agent hooks fills the sails a little harder.
      uniforms.uWind.value = 0.85 + 0.25 * voyage.ai;
      uniforms.uGlow.value
        .copy(voyage.sunColor)
        .multiplyScalar(backlit * 0.55)
        .add(windGlow.copy(WIND_TEAL).multiplyScalar(0.18 * Math.max(0, voyage.ai - 1)));
    }
  });
  return (
    <group>
      {sails.map(({ geometry, material, plan }) => (
        <mesh
          castShadow
          geometry={geometry}
          key={`${plan.origin.join(',')}`}
          material={material}
          position={plan.origin}
          rotation={plan.kind === 'square' ? [0, 0, 0] : [0, Math.PI / 2, plan.rake, 'ZYX']}
        />
      ))}
    </group>
  );
}
