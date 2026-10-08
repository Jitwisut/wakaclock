import { Fragment } from 'react';

import { localizedPath, SITE_URL, type SiteLocale } from '@/lib/seo/site';

import { COMPATIBLE_EDITORS } from '../editor-wall.data';

import { AttributionFocus } from './attribution-focus';
import { CountUp } from './count-up';
import { Scramble } from './scramble';
import { TIME_COPY } from './time-copy';
import { TimeNav } from './time-nav';
import { TimeStage } from './time-stage';
import { TimeStill } from './time-still';

import type { Metadata } from 'next';

export const TIME_ROOT_ID = 'tx-experience';
export const TIME_PATHS: Record<SiteLocale, string> = { en: '/time', th: '/time/th' };

export function timePageMetadata(locale: SiteLocale): Metadata {
  const copy = TIME_COPY[locale];
  return {
    metadataBase: new URL(SITE_URL),
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: {
      canonical: TIME_PATHS[locale],
      languages: { en: TIME_PATHS.en, th: TIME_PATHS.th, 'x-default': TIME_PATHS.en },
    },
    openGraph: {
      type: 'website',
      title: copy.meta.title,
      description: copy.meta.description,
      url: TIME_PATHS[locale],
    },
    // The homepage already carries these claims for search; keep this experience out of
    // the index so the two do not compete as duplicates.
    robots: { index: false, follow: true },
    icons: { icon: { url: '/atoaxis-symbol-v2.png', type: 'image/png' } },
  };
}

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

export function TimePage({ locale }: { locale: SiteLocale }) {
  const copy = TIME_COPY[locale];
  const earlyAccess = localizedPath(locale, '/early-access');

  return (
    <div className="tx-root" id={TIME_ROOT_ID}>
      <a className="tx-skip" href="#tx-main">
        {copy.skip}
      </a>
      <TimeNav
        copy={copy.nav}
        earlyAccessHref={earlyAccess}
        homeHref={localizedPath(locale, '/')}
        links={[
          { href: localizedPath(locale, '/'), label: copy.nav.home },
          { href: localizedPath(locale, '/docs'), label: copy.nav.docs },
          { href: localizedPath(locale, '/pricing'), label: copy.nav.pricing },
        ]}
        otherLocaleHref={TIME_PATHS[locale === 'en' ? 'th' : 'en']}
        otherLocaleLang={locale === 'en' ? 'th' : 'en'}
      />
      <TimeStage copy={copy} rootId={TIME_ROOT_ID}>
        <TimeStill />
      </TimeStage>

      <main className="tx-chapters" id="tx-main">
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
                </li>
              ))}
            </ul>
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
          </div>
        </section>

        <section
          aria-labelledby="tx-product-title"
          className="tx-chapter tx-chapter--track"
          data-chapter="4"
          data-pin
          id="tx-c4"
        >
          <div className="tx-pin">
            <div className="tx-track-head">
              <Kicker>{copy.product.kicker}</Kicker>
              <h2 className="tx-h2" data-reveal id="tx-product-title">
                {copy.product.heading}
              </h2>
              <p className="tx-lead" data-reveal>
                {copy.product.body}
              </p>
            </div>
            <ol className="tx-track">
              {[
                ...copy.product.views.map((view) => ({
                  tag: view.tab,
                  title: view.title,
                  body: view.body,
                })),
                ...copy.product.features.map((feature) => ({
                  tag: '',
                  title: feature.title,
                  body: feature.description,
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
                <a href={localizedPath(locale, link.href)} key={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </section>
      </main>

      <footer className="tx-footer">
        <p className="tx-footer-brand">AtoAxis</p>
        <p>{copy.footer.tagline}</p>
        <p className="tx-footer-dim">{copy.footer.rights}</p>
      </footer>
    </div>
  );
}
