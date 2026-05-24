import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT MESSAGE HANDLERS
// Enterprise-grade MSW handlers for prompt message component
// ============================================================================

// API Endpoints
const API_MESSAGE = '/api/message';
const API_MESSAGE_GET = '/api/message/:id';
const API_MESSAGE_FEEDBACK = '/api/message/feedback';
const API_MESSAGE_COPY = '/api/message/copy';
const API_MESSAGE_REGENERATE = '/api/message/regenerate';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptMessageHandlers = [
  http.get(API_MESSAGE_GET, async ({ params }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      id: params.id,
      role: faker.helpers.arrayElement(['user', 'assistant']),
      content: faker.lorem.paragraphs(2),
      timestamp: faker.date.recent().toISOString(),
      tokens: faker.number.int({ min: 50, max: 500 }),
    });
  }),

  http.post(API_MESSAGE_FEEDBACK, async ({ request }) => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const body = (await request.json()) as { messageId: string; rating: 'negative' | 'positive' };
    return HttpResponse.json({
      success: true,
      messageId: body.messageId,
      rating: body.rating,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(API_MESSAGE_COPY, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({ success: true, timestamp: new Date().toISOString() });
  }),

  http.post(API_MESSAGE_REGENERATE, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1500 }));
    const body = (await request.json()) as { messageId: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      originalId: body.messageId,
      content: faker.lorem.paragraphs(2),
      regeneratedAt: new Date().toISOString(),
    });
  }),

  http.get(API_MESSAGE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0' });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptMessageStatusHandlers = {
  success: promptMessageHandlers,
  badRequest: [
    http.post(API_MESSAGE_FEEDBACK, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_FEEDBACK',
          i18n.t('handler.promptMessage.invalidFeedbackData', 'Invalid feedback data'),
          API_MESSAGE_FEEDBACK
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_MESSAGE_FEEDBACK, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.promptMessage.authenticationRequired', 'Authentication required'),
          API_MESSAGE_FEEDBACK
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  notFound: [
    http.get(API_MESSAGE_GET, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptMessage.messageNotFound', 'Message not found'),
          API_MESSAGE_GET
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  forbidden: [
    http.get(API_MESSAGE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.promptMessage.accessDeniedToThisResource',
            'Access denied to this resource'
          ),
          API_MESSAGE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  conflict: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'REGENERATE_CONFLICT',
          i18n.t(
            'handler.promptMessage.messageRegenerationAlreadyInProgress',
            'Message regeneration already in progress'
          ),
          API_MESSAGE_REGENERATE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.promptMessage.tooManyMessageRequests', 'Too many message requests'),
          API_MESSAGE_REGENERATE,
          {
            limit: '10/minute',
            remaining: '0',
            resetAt: new Date(Date.now() + 60_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_MESSAGE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptMessage.requestValidationFailed', 'Request validation failed'),
          API_MESSAGE,
          {
            field: 'data',
            error: i18n.t('handler.promptMessage.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.promptMessage.failedToRegenerateMessage', 'Failed to regenerate message'),
          API_MESSAGE_REGENERATE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.promptMessage.messageServiceUnavailable', 'Message service unavailable'),
          API_MESSAGE_REGENERATE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptMessage.messageServiceIsUnderMaintenance',
            'Message service is under maintenance'
          ),
          API_MESSAGE_REGENERATE,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.promptMessage.messageRequestTimedOut', 'Message request timed out'),
          API_MESSAGE_REGENERATE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay(5000);
      return HttpResponse.json({
        id: faker.string.uuid(),
        originalId: 'original-id',
        content: faker.lorem.paragraphs(2),
        regeneratedAt: new Date().toISOString(),
      });
    }),
  ],
  loading: [
    http.post(API_MESSAGE_REGENERATE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_MESSAGE_REGENERATE, () => HttpResponse.error())],
};
