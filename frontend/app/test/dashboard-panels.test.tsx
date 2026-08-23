import { fireEvent, render, screen, within } from '@testing-library/react';
import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPanel, DashboardPanelsProvider } from '@/components/dashboard-panels';
import {
  DASHBOARD_PANEL_PAGES,
  DASHBOARD_PANELS,
  DASHBOARD_PANELS_COOKIE,
  panelsForPage,
  parentPanelOf,
  readHiddenPanels,
  parseHiddenPanels,
  serializeHiddenPanels,
} from '@/lib/dashboard-panels';
import { DashboardPanelsPanel } from '@/app/dashboard/(auth)/wakaclock/settings/components/dashboard-panels-panel';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  Cookies.remove(DASHBOARD_PANELS_COOKIE, { path: '/' });
});

describe('dashboard panel registry', () => {
  it('gives every panel a unique id and a page that exists', () => {
    const ids = DASHBOARD_PANELS.map((panel) => panel.id);
    const pages = new Set(DASHBOARD_PANEL_PAGES.map((page) => page.id));

    expect(new Set(ids).size).toBe(ids.length);
    expect(DASHBOARD_PANELS.every((panel) => pages.has(panel.page))).toBe(true);
    expect(DASHBOARD_PANELS.every((panel) => panel.label && panel.description)).toBe(true);
  });

  it('points every nested panel at a parent that exists on the same page', () => {
    for (const panel of DASHBOARD_PANELS) {
      if (!panel.parent) continue;

      const parent = DASHBOARD_PANELS.find((candidate) => candidate.id === panel.parent);

      expect(parent, `${panel.id} has an unknown parent`).toBeDefined();
      expect(parent?.page).toBe(panel.page);
      expect(parentPanelOf(panel.id)).toBe(panel.parent);
    }

    expect(parentPanelOf('overview.summaries')).toBeUndefined();
    expect(parentPanelOf('not-a-panel')).toBeUndefined();
  });

  it('lists at least one panel for every page it advertises', () => {
    for (const page of DASHBOARD_PANEL_PAGES) {
      expect(panelsForPage(page.id).length, page.id).toBeGreaterThan(0);
    }
  });

  it('ignores ids it does not recognise, so a stale cookie cannot hide anything', () => {
    const parsed = parseHiddenPanels(`overview.summaries,overview.removed-in-v2, ,insights.chart`);

    expect([...parsed].sort()).toEqual(['insights.chart', 'overview.summaries']);
    expect(parseHiddenPanels(undefined).size).toBe(0);
    expect(parseHiddenPanels('').size).toBe(0);
  });

  it('reads a percent-encoded value, which is how the cookie is actually written', () => {
    // js-cookie escapes the comma; `cookies()` in a server component does not decode it.
    const parsed = parseHiddenPanels('overview.summaries%2Cinsights.chart');

    expect([...parsed].sort()).toEqual(['insights.chart', 'overview.summaries']);
    expect([...parseHiddenPanels('%E0%A4%A')]).toEqual([]);
  });

  it('serialises to a sorted, de-duplicated, filtered list', () => {
    const value = serializeHiddenPanels([
      'overview.summaries',
      'insights.chart',
      'overview.summaries',
      'not-a-panel',
    ]);

    expect(value).toBe('insights.chart,overview.summaries');
    expect(serializeHiddenPanels([])).toBe('');
  });

  it('round-trips through the cookie helper', () => {
    expect(readHiddenPanels('insights.chart,nope').sort()).toEqual(['insights.chart']);
    expect(readHiddenPanels(null)).toEqual([]);
  });
});

describe('DashboardPanel', () => {
  it('renders a panel that is on and skips one that is off', () => {
    render(
      <DashboardPanelsProvider initialHidden={['insights.chart']}>
        <DashboardPanel id="overview.summaries">visible panel</DashboardPanel>
        <DashboardPanel id="insights.chart">hidden panel</DashboardPanel>
      </DashboardPanelsProvider>
    );

    expect(screen.getByText('visible panel')).toBeInTheDocument();
    expect(screen.queryByText('hidden panel')).not.toBeInTheDocument();
  });

  it('throws outside a provider rather than silently rendering everything', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      expect(() => render(<DashboardPanel id="overview.summaries">x</DashboardPanel>)).toThrow(
        /DashboardPanelsProvider/
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('DashboardPanelsPanel', () => {
  function renderPanel(initialHidden: string[] = []) {
    return render(
      <DashboardPanelsProvider initialHidden={initialHidden}>
        <DashboardPanelsPanel />
      </DashboardPanelsProvider>
    );
  }

  it('renders one switch per panel, grouped under its page', () => {
    renderPanel();

    expect(screen.getAllByRole('switch')).toHaveLength(DASHBOARD_PANELS.length);

    for (const page of DASHBOARD_PANEL_PAGES) {
      const section = screen.getByRole('region', { name: page.title });

      expect(within(section).getAllByRole('switch')).toHaveLength(panelsForPage(page.id).length);
    }
  });

  it('hides a panel, records it in the cookie, and counts it', () => {
    renderPanel();

    expect(screen.queryByTestId('dashboard-panels-hidden-count')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('panel-switch-insights.chart'));

    expect(screen.getByTestId('panel-switch-insights.chart')).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByTestId('dashboard-panels-hidden-count')).toHaveTextContent('1 hidden');
    expect(Cookies.get(DASHBOARD_PANELS_COOKIE)).toBe('insights.chart');
  });

  it('restores everything and clears the cookie when Show all is used', () => {
    renderPanel(['insights.chart', 'overview.summaries']);

    expect(screen.getByTestId('dashboard-panels-hidden-count')).toHaveTextContent('2 hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

    expect(screen.queryByTestId('dashboard-panels-hidden-count')).not.toBeInTheDocument();
    expect(Cookies.get(DASHBOARD_PANELS_COOKIE)).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeDisabled();
  });

  it('disables a nested switch while the panel containing it is off', () => {
    renderPanel(['overview.analytics']);

    const child = screen.getByTestId('panel-switch-overview.analytics-attribution');

    expect(child).toBeDisabled();
    expect(child).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getAllByText('Hidden because the panel that contains it is switched off.').length
    ).toBe(3);

    fireEvent.click(screen.getByTestId('panel-switch-overview.analytics'));

    expect(screen.getByTestId('panel-switch-overview.analytics-attribution')).toBeEnabled();
    expect(screen.getByTestId('panel-switch-overview.analytics-attribution')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('turns a hidden panel back on individually', () => {
    renderPanel(['overview.summaries']);

    fireEvent.click(screen.getByTestId('panel-switch-overview.summaries'));

    expect(screen.getByTestId('panel-switch-overview.summaries')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(Cookies.get(DASHBOARD_PANELS_COOKIE)).toBeUndefined();
  });
});
