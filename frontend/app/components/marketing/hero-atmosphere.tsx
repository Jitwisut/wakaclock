'use client';

import { useEffect, useRef } from 'react';

import { chooseTimeQuality, QUALITY_TIERS, readDeviceSignals } from './time/time-quality';

import type { AtmosphereOptions } from './hero-atmosphere-scene';

/** Same device tiers as the homepage scene, scaled down for a background layer. */
function atmosphereOptions(): AtmosphereOptions | null {
  const quality = chooseTimeQuality(readDeviceSignals());
  if (!quality) return null;
  if (quality === QUALITY_TIERS.compact) return { count: 260, maxDpr: 1.25, pointer: false };
  if (quality === QUALITY_TIERS.low) return { count: 520, maxDpr: 1.25, pointer: true };
  return { count: 900, maxDpr: 1.5, pointer: true };
}

/** Runs after the page has loaded and gone idle, so three.js never competes with content. */
function whenIdle(callback: () => void) {
  let cancel: (() => void) | undefined;
  const run = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout: 2000 });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = globalThis.setTimeout(callback, 600);
      cancel = () => globalThis.clearTimeout(id);
    }
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    window.removeEventListener('load', run);
    cancel?.();
  };
}

/**
 * A quiet layer of depth behind a content page's opening. Decorative only: reduced
 * motion, data saver and missing WebGL keep the existing CSS glow and nothing else.
 */
export function HeroAtmosphere() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The host div is always rendered, so the ref is set by the time effects run.
    const element = host.current!;
    const options = atmosphereOptions();
    if (!options) return;

    let disposed = false;
    let dispose: (() => void) | undefined;
    const mount = async () => {
      const { createAtmosphere } = await import('./hero-atmosphere-scene');
      if (disposed) return;
      ({ dispose } = createAtmosphere(element, options));
      element.dataset.ready = 'true';
    };
    const cancelIdle = whenIdle(() => void mount());
    return () => {
      disposed = true;
      cancelIdle();
      dispose?.();
      delete element.dataset.ready;
    };
  }, []);

  return <div aria-hidden="true" className="mkt-hero-atmosphere" ref={host} />;
}
