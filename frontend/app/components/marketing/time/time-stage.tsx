'use client';

import { type ReactNode, useEffect, useState } from 'react';

import dynamic from 'next/dynamic';

import { ClockReadout } from './clock-readout';
import { HoverTip } from './hover-tip';
import { chooseTimeQuality, readDeviceSignals, type TimeSceneQuality } from './time-quality';
import { setTimeUi, useTimeUi } from './time-store';
import { useTimeScroll } from './use-time-scroll';

import type { TimeCopyShape } from './time-copy';

/** three.js and the scene download only after the page has painted and gone idle. */
const TimeCanvas = dynamic(() => import('./scene/time-canvas'), { ssr: false });

export function whenIdle(callback: () => void) {
  const run = () => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback, { timeout: 1600 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(callback, 500);
    return () => globalThis.clearTimeout(id);
  };
  if (document.readyState === 'complete') return run();
  let cancel: (() => void) | undefined;
  const onLoad = () => {
    cancel = run();
  };
  window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    cancel?.();
  };
}

/**
 * The sticky backdrop behind the chapters: the still drawing (server-rendered, passed in
 * as children), the WebGL scene once it is ready, the reading veil, the chapter rail and
 * the loader. Everything here is decorative or duplicated in the HTML chapters.
 */
export function TimeStage({
  children,
  copy,
  rootId,
}: {
  children: ReactNode;
  copy: TimeCopyShape;
  rootId: string;
}) {
  const [quality, setQuality] = useState<null | TimeSceneQuality>(null);
  const [visible, setVisible] = useState(true);
  const status = useTimeUi((state) => state.sceneStatus);
  const chapter = useTimeUi((state) => state.chapter);
  const midnight = useTimeUi((state) => state.midnight);

  useTimeScroll(rootId);

  useEffect(() => {
    const chosen = chooseTimeQuality(readDeviceSignals());
    if (!chosen) {
      setTimeUi({ sceneStatus: 'fallback' });
      return;
    }
    return whenIdle(() => {
      setTimeUi({ sceneStatus: 'loading' });
      setQuality(chosen);
    });
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(`#${rootId}`);
    if (!root) return;
    root.dataset.scene = status;
    root.dataset.midnight = String(midnight);
  }, [midnight, rootId, status]);

  // Stop rendering entirely once the visitor has scrolled past the experience.
  useEffect(() => {
    const main = document.querySelector('#tx-main');
    if (!main) return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(Boolean(entry?.isIntersecting))
    );
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" className="tx-stage">
        {children}
        {quality ? (
          <div className="tx-canvas">
            <TimeCanvas active={visible} quality={quality} />
          </div>
        ) : null}
        {/* One reading veil per layout; the active chapter fades the right ones in. */}
        {['left', 'right', 'center', 'bottom', 'band', 'full'].map((side) => (
          <div className="tx-veil" data-veil={side} key={side} />
        ))}
        <div className="tx-vignette" />
      </div>
      <div className="tx-overlay">
        <nav aria-label={copy.railLabel} className="tx-rail">
          <ol>
            {copy.rail.map((label, index) => (
              <li key={label}>
                <a aria-current={chapter === index ? 'step' : undefined} href={`#tx-c${index}`}>
                  <span className="tx-rail-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="tx-rail-label">{label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="tx-corner">
          <ClockReadout label={copy.clockLabel} newDay={copy.clockNewDay} />
          <p className="tx-badge">{copy.demoBadge}</p>
        </div>
        <HoverTip
          demo={copy.demoBadge}
          labels={{
            human: copy.humanAi.kinds.human.label,
            ai: copy.humanAi.kinds.ai.label,
            unattributed: copy.humanAi.kinds.unattributed.label,
          }}
        />
        <div aria-live="polite" className="tx-loader" data-status={status} role="status">
          {status === 'loading' ? copy.loader.label : null}
          {status === 'ready' ? <span className="tx-sr-only">{copy.loader.ready}</span> : null}
          {status === 'fallback' ? <span className="tx-sr-only">{copy.loader.skipped}</span> : null}
        </div>
      </div>
    </>
  );
}
