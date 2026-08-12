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
            className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap"
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

export function EditorWallSection() {
  return (
    <section className="py-14">
      <p className="mb-8 text-center text-sm font-medium" style={{ color: 'var(--mkt-fg-muted)' }}>
        Compatible via the WakaTime plugin protocol — {COMPATIBLE_EDITORS.length}+ editors, no new
        extension to install
      </p>
      <div className="space-y-3">
        <MarqueeRow />
        <MarqueeRow reverse />
      </div>
    </section>
  );
}
