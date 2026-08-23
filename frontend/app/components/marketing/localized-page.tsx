import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, faqSchema, graph, organizationSchema } from '@/lib/seo/schema';
import {
  createMarketingMetadata,
  localizedPath,
  ORGANIZATION,
  type SiteLocale,
} from '@/lib/seo/site';

import { ComparisonSection } from './comparison-section';
import { EarlyAccessForm } from './early-access-form';
import { FaqSection } from './faq-section';
import {
  type MarketingBlock,
  type MarketingPageKey,
  type MarketingSectionCopy,
  PAGE_COPY,
} from './marketing-copy';
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
  const schemas = [breadcrumbSchema(breadcrumbs)];
  if (copy.faq) schemas.push(faqSchema(copy.faq.entries));
  if (copy.schema === 'organization') schemas.push(organizationSchema());

  const comparisonIndex =
    copy.component?.kind === 'comparison'
      ? copy.sections.findIndex((section) => section.id === copy.component?.afterSectionId)
      : -1;
  const firstSections =
    comparisonIndex >= 0 ? copy.sections.slice(0, comparisonIndex + 1) : copy.sections;
  const trailingSections = comparisonIndex >= 0 ? copy.sections.slice(comparisonIndex + 1) : [];
  const pricing = copy.component?.kind === 'pricing';

  return (
    <>
      <PageShell>
        <Breadcrumbs entries={breadcrumbs} locale={locale} />
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
        {pricing ? (
          <>
            {renderSections(firstSections)}
            <PricingSection locale={locale} />
          </>
        ) : (
          renderSections(firstSections)
        )}
        {copy.component?.kind === 'comparison' ? <ComparisonSection locale={locale} /> : null}
        {trailingSections.length > 0 ? renderSections(trailingSections) : null}
        {renderRelated(copy, locale)}
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
