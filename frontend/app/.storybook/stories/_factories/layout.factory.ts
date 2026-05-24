import { faker } from '@faker-js/faker';
import i18n from 'i18next';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface FakeSidebar {
  collapsed: boolean;
  id: string;
  items: FakeSidebarItem[];
  title: string;
}

export interface FakeSidebarItem {
  active: boolean;
  badge?: string;
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  subItems?: FakeSidebarItem[];
}

export interface FakeResizable {
  defaultSize: number;
  id: string;
  maxSize: number;
  minSize: number;
}

export interface FakeResizablePanel {
  defaultSize: number;
  id: string;
  maxSize?: number;
  minSize?: number;
}

export interface FakeScrollArea {
  content: string;
  height: number;
  id: string;
  width?: number;
}

export interface FakeSeparator {
  decorative: boolean;
  id: string;
  orientation: SeparatorOrientation;
}

export interface FakeItem {
  description?: string;
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  value: string;
}

export interface FakeEmpty {
  actionLabel?: string;
  description: string;
  icon?: string;
  id: string;
  title: string;
}

// NOTE: FakePagination is exported from table.factory.ts

export const SIDEBAR_ICONS = [
  i18n.t('factory.layout.home', 'Home'),
  i18n.t('factory.layout.settings', 'Settings'),
  i18n.t('factory.layout.users', 'Users'),
  i18n.t('factory.layout.mail', 'Mail'),
  i18n.t('factory.layout.calendar', 'Calendar'),
  'FileText',
  i18n.t('factory.layout.folder', 'Folder'),
  i18n.t('factory.layout.star', 'Star'),
  i18n.t('factory.layout.bell', 'Bell'),
  i18n.t('factory.layout.search', 'Search'),
];

export function createFakeSidebarItem(overrides?: Partial<FakeSidebarItem>): FakeSidebarItem {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.layout.dashboard', 'Dashboard'),
      i18n.t('factory.layout.projects', 'Projects'),
      i18n.t('factory.layout.team', 'Team'),
      i18n.t('factory.layout.settings', 'Settings'),
      i18n.t('factory.layout.analytics', 'Analytics'),
      i18n.t('factory.layout.reports', 'Reports'),
      i18n.t('factory.layout.inbox', 'Inbox'),
      i18n.t('factory.layout.calendar', 'Calendar'),
    ]),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(SIDEBAR_ICONS), {
      probability: 0.7,
    }),
    active: faker.datatype.boolean({ probability: 0.2 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    badge: faker.helpers.maybe(() => String(faker.number.int({ min: 1, max: 99 })), {
      probability: 0.2,
    }),
    subItems: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ min: 2, max: 4 }) }, () => ({
          id: faker.string.uuid(),
          label: faker.helpers.arrayElement([
            i18n.t('factory.layout.overview', 'Overview'),
            i18n.t('factory.layout.details', 'Details'),
            i18n.t('factory.layout.history', 'History'),
            i18n.t('factory.layout.export', 'Export'),
          ]),
          active: false,
          disabled: false,
        })),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

export function createFakeSidebarItems(count: number): FakeSidebarItem[] {
  return Array.from({ length: count }, () => createFakeSidebarItem());
}

export function createFakeSidebar(overrides?: Partial<FakeSidebar>): FakeSidebar {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.layout.mainMenu', 'Main Menu'),
      i18n.t('factory.layout.navigation', 'Navigation'),
      i18n.t('factory.layout.quickAccess', 'Quick Access'),
    ]),
    items: createFakeSidebarItems(faker.number.int({ min: 4, max: 8 })),
    collapsed: faker.datatype.boolean({ probability: 0.2 }),
    ...overrides,
  };
}

export function createFakeSidebars(count: number): FakeSidebar[] {
  return Array.from({ length: count }, () => createFakeSidebar());
}

export function createFakeResizable(overrides?: Partial<FakeResizable>): FakeResizable {
  return {
    id: faker.string.uuid(),
    defaultSize: faker.number.int({ min: 20, max: 50 }),
    minSize: faker.number.int({ min: 10, max: 20 }),
    maxSize: faker.number.int({ min: 60, max: 90 }),
    ...overrides,
  };
}

export function createFakeResizables(count: number): FakeResizable[] {
  return Array.from({ length: count }, () => createFakeResizable());
}

export function createFakeResizablePanel(
  overrides?: Partial<FakeResizablePanel>
): FakeResizablePanel {
  return {
    id: faker.string.uuid(),
    defaultSize: faker.number.int({ min: 20, max: 80 }),
    minSize: faker.helpers.maybe(() => faker.number.int({ min: 10, max: 20 }), {
      probability: 0.5,
    }),
    maxSize: faker.helpers.maybe(() => faker.number.int({ min: 60, max: 90 }), {
      probability: 0.5,
    }),
    ...overrides,
  };
}

export function createFakeResizablePanels(count: number): FakeResizablePanel[] {
  return Array.from({ length: count }, () => createFakeResizablePanel());
}

export function createFakeScrollArea(overrides?: Partial<FakeScrollArea>): FakeScrollArea {
  return {
    id: faker.string.uuid(),
    content: faker.lorem.paragraphs(faker.number.int({ min: 3, max: 10 })),
    height: faker.number.int({ min: 200, max: 500 }),
    width: faker.helpers.maybe(() => faker.number.int({ min: 300, max: 600 }), {
      probability: 0.5,
    }),
    ...overrides,
  };
}

export function createFakeScrollAreas(count: number): FakeScrollArea[] {
  return Array.from({ length: count }, () => createFakeScrollArea());
}

export function createFakeSeparator(overrides?: Partial<FakeSeparator>): FakeSeparator {
  return {
    id: faker.string.uuid(),
    orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
    decorative: faker.datatype.boolean({ probability: 0.7 }),
    ...overrides,
  };
}

export function createFakeSeparators(count: number): FakeSeparator[] {
  return Array.from({ length: count }, () => createFakeSeparator());
}

export function createFakeItem(overrides?: Partial<FakeItem>): FakeItem {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.layout.item1', 'Item 1'),
    i18n.t('factory.layout.item2', 'Item 2'),
    i18n.t('factory.layout.item3', 'Item 3'),
    i18n.t('factory.layout.featured', 'Featured'),
    'New',
    i18n.t('factory.layout.popular', 'Popular'),
  ]);
  return {
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase().replace(' ', '-'),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 }),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(SIDEBAR_ICONS), {
      probability: 0.3,
    }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeItems(count: number): FakeItem[] {
  return Array.from({ length: count }, () => createFakeItem());
}

export function createFakeEmpty(overrides?: Partial<FakeEmpty>): FakeEmpty {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.layout.noItemsFound', 'No items found'),
      i18n.t('factory.layout.emptyInbox', 'Empty inbox'),
      i18n.t('factory.layout.noResults', 'No results'),
      i18n.t('factory.layout.nothingHereYet', 'Nothing here yet'),
    ]),
    description: faker.lorem.sentence(),
    icon: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.layout.inbox', 'Inbox'),
          'FileX',
          'SearchX',
          'FolderOpen',
        ]),
      { probability: 0.7 }
    ),
    actionLabel: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.layout.addItem', 'Add item'),
          i18n.t('factory.layout.createNew', 'Create new'),
          i18n.t('factory.layout.getStarted', 'Get started'),
        ]),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

export function createFakeEmpties(count: number): FakeEmpty[] {
  return Array.from({ length: count }, () => createFakeEmpty());
}

// NOTE: Pagination factories (createFakePagination*, etc.) are exported from table.factory.ts
