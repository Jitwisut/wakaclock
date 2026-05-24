import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeKanbanActivities,
  createFakeKanbanBoard,
  createFakeKanbanBoardResponse,
  createFakeKanbanCard,
} from '../_factories/kanban.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_KANBAN_BOARD = '/api/kanban/board';
const API_KANBAN_BOARD_BY_ID = '/api/kanban/board/:id';
const API_KANBAN_CARDS = '/api/kanban/cards';
const API_KANBAN_CARD_BY_ID = '/api/kanban/cards/:id';
const API_KANBAN_CARD_MOVE = '/api/kanban/cards/:id/move';
const API_KANBAN_ACTIVITIES = '/api/kanban/activities';
const API_KANBAN_COLUMNS = '/api/kanban/columns';
const API_KANBAN_COLUMN_BY_ID = '/api/kanban/columns/:id';

// Default success handlers
export const kanbanHandlers = [
  // GET /api/kanban/board
  http.get(API_KANBAN_BOARD, async () => {
    await delay(faker.number.int({ min: 400, max: 1000 }));
    return HttpResponse.json(createFakeKanbanBoardResponse());
  }),

  // GET /api/kanban/board/:id
  http.get(API_KANBAN_BOARD_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    const board = createFakeKanbanBoardResponse();
    return HttpResponse.json({ ...board, id: params.id });
  }),

  // POST /api/kanban/cards
  http.post(API_KANBAN_CARDS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));

    return HttpResponse.json(
      { ...createFakeKanbanCard(), ...(body as object), id: faker.string.uuid() },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // PATCH /api/kanban/cards/:id
  http.patch(API_KANBAN_CARD_BY_ID, async ({ request, params }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 400 }));

    return HttpResponse.json({ ...createFakeKanbanCard(), ...(body as object), id: params.id });
  }),

  // DELETE /api/kanban/cards/:id
  http.delete(API_KANBAN_CARD_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // PATCH /api/kanban/cards/:id/move
  http.patch(API_KANBAN_CARD_MOVE, async ({ request, params }) => {
    const { columnId, position } = (await request.json()) as { columnId: string; position: number };
    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      success: true,
      cardId: params.id,
      columnId,
      position,
    });
  }),

  // GET /api/kanban/activities
  http.get(API_KANBAN_ACTIVITIES, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      activities: createFakeKanbanActivities(faker.number.int({ min: 5, max: 15 })),
    });
  }),

  // POST /api/kanban/columns
  http.post(API_KANBAN_COLUMNS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json(
      { id: faker.string.uuid(), ...(body as object), cards: [] },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // PATCH /api/kanban/columns/:id
  http.patch(API_KANBAN_COLUMN_BY_ID, async ({ request, params }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 200, max: 400 }));
    return HttpResponse.json({ ...(body as object), id: params.id });
  }),

  // DELETE /api/kanban/columns/:id
  http.delete(API_KANBAN_COLUMN_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),
];

// Status-specific handlers for stories
export const kanbanStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: kanbanHandlers,

  created: [
    http.post(API_KANBAN_CARDS, async ({ request }) => {
      const body = await request.json();
      await delay(400);
      return HttpResponse.json(
        { ...createFakeKanbanCard(), ...(body as object), id: faker.string.uuid() },
        { status: HTTP_STATUS.CREATED }
      );
    }),
  ],

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_KANBAN_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CARD',
          i18n.t('handler.kanban.cardDataIsInvalid', 'Card data is invalid'),
          API_KANBAN_CARDS,
          {
            title: i18n.t('handler.kanban.titleIsRequired', 'Title is required'),
            columnId: i18n.t('handler.kanban.columnIdIsRequired', 'Column ID is required'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.patch(API_KANBAN_CARD_MOVE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MOVE',
          i18n.t('handler.kanban.invalidMoveOperation', 'Invalid move operation'),
          API_KANBAN_CARD_MOVE,
          {
            position: i18n.t(
              'handler.kanban.positionMustBeAValid',
              'Position must be a valid index'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.kanban.pleaseLogInToAccess', 'Please log in to access the board'),
          API_KANBAN_BOARD
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.patch(API_KANBAN_CARD_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.kanban.youCannotEditThisCard', 'You cannot edit this card'),
          API_KANBAN_CARD_BY_ID,
          {
            reason: i18n.t(
              'handler.kanban.youAreNotAssignedTo',
              'You are not assigned to this card'
            ),
          }
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
    http.delete(API_KANBAN_CARD_BY_ID, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.kanban.youCannotDeleteThisCard', 'You cannot delete this card'),
          API_KANBAN_CARD_BY_ID
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_KANBAN_BOARD_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'BOARD_NOT_FOUND',
          `Board ${params.id} not found`,
          `/api/kanban/board/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
    http.patch(API_KANBAN_CARD_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CARD_NOT_FOUND',
          `Card ${params.id} not found`,
          `/api/kanban/cards/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.patch(API_KANBAN_CARD_MOVE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'CONCURRENT_EDIT',
          i18n.t('handler.kanban.cardWasModifiedByAnother', 'Card was modified by another user'),
          API_KANBAN_CARD_MOVE,
          {
            lastModifiedBy: faker.person.fullName(),
            lastModifiedAt: faker.date.recent().toISOString(),
          }
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_KANBAN_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.kanban.cardValidationFailed', 'Card validation failed'),
          API_KANBAN_CARDS,
          {
            title: i18n.t(
              'handler.kanban.titleMustBeAtLeast',
              'Title must be at least 3 characters'
            ),
            dueDate: i18n.t('handler.kanban.dueDateCannotBeIn', 'Due date cannot be in the past'),
            assignees: i18n.t(
              'handler.kanban.maximum5AssigneesAllowed',
              'Maximum 5 assignees allowed'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.kanban.tooManyRequests', 'Too many requests'),
          API_KANBAN_BOARD,
          {
            limit: '60/minute',
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
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.kanban.failedToLoadBoard', 'Failed to load board'),
          API_KANBAN_BOARD,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.kanban.kanbanServiceUnavailable', 'Kanban service unavailable'),
          API_KANBAN_BOARD
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.kanban.kanbanServiceUnderMaintenance',
            'Kanban service under maintenance'
          ),
          API_KANBAN_BOARD,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.kanban.boardLoadingTimedOut', 'Board loading timed out'),
          API_KANBAN_BOARD
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(5000);
      return HttpResponse.json(createFakeKanbanBoardResponse());
    }),
  ],

  networkError: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  empty: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(300);
      return HttpResponse.json({
        id: faker.string.uuid(),
        name: i18n.t('handler.kanban.emptyBoard', 'Empty Board'),
        columns: [
          {
            id: 'todo',
            title: i18n.t('handler.kanban.toDo', 'To Do'),
            status: 'todo',
            cards: [],
            color: '#6b7280',
          },
          {
            id: 'in-progress',
            title: i18n.t('handler.kanban.inProgress', 'In Progress'),
            status: 'in-progress',
            cards: [],
            color: '#3b82f6',
          },
          {
            id: 'done',
            title: i18n.t('handler.kanban.done', 'Done'),
            status: 'done',
            cards: [],
            color: '#22c55e',
          },
        ],
        members: [],
        createdAt: faker.date.past().toISOString(),
        updatedAt: faker.date.recent().toISOString(),
      });
    }),
  ],

  manyCards: [
    http.get(API_KANBAN_BOARD, async () => {
      await delay(500);
      const board = createFakeKanbanBoard();
      // Add more cards to each column
      board.forEach((column) => {
        const additionalCards = Array.from({ length: 10 }, () => createFakeKanbanCard());
        column.cards.push(...additionalCards);
      });
      return HttpResponse.json({
        id: faker.string.uuid(),
        name: i18n.t('handler.kanban.busyBoard', 'Busy Board'),
        columns: board,
        members: [],
        createdAt: faker.date.past().toISOString(),
        updatedAt: faker.date.recent().toISOString(),
      });
    }),
  ],

  columnLimitReached: [
    http.post(API_KANBAN_CARDS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'COLUMN_LIMIT',
          i18n.t('handler.kanban.columnHasReachedItsCard', 'Column has reached its card limit'),
          API_KANBAN_CARDS,
          {
            limit: '10',
            current: '10',
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],
};
