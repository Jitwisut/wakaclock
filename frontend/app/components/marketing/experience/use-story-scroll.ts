'use client';

import { type RefObject, useEffect } from 'react';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { motion, setUi } from './experience-store';
import { chapterAt } from './scene/keyframes';

/**
 * Converts page scroll into the story position `g` (0 → 6, one unit per chapter).
 *
 * Chapters have different heights, so `g` is piecewise: chapter i spans from the moment
 * its top reaches mid-viewport to the moment the next one does. ScrollTrigger owns the
 * measuring — it re-measures on resize, font load and layout shifts, which is exactly the
 * bookkeeping a hand-rolled scroll listener gets wrong.
 *
 * Also writes:
 * - `--axx-local` on each chapter (0 → 1 progress through it) for CSS-driven transitions,
 * - `data-inview` on each chapter, which starts its typography reveal,
 * - the discrete chapter index into the UI store for the rail.
 */
export function useStoryScroll(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    gsap.registerPlugin(ScrollTrigger);
    const chapters = [...element.querySelectorAll<HTMLElement>('[data-chapter]')];
    const progress = chapters.map(() => 0);

    const publish = () => {
      let g = 0;
      for (const value of progress) g += value;
      motion.target = g;
      element.style.setProperty('--axx-g', g.toFixed(4));
      setUi({ chapter: chapterAt(g) });
    };

    const triggers = chapters.map((chapter, index) =>
      ScrollTrigger.create({
        trigger: chapter,
        // The opening chapter starts at the top of the page, not mid-viewport, so the
        // story is at 0 on load instead of already part-way through chapter one.
        start: index === 0 ? 'top top' : 'top center',
        end: index === chapters.length - 1 ? 'bottom bottom' : 'bottom center',
        onUpdate: (self) => {
          progress[index] = self.progress;
          chapter.style.setProperty('--axx-local', self.progress.toFixed(4));
          publish();
        },
        onRefresh: (self) => {
          progress[index] = self.progress;
          chapter.style.setProperty('--axx-local', self.progress.toFixed(4));
          publish();
        },
      })
    );

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) (entry.target as HTMLElement).dataset.inview = 'true';
        }
      },
      { rootMargin: '0px 0px -18% 0px' }
    );
    element.querySelectorAll('[data-chapter], .axx-reveal').forEach((node) => reveal.observe(node));

    const onPointer = (event: PointerEvent) => {
      motion.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = -((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    element.dataset.scroll = 'ready';

    return () => {
      triggers.forEach((trigger) => trigger.kill());
      reveal.disconnect();
      window.removeEventListener('pointermove', onPointer);
      delete element.dataset.scroll;
    };
  }, [root]);
}
