import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT SCROLL BUTTON HANDLERS
// Enterprise-grade MSW handlers for scroll button component
// ============================================================================

// API Endpoints
const API_SCROLL = '/api/scroll';
const API_SCROLL_POSITION = '/api/scroll/position';
const API_SCROLL_TO = '/api/scroll/to';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptScrollButtonHandlers = [
  http.get(API_SCROLL_POSITION, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({
      scrollTop: faker.number.int({ min: 0, max: 5000 }),
      scrollHeight: faker.number.int({ min: 5000, max: 10_000 }),
      clientHeight: faker.number.int({ min: 500, max: 1000 }),
      isAtBottom: faker.datatype.boolean(),
    });
  }),

  http.post(API_SCROLL_TO, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { position: 'bottom' | 'top' | number };
    return HttpResponse.json({
      success: true,
      scrolledTo: body.position,
      timestamp: new Date().toISOString(),
    });
  }),

  http.get(API_SCROLL, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0' });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptScrollButtonStatusHandlers = {
  success: promptScrollButtonHandlers,
  badRequest: [
    http.post(API_SCROLL_TO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_POSITION',
          i18n.t('handler.promptScrollButton.invalidScrollPosition', 'Invalid scroll position'),
          API_SCROLL_TO
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.get(API_SCROLL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.promptScrollButton.authenticationRequired', 'Authentication required'),
          API_SCROLL
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SCROLL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.promptScrollButton.accessDeniedToThisResource',
            'Access denied to this resource'
          ),
          API_SCROLL
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptScrollButton.scrollPositionNotFound', 'Scroll position not found'),
          API_SCROLL_POSITION
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_SCROLL_TO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SCROLL_CONFLICT',
          i18n.t('handler.promptScrollButton.scrollOperationConflict', 'Scroll operation conflict'),
          API_SCROLL_TO
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_SCROLL_TO, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.promptScrollButton.tooManyScrollRequests', 'Too many scroll requests'),
          API_SCROLL_TO,
          {
            limit: '100/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_SCROLL, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptScrollButton.requestValidationFailed', 'Request validation failed'),
          API_SCROLL,
          {
            field: 'data',
            error: i18n.t('handler.promptScrollButton.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.promptScrollButton.failedToGetScrollPosition',
            'Failed to get scroll position'
          ),
          API_SCROLL_POSITION
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.promptScrollButton.scrollServiceUnavailable',
            'Scroll service unavailable'
          ),
          API_SCROLL_POSITION
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptScrollButton.scrollServiceIsUnderMaintenance',
            'Scroll service is under maintenance'
          ),
          API_SCROLL_POSITION,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.promptScrollButton.scrollRequestTimedOut', 'Scroll request timed out'),
          API_SCROLL_POSITION
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  loading: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  slowResponse: [
    http.get(API_SCROLL_POSITION, async () => {
      await delay(5000);
      return HttpResponse.json({
        scrollTop: 0,
        scrollHeight: 5000,
        clientHeight: 500,
        isAtBottom: false,
      });
    }),
  ],
  networkError: [http.get(API_SCROLL_POSITION, () => HttpResponse.error())],
};
