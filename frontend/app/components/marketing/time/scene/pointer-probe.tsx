'use client';

import { useRef } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';

import { type ActivitySlice, sliceAt } from '../time-data';
import { minuteAtPoint, onRingBand } from '../time-keyframes';
import { setTimeUi, timeMotion } from '../time-store';

/** Anything a visitor might be reading: hovering there never opens the tooltip. */
const READING = '.tx-col, .tx-card, .tx-panel, .tx-tools, .tx-wide, .tx-pin, a, button, header';

const raycaster = new Raycaster();
const dialPlane = new Plane(new Vector3(0, 0, 1), 0);
const ndc = new Vector2();
const hit = new Vector3();

/**
 * Finds today's slice under the pointer by casting from the camera onto the dial's plane,
 * and publishes it for the tooltip. Only runs when the pointer actually moved.
 */
export function PointerProbe({ slices }: { slices: ActivitySlice[] }) {
  const { camera } = useThree();
  const last = useRef({ x: -1, y: -1 });

  useFrame(() => {
    const { clientX, clientY } = timeMotion;
    if (clientX === last.current.x && clientY === last.current.y) return;
    last.current = { x: clientX, y: clientY };

    const under = document.elementFromPoint(clientX, clientY);
    if (!under || under.closest(READING) || timeMotion.collapse > 0) {
      setTimeUi({ hover: null });
      return;
    }
    ndc.set(timeMotion.pointerX, timeMotion.pointerY);
    raycaster.setFromCamera(ndc, camera);
    const point = raycaster.ray.intersectPlane(dialPlane, hit);
    if (!point || !onRingBand(point.x, point.y)) {
      setTimeUi({ hover: null });
      return;
    }
    const slice = sliceAt(slices, minuteAtPoint(point.x, point.y));
    setTimeUi({
      hover: slice ? { kind: slice.kind, minute: slice.minute, x: clientX, y: clientY } : null,
    });
  });

  return null;
}
