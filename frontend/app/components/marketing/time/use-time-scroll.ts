'use client';

import { useEffect } from 'react';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { chapterAt, daylightAt, handMinuteAt } from './time-keyframes';
import { MIDNIGHT_FIRE_AT } from './time-midnight';
import { getTimeUi, setTimeUi, timeMotion } from './time-store';

/**
 * A section of the light page tilting up out of depth as it scrolls in (and back as it
 * leaves upward). The transform only exists while it moves; at rest nothing is applied,
 * so the section never becomes a containing block for fixed or sticky content.
 */
function applyRise(self: ScrollTrigger) {
  const element = self.trigger as HTMLElement;
  if (self.progress >= 1) {
    delete element.dataset.rising;
    element.style.removeProperty('--rise');
    return;
  }
  element.dataset.rising = 'true';
  element.style.setProperty('--rise', self.progress.toFixed(3));
}

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
    // Custom properties written on the root restyle the whole experience, so they are
    // written only when their rounded value changes, and the still hand gets its own.
    const hand = root.querySelector<SVGElement>('.tx-still-hand');
    let lastHand = '';
    let lastDay = '';

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
      if (root.dataset.chapter !== String(chapter)) root.dataset.chapter = String(chapter);
      // The still drawing's hand follows the scroll through CSS, no animation frame needed.
      const angle = `${((handMinuteAt(g) / 1440) * 360).toFixed(1)}deg`;
      if (hand && angle !== lastHand) {
        lastHand = angle;
        hand.style.setProperty('--tx-hand', angle);
      }
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

    // Dusk to daylight across the hand-off below the story; the CSS layers (veils, the
    // still drawing, the light wash) read the same number, so it works without WebGL too.
    const dawn = root.querySelector<HTMLElement>('#tx-dawn');
    const dayTriggers: ScrollTrigger[] = [];
    if (dawn) {
      const update = (self: ScrollTrigger) => {
        timeMotion.dawnTarget = self.progress;
        const daylight = daylightAt(self.progress);
        const day = daylight.toFixed(2);
        if (day !== lastDay) {
          lastDay = day;
          root.style.setProperty('--tx-day', day);
        }
        // Past the middle of the dawn the page is light: the site nav follows.
        const dawnLight = String(daylight > 0.5);
        if (root.dataset.dawn !== dawnLight) root.dataset.dawn = dawnLight;
      };
      dayTriggers.push(
        ScrollTrigger.create({
          trigger: dawn,
          start: 'top bottom',
          end: 'bottom 35%',
          onUpdate: update,
          onRefresh: update,
        })
      );
    }
    // The camera keeps travelling through the light page that follows.
    const day = document.querySelector<HTMLElement>('#tx-day');
    if (day) {
      const update = (self: ScrollTrigger) => {
        timeMotion.dayTarget = self.progress;
      };
      dayTriggers.push(
        ScrollTrigger.create({
          trigger: day,
          start: 'top bottom',
          end: 'bottom bottom',
          onUpdate: update,
          onRefresh: update,
        })
      );
      // Each section below tilts up out of depth as it scrolls in, and back as it leaves
      // upward. The transform only exists while it is moving: at rest nothing is applied.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        for (const section of day.children) {
          dayTriggers.push(
            ScrollTrigger.create({
              trigger: section,
              start: 'top bottom',
              end: 'top 62%',
              onUpdate: applyRise,
              onRefresh: applyRise,
            })
          );
        }
      }
    }

    // Trigger positions are measured once; anything that changes the page's height later
    // (fonts arriving, an FAQ answer opening) would leave every trigger below it stale.
    let refreshTimer = 0;
    const heights = new ResizeObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    heights.observe(document.body);

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
      for (const trigger of [...triggers, ...pins, ...dayTriggers]) trigger.kill();
      reveal.disconnect();
      heights.disconnect();
      window.clearTimeout(refreshTimer);
      window.removeEventListener('pointermove', onPointer);
      delete root.dataset.scroll;
    };
  }, [rootId]);
}
