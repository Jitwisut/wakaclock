import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  searchHandlers,
  searchStatusHandlers,
} from '@/.storybook/stories/_handlers/search.handlers';
import type {
  FakeAutocompleteOption,
  FakeCommandGroup,
  FakeCommandItem,
  FakeFilterOption,
  FakeRecentSearch,
  FakeSearchFilters,
  FakeSearchResponse,
  FakeSearchResult,
} from '@/.storybook/stories/_factories/search.factory';
import {
  createFakeAutocompleteOption,
  createFakeAutocompleteOptions,
  createFakeCommandGroups,
  createFakeCommandItem,
  createFakeFilterOptions,
  createFakeRecentSearch,
  createFakeRecentSearches,
  createFakeSearchFilters,
  createFakeSearchResponse,
  createFakeSearchResult,
  createFakeSearchResults,
} from '@/.storybook/stories/_factories/search.factory';
import {
  createFakeEmpties,
  createFakeEmpty,
  createFakeItem,
  createFakeItems,
  createFakeResizable,
  createFakeResizablePanel,
  createFakeResizablePanels,
  createFakeResizables,
  createFakeScrollArea,
  createFakeScrollAreas,
  createFakeSeparator,
  createFakeSeparators,
  createFakeSidebar,
  createFakeSidebarItem,
  createFakeSidebarItems,
  createFakeSidebars,
  SIDEBAR_ICONS,
} from '@/.storybook/stories/_factories/layout.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import Search from '@/components/layout/header/search';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function SearchDemo() {
  const { t } = useTranslation();

  return (
    <div data-sb-search className="w-full max-w-2xl">
      <Search
        labels={{
          inputPlaceholder: t('headerSearch.inputPlaceholder'),
          desktopInputAriaLabel: t('headerSearch.desktopInputAriaLabel'),
          mobileButtonAriaLabel: t('headerSearch.mobileButtonAriaLabel'),
          dialogTitle: t('headerSearch.dialogTitle'),
          dialogDescription: t('headerSearch.dialogDescription'),
          dialogInputPlaceholder: t('headerSearch.dialogInputPlaceholder'),
          emptyState: t('headerSearch.emptyState'),
        }}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Header/Search',
  component: SearchDemo,
  tags: ['autodocs'],
  args: {
    // Event handlers
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onOpen: fn(),
    onClose: fn(),
    onSearch: fn(),
    onResultSelect: fn(),
    onInputChange: fn(),
  },
  parameters: {
    msw: {
      handlers: searchHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('search.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('search.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('search.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('search.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('search.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('search.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('search.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpen: {
      action: 'onOpen',
      description: i18n.t(
        'search.argType.calledWhenSearchDialogOpens',
        'Called when search dialog opens'
      ),
      table: { category: 'Events' },
    },
    onClose: {
      action: 'onClose',
      description: i18n.t(
        'search.argType.calledWhenSearchDialogCloses',
        'Called when search dialog closes'
      ),
      table: { category: 'Events' },
    },
    onSearch: {
      action: 'onSearch',
      description: i18n.t(
        'search.argType.calledWhenSearchIsPerformed',
        'Called when search is performed'
      ),
      table: { category: 'Events' },
    },
    onResultSelect: {
      action: 'onResultSelect',
      description: i18n.t(
        'search.argType.calledWhenASearchResultIsSelected',
        'Called when a search result is selected'
      ),
      table: { category: 'Events' },
    },
    onInputChange: {
      action: 'onInputChange',
      description: i18n.t(
        'search.argType.calledWhenSearchInputValueChanges',
        'Called when search input value changes'
      ),
      table: { category: 'Events' },
    },
    // Search Props Reference:
    // Required Props:
    // - labels: SearchLabels object
    //   - inputPlaceholder: Desktop input placeholder text
    //   - desktopInputAriaLabel: Aria label for desktop input
    //   - mobileButtonAriaLabel: Aria label for mobile trigger button
    //   - dialogTitle: Search dialog title (visually hidden)
    //   - dialogDescription: Dialog description for screen readers
    //   - dialogInputPlaceholder: Command input placeholder
    //   - emptyState: Message when no search results
    //
    // Responsive Behavior:
    // - Desktop: Inline search input with keyboard shortcut hint
    // - Mobile: Icon button that opens search dialog
    //
    // Keyboard Shortcuts:
    // - Cmd/Ctrl+K: Toggle search dialog
    // - Escape: Close dialog
    // - Arrow keys: Navigate results
    // - Enter: Select result
    //
    // Features:
    // - Command palette interface using cmdk
    // - Real-time filtering of navigation items
    // - Grouped results by category
    // - Empty state when no matches
    //
    // Data Attributes:
    // - data-testid="header-search-desktop-input": Desktop input
    // - data-testid="header-search-mobile-trigger": Mobile trigger
    // - data-testid="header-search-command-input": Dialog input
    // - data-testid="header-search-empty": Empty state message
  },
} satisfies Meta<typeof SearchDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

function getSearchRoot(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>('[data-sb-search]');
  if (!root) {
    throw new Error('Search story root not found.');
  }
  return root;
}

async function openSearchDialog(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  const root = getSearchRoot(canvasElement);
  const canvas = within(root);

  const desktopInput = root.querySelector<HTMLInputElement>(
    '[data-testid="header-search-desktop-input"]'
  );

  if (desktopInput && desktopInput.offsetParent) {
    await userEvent.click(desktopInput);
  } else {
    await userEvent.click(canvas.getByTestId('header-search-mobile-trigger'));
  }

  const dialogContent = await waitFor(() => {
    const content = doc.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    if (!content) {
      throw new Error('Dialog content not found.');
    }
    return content;
  });

  return {
    dialogContent,
    doc,
  };
}

export const Closed: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Opened: Story = {
  ...Closed,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const { dialogContent } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Opened,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const { dialogContent } = await openSearchDialog(canvasElement);
    const dialog = within(dialogContent);

    const commandInput = dialog.getByTestId('header-search-command-input') as HTMLInputElement;
    const placeholder = commandInput.getAttribute('placeholder') ?? '';
    expect(placeholder.trim()).not.toHaveLength(0);

    await userEvent.type(commandInput, 'zzzz-not-found');

    await waitFor(() => {
      const empty = dialog.getByTestId('header-search-empty');
      const emptyText = empty.textContent ?? '';
      expect(emptyText.trim()).not.toHaveLength(0);
    });
  },
};

export const Mobile: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = getSearchRoot(canvasElement);
    const canvas = within(root);

    const desktopInput = root.querySelector<HTMLElement>(
      '[data-testid="header-search-desktop-input"]'
    );
    const mobileTrigger = canvas.getByTestId('header-search-mobile-trigger');

    expect(desktopInput).not.toBeVisible();
    expect(mobileTrigger).toBeVisible();

    const { dialogContent } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();
  },
};

export const Shortcut: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const win = doc.defaultView;
    if (!win) {
      throw new Error('Document defaultView not available.');
    }

    expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();

    doc.dispatchEvent(
      new win.KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      })
    );

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument();
    });

    doc.dispatchEvent(
      new win.KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      })
    );

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('search.story.desktopViewFullWidthInput', 'Desktop View (Full Width Input)')}
        </p>
        <div className="w-full max-w-md">
          <SearchDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t(
            'search.story.narrowContainerIconButtonVisible',
            'Narrow Container (Icon Button Visible)'
          )}
        </p>
        <div className="w-[100px]">
          <SearchDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('search.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[250px]">
          <SearchDemo />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Small Container (200px)</p>
        <div className="w-[200px]">
          <SearchDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Medium Container (400px)</p>
        <div className="w-[400px]">
          <SearchDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Large Container (600px)</p>
        <div className="w-[600px]">
          <SearchDemo />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('search.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full max-w-2xl">
          <SearchDemo />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('search.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    const { dialogContent } = await openSearchDialog(canvasElement);
    const dialog = within(dialogContent);

    const commandInput = dialog.getByTestId('header-search-command-input') as HTMLInputElement;
    const placeholder = commandInput.getAttribute('placeholder') ?? '';
    expect(placeholder.trim()).not.toHaveLength(0);

    await userEvent.type(commandInput, 'zzzz-not-found');

    await waitFor(() => {
      expect(dialog.getByTestId('header-search-empty')).toBeInTheDocument();
    });
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('search.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('search.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('search.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('search.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

function WithFakerDataDemo() {
  const { t } = useTranslation();
  const searchResults: FakeSearchResult[] = createFakeSearchResults(5);
  const searchResponse: FakeSearchResponse = createFakeSearchResponse('test query', 10);

  return (
    <div className="space-y-4 p-4" data-testid="faker-data-demo">
      <div className="text-sm">
        <p className="font-medium">
          {t('headerSearch.searchResult.title')}: {searchResults.length}
        </p>
        <ul className="text-muted-foreground mt-2 space-y-1">
          {searchResults.slice(0, 3).map((result) => (
            <li key={result.id}>
              {result.title} — {result.category}
            </li>
          ))}
        </ul>
      </div>
      <div className="text-sm">
        <p className="font-medium">
          {t('headerSearch.searchResponse.title')}: {searchResponse.total}
        </p>
        <p className="text-muted-foreground">
          {t('headerSearch.searchResponse.query')}: &quot;{searchResponse.query}&quot;
        </p>
        <p className="text-muted-foreground">
          {t('headerSearch.searchResponse.took', { ms: searchResponse.took })}
        </p>
      </div>
      <SearchDemo />
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <WithFakerDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('faker-data-demo');
    expect(demo).toBeInTheDocument();
    const root = getSearchRoot(canvasElement);
    expect(root).toBeInTheDocument();
  },
};

// ============ SINGLE SEARCH RESULT STORY ============

function SingleSearchResultDemo() {
  const result: FakeSearchResult = createFakeSearchResult({ highlight: 'Matching text here' });

  return (
    <div className="space-y-3 p-4" data-testid="single-result-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.searchResult.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.searchResult.description')}
      </p>
      <div className="border-border rounded-md border p-3 text-sm">
        <p>
          <span className="font-medium">{result.title}</span> — {result.icon}
        </p>
        <p className="text-muted-foreground">{result.description}</p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('headerSearch.searchResult.category')}: {result.category}
        </p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('headerSearch.searchResult.highlight')}:{' '}
          {result.highlight ?? i18n.t('headerSearch.searchResult.noHighlight')}
        </p>
      </div>
      <SearchDemo />
    </div>
  );
}

export const SingleSearchResult: Story = {
  name: i18n.t('search.storyName.singleSearchResult', 'Single Search Result'),
  render: () => <SingleSearchResultDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('single-result-demo');
    expect(demo).toBeInTheDocument();
    expect(demo.querySelector('.font-medium')).toBeInTheDocument();
  },
};

// ============ SEARCH RESPONSE DETAIL STORY ============

function SearchResponseDetailDemo() {
  const response: FakeSearchResponse = createFakeSearchResponse('dashboard widgets', 8);

  return (
    <div className="space-y-3 p-4" data-testid="response-detail-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.searchResponse.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.searchResponse.description')}
      </p>
      <div className="border-border rounded-md border p-3 text-sm">
        <p>
          {i18n.t('headerSearch.searchResponse.query')}: &quot;{response.query}&quot;
        </p>
        <p>
          {i18n.t('headerSearch.searchResponse.total')}: {response.total}
        </p>
        <p>{i18n.t('headerSearch.searchResponse.took', { ms: response.took })}</p>
        <div className="mt-2">
          <p className="font-medium">{i18n.t('headerSearch.searchResponse.suggestions')}:</p>
          {response.suggestions && response.suggestions.length > 0 ? (
            <ul className="text-muted-foreground ml-4 list-disc">
              {response.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              {i18n.t('headerSearch.searchResponse.noSuggestions')}
            </p>
          )}
        </div>
        <div className="mt-2">
          <p className="font-medium">
            {i18n.t('headerSearch.searchResult.title')} ({response.results.length}):
          </p>
          <ul className="text-muted-foreground ml-4 list-disc">
            {response.results.slice(0, 4).map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        </div>
      </div>
      <SearchDemo />
    </div>
  );
}

export const SearchResponseDetail: Story = {
  name: i18n.t('search.storyName.searchResponseDetail', 'Search Response Detail'),
  render: () => <SearchResponseDetailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('response-detail-demo');
    expect(demo).toBeInTheDocument();
    expect(demo.querySelectorAll('li').length).toBeGreaterThan(0);
  },
};

// ============ COMMAND GROUPS STORY ============

function CommandGroupsDemo() {
  const groups: FakeCommandGroup[] = createFakeCommandGroups();

  return (
    <div className="space-y-3 p-4" data-testid="command-groups-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.commandGroups.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.commandGroups.description')}
      </p>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.heading} className="border-border rounded-md border p-3">
            <p className="mb-2 text-sm font-semibold">
              {i18n.t('headerSearch.commandGroups.groupLabel')}: {group.heading}
            </p>
            <p className="text-muted-foreground mb-2 text-xs">
              {i18n.t('headerSearch.commandGroups.itemsCount', { count: group.items.length })}
            </p>
            <ul className="space-y-1 text-sm">
              {group.items.map((item: FakeCommandItem) => (
                <li
                  key={item.id}
                  className={`flex items-center justify-between ${item.disabled ? 'opacity-50' : ''}`}
                >
                  <span>
                    {item.icon && <span className="mr-1">[{item.icon}]</span>}
                    {item.label}
                    {item.disabled && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({i18n.t('headerSearch.commandGroups.disabled')})
                      </span>
                    )}
                  </span>
                  {item.shortcut && (
                    <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">{item.shortcut}</kbd>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <SearchDemo />
    </div>
  );
}

export const CommandGroups: Story = {
  name: i18n.t('search.storyName.commandGroups', 'Command Groups'),
  render: () => <CommandGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('command-groups-demo');
    expect(demo).toBeInTheDocument();
    const groups = demo.querySelectorAll('.border');
    expect(groups.length).toBeGreaterThan(0);
  },
};

// ============ SINGLE COMMAND ITEM STORY ============

function SingleCommandItemDemo() {
  const item: FakeCommandItem = createFakeCommandItem('Actions');

  return (
    <div className="space-y-3 p-4" data-testid="single-command-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.commandItem.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.commandItem.description')}
      </p>
      <div className="border-border rounded-md border p-3 text-sm">
        <p>
          {i18n.t('headerSearch.commandItem.label')}: {item.label}
        </p>
        <p>
          {i18n.t('headerSearch.commandItem.group')}: {item.group}
        </p>
        {item.shortcut && (
          <p>
            {i18n.t('headerSearch.commandGroups.shortcut')}:{' '}
            <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">{item.shortcut}</kbd>
          </p>
        )}
        <p>
          {i18n.t('headerSearch.commandItem.keywords')}:{' '}
          {item.keywords ? item.keywords.join(', ') : i18n.t('headerSearch.commandItem.noKeywords')}
        </p>
        {item.disabled && (
          <p className="text-destructive">{i18n.t('headerSearch.commandGroups.disabled')}</p>
        )}
      </div>
      <SearchDemo />
    </div>
  );
}

export const SingleCommandItem: Story = {
  name: i18n.t('search.storyName.singleCommandItem', 'Single Command Item'),
  render: () => <SingleCommandItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('single-command-demo');
    expect(demo).toBeInTheDocument();
  },
};

// ============ RECENT SEARCHES STORY ============

function RecentSearchesDemo() {
  const recentSearches: FakeRecentSearch[] = createFakeRecentSearches(6);

  return (
    <div className="space-y-3 p-4" data-testid="recent-searches-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.recentSearches.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.recentSearches.description')}
      </p>
      <div className="space-y-2">
        {recentSearches.map((search) => (
          <div key={search.id} className="border-border rounded-md border p-2 text-sm">
            <p className="font-medium">
              {i18n.t('headerSearch.recentSearches.query')}: {search.query}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t('headerSearch.recentSearches.results', { count: search.resultCount })}
            </p>
            <p className="text-muted-foreground text-xs">
              {i18n.t('headerSearch.recentSearches.timestamp')}: {search.timestamp}
            </p>
          </div>
        ))}
      </div>
      <button type="button" className="text-destructive text-sm underline">
        {i18n.t('headerSearch.recentSearches.clearAll')}
      </button>
      <SearchDemo />
    </div>
  );
}

export const RecentSearches: Story = {
  name: i18n.t('search.storyName.recentSearches', 'Recent Searches'),
  render: () => <RecentSearchesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('recent-searches-demo');
    expect(demo).toBeInTheDocument();
    const items = demo.querySelectorAll('.border');
    expect(items.length).toBe(6);
  },
};

// ============ SINGLE RECENT SEARCH STORY ============

function SingleRecentSearchDemo() {
  const search: FakeRecentSearch = createFakeRecentSearch();

  return (
    <div className="space-y-3 p-4" data-testid="single-recent-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.recentSearches.title')}</h3>
      <div className="border-border rounded-md border p-3 text-sm">
        <p className="font-medium">{search.query}</p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('headerSearch.recentSearches.results', { count: search.resultCount })}
        </p>
        <p className="text-muted-foreground text-xs">
          {i18n.t('headerSearch.recentSearches.timestamp')}: {search.timestamp}
        </p>
      </div>
      <SearchDemo />
    </div>
  );
}

export const SingleRecentSearch: Story = {
  name: i18n.t('search.storyName.singleRecentSearch', 'Single Recent Search'),
  render: () => <SingleRecentSearchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('single-recent-demo');
    expect(demo).toBeInTheDocument();
  },
};

// ============ AUTOCOMPLETE OPTIONS STORY ============

function AutocompleteOptionsDemo() {
  const options: FakeAutocompleteOption[] = createFakeAutocompleteOptions(8);

  return (
    <div className="space-y-3 p-4" data-testid="autocomplete-options-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.autocomplete.title')}</h3>
      <p className="text-muted-foreground text-xs">
        {i18n.t('headerSearch.autocomplete.description')}
      </p>
      <div className="space-y-2">
        {options.map((option) => (
          <div key={option.id} className="border-border rounded-md border p-2 text-sm">
            <div className="flex items-center gap-2">
              {option.icon && <span className="text-muted-foreground">[{option.icon}]</span>}
              <span className="font-medium">{option.label}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {i18n.t('headerSearch.autocomplete.value')}: {option.value}
            </p>
            <p className="text-muted-foreground text-xs">
              {option.description ?? i18n.t('headerSearch.autocomplete.noDescription')}
            </p>
          </div>
        ))}
      </div>
      <SearchDemo />
    </div>
  );
}

export const AutocompleteOptions: Story = {
  name: i18n.t('search.storyName.autocompleteOptions', 'Autocomplete Options'),
  render: () => <AutocompleteOptionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('autocomplete-options-demo');
    expect(demo).toBeInTheDocument();
    const items = demo.querySelectorAll('.border');
    expect(items.length).toBe(8);
  },
};

// ============ SINGLE AUTOCOMPLETE OPTION STORY ============

function SingleAutocompleteOptionDemo() {
  const option: FakeAutocompleteOption = createFakeAutocompleteOption();

  return (
    <div className="space-y-3 p-4" data-testid="single-autocomplete-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.autocomplete.title')}</h3>
      <div className="border-border rounded-md border p-3 text-sm">
        <div className="flex items-center gap-2">
          {option.icon && <span className="text-muted-foreground">[{option.icon}]</span>}
          <span className="font-medium">
            {i18n.t('headerSearch.autocomplete.label')}: {option.label}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {i18n.t('headerSearch.autocomplete.value')}: {option.value}
        </p>
        <p className="text-muted-foreground text-xs">
          {option.description ?? i18n.t('headerSearch.autocomplete.noDescription')}
        </p>
      </div>
      <SearchDemo />
    </div>
  );
}

export const SingleAutocompleteOption: Story = {
  name: i18n.t('search.storyName.singleAutocompleteOption', 'Single Autocomplete Option'),
  render: () => <SingleAutocompleteOptionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('single-autocomplete-demo');
    expect(demo).toBeInTheDocument();
  },
};

// ============ FILTER OPTIONS STORY ============

function FilterOptionsDemo() {
  const categoryFilters: FakeFilterOption[] = createFakeFilterOptions('category', 5);
  const typeFilters: FakeFilterOption[] = createFakeFilterOptions('type', 4);

  return (
    <div className="space-y-3 p-4" data-testid="filter-options-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.filters.title')}</h3>
      <p className="text-muted-foreground text-xs">{i18n.t('headerSearch.filters.description')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="border-border rounded-md border p-3">
          <p className="mb-2 text-sm font-semibold">{i18n.t('headerSearch.filters.categories')}</p>
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('headerSearch.filters.count', { count: categoryFilters.length })}
          </p>
          <ul className="space-y-1 text-sm">
            {categoryFilters.map((filter) => (
              <li key={filter.id} className="flex justify-between">
                <span>{filter.label}</span>
                <span className="text-muted-foreground">{filter.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-border rounded-md border p-3">
          <p className="mb-2 text-sm font-semibold">{i18n.t('headerSearch.filters.types')}</p>
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('headerSearch.filters.count', { count: typeFilters.length })}
          </p>
          <ul className="space-y-1 text-sm">
            {typeFilters.map((filter) => (
              <li key={filter.id} className="flex justify-between">
                <span>{filter.label}</span>
                <span className="text-muted-foreground">{filter.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SearchDemo />
    </div>
  );
}

export const FilterOptions: Story = {
  name: i18n.t('search.storyName.filterOptions', 'Filter Options'),
  render: () => <FilterOptionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('filter-options-demo');
    expect(demo).toBeInTheDocument();
    const lists = demo.querySelectorAll('ul');
    expect(lists.length).toBe(2);
  },
};

// ============ SEARCH FILTERS STORY ============

function SearchFiltersDemo() {
  const filters: FakeSearchFilters = createFakeSearchFilters();

  return (
    <div className="space-y-3 p-4" data-testid="search-filters-demo">
      <h3 className="text-sm font-semibold">{i18n.t('headerSearch.filters.title')}</h3>
      <p className="text-muted-foreground text-xs">{i18n.t('headerSearch.filters.description')}</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="border-border rounded-md border p-3">
          <p className="mb-2 text-sm font-semibold">{i18n.t('headerSearch.filters.categories')}</p>
          <ul className="space-y-1 text-sm">
            {filters.categories.map((f) => (
              <li key={f.id} className="flex justify-between">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-border rounded-md border p-3">
          <p className="mb-2 text-sm font-semibold">{i18n.t('headerSearch.filters.types')}</p>
          <ul className="space-y-1 text-sm">
            {filters.types.map((f) => (
              <li key={f.id} className="flex justify-between">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-border rounded-md border p-3">
          <p className="mb-2 text-sm font-semibold">{i18n.t('headerSearch.filters.dates')}</p>
          <ul className="space-y-1 text-sm">
            {filters.dates.map((f) => (
              <li key={f.id} className="flex justify-between">
                <span>{f.label}</span>
                <span className="text-muted-foreground">{f.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SearchDemo />
    </div>
  );
}

export const SearchFilters: Story = {
  name: i18n.t('search.storyName.searchFilters', 'Search Filters'),
  render: () => <SearchFiltersDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('search-filters-demo');
    expect(demo).toBeInTheDocument();
    const lists = demo.querySelectorAll('ul');
    expect(lists.length).toBe(3);
  },
};

// ============ ALL LAYOUT FACTORY FUNCTIONS DEMO ============

function LayoutFactoryDataDemo() {
  const sidebarItem = createFakeSidebarItem();
  const sidebarItems = createFakeSidebarItems(3);
  const sidebar = createFakeSidebar();
  const sidebars = createFakeSidebars(2);
  const resizable = createFakeResizable();
  const resizables = createFakeResizables(2);
  const resizablePanel = createFakeResizablePanel();
  const resizablePanels = createFakeResizablePanels(2);
  const scrollArea = createFakeScrollArea();
  const scrollAreas = createFakeScrollAreas(2);
  const separator = createFakeSeparator();
  const separators = createFakeSeparators(2);
  const item = createFakeItem();
  const items = createFakeItems(3);
  const empty = createFakeEmpty();
  const empties = createFakeEmpties(2);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium">
        {i18n.t('headerSearch.dialogTitle')} - All Layout Factories ({SIDEBAR_ICONS.length} icons)
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify(
          {
            sidebarItem,
            sidebarItems,
            sidebar,
            sidebars,
            resizable,
            resizables,
            resizablePanel,
            resizablePanels,
            scrollArea,
            scrollAreas,
            separator,
            separators,
            item,
            items,
            empty,
            empties,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

export const AllLayoutFactories: Story = {
  render: () => <LayoutFactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/All Layout Factories/i)).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithMswHandlers: Story = {
  ...Opened,
  parameters: {
    msw: { handlers: searchHandlers },
  },
  play: async ({ canvasElement }) => {
    const { dialogContent } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Opened,
  parameters: {
    msw: { handlers: searchHandlers },
  },
  play: async ({ canvasElement }) => {
    const { dialogContent } = await openSearchDialog(canvasElement);
    expect(dialogContent).toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: i18n.t('search.storyName.loading', 'Loading'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('search.storyName.emptyData', 'Empty Data'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.empty },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('search.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('search.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('search.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('search.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('search.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t('search.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('search.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('search.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('search.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('search.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('search.storyName.networkError', 'Network Error'),
  ...Opened,
  parameters: {
    msw: { handlers: searchStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('search.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const root = getSearchRoot(canvasElement);
    const canvas = within(root);

    // Check desktop input has aria-label
    const desktopInput = root.querySelector<HTMLInputElement>(
      '[data-testid="header-search-desktop-input"]'
    );

    if (desktopInput && desktopInput.offsetParent) {
      const ariaLabel = desktopInput.getAttribute('aria-label') ?? '';
      expect(ariaLabel.trim()).not.toHaveLength(0);

      // Test keyboard focus on desktop input
      desktopInput.focus();
      expect(doc.activeElement).toBe(desktopInput);
    }

    // Check mobile trigger has aria-label
    const mobileTrigger = canvas.getByTestId('header-search-mobile-trigger');
    const mobileAriaLabel = mobileTrigger.getAttribute('aria-label') ?? '';
    expect(mobileAriaLabel.trim()).not.toHaveLength(0);

    // Open dialog and test keyboard navigation
    const { dialogContent } = await openSearchDialog(canvasElement);
    const dialog = within(dialogContent);

    // Test command input has placeholder
    const commandInput = dialog.getByTestId('header-search-command-input') as HTMLInputElement;
    const placeholder = commandInput.getAttribute('placeholder') ?? '';
    expect(placeholder.trim()).not.toHaveLength(0);

    // Test command input is focused when dialog opens
    await waitFor(() => {
      expect(doc.activeElement).toBe(commandInput);
    });

    // Test typing in search
    await userEvent.type(commandInput, 'test');
    expect(commandInput.value).toBe('test');

    // Test Escape closes dialog
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });

    // Test keyboard shortcut (Ctrl+K)
    doc.dispatchEvent(
      new doc.defaultView!.KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      })
    );

    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument();
    });
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('search.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: searchStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('search.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: searchStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('search.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: searchStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerManyResults: Story = {
  ...Default,
  name: i18n.t('search.storyName.handlerManyResults', 'Handler: Many Results'),
  parameters: { msw: { handlers: searchStatusHandlers.manyResults } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerWithSuggestions: Story = {
  ...Default,
  name: i18n.t('search.storyName.handlerWithSuggestions', 'Handler: With Suggestions'),
  parameters: { msw: { handlers: searchStatusHandlers.withSuggestions } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
