import type { SettingsGroup, SettingsItem } from '@/components/wakaclock/settings-shell';

export type TeamSectionId =
  | 'billing'
  | 'create'
  | 'insights'
  | 'integrations'
  | 'overview'
  | 'people';

const ITEMS: Record<TeamSectionId, SettingsItem> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    description: 'Health, setup and data trust for this organization.',
    keywords: ['health', 'setup', 'onboarding', 'trust', 'readiness', 'recovery', 'privacy'],
  },
  insights: {
    id: 'insights',
    label: 'Insights',
    description: 'Completed weeks: comparisons, summaries, actions and cost evidence.',
    keywords: ['report', 'week', 'comparison', 'summary', 'actions', 'cost', 'ai', 'export'],
  },
  people: {
    id: 'people',
    label: 'People',
    description: 'Teams, members and invitations.',
    keywords: ['members', 'invite', 'teams', 'roles', 'seats'],
  },
  integrations: {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect GitHub so work links to repositories and pull requests.',
    keywords: ['github', 'copilot', 'repositories', 'sync', 'pull requests'],
  },
  billing: {
    id: 'billing',
    label: 'Billing',
    description: 'Trial, plan, checkout and invoices. Owner actions.',
    keywords: ['trial', 'plan', 'checkout', 'invoice', 'subscription', 'cancel', 'portal'],
  },
  create: {
    id: 'create',
    label: 'New Organization',
    description: 'Start a separate organization with its own people and billing.',
    keywords: ['create', 'add', 'new', 'organization', 'workspace'],
  },
};

export const ORGANIZATION_SECTIONS: TeamSectionId[] = [
  'overview',
  'insights',
  'people',
  'integrations',
  'billing',
];

export function teamSection(id: TeamSectionId): SettingsItem {
  return ITEMS[id];
}

export function isTeamSection(value: null | string): value is TeamSectionId {
  return value !== null && value in ITEMS;
}

/** Sidebar groups; without an organization only "New Organization" applies. */
export function teamSectionGroups(hasOrganization: boolean): SettingsGroup[] {
  const create: SettingsGroup = { id: 'more', items: [ITEMS.create] };
  if (!hasOrganization) return [create];
  return [
    { id: 'workspace', items: [ITEMS.overview, ITEMS.insights] },
    {
      id: 'organization',
      label: 'Organization',
      items: [ITEMS.people, ITEMS.integrations, ITEMS.billing],
    },
    create,
  ];
}
