import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/json-ld';
import {
  breadcrumbSchema,
  faqSchema,
  graph,
  howToSchema,
  type HowToStep,
  organizationSchema,
  webPageSchema,
} from '@/lib/seo/schema';
import {
  createMarketingMetadata,
  localizedPath,
  ORGANIZATION,
  SITE_NAME,
  type SiteLocale,
  SOURCE_REPOSITORY_URL,
} from '@/lib/seo/site';

import { AnswerGuide, hasAnswerGuide } from './answer-guide';
import { ComparisonSection } from './comparison-section';
import { EarlyAccessForm } from './early-access-form';
import { FaqSection } from './faq-section';
import {
  type MarketingBlock,
  type MarketingPageKey,
  type MarketingSectionCopy,
  PAGE_COPY,
} from './marketing-copy';
import { PageIllustration } from './page-illustration';
import { PricingSection } from './pricing-section';
import {
  Breadcrumbs,
  Bullets,
  CodeBlock,
  LeadAnswer,
  MUTED_TEXT,
  PageShell,
  PageTitle,
  RelatedLinks,
  Section,
  Subheading,
} from './prose';

export function marketingPageMetadata(path: MarketingPageKey, locale: SiteLocale) {
  const copy = PAGE_COPY[path][locale];
  return createMarketingMetadata({
    description: copy.description,
    locale,
    path,
    title: copy.metadataTitle,
  });
}

function renderBlock(block: MarketingBlock, key: string): ReactNode {
  switch (block.kind) {
    case 'paragraph': {
      return (
        <p key={key} style={MUTED_TEXT}>
          {block.text}
        </p>
      );
    }
    case 'bullets': {
      return <Bullets items={block.items} key={key} />;
    }
    case 'subheading': {
      return <Subheading key={key}>{block.text}</Subheading>;
    }
    case 'code': {
      return (
        <CodeBlock key={key} label={block.label}>
          {block.value}
        </CodeBlock>
      );
    }
    case 'email': {
      return (
        <p key={key} style={MUTED_TEXT}>
          {block.before}
          <a className="underline underline-offset-4" href={`mailto:${ORGANIZATION.email}`}>
            {ORGANIZATION.email}
          </a>
          {block.after}
        </p>
      );
    }
    default: {
      return null;
    }
  }
}

function renderSections(sections: readonly MarketingSectionCopy[]) {
  return sections.map((item) => (
    <Section heading={item.heading} id={item.id} key={item.id}>
      {item.blocks.map((block, index) => renderBlock(block, `${item.id}-${index}`))}
    </Section>
  ));
}

function renderRelated(copy: ReturnType<typeof getCopy>, locale: SiteLocale) {
  return copy.related?.map((group) => (
    <RelatedLinks
      heading={group.heading ?? (locale === 'th' ? 'หน้าที่เกี่ยวข้อง' : 'Related pages')}
      key={`${group.heading ?? 'related'}-${group.links[0]?.href ?? 'empty'}`}
      links={group.links.map((link) => ({ ...link, href: localizedPath(locale, link.href) }))}
    />
  ));
}

function getCopy(path: MarketingPageKey, locale: SiteLocale) {
  return PAGE_COPY[path][locale];
}

/**
 * The first prose in a section, used as that step's instruction text.
 *
 * Reading it back off the rendered blocks is what keeps the HowTo markup and the visible
 * page in step — a section that is reworded or removed changes the structured data with
 * it, and there is no second copy to forget to update.
 */
function stepText(blocks: readonly MarketingBlock[]): string {
  for (const block of blocks) {
    if (block.kind === 'paragraph') return block.text;
    if (block.kind === 'bullets') return block.items.join('. ');
  }
  return '';
}

function howToSteps(sections: readonly MarketingSectionCopy[]): HowToStep[] {
  return sections
    .map((item) => ({ name: item.heading, text: stepText(item.blocks) }))
    .filter((step) => step.text.length > 0);
}

function PageIndex({ copy, locale }: { copy: ReturnType<typeof getCopy>; locale: SiteLocale }) {
  return (
    <aside className="mkt-page-index">
      <nav aria-label={locale === 'th' ? 'หัวข้อในหน้านี้' : 'On this page'}>
        <p className="mkt-index-label">{locale === 'th' ? 'หัวข้อในหน้านี้' : 'On this page'}</p>
        <ol>
          {copy.sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                {section.heading}
              </a>
            </li>
          ))}
          {copy.faq ? (
            <li>
              <a href="#faq">{copy.faq.heading}</a>
            </li>
          ) : null}
          {hasAnswerGuide(copy.breadcrumbs.at(-1)?.path ?? '', locale) ? (
            <li>
              <a href="#answer-guide">Key takeaways and sources</a>
            </li>
          ) : null}
        </ol>
      </nav>
    </aside>
  );
}

function pageVariant(path: MarketingPageKey) {
  if (path === '/contact' || path === '/early-access') return 'utility';
  if (path.startsWith('/docs') || ['/about', '/privacy', '/terms'].includes(path)) {
    return 'editorial';
  }
  return 'product';
}

function PlacedIllustration({
  locale,
  path,
  placement,
}: {
  locale: SiteLocale;
  path: MarketingPageKey;
  placement: 'body' | 'closing' | 'intro';
}) {
  const positions: Record<string, string> = {
    '/ai-coding-tracker': 'intro',
    '/integrations': 'intro',
    '/ai-cost-tracking': 'body',
    '/developer-analytics': 'body',
    '/teams': 'closing',
  };
  return positions[path] === placement ? <PageIllustration locale={locale} path={path} /> : null;
}

export function LocalizedMarketingPage({
  path,
  locale,
}: {
  locale: SiteLocale;
  path: MarketingPageKey;
}) {
  const copy = getCopy(path, locale);
  const breadcrumbs = copy.breadcrumbs.map((entry) => ({
    ...entry,
    path: localizedPath(locale, entry.path),
  }));
  const schemas = [
    breadcrumbSchema(breadcrumbs),
    webPageSchema({
      path,
      locale,
      name: copy.title,
      description: copy.lead,
      sections: copy.sections.map(({ id, heading }) => ({ id, name: heading })),
    }),
  ];
  if (copy.faq) schemas.push(faqSchema(copy.faq.entries));
  if (copy.schema === 'organization') schemas.push(organizationSchema());
  if (copy.howTo) {
    const steps = howToSteps(copy.sections);
    if (steps.length > 0) {
      schemas.push(
        howToSchema({ name: copy.howTo.name, description: copy.howTo.description, steps })
      );
    }
  }

  const comparisonIndex =
    copy.component?.kind === 'comparison'
      ? copy.sections.findIndex((section) => section.id === copy.component?.afterSectionId)
      : -1;
  const firstSections =
    comparisonIndex >= 0 ? copy.sections.slice(0, comparisonIndex + 1) : copy.sections;
  const trailingSections = comparisonIndex >= 0 ? copy.sections.slice(comparisonIndex + 1) : [];
  const pricing = copy.component?.kind === 'pricing';
  const introArt = path === '/ai-coding-tracker' || path === '/integrations';

  return (
    <>
      <PageShell variant={pageVariant(path)}>
        <Breadcrumbs entries={breadcrumbs} locale={locale} />
        <div className={introArt ? 'mkt-illustrated-intro' : undefined} data-page={path}>
          <header className="mkt-page-intro">
            {copy.badge ? (
              <p
                className="mb-5 inline-flex border-2 px-3 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
              >
                {copy.badge}
              </p>
            ) : null}
            <PageTitle>{copy.title}</PageTitle>
            <LeadAnswer>{copy.lead}</LeadAnswer>
          </header>
          <PlacedIllustration locale={locale} path={path} placement="intro" />
        </div>
        <div className="mkt-reading-layout">
          <PageIndex copy={copy} locale={locale} />
          <div className="mkt-page-content">
            {pricing ? (
              <>
                {renderSections(firstSections)}
                <PricingSection locale={locale} />
              </>
            ) : (
              <>
                {renderSections(firstSections.slice(0, 1))}
                <PlacedIllustration locale={locale} path={path} placement="body" />
                {renderSections(firstSections.slice(1))}
              </>
            )}
            {copy.component?.kind === 'comparison' ? <ComparisonSection locale={locale} /> : null}
            {trailingSections.length > 0 ? renderSections(trailingSections) : null}
          </div>
        </div>
        <PlacedIllustration locale={locale} path={path} placement="closing" />
        {hasAnswerGuide(path, locale) ? <AnswerGuide locale={locale} path={path} /> : null}
        {renderRelated(copy, locale)}
        <footer className="mkt-page-provenance">
          <p>
            {locale === 'th' ? 'เผยแพร่โดย' : 'Published by'} {SITE_NAME}
          </p>
          <div>
            <a href={localizedPath(locale, '/about')}>
              {locale === 'th' ? 'รู้จักทีมผู้พัฒนา' : 'Meet the team'}
            </a>
            <a href={SOURCE_REPOSITORY_URL} rel="noopener noreferrer" target="_blank">
              {locale === 'th' ? 'ดูซอร์สโค้ดผลิตภัณฑ์' : 'Explore the product source'}
            </a>
            <a href={localizedPath(locale, '/contact')}>
              {locale === 'th' ? 'สอบถามข้อมูล' : 'Ask a question'}
            </a>
          </div>
        </footer>
      </PageShell>
      {copy.form ? <EarlyAccessForm locale={locale} sourcePage={`${locale}${path}`} /> : null}
      {copy.faq ? (
        <FaqSection entries={copy.faq.entries} heading={copy.faq.heading} locale={locale} />
      ) : null}
      {/* Rendered last, not first: see the note in marketing-home-page.tsx. */}
      <JsonLd data={graph(...schemas)} />
    </>
  );
}
