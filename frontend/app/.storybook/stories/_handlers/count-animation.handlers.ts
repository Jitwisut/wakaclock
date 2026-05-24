import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// COUNT ANIMATION HANDLERS
// Enterprise-grade MSW handlers for count animation component
// ============================================================================

// API Endpoints
const API_COUNT = '/api/count';
const API_COUNT_VALUE = '/api/count/value';
const API_COUNT_CONFIG = '/api/count/config';

// Types
interface CountConfig {
  decimals: number;
  delay: number;
  duration: number;
  easing: 'easeIn' | 'easeInOut' | 'easeOut' | 'linear';
  separator: string;
}

interface CountValue {
  previousValue: number;
  timestamp: string;
  value: number;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const countAnimationHandlers = [
  http.get(API_COUNT_VALUE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const value: CountValue = {
      value: faker.number.int({ min: 1000, max: 100_000 }),
      previousValue: faker.number.int({ min: 500, max: 5000 }),
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json(value);
  }),

  http.get(API_COUNT_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const config: CountConfig = {
      duration: 2000,
      delay: 0,
      easing: 'easeOut',
      separator: ',',
      decimals: 0,
    };
    return HttpResponse.json(config);
  }),

  http.put(API_COUNT_CONFIG, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const body = (await request.json()) as Partial<CountConfig>;
    return HttpResponse.json({ success: true, config: body, updatedAt: new Date().toISOString() });
  }),

  http.get(API_COUNT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0' });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const countAnimationStatusHandlers = {
  success: countAnimationHandlers,
  badRequest: [
    http.put(API_COUNT_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONFIG',
          i18n.t('handler.countAnimation.invalidCountConfiguration', 'Invalid count configuration'),
          API_COUNT_CONFIG
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.put(API_COUNT_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.countAnimation.authenticationRequired', 'Authentication required'),
          API_COUNT_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.put(API_COUNT_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'CONFIG_LOCKED',
          i18n.t('handler.countAnimation.configurationIsLocked', 'Configuration is locked'),
          API_COUNT_CONFIG
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.countAnimation.countValueNotFound', 'Count value not found'),
          API_COUNT_VALUE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.put(API_COUNT_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFIG_CONFLICT',
          i18n.t(
            'handler.countAnimation.configurationConflictDetected',
            'Configuration conflict detected'
          ),
          API_COUNT_CONFIG
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.countAnimation.tooManyCountRequests', 'Too many count requests'),
          API_COUNT_VALUE,
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
    http.get(API_COUNT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.countAnimation.requestValidationFailed', 'Request validation failed'),
          API_COUNT,
          {
            field: 'data',
            error: i18n.t('handler.countAnimation.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.countAnimation.failedToLoadCount', 'Failed to load count'),
          API_COUNT_VALUE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.countAnimation.countServiceUnavailable', 'Count service unavailable'),
          API_COUNT_VALUE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.countAnimation.countServiceIsUnderMaintenance',
            'Count service is under maintenance'
          ),
          API_COUNT_VALUE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.countAnimation.countRequestTimedOut', 'Count request timed out'),
          API_COUNT_VALUE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(5000);
      return HttpResponse.json({
        value: faker.number.int({ min: 1000, max: 100_000 }),
        previousValue: faker.number.int({ min: 500, max: 5000 }),
        timestamp: new Date().toISOString(),
      });
    }),
  ],
  loading: [
    http.get(API_COUNT_VALUE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_COUNT_VALUE, () => HttpResponse.error())],
  emptyData: [
    http.get(API_COUNT_VALUE, async () => {
      await delay(100);
      return HttpResponse.json(null);
    }),
  ],
};
