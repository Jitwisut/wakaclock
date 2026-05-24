import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_ITEM_LIST = '/api/items';
const API_ITEM_DETAIL = '/api/items/:id';
const API_ITEM_ACTION = '/api/items/:id/action';

// Default success handlers
export const itemHandlers = [
  // GET /api/items - List items
  http.get(API_ITEM_LIST, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const page = Number(url.searchParams.get('page') ?? 1);
    await delay(faker.number.int({ min: 200, max: 500 }));

    const items = Array.from({ length: limit }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.sentence({ min: 8, max: 15 }),
      status: faker.helpers.arrayElement(['active', 'pending', 'completed', 'archived']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      avatar: faker.image.avatar(),
      metadata: {
        views: faker.number.int({ min: 0, max: 1000 }),
        comments: faker.number.int({ min: 0, max: 50 }),
      },
    }));

    return HttpResponse.json({
      items,
      pagination: {
        page,
        limit,
        total: faker.number.int({ min: 50, max: 200 }),
        totalPages: Math.ceil(faker.number.int({ min: 50, max: 200 }) / limit),
      },
    });
  }),

  // GET /api/items/:id - Get item detail
  http.get(API_ITEM_DETAIL, async ({ params }) => {
    const { id } = params;
    await delay(faker.number.int({ min: 150, max: 350 }));

    return HttpResponse.json({
      id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      description: faker.lorem.paragraph(),
      status: faker.helpers.arrayElement(['active', 'pending', 'completed', 'archived']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      author: {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
      },
      tags: faker.helpers.arrayElements(['feature', 'bug', 'enhancement', 'documentation'], {
        min: 1,
        max: 3,
      }),
    });
  }),

  // POST /api/items/:id/action - Perform action on item
  http.post(API_ITEM_ACTION, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { action: string };
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({
      success: true,
      itemId: id,
      action: body.action,
      executedAt: new Date().toISOString(),
      result: {
        message: i18n.t(
          'handler.item.actionCompletedOnItem',
          'Action "{{action}}" completed on item',
          { action: body.action }
        ),
      },
    });
  }),
];

// Status-specific handlers for stories
export const itemStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: itemHandlers,

  // ============ 4xx CLIENT ERRORS ============
  notFound: [
    http.get(API_ITEM_DETAIL, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'ITEM_NOT_FOUND',
          i18n.t('handler.item.itemNotFound', 'Item not found'),
          API_ITEM_DETAIL
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  badRequest: [
    http.post(API_ITEM_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_ACTION',
          i18n.t('handler.item.invalidActionForThisItem', 'Invalid action for this item'),
          API_ITEM_ACTION,
          {
            action: i18n.t('handler.item.actionTypeIsNotSupported', 'Action type is not supported'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.item.authenticationRequired', 'Authentication required'),
          API_ITEM_LIST
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_ITEM_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.item.youDoNotHavePermission',
            'You do not have permission to perform this action'
          ),
          API_ITEM_ACTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_ITEM_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.item.invalidItemData', 'Invalid item data'),
          API_ITEM_ACTION,
          {
            title: i18n.t('handler.item.titleIsRequired', 'Title is required'),
            status: i18n.t('handler.item.invalidStatusValue', 'Invalid status value'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.item.tooManyRequestsPleaseTry',
            'Too many requests. Please try again later.'
          ),
          API_ITEM_LIST,
          { retryAfter: '30' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  conflict: [
    http.post(API_ITEM_ACTION, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONFLICT',
          i18n.t(
            'handler.item.itemWasModifiedByAnother',
            'Item was modified by another user. Please refresh and try again.'
          ),
          API_ITEM_ACTION,
          { lastModifiedAt: faker.date.recent().toISOString() }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          i18n.t('handler.item.failedToFetchItems', 'Failed to fetch items'),
          API_ITEM_LIST,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.item.itemServiceTemporarilyUnavailable',
            'Item service temporarily unavailable'
          ),
          API_ITEM_LIST
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t('handler.item.itemServiceIsUnderMaintenance', 'Item service is under maintenance'),
          API_ITEM_LIST,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.item.itemServiceRequestTimedOut', 'Item service request timed out'),
          API_ITEM_LIST
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_ITEM_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_ITEM_LIST, async () => {
      await delay(4000);
      return HttpResponse.json({
        items: [{ id: '1', title: i18n.t('handler.item.slowItem', 'Slow item') }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    }),
  ],

  networkError: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyList: [
    http.get(API_ITEM_LIST, async () => {
      await delay(200);
      return HttpResponse.json({
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    }),
  ],
};
