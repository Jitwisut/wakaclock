import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SEPARATOR_CONFIG = '/api/separator/config';
const API_SEPARATOR_SECTIONS = '/api/separator/sections';
const API_SEPARATOR_SAVE = '/api/separator/save';

// Default success handlers
export const separatorHandlers = [
  // GET /api/separator/config - Get separator configuration
  http.get(API_SEPARATOR_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const layoutId = url.searchParams.get('layoutId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      layoutId,
      orientation: faker.helpers.arrayElement(['horizontal', 'vertical']),
      decorative: faker.datatype.boolean({ probability: 0.7 }),
      thickness: faker.helpers.arrayElement([1, 2, 4]),
      color: faker.helpers.arrayElement(['default', 'muted', 'accent']),
      spacing: faker.helpers.arrayElement(['sm', 'md', 'lg']),
    });
  }),

  // GET /api/separator/sections - Get sections with separators
  http.get(API_SEPARATOR_SECTIONS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);

    await delay(faker.number.int({ min: 150, max: 400 }));

    const sections = Array.from({ length: count }, (_, i) => ({
      id: faker.string.uuid(),
      index: i,
      title: faker.lorem.words({ min: 2, max: 4 }),
      content: faker.lorem.paragraph(),
      separatorAfter: i < count - 1,
    }));

    return HttpResponse.json({
      sections,
      total: sections.length,
    });
  }),

  // POST /api/separator/save - Save separator preferences
  http.post(API_SEPARATOR_SAVE, async ({ request }) => {
    const body = (await request.json()) as { config: Record<string, unknown>; layoutId: string };
    await delay(faker.number.int({ min: 100, max: 250 }));

    return HttpResponse.json({
      success: true,
      layoutId: body.layoutId,
      config: body.config,
      savedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const separatorStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: separatorHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SEPARATOR_SECTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.separator.invalidSeparatorParameters', 'Invalid separator parameters'),
          API_SEPARATOR_SECTIONS,
          {
            count: i18n.t(
              'handler.separator.countMustBeBetween1And20',
              'Count must be between 1 and 20'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.separator.authenticationRequiredToLoadConfiguration',
            'Authentication required to load configuration'
          ),
          API_SEPARATOR_CONFIG
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.separator.authenticationRequiredToSaveConfiguration',
            'Authentication required to save configuration'
          ),
          API_SEPARATOR_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.separator.accessDeniedToSaveSeparator',
            'Access denied to save separator config'
          ),
          API_SEPARATOR_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONFIG_NOT_FOUND',
          i18n.t(
            'handler.separator.separatorConfigurationNotFound',
            'Separator configuration not found'
          ),
          API_SEPARATOR_CONFIG
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFIG_CONFLICT',
          i18n.t(
            'handler.separator.configurationWasModifiedByAnother',
            'Configuration was modified by another session'
          ),
          API_SEPARATOR_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.separator.invalidSeparatorConfiguration',
            'Invalid separator configuration'
          ),
          API_SEPARATOR_SAVE,
          {
            thickness: i18n.t(
              'handler.separator.thicknessMustBe1_2Or4',
              'Thickness must be 1, 2, or 4'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.separator.tooManySaveRequestsPlease',
            'Too many save requests. Please wait.'
          ),
          API_SEPARATOR_SAVE,
          { retryAfter: '10' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t(
            'handler.separator.failedToLoadSeparatorConfiguration',
            'Failed to load separator configuration'
          ),
          API_SEPARATOR_CONFIG,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_SEPARATOR_SECTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.separator.failedToLoadSections', 'Failed to load sections'),
          API_SEPARATOR_SECTIONS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.separator.layoutServiceTemporarilyUnavailable',
            'Layout service temporarily unavailable'
          ),
          API_SEPARATOR_CONFIG
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.separator.separatorServiceIsUnderMaintenance',
            'Separator service is under maintenance'
          ),
          API_SEPARATOR_CONFIG,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.separator.configurationRequestTimedOut',
            'Configuration request timed out'
          ),
          API_SEPARATOR_CONFIG
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(4000);
      return HttpResponse.json({
        layoutId: 'slow',
        orientation: 'horizontal',
        decorative: true,
        thickness: 1,
        color: 'default',
        spacing: 'md',
      });
    }),
  ],

  networkError: [
    http.get(API_SEPARATOR_CONFIG, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_SEPARATOR_SAVE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SEPARATOR_SECTIONS, async () => {
      await delay(200);
      return HttpResponse.json({
        sections: [],
        total: 0,
      });
    }),
  ],
};
