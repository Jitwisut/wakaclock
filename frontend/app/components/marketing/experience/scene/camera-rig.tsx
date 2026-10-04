'use client';

import { useMemo } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, Vector3 } from 'three';

import { CAMERA_KEYS, cameraParameterAt } from './keyframes';
import { advanceStory, story } from './story-clock';

const look = new Vector3();
const position = new Vector3();

/**
 * Drives the camera along a spline through the chapter compositions, adds a restrained
 * pointer parallax. The canvas is transparent; the lit backdrop behind it is CSS. Runs first each frame
 * (priority -1) so every other component reads this frame's story position.
 */
export function CameraRig({ parallax }: { parallax: boolean }) {
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

  useFrame((_, delta) => {
    advanceStory(delta);
    const g = story.current;
    const u = cameraParameterAt(g);
    path.getPoint(u, position);
    target.getPoint(u, look);

    // On a portrait screen the text sits above the scene, so centre the structure.
    const portrait = size.width < size.height;
    if (portrait) look.x *= 0.15;

    if (parallax) {
      position.x += story.pointerX * 0.42;
      position.y += story.pointerY * 0.26;
    }
    camera.position.copy(position);
    camera.lookAt(look);
    story.focusDistance = position.distanceTo(look);
  }, -1);

  return null;
}
