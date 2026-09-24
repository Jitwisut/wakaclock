'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE = 'a, button, [role="tab"], [data-magnetic], [data-cursor]';

/**
 * A follower ring that trails the native cursor (which stays visible — replacing it hurts
 * precision and accessibility) and a magnetic pull on elements marked `data-magnetic`.
 *
 * The ring says what the pointer is over: it widens on anything clickable and shows the
 * element's `data-cursor` label when there is one, e.g. "Focus" on an attribution control.
 * Fine pointers only, and never under reduced motion.
 */
export function ExperienceCursor() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ring.current;
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || !fine.matches || reduced.matches) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let ringX = x;
    let ringY = y;
    let frame = 0;
    let magnet: HTMLElement | null = null;

    const release = () => {
      if (magnet) magnet.style.transform = '';
      magnet = null;
    };

    const tick = () => {
      ringX += (x - ringX) * 0.2;
      ringY += (y - ringY) * 0.2;
      element.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      frame = Math.abs(x - ringX) + Math.abs(y - ringY) > 0.1 ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      // Only inside the experience; the rest of the page keeps the plain cursor.
      const inside = event.target instanceof Element && Boolean(event.target.closest('.axx'));
      element.dataset.visible = String(inside);
      const target =
        event.target instanceof Element ? event.target.closest<HTMLElement>(INTERACTIVE) : null;
      element.dataset.active = String(Boolean(target));
      element.dataset.label = target?.dataset.cursor ?? '';

      const nextMagnet = target?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (nextMagnet !== magnet) release();
      magnet = nextMagnet;
      if (magnet) {
        const box = magnet.getBoundingClientRect();
        const dx = (x - (box.left + box.width / 2)) * 0.22;
        const dy = (y - (box.top + box.height / 2)) * 0.3;
        magnet.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      element.dataset.visible = 'false';
      release();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      release();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div aria-hidden="true" className="axx-cursor" data-visible="false" ref={ring} />;
}
