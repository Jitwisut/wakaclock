import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOGGLE_STATE = '/api/toggle/state';
const API_TOGGLE_PRESS = '/api/toggle/press';
const API_TOGGLE_CONFIG = '/api/toggle/config';

// Default success handlers
export const toggleHandlers = [
  // GET /api/toggle/state - Get toggle state
  http.get(API_TOGGLE_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const toggleId = url.searchParams.get('toggleId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      toggleId,
      pressed: faker.datatype.boolean(),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
      variant: faker.helpers.arrayElement(['default', 'outline']),
      size: faker.helpers.arrayElement(['default', 'sm', 'lg']),
      label: faker.lorem.words({ min: 1, max: 3 }),
      ariaLabel: faker.lorem.words({ min: 2, max: 4 }),
    });
  }),

  // POST /api/toggle/press - Toggle press state
  http.post(API_TOGGLE_PRESS, async ({ request }) => {
    const body = (await request.json()) as { pressed: boolean; toggleId: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      toggleId: body.toggleId,
      pressed: body.pressed,
      previousState: !body.pressed,
      pressedAt: new Date().toISOString(),
    });
  }),

  // GET /api/toggle/config - Get toggle configuration
  http.get(API_TOGGLE_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 250 }));

    const toggles = Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () => ({
      id: faker.string.uuid(),
      icon: faker.helpers.arrayElement([
        i18n.t('handler.toggle.bold', 'Bold'),
        i18n.t('handler.toggle.italic', 'Italic'),
        i18n.t('handler.toggle.underline', 'Underline'),
        i18n.t('handler.toggle.strikethrough', 'Strikethrough'),
      ]),
      label: faker.lorem.word(),
      ariaLabel: faker.lorem.words({ min: 2, max: 3 }),
      defaultPressed: faker.datatype.boolean({ probability: 0.3 }),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
    }));

    return HttpResponse.json({
      groupId,
      toggles,
      total: toggles.length,
    });
  }),
];

// Status-specific handlers for stories
export const toggleStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: toggleHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_STATE',
          i18n.t('handler.toggle.invalidToggleStateValue', 'Invalid toggle state value'),
          API_TOGGLE_PRESS,
          { pressed: i18n.t('handler.toggle.mustBeABooleanValue', 'Must be a boolean value') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.toggle.authenticationRequiredToToggle',
            'Authentication required to toggle'
          ),
          API_TOGGLE_PRESS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.toggle.toggleIsLocked', 'Toggle is locked'),
          API_TOGGLE_PRESS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TOGGLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TOGGLE_NOT_FOUND',
          i18n.t('handler.toggle.toggleNotFound', 'Toggle not found'),
          API_TOGGLE_STATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.toggle.toggleStateChangedByAnother',
            'Toggle state changed by another user'
          ),
          API_TOGGLE_PRESS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.toggle.cannotToggleInCurrentContext', 'Cannot toggle in current context'),
          API_TOGGLE_PRESS,
          {
            context: i18n.t(
              'handler.toggle.toggleGroupModePreventsIndividualToggle',
              'Toggle group mode prevents individual toggle'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.toggle.tooManyToggleRequests', 'Too many toggle requests'),
          API_TOGGLE_PRESS,
          { retryAfter: '2' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'TOGGLE_FAILED',
          i18n.t('handler.toggle.failedToUpdateToggleState', 'Failed to update toggle state'),
          API_TOGGLE_PRESS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TOGGLE_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.toggle.toggleServiceTemporarilyUnavailable',
            'Toggle service temporarily unavailable'
          ),
          API_TOGGLE_STATE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.toggle.toggleServiceIsUnderMaintenance',
            'Toggle service is under maintenance'
          ),
          API_TOGGLE_PRESS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.toggle.toggleRequestTimedOut', 'Toggle request timed out'),
          API_TOGGLE_PRESS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOGGLE_STATE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        toggleId: 'slow',
        pressed: true,
        pressedAt: new Date().toISOString(),
      });
    }),
  ],

  slowSubmission: [
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(5000);
      return HttpResponse.json({
        success: true,
        toggleId: 'slow-submit',
        pressed: true,
        pressedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_TOGGLE_STATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_TOGGLE_PRESS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOGGLE_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json({
        groupId: 'empty',
        toggles: [],
        total: 0,
      });
    }),
  ],
};
