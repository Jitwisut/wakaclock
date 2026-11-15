'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { dayTotals, formatCoded } from './charts';
import { HEARTS, play, playVersion, subscribePlay } from './play';
import { DAY_END, SPEAKERS, STORY } from './story';

/**
 * The story's page side (owner decisions 2026-11-15): the speech bubble over the figurine
 * whose line it is, a tapped tower's readout, and the end-of-day card. All of it is
 * client-only chrome in the page's language; none of it is in the server HTML.
 */

/** Types a line out a character at a time; restarts when the line changes. */
function useTypewriter(text: string) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!text) return;
    const characters = [...text];
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= characters.length) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [text]);
  return [...text].slice(0, shown).join('');
}

function usePlay() {
  useSyncExternalStore(subscribePlay, playVersion, playVersion);
  return play;
}

/** How long a tapped tower's readout stays up (ms). */
const TIP_MS = 2600;

export function StoryOverlay({
  line,
  locale,
  onRestart,
}: {
  /** The story line to say (index into STORY), or -1 for none. */
  line: number;
  locale: 'en' | 'th';
  onRestart: () => void;
}) {
  const state = usePlay();
  const story = line >= 0 && !state.ended ? STORY[line] : undefined;
  const text = useTypewriter(story ? story[locale] : '');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state.tip) return;
    setNow(Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), TIP_MS);
    return () => window.clearTimeout(timer);
  }, [state.tip]);
  const tip = state.tip && now - state.tip.at < TIP_MS ? state.tip : null;
  const totals = dayTotals();
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.ended) again.current?.focus({ preventScroll: true });
  }, [state.ended]);
  return (
    <div className="tx-story">
      {story ? (
        <p
          aria-live="polite"
          className="tx-story-bubble"
          data-speaker={story.speaker}
          lang={locale}
        >
          <span className="tx-story-who">{SPEAKERS[story.speaker][locale]}</span>
          <span className="tx-story-text">{text}</span>
        </p>
      ) : null}
      {tip ? (
        <p
          aria-live="polite"
          className="tx-story-tip"
          key={tip.at}
          lang={locale}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </p>
      ) : null}
      {state.ended ? (
        <section aria-labelledby="tx-story-end" className="tx-story-end" lang={locale}>
          <h2 id="tx-story-end">{DAY_END.title[locale]}</h2>
          <dl>
            <div>
              <dt>{DAY_END.coded[locale]}</dt>
              <dd>{formatCoded(totals.total)}</dd>
            </div>
            <div data-kind="human">
              <dt>{DAY_END.you[locale]}</dt>
              <dd>{formatCoded(totals.human)}</dd>
            </div>
            <div data-kind="ai">
              <dt>{DAY_END.ai[locale]}</dt>
              <dd>{formatCoded(totals.ai)}</dd>
            </div>
            <div data-kind="hearts">
              <dt>{DAY_END.hearts[locale]}</dt>
              <dd>
                {state.hearts.size}/{HEARTS.length}
              </dd>
            </div>
          </dl>
          <p className="tx-story-note">{DAY_END.note[locale]}</p>
          <button className="tx-story-again" onClick={onRestart} ref={again} type="button">
            {DAY_END.again[locale]}
          </button>
        </section>
      ) : null}
    </div>
  );
}
