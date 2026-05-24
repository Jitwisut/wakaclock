import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT SUGGESTION HANDLERS
// Enterprise-grade MSW handlers for prompt suggestion component
// ============================================================================

// API Endpoints
const API_SUGGESTION = '/api/suggestion';
const API_SUGGESTION_LIST = '/api/suggestion/list';
const API_SUGGESTION_SELECT = '/api/suggestion/select';
const API_SUGGESTION_DISMISS = '/api/suggestion/dismiss';

// Types
interface Suggestion {
  category: string;
  icon: string;
  id: string;
  text: string;
}

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptSuggestionHandlers = [
  http.get(API_SUGGESTION_LIST, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    const suggestions: Suggestion[] = [
      {
        id: '1',
        text: i18n.t('handler.promptSuggestion.helpMeWriteCode', 'Help me write code'),
        category: 'coding',
        icon: 'Code',
      },
      {
        id: '2',
        text: i18n.t('handler.promptSuggestion.explainThisConcept', 'Explain this concept'),
        category: 'learning',
        icon: 'BookOpen',
      },
      {
        id: '3',
        text: i18n.t('handler.promptSuggestion.debugMyError', 'Debug my error'),
        category: 'debugging',
        icon: 'Bug',
      },
      {
        id: '4',
        text: i18n.t('handler.promptSuggestion.optimizePerformance', 'Optimize performance'),
        category: 'optimization',
        icon: 'Zap',
      },
    ];
    return HttpResponse.json({ suggestions });
  }),

  http.post(API_SUGGESTION_SELECT, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { suggestionId: string };
    return HttpResponse.json({
      success: true,
      suggestionId: body.suggestionId,
      selectedAt: new Date().toISOString(),
    });
  }),

  http.post(API_SUGGESTION_DISMISS, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { suggestionId: string };
    return HttpResponse.json({
      success: true,
      suggestionId: body.suggestionId,
      dismissedAt: new Date().toISOString(),
    });
  }),

  http.get(API_SUGGESTION, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0', totalSuggestions: 4 });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptSuggestionStatusHandlers = {
  success: promptSuggestionHandlers,
  badRequest: [
    http.post(API_SUGGESTION_SELECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_SUGGESTION',
          i18n.t('handler.promptSuggestion.invalidSuggestionId', 'Invalid suggestion ID'),
          API_SUGGESTION_SELECT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  notFound: [
    http.post(API_SUGGESTION_SELECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptSuggestion.suggestionNotFound', 'Suggestion not found'),
          API_SUGGESTION_SELECT
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  unauthorized: [
    http.get(API_SUGGESTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.promptSuggestion.authenticationRequired', 'Authentication required'),
          API_SUGGESTION
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.get(API_SUGGESTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.promptSuggestion.accessDeniedToThisResource',
            'Access denied to this resource'
          ),
          API_SUGGESTION
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  conflict: [
    http.post(API_SUGGESTION_SELECT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'SUGGESTION_CONFLICT',
          i18n.t(
            'handler.promptSuggestion.suggestionAlreadySelected',
            'Suggestion already selected'
          ),
          API_SUGGESTION_SELECT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.promptSuggestion.tooManySuggestionRequests',
            'Too many suggestion requests'
          ),
          API_SUGGESTION_LIST,
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
  unprocessableEntity: [
    http.get(API_SUGGESTION, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptSuggestion.requestValidationFailed', 'Request validation failed'),
          API_SUGGESTION,
          {
            field: 'data',
            error: i18n.t('handler.promptSuggestion.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.promptSuggestion.failedToLoadSuggestions', 'Failed to load suggestions'),
          API_SUGGESTION_LIST
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.promptSuggestion.suggestionServiceUnavailable',
            'Suggestion service unavailable'
          ),
          API_SUGGESTION_LIST
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptSuggestion.suggestionServiceIsUnderMaintenance',
            'Suggestion service is under maintenance'
          ),
          API_SUGGESTION_LIST,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t(
            'handler.promptSuggestion.suggestionRequestTimedOut',
            'Suggestion request timed out'
          ),
          API_SUGGESTION_LIST
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(5000);
      return HttpResponse.json({
        suggestions: [
          {
            id: '1',
            text: i18n.t('handler.promptSuggestion.helpMeWriteCode', 'Help me write code'),
            category: 'coding',
            icon: 'Code',
          },
        ],
      });
    }),
  ],
  loading: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.get(API_SUGGESTION_LIST, () => HttpResponse.error())],
  emptyData: [
    http.get(API_SUGGESTION_LIST, async () => {
      await delay(100);
      return HttpResponse.json({ suggestions: [] });
    }),
  ],
};
