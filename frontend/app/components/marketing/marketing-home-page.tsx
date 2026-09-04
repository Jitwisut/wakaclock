import { Fragment } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, faqSchema, graph } from '@/lib/seo/schema';
import {
  createMarketingMetadata,
  localizedPath,
  ORGANIZATION,
  SITE_MODIFIED,
  SITE_NAME,
  type SiteLocale,
  SOURCE_REPOSITORY_URL,
} from '@/lib/seo/site';

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

const ACCOUNTABILITY_COPY = {
  en: {
    heading: 'Who publishes and reviews this page?',
    intro:
      'AtoAxis product engineering writes and reviews this page against the shipped code and the primary documentation linked below. The publisher is named here so every capability claim has an accountable owner rather than an anonymous byline.',
    publisher: 'Publisher',
    reviewer: 'Reviewed by',
    reviewerValue: 'AtoAxis product engineering',
    markCaption: 'The AtoAxis product mark, used by the publisher named below.',
    reviewed: 'Last reviewed',
    evidence: 'Evidence',
    evidenceValue: 'Public source code and primary vendor documentation',
    policies: 'Policies and contact',
    about: 'About the publisher',
    privacy: 'Privacy',
    contact: 'Contact',
    source: 'Source repository',
  },
  th: {
    heading: 'ใครเป็นผู้เผยแพร่และตรวจทานหน้านี้?',
    intro:
      'ทีมวิศวกรรมผลิตภัณฑ์ AtoAxis เขียนและตรวจทานหน้านี้เทียบกับโค้ดที่ใช้งานจริงและเอกสารต้นทางที่ลิงก์ไว้ด้านล่าง เราระบุผู้เผยแพร่ไว้ชัดเจนเพื่อให้ทุกคำกล่าวอ้างมีผู้รับผิดชอบ ไม่ใช่บทความนิรนาม',
    publisher: 'ผู้เผยแพร่',
    reviewer: 'ผู้ตรวจทาน',
    reviewerValue: 'ทีมวิศวกรรมผลิตภัณฑ์ AtoAxis',
    markCaption: 'เครื่องหมายผลิตภัณฑ์ AtoAxis ใช้โดยผู้เผยแพร่ที่ระบุด้านล่าง',
    reviewed: 'ตรวจทานล่าสุด',
    evidence: 'หลักฐาน',
    evidenceValue: 'source code สาธารณะและเอกสารต้นทางของผู้ให้บริการ',
    policies: 'นโยบายและช่องทางติดต่อ',
    about: 'เกี่ยวกับผู้เผยแพร่',
    privacy: 'ความเป็นส่วนตัว',
    contact: 'ติดต่อ',
    source: 'source repository',
  },
} as const;

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
  const accountability = ACCOUNTABILITY_COPY[locale];
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
          {/*
            Collapsed by default because the summary above is the point of this block and a
            visible list of links would compete with it. <details> keeps the jump links in
            the document either way — the contents are parsed and indexed whether or not a
            reader opens it.
          */}
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer" style={MUTED_TEXT}>
              {locale === 'th' ? 'หัวข้อในหน้านี้' : 'On this page'}
            </summary>
            <ul className="mt-3 space-y-1.5 pl-4" style={MUTED_TEXT}>
              {copy.tableOfContents.map((entry) => (
                <li key={entry.id}>
                  <a className="underline underline-offset-4" href={`#${entry.id}`}>
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </Section>
        {/*
          Label/value rather than prose. A spec block is the shape a reader scans for a
          single fact, and the shape an answer engine can lift one row out of without
          having to parse a sentence for it.
        */}
        <Section heading={copy.atAGlance.heading} id="at-a-glance" reveal={false}>
          <dl
            className="grid gap-3 border-2 p-4 text-sm sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-x-6"
            style={{ borderColor: 'var(--mkt-border)' }}
          >
            {copy.atAGlance.entries.map((entry) => (
              <Fragment key={entry.label}>
                <dt className="font-semibold">{entry.label}:</dt>
                <dd style={MUTED_TEXT}>{entry.value}</dd>
              </Fragment>
            ))}
          </dl>
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
        <Section heading={accountability.heading} id="accountability">
          <div className="flex items-start gap-4">
            {/*
              A figure with a caption rather than a bare <img>: the caption says which
              entity the mark belongs to, which is the thing a reader — or a model
              summarising who stands behind this page — actually needs from it.

              No `priority` here on purpose. This sits below the FAQ, well under the fold,
              so lazy loading is correct; preloading it would compete with the content that
              really is above the fold.
            */}
            <figure className="shrink-0 text-center">
              <Image
                alt={`${SITE_NAME} product mark`}
                className="size-16 border-2 object-cover"
                height={64}
                src="/atoaxis-logo-mark.png"
                width={64}
              />
              <figcaption className="mt-1 text-[0.65rem]" style={MUTED_TEXT}>
                {accountability.markCaption}
              </figcaption>
            </figure>
            <p style={MUTED_TEXT}>{accountability.intro}</p>
          </div>
          <dl
            className="grid gap-3 border-2 p-4 text-sm"
            style={{ borderColor: 'var(--mkt-border)' }}
          >
            <div>
              <dt className="font-semibold">{accountability.publisher}:</dt>
              <dd style={MUTED_TEXT}>{ORGANIZATION.legalName}</dd>
            </div>
            <div>
              <dt className="font-semibold">{accountability.reviewer}:</dt>
              <dd style={MUTED_TEXT}>
                <Link
                  className="underline underline-offset-4"
                  href={localizedPath(locale, '/about')}
                  rel="author"
                >
                  {accountability.reviewerValue}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{accountability.reviewed}:</dt>
              <dd style={MUTED_TEXT}>
                <time dateTime={SITE_MODIFIED}>{SITE_MODIFIED}</time>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{accountability.evidence}:</dt>
              <dd style={MUTED_TEXT}>
                <a
                  className="underline underline-offset-4"
                  href={SOURCE_REPOSITORY_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {accountability.evidenceValue}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{accountability.policies}:</dt>
              <dd className="flex flex-wrap gap-x-3" style={MUTED_TEXT}>
                <Link href={localizedPath(locale, '/about')}>{accountability.about}</Link>
                <Link href={localizedPath(locale, '/privacy')}>{accountability.privacy}</Link>
                <Link href={localizedPath(locale, '/contact')}>{accountability.contact}</Link>
              </dd>
            </div>
          </dl>
        </Section>
        <Section heading={copy.sources.heading} id="sources">
          <p style={MUTED_TEXT}>{copy.sources.intro}</p>
          {/*
            <cite> marks the title of the referenced work, which is what these labels are.
            It costs nothing visually and makes the citation legible to anything reading
            the markup rather than the prose.
          */}
          <ul className="mt-4 space-y-3 text-sm" style={MUTED_TEXT}>
            {copy.sources.items.map((item) => (
              <li key={item.href}>
                {item.claim} {locale === 'th' ? 'แหล่งอ้างอิง' : 'Source'}:{' '}
                <cite>
                  <a
                    className="underline underline-offset-4"
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </a>
                </cite>
              </li>
            ))}
          </ul>
        </Section>
        {/*
          A machine-readable review date. `dateModified` already says this in JSON-LD, but
          only a <time datetime> says it in the document itself, where a reader and a
          crawler that never parses the schema block can both see it.
        */}
        <p className="mt-10 text-xs" style={MUTED_TEXT}>
          {locale === 'th' ? 'ตรวจทานล่าสุด: ' : 'Last reviewed: '}
          <time dateTime={SITE_MODIFIED}>{SITE_MODIFIED}</time>
        </p>
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
      <JsonLd
        data={graph(
          faqSchema(copy.faq),
          breadcrumbSchema([{ name: locale === 'th' ? 'หน้าหลัก' : 'Home', path: '/' }])
        )}
      />
    </>
  );
}
