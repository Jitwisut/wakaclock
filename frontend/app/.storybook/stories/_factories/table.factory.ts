import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// ============================================================================
// TABLE FACTORY - Enterprise Pattern
// Comprehensive test data generation for table and data grid components
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Table row status for indicating row state */
export type TableRowStatus = 'active' | 'default' | 'disabled' | 'error' | 'selected' | 'warning';

/** Table cell alignment options */
export type TableCellAlign = 'center' | 'left' | 'right';

/** Table row priority levels */
export type TableRowPriority = 'critical' | 'high' | 'low' | 'medium' | 'urgent';

/** Table column sort direction */
export type SortDirection = 'asc' | 'desc' | 'none';

/** Table selection mode */
export type SelectionMode = 'multiple' | 'none' | 'single';

/** Table density options */
export type TableDensity = 'comfortable' | 'compact' | 'normal';

/** Invoice status types */
export type InvoiceStatus = 'cancelled' | 'draft' | 'overdue' | 'paid' | 'pending' | 'refunded';

/** Order status types */
export type OrderStatus =
  | 'cancelled'
  | 'confirmed'
  | 'delivered'
  | 'pending'
  | 'processing'
  | 'returned'
  | 'shipped';

/** Product status types */
export type ProductStatus = 'active' | 'archived' | 'draft' | 'inactive' | 'out_of_stock';

/** User status types */
export type UserTableStatus = 'active' | 'banned' | 'inactive' | 'pending' | 'suspended';

/** Transaction status types */
export type TransactionStatus =
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'processing'
  | 'refunded';

/** Filter operator types */
export type FilterOperator =
  | 'between'
  | 'contains'
  | 'ends_with'
  | 'equals'
  | 'greater_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'less_than'
  | 'not_contains'
  | 'not_equals'
  | 'starts_with';

// ============================================================================
// INTERFACES
// ============================================================================

/** Generic table row structure */
export interface FakeTableRow {
  amount: number;
  category: string;
  date: string;
  email: string;
  id: string;
  name: string;
  priority: TableRowPriority;
  status: 'active' | 'inactive' | 'pending';
}

/** Table column definition */
export interface FakeTableColumn {
  accessor: string;
  align?: TableCellAlign;
  filterable?: boolean;
  footer?: string;
  format?: 'boolean' | 'currency' | 'date' | 'number' | 'percentage' | 'text';
  frozen?: boolean;
  header: string;
  hidden?: boolean;
  id: string;
  maxWidth?: number;
  minWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  width?: number | string;
}

/** Table pagination configuration */
export interface FakePagination {
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

/** Complete table response with data and pagination */
export interface FakeTableResponse {
  data: FakeTableRow[];
  pagination: FakePagination;
}

/** Table sort state */
export interface FakeTableSort {
  column: string;
  direction: SortDirection;
}

/** Table filter definition */
export interface FakeTableFilter {
  column: string;
  id: string;
  operator: FilterOperator;
  value: [number, number] | boolean | number | string | string[];
}

/** Table configuration */
export interface FakeTableConfig {
  columns: FakeTableColumn[];
  density?: TableDensity;
  enableColumnResize?: boolean;
  enableRowSelection?: boolean;
  enableSorting?: boolean;
  filters?: FakeTableFilter[];
  id: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  selectionMode?: SelectionMode;
  showFooter?: boolean;
  showHeader?: boolean;
  showPagination?: boolean;
  sort?: FakeTableSort;
  stickyHeader?: boolean;
  striped?: boolean;
  title?: string;
}

/** Invoice data structure */
export interface FakeInvoice {
  amount: number;
  createdAt: string;
  currency: string;
  customer: string;
  dueDate: string;
  email: string;
  id: string;
  invoiceNumber: string;
  items: number;
  notes?: string;
  paidAt?: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
}

/** Order data structure */
export interface FakeOrder {
  createdAt: string;
  customer: string;
  email: string;
  fulfillmentStatus: 'fulfilled' | 'partial' | 'unfulfilled';
  id: string;
  items: FakeOrderItem[];
  orderNumber: string;
  paymentStatus: 'paid' | 'partial' | 'refunded' | 'unpaid';
  shippingAddress: FakeAddress;
  shippingMethod: string;
  status: OrderStatus;
  total: number;
  trackingNumber?: string;
  updatedAt: string;
}

/** Order item structure */
export interface FakeOrderItem {
  id: string;
  name: string;
  price: number;
  productId: string;
  quantity: number;
  sku: string;
  total: number;
}

/** Address structure */
export interface FakeAddress {
  city: string;
  country: string;
  line1: string;
  line2?: string;
  postalCode: string;
  state: string;
}

/** Product data structure */
export interface FakeProduct {
  category: string;
  createdAt: string;
  description: string;
  id: string;
  imageUrl: string;
  inventory: number;
  name: string;
  price: number;
  sku: string;
  status: ProductStatus;
  updatedAt: string;
  variants?: FakeProductVariant[];
}

/** Product variant structure */
export interface FakeProductVariant {
  id: string;
  inventory: number;
  name: string;
  price: number;
  sku: string;
}

/** User table data structure */
export interface FakeUserTableRow {
  avatar: string;
  createdAt: string;
  department: string;
  email: string;
  id: string;
  lastActiveAt: string;
  name: string;
  role: string;
  status: UserTableStatus;
}

/** Transaction data structure */
export interface FakeTransaction {
  amount: number;
  createdAt: string;
  currency: string;
  description: string;
  fee: number;
  id: string;
  method: 'bank_transfer' | 'credit_card' | 'crypto' | 'debit_card' | 'paypal';
  net: number;
  reference: string;
  status: TransactionStatus;
  type: 'payment' | 'payout' | 'refund' | 'transfer';
}

/** Data grid cell */
export interface FakeDataGridCell {
  align?: TableCellAlign;
  colspan?: number;
  editable?: boolean;
  id: string;
  rowspan?: number;
  value: boolean | null | number | string;
}

/** Data grid row */
export interface FakeDataGridRow {
  cells: FakeDataGridCell[];
  expanded?: boolean;
  id: string;
  level?: number;
  parentId?: string;
  selected?: boolean;
  status?: TableRowStatus;
}

/** Bulk action definition */
export interface FakeBulkAction {
  confirmMessage?: string;
  dangerous?: boolean;
  disabled?: boolean;
  icon?: string;
  id: string;
  label: string;
  requiresConfirmation?: boolean;
}

/** Export configuration */
export interface FakeExportConfig {
  filename: string;
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  id: string;
  includeHeaders: boolean;
  selectedOnly: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** All table row statuses */
export const TABLE_ROW_STATUSES: TableRowStatus[] = [
  'default',
  'active',
  'selected',
  'disabled',
  'error',
  'warning',
];

/** All table cell alignments */
export const TABLE_CELL_ALIGNS: TableCellAlign[] = ['left', 'center', 'right'];

/** All table row priorities */
export const TABLE_ROW_PRIORITIES: TableRowPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
  'critical',
];

/** All sort directions */
export const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc', 'none'];

/** All selection modes */
export const SELECTION_MODES: SelectionMode[] = ['none', 'single', 'multiple'];

/** All table densities */
export const TABLE_DENSITIES: TableDensity[] = ['compact', 'normal', 'comfortable'];

/** All invoice statuses */
export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'pending',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
];

/** All order statuses */
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
];

/** All product statuses */
export const PRODUCT_STATUSES: ProductStatus[] = [
  'active',
  'inactive',
  'draft',
  'archived',
  'out_of_stock',
];

/** All user table statuses */
export const USER_TABLE_STATUSES: UserTableStatus[] = [
  'active',
  'inactive',
  'pending',
  'suspended',
  'banned',
];

/** All transaction statuses */
export const TRANSACTION_STATUSES: TransactionStatus[] = [
  'pending',
  'completed',
  'failed',
  'refunded',
  'cancelled',
  'processing',
];

/** All filter operators */
export const FILTER_OPERATORS: FilterOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'between',
  'is_empty',
  'is_not_empty',
];

/** Common page size options */
export const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100] as const;

/** Common currencies */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;

/** Common product categories */
export const PRODUCT_CATEGORIES = [
  i18n.t('factory.table.electronics', 'Electronics'),
  i18n.t('factory.table.clothing', 'Clothing'),
  i18n.t('factory.table.books', 'Books'),
  i18n.t('factory.table.homeGarden', 'Home & Garden'),
  i18n.t('factory.table.sports', 'Sports'),
  i18n.t('factory.table.toys', 'Toys'),
  i18n.t('factory.table.foodBeverage', 'Food & Beverage'),
  i18n.t('factory.table.healthBeauty', 'Health & Beauty'),
  i18n.t('factory.table.automotive', 'Automotive'),
  i18n.t('factory.table.officeSupplies', 'Office Supplies'),
] as const;

/** Common departments */
export const DEPARTMENTS = [
  i18n.t('factory.table.engineering', 'Engineering'),
  i18n.t('factory.table.product', 'Product'),
  i18n.t('factory.table.design', 'Design'),
  i18n.t('factory.table.marketing', 'Marketing'),
  i18n.t('factory.table.sales', 'Sales'),
  i18n.t('factory.table.support', 'Support'),
  'HR',
  i18n.t('factory.table.finance', 'Finance'),
  i18n.t('factory.table.legal', 'Legal'),
  i18n.t('factory.table.operations', 'Operations'),
] as const;

/** Common roles */
export const ROLES = [
  i18n.t('factory.table.admin', 'Admin'),
  i18n.t('factory.table.manager', 'Manager'),
  i18n.t('factory.table.developer', 'Developer'),
  i18n.t('factory.table.designer', 'Designer'),
  i18n.t('factory.table.analyst', 'Analyst'),
  i18n.t('factory.table.coordinator', 'Coordinator'),
  i18n.t('factory.table.specialist', 'Specialist'),
  i18n.t('factory.table.lead', 'Lead'),
  i18n.t('factory.table.director', 'Director'),
  'VP',
] as const;

// ============================================================================
// SINGLE ITEM FACTORIES
// ============================================================================

/**
 * Creates a fake table row with realistic data
 * @param overrides - Optional property overrides
 */
export function createFakeTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    status: faker.helpers.arrayElement(['active', 'inactive', 'pending']),
    amount: faker.number.float({ min: 10, max: 10_000, fractionDigits: 2 }),
    date: faker.date.recent().toISOString(),
    priority: faker.helpers.arrayElement(TABLE_ROW_PRIORITIES),
    category: faker.commerce.department(),
    ...overrides,
  };
}

/**
 * Creates a fake table column definition
 * @param overrides - Optional property overrides
 */
export function createFakeTableColumn(overrides?: Partial<FakeTableColumn>): FakeTableColumn {
  const accessor = overrides?.accessor ?? faker.database.column();

  return {
    id: faker.string.uuid(),
    header: faker.helpers.arrayElement([
      i18n.t('factory.table.name', 'Name'),
      i18n.t('factory.table.email', 'Email'),
      i18n.t('factory.table.status', 'Status'),
      i18n.t('factory.table.amount', 'Amount'),
      i18n.t('factory.table.date', 'Date'),
      i18n.t('factory.table.priority', 'Priority'),
      i18n.t('factory.table.category', 'Category'),
      i18n.t('factory.table.actions', 'Actions'),
    ]),
    accessor,
    align: faker.helpers.arrayElement(TABLE_CELL_ALIGNS),
    sortable: faker.datatype.boolean({ probability: 0.7 }),
    filterable: faker.datatype.boolean({ probability: 0.5 }),
    resizable: faker.datatype.boolean({ probability: 0.6 }),
    hidden: faker.datatype.boolean({ probability: 0.1 }),
    frozen: faker.datatype.boolean({ probability: 0.1 }),
    width: faker.helpers.maybe(() => faker.number.int({ min: 80, max: 300 }), { probability: 0.5 }),
    minWidth: faker.helpers.maybe(() => faker.number.int({ min: 50, max: 100 }), {
      probability: 0.3,
    }),
    maxWidth: faker.helpers.maybe(() => faker.number.int({ min: 200, max: 500 }), {
      probability: 0.3,
    }),
    format: faker.helpers.arrayElement(['text', 'number', 'currency', 'date', 'percentage']),
    footer: faker.helpers.maybe(() => faker.lorem.word(), { probability: 0.2 }),
    ...overrides,
  };
}

/**
 * Creates a fake pagination object
 * @param overrides - Optional property overrides
 */
export function createFakePagination(overrides?: Partial<FakePagination>): FakePagination {
  const total = overrides?.total ?? faker.number.int({ min: 50, max: 500 });
  const limit = overrides?.limit ?? 10;
  const totalPages = Math.ceil(total / limit);
  const page = overrides?.page ?? 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    ...overrides,
  };
}

/**
 * Creates a fake table sort state
 * @param overrides - Optional property overrides
 */
export function createFakeTableSort(overrides?: Partial<FakeTableSort>): FakeTableSort {
  return {
    column: faker.helpers.arrayElement(['name', 'email', 'amount', 'date', 'status', 'priority']),
    direction: faker.helpers.arrayElement(['asc', 'desc']),
    ...overrides,
  };
}

/**
 * Creates a fake table filter
 * @param overrides - Optional property overrides
 */
export function createFakeTableFilter(overrides?: Partial<FakeTableFilter>): FakeTableFilter {
  const operator =
    overrides?.operator ?? faker.helpers.arrayElement(['equals', 'contains', 'greater_than']);

  return {
    id: faker.string.uuid(),
    column: faker.helpers.arrayElement(['name', 'email', 'status', 'amount', 'date']),
    operator,
    value:
      operator === 'between'
        ? [faker.number.int({ min: 0, max: 500 }), faker.number.int({ min: 500, max: 1000 })]
        : faker.lorem.word(),
    ...overrides,
  };
}

/**
 * Creates a fake table configuration
 * @param overrides - Optional property overrides
 */
export function createFakeTableConfig(overrides?: Partial<FakeTableConfig>): FakeTableConfig {
  return {
    id: faker.string.uuid(),
    title: faker.helpers.maybe(() => faker.commerce.productName(), { probability: 0.7 }),
    columns: createFakeTableColumns(faker.number.int({ min: 4, max: 8 })),
    showHeader: faker.datatype.boolean({ probability: 0.95 }),
    showFooter: faker.datatype.boolean({ probability: 0.3 }),
    showPagination: faker.datatype.boolean({ probability: 0.9 }),
    stickyHeader: faker.datatype.boolean({ probability: 0.5 }),
    striped: faker.datatype.boolean({ probability: 0.4 }),
    density: faker.helpers.arrayElement(TABLE_DENSITIES),
    selectionMode: faker.helpers.arrayElement(SELECTION_MODES),
    enableSorting: faker.datatype.boolean({ probability: 0.8 }),
    enableRowSelection: faker.datatype.boolean({ probability: 0.6 }),
    enableColumnResize: faker.datatype.boolean({ probability: 0.5 }),
    pageSize: faker.helpers.arrayElement([10, 20, 25, 50]),
    pageSizeOptions: [10, 20, 50, 100],
    sort: faker.helpers.maybe(() => createFakeTableSort(), { probability: 0.5 }),
    filters: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => createFakeTableFilter()),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

/**
 * Creates a fake invoice
 * @param overrides - Optional property overrides
 */
export function createFakeInvoice(overrides?: Partial<FakeInvoice>): FakeInvoice {
  const subtotal = faker.number.float({ min: 100, max: 50_000, fractionDigits: 2 });
  const tax = subtotal * 0.1;
  const amount = subtotal + tax;
  const status = overrides?.status ?? faker.helpers.arrayElement(INVOICE_STATUSES);

  return {
    id: faker.string.uuid(),
    invoiceNumber: `INV-${faker.string.numeric(6)}`,
    customer: faker.company.name(),
    email: faker.internet.email(),
    subtotal,
    tax,
    amount,
    currency: faker.helpers.arrayElement([...CURRENCIES]),
    status,
    dueDate: faker.date.future().toISOString(),
    createdAt: faker.date.past().toISOString(),
    paidAt: status === 'paid' ? faker.date.recent().toISOString() : undefined,
    items: faker.number.int({ min: 1, max: 10 }),
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
    ...overrides,
  };
}

/**
 * Creates a fake order
 * @param overrides - Optional property overrides
 */
export function createFakeOrder(overrides?: Partial<FakeOrder>): FakeOrder {
  const items = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
    createFakeOrderItem()
  );
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const status = overrides?.status ?? faker.helpers.arrayElement(ORDER_STATUSES);

  return {
    id: faker.string.uuid(),
    orderNumber: `ORD-${faker.string.numeric(8)}`,
    customer: faker.person.fullName(),
    email: faker.internet.email(),
    items,
    total,
    status,
    paymentStatus: faker.helpers.arrayElement(['unpaid', 'partial', 'paid', 'refunded']),
    fulfillmentStatus: faker.helpers.arrayElement(['unfulfilled', 'partial', 'fulfilled']),
    shippingAddress: createFakeAddress(),
    shippingMethod: faker.helpers.arrayElement([
      i18n.t('factory.table.standard', 'Standard'),
      i18n.t('factory.table.express', 'Express'),
      i18n.t('factory.table.overnight', 'Overnight'),
      i18n.t('factory.table.freeShipping', 'Free Shipping'),
    ]),
    trackingNumber:
      status === 'shipped' || status === 'delivered'
        ? faker.string.alphanumeric(16).toUpperCase()
        : undefined,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a fake order item
 * @param overrides - Optional property overrides
 */
export function createFakeOrderItem(overrides?: Partial<FakeOrderItem>): FakeOrderItem {
  const price = faker.number.float({ min: 10, max: 500, fractionDigits: 2 });
  const quantity = faker.number.int({ min: 1, max: 5 });

  return {
    id: faker.string.uuid(),
    productId: faker.string.uuid(),
    name: faker.commerce.productName(),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    price,
    quantity,
    total: price * quantity,
    ...overrides,
  };
}

/**
 * Creates a fake address
 * @param overrides - Optional property overrides
 */
export function createFakeAddress(overrides?: Partial<FakeAddress>): FakeAddress {
  return {
    line1: faker.location.streetAddress(),
    line2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.3 }),
    city: faker.location.city(),
    state: faker.location.state(),
    postalCode: faker.location.zipCode(),
    country: faker.location.country(),
    ...overrides,
  };
}

/**
 * Creates a fake product
 * @param overrides - Optional property overrides
 */
export function createFakeProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    sku: faker.string.alphanumeric(8).toUpperCase(),
    price: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    category: faker.helpers.arrayElement([...PRODUCT_CATEGORIES]),
    status: faker.helpers.arrayElement(PRODUCT_STATUSES),
    inventory: faker.number.int({ min: 0, max: 1000 }),
    imageUrl: faker.image.urlLoremFlickr({ category: 'product' }),
    variants: faker.helpers.maybe(
      () =>
        Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
          createFakeProductVariant()
        ),
      { probability: 0.3 }
    ),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a fake product variant
 * @param overrides - Optional property overrides
 */
export function createFakeProductVariant(
  overrides?: Partial<FakeProductVariant>
): FakeProductVariant {
  return {
    id: faker.string.uuid(),
    name: faker.helpers.arrayElement([
      i18n.t('factory.table.small', 'Small'),
      i18n.t('factory.table.medium', 'Medium'),
      i18n.t('factory.table.large', 'Large'),
      'XL',
      'Red',
      i18n.t('factory.table.blue', 'Blue'),
      i18n.t('factory.table.black', 'Black'),
    ]),
    sku: faker.string.alphanumeric(10).toUpperCase(),
    price: faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    inventory: faker.number.int({ min: 0, max: 500 }),
    ...overrides,
  };
}

/**
 * Creates a fake user table row
 * @param overrides - Optional property overrides
 */
export function createFakeUserTableRow(overrides?: Partial<FakeUserTableRow>): FakeUserTableRow {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    avatar: faker.image.avatar(),
    role: faker.helpers.arrayElement([...ROLES]),
    department: faker.helpers.arrayElement([...DEPARTMENTS]),
    status: faker.helpers.arrayElement(USER_TABLE_STATUSES),
    createdAt: faker.date.past().toISOString(),
    lastActiveAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a fake transaction
 * @param overrides - Optional property overrides
 */
export function createFakeTransaction(overrides?: Partial<FakeTransaction>): FakeTransaction {
  const amount = faker.number.float({ min: 10, max: 10_000, fractionDigits: 2 });
  const fee = amount * 0.029 + 0.3;

  return {
    id: faker.string.uuid(),
    reference: `TXN-${faker.string.alphanumeric(12).toUpperCase()}`,
    type: faker.helpers.arrayElement(['payment', 'refund', 'payout', 'transfer']),
    amount,
    fee,
    net: amount - fee,
    currency: faker.helpers.arrayElement([...CURRENCIES]),
    status: faker.helpers.arrayElement(TRANSACTION_STATUSES),
    method: faker.helpers.arrayElement([
      'credit_card',
      'debit_card',
      'bank_transfer',
      'paypal',
      'crypto',
    ]),
    description: faker.finance.transactionDescription(),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a fake data grid cell
 * @param overrides - Optional property overrides
 */
export function createFakeDataGridCell(overrides?: Partial<FakeDataGridCell>): FakeDataGridCell {
  return {
    id: faker.string.uuid(),
    value: faker.helpers.arrayElement([
      faker.lorem.word(),
      faker.number.int({ min: 0, max: 1000 }),
      faker.datatype.boolean(),
      null,
    ]),
    align: faker.helpers.arrayElement(TABLE_CELL_ALIGNS),
    editable: faker.datatype.boolean({ probability: 0.3 }),
    colspan: faker.helpers.maybe(() => faker.number.int({ min: 2, max: 3 }), { probability: 0.1 }),
    rowspan: faker.helpers.maybe(() => faker.number.int({ min: 2, max: 3 }), { probability: 0.05 }),
    ...overrides,
  };
}

/**
 * Creates a fake data grid row
 * @param columnCount - Number of cells in the row
 * @param overrides - Optional property overrides
 */
export function createFakeDataGridRow(
  columnCount: number = 5,
  overrides?: Partial<FakeDataGridRow>
): FakeDataGridRow {
  return {
    id: faker.string.uuid(),
    cells: Array.from({ length: columnCount }, () => createFakeDataGridCell()),
    selected: faker.datatype.boolean({ probability: 0.1 }),
    expanded: faker.datatype.boolean({ probability: 0.05 }),
    status: faker.helpers.arrayElement(TABLE_ROW_STATUSES),
    level: faker.helpers.maybe(() => faker.number.int({ min: 0, max: 3 }), { probability: 0.2 }),
    parentId: faker.helpers.maybe(() => faker.string.uuid(), { probability: 0.15 }),
    ...overrides,
  };
}

/**
 * Creates a fake bulk action
 * @param overrides - Optional property overrides
 */
export function createFakeBulkAction(overrides?: Partial<FakeBulkAction>): FakeBulkAction {
  const dangerous = overrides?.dangerous ?? faker.datatype.boolean({ probability: 0.2 });

  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      i18n.t('factory.table.deleteSelected', 'Delete Selected'),
      i18n.t('factory.table.archiveSelected', 'Archive Selected'),
      i18n.t('factory.table.exportSelected', 'Export Selected'),
      i18n.t('factory.table.markAsRead', 'Mark as Read'),
      i18n.t('factory.table.changeStatus', 'Change Status'),
      i18n.t('factory.table.assignTo', 'Assign To'),
    ]),
    icon: faker.helpers.arrayElement([
      i18n.t('factory.table.trash', 'Trash'),
      i18n.t('factory.table.archive', 'Archive'),
      i18n.t('factory.table.download', 'Download'),
      i18n.t('factory.table.check', 'Check'),
      i18n.t('factory.table.edit', 'Edit'),
      i18n.t('factory.table.user', 'User'),
    ]),
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    dangerous,
    requiresConfirmation: dangerous || faker.datatype.boolean({ probability: 0.3 }),
    confirmMessage: dangerous
      ? i18n.t(
          'factory.table.areYouSureYouWant',
          'Are you sure you want to delete the selected items? This action cannot be undone.'
        )
      : undefined,
    ...overrides,
  };
}

/**
 * Creates a fake export configuration
 * @param overrides - Optional property overrides
 */
export function createFakeExportConfig(overrides?: Partial<FakeExportConfig>): FakeExportConfig {
  const format = overrides?.format ?? faker.helpers.arrayElement(['csv', 'xlsx', 'pdf', 'json']);

  return {
    id: faker.string.uuid(),
    format,
    filename: `export-${faker.date.recent().toISOString().split('T')[0]}.${format}`,
    includeHeaders: faker.datatype.boolean({ probability: 0.9 }),
    selectedOnly: faker.datatype.boolean({ probability: 0.3 }),
    ...overrides,
  };
}

// ============================================================================
// BULK FACTORIES
// ============================================================================

/**
 * Creates multiple fake table rows
 * @param count - Number of rows to create
 */
export function createFakeTableData(count: number): FakeTableRow[] {
  return Array.from({ length: count }, () => createFakeTableRow());
}

/**
 * Creates multiple fake table columns
 * @param count - Number of columns to create
 */
export function createFakeTableColumns(count: number): FakeTableColumn[] {
  const headers = [
    'ID',
    i18n.t('factory.table.name', 'Name'),
    i18n.t('factory.table.email', 'Email'),
    i18n.t('factory.table.status', 'Status'),
    i18n.t('factory.table.amount', 'Amount'),
    i18n.t('factory.table.date', 'Date'),
    i18n.t('factory.table.priority', 'Priority'),
    i18n.t('factory.table.category', 'Category'),
    i18n.t('factory.table.actions', 'Actions'),
  ];
  return Array.from({ length: Math.min(count, headers.length) }, (_, index) =>
    createFakeTableColumn({ header: headers[index], accessor: headers[index].toLowerCase() })
  );
}

/**
 * Creates a complete fake table response with pagination
 * @param count - Number of rows per page
 * @param paginationOverrides - Optional pagination overrides
 */
export function createFakeTableResponse(
  count?: number,
  paginationOverrides?: Partial<FakePagination>
): FakeTableResponse {
  const pagination = createFakePagination(paginationOverrides);
  const data = createFakeTableData(count ?? pagination.limit);

  return {
    data,
    pagination,
  };
}

/**
 * Creates multiple fake invoices
 * @param count - Number of invoices to create
 */
export function createFakeInvoices(count: number): FakeInvoice[] {
  return Array.from({ length: count }, () => createFakeInvoice());
}

/**
 * Creates multiple fake orders
 * @param count - Number of orders to create
 */
export function createFakeOrders(count: number): FakeOrder[] {
  return Array.from({ length: count }, () => createFakeOrder());
}

/**
 * Creates multiple fake products
 * @param count - Number of products to create
 */
export function createFakeProducts(count: number): FakeProduct[] {
  return Array.from({ length: count }, () => createFakeProduct());
}

/**
 * Creates multiple fake user table rows
 * @param count - Number of users to create
 */
export function createFakeUserTableRows(count: number): FakeUserTableRow[] {
  return Array.from({ length: count }, () => createFakeUserTableRow());
}

/**
 * Creates multiple fake transactions
 * @param count - Number of transactions to create
 */
export function createFakeTransactions(count: number): FakeTransaction[] {
  return Array.from({ length: count }, () => createFakeTransaction());
}

/**
 * Creates multiple fake data grid rows
 * @param rowCount - Number of rows to create
 * @param columnCount - Number of columns per row
 */
export function createFakeDataGridRows(
  rowCount: number,
  columnCount: number = 5
): FakeDataGridRow[] {
  return Array.from({ length: rowCount }, () => createFakeDataGridRow(columnCount));
}

/**
 * Creates multiple fake bulk actions
 * @param count - Number of actions to create
 */
export function createFakeBulkActions(count: number): FakeBulkAction[] {
  return Array.from({ length: count }, () => createFakeBulkAction());
}

// ============================================================================
// SPECIALIZED FACTORIES
// ============================================================================

/**
 * Creates a table row in active state
 */
export function createFakeActiveTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return createFakeTableRow({
    status: 'active',
    ...overrides,
  });
}

/**
 * Creates a table row in inactive state
 */
export function createFakeInactiveTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return createFakeTableRow({
    status: 'inactive',
    ...overrides,
  });
}

/**
 * Creates a table row in pending state
 */
export function createFakePendingTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return createFakeTableRow({
    status: 'pending',
    ...overrides,
  });
}

/**
 * Creates a high priority table row
 */
export function createFakeHighPriorityTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return createFakeTableRow({
    priority: 'high',
    ...overrides,
  });
}

/**
 * Creates a critical priority table row
 */
export function createFakeCriticalTableRow(overrides?: Partial<FakeTableRow>): FakeTableRow {
  return createFakeTableRow({
    priority: 'critical',
    ...overrides,
  });
}

/**
 * Creates a paid invoice
 */
export function createFakePaidInvoice(overrides?: Partial<FakeInvoice>): FakeInvoice {
  return createFakeInvoice({
    status: 'paid',
    paidAt: faker.date.recent().toISOString(),
    ...overrides,
  });
}

/**
 * Creates an overdue invoice
 */
export function createFakeOverdueInvoice(overrides?: Partial<FakeInvoice>): FakeInvoice {
  return createFakeInvoice({
    status: 'overdue',
    dueDate: faker.date.past().toISOString(),
    ...overrides,
  });
}

/**
 * Creates a draft invoice
 */
export function createFakeDraftInvoice(overrides?: Partial<FakeInvoice>): FakeInvoice {
  return createFakeInvoice({
    status: 'draft',
    ...overrides,
  });
}

/**
 * Creates a pending order
 */
export function createFakePendingOrder(overrides?: Partial<FakeOrder>): FakeOrder {
  return createFakeOrder({
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'unfulfilled',
    ...overrides,
  });
}

/**
 * Creates a shipped order
 */
export function createFakeShippedOrder(overrides?: Partial<FakeOrder>): FakeOrder {
  return createFakeOrder({
    status: 'shipped',
    paymentStatus: 'paid',
    fulfillmentStatus: 'fulfilled',
    trackingNumber: faker.string.alphanumeric(16).toUpperCase(),
    ...overrides,
  });
}

/**
 * Creates a delivered order
 */
export function createFakeDeliveredOrder(overrides?: Partial<FakeOrder>): FakeOrder {
  return createFakeOrder({
    status: 'delivered',
    paymentStatus: 'paid',
    fulfillmentStatus: 'fulfilled',
    trackingNumber: faker.string.alphanumeric(16).toUpperCase(),
    ...overrides,
  });
}

/**
 * Creates a cancelled order
 */
export function createFakeCancelledOrder(overrides?: Partial<FakeOrder>): FakeOrder {
  return createFakeOrder({
    status: 'cancelled',
    paymentStatus: 'refunded',
    ...overrides,
  });
}

/**
 * Creates an active product
 */
export function createFakeActiveProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return createFakeProduct({
    status: 'active',
    inventory: faker.number.int({ min: 10, max: 1000 }),
    ...overrides,
  });
}

/**
 * Creates an out-of-stock product
 */
export function createFakeOutOfStockProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return createFakeProduct({
    status: 'out_of_stock',
    inventory: 0,
    ...overrides,
  });
}

/**
 * Creates a draft product
 */
export function createFakeDraftProduct(overrides?: Partial<FakeProduct>): FakeProduct {
  return createFakeProduct({
    status: 'draft',
    ...overrides,
  });
}

/**
 * Creates an active user row
 */
export function createFakeActiveUserRow(overrides?: Partial<FakeUserTableRow>): FakeUserTableRow {
  return createFakeUserTableRow({
    status: 'active',
    lastActiveAt: faker.date.recent({ days: 1 }).toISOString(),
    ...overrides,
  });
}

/**
 * Creates a suspended user row
 */
export function createFakeSuspendedUserRow(
  overrides?: Partial<FakeUserTableRow>
): FakeUserTableRow {
  return createFakeUserTableRow({
    status: 'suspended',
    ...overrides,
  });
}

/**
 * Creates a pending user row
 */
export function createFakePendingUserRow(overrides?: Partial<FakeUserTableRow>): FakeUserTableRow {
  return createFakeUserTableRow({
    status: 'pending',
    lastActiveAt: faker.date.past().toISOString(),
    ...overrides,
  });
}

/**
 * Creates a completed transaction
 */
export function createFakeCompletedTransaction(
  overrides?: Partial<FakeTransaction>
): FakeTransaction {
  return createFakeTransaction({
    status: 'completed',
    ...overrides,
  });
}

/**
 * Creates a failed transaction
 */
export function createFakeFailedTransaction(overrides?: Partial<FakeTransaction>): FakeTransaction {
  return createFakeTransaction({
    status: 'failed',
    ...overrides,
  });
}

/**
 * Creates a refund transaction
 */
export function createFakeRefundTransaction(overrides?: Partial<FakeTransaction>): FakeTransaction {
  return createFakeTransaction({
    status: 'refunded',
    type: 'refund',
    ...overrides,
  });
}

/**
 * Creates an empty table response
 */
export function createFakeEmptyTableResponse(): FakeTableResponse {
  return {
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  };
}

/**
 * Creates a single page table response
 */
export function createFakeSinglePageTableResponse(count: number = 5): FakeTableResponse {
  return {
    data: createFakeTableData(count),
    pagination: {
      page: 1,
      limit: count,
      total: count,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
}

/**
 * Creates pagination at the first page
 */
export function createFakeFirstPagePagination(overrides?: Partial<FakePagination>): FakePagination {
  return createFakePagination({
    page: 1,
    hasPrev: false,
    hasNext: true,
    ...overrides,
  });
}

/**
 * Creates pagination at the last page
 */
export function createFakeLastPagePagination(overrides?: Partial<FakePagination>): FakePagination {
  const totalPages = overrides?.totalPages ?? 10;
  return createFakePagination({
    page: totalPages,
    totalPages,
    hasPrev: true,
    hasNext: false,
    ...overrides,
  });
}

/**
 * Creates a compact density table config
 */
export function createFakeCompactTableConfig(
  overrides?: Partial<FakeTableConfig>
): FakeTableConfig {
  return createFakeTableConfig({
    density: 'compact',
    ...overrides,
  });
}

/**
 * Creates a comfortable density table config
 */
export function createFakeComfortableTableConfig(
  overrides?: Partial<FakeTableConfig>
): FakeTableConfig {
  return createFakeTableConfig({
    density: 'comfortable',
    ...overrides,
  });
}

/**
 * Creates a striped table config
 */
export function createFakeStripedTableConfig(
  overrides?: Partial<FakeTableConfig>
): FakeTableConfig {
  return createFakeTableConfig({
    striped: true,
    ...overrides,
  });
}

/**
 * Creates a table config with selection enabled
 */
export function createFakeSelectableTableConfig(
  overrides?: Partial<FakeTableConfig>
): FakeTableConfig {
  return createFakeTableConfig({
    selectionMode: 'multiple',
    enableRowSelection: true,
    ...overrides,
  });
}

// ============================================================================
// MATRIX FACTORIES
// ============================================================================

/**
 * Creates a matrix of table rows across all statuses
 */
export function createFakeTableRowStatusMatrix(): Record<
  'active' | 'inactive' | 'pending',
  FakeTableRow
> {
  return {
    active: createFakeActiveTableRow(),
    inactive: createFakeInactiveTableRow(),
    pending: createFakePendingTableRow(),
  };
}

/**
 * Creates a matrix of table rows across all priorities
 */
export function createFakeTableRowPriorityMatrix(): Record<TableRowPriority, FakeTableRow> {
  const result = {} as Record<TableRowPriority, FakeTableRow>;

  for (const priority of TABLE_ROW_PRIORITIES) {
    result[priority] = createFakeTableRow({ priority });
  }

  return result;
}

/**
 * Creates a matrix of invoices across all statuses
 */
export function createFakeInvoiceStatusMatrix(): Record<InvoiceStatus, FakeInvoice> {
  const result = {} as Record<InvoiceStatus, FakeInvoice>;

  for (const status of INVOICE_STATUSES) {
    result[status] = createFakeInvoice({ status });
  }

  return result;
}

/**
 * Creates a matrix of orders across all statuses
 */
export function createFakeOrderStatusMatrix(): Record<OrderStatus, FakeOrder> {
  const result = {} as Record<OrderStatus, FakeOrder>;

  for (const status of ORDER_STATUSES) {
    result[status] = createFakeOrder({ status });
  }

  return result;
}

/**
 * Creates a matrix of products across all statuses
 */
export function createFakeProductStatusMatrix(): Record<ProductStatus, FakeProduct> {
  const result = {} as Record<ProductStatus, FakeProduct>;

  for (const status of PRODUCT_STATUSES) {
    result[status] = createFakeProduct({ status });
  }

  return result;
}

/**
 * Creates a matrix of user rows across all statuses
 */
export function createFakeUserTableStatusMatrix(): Record<UserTableStatus, FakeUserTableRow> {
  const result = {} as Record<UserTableStatus, FakeUserTableRow>;

  for (const status of USER_TABLE_STATUSES) {
    result[status] = createFakeUserTableRow({ status });
  }

  return result;
}

/**
 * Creates a matrix of transactions across all statuses
 */
export function createFakeTransactionStatusMatrix(): Record<TransactionStatus, FakeTransaction> {
  const result = {} as Record<TransactionStatus, FakeTransaction>;

  for (const status of TRANSACTION_STATUSES) {
    result[status] = createFakeTransaction({ status });
  }

  return result;
}

/**
 * Creates a matrix of table configs across all densities
 */
export function createFakeTableDensityMatrix(): Record<TableDensity, FakeTableConfig> {
  const result = {} as Record<TableDensity, FakeTableConfig>;

  for (const density of TABLE_DENSITIES) {
    result[density] = createFakeTableConfig({ density });
  }

  return result;
}

/**
 * Creates a matrix of table configs across all selection modes
 */
export function createFakeTableSelectionModeMatrix(): Record<SelectionMode, FakeTableConfig> {
  const result = {} as Record<SelectionMode, FakeTableConfig>;

  for (const selectionMode of SELECTION_MODES) {
    result[selectionMode] = createFakeTableConfig({ selectionMode });
  }

  return result;
}

/**
 * Creates a comprehensive table demo data set
 */
export function createFakeTableDemoData() {
  return {
    config: createFakeTableConfig(),
    rows: createFakeTableData(20),
    pagination: createFakePagination({ total: 100, page: 1, limit: 20 }),
    sort: createFakeTableSort(),
    filters: [createFakeTableFilter()],
    bulkActions: createFakeBulkActions(4),
    exportConfig: createFakeExportConfig(),
    invoices: createFakeInvoices(10),
    orders: createFakeOrders(10),
    products: createFakeProducts(10),
    users: createFakeUserTableRows(10),
    transactions: createFakeTransactions(10),
  };
}
