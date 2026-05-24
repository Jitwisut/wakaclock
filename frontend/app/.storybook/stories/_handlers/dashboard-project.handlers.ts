import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// DASHBOARD PROJECT HANDLERS
// Enterprise-grade MSW handlers for project management dashboard page
// ============================================================================

// API Endpoints
const API_PROJECT = '/api/dashboard/project';
const API_PROJECT_LIST = '/api/dashboard/project/list';
const API_PROJECT_TASKS = '/api/dashboard/project/tasks';
const API_PROJECT_TEAM = '/api/dashboard/project/team';
const API_PROJECT_TIMELINE = '/api/dashboard/project/timeline';
const API_PROJECT_METRICS = '/api/dashboard/project/metrics';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const dashboardProjectHandlers = [
  http.get(API_PROJECT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalProjects: faker.number.int({ min: 10, max: 100 }),
      activeProjects: faker.number.int({ min: 5, max: 50 }),
      completedProjects: faker.number.int({ min: 5, max: 50 }),
      totalTasks: faker.number.int({ min: 100, max: 1000 }),
      completedTasks: faker.number.int({ min: 50, max: 800 }),
      teamMembers: faker.number.int({ min: 10, max: 100 }),
      onTimeRate: faker.number.float({ min: 70, max: 95, fractionDigits: 1 }),
    });
  }),

  http.get(API_PROJECT_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const projects = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      description: faker.lorem.sentence(),
      status: faker.helpers.arrayElement([
        'planning',
        'in-progress',
        'review',
        'completed',
        'on-hold',
      ]),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
      progress: faker.number.int({ min: 0, max: 100 }),
      startDate: faker.date.past().toISOString(),
      dueDate: faker.date.future().toISOString(),
      manager: faker.person.fullName(),
      teamSize: faker.number.int({ min: 2, max: 15 }),
      budget: faker.number.float({ min: 10_000, max: 500_000, fractionDigits: 2 }),
    }));
    return HttpResponse.json({ projects, total: projects.length });
  }),

  http.get(API_PROJECT_TASKS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const tasks = Array.from({ length: 15 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      project: faker.commerce.productName(),
      status: faker.helpers.arrayElement(['todo', 'in-progress', 'review', 'done']),
      priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
      assignee: faker.person.fullName(),
      dueDate: faker.date.soon().toISOString(),
      tags: faker.helpers.arrayElements(
        ['frontend', 'backend', 'design', 'testing', 'documentation'],
        2
      ),
    }));
    return HttpResponse.json({ tasks, total: tasks.length });
  }),

  http.get(API_PROJECT_TEAM, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const members = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      role: faker.helpers.arrayElement([
        i18n.t('handler.dashboardProject.developer', 'Developer'),
        i18n.t('handler.dashboardProject.designer', 'Designer'),
        'PM',
        'QA',
        'DevOps',
      ]),
      projects: faker.number.int({ min: 1, max: 5 }),
      tasksCompleted: faker.number.int({ min: 10, max: 100 }),
      availability: faker.number.int({ min: 0, max: 100 }),
    }));
    return HttpResponse.json({ members, total: members.length });
  }),

  http.get(API_PROJECT_TIMELINE, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const milestones = Array.from({ length: 6 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 2, max: 5 }),
      date: faker.date.soon().toISOString(),
      status: faker.helpers.arrayElement(['completed', 'in-progress', 'upcoming']),
      project: faker.commerce.productName(),
    }));
    return HttpResponse.json({ milestones });
  }),

  http.get(API_PROJECT_METRICS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const weeklyData = Array.from({ length: 12 }, (_, i) => ({
      week: `W${i + 1}`,
      tasksCreated: faker.number.int({ min: 10, max: 50 }),
      tasksCompleted: faker.number.int({ min: 8, max: 45 }),
      hoursLogged: faker.number.int({ min: 100, max: 500 }),
    }));
    return HttpResponse.json({ weeklyData });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const dashboardProjectStatusHandlers = {
  success: dashboardProjectHandlers,
  badRequest: [
    http.get(API_PROJECT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.dashboardProject.invalidRequestParameters', 'Invalid request parameters'),
          API_PROJECT,
          {
            field: 'data',
            error: i18n.t('handler.dashboardProject.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_PROJECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.dashboardProject.authenticationRequired', 'Authentication required'),
          API_PROJECT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.get(API_PROJECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'ACCESS_DENIED',
          i18n.t(
            'handler.dashboardProject.accessToProjectDashboardDenied',
            'Access to project dashboard denied'
          ),
          API_PROJECT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_PROJECT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.dashboardProject.requestValidationFailed', 'Request validation failed'),
          API_PROJECT,
          {
            field: 'data',
            error: i18n.t('handler.dashboardProject.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_PROJECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t(
            'handler.dashboardProject.failedToLoadProjectDashboard',
            'Failed to load project dashboard'
          ),
          API_PROJECT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.get(API_PROJECT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_PROJECT, () => HttpResponse.error())],
  emptyData: [
    http.get(API_PROJECT_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ projects: [], total: 0 });
    }),
  ],
};
