'use client';
import * as React from 'react';

import { type OfficeMedia, type OfficeMediaTrack, Track } from '@/hooks/use-office-media';

import styles from './presence-chrome.module.css';

function MediaTrack({ item }: { item: OfficeMediaTrack }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = item.track.attach();
    element.style.width = '100%';
    element.style.maxHeight = '320px';
    element.style.borderRadius = '10px';
    ref.current?.append(element);
    return () => {
      item.track.detach(element);
      element.remove();
    };
  }, [item.track]);
  return (
    <figure
      className={item.track.kind === Track.Kind.Audio ? 'sr-only' : `${styles.historyItem} min-w-0`}
    >
      <div ref={ref} />
      <figcaption className="text-xs">{item.username}</figcaption>
    </figure>
  );
}

/**
 * The pod call surface. Renders only when there is something to act on — tracks, an
 * error, or a playback/reconnect action; the dock already carries the connection status.
 */
export function OfficeMediaPanel({ media }: { media: OfficeMedia }) {
  const canReconnect = media.canConnect && !media.ready;
  if (media.tracks.length === 0 && !media.error && !media.ready && !canReconnect) return null;
  return (
    <section aria-label="Pod call" className={`${styles.panel} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={styles.pill} role="status">
          {media.status}
        </span>
        {media.ready && (
          <button className={styles.btn} onClick={media.startAudio} type="button">
            Enable playback
          </button>
        )}
        {canReconnect && (
          <button className={styles.btn} onClick={media.reconnect} type="button">
            Reconnect media
          </button>
        )}
      </div>
      {media.error && (
        <p className={styles.errorText} role="alert">
          {media.error}
        </p>
      )}
      {media.tracks.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {media.tracks.map((item) => (
            <MediaTrack item={item} key={item.key} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
