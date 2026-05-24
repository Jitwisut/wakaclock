import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============ TYPE DEFINITIONS ============

/** Export format types */
export type CardExportFormat = 'excel' | 'pdf';

/** Menu item action type */
export type CardActionType = 'delete' | 'download' | 'duplicate' | 'edit' | 'export' | 'share';

/** Interface for fake card action menu item */
export interface FakeCardActionMenu {
  /** Action type */
  action: CardActionType;
  /** Whether the item is disabled */
  disabled: boolean;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
}

/** Interface for fake export button config */
export interface FakeExportButtonConfig {
  /** Button label */
  buttonLabel: string;
  /** Whether button is disabled */
  disabled: boolean;
  /** Excel option label */
  excelLabel: string;
  /** Available formats */
  formats: CardExportFormat[];
  /** PDF option label */
  pdfLabel: string;
}

// ============ CONSTANTS FOR ITERATION ============

/** All export format options */
export const CARD_EXPORT_FORMATS: CardExportFormat[] = ['excel', 'pdf'];

/** All action type options */
export const CARD_ACTION_TYPES: CardActionType[] = [
  'delete',
  'download',
  'duplicate',
  'edit',
  'export',
  'share',
];

/** Common menu item labels */
export const CARD_ACTION_LABELS: Record<CardActionType, string> = {
  delete: i18n.t('factory.cardActionMenus.delete', 'Delete'),
  download: i18n.t('factory.cardActionMenus.download', 'Download'),
  duplicate: i18n.t('factory.cardActionMenus.duplicate', 'Duplicate'),
  edit: i18n.t('factory.cardActionMenus.edit', 'Edit'),
  export: i18n.t('factory.cardActionMenus.export', 'Export'),
  share: i18n.t('factory.cardActionMenus.share', 'Share'),
};

// ============ SINGLE ITEM FACTORY ============

/**
 * Creates a single fake card action menu item
 * @param overrides - Optional partial overrides
 * @returns A fake card action menu item
 */
export function createFakeCardActionMenu(
  overrides?: Partial<FakeCardActionMenu>
): FakeCardActionMenu {
  const action = faker.helpers.arrayElement(CARD_ACTION_TYPES);

  return {
    id: faker.string.uuid(),
    label: CARD_ACTION_LABELS[action],
    action,
    disabled: faker.helpers.maybe(() => true, { probability: 0.15 }) ?? false,
    ...overrides,
  };
}

// ============ BULK FACTORY ============

/**
 * Creates multiple fake card action menu items
 * @param count - Number of items to generate
 * @returns Array of fake card action menu items
 */
export function createFakeCardActionMenus(count: number): FakeCardActionMenu[] {
  return Array.from({ length: count }, () => createFakeCardActionMenu());
}

// ============ SPECIALIZED FACTORIES ============

/**
 * Creates a disabled card action menu item
 * @param action - Action type
 * @returns A disabled card action menu item
 */
export function createFakeDisabledCardAction(action?: CardActionType): FakeCardActionMenu {
  const selectedAction = action ?? faker.helpers.arrayElement(CARD_ACTION_TYPES);

  return createFakeCardActionMenu({
    action: selectedAction,
    label: CARD_ACTION_LABELS[selectedAction],
    disabled: true,
  });
}

/**
 * Creates an export button configuration
 * @param disabled - Whether button is disabled
 * @returns Export button configuration
 */
export function createFakeExportButtonConfig(disabled = false): FakeExportButtonConfig {
  return {
    buttonLabel: i18n.t('factory.cardActionMenus.export', 'Export'),
    excelLabel: i18n.t('factory.cardActionMenus.excel', 'Excel'),
    pdfLabel: 'PDF',
    formats: [...CARD_EXPORT_FORMATS],
    disabled,
  };
}

/**
 * Creates a complete set of card action menu items
 * @returns Array with one item per action type
 */
export function createFakeCardActionMenuSet(): FakeCardActionMenu[] {
  return CARD_ACTION_TYPES.map((action) =>
    createFakeCardActionMenu({
      id: `action-${action}`,
      action,
      label: CARD_ACTION_LABELS[action],
      disabled: false,
    })
  );
}
