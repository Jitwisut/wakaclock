import { faker } from '@faker-js/faker';
import i18n from 'i18next';

import { MENU_ICONS } from './menu.factory';

export type DrawerSide = 'bottom' | 'left' | 'right' | 'top';
export type SheetSide = 'bottom' | 'left' | 'right' | 'top';

export interface FakeDrawer {
  description?: string;
  id: string;
  open: boolean;
  side: DrawerSide;
  title: string;
}

export interface FakeSheet {
  description?: string;
  id: string;
  open: boolean;
  side: SheetSide;
  title: string;
}

export interface FakePopover {
  align: 'center' | 'end' | 'start';
  content: string;
  id: string;
  open: boolean;
  side: 'bottom' | 'left' | 'right' | 'top';
  title?: string;
}

export interface FakeHoverCard {
  content: string;
  id: string;
  imageUrl?: string;
  open: boolean;
  title: string;
}

export interface FakeCollapsible {
  content: string;
  id: string;
  open: boolean;
  title: string;
}

export interface FakeContextMenuItem {
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  shortcut?: string;
}

export interface FakeContextMenu {
  id: string;
  items: FakeContextMenuItem[];
}

export interface FakeDropdownMenuItem {
  disabled: boolean;
  icon?: string;
  id: string;
  label: string;
  shortcut?: string;
}

export interface FakeDropdownMenu {
  id: string;
  items: FakeDropdownMenuItem[];
  label: string;
}

export const DRAWER_SIDES: DrawerSide[] = ['top', 'right', 'bottom', 'left'];
export const SHEET_SIDES: SheetSide[] = ['top', 'right', 'bottom', 'left'];
// MENU_ICONS imported from menu.factory to avoid duplicate exports

export function createFakeDrawer(overrides?: Partial<FakeDrawer>): FakeDrawer {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.overlay.menu', 'Menu'),
      i18n.t('factory.overlay.settings', 'Settings'),
      i18n.t('factory.overlay.filters', 'Filters'),
      i18n.t('factory.overlay.details', 'Details'),
      i18n.t('factory.overlay.cart', 'Cart'),
      i18n.t('factory.overlay.navigation', 'Navigation'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    side: faker.helpers.arrayElement(DRAWER_SIDES),
    open: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

export function createFakeDrawers(count: number): FakeDrawer[] {
  return Array.from({ length: count }, () => createFakeDrawer());
}

export function createFakeSheet(overrides?: Partial<FakeSheet>): FakeSheet {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.overlay.editProfile', 'Edit Profile'),
      i18n.t('factory.overlay.settings', 'Settings'),
      i18n.t('factory.overlay.filters', 'Filters'),
      i18n.t('factory.overlay.details', 'Details'),
      i18n.t('factory.overlay.newItem', 'New Item'),
    ]),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
    side: faker.helpers.arrayElement(SHEET_SIDES),
    open: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

export function createFakeSheets(count: number): FakeSheet[] {
  return Array.from({ length: count }, () => createFakeSheet());
}

export function createFakePopover(overrides?: Partial<FakePopover>): FakePopover {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.maybe(
      () =>
        faker.helpers.arrayElement([
          i18n.t('factory.overlay.quickActions', 'Quick Actions'),
          i18n.t('factory.overlay.options', 'Options'),
          i18n.t('factory.overlay.moreInfo', 'More Info'),
        ]),
      { probability: 0.5 }
    ),
    content: faker.lorem.sentences(2),
    side: faker.helpers.arrayElement(['top', 'right', 'bottom', 'left']),
    align: faker.helpers.arrayElement(['start', 'center', 'end']),
    open: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

export function createFakePopovers(count: number): FakePopover[] {
  return Array.from({ length: count }, () => createFakePopover());
}

export function createFakeHoverCard(overrides?: Partial<FakeHoverCard>): FakeHoverCard {
  return {
    id: faker.string.uuid(),
    title: faker.person.fullName(),
    content: faker.lorem.paragraph(),
    imageUrl: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.6 }),
    open: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

export function createFakeHoverCards(count: number): FakeHoverCard[] {
  return Array.from({ length: count }, () => createFakeHoverCard());
}

export function createFakeCollapsible(overrides?: Partial<FakeCollapsible>): FakeCollapsible {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement([
      i18n.t('factory.overlay.advancedOptions', 'Advanced Options'),
      i18n.t('factory.overlay.moreDetails', 'More Details'),
      i18n.t('factory.overlay.expandSection', 'Expand Section'),
      i18n.t('factory.overlay.additionalInfo', 'Additional Info'),
    ]),
    content: faker.lorem.paragraph(),
    open: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

export function createFakeCollapsibles(count: number): FakeCollapsible[] {
  return Array.from({ length: count }, () => createFakeCollapsible());
}

export function createFakeContextMenuItem(
  overrides?: Partial<FakeContextMenuItem>
): FakeContextMenuItem {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      'Cut',
      i18n.t('factory.overlay.copy', 'Copy'),
      i18n.t('factory.overlay.paste', 'Paste'),
      i18n.t('factory.overlay.delete', 'Delete'),
      i18n.t('factory.overlay.rename', 'Rename'),
      i18n.t('factory.overlay.properties', 'Properties'),
      i18n.t('factory.overlay.open', 'Open'),
      i18n.t('factory.overlay.edit', 'Edit'),
    ]),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(MENU_ICONS), { probability: 0.5 }),
    shortcut: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Del', 'F2']),
      { probability: 0.4 }
    ),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeContextMenuItems(count: number): FakeContextMenuItem[] {
  return Array.from({ length: count }, () => createFakeContextMenuItem());
}

export function createFakeContextMenu(overrides?: Partial<FakeContextMenu>): FakeContextMenu {
  return {
    id: faker.string.uuid(),
    items: createFakeContextMenuItems(faker.number.int({ min: 3, max: 8 })),
    ...overrides,
  };
}

export function createFakeContextMenus(count: number): FakeContextMenu[] {
  return Array.from({ length: count }, () => createFakeContextMenu());
}

export function createFakeDropdownMenuItem(
  overrides?: Partial<FakeDropdownMenuItem>
): FakeDropdownMenuItem {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.overlay.profile', 'Profile'),
      i18n.t('factory.overlay.settings', 'Settings'),
      i18n.t('factory.overlay.help', 'Help'),
      i18n.t('factory.overlay.logOut', 'Log out'),
      i18n.t('factory.overlay.dashboard', 'Dashboard'),
      i18n.t('factory.overlay.billing', 'Billing'),
    ]),
    icon: faker.helpers.maybe(() => faker.helpers.arrayElement(MENU_ICONS), { probability: 0.5 }),
    shortcut: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['Ctrl+P', 'Ctrl+S', 'Ctrl+H']),
      { probability: 0.3 }
    ),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

export function createFakeDropdownMenuItems(count: number): FakeDropdownMenuItem[] {
  return Array.from({ length: count }, () => createFakeDropdownMenuItem());
}

export function createFakeDropdownMenu(overrides?: Partial<FakeDropdownMenu>): FakeDropdownMenu {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.overlay.myAccount', 'My Account'),
      i18n.t('factory.overlay.options', 'Options'),
      i18n.t('factory.overlay.actions', 'Actions'),
      i18n.t('factory.overlay.menu', 'Menu'),
    ]),
    items: createFakeDropdownMenuItems(faker.number.int({ min: 3, max: 6 })),
    ...overrides,
  };
}

export function createFakeDropdownMenus(count: number): FakeDropdownMenu[] {
  return Array.from({ length: count }, () => createFakeDropdownMenu());
}
