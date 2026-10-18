'use client';

import { useEffect } from 'react';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type Lenis from 'lenis';

/** Height of the site's sticky nav: in-page jumps land just below it. */
const NAV_OFFSET = -64;

/**
 * Smooth, inertial scrolling for the homepage (Lenis). Loaded after first paint and only
 * for fine pointers without reduced motion: phones already scroll smoothly, and reduced
 * motion keeps the browser's own scrolling. ScrollTrigger is driven by the same ticker,
 * so the scene and the scroll never disagree by a frame.
 *
 * Same-page links are routed through Lenis too (a native jump would be undone by its
 * stale target), and focus still moves to the destination for keyboard and screen-reader
 * users.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduced || coarse) return;

    let lenis: Lenis | undefined;
    let cancelled = false;
    const tick = (time: number) => lenis?.raf(time * 1000);

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute('href') ?? '';
      const target = hash.length > 1 ? document.querySelector<HTMLElement>(hash) : null;
      if (!lenis || !target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: NAV_OFFSET, duration: 1.6 });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      window.history.pushState(null, '', hash);
    };

    const start = async () => {
      const { default: LenisScroll } = await import('lenis');
      if (cancelled) return;
      lenis = new LenisScroll({ autoRaf: false, lerp: 0.12 });
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      document.addEventListener('click', onClick);
    };
    void start();

    return () => {
      cancelled = true;
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
    };
  }, []);

  return null;
}
