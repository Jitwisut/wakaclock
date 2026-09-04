import { JsonLd } from '@/components/seo/json-ld';
import { faqSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, SITE_NAME, type SiteLocale } from '@/lib/seo/site';

import { ComparisonSection } from './comparison-section';
import { CtaSection } from './cta-section';
import { DashboardPreviewSection } from './dashboard-preview-section';
import { EditorWallSection } from './editor-wall';
import { FaqSection } from './faq-section';
import { FeatureGridSection } from './feature-grid-section';
import { HeroSection } from './hero-section';
import { EN_HOME, TH_HOME } from './marketing-copy';
import { PricingSection } from './pricing-section';
import { Bullets, MUTED_TEXT, Section } from './prose';
import { QuickStartSection } from './quick-start-section';

const HOME_COPY = { en: EN_HOME, th: TH_HOME } as const;

export function marketingHomeMetadata(locale: SiteLocale) {
  const copy = HOME_COPY[locale];
  return {
    ...createMarketingMetadata({
      description: copy.description,
      locale,
      path: '/',
      title: `${SITE_NAME} — ${copy.title.replace('\n', ' ')}`,
    }),
    title: { absolute: `${SITE_NAME} — ${copy.title.replace('\n', ' ')}` },
  };
}

export function MarketingHomePage({ locale = 'en' }: { locale?: SiteLocale }) {
  const copy = HOME_COPY[locale];
  return (
    <>
      <HeroSection locale={locale} />
      <EditorWallSection locale={locale} />
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        {/*
          Headings are phrased as questions on purpose. They are the questions a visitor
          actually arrives with, and they are also what an answer engine matches a query
          against before quoting the paragraph underneath.
        */}
        <Section
          heading={locale === 'th' ? 'สรุปสั้น ๆ' : 'Key takeaways'}
          id="key-takeaways"
          reveal={false}
        >
          <Bullets items={copy.keyTakeaways} />
        </Section>
        <Section
          heading={locale === 'th' ? `${SITE_NAME} คืออะไร?` : `What is ${SITE_NAME}?`}
          id="what-is-atoaxis"
          reveal={false}
        >
          {copy.whatIs.map((paragraph) => (
            <p className="text-base leading-relaxed" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </Section>
        <Section
          heading={
            locale === 'th'
              ? `${SITE_NAME} ติดตามเวลาเขียนโค้ดอย่างไร?`
              : `How does ${SITE_NAME} track your coding time?`
          }
          id="how-it-works"
          reveal={false}
        >
          {copy.howItWorks.map((paragraph) => (
            <p key={paragraph} style={MUTED_TEXT}>
              {paragraph}
            </p>
          ))}
        </Section>
        <Section
          heading={locale === 'th' ? 'ใช้ทำอะไรได้บ้าง?' : 'What can you do with it?'}
          id="use-cases"
        >
          <Bullets items={copy.useCases} />
        </Section>
        <Section
          heading={
            locale === 'th'
              ? `${SITE_NAME} ยังทำอะไรไม่ได้บ้าง?`
              : `What does ${SITE_NAME} not do yet?`
          }
          id="limitations"
        >
          <p style={MUTED_TEXT}>{copy.limitationsIntro}</p>
          <Bullets items={copy.limitations} />
        </Section>
      </div>
      <ComparisonSection locale={locale} />
      <DashboardPreviewSection locale={locale} />
      <FeatureGridSection locale={locale} />
      <QuickStartSection locale={locale} />
      <PricingSection locale={locale} />
      <FaqSection
        entries={copy.faq}
        heading={locale === 'th' ? 'คำถามที่พบบ่อย' : 'Frequently asked questions'}
        locale={locale}
      />
      {/*
        The verdict sits after the FAQ and before the CTA: a reader who has got this far
        is deciding, and the honest form of that is naming who should not buy as clearly
        as who should.
      */}
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <Section heading={copy.verdict.heading} id="verdict">
          <p className="text-base leading-relaxed">{copy.verdict.fits}</p>
          <p style={MUTED_TEXT}>{copy.verdict.doesNotFit}</p>
          <p style={MUTED_TEXT}>{copy.verdict.closing}</p>
        </Section>
      </div>
      <CtaSection locale={locale} />
      {/*
        JSON-LD is rendered last, after the visible content, and that position is load
        bearing rather than stylistic.

        Observed, not diagnosed: with this element rendered first, the production build of
        the English homepage emitted a hero without its primary "Join early access" button,
        in both the HTML and the RSC payload, while the Thai homepage was correct and the
        same component was correct on a route of its own. Moving this element after the
        content restores it; so does passing an empty graph. Turbopack and webpack builds
        behaved identically, `renderToStaticMarkup` never reproduced it, and payload size,
        keys, href collisions and the inline style prop were each ruled out. The mechanism
        is still unexplained.

        Position in the body does not affect how search engines read JSON-LD, so leaving it
        here costs nothing. If this is ever revisited, measure against the built
        `.next/server/app/index.html` — the dev server renders correctly either way, so it
        cannot be used to reproduce or to confirm a fix.
      */}
      <JsonLd data={graph(faqSchema(copy.faq))} />
    </>
  );
}
