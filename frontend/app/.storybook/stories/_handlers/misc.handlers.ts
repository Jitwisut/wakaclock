import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeKbd,
  createFakeNavigationMenu,
  createFakeReel,
  createFakeSlider,
  createFakeSwitch,
  createFakeTimelineData,
  createFakeToggle,
  createFakeToggleGroup,
} from '../_factories/misc.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TOGGLES = '/api/toggles';
const API_SWITCHES = '/api/switches';
const API_SLIDERS = '/api/sliders';
const API_TIMELINE = '/api/timeline';
const API_REEL = '/api/reel';
const API_NAVIGATION = '/api/navigation-menu';
const API_KEYBOARD_SHORTCUTS = '/api/keyboard-shortcuts';

// Default success handlers
export const miscHandlers = [
  // GET /api/toggles - Fetch toggle states
  http.get(API_TOGGLES, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const toggles = Array.from({ length: count }, () => createFakeToggle());
    return HttpResponse.json({ toggles, total: toggles.length });
  }),

  // POST /api/toggles - Update toggle state
  http.post(API_TOGGLES, async ({ request }) => {
    const body = (await request.json()) as { id: string; pressed: boolean };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      toggle: createFakeToggle({ id: body.id, pressed: body.pressed }),
    });
  }),

  // GET /api/switches - Fetch switch states
  http.get(API_SWITCHES, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 5);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const switches = Array.from({ length: count }, () => createFakeSwitch());
    return HttpResponse.json({ switches, total: switches.length });
  }),

  // GET /api/sliders - Fetch slider configurations
  http.get(API_SLIDERS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const sliders = Array.from({ length: count }, () => createFakeSlider());
    return HttpResponse.json({ sliders, total: sliders.length });
  }),

  // GET /api/timeline - Fetch timeline events
  http.get(API_TIMELINE, async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));

    const timeline = createFakeTimelineData();
    return HttpResponse.json({ timeline });
  }),

  // GET /api/reel - Fetch reel items
  http.get(API_REEL, async () => {
    await delay(faker.number.int({ min: 300, max: 600 }));

    const reel = createFakeReel();
    return HttpResponse.json({ reel });
  }),

  // GET /api/navigation-menu - Fetch navigation menu
  http.get(API_NAVIGATION, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 4);
    await delay(faker.number.int({ min: 200, max: 500 }));

    const menus = Array.from({ length: count }, () => createFakeNavigationMenu());
    return HttpResponse.json({ menus, total: menus.length });
  }),

  // GET /api/keyboard-shortcuts - Fetch keyboard shortcuts
  http.get(API_KEYBOARD_SHORTCUTS, async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 10);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const shortcuts = Array.from({ length: count }, () => createFakeKbd());
    return HttpResponse.json({ shortcuts, total: shortcuts.length });
  }),

  // GET /api/toggle-groups - Fetch toggle groups
  http.get('/api/toggle-groups', async ({ request }) => {
    const url = new URL(request.url);
    const count = Number(url.searchParams.get('count') ?? 3);
    await delay(faker.number.int({ min: 200, max: 400 }));

    const groups = Array.from({ length: count }, () => createFakeToggleGroup());
    return HttpResponse.json({ groups, total: groups.length });
  }),
];

// Status-specific handlers for stories
export const miscStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: miscHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.misc.invalidParameters', 'Invalid parameters'),
          API_TOGGLES
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.misc.authenticationRequired', 'Authentication required'),
          API_TOGGLES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.misc.cannotModifySettings', 'Cannot modify settings'),
          API_TOGGLES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TIMELINE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.misc.timelineNotFound', 'Timeline not found'),
          API_TIMELINE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.misc.requestValidationFailed', 'Request validation failed'),
          API_TOGGLES,
          {
            field: 'data',
            error: i18n.t('handler.misc.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_TOGGLES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.misc.tooManyRequests', 'Too many requests'),
          API_TOGGLES,
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

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.misc.failedToLoadData', 'Failed to load data'),
          API_TOGGLES,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TIMELINE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.misc.serviceUnavailable', 'Service unavailable'),
          API_TIMELINE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.misc.serviceUnderMaintenance', 'Service under maintenance'),
          API_TOGGLES,
          {
            retryAfter: '120',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.misc.requestTimedOut', 'Request timed out'),
          API_TOGGLES
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TOGGLES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_TOGGLES, async () => {
      await delay(5000);
      const toggles = Array.from({ length: 5 }, () => createFakeToggle());
      return HttpResponse.json({ toggles, total: toggles.length });
    }),
  ],

  networkError: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TOGGLES, async () => {
      await delay(300);
      return HttpResponse.json({ toggles: [], total: 0 });
    }),
  ],

  emptyTimeline: [
    http.get(API_TIMELINE, async () => {
      await delay(300);
      return HttpResponse.json({
        timeline: { id: faker.string.uuid(), events: [] },
      });
    }),
  ],

  emptyReel: [
    http.get(API_REEL, async () => {
      await delay(300);
      return HttpResponse.json({
        reel: { id: faker.string.uuid(), items: [] },
      });
    }),
  ],
};
