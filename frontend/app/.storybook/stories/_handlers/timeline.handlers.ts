import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TIMELINE_EVENTS = '/api/timeline/events';
const API_TIMELINE_EVENT = '/api/timeline/events/:id';
const API_TIMELINE_CREATE = '/api/timeline/events';

// Helper to create fake timeline events
function createFakeTimelineEvent(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence({ min: 3, max: 8 }),
    description: faker.lorem.paragraph(),
    timestamp: faker.date.recent().toISOString(),
    type: faker.helpers.arrayElement(['milestone', 'update', 'comment', 'action', 'alert']),
    status: faker.helpers.arrayElement(['pending', 'in_progress', 'completed', 'cancelled']),
    icon: faker.helpers.arrayElement(['check', 'clock', 'alert', 'message', 'star']),
    user: {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      avatar: `/images/avatars/0${faker.number.int({ min: 1, max: 5 })}.png`,
    },
    metadata: faker.helpers.maybe(
      () => ({
        duration: faker.number.int({ min: 1, max: 60 }),
        priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
      }),
      { probability: 0.3 }
    ),
    ...overrides,
  };
}

// Default success handlers
export const timelineHandlers = [
  // GET /api/timeline/events - Get timeline events
  http.get(API_TIMELINE_EVENTS, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const page = Number(url.searchParams.get('page') ?? 1);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const events = Array.from({ length: limit }, () => createFakeTimelineEvent());

    return HttpResponse.json({
      events,
      page,
      limit,
      total: faker.number.int({ min: 50, max: 200 }),
      hasMore: page < 5,
    });
  }),

  // GET /api/timeline/events/:id - Get single event
  http.get(API_TIMELINE_EVENT, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json(createFakeTimelineEvent({ id: params.id as string }));
  }),

  // POST /api/timeline/events - Create event
  http.post(API_TIMELINE_CREATE, async ({ request }) => {
    const body = (await request.json()) as { description?: string; title: string; type?: string };
    await delay(faker.number.int({ min: 150, max: 400 }));

    return HttpResponse.json({
      success: true,
      event: createFakeTimelineEvent({
        title: body.title,
        description: body.description,
        type: body.type,
      }),
      createdAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const timelineStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: timelineHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.timeline.invalidTimelineParameters', 'Invalid timeline parameters'),
          API_TIMELINE_EVENTS,
          {
            limit: i18n.t(
              'handler.timeline.limitMustBeBetween1And100',
              'Limit must be between 1 and 100'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.timeline.authenticationRequiredToViewTimeline',
            'Authentication required to view timeline'
          ),
          API_TIMELINE_EVENTS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_TIMELINE_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.timeline.authenticationRequiredToCreateEvents',
            'Authentication required to create events'
          ),
          API_TIMELINE_CREATE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TIMELINE_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.timeline.accessDeniedToCreateTimeline',
            'Access denied to create timeline events'
          ),
          API_TIMELINE_CREATE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_TIMELINE_EVENT, async ({ params }) => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'EVENT_NOT_FOUND',
          `Timeline event ${params.id} not found`,
          `/api/timeline/events/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_TIMELINE_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'DUPLICATE_EVENT',
          i18n.t(
            'handler.timeline.similarEventAlreadyExistsAt',
            'Similar event already exists at this time'
          ),
          API_TIMELINE_CREATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_TIMELINE_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.timeline.invalidTimelineEventData', 'Invalid timeline event data'),
          API_TIMELINE_CREATE,
          {
            title: i18n.t(
              'handler.timeline.titleIsRequiredAndMustBe',
              'Title is required and must be 3-200 characters'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.timeline.tooManyTimelineRequests', 'Too many timeline requests'),
          API_TIMELINE_EVENTS,
          { retryAfter: '10' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'LOAD_FAILED',
          i18n.t('handler.timeline.failedToLoadTimelineEvents', 'Failed to load timeline events'),
          API_TIMELINE_EVENTS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.timeline.timelineServiceTemporarilyUnavailable',
            'Timeline service temporarily unavailable'
          ),
          API_TIMELINE_EVENTS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.timeline.timelineServiceIsUnderMaintenance',
            'Timeline service is under maintenance'
          ),
          API_TIMELINE_EVENTS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.timeline.timelineRequestTimedOut', 'Timeline request timed out'),
          API_TIMELINE_EVENTS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(4000);
      return HttpResponse.json({
        events: Array.from({ length: 3 }, () => createFakeTimelineEvent()),
        page: 1,
        limit: 3,
        total: 3,
        hasMore: false,
      });
    }),
  ],

  networkError: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json({
        events: [],
        page: 1,
        limit: 10,
        total: 0,
        hasMore: false,
      });
    }),
  ],

  empty: [
    http.get(API_TIMELINE_EVENTS, async () => {
      await delay(200);
      return HttpResponse.json({
        events: [],
        page: 1,
        limit: 10,
        total: 0,
        hasMore: false,
      });
    }),
  ],
};
