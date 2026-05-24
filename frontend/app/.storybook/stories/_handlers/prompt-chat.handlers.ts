import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createFakeChatMessage, createFakeChatMessages } from '../_factories/prompt-chat.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_CHAT_MESSAGES = '/api/chat/messages';
const API_CHAT_MESSAGES_BY_ID = '/api/chat/messages/:id';
const API_CHAT_SEND = '/api/chat/send';

// Default success handlers
export const promptChatHandlers = [
  // GET /api/chat/messages
  http.get(API_CHAT_MESSAGES, async ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);

    await delay(faker.number.int({ min: 200, max: 500 }));

    const messages = createFakeChatMessages(limit);
    return HttpResponse.json({
      messages,
      count: messages.length,
    });
  }),

  // GET /api/chat/messages/:id
  http.get(API_CHAT_MESSAGES_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    const message = createFakeChatMessage();
    return HttpResponse.json({ ...message, id: params.id });
  }),

  // POST /api/chat/send
  http.post(API_CHAT_SEND, async () => {
    await delay(faker.number.int({ min: 300, max: 800 }));
    const message = createFakeChatMessage({ role: 'assistant', status: 'delivered' });
    return HttpResponse.json(message);
  }),
];

// Status-specific handlers for stories
export const promptChatStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: promptChatHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.promptChat.invalidQueryParameters', 'Invalid query parameters'),
          API_CHAT_MESSAGES,
          {
            limit: i18n.t(
              'handler.promptChat.mustBeAPositiveInteger',
              'Must be a positive integer'
            ),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.promptChat.authenticationRequired', 'Authentication required'),
          API_CHAT_MESSAGES
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.promptChat.accessDeniedToChatMessages', 'Access denied to chat messages'),
          API_CHAT_MESSAGES
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_CHAT_MESSAGES_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'MESSAGE_NOT_FOUND',
          `Message ${params.id} not found`,
          API_CHAT_MESSAGES_BY_ID
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  tooManyRequests: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.promptChat.apiRateLimitExceeded', 'API rate limit exceeded'),
          API_CHAT_MESSAGES,
          {
            limit: '100/minute',
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
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'DATABASE_ERROR',
          i18n.t('handler.promptChat.failedToFetchChatMessages', 'Failed to fetch chat messages'),
          API_CHAT_MESSAGES,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  serviceUnavailable: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptChat.chatServiceUnderMaintenance',
            'Chat service under maintenance'
          ),
          API_CHAT_MESSAGES,
          {
            retryAfter: '300',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(5000);
      return HttpResponse.json({
        messages: createFakeChatMessages(10),
        count: 10,
      });
    }),
  ],

  networkError: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyData: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(300);
      return HttpResponse.json({
        messages: [],
        count: 0,
      });
    }),
  ],
};
