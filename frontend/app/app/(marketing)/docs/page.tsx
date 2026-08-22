import {
  Breadcrumbs,
  LeadAnswer,
  MUTED_TEXT,
  PageShell,
  PageTitle,
  RelatedLinks,
  Section,
} from '@/components/marketing/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbSchema, graph } from '@/lib/seo/schema';
import { createMarketingMetadata, SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const CANONICAL = '/docs';

export const metadata: Metadata = createMarketingMetadata({
  title: 'Documentation',
  description:
    'AtoAxis documentation for hosted setup, VS Code integration, WakaTime-compatible editors and heartbeat data privacy, so developers can evaluate the service.',
  path: CANONICAL,
});

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Docs', path: CANONICAL },
];

export default function DocsIndexPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Documentation</PageTitle>

        <LeadAnswer>
          Everything needed to evaluate and connect to {SITE_NAME}: how the hosted service works,
          what the VS Code extension records, how WakaTime-compatible editors connect, and the
          complete list of fields a heartbeat stores.
        </LeadAnswer>

        <Section heading="Start here" id="start">
          <p style={MUTED_TEXT}>
            If you are setting {SITE_NAME} up for the first time, work through the getting
            started guide top to bottom — it ends with a verification step so you know tracking
            is actually working before you rely on it.
          </p>
        </Section>

        <RelatedLinks
          heading="Guides"
          links={[
            {
              href: '/docs/getting-started',
              label: 'Getting started',
              description:
                'Hosted requirements, API keys, connecting an editor, verifying and troubleshooting',
            },
            {
              href: '/integrations/vscode',
              label: 'VS Code integration reference',
              description: 'Every setting and command, what is tracked, and what is not',
            },
            {
              href: '/privacy',
              label: 'Privacy and data collection',
              description: 'Every heartbeat field, what is never collected, retention and deletion',
            },
            {
              href: '/developer-analytics',
              label: 'Developer analytics',
              description: 'The metrics produced and how each is calculated',
            },
          ]}
        />
      </PageShell>
    </>
  );
}
