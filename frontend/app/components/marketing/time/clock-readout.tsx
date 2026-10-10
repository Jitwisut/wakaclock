'use client';

import { useEffect, useState } from 'react';

import { DAY_START_MINUTE, formatClock, handMinuteAt } from './time-keyframes';
import { getTimeUi, timeMotion, useTimeUi } from './time-store';

/**
 * The time the hand points at, as HH:MM. Reads the eased hand from the scene when it runs,
 * the raw scroll position otherwise, and only re-renders when the displayed minute changes.
 */
export function ClockReadout({ label, newDay }: { label: string; newDay: string }) {
  const [text, setText] = useState(formatClock(DAY_START_MINUTE));
  // At midnight the day turns over: 24:00 becomes 00:00.
  const midnight = useTimeUi((state) => state.midnight);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const minute =
        getTimeUi().sceneStatus === 'ready' ? timeMotion.hand : handMinuteAt(timeMotion.target);
      setText(formatClock(minute));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <p aria-hidden="true" className="tx-clock" data-midnight={midnight}>
      <span className="tx-clock-label">{midnight ? newDay : label}</span>
      <span className="tx-clock-time">{midnight ? '00:00' : text}</span>
    </p>
  );
}
