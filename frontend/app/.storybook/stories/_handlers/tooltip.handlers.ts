import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeTooltip } from '../_factories/tooltip.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOOLTIP_CONTENT = '/api/tooltip-content/:id';

// Default success handlers
export const tooltipHandlers = [
  // GET /api/tooltip-content/:id
  http.get(API_TOOLTIP_CONTENT, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));
    const tooltip = createFakeTooltip({ id: params.id as string });
    return HttpResponse.json(tooltip);
  }),
];

// Status-specific handlers for stories
export const tooltipStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: tooltipHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ID',
          i18n.t('handler.tooltip.invalidTooltipIdFormat', 'Invalid tooltip ID format'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.tooltip.authenticationRequired', 'Authentication required'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.tooltip.accessDeniedToTooltipContent',
            'Access denied to tooltip content'
          ),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.tooltip.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_TOOLTIP_CONTENT,
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

  notFound: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.tooltip.tooltipNotFound', 'Tooltip not found'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t('handler.tooltip.tooltipStateConflict', 'Tooltip state conflict'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.tooltip.unableToProcessTooltip', 'Unable to process tooltip'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.tooltip.failedToFetchTooltipContent', 'Failed to fetch tooltip content'),
          API_TOOLTIP_CONTENT,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.tooltip.tooltipServiceUnavailable', 'Tooltip service unavailable'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.tooltip.tooltipServiceUnderMaintenance',
            'Tooltip service under maintenance'
          ),
          API_TOOLTIP_CONTENT,
          {
            retryAfter: '600',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.tooltip.tooltipServiceTimedOut', 'Tooltip service timed out'),
          API_TOOLTIP_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(5000);
      const tooltip = createFakeTooltip();
      return HttpResponse.json(tooltip);
    }),
  ],

  networkError: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOOLTIP_CONTENT, async () => {
      await delay(300);
      return HttpResponse.json({
        id: faker.string.uuid(),
        content: '',
        side: 'top',
        align: 'center',
      });
    }),
  ],
};
