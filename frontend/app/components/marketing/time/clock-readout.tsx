'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { codedMinutes, formatCoded } from './editor/charts';
import { HEARTS, play, playVersion, subscribePlay } from './editor/play';
import { DAY_START_MINUTE, formatClock, handMinuteAt } from './time-keyframes';
import { getTimeUi, timeMotion, useTimeUi } from './time-store';

/** UI chrome for the coded-time counter; client-only, never part of the page copy. */
const CODED_LABEL = { en: 'Coded', th: 'เขียนโค้ด' } as const;

/**
 * The time the hand points at, as HH:MM. In the 3D world it also counts the demo day's
 * coding time up to that minute and the hearts collected so far (owner decisions 2026-11-15),
 * rendered on the client only. Reads the eased hand from the scene when it runs, the raw
 * scroll position otherwise, and only re-renders when the displayed minute changes.
 */
export function ClockReadout({ label, newDay }: { label: string; newDay: string }) {
  const [text, setText] = useState(formatClock(DAY_START_MINUTE));
  /** The coded-time counter: null until the world runs (and so never in server HTML). */
  const [coded, setCoded] = useState<null | string>(null);
  const [locale, setLocale] = useState<'en' | 'th'>('en');
  // At midnight the day turns over: 24:00 becomes 00:00.
  const midnight = useTimeUi((state) => state.midnight);
  useSyncExternalStore(subscribePlay, playVersion, playVersion);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const minute =
        getTimeUi().sceneStatus === 'ready' ? timeMotion.hand : handMinuteAt(timeMotion.target);
      setText(formatClock(minute));
      setCoded(timeMotion.world ? formatCoded(codedMinutes(minute)) : null);
      frame = requestAnimationFrame(tick);
    };
    const site = document.querySelector('.wakaclock-marketing');
    setLocale(site?.getAttribute('lang') === 'th' ? 'th' : 'en');
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <p aria-hidden="true" className="tx-clock" data-midnight={midnight}>
      <span className="tx-clock-label">{midnight ? newDay : label}</span>
      <span className="tx-clock-time">{midnight ? '00:00' : text}</span>
      {coded && !midnight ? (
        <span className="tx-clock-coded">
          <span className="tx-clock-label" lang={locale}>
            {CODED_LABEL[locale]}
          </span>
          <span className="tx-clock-time">{coded}</span>
        </span>
      ) : null}
      {coded && !midnight ? (
        <span className="tx-clock-hearts">
          <span aria-hidden="true" className="tx-clock-heart">
            ♥
          </span>
          <span className="tx-clock-time">
            {play.hearts.size}/{HEARTS.length}
          </span>
        </span>
      ) : null}
    </p>
  );
}
