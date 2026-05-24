import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

faker.seed(12_345);

// API Endpoints
const API_TEXTAREA_VALIDATE = '/api/textarea/validate';
const API_TEXTAREA_SAVE = '/api/textarea/save';
const API_TEXTAREA_AUTOSAVE = '/api/textarea/autosave';
const API_TEXTAREA_SUGGEST = '/api/textarea/suggest';

// Default success handlers
export const textareaHandlers = [
  // POST /api/textarea/validate - Validate textarea content
  http.post(API_TEXTAREA_VALIDATE, async ({ request }) => {
    const body = (await request.json()) as { content: string; rules?: string[] };
    await delay(faker.number.int({ min: 100, max: 300 }));

    const content = body.content ?? '';
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const charCount = content.length;

    const errors: string[] = [];
    if (charCount > 5000) {
      errors.push(
        i18n.t(
          'handler.textarea.contentExceedsMaximumLengthOf',
          'Content exceeds maximum length of 5000 characters'
        )
      );
    }
    if (wordCount < 10 && content.trim()) {
      errors.push(
        i18n.t('handler.textarea.contentShouldBeAtLeast', 'Content should be at least 10 words')
      );
    }

    return HttpResponse.json({
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      stats: {
        wordCount,
        charCount,
        lineCount: content.split('\n').length,
      },
    });
  }),

  // POST /api/textarea/save - Save textarea content
  http.post(API_TEXTAREA_SAVE, async ({ request }) => {
    const body = (await request.json()) as { content: string; fieldId?: string };
    await delay(faker.number.int({ min: 300, max: 600 }));

    return HttpResponse.json({
      success: true,
      fieldId: body.fieldId ?? 'default',
      savedContent: body.content,
      savedAt: new Date().toISOString(),
      version: faker.number.int({ min: 1, max: 100 }),
    });
  }),

  // POST /api/textarea/autosave - Autosave textarea content
  http.post(API_TEXTAREA_AUTOSAVE, async ({ request }) => {
    const body = (await request.json()) as { content: string; draftId?: string };
    await delay(faker.number.int({ min: 100, max: 200 }));

    return HttpResponse.json({
      success: true,
      draftId: body.draftId ?? faker.string.uuid(),
      savedAt: new Date().toISOString(),
      nextAutosaveIn: 30, // seconds
    });
  }),

  // GET /api/textarea/suggest - Get AI suggestions for textarea content
  http.get(API_TEXTAREA_SUGGEST, async ({ request }) => {
    const url = new URL(request.url);
    const context = url.searchParams.get('context') ?? '';
    await delay(faker.number.int({ min: 500, max: 1500 }));

    return HttpResponse.json({
      suggestions: [faker.lorem.sentence(), faker.lorem.sentence(), faker.lorem.sentence()],
      context,
      generatedAt: new Date().toISOString(),
    });
  }),
];

// Status-specific handlers for stories
export const textareaStatusHandlers = {
  // ============ 2xx SUCCESS ============
  success: textareaHandlers,

  // ============ 4xx CLIENT ERRORS ============
  validationError: [
    http.post(API_TEXTAREA_VALIDATE, async () => {
      await delay(200);
      return HttpResponse.json({
        valid: false,
        errors: [
          i18n.t(
            'handler.textarea.contentContainsProhibitedWords',
            'Content contains prohibited words'
          ),
          i18n.t('handler.textarea.contentExceedsMaximumLength', 'Content exceeds maximum length'),
        ],
        stats: { wordCount: 1000, charCount: 6000, lineCount: 50 },
      });
    }),
  ],

  badRequest: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CONTENT',
          i18n.t('handler.textarea.contentFormatIsInvalid', 'Content format is invalid'),
          API_TEXTAREA_SAVE,
          { content: i18n.t('handler.textarea.contentMustBeAString', 'Content must be a string') }
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],

  unauthorized: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.textarea.pleaseLogInToSave', 'Please log in to save content'),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t('handler.textarea.accessDenied', 'Access denied'),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],

  notFound: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'FIELD_NOT_FOUND',
          i18n.t('handler.textarea.textareaFieldNotFound', 'Textarea field not found'),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],

  conflict: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'VERSION_CONFLICT',
          i18n.t(
            'handler.textarea.contentWasModifiedByAnother',
            'Content was modified by another user'
          ),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],

  unprocessableEntity: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'UNPROCESSABLE_ENTITY',
          i18n.t('handler.textarea.unableToProcessContent', 'Unable to process content'),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  payloadTooLarge: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.PAYLOAD_TOO_LARGE,
          'CONTENT_TOO_LARGE',
          i18n.t(
            'handler.textarea.contentExceedsMaximumAllowedSize',
            'Content exceeds maximum allowed size'
          ),
          API_TEXTAREA_SAVE,
          { maxSize: '1MB', receivedSize: '2.5MB' }
        ),
        { status: HTTP_STATUS.PAYLOAD_TOO_LARGE }
      );
    }),
  ],

  tooManyRequests: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t('handler.textarea.tooManySaveRequests', 'Too many save requests'),
          API_TEXTAREA_SAVE,
          { retryAfter: '5' }
        ),
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
    }),
  ],

  // ============ 5xx SERVER ERRORS ============
  internalServerError: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SAVE_FAILED',
          i18n.t('handler.textarea.failedToSaveContent', 'Failed to save content'),
          API_TEXTAREA_SAVE,
          { errorId: faker.string.uuid() }
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  autosaveError: [
    http.post(API_TEXTAREA_AUTOSAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'AUTOSAVE_FAILED',
          i18n.t(
            'handler.textarea.autosaveFailedYourChangesMay',
            'Autosave failed. Your changes may not be saved.'
          ),
          API_TEXTAREA_AUTOSAVE
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],

  badGateway: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.textarea.textareaServiceTemporarilyUnavailable',
            'Textarea service temporarily unavailable'
          ),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],

  serviceUnavailable: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.textarea.textareaServiceIsUnderMaintenance',
            'Textarea service is under maintenance'
          ),
          API_TEXTAREA_SAVE,
          { retryAfter: '120' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],

  gatewayTimeout: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.textarea.saveRequestTimedOut', 'Save request timed out'),
          API_TEXTAREA_SAVE
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],

  // ============ SPECIAL STATES ============
  loading: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],

  slowSave: [
    http.post(API_TEXTAREA_SAVE, async ({ request }) => {
      const body = (await request.json()) as { content: string };
      await delay(5000);
      return HttpResponse.json({
        success: true,
        savedContent: body.content,
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  slowResponse: [
    http.post(API_TEXTAREA_SAVE, async ({ request }) => {
      const body = (await request.json()) as { content: string };
      await delay(4000);
      return HttpResponse.json({
        success: true,
        savedContent: body.content,
        savedAt: new Date().toISOString(),
      });
    }),
  ],

  networkError: [
    http.post(API_TEXTAREA_SAVE, async () => {
      await delay(200);
      return HttpResponse.error();
    }),
  ],

  // AI suggestion specific
  noSuggestions: [
    http.get(API_TEXTAREA_SUGGEST, async () => {
      await delay(300);
      return HttpResponse.json({
        suggestions: [],
        message: i18n.t(
          'handler.textarea.noSuggestionsAvailableForThis',
          'No suggestions available for this context'
        ),
      });
    }),
  ],

  suggestionError: [
    http.get(API_TEXTAREA_SUGGEST, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'AI_UNAVAILABLE',
          i18n.t(
            'handler.textarea.aiSuggestionServiceIsTemporarily',
            'AI suggestion service is temporarily unavailable'
          ),
          API_TEXTAREA_SUGGEST
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
};
