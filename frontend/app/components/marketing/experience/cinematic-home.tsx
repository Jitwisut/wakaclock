/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Named overflow regions must be keyboard-scrollable. */

import { ArrowDownIcon, ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';

import { localizedPath, type SiteLocale } from '@/lib/seo/site';

import { COMPATIBLE_EDITORS } from '../editor-wall.data';

import { AttributionExplorer } from './attribution-explorer';
import { EXPERIENCE_COPY } from './experience-copy';
import { ExperienceStage } from './experience-stage';
import { WeekTimeline } from './product-replicas';
import { ProductShowcase } from './product-showcase';
import { ProjectLegend } from './project-legend';

const ROOT_ID = 'axx-experience';

/**
 * Splits a heading into word spans for the staggered reveal. The words stay separated by
 * real spaces, so the heading's text content — what crawlers and screen readers read — is
 * unchanged. Thai is not space-delimited, so it is revealed per line instead.
 */
function Kinetic({ lines, locale }: { lines: readonly string[]; locale: SiteLocale }) {
  let order = 0;
  const rows = lines.map((line) => ({
    line,
    words: (locale === 'th' ? [line] : line.split(' ')).map((word) => {
      order += 1;
      return { id: `${order}:${word}`, order, word };
    }),
  }));
  return rows.map(({ line, words }, lineIndex) => (
    <span className="axx-line" key={line}>
      {words.map(({ id, order: position, word }, wordIndex) => (
        <span key={id}>
          <span className="axx-word" style={{ '--i': position } as React.CSSProperties}>
            {word}
          </span>
          {wordIndex < words.length - 1 ? ' ' : null}
        </span>
      ))}
      {lineIndex < rows.length - 1 ? ' ' : null}
    </span>
  ));
}

/**
 * The six-chapter homepage experience.
 *
 * Server component. Every headline, paragraph, link and list is in the initial HTML; the
 * WebGL stage behind the chapters is a client island that loads after first paint and is
 * purely decorative (`aria-hidden`). With JavaScript off, the page reads top to bottom as
 * a normal, fully linked marketing page.
 */
export function CinematicHome({ locale }: { locale: SiteLocale }) {
  const copy = EXPERIENCE_COPY[locale];
  const earlyAccess = localizedPath(locale, '/early-access');
  return (
    <div className="axx" data-motion-owner="experience" id={ROOT_ID}>
      <ExperienceStage locale={locale} rootId={ROOT_ID} />

      {/* 01 — The invisible */}
      <header className="axx-chapter axx-hero" data-chapter="0" id="make-work-visible">
        <div className="axx-hero-copy">
          <div className="axx-eyebrow">
            <span aria-hidden="true" className="axx-eyebrow-axis" />
            {copy.hero.eyebrow}
          </div>
          <h1 className="axx-display">
            <Kinetic lines={copy.hero.headline} locale={locale} />
          </h1>
          <p className="axx-statement">{copy.hero.statement}</p>
          <p className="axx-lead">{copy.hero.lead}</p>
          <div className="axx-actions">
            <a className="axx-button" data-magnetic data-variant="primary" href="#every-second">
              {copy.hero.explore}
              <ArrowDownIcon aria-hidden size={16} />
            </a>
            <a className="axx-button" data-magnetic href="#features">
              {copy.hero.product}
            </a>
          </div>
          <div className="axx-access">
            <Link className="axx-access-join" href={earlyAccess}>
              {copy.hero.join}
              <ArrowUpRightIcon aria-hidden size={14} />
            </Link>
            <Link
              className="axx-access-compare"
              href={localizedPath(locale, '/wakatime-alternative')}
            >
              {copy.hero.compare}
            </Link>
            <span>{copy.hero.earlyAccessNote}</span>
          </div>
          <ul aria-label={copy.hero.highlightsLabel} className="axx-highlights">
            {copy.hero.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </div>
        <p className="axx-scene-caption">{copy.hero.sceneCaption}</p>
        <a className="axx-scroll-cue" href="#every-second">
          <span aria-hidden="true" />
          {copy.hero.scroll}
        </a>
      </header>

      {/* 02 — Every second tells a story */}
      <section
        aria-labelledby="every-second-title"
        className="axx-chapter axx-second"
        data-chapter="1"
        id="every-second"
      >
        <div className="axx-copy">
          <span className="axx-kicker">{copy.second.kicker}</span>
          <h2 className="axx-heading" id="every-second-title">
            <Kinetic lines={[copy.second.heading]} locale={locale} />
          </h2>
          <p className="axx-body">{copy.second.body}</p>
        </div>
        <div className="axx-copy axx-copy-detail axx-reveal">
          <p>{copy.second.explain}</p>
          <p className="axx-hint">
            <span className="axx-demo-tag">{copy.demoBadge}</span> {copy.second.hoverHint}
          </p>
          <ProjectLegend label={copy.second.projectsLabel} locale={locale} />
        </div>
        <div className="axx-tools axx-reveal">
          <h3>{copy.second.toolsHeading}</h3>
          <p>{copy.second.toolsBody}</p>
          <div
            aria-label={copy.second.toolsRegion}
            className="axx-tools-list"
            role="region"
            tabIndex={0}
          >
            <ul aria-label={copy.second.toolsLabel}>
              {COMPATIBLE_EDITORS.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 03 — Human + AI */}
      <section
        aria-labelledby="human-ai-title"
        className="axx-chapter axx-human-ai"
        data-chapter="2"
        data-tone="dusk"
        id="human-ai"
      >
        <div className="axx-copy">
          <span className="axx-kicker">{copy.humanAi.kicker}</span>
          <h2 className="axx-heading" id="human-ai-title">
            <Kinetic lines={[copy.humanAi.heading]} locale={locale} />
          </h2>
          <p className="axx-subhead axx-reveal">{copy.humanAi.subheading}</p>
          <p className="axx-body">{copy.humanAi.body}</p>
        </div>
        <div className="axx-reveal">
          <AttributionExplorer locale={locale} />
        </div>
      </section>

      {/* 04 — From activity to insight. The id is the worked example the page's table of
          contents and WebPage schema point at. */}
      <section
        aria-labelledby="insight-title"
        className="axx-chapter axx-insight"
        data-chapter="3"
        id="worked-example"
      >
        <div className="axx-copy">
          <span className="axx-kicker">{copy.insight.kicker}</span>
          <h2 className="axx-heading" id="insight-title">
            <Kinetic lines={[copy.insight.heading]} locale={locale} />
          </h2>
          <p className="axx-body">{copy.insight.body}</p>
        </div>
        {/* The frame holds still while the 3D timeline flattens behind it and hands over. */}
        <div className="axx-insight-track">
          <div className="axx-insight-stage">
            <figure aria-label={copy.insight.frameLabel} className="axx-insight-frame">
              <WeekTimeline locale={locale} />
              <figcaption>
                <span className="axx-demo-tag">{copy.demoBadge}</span>
              </figcaption>
            </figure>
          </div>
        </div>
        <div className="axx-insight-notes axx-reveal">
          <p>{copy.insight.interpretation}</p>
          <p className="axx-source">{copy.insight.source}</p>
        </div>
      </section>

      {/* 05 — The product */}
      <div className="axx-chapter axx-product" data-chapter="4">
        <section aria-labelledby="product-title" className="axx-product-reveal" id="features">
          <div className="axx-copy axx-copy-center">
            <span className="axx-kicker">{copy.product.kicker}</span>
            <h2 className="axx-heading" id="product-title">
              <Kinetic lines={[copy.product.heading]} locale={locale} />
            </h2>
            <p className="axx-body">{copy.product.body}</p>
          </div>
          <ProductShowcase locale={locale} />
        </section>
        <section aria-labelledby="tracks-title" className="axx-tracks" id="what-atoaxis-tracks">
          <div className="axx-tracks-heading axx-reveal">
            <h2 id="tracks-title">{copy.product.featuresHeading}</h2>
            <p>{copy.product.featuresIntro}</p>
          </div>
          <ol className="axx-tracks-list">
            {copy.product.features.map((feature, index) => (
              <li className="axx-reveal" key={feature.title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 06 — The invitation */}
      <section
        aria-labelledby="invitation-title"
        className="axx-chapter axx-invitation"
        data-chapter="5"
        id="get-started"
      >
        <div className="axx-copy axx-copy-center">
          <span className="axx-kicker">{copy.invitation.kicker}</span>
          <h2 className="axx-heading axx-heading-xl" id="invitation-title">
            <Kinetic lines={[copy.invitation.heading]} locale={locale} />
          </h2>
          <p className="axx-body">{copy.invitation.body}</p>
          <div className="axx-actions axx-actions-center">
            <Link className="axx-button" data-magnetic data-variant="primary" href={earlyAccess}>
              {copy.invitation.primary}
              <ArrowUpRightIcon aria-hidden size={16} />
            </Link>
            <a className="axx-button" data-magnetic href="#features">
              {copy.invitation.secondary}
            </a>
          </div>
          <p className="axx-note">{copy.invitation.note}</p>
          <nav aria-label={copy.invitation.navLabel} className="axx-onward">
            <ul>
              {copy.invitation.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith('#') ? (
                    <a href={link.href}>{link.label}</a>
                  ) : (
                    <Link href={localizedPath(locale, link.href)}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </div>
  );
}
