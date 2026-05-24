import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SWITCH_STATE = '/api/switch/state';
const API_SWITCH_TOGGLE = '/api/switch/toggle';
const API_SWITCH_CONFIG = '/api/switch/config';

// Default success handlers
export const switchHandlers = [
  // GET /api/switch/state - Get switch state
  http.get(API_SWITCH_STATE, async ({ request }) => {
    const url = new URL(request.url);
    const switchId = url.searchParams.get('switchId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      switchId,
      checked: faker.datatype.boolean(),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
      label: faker.lorem.words({ min: 2, max: 4 }),
      lastChangedAt: faker.date.recent().toISOString(),
      lastChangedBy: faker.person.fullName(),
    });
  }),

  // POST /api/switch/toggle - Toggle switch state
  http.post(API_SWITCH_TOGGLE, async ({ request }) => {
    const body = (await request.json()) as { checked: boolean; switchId: string };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      switchId: body.switchId,
      checked: body.checked,
      previousState: !body.checked,
      toggledAt: new Date().toISOString(),
    });
  }),

  // GET /api/switch/config - Get switch configuration
  http.get(API_SWITCH_CONFIG, async ({ request }) => {
    const url = new URL(request.url);
    const groupId = url.searchParams.get('groupId') ?? 'default';

    await delay(faker.number.int({ min: 100, max: 250 }));

    const switches = Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
      id: faker.string.uuid(),
      label: faker.lorem.words({ min: 2, max: 4 }),
      description: faker.lorem.sentence(),
      defaultChecked: faker.datatype.boolean(),
      disabled: faker.datatype.boolean({ probability: 0.1 }),
    }));

    return HttpResponse.json({
      groupId,
      switches,
      total: switches.length,
    });
  }),
];

// Status-specific handlers for stories
export const switchStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: switchHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_STATE',
          i18n.t('handler.switch.invalidSwitchStateValue', 'Invalid switch state value'),
          API_SWITCH_TOGGLE,
          { checked: i18n.t('handler.switch.mustBeABooleanValue', 'Must be a boolean value') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.switch.authenticationRequiredToToggleSwitch',
            'Authentication required to toggle switch'
          ),
          API_SWITCH_TOGGLE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.switch.switchIsLockedByAdministrator',
            'Switch is locked by administrator'
          ),
          API_SWITCH_TOGGLE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SWITCH_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'SWITCH_NOT_FOUND',
          i18n.t('handler.switch.switchNotFound', 'Switch not found'),
          API_SWITCH_STATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'STATE_CONFLICT',
          i18n.t(
            'handler.switch.switchStateWasChangedBy',
            'Switch state was changed by another user'
          ),
          API_SWITCH_TOGGLE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t(
            'handler.switch.cannotToggleSwitchInCurrent',
            'Cannot toggle switch in current context'
          ),
          API_SWITCH_TOGGLE,
          { context: i18n.t('handler.switch.featureFlagIsDisabled', 'Feature flag is disabled') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.switch.tooManyToggleRequests', 'Too many toggle requests'),
          API_SWITCH_TOGGLE,
          { retryAfter: '2' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'TOGGLE_FAILED',
          i18n.t('handler.switch.failedToToggleSwitch', 'Failed to toggle switch'),
          API_SWITCH_TOGGLE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SWITCH_STATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.switch.switchServiceTemporarilyUnavailable',
            'Switch service temporarily unavailable'
          ),
          API_SWITCH_STATE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.switch.switchServiceIsUnderMaintenance',
            'Switch service is under maintenance'
          ),
          API_SWITCH_TOGGLE,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.switch.toggleRequestTimedOut', 'Toggle request timed out'),
          API_SWITCH_TOGGLE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SWITCH_STATE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(4000);
      return HttpResponse.json({
        success: true,
        switchId: 'slow',
        checked: true,
        toggledAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.get(API_SWITCH_STATE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.post(API_SWITCH_TOGGLE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SWITCH_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json({
        groupId: 'empty',
        switches: [],
        total: 0,
      });
    }),
  ],
};
