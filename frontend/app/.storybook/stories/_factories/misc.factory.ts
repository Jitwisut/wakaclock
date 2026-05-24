import { faker } from '@faker-js/faker';
import i18n from 'i18next';

export type ToggleVariant = 'default' | 'outline';
export type ToggleSize = 'default' | 'lg' | 'sm';

export interface FakeKbd {
  id: string;
  keys: string[];
}

export interface FakeToggle {
  disabled: boolean;
  id: string;
  label: string;
  pressed: boolean;
  size: ToggleSize;
  variant: ToggleVariant;
}

export interface FakeToggleGroupItem {
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  value: string;
}

export interface FakeToggleGroup {
  id: string;
  items: FakeToggleGroupItem[];
  type: 'multiple' | 'single';
  value: string | string[];
}

export interface FakeSwitch {
  checked: boolean;
  disabled: boolean;
  id: string;
  label: string;
}

export interface FakeSlider {
  defaultValue: number[];
  disabled: boolean;
  id: string;
  max: number;
  min: number;
  step: number;
}

export interface FakeTimelineEvent {
  content: string;
  date: string;
  icon?: string;
  id: string;
  status: 'completed' | 'current' | 'upcoming';
  title: string;
}

export interface FakeTimeline {
  events: FakeTimelineEvent[];
  id: string;
}

export interface FakeReel {
  id: string;
  items: FakeReelItem[];
}

export interface FakeReelItem {
  description?: string;
  id: string;
  imageUrl: string;
  title: string;
}

export interface FakeAspectRatio {
  id: string;
  imageUrl: string;
  ratio: number;
}

export interface FakeNavigationMenuItem {
  description?: string;
  href: string;
  id: string;
  title: string;
}

export interface FakeNavigationMenu {
  id: string;
  items: FakeNavigationMenuItem[];
  trigger: string;
}

export const TOGGLE_VARIANTS: ToggleVariant[] = ['default', 'outline'];
export const TOGGLE_SIZES: ToggleSize[] = ['default', 'sm', 'lg'];
export const TOGGLE_ICONS = [
  i18n.t('factory.misc.bold', 'Bold'),
  i18n.t('factory.misc.italic', 'Italic'),
  i18n.t('factory.misc.underline', 'Underline'),
  'AlignLeft',
  'AlignCenter',
  'AlignRight',
  i18n.t('factory.misc.list', 'List'),
  'ListOrdered',
];
export const KBD_KEYS = [
  '⌘',
  '⇧',
  '⌥',
  '⌃',
  i18n.t('factory.misc.enter', 'Enter'),
  'Esc',
  'Tab',
  i18n.t('factory.misc.space', 'Space'),
  i18n.t('factory.misc.backspace', 'Backspace'),
  i18n.t('factory.misc.delete', 'Delete'),
  'A',
  'C',
  'V',
  'X',
  'Z',
  'S',
  'K',
  'P',
];
export const TIMELINE_ICONS = [
  i18n.t('factory.misc.check', 'Check'),
  i18n.t('factory.misc.clock', 'Clock'),
  i18n.t('factory.misc.circle', 'Circle'),
  'AlertCircle',
  'XCircle',
  'CheckCircle',
];

export function createFakeKbd(overrides?: Partial<FakeKbd>): FakeKbd {
  const keyCount = faker.number.int({ min: 1, max: 3 });
  return {
    id: faker.string.uuid(),
    keys: faker.helpers.arrayElements(KBD_KEYS, keyCount),
    ...overrides,
  };
}

export function createFakeKbds(count: number): FakeKbd[] {
  return Array.from({ length: count }, () => createFakeKbd());
}

export function createFakeToggle(overrides?: Partial<FakeToggle>): FakeToggle {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.misc.bold', 'Bold'),
      i18n.t('factory.misc.italic', 'Italic'),
      i18n.t('factory.misc.underline', 'Underline'),
      i18n.t('factory.misc.strikethrough', 'Strikethrough'),
      i18n.t('factory.misc.code', 'Code'),
    ]),
    pressed: faker.datatype.boolean({ probability: 0.3 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    variant: faker.helpers.arrayElement(TOGGLE_VARIANTS),
    size: faker.helpers.arrayElement(TOGGLE_SIZES),
    ...overrides,
  };
}

export function createFakeToggles(count: number): FakeToggle[] {
  return Array.from({ length: count }, () => createFakeToggle());
}

export function createFakeToggleGroupItem(
  overrides?: Partial<FakeToggleGroupItem>
): FakeToggleGroupItem {
  const label = faker.helpers.arrayElement([
    i18n.t('factory.misc.bold', 'Bold'),
    i18n.t('factory.misc.italic', 'Italic'),
    i18n.t('factory.misc.underline', 'Underline'),
    i18n.t('factory.misc.left', 'Left'),
    i18n.t('factory.misc.center', 'Center'),
    i18n.t('factory.misc.right', 'Right'),
  ]);
  return {
    id: faker.string.uuid(),
    label,
    value: label.toLowerCase(),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(TOGGLE_ICONS), { probability: 0.6 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeToggleGroupItems(count: number): FakeToggleGroupItem[] {
  return Array.from({ length: count }, () => createFakeToggleGroupItem());
}

export function createFakeToggleGroup(overrides?: Partial<FakeToggleGroup>): FakeToggleGroup {
  const items = createFakeToggleGroupItems(faker.number.int({ min: 2, max: 5 }));
  const type = faker.helpers.arrayElement(['single', 'multiple']) as 'multiple' | 'single';
  return {
    id: faker.string.uuid(),
    type,
    items,
    value:
      type === 'single'
        ? faker.helpers.arrayElement(items).value
        : faker.helpers
            .arrayElements(items, faker.number.int({ min: 0, max: 2 }))
            .map((i) => i.value),
    ...overrides,
  };
}

export function createFakeToggleGroups(count: number): FakeToggleGroup[] {
  return Array.from({ length: count }, () => createFakeToggleGroup());
}

export function createFakeSwitch(overrides?: Partial<FakeSwitch>): FakeSwitch {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.misc.darkMode', 'Dark mode'),
      i18n.t('factory.misc.notifications', 'Notifications'),
      'Auto-save',
      i18n.t('factory.misc.airplaneMode', 'Airplane mode'),
      i18n.t('factory.misc.doNotDisturb', 'Do not disturb'),
    ]),
    checked: faker.datatype.boolean({ probability: 0.4 }),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeSwitches(count: number): FakeSwitch[] {
  return Array.from({ length: count }, () => createFakeSwitch());
}

export function createFakeSlider(overrides?: Partial<FakeSlider>): FakeSlider {
  const min = overrides?.min ?? 0;
  const max = overrides?.max ?? 100;
  return {
    id: faker.string.uuid(),
    min,
    max,
    step: faker.helpers.arrayElement([1, 5, 10]),
    defaultValue: [faker.number.int({ min, max })],
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeSliders(count: number): FakeSlider[] {
  return Array.from({ length: count }, () => createFakeSlider());
}

export function createFakeTimelineEvent(overrides?: Partial<FakeTimelineEvent>): FakeTimelineEvent {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.misc.orderPlaced', 'Order placed'),
      i18n.t('factory.misc.paymentReceived', 'Payment received'),
      i18n.t('factory.misc.shipped', 'Shipped'),
      i18n.t('factory.misc.delivered', 'Delivered'),
      i18n.t('factory.misc.completed', 'Completed'),
    ]),
    content: faker.lorem.sentence(),
    date: faker.date.recent().toISOString(),
    status: faker.helpers.arrayElement(['completed', 'current', 'upcoming']),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(TIMELINE_ICONS), {
      probability: 0.6,
    }),
    ...overrides,
  };
}

export function createFakeTimelineEvents(count: number): FakeTimelineEvent[] {
  return Array.from({ length: count }, () => createFakeTimelineEvent());
}

export function createFakeTimelineData(overrides?: Partial<FakeTimeline>): FakeTimeline {
  return {
    id: faker.string.uuid(),
    events: createFakeTimelineEvents(faker.number.int({ min: 3, max: 7 })),
    ...overrides,
  };
}

export function createFakeTimelineDatas(count: number): FakeTimeline[] {
  return Array.from({ length: count }, () => createFakeTimelineData());
}

export function createFakeReelItem(overrides?: Partial<FakeReelItem>): FakeReelItem {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    imageUrl: faker.image.urlPicsumPhotos({ width: 400, height: 300 }),
    ...overrides,
  };
}

export function createFakeReelItems(count: number): FakeReelItem[] {
  return Array.from({ length: count }, () => createFakeReelItem());
}

export function createFakeReel(overrides?: Partial<FakeReel>): FakeReel {
  return {
    id: faker.string.uuid(),
    items: createFakeReelItems(faker.number.int({ min: 5, max: 10 })),
    ...overrides,
  };
}

export function createFakeReels(count: number): FakeReel[] {
  return Array.from({ length: count }, () => createFakeReel());
}

export function createFakeAspectRatio(overrides?: Partial<FakeAspectRatio>): FakeAspectRatio {
  return {
    id: faker.string.uuid(),
    ratio: faker.helpers.arrayElement([1, 4 / 3, 16 / 9, 21 / 9]),
    imageUrl: faker.image.urlPicsumPhotos({ width: 800, height: 450 }),
    ...overrides,
  };
}

export function createFakeAspectRatios(count: number): FakeAspectRatio[] {
  return Array.from({ length: count }, () => createFakeAspectRatio());
}

export function createFakeNavigationMenuItem(
  overrides?: Partial<FakeNavigationMenuItem>
): FakeNavigationMenuItem {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.misc.gettingStarted', 'Getting Started'),
      i18n.t('factory.misc.documentation', 'Documentation'),
      i18n.t('factory.misc.components', 'Components'),
      i18n.t('factory.misc.examples', 'Examples'),
      i18n.t('factory.misc.blog', 'Blog'),
    ]),
    href: faker.helpers.arrayElement(['/docs', '/components', '/examples', '/blog', '/about']),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }),
    ...overrides,
  };
}

export function createFakeNavigationMenuItems(count: number): FakeNavigationMenuItem[] {
  return Array.from({ length: count }, () => createFakeNavigationMenuItem());
}

export function createFakeNavigationMenu(
  overrides?: Partial<FakeNavigationMenu>
): FakeNavigationMenu {
  return {
    id: faker.string.uuid(),
    trigger: faker.helpers.arrayElement([
      i18n.t('factory.misc.products', 'Products'),
      i18n.t('factory.misc.resources', 'Resources'),
      i18n.t('factory.misc.company', 'Company'),
      i18n.t('factory.misc.support', 'Support'),
    ]),
    items: createFakeNavigationMenuItems(faker.number.int({ min: 3, max: 6 })),
    ...overrides,
  };
}

export function createFakeNavigationMenus(count: number): FakeNavigationMenu[] {
  return Array.from({ length: count }, () => createFakeNavigationMenu());
}
