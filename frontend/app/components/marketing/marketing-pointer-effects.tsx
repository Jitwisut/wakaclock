'use client';

import { useEffect, useRef } from 'react';

/** Buttons and CTAs that lean toward the pointer. */
const MAGNETIC =
  '[data-slot="button"], .axis-cta-link, .axis-hero-cta, .mkt-hero-actions a, [data-magnetic]';
/** Surfaces that tilt slightly under the pointer. Never one that holds controls. */
const TILT = '.mkt-page-art img, [data-tilt]';
/** Surfaces that carry a soft highlight under the pointer (tilting ones included). */
const SURFACE = `${TILT}, .axis-pricing-offer, [data-glow]`;

const MAGNET_PULL = 0.28;
const MAGNET_MAX = 8;
const TILT_MAX_DEG = 2.5;

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/**
 * Pointer polish for the marketing site: magnetic buttons, a small 3D tilt on selected
 * images and a highlight that follows the pointer across them and the pricing card.
 *
 * One delegated `pointermove` listener, coalesced to one update per animation frame. The
 * magnet writes the individual `translate` property so it composes with hover lifts and
 * the scroll reveals, which own `transform`. Fine pointers only, never under reduced
 * motion, and a focused control is never displaced, so keyboard users see it where it is.
 */
export function MarketingPointerEffects() {
  const marker = useRef<globalThis.HTMLSpanElement>(null);

  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>('.wakaclock-marketing');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root) return;

    let magnet: HTMLElement | null = null;
    let surface: HTMLElement | null = null;
    // Measured once per hover: a tilted, scaled surface must not feed its own transform
    // back into the next measurement.
    let surfaceBox: globalThis.DOMRect | null = null;
    let frame = 0;
    let pointer = { target: null as EventTarget | null, x: 0, y: 0 };

    const releaseMagnet = () => {
      if (magnet) magnet.style.removeProperty('translate');
      magnet = null;
    };
    const releaseSurface = () => {
      if (surface) {
        delete surface.dataset.pointerActive;
        for (const name of ['--tilt-x', '--tilt-y', '--mx', '--my']) {
          surface.style.removeProperty(name);
        }
      }
      surface = null;
      surfaceBox = null;
    };
    const releaseAll = () => {
      releaseMagnet();
      releaseSurface();
    };

    const update = () => {
      frame = 0;
      const { target, x, y } = pointer;
      const element = target instanceof Element ? target : null;

      const hovered = element?.closest<HTMLElement>(MAGNETIC) ?? null;
      const nextMagnet = hovered?.matches(':focus-visible') ? null : hovered;
      const found = element?.closest<HTMLElement>(SURFACE) ?? null;
      // The homepage experience directs its own surfaces.
      const nextSurface = found?.closest('[data-motion-owner="experience"]') ? null : found;

      // Every measurement happens before any style write, so a frame never forces layout.
      const magnetBox = nextMagnet?.getBoundingClientRect();
      if (nextSurface !== surface) releaseSurface();
      if (nextSurface && !surfaceBox) surfaceBox = nextSurface.getBoundingClientRect();

      if (nextMagnet !== magnet) releaseMagnet();
      if (nextMagnet && magnetBox) {
        magnet = nextMagnet;
        const dx = clamp((x - (magnetBox.left + magnetBox.width / 2)) * MAGNET_PULL, MAGNET_MAX);
        const dy = clamp((y - (magnetBox.top + magnetBox.height / 2)) * MAGNET_PULL, MAGNET_MAX);
        nextMagnet.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      }

      if (nextSurface && surfaceBox) {
        surface = nextSurface;
        const px = (x - surfaceBox.left) / surfaceBox.width;
        const py = (y - surfaceBox.top) / surfaceBox.height;
        nextSurface.dataset.pointerActive = 'true';
        nextSurface.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        nextSurface.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (nextSurface.matches(TILT)) {
          const tiltX = (0.5 - py) * TILT_MAX_DEG * 2;
          const tiltY = (px - 0.5) * TILT_MAX_DEG * 2;
          nextSurface.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
          nextSurface.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
        }
      }
    };

    // The page moved under a held surface: measure it again on the next move.
    const onScroll = () => {
      surfaceBox = null;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer = { target: event.target, x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onFocus = (event: FocusEvent) => {
      if (event.target === magnet) releaseMagnet();
    };

    let active = false;
    const stop = () => {
      if (!active) return;
      active = false;
      cancelAnimationFrame(frame);
      frame = 0;
      releaseAll();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', releaseAll);
      root.removeEventListener('focusin', onFocus);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('scroll', onScroll);
    };
    const start = () => {
      stop();
      if (!fine.matches || reduced.matches) return;
      active = true;
      root.addEventListener('pointermove', onMove, { passive: true });
      root.addEventListener('pointerleave', releaseAll);
      root.addEventListener('focusin', onFocus);
      window.addEventListener('blur', releaseAll);
      window.addEventListener('scroll', onScroll, { passive: true });
    };

    start();
    fine.addEventListener('change', start);
    reduced.addEventListener('change', start);
    return () => {
      stop();
      fine.removeEventListener('change', start);
      reduced.removeEventListener('change', start);
    };
  }, []);

  return <span aria-hidden="true" hidden ref={marker} />;
}
