'use client';
import * as React from 'react';

import { type OfficeMedia, type OfficeMediaTrack, Track } from '@/hooks/use-office-media';

function MediaTrack({ item }: { item: OfficeMediaTrack }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = item.track.attach();
    element.style.width = '100%';
    element.style.maxHeight = '320px';
    ref.current?.append(element);
    return () => {
      item.track.detach(element);
      element.remove();
    };
  }, [item.track]);
  return (
    <figure className={item.track.kind === Track.Kind.Audio ? 'sr-only' : 'min-w-0 border p-2'}>
      <div ref={ref} />
      <figcaption className="text-xs">{item.username}</figcaption>
    </figure>
  );
}
export function OfficeMediaPanel({ media }: { media: OfficeMedia }) {
  return (
    <section aria-label="Pod call" className="my-3 border p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span role="status">{media.status}</span>
        {media.ready && (
          <button onClick={media.startAudio} type="button">
            Enable playback
          </button>
        )}
        {media.canConnect && !media.ready && (
          <button onClick={media.reconnect} type="button">
            Reconnect media
          </button>
        )}
      </div>
      {media.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {media.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {media.tracks.map((item) => (
          <MediaTrack item={item} key={item.key} />
        ))}
      </div>
    </section>
  );
}
