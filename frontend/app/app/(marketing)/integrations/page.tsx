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
import { SITE_NAME } from '@/lib/seo/site';

import type { Metadata } from 'next';

const CANONICAL = '/integrations';

export const metadata: Metadata = {
  title: 'Editor Integrations',
  description:
    `How editors connect to ${SITE_NAME}: a dedicated VS Code extension, or any editor with a ` +
    'WakaTime plugin pointed at the AtoAxis API, which is WakaTime-compatible.',
  alternates: { canonical: CANONICAL },
  openGraph: { url: CANONICAL, title: `Editor Integrations | ${SITE_NAME}` },
};

const BREADCRUMBS = [
  { name: 'Home', path: '/' },
  { name: 'Integrations', path: CANONICAL },
];

export default function IntegrationsIndexPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbSchema(BREADCRUMBS))} />

      <PageShell>
        <Breadcrumbs entries={BREADCRUMBS} />
        <PageTitle>Editor integrations</PageTitle>

        <LeadAnswer>
          There are two ways to get coding activity into {SITE_NAME}. Install the dedicated VS
          Code extension, which is the only editor plugin we publish, or point an editor that
          already has a WakaTime plugin at AtoAxis — the heartbeat API is
          WakaTime-compatible, so that takes one configuration change and no new extension.
        </LeadAnswer>

        <Section heading="Published by us" id="first-party">
          <p style={MUTED_TEXT}>
            One integration is built and maintained in this project:
          </p>
        </Section>

        <RelatedLinks
          heading="First-party integration"
          links={[
            {
              href: '/integrations/vscode',
              label: 'VS Code',
              description:
                'Tracks files, saves, keystrokes, debug sessions and build tasks; shows today’s total in the status bar',
            },
          ]}
        />

        <Section heading="Everything else, via the WakaTime protocol" id="protocol">
          <p style={MUTED_TEXT}>
            Any editor with a WakaTime plugin can report to {SITE_NAME} by setting{' '}
            <code>api_url</code> in <code>~/.wakatime.cfg</code> to your server and using an API
            key generated there. Editors connected this way are supported through protocol
            compatibility rather than through a plugin published by us — so their behaviour,
            update cadence and feature set are determined by that plugin, not by {SITE_NAME}.
          </p>
        </Section>

        <RelatedLinks
          links={[
            {
              href: '/docs/getting-started',
              label: `Install ${SITE_NAME}`,
              description: 'Server setup, API keys, connecting an editor and verifying tracking',
            },
            {
              href: '/wakatime-alternative',
              label: 'Migrating from WakaTime',
              description: 'Repointing an existing plugin and importing your data export',
            },
          ]}
        />
      </PageShell>
    </>
  );
}
