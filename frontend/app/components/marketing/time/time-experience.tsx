import { Fragment } from 'react';

import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { COMPATIBLE_EDITORS } from '../editor-wall.data';

import { AttributionFocus } from './attribution-focus';
import { CountUp } from './count-up';
import { Scramble } from './scramble';
import { SmoothScroll } from './smooth-scroll';
import { TIME_COPY } from './time-copy';
import { TimeStage } from './time-stage';
import { TimeStill } from './time-still';

export const TIME_ROOT_ID = 'tx-experience';
function Kicker({ children }: { children: string }) {
  return (
    <p className="tx-kicker" data-reveal>
      <Scramble text={children} />
    </p>
  );
}

/** Giant outlined chapter number, set behind the text at a different spot each chapter. */
function Numeral({ children, position }: { children: string; position: string }) {
  return (
    <span aria-hidden="true" className="tx-numeral" data-pos={position}>
      {children}
    </span>
  );
}

/**
 * Splits an English heading into words for a staggered reveal; the words stay separated by
 * real spaces, so the heading's text content is unchanged. Thai has no spaces between
 * words, so it reveals as one piece.
 */
function Kinetic({ locale, text }: { locale: SiteLocale; text: string }) {
  if (locale === 'th') return <span className="tx-word">{text}</span>;
  const words = text.split(' ').map((word, index) => ({ id: `${index}:${word}`, index, word }));
  // Spaces stay as plain text between the word spans, so the accessible name keeps them.
  return words.map(({ id, index, word }) => (
    <Fragment key={id}>
      {index > 0 ? ' ' : null}
      <span className="tx-word" style={{ '--i': index } as React.CSSProperties}>
        {word}
      </span>
    </Fragment>
  ));
}

/** Editors scrolling past in a band. The duplicate track is hidden from assistive tech. */
/** The concrete facts behind a product view, kept as plain text answer engines can quote. */
function Facts({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="tx-facts">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function EditorMarquee({ editors, label }: { editors: readonly string[]; label: string }) {
  return (
    <div className="tx-marquee">
      <ul aria-label={label} className="tx-marquee-track">
        {editors.map((editor) => (
          <li key={editor}>{editor}</li>
        ))}
      </ul>
      <ul aria-hidden="true" className="tx-marquee-track">
        {editors.map((editor) => (
          <li key={editor}>{editor}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The homepage's opening: the time-ring experience. A dark, scroll-driven story over a
 * sticky 3D stage, server-rendered in full (every chapter, the editor list, the worked
 * example and the feature list are plain HTML), handing over to the light page below.
 */
export function TimeExperience({ locale }: { locale: SiteLocale }) {
  const copy = TIME_COPY[locale];
  const earlyAccess = localizedPath(locale, '/early-access');

  return (
    // The site-wide reveal animations stay out: this experience choreographs its own.
    <div className="tx-root" data-motion-owner="experience" id={TIME_ROOT_ID}>
      <SmoothScroll />
      <TimeStage copy={copy} rootId={TIME_ROOT_ID}>
        <TimeStill />
      </TimeStage>

      <div className="tx-chapters" id="tx-chapters">
        <section
          aria-labelledby="tx-hero-title"
          className="tx-chapter tx-hero"
          data-chapter="0"
          id="tx-c0"
        >
          <div className="tx-col">
            <p className="tx-eyebrow" data-reveal>
              <span aria-hidden="true" className="tx-pulse" />
              <Scramble text={copy.hero.eyebrow} />
            </p>
            <h1 className="tx-h1" id="tx-hero-title">
              <span className="tx-line" data-reveal>
                {copy.hero.headline[0]}
              </span>{' '}
              <span className="tx-line tx-accent" data-reveal>
                {copy.hero.headline[1]}
              </span>
            </h1>
            <p className="tx-lead" data-reveal>
              {copy.hero.lead}
            </p>
            <div className="tx-actions" data-reveal>
              <a className="tx-btn tx-btn--primary" href={earlyAccess}>
                {copy.hero.primary}
                <span aria-hidden="true">↗</span>
              </a>
              <a
                className="tx-btn tx-btn--ghost"
                href={localizedPath(locale, '/wakatime-alternative')}
              >
                {copy.hero.secondary}
              </a>
            </div>
            <p className="tx-note" data-reveal>
              {copy.hero.note}
            </p>
            <ul aria-label={copy.hero.highlightsLabel} className="tx-chips" data-reveal>
              {copy.hero.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p aria-hidden="true" className="tx-scroll-cue">
            <span />
            {copy.hero.scroll}
          </p>
        </section>

        <section
          aria-labelledby="tx-beat-title"
          className="tx-chapter tx-chapter--right"
          data-chapter="1"
          id="tx-c1"
        >
          <Numeral position="left">02</Numeral>
          <div className="tx-col tx-col--right">
            <Kicker>{copy.heartbeats.kicker}</Kicker>
            <h2 className="tx-h2" data-reveal="right" id="tx-beat-title">
              {copy.heartbeats.heading}
            </h2>
            <p className="tx-lead" data-reveal="right">
              {copy.heartbeats.body}
            </p>
            <p className="tx-panel" data-reveal="right">
              {copy.heartbeats.explain}
            </p>
          </div>
          <div className="tx-tools" data-reveal>
            <div className="tx-tools-head">
              <p className="tx-count">
                <strong>
                  <CountUp value={COMPATIBLE_EDITORS.length} />
                </strong>
                <span>{copy.heartbeats.toolsCount}</span>
              </p>
              <div>
                <h3 className="tx-h3">{copy.heartbeats.toolsHeading}</h3>
                <p className="tx-body">{copy.heartbeats.toolsBody}</p>
              </div>
            </div>
            <EditorMarquee editors={COMPATIBLE_EDITORS} label={copy.heartbeats.toolsLabel} />
          </div>
        </section>

        <section
          aria-labelledby="tx-ring-title"
          className="tx-chapter tx-chapter--center"
          data-chapter="2"
          id="tx-c2"
        >
          <Numeral position="right">03</Numeral>
          <div className="tx-col tx-col--wide tx-col--center">
            <Kicker>{copy.ring.kicker}</Kicker>
            <h2 className="tx-h2 tx-h2--xl" id="tx-ring-title">
              <Kinetic locale={locale} text={copy.ring.heading} />
            </h2>
            <p className="tx-lead" data-reveal>
              {copy.ring.body}
            </p>
            <ul className="tx-cards tx-cards--row">
              {copy.ring.views.map((view) => (
                <li className="tx-card" data-reveal key={view.title}>
                  <span className="tx-card-tag">
                    <Scramble text={view.tab} />
                  </span>
                  <h3 className="tx-h3">{view.title}</h3>
                  <p className="tx-body">{view.body}</p>
                  <Facts items={view.notes} />
                </li>
              ))}
            </ul>
            <div className="tx-example" data-reveal id="worked-example">
              <h3 className="tx-h3">{copy.ring.example.heading}</h3>
              <p className="tx-body">{copy.ring.example.body}</p>
              {copy.ring.example.interpretation.split('\n\n').map((paragraph) => (
                <p className="tx-body" key={paragraph}>
                  {paragraph}
                </p>
              ))}
              <p className="tx-note">{copy.ring.example.source}</p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="tx-ai-title"
          className="tx-chapter tx-chapter--stack"
          data-chapter="3"
          id="tx-c3"
        >
          <Numeral position="top-right">04</Numeral>
          <div className="tx-col">
            <Kicker>{copy.humanAi.kicker}</Kicker>
            <h2 className="tx-h2" data-reveal id="tx-ai-title">
              {copy.humanAi.heading}
            </h2>
            <p className="tx-sub" data-reveal>
              {copy.humanAi.subheading}
            </p>
            <p className="tx-lead" data-reveal>
              {copy.humanAi.body}
            </p>
          </div>
          <div className="tx-wide">
            <AttributionFocus
              controlsLabel={copy.humanAi.controlsLabel}
              kinds={copy.humanAi.kinds}
            />
            <p className="tx-note" data-reveal>
              {copy.humanAi.caution}
            </p>
            <p className="tx-evidence" data-reveal>
              {copy.humanAi.evidence.text} {copy.humanAi.evidence.sourceLabel}:{' '}
              <cite>
                <a href={copy.humanAi.evidence.href} rel="noopener noreferrer" target="_blank">
                  {copy.humanAi.evidence.sourceTitle}
                </a>
              </cite>
            </p>
          </div>
        </section>

        <section
          aria-labelledby="tx-product-title"
          className="tx-chapter tx-chapter--track"
          data-chapter="4"
          data-pin
          id="tx-c4"
        >
          <span aria-hidden="true" className="tx-anchor" id="features" />
          <div className="tx-pin">
            <div className="tx-track-head">
              <Kicker>{copy.product.kicker}</Kicker>
              <h2 className="tx-h2" data-reveal id="tx-product-title">
                {copy.product.heading}
              </h2>
              <p className="tx-lead" data-reveal>
                {copy.product.body}
              </p>
              <h2 className="tx-track-title" data-reveal>
                {copy.product.featuresHeading}
              </h2>
              <p className="tx-track-intro" data-reveal>
                {copy.product.featuresIntro}
              </p>
            </div>
            <ol className="tx-track">
              {[
                ...copy.product.views.map((view) => ({
                  tag: view.tab,
                  title: view.title,
                  body: view.body,
                  notes: view.notes,
                })),
                ...copy.product.features.map((feature) => ({
                  tag: '',
                  title: feature.title,
                  body: feature.description,
                  notes: [] as readonly string[],
                })),
              ].map((card, index) => (
                <li className="tx-track-card" key={card.title}>
                  <span aria-hidden="true" className="tx-track-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {card.tag ? (
                    <span className="tx-card-tag">
                      <Scramble text={card.tag} />
                    </span>
                  ) : null}
                  <h3 className="tx-h3">{card.title}</h3>
                  <p className="tx-body">{card.body}</p>
                  <Facts items={card.notes} />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="tx-begin-title"
          className="tx-chapter tx-begin"
          data-chapter="5"
          id="tx-c5"
        >
          <div className="tx-col tx-col--center">
            <Kicker>{copy.begin.kicker}</Kicker>
            <h2 className="tx-h2 tx-h2--xl" data-reveal="scale" id="tx-begin-title">
              {copy.begin.heading}
            </h2>
            <p className="tx-lead" data-reveal>
              {copy.begin.body}
            </p>
            <div className="tx-actions tx-actions--center" data-reveal>
              <a className="tx-btn tx-btn--primary" href={earlyAccess}>
                {copy.begin.primary}
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="tx-note" data-reveal>
              {copy.begin.note}
            </p>
            <nav aria-label={copy.begin.navLabel} className="tx-links" data-reveal>
              {copy.begin.links.map((link) => (
                <a
                  href={link.href.startsWith('/') ? localizedPath(locale, link.href) : link.href}
                  key={link.href}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </section>
      </div>
      {/* Dawn: scrolling through here turns the scene from dusk to daylight before the
          light page below begins. */}
      <div aria-hidden="true" className="tx-handoff" id="tx-dawn" />
    </div>
  );
}
