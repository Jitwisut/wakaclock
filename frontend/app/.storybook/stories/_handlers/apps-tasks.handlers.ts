import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS TASKS HANDLERS
// Enterprise-grade MSW handlers for tasks application page
// ============================================================================

// API Endpoints
const API_TASKS = '/api/apps/tasks';
const API_TASKS_LIST = '/api/apps/tasks/list';
const API_TASKS_CREATE = '/api/apps/tasks/create';
const API_TASKS_UPDATE = '/api/apps/tasks/update';
const API_TASKS_DELETE = '/api/apps/tasks/delete';
const API_TASKS_PROJECTS = '/api/apps/tasks/projects';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsTasksHandlers = [
  http.get(API_TASKS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalTasks: faker.number.int({ min: 50, max: 200 }),
      completedTasks: faker.number.int({ min: 20, max: 150 }),
      overdueTasks: faker.number.int({ min: 0, max: 20 }),
      todayTasks: faker.number.int({ min: 3, max: 15 }),
      upcomingTasks: faker.number.int({ min: 10, max: 50 }),
    });
  }),

  http.get(API_TASKS_LIST, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const projectId = url.searchParams.get('projectId');

    const tasks = Array.from({ length: 20 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraph(),
      status: faker.helpers.arrayElement(['todo', 'in-progress', 'completed', 'cancelled']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']),
      dueDate: faker.helpers.maybe(() => faker.date.soon().toISOString()),
      projectId: faker.string.uuid(),
      projectName: faker.helpers.arrayElement([
        i18n.t('handler.appsTasks.websiteRedesign', 'Website Redesign'),
        i18n.t('handler.appsTasks.mobileApp', 'Mobile App'),
        i18n.t('handler.appsTasks.apiDevelopment', 'API Development'),
        i18n.t('handler.appsTasks.marketingCampaign', 'Marketing Campaign'),
      ]),
      assignee: faker.helpers.maybe(() => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        avatar: faker.image.avatar(),
      })),
      tags: faker.helpers.arrayElements(
        ['bug', 'feature', 'improvement', 'documentation'],
        faker.number.int({ min: 0, max: 2 })
      ),
      subtasks: faker.number.int({ min: 0, max: 5 }),
      completedSubtasks: faker.number.int({ min: 0, max: 3 }),
      comments: faker.number.int({ min: 0, max: 10 }),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    }));

    return HttpResponse.json({ tasks, total: tasks.length, status, projectId });
  }),

  http.post(API_TASKS_CREATE, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { description?: string; title: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      title: body.title,
      description: body.description,
      status: 'todo',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    });
  }),

  http.put(`${API_TASKS_UPDATE}/:id`, async ({ request, params }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete(`${API_TASKS_DELETE}/:id`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      success: true,
      deletedAt: new Date().toISOString(),
    });
  }),

  http.get(API_TASKS_PROJECTS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const projects = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      name: faker.helpers.arrayElement([
        i18n.t('handler.appsTasks.websiteRedesign', 'Website Redesign'),
        i18n.t('handler.appsTasks.mobileApp', 'Mobile App'),
        i18n.t('handler.appsTasks.apiDevelopment', 'API Development'),
        i18n.t('handler.appsTasks.marketingCampaign', 'Marketing Campaign'),
        i18n.t('handler.appsTasks.dataMigration', 'Data Migration'),
      ]),
      color: faker.helpers.arrayElement(['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6']),
      tasksCount: faker.number.int({ min: 5, max: 50 }),
    }));
    return HttpResponse.json({ projects });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsTasksStatusHandlers = {
  success: appsTasksHandlers,
  badRequest: [
    http.get(API_TASKS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsTasks.invalidRequestParameters', 'Invalid request parameters'),
          API_TASKS,
          {
            field: 'data',
            error: i18n.t('handler.appsTasks.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_TASKS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsTasks.authenticationRequired', 'Authentication required'),
          API_TASKS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_TASKS_CREATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'CREATE_FORBIDDEN',
          i18n.t('handler.appsTasks.cannotCreateTasks', 'Cannot create tasks'),
          API_TASKS_CREATE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.put(`${API_TASKS_UPDATE}/:id`, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TASK_NOT_FOUND',
          i18n.t('handler.appsTasks.taskNotFound', 'Task not found'),
          API_TASKS_UPDATE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_TASKS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsTasks.requestValidationFailed', 'Request validation failed'),
          API_TASKS,
          {
            field: 'data',
            error: i18n.t('handler.appsTasks.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_TASKS_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.appsTasks.failedToLoadTasks', 'Failed to load tasks'),
          API_TASKS_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_TASKS_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_TASKS, () => HttpResponse.error())],
  emptyData: [
    http.get(API_TASKS_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ tasks: [], total: 0 });
    }),
  ],
};
