import { faker } from '@faker-js/faker';
import i18n from 'i18next';
import { delay, http, HttpResponse } from 'msw';

import { createApiError, HTTP_STATUS } from '../_utils/http-status';

// ============================================================================
// PROMPT MARKDOWN HANDLERS
// Enterprise-grade MSW handlers for markdown rendering component
// ============================================================================

// API Endpoints
const API_MARKDOWN = '/api/markdown';
const API_MARKDOWN_RENDER = '/api/markdown/render';
const API_MARKDOWN_SANITIZE = '/api/markdown/sanitize';

// ============================================================================
// SUCCESS HANDLERS
// ============================================================================

export const promptMarkdownHandlers = [
  http.post(API_MARKDOWN_RENDER, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    const body = (await request.json()) as { markdown: string };
    return HttpResponse.json({
      html: `<div>${body.markdown.replaceAll('\n', '<br>')}</div>`,
      plainText: body.markdown.replaceAll(/[#*_`]/g, ''),
      wordCount: body.markdown.split(' ').length,
    });
  }),

  http.post(API_MARKDOWN_SANITIZE, async ({ request }) => {
    await delay(faker.number.int({ min: 50, max: 100 }));
    const body = (await request.json()) as { html: string };
    return HttpResponse.json({
      sanitized: body.html.replaceAll(/<script[^>]*>[^<]*<\/script>/gi, ''),
      removed: [],
    });
  }),

  http.get(API_MARKDOWN, async () => {
    await delay(faker.number.int({ min: 50, max: 150 }));
    return HttpResponse.json({
      version: '1.0.0',
      features: ['gfm', 'syntax-highlighting', 'math'],
    });
  }),
];

// ============================================================================
// STATUS HANDLERS
// ============================================================================

export const promptMarkdownStatusHandlers = {
  success: promptMarkdownHandlers,
  badRequest: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_REQUEST,
          'INVALID_MARKDOWN',
          i18n.t('handler.promptMarkdown.invalidMarkdownSyntax', 'Invalid markdown syntax'),
          API_MARKDOWN_RENDER
        ),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }),
  ],
  unauthorized: [
    http.post(API_MARKDOWN, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'UNAUTHORIZED',
          i18n.t('handler.promptMarkdown.authenticationRequired', 'Authentication required'),
          API_MARKDOWN
        ),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }),
  ],

  forbidden: [
    http.post(API_MARKDOWN, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN',
          i18n.t(
            'handler.promptMarkdown.accessDeniedToThisResource',
            'Access denied to this resource'
          ),
          API_MARKDOWN
        ),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }),
  ],
  notFound: [
    http.get(API_MARKDOWN, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.NOT_FOUND,
          'NOT_FOUND',
          i18n.t('handler.promptMarkdown.markdownResourceNotFound', 'Markdown resource not found'),
          API_MARKDOWN
        ),
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }),
  ],
  conflict: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.CONFLICT,
          'RENDER_CONFLICT',
          i18n.t('handler.promptMarkdown.markdownRenderConflict', 'Markdown render conflict'),
          API_MARKDOWN_RENDER
        ),
        { status: HTTP_STATUS.CONFLICT }
      );
    }),
  ],
  tooManyRequests: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'RATE_LIMITED',
          i18n.t(
            'handler.promptMarkdown.tooManyMarkdownRenderRequests',
            'Too many markdown render requests'
          ),
          API_MARKDOWN_RENDER,
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
    http.post(API_MARKDOWN, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.UNPROCESSABLE_ENTITY,
          'VALIDATION_ERROR',
          i18n.t('handler.promptMarkdown.requestValidationFailed', 'Request validation failed'),
          API_MARKDOWN,
          {
            field: 'data',
            error: i18n.t('handler.promptMarkdown.invalidDataFormat', 'Invalid data format'),
          }
        ),
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }),
  ],

  internalServerError: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(200);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          'SERVER_ERROR',
          i18n.t('handler.promptMarkdown.failedToRenderMarkdown', 'Failed to render markdown'),
          API_MARKDOWN_RENDER
        ),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }),
  ],
  badGateway: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'UPSTREAM_ERROR',
          i18n.t(
            'handler.promptMarkdown.markdownServiceUnavailable',
            'Markdown service unavailable'
          ),
          API_MARKDOWN_RENDER
        ),
        { status: HTTP_STATUS.BAD_GATEWAY }
      );
    }),
  ],
  serviceUnavailable: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          'MAINTENANCE',
          i18n.t(
            'handler.promptMarkdown.markdownServiceIsUnderMaintenance',
            'Markdown service is under maintenance'
          ),
          API_MARKDOWN_RENDER,
          { retryAfter: '60' }
        ),
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
    }),
  ],
  gatewayTimeout: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(300);
      return HttpResponse.json(
        createApiError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          'TIMEOUT',
          i18n.t('handler.promptMarkdown.markdownRequestTimedOut', 'Markdown request timed out'),
          API_MARKDOWN_RENDER
        ),
        { status: HTTP_STATUS.GATEWAY_TIMEOUT }
      );
    }),
  ],
  slowResponse: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay(5000);
      return HttpResponse.json({
        html: i18n.t(
          'handler.promptMarkdown.divrenderedMarkdowndiv',
          '<div>rendered markdown</div>'
        ),
        plainText: i18n.t('handler.promptMarkdown.renderedMarkdown', 'rendered markdown'),
        wordCount: 2,
      });
    }),
  ],
  loading: [
    http.post(API_MARKDOWN_RENDER, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  ],
  networkError: [http.post(API_MARKDOWN_RENDER, () => HttpResponse.error())],
};
