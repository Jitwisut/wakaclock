import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_REEL_ITEMS = '/api/reel/items';
const API_REEL_ITEM = '/api/reel/items/:id';
const API_REEL_MARK_READ = '/api/reel/items/:id/read';
const API_REEL_ANALYTICS = '/api/reel/analytics';

// Helper to create fake reel items
function createFakeReelItem(overrides?: Partial<Record<string, unknown>>) {
  const type = faker.helpers.arrayElement(['image', 'video']) as 'image' | 'video';
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    type,
    username: faker.person.fullName(),
    avatar: `/images/avatars/0${faker.number.int({ min: 1, max: 5 })}.png`,
    src:
      type === 'image'
        ? `/images/food/${faker.helpers.arrayElement(['coffee', 'pizza', 'burger'])}${faker.number.int({ min: 1, max: 3 })}.jpg`
        : `/videos/sample${faker.number.int({ min: 1, max: 3 })}.mp4`,
    duration: faker.number.int({ min: 3, max: 15 }),
    alt: faker.lorem.words(2),
    title: faker.lorem.sentence({ min: 2, max: 5 }),
    description: faker.lorem.sentence(),
    isRead: faker.datatype.boolean({ probability: 0.3 }),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

// Default success handlers
export const reelHandlers = [
  // GET /api/reel/items - Get reel items
  http.get(API_REEL_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const userId = url.searchParams.get('userId');

    await delay(faker.number.int({ min: 150, max: 400 }));

    const items = Array.from({ length: limit }, () => createFakeReelItem());

    return HttpResponse.json({
      items,
      total: items.length,
      userId: userId ?? null,
      hasMore: faker.datatype.boolean(),
    });
  }),

  // GET /api/reel/items/:id - Get single reel item
  http.get(API_REEL_ITEM, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const item = createFakeReelItem({ id: Number(params.id) });
    return HttpResponse.json(item);
  }),

  // POST /api/reel/items/:id/read - Mark reel as read
  http.post(API_REEL_MARK_READ, async ({ params }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      itemId: params.id,
      markedAt: new Date().toISOString(),
    });
  }),

  // POST /api/reel/analytics - Track reel interaction
  http.post(API_REEL_ANALYTICS, async ({ request }) => {
    const body = (await request.json()) as { action: string; duration?: number; itemId: number };
    await delay(faker.number.int({ min: 50, max: 100 }));

    return HttpResponse.json({
      success: true,
      itemId: body.itemId,
      action: body.action,
      trackedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const reelStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: reelHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.reel.invalidReelQueryParameters', 'Invalid reel query parameters'),
          API_REEL_ITEMS,
          {
            limit: i18n.t(
              'handler.reel.mustBeAPositiveIntegerBetween1And50',
              'Must be a positive integer between 1 and 50'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.reel.authenticationRequiredToViewReels',
            'Authentication required to view reels'
          ),
          API_REEL_ITEMS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_REEL_MARK_READ, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.reel.authenticationRequiredToMarkReel',
            'Authentication required to mark reel as read'
          ),
          API_REEL_MARK_READ
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.reel.accessDeniedToReels', 'Access denied to reels'),
          API_REEL_ITEMS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_REEL_ITEM, async ({ params }) => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'REEL_NOT_FOUND',
          `Reel item ${params.id} not found`,
          `/api/reel/items/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_REEL_ANALYTICS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.reel.invalidAnalyticsData', 'Invalid analytics data'),
          API_REEL_ANALYTICS,
          { action: i18n.t('handler.reel.actionTypeIsRequired', 'Action type is required') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.reel.tooManyReelRequestsPlease',
            'Too many reel requests. Please try again later.'
          ),
          API_REEL_ITEMS,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_REEL_MARK_READ, async ({ params }) => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'REEL_CONFLICT',
          i18n.t(
            'handler.reel.reelStateWasModifiedBy',
            'Reel state was modified by another session'
          ),
          `/api/reel/items/${params.id}/read`,
          {
            suggestion: i18n.t(
              'handler.reel.pleaseRefreshAndTryAgain',
              'Please refresh and try again'
            ),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.reel.failedToLoadReelItems', 'Failed to load reel items'),
          API_REEL_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.reel.reelServiceTemporarilyUnavailable',
            'Reel service temporarily unavailable'
          ),
          API_REEL_ITEMS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.reel.reelServiceIsUnderMaintenance', 'Reel service is under maintenance'),
          API_REEL_ITEMS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.reel.reelRequestTimedOut', 'Reel request timed out'),
          API_REEL_ITEMS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_REEL_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(4000);
      return HttpResponse.json({
        items: Array.from({ length: 3 }, () => createFakeReelItem()),
        total: 3,
        hasMore: false,
      });
    }),
  ],

  networkError: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_REEL_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        total: 0,
        hasMore: false,
      });
    }),
  ],
};
