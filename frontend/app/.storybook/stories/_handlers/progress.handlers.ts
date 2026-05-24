import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeProgress } from '../_factories/progress.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_PROGRESS = '/api/progress/:id';
const API_PROGRESS_STREAM = '/api/progress/stream';

// Default success handlers
export const progressHandlers = [
  // GET /api/progress/:id
  http.get(API_PROGRESS, async ({ params }) => {
    await delay(faker.number.int({ min: 100, max: 300 }));

    const progress = createFakeProgress({ id: params.id as string });
    return HttpResponse.json(progress);
  }),

  // GET /api/progress/stream - simulates streaming progress updates
  http.get(API_PROGRESS_STREAM, async ({ request }) => {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId') ?? faker.string.uuid();
    const startValue = Number(url.searchParams.get('start') ?? 0);
    const increment = Number(url.searchParams.get('increment') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    // Simulate progress update (in real SSE this would be streaming)
    const currentValue = Math.min(startValue + increment, 100);
    const isComplete = currentValue >= 100;

    return HttpResponse.json({
      taskId,
      value: currentValue,
      max: 100,
      status: isComplete ? 'complete' : 'in_progress',
      message: isComplete
        ? i18n.t('handler.progress.taskCompletedSuccessfully', 'Task completed successfully')
        : `Processing... ${currentValue}% complete`,
      estimatedTimeRemaining: isComplete ? null : faker.number.int({ min: 5, max: 60 }),
      updatedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const progressStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: progressHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PROGRESS_ID',
          i18n.t('handler.progress.invalidProgressIdFormat', 'Invalid progress ID format'),
          API_PROGRESS,
          {
            id: i18n.t('handler.progress.mustBeAValidUuid', 'Must be a valid UUID'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
    http.get(API_PROGRESS_STREAM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.progress.invalidStreamParameters', 'Invalid stream parameters'),
          API_PROGRESS_STREAM,
          {
            start: i18n.t(
              'handler.progress.mustBeANumberBetween',
              'Must be a number between 0 and 100'
            ),
            increment: i18n.t(
              'handler.progress.mustBeAPositiveNumber',
              'Must be a positive number'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t(
            'handler.progress.authenticationRequiredToViewProgress',
            'Authentication required to view progress'
          ),
          API_PROGRESS
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.progress.accessDeniedToThisProgress',
            'Access denied to this progress tracker'
          ),
          `/api/progress/${params.id}`
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'PROGRESS_NOT_FOUND',
          `Progress tracker ${params.id} not found`,
          `/api/progress/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.progress.requestValidationFailed', 'Request validation failed'),
          API_PROGRESS,
          {
            field: 'data',
            error: i18n.t('handler.progress.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_PROGRESS_STREAM, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.progress.tooManyProgressStreamRequests',
            'Too many progress stream requests'
          ),
          API_PROGRESS_STREAM,
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

  conflict: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'PROGRESS_CONFLICT',
          i18n.t(
            'handler.progress.progressTrackerWasUpdatedBy',
            'Progress tracker was updated by another session'
          ),
          `/api/progress/${params.id}`,
          {
            suggestion: i18n.t(
              'handler.progress.pleaseRefreshAndTryAgain',
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
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'TRACKING_ERROR',
          i18n.t(
            'handler.progress.failedToRetrieveProgressData',
            'Failed to retrieve progress data'
          ),
          API_PROGRESS,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.get(API_PROGRESS_STREAM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'STREAM_ERROR',
          i18n.t(
            'handler.progress.progressStreamingServiceUnavailable',
            'Progress streaming service unavailable'
          ),
          API_PROGRESS_STREAM
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.progress.progressTrackingServiceIsUnder',
            'Progress tracking service is under maintenance'
          ),
          API_PROGRESS,
          {
            retryAfter: '120',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.get(API_PROGRESS_STREAM, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'STREAM_TIMEOUT',
          i18n.t('handler.progress.progressStreamTimedOut', 'Progress stream timed out'),
          API_PROGRESS_STREAM
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_PROGRESS, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(5000);
      const progress = createFakeProgress({ id: params.id as string });
      return HttpResponse.json(progress);
    }),
  ],

  networkError: [
    http.get(API_PROGRESS, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(300);
      return HttpResponse.json({
        id: params.id,
        value: 0,
        max: 100,
        label: null,
        variant: 'default',
      });
    }),
  ],

  // ============ PROGRESS-SPECIFIC STATES ============
  complete: [
    http.get(API_PROGRESS, async ({ params }) => {
      await delay(200);
      return HttpResponse.json({
        id: params.id,
        value: 100,
        max: 100,
        label: i18n.t('handler.progress.complete', 'Complete'),
        variant: 'success',
      });
    }),
  ],

  stalled: [
    http.get(API_PROGRESS_STREAM, async ({ request }) => {
      const url = new URL(request.url);
      const taskId = url.searchParams.get('taskId') ?? faker.string.uuid();
      await delay(300);
      return HttpResponse.json({
        taskId,
        value: 45,
        max: 100,
        status: 'stalled',
        message: i18n.t(
          'handler.progress.progressHasStalledPleaseTry',
          'Progress has stalled. Please try again later.'
        ),
        estimatedTimeRemaining: null,
        updatedAt: new Date().toISOString(),
      });
    }),
  ],

  failed: [
    http.get(API_PROGRESS_STREAM, async ({ request }) => {
      const url = new URL(request.url);
      const taskId = url.searchParams.get('taskId') ?? faker.string.uuid();
      await delay(300);
      return HttpResponse.json({
        taskId,
        value: 67,
        max: 100,
        status: 'failed',
        message: i18n.t(
          'handler.progress.taskFailedAt67Error',
          'Task failed at 67%. Error: Insufficient resources.'
        ),
        estimatedTimeRemaining: null,
        updatedAt: new Date().toISOString(),
        error: {
          code: 'RESOURCE_EXHAUSTED',
          details: i18n.t('handler.progress.memoryLimitExceeded', 'Memory limit exceeded'),
        },
      });
    }),
  ],
};
