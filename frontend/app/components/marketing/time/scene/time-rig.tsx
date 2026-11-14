'use client';

import { useMemo } from 'react';

import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, type PerspectiveCamera, Vector3 } from 'three';

import {
  CAMERA_KEYS,
  cameraParameterAt,
  dampFactor,
  DAY_CAMERA_KEYS,
  dayCameraParameterAt,
  daylightAt,
  handMinuteAt,
  warpTarget,
} from '../time-keyframes';
import { getTimeUi, timeMotion } from '../time-store';
import { CHART_POSE, HOME_DUSK, tourKeys } from '../voyage/world-places';

const position = new Vector3();
const look = new Vector3();
const away = new Vector3();
const worldPos = new Vector3();
const worldLook = new Vector3();
const wantedPos = new Vector3();
const wantedLook = new Vector3();
/** World-mode camera state: where it is, and the eased time of day. */
const world = { ready: false, dusk: HOME_DUSK };
const TOUR_KEYS = tourKeys();
/** How far the camera climbs between two stops: higher for longer crossings. */
const TOUR_LIFT = TOUR_KEYS.slice(1).map((key, index) => {
  const from = TOUR_KEYS[index] as (typeof TOUR_KEYS)[number];
  const length = Math.hypot(
    key.pos[0] - from.pos[0],
    key.pos[1] - from.pos[1],
    key.pos[2] - from.pos[2]
  );
  return Math.min(24, length * 0.1);
});

/**
 * The scroll sets a target; the tour position glides after it, so a wheel's separate notches
 * and a finger's small jitters become one continuous movement.
 */
function glideTour(delta: number) {
  const gap = timeMotion.tourTarget - timeMotion.tour;
  timeMotion.tour =
    Math.abs(gap) < 1e-4 ? timeMotion.tourTarget : timeMotion.tour + gap * dampFactor(delta, 2.1);
}

/** Moves the world camera toward this frame's goal (`wantedPos`, `wantedLook`). */
function chaseTour(delta: number, portrait: boolean) {
  if (timeMotion.chart) {
    // The sea chart: high over the archipelago, looking almost straight down.
    const tall = portrait ? 1.75 : 1;
    wantedPos.set(CHART_POSE.pos[0], CHART_POSE.pos[1] * tall, CHART_POSE.pos[2]);
    wantedLook.set(...CHART_POSE.look);
    worldPos.lerp(wantedPos, dampFactor(delta, 2));
    worldLook.lerp(wantedLook, dampFactor(delta, 2.4));
  } else {
    // Far from the goal (a jump across the map): rise first, settle as it nears.
    const remaining = worldPos.distanceTo(wantedPos);
    wantedPos.y += Math.min(26, Math.max(0, remaining - 30) * 0.16);
    const chase = remaining > 200 ? 2 : 3.4;
    worldPos.lerp(wantedPos, dampFactor(delta, chase));
    worldLook.lerp(wantedLook, dampFactor(delta, chase + 0.4));
  }
}

/** Smooth step between stops, so the camera eases out of one place and into the next. */
function easeStop(t: number) {
  return t * t * (3 - 2 * t);
}
const BASE_FOV = 38;
/** Seconds the core takes to wake: darkness, machinery, energy lines, nucleus. */
export const WAKE_SECONDS = 3.4;
/** How far back the camera starts its approach during the awakening. */
const APPROACH_DISTANCE = 9;

/** Ease-out for the approach: fast at first, settling softly onto the composition. */
function approachEase(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * Eases the story position toward the scroll target, then flies the camera along a spline
 * through the chapter compositions. Runs first each frame (priority -1) so everything else
 * reads this frame's story position.
 */
export function TimeRig({ parallax }: { parallax: boolean }) {
  const { camera, size } = useThree();
  const day = useMemo(
    () => ({
      path: new CatmullRomCurve3(
        DAY_CAMERA_KEYS.map((key) => new Vector3(...key.pos)),
        false,
        'centripetal'
      ),
      target: new CatmullRomCurve3(
        DAY_CAMERA_KEYS.map((key) => new Vector3(...key.look)),
        false,
        'centripetal'
      ),
    }),
    []
  );
  const tour = useMemo(
    () => ({
      path: new CatmullRomCurve3(
        TOUR_KEYS.map((key) => new Vector3(...key.pos)),
        false,
        'centripetal'
      ),
      target: new CatmullRomCurve3(
        TOUR_KEYS.map((key) => new Vector3(...key.look)),
        false,
        'centripetal'
      ),
      center: new CatmullRomCurve3(
        TOUR_KEYS.map((key) => new Vector3(...key.center)),
        false,
        'centripetal'
      ),
    }),
    []
  );
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
      timeMotion.dayCurrent = timeMotion.dayTarget;
      timeMotion.daylight = daylightAt(timeMotion.dawnTarget);
      timeMotion.teleport = false;
      timeMotion.velocity = 0;
      timeMotion.warp = 0;
    } else {
      const ease = dampFactor(delta);
      timeMotion.current += (timeMotion.target - timeMotion.current) * ease;
      // The light page eases a little more slowly: a long, calm camera move.
      timeMotion.dayCurrent +=
        (timeMotion.dayTarget - timeMotion.dayCurrent) * dampFactor(delta, 2.2);
      const light = daylightAt(timeMotion.dawnTarget);
      timeMotion.daylight += (light - timeMotion.daylight) * ease;
    }
    // Warp follows scroll speed, quick to rise and slower to settle; the speed itself decays
    // between scroll events so a stopped page relaxes back to rest.
    const wanted = warpTarget(timeMotion.velocity);
    const rate = wanted > timeMotion.warp ? 7 : 2.4;
    timeMotion.warp += (wanted - timeMotion.warp) * dampFactor(delta, rate);
    timeMotion.velocity *= Math.exp(-delta * 6);

    if (!timeMotion.world) timeMotion.hand = handMinuteAt(timeMotion.current);
    if (teleported || delta <= 0) {
      timeMotion.handSpeed = 0;
    } else {
      const speed = (timeMotion.hand - previousHand) / delta;
      timeMotion.handSpeed += (speed - timeMotion.handSpeed) * dampFactor(delta, 8);
    }

    // The opening: the core wakes over a few seconds while the camera completes its
    // approach. Delta-based, so it is frame-rate independent and runs once.
    if (timeMotion.wake < 1 && delta > 0 && getTimeUi().sceneStatus === 'ready') {
      timeMotion.wake = Math.min(1, timeMotion.wake + delta / WAKE_SECONDS);
    }

    const lens = camera as PerspectiveCamera;
    const fov = BASE_FOV + timeMotion.warp * 5;
    if (Math.abs(lens.fov - fov) > 0.01) {
      lens.fov = fov;
      lens.updateProjectionMatrix();
    }
    // World mode: fly between places along a gentle arc, the light easing to each place's
    // hour. Otherwise below the story the camera follows the day path, which starts on the
    // story's last composition, so the two join without a jump.
    if (timeMotion.world) {
      // The scroll tour: a spline through every stop's composition. The camera chases the
      // point the scroll asks for, climbing between stops, so a slow scroll glides along the
      // route and a jump (a clicked place) becomes one direct flight.
      const last = TOUR_KEYS.length - 1;
      glideTour(delta);
      const at = Math.min(last, Math.max(0, timeMotion.tour));
      const stop = Math.min(last - 1, Math.floor(at));
      const within = easeStop(at - stop);
      const u = (stop + within) / last;
      tour.path.getPoint(u, wantedPos);
      tour.target.getPoint(u, wantedLook);
      wantedPos.y += Math.sin(within * Math.PI) * (TOUR_LIFT[stop] ?? 0);
      // On a portrait screen the reading sheet covers the lower part of the frame, not one
      // side: look straight at the landmark and aim a little below it, so it rises into the
      // strip of sea and sky left above the sheet.
      if (size.width < size.height) {
        tour.center.getPoint(u, wantedLook);
        wantedLook.y -= wantedPos.distanceTo(wantedLook) * 0.2 * Math.min(1, at);
      }
      const from = TOUR_KEYS[stop] as (typeof TOUR_KEYS)[number];
      const to = TOUR_KEYS[stop + 1] as (typeof TOUR_KEYS)[number];
      const dusk = from.dusk + (to.dusk - from.dusk) * within;
      if (!world.ready) {
        worldPos.copy(wantedPos);
        worldLook.copy(wantedLook);
        world.dusk = dusk;
        world.ready = true;
      }
      chaseTour(delta, size.width < size.height);
      world.dusk += (dusk - world.dusk) * dampFactor(delta, 1.2);
      timeMotion.hand = 480 + world.dusk * 960;
      position.copy(worldPos);
      look.copy(worldLook);
    } else if (timeMotion.dayCurrent > 1e-4) {
      const u = dayCameraParameterAt(timeMotion.dayCurrent);
      day.path.getPoint(u, position);
      day.target.getPoint(u, look);
    } else {
      const u = cameraParameterAt(timeMotion.current);
      path.getPoint(u, position);
      target.getPoint(u, look);
    }

    // Portrait screens are narrow: step back along the line of sight so the ship still
    // fits, without moving the camera sideways into anything.
    if (size.width < size.height) {
      away.subVectors(position, look);
      position.addScaledVector(away, 0.32);
    }
    if (timeMotion.wake < 1) {
      away.subVectors(position, look).normalize();
      position.addScaledVector(away, (1 - approachEase(timeMotion.wake)) * APPROACH_DISTANCE);
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
