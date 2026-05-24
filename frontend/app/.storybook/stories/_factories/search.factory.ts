import { faker } from '@faker-js/faker';
import i18n from 'i18next';

export interface FakeSearchResult {
  category: string;
  description: string;
  highlight?: string;
  icon: string;
  id: string;
  title: string;
  url: string;
}

const ICONS = ['file', 'folder', 'settings', 'user', 'document', 'image', 'code', 'link'];
const CATEGORIES = [
  i18n.t('factory.search.pages', 'Pages'),
  i18n.t('factory.search.products', 'Products'),
  i18n.t('factory.search.settings', 'Settings'),
  i18n.t('factory.search.users', 'Users'),
  i18n.t('factory.search.files', 'Files'),
  i18n.t('factory.search.help', 'Help'),
];

export function createFakeSearchResult(overrides?: Partial<FakeSearchResult>): FakeSearchResult {
  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription().slice(0, 100),
    category: faker.helpers.arrayElement(CATEGORIES),
    url: `/${faker.lorem.slug()}`,
    icon: faker.helpers.arrayElement(ICONS),
    highlight: faker.datatype.boolean({ probability: 0.3 })
      ? faker.lorem.sentence({ min: 3, max: 8 })
      : undefined,
    ...overrides,
  };
}

export function createFakeSearchResults(count: number): FakeSearchResult[] {
  return Array.from({ length: count }, () => createFakeSearchResult());
}

export interface FakeSearchResponse {
  query: string;
  results: FakeSearchResult[];
  suggestions?: string[];
  took: number; // milliseconds
  total: number;
}

export function createFakeSearchResponse(query: string, count?: number): FakeSearchResponse {
  const results = createFakeSearchResults(count ?? faker.number.int({ min: 0, max: 20 }));

  return {
    results,
    total: results.length,
    query,
    took: faker.number.int({ min: 10, max: 500 }),
    suggestions: faker.datatype.boolean({ probability: 0.5 })
      ? Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
          faker.lorem.words({ min: 1, max: 3 })
        )
      : undefined,
  };
}

export interface FakeCommandItem {
  disabled?: boolean;
  group: string;
  icon?: string;
  id: string;
  keywords?: string[];
  label: string;
  shortcut?: string;
}

export function createFakeCommandItem(group: string): FakeCommandItem {
  const shortcuts = ['⌘K', '⌘N', '⌘P', '⌘S', '⌘B', '⇧⌘P', '⌥⌘L', '⌘/', '⌘.'];

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.search.newDocument', 'New Document'),
      i18n.t('factory.search.openFile', 'Open File'),
      i18n.t('factory.search.save', 'Save'),
      i18n.t('factory.search.settings', 'Settings'),
      i18n.t('factory.search.toggleSidebar', 'Toggle Sidebar'),
      i18n.t('factory.search.search', 'Search'),
      i18n.t('factory.search.goToLine', 'Go to Line'),
      i18n.t('factory.search.findAndReplace', 'Find and Replace'),
      i18n.t('factory.search.formatDocument', 'Format Document'),
      i18n.t('factory.search.quickFix', 'Quick Fix'),
      i18n.t('factory.search.goToDefinition', 'Go to Definition'),
      i18n.t('factory.search.peekDefinition', 'Peek Definition'),
      i18n.t('factory.search.findAllReferences', 'Find All References'),
      i18n.t('factory.search.renameSymbol', 'Rename Symbol'),
    ]),
    icon: faker.helpers.arrayElement(ICONS),
    shortcut: faker.datatype.boolean({ probability: 0.5 })
      ? faker.helpers.arrayElement(shortcuts)
      : undefined,
    group,
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    keywords: faker.datatype.boolean({ probability: 0.5 })
      ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => faker.lorem.word())
      : undefined,
  };
}

export interface FakeCommandGroup {
  heading: string;
  items: FakeCommandItem[];
}

export function createFakeCommandGroups(): FakeCommandGroup[] {
  const groups = [
    i18n.t('factory.search.file', 'File'),
    i18n.t('factory.search.edit', 'Edit'),
    i18n.t('factory.search.view', 'View'),
    'Go',
    i18n.t('factory.search.help', 'Help'),
  ];

  return groups.map((heading) => ({
    heading,
    items: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
      createFakeCommandItem(heading)
    ),
  }));
}

export interface FakeRecentSearch {
  id: string;
  query: string;
  resultCount: number;
  timestamp: string;
}

export function createFakeRecentSearch(): FakeRecentSearch {
  return {
    id: faker.string.uuid(),
    query: faker.lorem.words({ min: 1, max: 3 }),
    timestamp: faker.date.recent().toISOString(),
    resultCount: faker.number.int({ min: 0, max: 100 }),
  };
}

export function createFakeRecentSearches(count: number = 5): FakeRecentSearch[] {
  return Array.from({ length: count }, () => createFakeRecentSearch());
}

export interface FakeAutocompleteOption {
  description?: string;
  icon?: string;
  id: string;
  label: string;
  value: string;
}

export function createFakeAutocompleteOption(): FakeAutocompleteOption {
  const value = faker.lorem.words({ min: 1, max: 2 });

  return {
    id: faker.string.uuid(),
    value: value.toLowerCase().replaceAll(/\s+/g, '-'),
    label: value,
    description: faker.datatype.boolean({ probability: 0.4 })
      ? faker.lorem.sentence({ min: 3, max: 8 })
      : undefined,
    icon: faker.datatype.boolean({ probability: 0.3 })
      ? faker.helpers.arrayElement(ICONS)
      : undefined,
  };
}

export function createFakeAutocompleteOptions(count: number = 10): FakeAutocompleteOption[] {
  return Array.from({ length: count }, () => createFakeAutocompleteOption());
}

export interface FakeFilterOption {
  count: number;
  id: string;
  label: string;
  value: string;
}

export function createFakeFilterOptions(_category: string, count: number = 5): FakeFilterOption[] {
  return Array.from({ length: count }, () => ({
    id: faker.string.uuid(),
    label: faker.commerce.productAdjective(),
    value: faker.string.alphanumeric(8),
    count: faker.number.int({ min: 0, max: 100 }),
  }));
}

export interface FakeSearchFilters {
  categories: FakeFilterOption[];
  dates: FakeFilterOption[];
  types: FakeFilterOption[];
}

export function createFakeSearchFilters(): FakeSearchFilters {
  return {
    categories: createFakeFilterOptions('category', 5),
    types: createFakeFilterOptions('type', 4),
    dates: [
      {
        id: '1',
        label: i18n.t('factory.search.today', 'Today'),
        value: 'today',
        count: faker.number.int({ min: 0, max: 50 }),
      },
      {
        id: '2',
        label: i18n.t('factory.search.thisWeek', 'This week'),
        value: 'week',
        count: faker.number.int({ min: 0, max: 100 }),
      },
      {
        id: '3',
        label: i18n.t('factory.search.thisMonth', 'This month'),
        value: 'month',
        count: faker.number.int({ min: 0, max: 200 }),
      },
      {
        id: '4',
        label: i18n.t('factory.search.thisYear', 'This year'),
        value: 'year',
        count: faker.number.int({ min: 0, max: 500 }),
      },
    ],
  };
}
