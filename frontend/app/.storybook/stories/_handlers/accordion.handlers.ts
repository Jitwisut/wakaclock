import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeAccordionItems } from '../_factories/accordion.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_ACCORDION_ITEMS = '/api/accordion-items';

// Default success handlers
export const accordionHandlers = [
  // GET /api/accordion-items
  http.get(API_ACCORDION_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 5);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const items = createFakeAccordionItems(limit);
    return HttpResponse.json({
      items,
      total: items.length,
    });
  }),
];

// Status-specific handlers for stories
export const accordionStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: accordionHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.accordion.invalidQueryParameters', 'Invalid query parameters'),
          API_ACCORDION_ITEMS,
          {
            limit: i18n.t('handler.accordion.mustBeAPositiveInteger', 'Must be a positive integer'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.accordion.authenticationRequired', 'Authentication required'),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.accordion.accessDeniedToAccordionData',
            'Access denied to accordion data'
          ),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.accordion.accordionItemsNotFound', 'Accordion items not found'),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.accordion.accordionDataConflictDetected',
            'Accordion data conflict detected'
          ),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.accordion.requestValidationFailedForAccordion',
            'Request validation failed for accordion data'
          ),
          API_ACCORDION_ITEMS,
          {
            field: 'items',
            error: i18n.t(
              'handler.accordion.invalidAccordionItemFormat',
              'Invalid accordion item format'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.accordion.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_ACCORDION_ITEMS,
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
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.accordion.failedToFetchAccordionData', 'Failed to fetch accordion data'),
          API_ACCORDION_ITEMS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.accordion.accordionServiceUnavailable', 'Accordion service unavailable'),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.accordion.accordionServiceUnderMaintenance',
            'Accordion service under maintenance'
          ),
          API_ACCORDION_ITEMS,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.accordion.accordionServiceTimedOut', 'Accordion service timed out'),
          API_ACCORDION_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(5000);
      return HttpResponse.json({
        items: createFakeAccordionItems(5),
        total: 5,
      });
    }),
  ],

  networkError: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_ACCORDION_ITEMS, async () => {
      await delay(300);
      return HttpResponse.json({
        items: [],
        total: 0,
      });
    }),
  ],
};
