'use client';

import { useEffect } from 'react';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { chapterAt, handMinuteAt } from './time-keyframes';
import { MIDNIGHT_FIRE_AT } from './time-midnight';
import { getTimeUi, setTimeUi, timeMotion } from './time-store';

/**
 * Converts page scroll into the story position (0 → chapters - 1), the same way the
 * homepage experience does: chapter i spans from its top reaching mid-viewport to the next
 * one doing so, and ScrollTrigger owns the measuring (resize, font load, layout shift).
 *
 * Also marks chapters `data-inview` for the typography reveal and tracks the pointer for
 * the camera's parallax.
 */
export function useTimeScroll(rootId: string) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`#${rootId}`);
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const chapters = [...root.querySelectorAll<HTMLElement>('[data-chapter]')];
    const progress = chapters.map(() => 0);
    let lastY = window.scrollY;
    let lastTime = performance.now();

    const publish = () => {
      const g = progress.reduce((sum, value) => sum + value, 0);
      // One scroll event can update several chapter triggers; only the first of them sees
      // the movement, so speed and jumps are measured on the page's scroll position.
      const moved = window.scrollY - lastY;
      if (moved !== 0) {
        const now = performance.now();
        const seconds = Math.max(0.016, (now - lastTime) / 1000);
        // More than a screen and a half at once is an anchor link, Home/End or scroll
        // restoration: snap. PageDown and fast flings stay below it, so they still warp.
        const jump = Math.abs(moved) > window.innerHeight * 1.5;
        timeMotion.velocity = jump ? 0 : moved / window.innerHeight / seconds;
        if (jump) timeMotion.teleport = true;
        lastY = window.scrollY;
        lastTime = now;
        // The page moved under the pointer: whatever it was hovering has gone.
        setTimeUi({ hover: null });
      }
      timeMotion.target = g;
      const chapter = chapterAt(g);
      root.dataset.chapter = String(chapter);
      // The still drawing's hand follows the scroll through CSS, no animation frame needed.
      root.style.setProperty('--tx-hand', `${((handMinuteAt(g) / 1440) * 360).toFixed(2)}deg`);
      setTimeUi({ chapter });
      // Without the 3D scene the ending is a plain state: reaching the end is midnight.
      if (getTimeUi().sceneStatus !== 'ready') setTimeUi({ midnight: g >= MIDNIGHT_FIRE_AT });
    };

    const triggers = chapters.map((chapter, index) => {
      const update = (self: ScrollTrigger) => {
        progress[index] = self.progress;
        publish();
      };
      return ScrollTrigger.create({
        trigger: chapter,
        start: index === 0 ? 'top top' : 'top center',
        end: index === chapters.length - 1 ? 'bottom bottom' : 'bottom center',
        onUpdate: update,
        onRefresh: update,
      });
    });

    // Pinned sections (the horizontal track) get their own 0 → 1 progress while pinned.
    const pins = [...root.querySelectorAll<HTMLElement>('[data-pin]')].map((section) => {
      const update = (self: ScrollTrigger) => {
        section.style.setProperty('--tx-pin', self.progress.toFixed(4));
      };
      return ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: update,
        onRefresh: update,
      });
    });

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) (entry.target as HTMLElement).dataset.inview = 'true';
        }
      },
      { rootMargin: '0px 0px -12% 0px' }
    );
    for (const chapter of chapters) reveal.observe(chapter);

    const onPointer = (event: PointerEvent) => {
      timeMotion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      timeMotion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
      timeMotion.clientX = event.clientX;
      timeMotion.clientY = event.clientY;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    root.dataset.scroll = 'ready';

    return () => {
      for (const trigger of [...triggers, ...pins]) trigger.kill();
      reveal.disconnect();
      window.removeEventListener('pointermove', onPointer);
      delete root.dataset.scroll;
    };
  }, [rootId]);
}
