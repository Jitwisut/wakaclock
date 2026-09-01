/**
 * Which panels and charts the dashboard renders.
 *
 * Everything is visible by default and the preference is stored as the list of panels the
 * viewer has *hidden*. Storing the negative matters: a panel added in a later release is
 * absent from an existing cookie and therefore shows up, whereas a stored allow-list would
 * silently hide every new panel from every existing user.
 */

/** A page that owns toggleable panels. `href` is used to link the setting to the page. */
export interface DashboardPanelPage {
  href: string;
  id: string;
  title: string;
}

export interface DashboardPanel {
  /** Longer explanation shown under the switch. */
  description: string;
  /** Stable id, persisted in the cookie. Never rename one without a migration. */
  id: string;
  /** Switch label. */
  label: string;
  /** Which page this panel belongs to. */
  page: string;
  /** Id of the panel this one is nested inside, when it is not top level. */
  parent?: string;
}

const OVERVIEW = 'overview';
const ANALYTICS_CARD = 'overview.analytics';

export const DASHBOARD_PANEL_PAGES: readonly DashboardPanelPage[] = [
  { href: '/dashboard/wakaclock', id: OVERVIEW, title: 'Overview' },
  { href: '/dashboard/wakaclock/insights', id: 'insights', title: 'Insights' },
  { href: '/dashboard/wakaclock/ai', id: 'ai', title: 'AI Stats' },
  { href: '/dashboard/wakaclock/keystrokes', id: 'keystrokes', title: 'Input Activity' },
];

export const DASHBOARD_PANELS: readonly DashboardPanel[] = [
  {
    id: 'overview.character-sheet',
    page: OVERVIEW,
    label: 'Character sheet',
    description: 'The headline summary of your current level and totals.',
  },
  {
    id: ANALYTICS_CARD,
    page: OVERVIEW,
    label: 'Analytics card',
    description: 'The whole analytics block. Switching it off also hides the three below.',
  },
  {
    id: 'overview.analytics-metrics',
    page: OVERVIEW,
    parent: ANALYTICS_CARD,
    label: 'Analytics metric tiles',
    description: 'Today, averages, coverage percentages, tokens and estimated spend.',
  },
  {
    id: 'overview.analytics-attribution',
    page: OVERVIEW,
    parent: ANALYTICS_CARD,
    label: 'Daily attribution chart',
    description: 'Stacked bars of AI verified, AI inferred, human and unknown line changes per day.',
  },
  {
    id: 'overview.analytics-breakdowns',
    page: OVERVIEW,
    parent: ANALYTICS_CARD,
    label: 'Breakdown lists',
    description: 'Languages, editors, AI models, operating systems, machines and weekdays.',
  },
  {
    id: 'overview.status-tiles',
    page: OVERVIEW,
    label: 'Status tiles',
    description: 'Today’s running total and connection state.',
  },
  {
    id: 'overview.range-stats',
    page: OVERVIEW,
    label: 'Range statistics',
    description: 'Totals and averages for the selected date range.',
  },
  {
    id: 'overview.top-projects',
    page: OVERVIEW,
    label: 'Projects',
    description: 'The projects with the most time in the selected range. Each name opens its charts.',
  },
  {
    id: 'overview.summaries',
    page: OVERVIEW,
    label: 'Summaries',
    description: 'Per-day summary rows for the selected range.',
  },
  {
    id: 'overview.duration-timeline',
    page: OVERVIEW,
    label: 'Duration timeline',
    description: 'The individual duration blocks that make up a day.',
  },
  {
    id: 'insights.chart',
    page: 'insights',
    label: 'Insights chart',
    description: 'The bar chart above the insights table. The table stays either way.',
  },
  {
    id: 'ai.charts',
    page: 'ai',
    label: 'AI charts',
    description: 'The AI versus human split and per-agent charts. The table stays either way.',
  },
  {
    id: 'keystrokes.chart',
    page: 'keystrokes',
    label: 'Input activity charts',
    description: 'The daily keystroke trend line. The table stays either way.',
  },
];

export const DASHBOARD_PANELS_COOKIE = 'dashboard_hidden_panels';

const PANEL_IDS = new Set(DASHBOARD_PANELS.map((panel) => panel.id));

/**
 * Cookie writers percent-encode the separator (`,` is a reserved character in RFC 6265) but
 * readers do not all decode: `cookies()` in a server component hands back the raw value.
 * Decoding here rather than at each call site means the preference survives that asymmetry
 * instead of parsing as one unrecognised id and quietly showing everything again.
 */
function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Reads the cookie value into a set of hidden panel ids, dropping anything unrecognised so
 * a stale cookie from an older release cannot hide a panel that no longer has a switch.
 */
export function parseHiddenPanels(value: null | string | undefined): Set<string> {
  if (!value) return new Set();

  return new Set(
    decodeCookieValue(value)
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => PANEL_IDS.has(entry))
  );
}

/** Serialises for the cookie. Sorted so the value is stable and diffable. */
export function serializeHiddenPanels(hidden: Iterable<string>): string {
  return [...new Set(hidden)]
    .filter((id) => PANEL_IDS.has(id))
    .sort((a, b) => a.localeCompare(b))
    .join(',');
}

export function panelsForPage(page: string): readonly DashboardPanel[] {
  return DASHBOARD_PANELS.filter((panel) => panel.page === page);
}

/** The panel this one is nested inside, if any. */
export function parentPanelOf(id: string): string | undefined {
  return DASHBOARD_PANELS.find((panel) => panel.id === id)?.parent;
}

/**
 * Cookie value to initial state, for the server layout.
 *
 * Deliberately here and not in `components/dashboard-panels.tsx`: anything exported from a
 * `'use client'` module is a client reference, and calling one from a server component
 * fails at request time rather than at build time.
 */
export function readHiddenPanels(cookieValue: null | string | undefined): string[] {
  return [...parseHiddenPanels(cookieValue)];
}
