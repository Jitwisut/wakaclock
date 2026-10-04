'use client';

import * as React from 'react';

import { HeadphonesIcon, XIcon } from 'lucide-react';

import type { PresenceFocusController } from '@/hooks/use-presence-focus';

import styles from './presence-chrome.module.css';

export const FOCUS_OPTIONS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '50 min', seconds: 50 * 60 },
  { label: '90 min', seconds: 90 * 60 },
  { label: '2 hours', seconds: 2 * 3600 },
  { label: '4 hours', seconds: 4 * 3600 },
];

/** "15:30" in the viewer's locale, for a unix-seconds deadline. */
export function formatFocusClock(until: number): string {
  return new Date(until * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Starts or ends a focus block. While it runs, roommates see "focusing until …" next to
 * your name and incoming reactions are muted for you; it ends by itself.
 */
export function FocusControl({ focus }: { focus: PresenceFocusController }) {
  const [open, setOpen] = React.useState(false);

  if (focus.active && focus.until !== null) {
    return (
      <>
        <span className={`${styles.pill} ${styles.focus}`} role="status">
          <HeadphonesIcon aria-hidden className="size-3.5" />
          Focusing until <strong>{formatFocusClock(focus.until)}</strong>
          <button
            aria-label="End focus mode"
            className={styles.pillAction}
            disabled={focus.busy}
            onClick={() => void focus.end()}
            type="button"
          >
            <XIcon aria-hidden className="size-3.5" />
          </button>
        </span>
        {focus.error ? (
          <span className={styles.errorText} role="alert">
            {focus.error}
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div className={styles.menuAnchor}>
      <button
        aria-expanded={open}
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <HeadphonesIcon aria-hidden className="size-4" /> Focus
      </button>
      {open ? (
        <div aria-label="Start focus mode" className={styles.menu} role="group">
          <p className={`${styles.faint} text-xs leading-relaxed`}>
            Roommates see you are focusing, and reactions are muted for you until it ends.
          </p>
          <div className={styles.chips}>
            {FOCUS_OPTIONS.map((option) => (
              <button
                className={styles.chip}
                disabled={focus.busy}
                key={option.seconds}
                onClick={() =>
                  void focus.start(option.seconds).then((started) => {
                    if (started) setOpen(false);
                    return started;
                  })
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          {focus.error ? (
            <p className={styles.errorText} role="alert">
              {focus.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
