import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SCROLL_AREA_CONTENT = '/api/scroll-area/content';
const API_SCROLL_AREA_ITEMS = '/api/scroll-area/items';
const API_SCROLL_AREA_POSITION = '/api/scroll-area/position';

// Helper to create fake scroll content
function createFakeScrollItem(index: number) {
  return {
    id: faker.string.uuid(),
    index,
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    timestamp: faker.date.recent().toISOString(),
    avatar: `/images/avatars/0${faker.number.int({ min: 1, max: 5 })}.png`,
    author: faker.person.fullName(),
  };
}

// Default success handlers
export const scrollAreaHandlers = [
  // GET /api/scroll-area/content - Get scrollable content
  http.get(API_SCROLL_AREA_CONTENT, async ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'text';

    await delay(faker.number.int({ min: 150, max: 400 }));

    if (type === 'text') {
      return HttpResponse.json({
        content: faker.lorem.paragraphs(10, '\n\n'),
        wordCount: faker.number.int({ min: 500, max: 1500 }),
        estimatedReadTime: faker.number.int({ min: 3, max: 10 }),
      });
    }

    return HttpResponse.json({
      content: Array.from({ length: 20 }, (_, i) => createFakeScrollItem(i)),
      total: 20,
      hasMore: faker.datatype.boolean(),
    });
  }),

  // GET /api/scroll-area/items - Get paginated items for infinite scroll
  http.get(API_SCROLL_AREA_ITEMS, async ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const items = Array.from({ length: limit }, (_, i) =>
      createFakeScrollItem((page - 1) * limit + i)
    );

    return HttpResponse.json({
      items,
      page,
      limit,
      total: faker.number.int({ min: 50, max: 200 }),
      hasMore: page < 5,
    });
  }),

  // POST /api/scroll-area/position - Save scroll position
  http.post(API_SCROLL_AREA_POSITION, async ({ request }) => {
    const body = (await request.json()) as { position: number; scrollAreaId: string };
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      success: true,
      scrollAreaId: body.scrollAreaId,
      position: body.position,
      savedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const scrollAreaStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: scrollAreaHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t(
            'handler.scrollArea.invalidScrollAreaParameters',
            'Invalid scroll area parameters'
          ),
          API_SCROLL_AREA_ITEMS,
          {
            page: i18n.t(
              'handler.scrollArea.pageMustBeAPositiveInteger',
              'Page must be a positive integer'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.scrollArea.authenticationRequiredToViewContent',
            'Authentication required to view content'
          ),
          API_SCROLL_AREA_CONTENT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_SCROLL_AREA_POSITION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.scrollArea.authenticationRequiredToSavePosition',
            'Authentication required to save position'
          ),
          API_SCROLL_AREA_POSITION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.scrollArea.accessDeniedToScrollContent',
            'Access denied to scroll content'
          ),
          API_SCROLL_AREA_CONTENT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONTENT_NOT_FOUND',
          i18n.t('handler.scrollArea.scrollAreaContentNotFound', 'Scroll area content not found'),
          API_SCROLL_AREA_CONTENT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_SCROLL_AREA_POSITION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'POSITION_CONFLICT',
          i18n.t(
            'handler.scrollArea.scrollPositionWasUpdatedBy',
            'Scroll position was updated by another session'
          ),
          API_SCROLL_AREA_POSITION
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_SCROLL_AREA_POSITION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.scrollArea.invalidScrollPositionData', 'Invalid scroll position data'),
          API_SCROLL_AREA_POSITION,
          {
            position: i18n.t(
              'handler.scrollArea.positionMustBeANonNegativeNumber',
              'Position must be a non-negative number'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.scrollArea.tooManyScrollRequestsPlease',
            'Too many scroll requests. Please slow down.'
          ),
          API_SCROLL_AREA_ITEMS,
          { retryAfter: '5' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.scrollArea.failedToLoadScrollContent', 'Failed to load scroll content'),
          API_SCROLL_AREA_CONTENT,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.scrollArea.failedToLoadScrollItems', 'Failed to load scroll items'),
          API_SCROLL_AREA_ITEMS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.scrollArea.contentServiceTemporarilyUnavailable',
            'Content service temporarily unavailable'
          ),
          API_SCROLL_AREA_CONTENT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.scrollArea.scrollServiceIsUnderMaintenance',
            'Scroll service is under maintenance'
          ),
          API_SCROLL_AREA_CONTENT,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.scrollArea.scrollContentRequestTimedOut',
            'Scroll content request timed out'
          ),
          API_SCROLL_AREA_CONTENT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(4000);
      return HttpResponse.json({
        content: faker.lorem.paragraphs(5, '\n\n'),
        wordCount: 500,
        estimatedReadTime: 3,
      });
    }),
  ],

  networkError: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SCROLL_AREA_CONTENT, async () => {
      await delay(200);
      return HttpResponse.json({
        content: '',
        wordCount: 0,
        estimatedReadTime: 0,
      });
    }),
    http.get(API_SCROLL_AREA_ITEMS, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        page: 1,
        limit: 10,
        total: 0,
        hasMore: false,
      });
    }),
  ],
};
