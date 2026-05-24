import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeInvoices,
  createFakePagination,
  createFakeTableData,
} from '../_factories/table.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_DATA = '/api/data';
const API_DATA_BY_ID = '/api/data/:id';
const API_INVOICES = '/api/invoices';

// Default success handlers
export const tableHandlers = [
  // GET /api/data
  http.get(API_DATA, async ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const sortBy = url.searchParams.get('sortBy');
    const order = url.searchParams.get('order') ?? 'asc';

    await delay(faker.number.int({ min: 300, max: 800 }));

    let data = createFakeTableData(limit);

    // Simulate sorting
    if (sortBy) {
      data = data.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a];
        const bVal = b[sortBy as keyof typeof b];
        return order === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return HttpResponse.json({
      data,
      pagination: createFakePagination({ page, limit }),
    });
  }),

  // GET /api/data/:id
  http.get(API_DATA_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const [row] = createFakeTableData(1);
    return HttpResponse.json({ ...row, id: params.id });
  }),

  // POST /api/data
  http.post(API_DATA, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 600 }));
    const [row] = createFakeTableData(1);
    return HttpResponse.json(
      { ...row, ...(body as object), id: faker.string.uuid() },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // PATCH /api/data/:id
  http.patch(API_DATA_BY_ID, async ({ request, params }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));
    const [row] = createFakeTableData(1);
    return HttpResponse.json({ ...row, ...(body as object), id: params.id });
  }),

  // DELETE /api/data/:id
  http.delete(API_DATA_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/invoices
  http.get(API_INVOICES, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json({
      invoices: createFakeInvoices(limit),
      total: faker.number.int({ min: 50, max: 200 }),
    });
  }),
];

// Status-specific handlers for stories
export const tableStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: tableHandlers,

  created: [
    http.post(API_DATA, async ({ request }) => {
      const body = await request.json();
      await delay(faker.number.int({ min: 300, max: 600 }));
      const [row] = createFakeTableData(1);
      return HttpResponse.json(
        { ...row, ...(body as object), id: faker.string.uuid() },
        { status: HTTP_STATUS.CREATED }
      );
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.table.invalidQueryParameters', 'Invalid query parameters'),
          API_DATA,
          {
            page: i18n.t('handler.table.mustBeAPositiveInteger', 'Must be a positive integer'),
            limit: i18n.t('handler.table.mustBeBetween1And', 'Must be between 1 and 100'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.post(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_DATA',
          i18n.t('handler.table.requestBodyIsMalformed', 'Request body is malformed'),
          API_DATA
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.table.authenticationRequired', 'Authentication required'),
          API_DATA
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.table.accessDeniedToThisDataset', 'Access denied to this dataset'),
          API_DATA
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_DATA_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.table.cannotDeleteProtectedRecords', 'Cannot delete protected records'),
          API_DATA_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_DATA_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Record ${params.id} not found`,
          `/api/data/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.delete(API_DATA_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          `Record ${params.id} does not exist`,
          `/api/data/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DUPLICATE',
          i18n.t('handler.table.aRecordWithThisKey', 'A record with this key already exists'),
          API_DATA,
          {
            existingId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.table.dataValidationFailed', 'Data validation failed'),
          API_DATA,
          {
            name: i18n.t('handler.table.nameIsRequired', 'Name is required'),
            email: i18n.t('handler.table.invalidEmailFormat', 'Invalid email format'),
            amount: i18n.t('handler.table.mustBeAPositiveNumber', 'Must be a positive number'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_DATA, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.table.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_DATA,
          {
            limit: '1000/hour',
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
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.table.databaseQueryFailed', 'Database query failed'),
          API_DATA,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.table.dataServiceUnavailable', 'Data service unavailable'),
          API_DATA
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.table.databaseMaintenanceInProgress', 'Database maintenance in progress'),
          API_DATA,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.table.databaseQueryTimedOut', 'Database query timed out'),
          API_DATA
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_DATA, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_DATA, async () => {
      await delay(5000);
      return HttpResponse.json({
        data: createFakeTableData(10),
        pagination: createFakePagination({ page: 1, limit: 10 }),
      });
    }),
  ],

  networkError: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });
    }),
  ],

  partialData: [
    http.get(API_DATA, async () => {
      await delay(300);
      return HttpResponse.json({
        data: createFakeTableData(3),
        pagination: createFakePagination({ page: 1, limit: 10, total: 3 }),
        warning: i18n.t('handler.table.someRecordsCouldNotBe', 'Some records could not be loaded'),
      });
    }),
  ],
};
