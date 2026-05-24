import { faker } from '@faker-js/faker';
import i18n from 'i18next';

// =============================================================================
// SHARED STRING CONSTANTS
// =============================================================================

const LABEL_EXCEL = i18n.t('factory.exportButton.excel', 'Excel');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Export format type
 */
export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

/**
 * Export status
 */
export type ExportStatus = 'completed' | 'error' | 'idle' | 'pending' | 'processing';

/**
 * Export file size category
 */
export type ExportSizeCategory = 'large' | 'medium' | 'small' | 'very-large';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All export formats
 */
export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'excel', 'json', 'pdf'];

/**
 * All export statuses
 */
export const EXPORT_STATUSES: ExportStatus[] = [
  'completed',
  'error',
  'idle',
  'pending',
  'processing',
];

/**
 * All size categories
 */
export const EXPORT_SIZE_CATEGORIES: ExportSizeCategory[] = [
  'large',
  'medium',
  'small',
  'very-large',
];

const LABEL_CSV = i18n.t('factory.exportButton.csv', 'CSV');
const LABEL_JSON = i18n.t('factory.exportButton.json', 'JSON');
const LABEL_PDF = i18n.t('factory.exportButton.pdf', 'PDF');

/**
 * Export format labels
 */
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: LABEL_CSV,
  excel: LABEL_EXCEL,
  json: LABEL_JSON,
  pdf: LABEL_PDF,
};

/**
 * Export format icons
 */
export const EXPORT_FORMAT_ICONS: Record<ExportFormat, string> = {
  csv: 'FileSpreadsheet',
  excel: 'FileSpreadsheet',
  json: 'FileJson',
  pdf: 'FileText',
};

/**
 * Export format MIME types
 */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  pdf: 'application/pdf',
};

/**
 * Export format file extensions
 */
export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: '.csv',
  excel: '.xlsx',
  json: '.json',
  pdf: '.pdf',
};

/**
 * Size ranges in bytes
 */
export const EXPORT_SIZE_RANGES: Record<ExportSizeCategory, { max: number; min: number }> = {
  large: { max: 10_000_000, min: 1_000_000 },
  medium: { max: 1_000_000, min: 100_000 },
  small: { max: 100_000, min: 1000 },
  'very-large': { max: 100_000_000, min: 10_000_000 },
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Export button labels for i18n
 */
export interface FakeExportLabels {
  button: string;
  csv?: string;
  excel: string;
  json?: string;
  pdf: string;
}

/**
 * Export button configuration
 */
export interface FakeExportButton {
  disabled: boolean;
  formats: ExportFormat[];
  id: string;
  labels: FakeExportLabels;
  loading: boolean;
}

/**
 * Export result
 */
export interface FakeExportResult {
  downloadUrl: string;
  expiresAt: Date;
  filename: string;
  format: ExportFormat;
  id: string;
  size: number;
  status: ExportStatus;
}

/**
 * Export request
 */
export interface FakeExportRequest {
  columns?: string[];
  data?: unknown[];
  filename?: string;
  format: ExportFormat;
  id: string;
  includeHeaders?: boolean;
  timestamp: Date;
}

/**
 * Export progress
 */
export interface FakeExportProgress {
  currentRow: number;
  estimatedTimeRemaining: number;
  id: string;
  progress: number;
  status: ExportStatus;
  totalRows: number;
}

/**
 * Export history item
 */
export interface FakeExportHistoryItem {
  completedAt?: Date;
  downloadCount: number;
  expiresAt?: Date;
  filename: string;
  format: ExportFormat;
  id: string;
  size: number;
  startedAt: Date;
  status: ExportStatus;
}

/**
 * Export configuration
 */
export interface FakeExportConfig {
  allowedFormats: ExportFormat[];
  id: string;
  maxFileSize: number;
  maxRows: number;
  rateLimitPerHour: number;
}

/**
 * Export button showcase
 */
export interface FakeExportButtonShowcase {
  buttons: FakeExportButton[];
  configs: FakeExportConfig[];
  history: FakeExportHistoryItem[];
  results: FakeExportResult[];
}

// =============================================================================
// FACTORY FUNCTIONS - Labels
// =============================================================================

/**
 * Create export labels in English
 */
export function createFakeExportLabelsEn(): FakeExportLabels {
  return {
    button: i18n.t('factory.exportButton.export', 'Export'),
    csv: LABEL_CSV,
    excel: LABEL_EXCEL,
    json: LABEL_JSON,
    pdf: LABEL_PDF,
  };
}

/**
 * Create export labels in Japanese
 */
export function createFakeExportLabelsJa(): FakeExportLabels {
  return {
    button: 'エクスポート',
    csv: LABEL_CSV,
    excel: LABEL_EXCEL,
    json: LABEL_JSON,
    pdf: LABEL_PDF,
  };
}

/**
 * Create random export labels
 */
export function createFakeExportLabels(): FakeExportLabels {
  return {
    button: faker.helpers.arrayElement([
      i18n.t('factory.exportButton.export', 'Export'),
      i18n.t('factory.exportButton.download', 'Download'),
      i18n.t('factory.exportButton.save', 'Save'),
      i18n.t('factory.exportButton.getFile', 'Get File'),
    ]),
    csv: faker.helpers.arrayElement([
      LABEL_CSV,
      i18n.t('factory.exportButton.commaSeparated', 'Comma Separated'),
    ]),
    excel: faker.helpers.arrayElement([
      LABEL_EXCEL,
      i18n.t('factory.exportButton.spreadsheet', 'Spreadsheet'),
      'XLSX',
    ]),
    json: faker.helpers.arrayElement([
      LABEL_JSON,
      i18n.t('factory.exportButton.dataFile', 'Data File'),
    ]),
    pdf: faker.helpers.arrayElement([
      LABEL_PDF,
      i18n.t('factory.exportButton.document', 'Document'),
      i18n.t('factory.exportButton.report', 'Report'),
    ]),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Export Button
// =============================================================================

/**
 * Create a fake export button configuration
 */
export function createFakeExportButton(overrides?: Partial<FakeExportButton>): FakeExportButton {
  return {
    disabled: faker.datatype.boolean({ probability: 0.1 }),
    formats: faker.helpers.arrayElements(EXPORT_FORMATS, { max: 4, min: 1 }),
    id: faker.string.uuid(),
    labels: createFakeExportLabelsEn(),
    loading: faker.datatype.boolean({ probability: 0.1 }),
    ...overrides,
  };
}

/**
 * Create multiple export buttons
 */
export function createFakeExportButtons(count: number): FakeExportButton[] {
  return Array.from({ length: count }, () => createFakeExportButton());
}

/**
 * Create a disabled export button
 */
export function createFakeExportButtonDisabled(): FakeExportButton {
  return createFakeExportButton({ disabled: true, loading: false });
}

/**
 * Create a loading export button
 */
export function createFakeExportButtonLoading(): FakeExportButton {
  return createFakeExportButton({ disabled: false, loading: true });
}

/**
 * Create an export button with only Excel and PDF
 */
export function createFakeExportButtonStandard(): FakeExportButton {
  return createFakeExportButton({
    formats: ['excel', 'pdf'],
    labels: createFakeExportLabelsEn(),
  });
}

// =============================================================================
// FACTORY FUNCTIONS - Export Result
// =============================================================================

/**
 * Create a fake export result
 */
export function createFakeExportResult(overrides?: Partial<FakeExportResult>): FakeExportResult {
  const format = overrides?.format ?? faker.helpers.arrayElement(EXPORT_FORMATS);
  const status = overrides?.status ?? faker.helpers.arrayElement(EXPORT_STATUSES);

  return {
    downloadUrl: faker.internet.url(),
    expiresAt: faker.date.soon({ days: 1 }),
    filename: `export-${faker.string.alphanumeric(8)}${EXPORT_EXTENSIONS[format]}`,
    format,
    id: faker.string.uuid(),
    size: faker.number.int({ max: 5_000_000, min: 1000 }),
    status,
    ...overrides,
  };
}

/**
 * Create multiple export results
 */
export function createFakeExportResults(count: number): FakeExportResult[] {
  return Array.from({ length: count }, () => createFakeExportResult());
}

/**
 * Create a successful export result
 */
export function createFakeExportResultSuccess(format: ExportFormat = 'excel'): FakeExportResult {
  return createFakeExportResult({ format, status: 'completed' });
}

/**
 * Create a failed export result
 */
export function createFakeExportResultError(format: ExportFormat = 'excel'): FakeExportResult {
  return createFakeExportResult({ format, status: 'error' });
}

/**
 * Create a processing export result
 */
export function createFakeExportResultProcessing(format: ExportFormat = 'excel'): FakeExportResult {
  return createFakeExportResult({ format, status: 'processing' });
}

// =============================================================================
// FACTORY FUNCTIONS - Export Request
// =============================================================================

/**
 * Create a fake export request
 */
export function createFakeExportRequest(overrides?: Partial<FakeExportRequest>): FakeExportRequest {
  const format = overrides?.format ?? faker.helpers.arrayElement(EXPORT_FORMATS);

  return {
    columns: faker.helpers.maybe(
      () => Array.from({ length: faker.number.int({ max: 10, min: 3 }) }, () => faker.word.noun()),
      { probability: 0.5 }
    ),
    filename: `export-${faker.string.alphanumeric(8)}${EXPORT_EXTENSIONS[format]}`,
    format,
    id: faker.string.uuid(),
    includeHeaders: faker.datatype.boolean({ probability: 0.9 }),
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple export requests
 */
export function createFakeExportRequests(count: number): FakeExportRequest[] {
  return Array.from({ length: count }, () => createFakeExportRequest());
}

// =============================================================================
// FACTORY FUNCTIONS - Export Progress
// =============================================================================

/**
 * Create a fake export progress
 */
export function createFakeExportProgress(
  overrides?: Partial<FakeExportProgress>
): FakeExportProgress {
  const totalRows = overrides?.totalRows ?? faker.number.int({ max: 100_000, min: 100 });
  const progress = overrides?.progress ?? faker.number.int({ max: 100, min: 0 });
  const currentRow = Math.floor((progress / 100) * totalRows);

  const getStatus = (): FakeExportProgress['status'] => {
    if (progress === 100) return 'completed';
    if (progress > 0) return 'processing';
    return 'pending';
  };

  return {
    currentRow,
    estimatedTimeRemaining: Math.floor((100 - progress) * 0.5),
    id: faker.string.uuid(),
    progress,
    status: getStatus(),
    totalRows,
    ...overrides,
  };
}

/**
 * Create export progress at specific percentage
 */
export function createFakeExportProgressAt(progress: number): FakeExportProgress {
  return createFakeExportProgress({ progress: Math.min(100, Math.max(0, progress)) });
}

// =============================================================================
// FACTORY FUNCTIONS - Export History
// =============================================================================

/**
 * Create a fake export history item
 */
export function createFakeExportHistoryItem(
  overrides?: Partial<FakeExportHistoryItem>
): FakeExportHistoryItem {
  const format = overrides?.format ?? faker.helpers.arrayElement(EXPORT_FORMATS);
  const status = overrides?.status ?? faker.helpers.arrayElement(EXPORT_STATUSES);
  const startedAt = overrides?.startedAt ?? faker.date.recent({ days: 7 });

  return {
    completedAt:
      status === 'completed' ? faker.date.between({ from: startedAt, to: new Date() }) : undefined,
    downloadCount: faker.number.int({ max: 10, min: 0 }),
    expiresAt: status === 'completed' ? faker.date.soon({ days: 1 }) : undefined,
    filename: `export-${faker.string.alphanumeric(8)}${EXPORT_EXTENSIONS[format]}`,
    format,
    id: faker.string.uuid(),
    size: faker.number.int({ max: 5_000_000, min: 1000 }),
    startedAt,
    status,
    ...overrides,
  };
}

/**
 * Create multiple export history items
 */
export function createFakeExportHistory(count: number): FakeExportHistoryItem[] {
  return Array.from({ length: count }, () => createFakeExportHistoryItem());
}

// =============================================================================
// FACTORY FUNCTIONS - Export Config
// =============================================================================

/**
 * Create a fake export configuration
 */
export function createFakeExportConfig(overrides?: Partial<FakeExportConfig>): FakeExportConfig {
  return {
    allowedFormats: faker.helpers.arrayElements(EXPORT_FORMATS, { max: 4, min: 1 }),
    id: faker.string.uuid(),
    maxFileSize: faker.helpers.arrayElement([10_000_000, 50_000_000, 100_000_000]),
    maxRows: faker.helpers.arrayElement([10_000, 50_000, 100_000, 500_000]),
    rateLimitPerHour: faker.helpers.arrayElement([10, 25, 50, 100]),
    ...overrides,
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Showcase
// =============================================================================

/**
 * Create a comprehensive export button showcase
 */
export function createFakeExportButtonShowcase(): FakeExportButtonShowcase {
  return {
    buttons: [
      createFakeExportButtonStandard(),
      createFakeExportButtonDisabled(),
      createFakeExportButtonLoading(),
    ],
    configs: [createFakeExportConfig()],
    history: createFakeExportHistory(5),
    results: createFakeExportResults(3),
  };
}

// =============================================================================
// FACTORY FUNCTIONS - Specific Use Cases
// =============================================================================

/**
 * Create an export button for data tables
 */
export function createFakeDataTableExportButton(): FakeExportButton {
  return createFakeExportButton({
    formats: ['csv', 'excel', 'json'],
    labels: {
      button: i18n.t('factory.exportButton.exportData', 'Export Data'),
      csv: i18n.t('factory.exportButton.csvCommaSeparated', 'CSV (Comma Separated)'),
      excel: i18n.t('factory.exportButton.excelSpreadsheet', 'Excel Spreadsheet'),
      json: i18n.t('factory.exportButton.jsonData', 'JSON Data'),
      pdf: i18n.t('factory.exportButton.pdfDocument', 'PDF Document'),
    },
  });
}

/**
 * Create an export button for reports
 */
export function createFakeReportExportButton(): FakeExportButton {
  return createFakeExportButton({
    formats: ['pdf', 'excel'],
    labels: {
      button: i18n.t('factory.exportButton.downloadReport', 'Download Report'),
      excel: i18n.t('factory.exportButton.excelReport', 'Excel Report'),
      pdf: i18n.t('factory.exportButton.pdfReport', 'PDF Report'),
    },
  });
}

/**
 * Create an export button for invoices
 */
export function createFakeInvoiceExportButton(): FakeExportButton {
  return createFakeExportButton({
    formats: ['pdf'],
    labels: {
      button: i18n.t('factory.exportButton.downloadInvoice', 'Download Invoice'),
      excel: LABEL_EXCEL,
      pdf: i18n.t('factory.exportButton.pdfInvoice', 'PDF Invoice'),
    },
  });
}
