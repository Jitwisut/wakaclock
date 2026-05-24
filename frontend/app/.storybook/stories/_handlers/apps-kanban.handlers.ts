import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS KANBAN HANDLERS
// Enterprise-grade MSW handlers for kanban application page
// ============================================================================

// API Endpoints
const API_KANBAN = '/api/apps/kanban';
const API_KANBAN_BOARDS = '/api/apps/kanban/boards';
const API_KANBAN_COLUMNS = '/api/apps/kanban/columns';
const API_KANBAN_CARDS = '/api/apps/kanban/cards';
const API_KANBAN_MOVE = '/api/apps/kanban/move';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsKanbanHandlers = [
  http.get(API_KANBAN, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalBoards: faker.number.int({ min: 1, max: 10 }),
      totalCards: faker.number.int({ min: 20, max: 200 }),
      activeBoard: 'main-board',
    });
  }),

  http.get(API_KANBAN_BOARDS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const boards = Array.from({ length: 3 }, () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        i18n.t('handler.appsKanban.mainProject', 'Main Project'),
        i18n.t('handler.appsKanban.sprintBoard', 'Sprint Board'),
        i18n.t('handler.appsKanban.bugTracking', 'Bug Tracking'),
        i18n.t('handler.appsKanban.featureRequests', 'Feature Requests'),
      ]),
      description: faker.lorem.sentence(),
      columnsCount: faker.number.int({ min: 3, max: 6 }),
      cardsCount: faker.number.int({ min: 10, max: 50 }),
      createdAt: faker.date.past().toISOString(),
    }));
    return HttpResponse.json({ boards });
  }),

  http.get(`${API_KANBAN_COLUMNS}/:boardId`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const columns = [
      {
        id: 'backlog',
        name: i18n.t('handler.appsKanban.backlog', 'Backlog'),
        order: 0,
        color: '#6b7280',
      },
      { id: 'todo', name: i18n.t('handler.appsKanban.toDo', 'To Do'), order: 1, color: '#3b82f6' },
      {
        id: 'in-progress',
        name: i18n.t('handler.appsKanban.inProgress', 'In Progress'),
        order: 2,
        color: '#f59e0b',
      },
      {
        id: 'review',
        name: i18n.t('handler.appsKanban.review', 'Review'),
        order: 3,
        color: '#8b5cf6',
      },
      { id: 'done', name: i18n.t('handler.appsKanban.done', 'Done'), order: 4, color: '#22c55e' },
    ];
    return HttpResponse.json({ columns });
  }),

  http.get(`${API_KANBAN_CARDS}/:boardId`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const cards = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraph(),
      columnId: faker.helpers.arrayElement(['backlog', 'todo', 'in-progress', 'review', 'done']),
      order: faker.number.int({ min: 0, max: 10 }),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      labels: faker.helpers.arrayElements(
        ['bug', 'feature', 'enhancement', 'documentation', 'design'],
        faker.number.int({ min: 0, max: 3 })
      ),
      assignees: Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
      })),
      dueDate: faker.helpers.maybe(() => faker.date.soon().toISOString()),
      commentsCount: faker.number.int({ min: 0, max: 15 }),
      attachmentsCount: faker.number.int({ min: 0, max: 5 }),
      createdAt: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ cards });
  }),

  http.post(API_KANBAN_MOVE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { cardId: string; toColumnId: string; toIndex: number };
    return HttpResponse.json({
      success: true,
      cardId: body.cardId,
      movedTo: body.toColumnId,
      newIndex: body.toIndex,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(API_KANBAN_CARDS, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { columnId: string; title: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      title: body.title,
      columnId: body.columnId,
      order: 0,
      createdAt: new Date().toISOString(),
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsKanbanStatusHandlers = {
  success: appsKanbanHandlers,
  badRequest: [
    http.get(API_KANBAN, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsKanban.invalidRequestParameters', 'Invalid request parameters'),
          API_KANBAN,
          {
            field: 'data',
            error: i18n.t('handler.appsKanban.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_KANBAN, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsKanban.authenticationRequired', 'Authentication required'),
          API_KANBAN
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_KANBAN_MOVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'MOVE_FORBIDDEN',
          i18n.t('handler.appsKanban.cannotMoveCardsOnThis', 'Cannot move cards on this board'),
          API_KANBAN_MOVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(`${API_KANBAN_CARDS}/:boardId`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'BOARD_NOT_FOUND',
          i18n.t('handler.appsKanban.boardNotFound', 'Board not found'),
          API_KANBAN_CARDS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_KANBAN, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsKanban.requestValidationFailed', 'Request validation failed'),
          API_KANBAN,
          {
            field: 'data',
            error: i18n.t('handler.appsKanban.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_KANBAN_MOVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsKanban.failedToMoveCard', 'Failed to move card'),
          API_KANBAN_MOVE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(`${API_KANBAN_CARDS}/:boardId`, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_KANBAN, () => HttpResponse.error())],
  emptyData: [
    http.get(`${API_KANBAN_CARDS}/:boardId`, async () => {
      await delay(100);
      return HttpResponse.json({ cards: [] });
    }),
  ],
};
