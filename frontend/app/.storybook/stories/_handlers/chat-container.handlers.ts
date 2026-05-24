import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// CHAT CONTAINER HANDLERS
// Enterprise-grade MSW handlers for chat container component
// ============================================================================

// API Endpoints
const API_CHAT = '/api/chat';
const API_CHAT_MESSAGES = '/api/chat/messages';
const API_CHAT_SEND = '/api/chat/send';
const API_CHAT_STREAM = '/api/chat/stream';

// Types
interface Message {
  content: string;
  id: string;
  role: 'assistant' | 'system' | 'user';
  timestamp: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const chatContainerHandlers = [
  http.get(API_CHAT_MESSAGES, async () => {
    await delay(faker.number.int({ min: 100, max: 250 }));
    const messages: Message[] = Array.from({ length: 5 }, () => ({
      id: faker.string.uuid(),
      role: faker.helpers.arrayElement(['user', 'assistant'] as const),
      content: faker.lorem.paragraph(),
      timestamp: faker.date.recent().toISOString(),
    }));
    return HttpResponse.json({ messages });
  }),

  http.post(API_CHAT_SEND, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { content: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      role: 'assistant',
      content: faker.lorem.paragraph(),
      inReplyTo: body.content,
      timestamp: new Date().toISOString(),
    });
  }),

  http.post(API_CHAT_STREAM, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({ streamId: faker.string.uuid(), status: 'streaming' });
  }),

  http.get(API_CHAT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0', maxTokens: 4096 });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const chatContainerStatusHandlers = {
  success: chatContainerHandlers,
  badRequest: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MESSAGE',
          i18n.t('handler.chatContainer.invalidMessageContent', 'Invalid message content'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.chatContainer.authenticationRequired', 'Authentication required'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'CHAT_DISABLED',
          i18n.t('handler.chatContainer.chatIsDisabled', 'Chat is disabled'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.chatContainer.chatConversationNotFound', 'Chat conversation not found'),
          API_CHAT_MESSAGES
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'MESSAGE_CONFLICT',
          i18n.t(
            'handler.chatContainer.messageAlreadyBeingProcessed',
            'Message already being processed'
          ),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.chatContainer.requestValidationFailed', 'Request validation failed'),
          API_CHAT,
          {
            field: 'data',
            error: i18n.t('handler.chatContainer.invalidDataFormat', 'Invalid data format'),
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
          'RATE_LIMIT',
          i18n.t(
            'handler.chatContainer.tooManyMessagesPleaseWait',
            'Too many messages. Please wait.'
          ),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.post(API_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.chatContainer.failedToProcessMessage', 'Failed to process message'),
          API_CHAT_SEND
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
          'UPSTREAM_ERROR',
          i18n.t('handler.chatContainer.chatServiceUnavailable', 'Chat service unavailable'),
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
          'MAINTENANCE',
          i18n.t(
            'handler.chatContainer.chatServiceIsUnderMaintenance',
            'Chat service is under maintenance'
          ),
          API_CHAT_SEND,
          { retryAfter: '60' }
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
          i18n.t('handler.chatContainer.chatRequestTimedOut', 'Chat request timed out'),
          API_CHAT_SEND
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_CHAT_SEND, async () => {
      await delay(5000);
      return HttpResponse.json({
        id: faker.string.uuid(),
        role: 'assistant',
        content: faker.lorem.paragraph(),
        timestamp: new Date().toISOString(),
      });
    }),
  ],
  loading: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_CHAT_SEND, () => HttpResponse.error())],
  emptyData: [
    http.get(API_CHAT_MESSAGES, async () => {
      await delay(100);
      return HttpResponse.json({ messages: [] });
    }),
  ],
};
