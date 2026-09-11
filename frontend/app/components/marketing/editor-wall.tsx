'use client';

import { useState } from 'react';

import type { SiteLocale } from '@/lib/seo/site';

import { COMPATIBLE_EDITORS } from './editor-wall.data';

function MarqueeRow({ reverse = false }: { reverse?: boolean }) {
  const items = [...COMPATIBLE_EDITORS, ...COMPATIBLE_EDITORS];

  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <ul
        // Decorative: the accessible name count already lives in the summary text above.
        aria-hidden
        className="wakaclock-marquee-track flex shrink-0 items-center gap-3 pr-3"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        {items.map((name, index) => (
          <li
            className="mkt-pixel-shadow-sm shrink-0 border-2 px-4 py-2 text-sm font-medium whitespace-nowrap"
            // Doubled, static, aria-hidden-eligible marquee — names repeat by design, so
            // index is the only available disambiguator, and the row never reorders.
            // eslint-disable-next-line react/no-array-index-key
            key={`${name}-${index}`}
            style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditorWallSection({ locale = 'en' }: { locale?: SiteLocale }) {
  const [paused, setPaused] = useState(false);
  const playback =
    locale === 'th'
      ? ['หยุดแถบ editor', 'เล่นแถบ editor']
      : ['Pause editor strip', 'Play editor strip'];
  return (
    <section className="axis-editor-wall mkt-reveal" data-marquee-paused={paused}>
      <p className="mb-8 text-center text-sm font-medium" style={{ color: 'var(--mkt-fg-muted)' }}>
        {locale === 'th'
          ? 'ใช้ editor เหล่านี้กับ WakaTime plugin อยู่แล้วหรือไม่? ชี้มายัง AtoAxis ได้โดยไม่ต้องติดตั้ง extension ใหม่'
          : 'Already using one of these with a WakaTime plugin? Point it at AtoAxis, with no new extension to install'}
      </p>
      <ul
        aria-label={
          locale === 'th'
            ? 'Editor ที่เข้ากันได้ผ่าน WakaTime protocol'
            : 'Editors compatible through the WakaTime plugin protocol'
        }
        className="sr-only"
      >
        {COMPATIBLE_EDITORS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <div className="mb-5 flex justify-center">
        <button
          aria-pressed={paused}
          className="min-h-11 cursor-pointer border-2 px-4 text-xs"
          onClick={() => setPaused((value) => !value)}
          style={{ borderColor: 'var(--mkt-border-soft)' }}
          type="button"
        >
          {playback[paused ? 1 : 0]}
        </button>
      </div>
      <div className="space-y-3">
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>
    </section>
  );
}
