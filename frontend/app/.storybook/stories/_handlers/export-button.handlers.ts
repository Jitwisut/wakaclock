import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// EXPORT BUTTON HANDLERS
// Enterprise-grade MSW handlers for export button component
// ============================================================================

// API Endpoints
const API_EXPORT = '/api/export';
const API_EXPORT_EXCEL = '/api/export/excel';
const API_EXPORT_PDF = '/api/export/pdf';
const API_EXPORT_STATUS = '/api/export/status';

// Types
interface ExportResult {
  downloadUrl: string;
  expiresAt: string;
  filename: string;
  format: 'excel' | 'pdf';
  id: string;
  size: number;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const exportButtonHandlers = [
  http.post(API_EXPORT_EXCEL, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1500 }));
    const body = (await request.json()) as { data?: unknown; filename?: string };
    const result: ExportResult = {
      id: faker.string.uuid(),
      format: 'excel',
      filename: body.filename || `export-${Date.now()}.xlsx`,
      downloadUrl: faker.internet.url(),
      size: faker.number.int({ min: 10_000, max: 500_000 }),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    return HttpResponse.json(result);
  }),

  http.post(API_EXPORT_PDF, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 2000 }));
    const body = (await request.json()) as { data?: unknown; filename?: string };
    const result: ExportResult = {
      id: faker.string.uuid(),
      format: 'pdf',
      filename: body.filename || `export-${Date.now()}.pdf`,
      downloadUrl: faker.internet.url(),
      size: faker.number.int({ min: 50_000, max: 2_000_000 }),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    return HttpResponse.json(result);
  }),

  http.get(API_EXPORT_STATUS, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const exportId = url.searchParams.get('id');
    return HttpResponse.json({
      id: exportId,
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      progress: faker.number.int({ min: 0, max: 100 }),
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(API_EXPORT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      supportedFormats: ['excel', 'pdf'],
      maxSize: 10_000_000,
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const exportButtonStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: exportButtonHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.exportButton.invalidExportDataProvided', 'Invalid export data provided'),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.exportButton.authenticationRequiredForExport',
            'Authentication required for export'
          ),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.exportButton.youDoNotHavePermission',
            'You do not have permission to export'
          ),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.exportButton.exportResourceNotFound', 'Export resource not found'),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'EXPORT_IN_PROGRESS',
          i18n.t('handler.exportButton.anExportIsAlreadyIn', 'An export is already in progress'),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.exportButton.exportDataValidationFailed',
            'Export data validation failed'
          ),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.exportButton.tooManyExportRequests', 'Too many export requests'),
          API_EXPORT_EXCEL,
          {
            limit: '10/hour',
            remaining: '0',
            resetAt: new Date(Date.now() + 3_600_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'EXPORT_FAILED',
          i18n.t('handler.exportButton.failedToGenerateExport', 'Failed to generate export'),
          API_EXPORT_EXCEL,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.exportButton.exportServiceUnavailable', 'Export service unavailable'),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.exportButton.exportServiceIsUnderMaintenance',
            'Export service is under maintenance'
          ),
          API_EXPORT_EXCEL,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.exportButton.exportRequestTimedOut', 'Export request timed out'),
          API_EXPORT_EXCEL
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(5000);
      return HttpResponse.json({
        id: faker.string.uuid(),
        format: 'excel',
        filename: `export-${Date.now()}.xlsx`,
        downloadUrl: faker.internet.url(),
        size: faker.number.int({ min: 10_000, max: 500_000 }),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  // ============ EXPORT-SPECIFIC HANDLERS ============
  pdfSuccess: [
    http.post(API_EXPORT_PDF, async () => {
      await delay(1500);
      return HttpResponse.json({
        id: faker.string.uuid(),
        format: 'pdf',
        filename: `export-${Date.now()}.pdf`,
        downloadUrl: faker.internet.url(),
        size: faker.number.int({ min: 50_000, max: 2_000_000 }),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
    }),
  ],

  pdfError: [
    http.post(API_EXPORT_PDF, async () => {
      await delay(500);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'PDF_GENERATION_FAILED',
          i18n.t('handler.exportButton.failedToGeneratePdf', 'Failed to generate PDF'),
          API_EXPORT_PDF
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  largDataWarning: [
    http.post(API_EXPORT_EXCEL, async () => {
      await delay(300);
      return HttpResponse.json(
        {
          warning: true,
          message: i18n.t(
            'handler.exportButton.largeDatasetDetectedExportMay',
            'Large dataset detected. Export may take longer.'
          ),
          estimatedTime: '5 minutes',
        },
        { status: 202 }
      );
    }),
  ],
};
