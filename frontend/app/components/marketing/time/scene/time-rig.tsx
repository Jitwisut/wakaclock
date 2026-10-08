'use client';

import { useMemo } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, type PerspectiveCamera, Vector3 } from 'three';

import {
  CAMERA_KEYS,
  cameraParameterAt,
  dampFactor,
  handMinuteAt,
  warpTarget,
} from '../time-keyframes';
import { timeMotion } from '../time-store';

const position = new Vector3();
const look = new Vector3();
const BASE_FOV = 36;

/**
 * Eases the story position toward the scroll target, then flies the camera along a spline
 * through the chapter compositions. Runs first each frame (priority -1) so everything else
 * reads this frame's story position.
 */
export function TimeRig({ parallax }: { parallax: boolean }) {
  const { camera, size } = useThree();
  const { path, target } = useMemo(
    () => ({
      path: new CatmullRomCurve3(
        CAMERA_KEYS.map((key) => new Vector3(...key.pos)),
        false,
        'centripetal'
      ),
      target: new CatmullRomCurve3(
        CAMERA_KEYS.map((key) => new Vector3(...key.look)),
        false,
        'centripetal'
      ),
    }),
    []
  );

  useFrame((_, rawDelta) => {
    // A resumed frameloop or a background tab delivers one huge delta: never let it read
    // as speed.
    const delta = Math.min(rawDelta, 0.1);
    const previousHand = timeMotion.hand;
    const teleported = timeMotion.teleport;
    if (teleported) {
      timeMotion.current = timeMotion.target;
      timeMotion.teleport = false;
      timeMotion.velocity = 0;
      timeMotion.warp = 0;
    } else {
      timeMotion.current += (timeMotion.target - timeMotion.current) * dampFactor(delta);
    }
    // Warp follows scroll speed, quick to rise and slower to settle; the speed itself decays
    // between scroll events so a stopped page relaxes back to rest.
    const wanted = warpTarget(timeMotion.velocity);
    const rate = wanted > timeMotion.warp ? 7 : 2.4;
    timeMotion.warp += (wanted - timeMotion.warp) * dampFactor(delta, rate);
    timeMotion.velocity *= Math.exp(-delta * 6);

    timeMotion.hand = handMinuteAt(timeMotion.current);
    if (teleported || delta <= 0) {
      timeMotion.handSpeed = 0;
    } else {
      const speed = (timeMotion.hand - previousHand) / delta;
      timeMotion.handSpeed += (speed - timeMotion.handSpeed) * dampFactor(delta, 8);
    }

    const lens = camera as PerspectiveCamera;
    const fov = BASE_FOV + timeMotion.warp * 9;
    if (Math.abs(lens.fov - fov) > 0.01) {
      lens.fov = fov;
      lens.updateProjectionMatrix();
    }
    const u = cameraParameterAt(timeMotion.current);
    path.getPoint(u, position);
    target.getPoint(u, look);

    // Portrait screens put the text above the scene: centre the ring and step back.
    if (size.width < size.height) {
      look.x *= 0.1;
      position.x *= 0.55;
      position.z += 3.2;
    }
    if (parallax) {
      position.x += timeMotion.pointerX * 0.35;
      position.y += timeMotion.pointerY * 0.22;
    }
    camera.position.copy(position);
    camera.lookAt(look);
  }, -1);

  return null;
}
