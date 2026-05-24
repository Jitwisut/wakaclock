import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// CODE BLOCK HANDLERS
// Enterprise-grade MSW handlers for code block component
// ============================================================================

// API Endpoints
const API_CODE = '/api/code';
const API_CODE_HIGHLIGHT = '/api/code/highlight';
const API_CODE_COPY = '/api/code/copy';
const API_CODE_EXECUTE = '/api/code/execute';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const codeBlockHandlers = [
  http.post(API_CODE_HIGHLIGHT, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { code: string; language: string };
    return HttpResponse.json({
      highlighted: `<pre><code class="language-${body.language}">${body.code}</code></pre>`,
      language: body.language,
      lineCount: body.code.split('\n').length,
    });
  }),

  http.post(API_CODE_COPY, async () => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    return HttpResponse.json({ success: true, timestamp: new Date().toISOString() });
  }),

  http.post(API_CODE_EXECUTE, async ({ request }) => {
    await delay(faker.number.int({ min: 500, max: 1500 }));
    const body = (await request.json()) as { code: string };
    return HttpResponse.json({
      output: i18n.t('handler.codeBlock.executedLines', 'Executed {{count}} lines', {
        count: body.code.split('\n').length,
      }),
      exitCode: 0,
      executionTime: faker.number.int({ min: 10, max: 500 }),
    });
  }),

  http.get(API_CODE, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      supportedLanguages: ['javascript', 'typescript', 'python', 'rust', 'go'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const codeBlockStatusHandlers = {
  success: codeBlockHandlers,
  badRequest: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_CODE',
          i18n.t('handler.codeBlock.invalidCodeSyntax', 'Invalid code syntax'),
          API_CODE_HIGHLIGHT
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'AUTH_REQUIRED',
          i18n.t(
            'handler.codeBlock.authenticationRequiredToExecute',
            'Authentication required to execute'
          ),
          API_CODE_EXECUTE
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],
  forbidden: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'EXECUTION_DISABLED',
          i18n.t('handler.codeBlock.codeExecutionIsDisabled', 'Code execution is disabled'),
          API_CODE_EXECUTE
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_CODE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.codeBlock.codeBlockNotFound', 'Code block not found'),
          API_CODE
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'EXECUTION_CONFLICT',
          i18n.t(
            'handler.codeBlock.codeExecutionAlreadyInProgress',
            'Code execution already in progress'
          ),
          API_CODE_EXECUTE
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.codeBlock.tooManyCodeExecutionRequests',
            'Too many code execution requests'
          ),
          API_CODE_EXECUTE,
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
    http.post(API_CODE, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.codeBlock.requestValidationFailed', 'Request validation failed'),
          API_CODE,
          {
            field: 'data',
            error: i18n.t('handler.codeBlock.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.codeBlock.failedToHighlightCode', 'Failed to highlight code'),
          API_CODE_HIGHLIGHT
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t('handler.codeBlock.codeServiceUnavailable', 'Code service unavailable'),
          API_CODE_HIGHLIGHT
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.codeBlock.codeServiceIsUnderMaintenance',
            'Code service is under maintenance'
          ),
          API_CODE_HIGHLIGHT,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.codeBlock.codeRequestTimedOut', 'Code request timed out'),
          API_CODE_HIGHLIGHT
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_CODE_HIGHLIGHT, async () => {
      await delay(5000);
      return HttpResponse.json({
        highlighted: i18n.t(
          'handler.codeBlock.precodeClasslanguagejavascriptCodecodepre',
          '<pre><code class="language-javascript">// code</code></pre>'
        ),
        language: 'javascript',
        lineCount: 1,
      });
    }),
  ],
  loading: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_CODE_HIGHLIGHT, () => HttpResponse.error())],
  executionError: [
    http.post(API_CODE_EXECUTE, async () => {
      await delay(500);
      return HttpResponse.json({
        output: i18n.t('handler.codeBlock.syntaxError', 'Error: syntax error'),
        exitCode: 1,
        executionTime: 50,
      });
    }),
  ],
};
