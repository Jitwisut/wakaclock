import { FaqSection } from '@/components/marketing/faq-section';
import {
  Breadcrumbs,
  Bullets,
  LeadAnswer,
  MUTED_TEXT,
  PageShell,
  PageTitle,
  RelatedLinks,
  Section,
  Subheading,
} from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, type FaqEntry, faqSchema, graph } from '@/lib/seo/schema';
import { SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const CANONICAL = '/teams';

/**
 * Roadmap page. Nothing described here is built — there is no team model, no presence
 * transport and no avatar UI in the codebase (see plan.md Phase 7).
 *
 * Consequently this page:
 *   - states its status in the first sentence and again in the FAQ,
 *   - describes every capability in the future tense,
 *   - emits BreadcrumbList and FAQPage only — never SoftwareApplication feature claims,
 *   - is excluded from PRODUCT_ANSWER and the site-level description.
 *
 * If any of this ships, move the copy to present tense here and update the shipped
 * capability lists at the same time. Do not do one without the other.
 */
export const metadata: Metadata = {
  title: 'Team Presence for Remote Developers (In Development)',
  description:
    `A live view of who on your team is coding right now, driven by real editor activity ` +
    `rather than a self-reported status. In development at ${SITE_NAME} — not yet available.`,
  alternates: { canonical: CANONICAL },
  openGraph: {
    url: CANONICAL,
    title: `Team Presence for Remote Developers | ${SITE_NAME}`,
  },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Teams', path: CANONICAL },
];

const FAQ: readonly FaqEntry[] = [
  {
    question: `Can I use team features in ${SITE_NAME} today?`,
    answer:
      'No. Team presence, sub-teams and co-working sessions are in development and are not ' +
      `available yet. ${SITE_NAME} today is a single-account product: analytics are scoped to ` +
      'your own coding activity.',
  },
  {
    question: 'What is coding presence?',
    answer:
      'A live view of which teammates are actively coding, shown as avatars in a shared room. ' +
      'Unlike a chat status, it is not something anyone sets by hand — it is derived from the ' +
      'same editor heartbeats that produce coding-time analytics, so it reflects real activity.',
  },
  {
    question: 'Will managers be able to watch what individual developers are doing?',
    answer:
      'No. Presence is designed to be mutual and symmetric: anyone who can see the room also ' +
      'appears in it, including owners and admins. There is no invisible mode. Presence also ' +
      'carries activity state only — working, idle or offline — and never file paths, project ' +
      'names or branches.',
  },
  {
    question: 'How will this differ from Discord, Slack or Gather?',
    answer:
      'Those tools show you as online because you moved a mouse or set a status manually. ' +
      'Coding presence is derived from editor activity, so it reflects whether you are actually ' +
      'writing code. It is intended as an ambient signal for remote teams, not a chat product.',
  },
  {
    question: 'What will dragging two avatars together do?',
    answer:
      'It will start a co-working session that is recorded. When the session ends, both ' +
      'participants see it in their own history — how long it lasted and who was in it — so ' +
      'time spent collaborating is measured rather than estimated.',
  },
  {
    question: 'When will this be available?',
    answer:
      'There is no committed date. It depends on team and organisation support landing first, ' +
      'which is also still in development.',
  },
];

const PRINCIPLES = [
  'Anyone who can see the room appears in it — including owners and admins. There is no observer role and no invisible mode.',
  'Presence shows activity state only: working, idle or offline. Never file paths, project names or branches.',
  'Presence is opt-in, and you can leave a room without leaving the organisation.',
  'Nothing about presence changes what is stored in your heartbeats.',
];

export default function TeamsPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS), faqSchema(FAQ))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />

        <p
          className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--mkt-border)', color: 'var(--mkt-fg-muted)' }}
        >
          In development — not available yet
        </p>

        <PageTitle>Coding presence for remote teams</PageTitle>

        <LeadAnswer>
          This describes something {SITE_NAME} is building, not something you can use today.
          The idea: a live room showing which teammates are actually coding right now, as
          avatars you can drag together to start a shared working session. The signal comes
          from real editor activity, so it is not a status anyone sets by hand.
        </LeadAnswer>

        <Section heading="The problem" id="problem">
          <p style={MUTED_TEXT}>
            Remote teams lose the ambient awareness an office gives you for free — whether
            anyone else is heads-down right now, whether this is a reasonable moment to
            interrupt, whether you are the only one still working. Chat presence does not
            recover it, because a green dot only means an app is open. It is set by hand,
            goes stale, and says nothing about whether someone is in flow.
          </p>
        </Section>

        <Section heading="Presence you cannot fake" id="how">
          <p style={MUTED_TEXT}>
            {SITE_NAME} already receives a heartbeat from your editor roughly every 30 seconds
            while you work. That is the same signal behind your coding-time dashboards, and it
            is enough to answer &ldquo;is this person writing code right now&rdquo; without
            anyone reporting anything.
          </p>
          <p style={MUTED_TEXT}>
            That is the whole difference. A status in a chat app reflects an open window. This
            reflects work.
          </p>
        </Section>

        <Section heading="How presence will work" id="design">
          <Subheading>Sub-teams</Subheading>
          <p style={MUTED_TEXT}>
            An organisation subscribes for a number of seats, and the owner divides those
            seats into smaller working groups. Each group gets its own room, so a large
            organisation does not become one crowded canvas.
          </p>

          <Subheading>Dragging avatars together</Subheading>
          <p style={MUTED_TEXT}>
            Dragging two avatars together will start a co-working session that is recorded.
            When it ends, both people see it in their own history — how long it ran and who
            took part. Collaboration becomes something measured rather than estimated, which
            is a number no coding-time tool reports today.
          </p>
        </Section>

        <Section heading="What this will not be" id="principles">
          <p style={MUTED_TEXT}>
            Presence and surveillance are separated by design decisions, not by intent, so
            these are commitments rather than reassurances:
          </p>
          <Bullets items={PRINCIPLES} />
          <p style={MUTED_TEXT}>
            The reasoning is simple. A room where everyone is equally visible feels like
            sitting together. A view where one person watches the others is monitoring
            software, and monitoring software is not what we want to build.
          </p>
        </Section>

        <Section heading="What you can use today" id="today">
          <p style={MUTED_TEXT}>
            Everything on this page is ahead of us. What works right now is individual
            tracking: coding time by project, language, branch and editor, keystroke and
            character counts, and your complete history.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/developer-analytics',
              label: 'What is available today',
              description: 'The metrics currently produced, and how each is calculated',
            },
            {
              href: '/docs/getting-started',
              label: `Start tracking with ${SITE_NAME}`,
              description: 'Create an account and connect an editor in a couple of minutes',
            },
            {
              href: '/privacy',
              label: 'What data is collected',
              description: 'Every heartbeat field, and what is never recorded',
            },
          ]}
        />
      </PageShell>

      <FaqSection entries={FAQ} heading="Team presence FAQ" />
    </>
  );
}
