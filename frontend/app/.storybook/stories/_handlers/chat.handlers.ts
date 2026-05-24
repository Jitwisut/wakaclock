import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import {
  createFakeChatConversations,
  createFakeChatHistory,
  createFakeSuggestions,
} from '../_factories/chat.factory';
import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_CHAT_HISTORY = '/api/chat/history';
const API_CHAT_CONVERSATIONS = '/api/chat/conversations';
const API_CHAT_CONVERSATION_BY_ID = '/api/chat/conversations/:id';
const API_CHAT_SEND = '/api/chat/send';
const API_CHAT_SUGGESTIONS = '/api/chat/suggestions';

// Default success handlers
export const chatHandlers = [
  // GET /api/chat/history
  http.get(API_CHAT_HISTORY, async () => {
    await delay(faker.number.int({ min: 300, max: 800 }));
    return HttpResponse.json({
      messages: createFakeChatHistory(faker.number.int({ min: 4, max: 10 })),
    });
  }),

  // GET /api/chat/conversations
  http.get(API_CHAT_CONVERSATIONS, async () => {
    await delay(faker.number.int({ min: 300, max: 700 }));
    return HttpResponse.json({
      conversations: createFakeChatConversations(faker.number.int({ min: 3, max: 8 })),
    });
  }),

  // GET /api/chat/conversations/:id
  http.get(API_CHAT_CONVERSATION_BY_ID, async ({ params }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      id: params.id,
      title: faker.lorem.sentence({ min: 3, max: 6 }),
      messages: createFakeChatHistory(faker.number.int({ min: 4, max: 10 })),
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    });
  }),

  // POST /api/chat/send
  http.post(API_CHAT_SEND, async ({ request }) => {
    // Parse request body (message not used in mock response)
    await request.json();

    // Simulate thinking delay
    await delay(faker.number.int({ min: 500, max: 2000 }));

    return HttpResponse.json({
      id: faker.string.uuid(),
      role: 'assistant',
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
      createdAt: new Date().toISOString(),
      metadata: {
        model: 'gpt-4',
        tokens: faker.number.int({ min: 50, max: 500 }),
        latency: faker.number.int({ min: 500, max: 2000 }),
      },
    });
  }),

  // POST /api/chat/conversations
  http.post(API_CHAT_CONVERSATIONS, async ({ request }) => {
    const body = await request.json();
    await delay(faker.number.int({ min: 300, max: 600 }));
    return HttpResponse.json(
      {
        id: faker.string.uuid(),
        ...(body as object),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: HTTP_STATUS.CREATED }
    );
  }),

  // DELETE /api/chat/conversations/:id
  http.delete(API_CHAT_CONVERSATION_BY_ID, async () => {
    await delay(faker.number.int({ min: 200, max: 400 }));
    return new HttpResponse(null, { status: HTTP_STATUS.NO_CONTENT });
  }),

  // GET /api/chat/suggestions
  http.get(API_CHAT_SUGGESTIONS, async () => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    return HttpResponse.json({
      suggestions: createFakeSuggestions(4),
    });
  }),
];

// Status-specific handlers for stories
export const chatStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: chatHandlers,

  // ============ 4xx CLIENT ERRORS ============
  badRequest: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MESSAGE',
          i18n.t('handler.chat.messageIsInvalid', 'Message is invalid'),
          API_CHAT_SEND,
          {
            message: i18n.t('handler.chat.messageCannotBeEmpty', 'Message cannot be empty'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_CHAT_HISTORY, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.chat.pleaseLogInToAccess', 'Please log in to access chat'),
          API_CHAT_HISTORY
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'SESSION_EXPIRED',
          i18n.t('handler.chat.yourSessionHasExpired', 'Your session has expired'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'QUOTA_EXCEEDED',
          i18n.t('handler.chat.yourMessageQuotaHasBeen', 'Your message quota has been exceeded'),
          API_CHAT_SEND,
          {
            quota: '100 messages/day',
            used: '100',
            resetAt: new Date(Date.now() + 86_400_000).toISOString(),
          }
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.get(API_CHAT_CONVERSATION_BY_ID, async ({ params }) => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'CONVERSATION_NOT_FOUND',
          `Conversation ${params.id} not found`,
          `/api/chat/conversations/${params.id}`
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'CONTENT_POLICY',
          i18n.t('handler.chat.messageViolatesContentPolicy', 'Message violates content policy'),
          API_CHAT_SEND,
          {
            policy: i18n.t(
              'handler.chat.messagesCannotContainHarmfulContent',
              'Messages cannot contain harmful content'
            ),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.chat.tooManyMessages', 'Too many messages'),
          API_CHAT_SEND,
          {
            limit: '20 messages/minute',
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
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'AI_ERROR',
          i18n.t('handler.chat.aiServiceEncounteredAnError', 'AI service encountered an error'),
          API_CHAT_SEND,
          {
            errorId: faker.string.uuid(),
          }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'MODEL_UNAVAILABLE',
          i18n.t('handler.chat.aiModelIsUnavailable', 'AI model is unavailable'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'OVERLOADED',
          i18n.t('handler.chat.chatServiceIsOverloaded', 'Chat service is overloaded'),
          API_CHAT_SEND,
          {
            position: '15',
            estimatedWait: '30 seconds',
          }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.chat.aiResponseTimedOut', 'AI response timed out'),
          API_CHAT_SEND,
          {
            timeout: '60000',
          }
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_CHAT_SEND, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowResponse: [
    http.post(API_CHAT_SEND, async () => {
      await delay(8000);
      return HttpResponse.json({
        id: faker.string.uuid(),
        role: 'assistant',
        content: faker.lorem.paragraphs(3),
        createdAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_CHAT_SEND, async () => {
      await delay(300);
      return HttpResponse.error();
    }),
  ],

  emptyHistory: [
    http.get(API_CHAT_HISTORY, async () => {
      await delay(300);
      return HttpResponse.json({ messages: [] });
    }),
  ],

  longConversation: [
    http.get(API_CHAT_HISTORY, async () => {
      await delay(500);
      return HttpResponse.json({
        messages: createFakeChatHistory(50),
      });
    }),
  ],

  // ============ STREAMING SIMULATION ============
  streaming: [
    http.post(API_CHAT_SEND, async () => {
      // Simulate initial delay before streaming starts
      await delay(500);

      const fullResponse = faker.lorem.paragraphs(2);

      return HttpResponse.json({
        id: faker.string.uuid(),
        role: 'assistant',
        content: fullResponse,
        createdAt: new Date().toISOString(),
        metadata: {
          model: 'gpt-4',
          streaming: true,
          tokens: fullResponse.split(' ').length,
        },
      });
    }),
  ],
};
