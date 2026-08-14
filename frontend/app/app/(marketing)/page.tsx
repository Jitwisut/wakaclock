import { ComparisonSection } from '@/components/marketing/comparison-section';
import { CtaSection } from '@/components/marketing/cta-section';
import { DashboardPreviewSection } from '@/components/marketing/dashboard-preview-section';
import { EditorWallSection } from '@/components/marketing/editor-wall';
import { FaqSection } from '@/components/marketing/faq-section';
import { FeatureGridSection } from '@/components/marketing/feature-grid-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { PricingSection } from '@/components/marketing/pricing-section';
import { Bullets, MUTED_TEXT, Section } from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { type FaqEntry, faqSchema, graph } from '@/lib/seo/schema';
import { PRICING, PRODUCT_ANSWER, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s | AtoAxis" template, which would
  // otherwise render the brand name twice on the homepage.
  title: { absolute: `${SITE_NAME} — Developer Time Tracking with Complete History` },
  description: PRODUCT_ANSWER,
  alternates: { canonical: '/' },
  openGraph: { url: '/', title: `${SITE_NAME} — Developer Time Tracking with Complete History` },
};

const FAQ: readonly FaqEntry[] = [
  {
    question: `What is ${SITE_NAME}?`,
    answer: PRODUCT_ANSWER,
  },
  {
    question: `How does ${SITE_NAME} track coding activity?`,
    answer:
      'Your editor sends small events called heartbeats — one per file you touch, containing the ' +
      'file path, project, branch, language, editor and whether the file was saved. The server ' +
      'stores them in ClickHouse and groups consecutive heartbeats into duration blocks, which ' +
      'become your daily and weekly coding totals.',
  },
  {
    question: `Is ${SITE_NAME} a WakaTime alternative?`,
    answer:
      `${SITE_NAME} implements the WakaTime API, so it can receive data from editors that already ` +
      'have a WakaTime plugin, and it can import an existing WakaTime data export. Whether it is a ' +
      'complete replacement depends on which editors, integrations and reports you rely on.',
  },
  {
    question: `Which editors does ${SITE_NAME} support?`,
    answer:
      `${SITE_NAME} ships its own VS Code extension. Beyond that, any editor with a WakaTime ` +
      'plugin can send data by pointing the plugin’s api_url at your server, because the ' +
      'heartbeat API is WakaTime-compatible. Editors reached that way are supported through the ' +
      'protocol rather than through a plugin published by us.',
  },
  {
    question: `Can ${SITE_NAME} track applications outside the editor?`,
    answer:
      'The heartbeat API accepts an entity type of file, app, domain or url, so non-editor activity ' +
      'can be recorded by a client that sends it. No desktop or browser client that does this ships ' +
      'today — the VS Code extension sends file activity only.',
  },
  {
    question: `Does ${SITE_NAME} track AI coding tools such as Claude Code, Codex or Cursor?`,
    answer:
      'The heartbeat API accepts AI attribution fields — an agent name plus AI lines added and ' +
      'deleted — and the VS Code extension can configure Claude Code, Codex CLI and Gemini CLI hooks. ' +
      'Cursor and Copilot still need provider-specific adapters; custom tooling and WakaTime imports ' +
      'remain supported.',
  },
  {
    question: `How is coding time calculated?`,
    answer:
      'Heartbeats are grouped into sessions: consecutive heartbeats close together in time become a ' +
      'single duration block, and a long enough gap ends it. Total coding time is the sum of those ' +
      'blocks, so idle time between blocks is not counted.',
  },
  {
    question: `Where is ${SITE_NAME} data stored?`,
    answer:
      `${SITE_NAME} is a hosted service. Heartbeats are sent over HTTPS to servers we operate and ` +
      'stored in a ClickHouse database we run. Your source code never leaves your machine, but ' +
      'file paths and project names do — the privacy page describes exactly what is stored.',
  },
  {
    question: `Do I need to run a server to use ${SITE_NAME}?`,
    answer:
      'No. There is nothing to deploy and no database to maintain. Create an account, install the ' +
      'VS Code extension or point an existing WakaTime plugin at the API, and tracking starts.',
  },
  {
    question: `Does ${SITE_NAME} store my source code?`,
    answer:
      'No. A heartbeat records metadata about a file — its path, project, branch, detected ' +
      'language, line and character counts — but never the contents of the file. There is no ' +
      'field in the heartbeat schema that carries source code, prompts or AI responses.',
  },
  {
    question: `How much does ${SITE_NAME} cost?`,
    answer:
      `${SITE_NAME} costs $${PRICING.monthlyUsd} per month or $${PRICING.annualUsd} per year, with ` +
      `a ${PRICING.trialDays}-day trial. Every account includes the full product and your complete ` +
      'coding history; there are no feature-gated tiers and nothing extra to pay for hosting.',
  },
];

const USE_CASES = [
  'See how many hours you actually coded today, this week, or across a custom date range',
  'Break coding time down by project, programming language, editor and branch',
  'Compare AI-attributed lines against human keystrokes and characters over time',
  'Group work that spans several checkouts into one project using regex rules and merges',
  'Import an existing WakaTime export so historical data lands in the same dashboard',
];

const LIMITATIONS = [
  'The only editor plugin published by us is for VS Code; other editors connect through the WakaTime protocol.',
  'AI hooks currently cover Claude Code, Codex CLI and Gemini CLI; Cursor and Copilot need provider-specific adapters.',
  'AI token usage and cost are not tracked at all.',
  'There is no desktop or browser client yet, so activity outside a connected editor is not captured.',
  'There is no team or organisation dashboard — analytics are scoped to a single account.',
  'There is no free tier, and no self-hosted edition.',
];

export default function MarketingHomePage() {
  return (
    <>
      <JsonLd data={graph(faqSchema(FAQ))} />

      <HeroSection />
      <EditorWallSection />

      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <Section heading={`What is ${SITE_NAME}?`} id="what-is-atoaxis">
          <p className="text-base leading-relaxed">{PRODUCT_ANSWER}</p>
        </Section>

        <Section heading="How it works">
          <p style={MUTED_TEXT}>
            An editor plugin sends a heartbeat each time you type in, switch to, or save a
            file. Each heartbeat carries the file path, project, branch, detected language,
            editor and operating system — never the file&apos;s contents. The server writes
            them to ClickHouse, where materialised views roll them up into daily totals by
            project and language as the data arrives. Consecutive heartbeats are then grouped
            into duration blocks, and those blocks are what the dashboard reports as coding
            time.
          </p>
        </Section>

        <Section heading="Use cases">
          <Bullets items={USE_CASES} />
        </Section>

        <Section heading="Limitations">
          <p style={MUTED_TEXT}>
            What {SITE_NAME} does not do today, stated plainly so you can judge the fit:
          </p>
          <Bullets items={LIMITATIONS} />
        </Section>
      </div>

      <ComparisonSection />
      <DashboardPreviewSection />
      <FeatureGridSection />
      <PricingSection />
      <FaqSection entries={FAQ} />
      <CtaSection />
    </>
  );
}
