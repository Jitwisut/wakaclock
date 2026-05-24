import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT INPUT HANDLERS
// Enterprise-grade MSW handlers for prompt input component
// ============================================================================

// API Endpoints
const API_PROMPT = '/api/prompt';
const API_PROMPT_SUBMIT = '/api/prompt/submit';
const API_PROMPT_SUGGESTIONS = '/api/prompt/suggestions';
const API_PROMPT_VALIDATE = '/api/prompt/validate';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptInputHandlers = [
  http.post(API_PROMPT_SUBMIT, async ({ request }) => {
    await delay(faker.number.int({ min: 200, max: 500 }));
    const body = (await request.json()) as { prompt: string };
    return HttpResponse.json({
      id: faker.string.uuid(),
      prompt: body.prompt,
      submittedAt: new Date().toISOString(),
      status: 'processing',
    });
  }),

  http.get(API_PROMPT_SUGGESTIONS, async () => {
    await delay(faker.number.int({ min: 100, max: 200 }));
    return HttpResponse.json({
      suggestions: [
        i18n.t('handler.promptInput.helpMeWriteAFunction', 'Help me write a function'),
        i18n.t('handler.promptInput.explainThisCode', 'Explain this code'),
        i18n.t('handler.promptInput.debugThisError', 'Debug this error'),
        i18n.t('handler.promptInput.optimizeThisAlgorithm', 'Optimize this algorithm'),
      ],
    });
  }),

  http.post(API_PROMPT_VALIDATE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { prompt: string };
    return HttpResponse.json({
      valid: body.prompt.length > 0 && body.prompt.length < 10_000,
      length: body.prompt.length,
      maxLength: 10_000,
    });
  }),

  http.get(API_PROMPT, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({ version: '1.0.0', maxLength: 10_000 });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptInputStatusHandlers = {
  success: promptInputHandlers,
  badRequest: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_PROMPT',
          i18n.t('handler.promptInput.invalidPromptContent', 'Invalid prompt content'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t('handler.promptInput.authenticationRequired', 'Authentication required'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'PROMPT_DISABLED',
          i18n.t('handler.promptInput.promptsAreDisabled', 'Prompts are disabled'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_PROMPT_SUGGESTIONS, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptInput.promptSuggestionsNotFound', 'Prompt suggestions not found'),
          API_PROMPT_SUGGESTIONS
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'PROMPT_CONFLICT',
          i18n.t(
            'handler.promptInput.promptAlreadyBeingProcessed',
            'Prompt already being processed'
          ),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  unprocessableEntity: [
    http.post(API_PROMPT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptInput.requestValidationFailed', 'Request validation failed'),
          API_PROMPT,
          {
            field: 'data',
            error: i18n.t('handler.promptInput.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMIT',
          i18n.t('handler.promptInput.tooManyPromptsPleaseWait', 'Too many prompts. Please wait.'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],
  internalServerError: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.promptInput.failedToProcessPrompt', 'Failed to process prompt'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.promptInput.promptServiceUnavailable', 'Prompt service unavailable'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptInput.promptServiceIsUnderMaintenance',
            'Prompt service is under maintenance'
          ),
          API_PROMPT_SUBMIT,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.promptInput.promptRequestTimedOut', 'Prompt request timed out'),
          API_PROMPT_SUBMIT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay(5000);
      return HttpResponse.json({
        id: faker.string.uuid(),
        prompt: i18n.t('handler.promptInput.testPrompt', 'test prompt'),
        submittedAt: new Date().toISOString(),
        status: 'processing',
      });
    }),
  ],
  loading: [
    http.post(API_PROMPT_SUBMIT, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_PROMPT_SUBMIT, () => HttpResponse.error())],
  emptyData: [
    http.get(API_PROMPT_SUGGESTIONS, async () => {
      await delay(100);
      return HttpResponse.json({ suggestions: [] });
    }),
  ],
};
