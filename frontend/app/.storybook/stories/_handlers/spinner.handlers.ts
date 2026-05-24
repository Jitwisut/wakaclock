import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_SPINNER_STATUS = '/api/spinner/status';
const API_SPINNER_PROGRESS = '/api/spinner/progress';
const API_SPINNER_CONFIG = '/api/spinner/config';

// Default success handlers
export const spinnerHandlers = [
  // GET /api/spinner/status - Get loading status
  http.get(API_SPINNER_STATUS, async ({ request }) => {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId') ?? faker.string.uuid();

    await delay(faker.number.int({ min: 100, max: 300 }));

    return HttpResponse.json({
      taskId,
      status: faker.helpers.arrayElement(['pending', 'loading', 'completed', 'failed']),
      progress: faker.number.int({ min: 0, max: 100 }),
      message: faker.lorem.sentence({ min: 2, max: 5 }),
      startedAt: faker.date.recent().toISOString(),
    });
  }),

  // GET /api/spinner/progress - Get progress updates
  http.get(API_SPINNER_PROGRESS, async ({ request }) => {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    await delay(faker.number.int({ min: 50, max: 200 }));

    return HttpResponse.json({
      taskId,
      progress: faker.number.int({ min: 0, max: 100 }),
      step: faker.number.int({ min: 1, max: 10 }),
      totalSteps: 10,
      currentStep: faker.lorem.words({ min: 2, max: 4 }),
      estimatedTimeRemaining: faker.number.int({ min: 1, max: 60 }),
    });
  }),

  // GET /api/spinner/config - Get spinner configuration
  http.get(API_SPINNER_CONFIG, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));

    return HttpResponse.json({
      size: faker.helpers.arrayElement(['sm', 'md', 'lg']),
      color: faker.helpers.arrayElement(['primary', 'secondary', 'muted']),
      speed: faker.helpers.arrayElement(['slow', 'normal', 'fast']),
      showProgress: faker.datatype.boolean({ probability: 0.5 }),
      showLabel: faker.datatype.boolean({ probability: 0.7 }),
    });
  }),
];

// Status-specific handlers for stories
export const spinnerStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: spinnerHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_TASK_ID',
          i18n.t('handler.spinner.invalidTaskIdFormat', 'Invalid task ID format'),
          API_SPINNER_STATUS,
          { taskId: i18n.t('handler.spinner.mustBeAValidUuid', 'Must be a valid UUID') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.spinner.authenticationRequiredToCheckStatus',
            'Authentication required to check status'
          ),
          API_SPINNER_STATUS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SPINNER_PROGRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.spinner.accessDeniedToTaskProgress', 'Access denied to task progress'),
          API_SPINNER_PROGRESS
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'TASK_NOT_FOUND',
          i18n.t('handler.spinner.taskNotFound', 'Task not found'),
          API_SPINNER_STATUS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.get(API_SPINNER_PROGRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'TASK_CANCELLED',
          i18n.t('handler.spinner.taskWasCancelled', 'Task was cancelled'),
          API_SPINNER_PROGRESS
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_SPINNER_CONFIG, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.spinner.invalidSpinnerConfiguration', 'Invalid spinner configuration'),
          API_SPINNER_CONFIG,
          { size: i18n.t('handler.spinner.invalidSizeValue', 'Invalid size value') }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_SPINNER_PROGRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.spinner.tooManyProgressRequests', 'Too many progress requests'),
          API_SPINNER_PROGRESS,
          { retryAfter: '1' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'STATUS_FAILED',
          i18n.t('handler.spinner.failedToGetTaskStatus', 'Failed to get task status'),
          API_SPINNER_STATUS,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.spinner.taskServiceTemporarilyUnavailable',
            'Task service temporarily unavailable'
          ),
          API_SPINNER_STATUS
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.spinner.taskServiceIsUnderMaintenance',
            'Task service is under maintenance'
          ),
          API_SPINNER_STATUS,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_SPINNER_PROGRESS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.spinner.progressRequestTimedOut', 'Progress request timed out'),
          API_SPINNER_PROGRESS
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(4000);
      return HttpResponse.json({
        taskId: faker.string.uuid(),
        status: 'completed',
        progress: 100,
      });
    }),
  ],

  networkError: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_SPINNER_STATUS, async () => {
      await delay(200);
      return HttpResponse.json({
        taskId: null,
        status: 'idle',
        progress: 0,
        message: null,
      });
    }),
  ],
};
