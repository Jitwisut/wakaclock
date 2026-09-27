import { MathUtils } from 'three';

import { motion } from '../experience-store';

/**
 * The scene's own reading of the story position. Scroll sets `motion.target`; this value
 * follows it with critically-damped easing, which is what gives the camera weight — a
 * flick of the wheel carries on for a moment and settles instead of snapping.
 */
export const story = {
  current: 0,
  /** Camera-to-subject distance this frame; the shader's depth-of-field focus. */
  focusDistance: 9,
  pointerX: 0,
  pointerY: 0,
};

export function advanceStory(delta: number) {
  // Clamp delta so a backgrounded tab does not jump the whole story on return.
  const dt = Math.min(delta, 1 / 20);
  if (motion.teleport) {
    motion.teleport = false;
    story.current = motion.target;
  } else {
    story.current = MathUtils.damp(story.current, motion.target, 3.2, dt);
  }
  story.pointerX = MathUtils.damp(story.pointerX, motion.pointerX, 2.4, dt);
  story.pointerY = MathUtils.damp(story.pointerY, motion.pointerY, 2.4, dt);
}

export function jumpStory() {
  story.current = motion.target;
}
