import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// APPS AI CHAT HANDLERS
// Enterprise-grade MSW handlers for AI chat application pages
// ============================================================================

// API Endpoints
const API_AI_CHAT = '/api/apps/ai-chat';
const API_AI_CHAT_CONVERSATIONS = '/api/apps/ai-chat/conversations';
const API_AI_CHAT_MESSAGES = '/api/apps/ai-chat/messages';
const API_AI_CHAT_SEND = '/api/apps/ai-chat/send';
// Streaming endpoint - reserved for future SSE implementation
// const API_AI_CHAT_STREAM = '/api/apps/ai-chat/stream';
const API_AI_CHAT_MODELS = '/api/apps/ai-chat/models';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const appsAiChatHandlers = [
  http.get(API_AI_CHAT, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      totalConversations: faker.number.int({ min: 10, max: 100 }),
      totalMessages: faker.number.int({ min: 100, max: 1000 }),
      tokensUsed: faker.number.int({ min: 10_000, max: 500_000 }),
      tokensLimit: 1_000_000,
      activeModel: 'gpt-4',
    });
  }),

  http.get(API_AI_CHAT_CONVERSATIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const conversations = Array.from({ length: 10 }, () => ({
      id: faker.string.uuid(),
      title: faker.lorem.sentence({ min: 3, max: 8 }),
      preview: faker.lorem.sentence(),
      messageCount: faker.number.int({ min: 2, max: 50 }),
      model: faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-2']),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      pinned: faker.datatype.boolean({ probability: 0.2 }),
    }));
    return HttpResponse.json({ conversations, total: conversations.length });
  }),

  http.get(`${API_AI_CHAT_MESSAGES}/:conversationId`, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const messages = Array.from({ length: faker.number.int({ min: 4, max: 20 }) }, (_, i) => ({
      id: faker.string.uuid(),
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: faker.lorem.paragraphs({ min: 1, max: 3 }),
      timestamp: new Date(Date.now() - (20 - i) * 60_000).toISOString(),
      tokens: faker.number.int({ min: 50, max: 500 }),
    }));
    return HttpResponse.json({ messages });
  }),

  http.post(API_AI_CHAT_SEND, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 2000 }));
    const body = (await request.json()) as { conversationId?: string; message: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      conversationId: body.conversationId || faker.string.uuid(),
      role: 'assistant',
      content: faker.lorem.paragraphs({ min: 1, max: 4 }),
      timestamp: new Date().toISOString(),
      tokens: faker.number.int({ min: 100, max: 800 }),
      model: 'gpt-4',
    });
  }),

  http.get(API_AI_CHAT_MODELS, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const models = [
      {
        id: 'gpt-4',
        name: i18n.t('handler.appsAiChat.gpt4', 'GPT-4'),
        provider: i18n.t('handler.appsAiChat.openAi', 'OpenAI'),
        maxTokens: 8192,
        available: true,
      },
      {
        id: 'gpt-3.5-turbo',
        name: i18n.t('handler.appsAiChat.gpt35Turbo', 'GPT-3.5 Turbo'),
        provider: i18n.t('handler.appsAiChat.openAi', 'OpenAI'),
        maxTokens: 4096,
        available: true,
      },
      {
        id: 'claude-2',
        name: i18n.t('handler.appsAiChat.claude2', 'Claude 2'),
        provider: i18n.t('handler.appsAiChat.anthropic', 'Anthropic'),
        maxTokens: 100_000,
        available: true,
      },
      {
        id: 'llama-2',
        name: i18n.t('handler.appsAiChat.llama2', 'Llama 2'),
        provider: i18n.t('handler.appsAiChat.meta', 'Meta'),
        maxTokens: 4096,
        available: false,
      },
    ];
    return HttpResponse.json({ models });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const appsAiChatStatusHandlers = {
  success: appsAiChatHandlers,
  badRequest: [
    http.get(API_AI_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PARAMS',
          i18n.t('handler.appsAiChat.invalidRequestParameters', 'Invalid request parameters'),
          API_AI_CHAT,
          {
            field: 'data',
            error: i18n.t('handler.appsAiChat.invalidFormat', 'Invalid format'),
          }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.get(API_AI_CHAT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.appsAiChat.authenticationRequired', 'Authentication required'),
          API_AI_CHAT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_AI_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'QUOTA_EXCEEDED',
          i18n.t('handler.appsAiChat.tokenQuotaExceeded', 'Token quota exceeded'),
          API_AI_CHAT_SEND
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  unprocessableEntity: [
    http.get(API_AI_CHAT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.appsAiChat.requestValidationFailed', 'Request validation failed'),
          API_AI_CHAT,
          {
            field: 'data',
            error: i18n.t('handler.appsAiChat.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_AI_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.appsAiChat.tooManyRequestsPleaseWait', 'Too many requests. Please wait.'),
          API_AI_CHAT_SEND
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.post(API_AI_CHAT_SEND, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'AI_ERROR',
          i18n.t('handler.appsAiChat.aiServiceUnavailable', 'AI service unavailable'),
          API_AI_CHAT_SEND
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  loading: [
    http.post(API_AI_CHAT_SEND, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_AI_CHAT_SEND, () => HttpResponse.error())],
  emptyData: [
    http.get(API_AI_CHAT_CONVERSATIONS, async () => {
      await delay(100);
      return HttpResponse.json({ conversations: [], total: 0 });
    }),
  ],
};
