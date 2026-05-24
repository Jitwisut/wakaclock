import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_LABELS = '/api/labels';
const API_LABEL_CREATE = '/api/labels/create';
const API_LABEL_UPDATE = '/api/labels/:id';

// Default success handlers
export const labelHandlers = [
  // GET /api/labels - Get all labels
  http.get(API_LABELS, async ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    await delay(faker.number.int({ min: 100, max: 300 }));

    const labels = Array.from({ length: faker.number.int({ min: 5, max: 15 }) }, () => ({
      id: faker.string.uuid(),
      name: faker.word.noun(),
      color: faker.color.rgb({ format: 'hex' }),
      category: faker.helpers.arrayElement(['status', 'priority', 'type', 'custom']),
      count: faker.number.int({ min: 0, max: 100 }),
    }));

    const filtered = category ? labels.filter((l) => l.category === category) : labels;

    return HttpResponse.json({
      labels: filtered,
      total: filtered.length,
    });
  }),

  // POST /api/labels/create - Create new label
  http.post(API_LABEL_CREATE, async ({ request }) => {
    const body = (await request.json()) as { category?: string; color?: string; name: string };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      label: {
        id: faker.string.uuid(),
        name: body.name,
        color: body.color ?? faker.color.rgb({ format: 'hex' }),
        category: body.category ?? 'custom',
        count: 0,
        createdAt: new Date().toISOString(),
      },
    });
  }),

  // PATCH /api/labels/:id - Update label
  http.patch(API_LABEL_UPDATE, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Partial<{ color: string; name: string }>;
    await delay(faker.number.int({ min: 150, max: 300 }));

    return HttpResponse.json({
      success: true,
      label: {
        id,
        name: body.name ?? faker.word.noun(),
        color: body.color ?? faker.color.rgb({ format: 'hex' }),
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  // DELETE /api/labels/:id - Delete label
  http.delete(API_LABEL_UPDATE, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 150, max: 300 }));

    return HttpResponse.json({
      success: true,
      deletedId: id,
      deletedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const labelStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: labelHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_LABEL',
          i18n.t('handler.label.invalidLabelData', 'Invalid label data'),
          API_LABEL_CREATE,
          { name: i18n.t('handler.label.labelNameIsRequired', 'Label name is required') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  conflict: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'LABEL_EXISTS',
          i18n.t('handler.label.aLabelWithThisName', 'A label with this name already exists'),
          API_LABEL_CREATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  notFound: [
    http.patch(API_LABEL_UPDATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'LABEL_NOT_FOUND',
          i18n.t('handler.label.labelNotFound', 'Label not found'),
          API_LABEL_UPDATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unauthorized: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.label.authenticationRequired', 'Authentication required'),
          API_LABEL_CREATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.label.youDoNotHavePermission',
            'You do not have permission to create labels'
          ),
          API_LABEL_CREATE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.label.labelValidationFailed', 'Label validation failed'),
          API_LABEL_CREATE,
          {
            name: i18n.t('handler.label.nameMustBe3To50Characters', 'Name must be 3-50 characters'),
            color: i18n.t('handler.label.invalidHexColorFormat', 'Invalid hex color format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.label.tooManyLabelCreationRequests',
            'Too many label creation requests. Please try again later.'
          ),
          API_LABEL_CREATE,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.label.failedToFetchLabels', 'Failed to fetch labels'),
          API_LABELS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.label.labelServiceTemporarilyUnavailable',
            'Label service temporarily unavailable'
          ),
          API_LABELS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.label.labelServiceIsUnderMaintenance',
            'Label service is under maintenance'
          ),
          API_LABELS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.label.labelServiceRequestTimedOut', 'Label service request timed out'),
          API_LABELS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_LABELS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  networkError: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyLabels: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json({
        labels: [],
        total: 0,
      });
    }),
  ],

  slowResponse: [
    http.get(API_LABELS, async () => {
      await delay(4000);
      return HttpResponse.json({
        labels: [
          {
            id: 'slow-1',
            name: i18n.t('handler.label.slowLabel', 'Slow Label'),
            color: '#FF5722',
            category: 'status',
            count: 1,
          },
        ],
        total: 1,
      });
    }),
  ],

  slowSubmission: [
    http.post(API_LABEL_CREATE, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        label: {
          id: faker.string.uuid(),
          name: i18n.t('handler.label.slowlyCreatedLabel', 'Slowly Created Label'),
          color: '#4CAF50',
          category: 'custom',
          count: 0,
          createdAt: new Date().toISOString(),
        },
      });
    }),
  ],

  emptyData: [
    http.get(API_LABELS, async () => {
      await delay(200);
      return HttpResponse.json({
        labels: [],
        total: 0,
      });
    }),
  ],
};
