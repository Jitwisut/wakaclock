import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  CLIENT_ERROR_STATUSES,
  createClientErrorMatrix,
  createErrorDisplayShowcase,
  createErrorDisplayTestData,
  createErrorStatusMatrix,
  createFakeCompleteError,
  createFakeErrorDisplay,
  createFakeErrorDisplays,
  createFakeErrorForStatus,
  createFakeErrorLongText,
  createFakeErrorManyDetails,
  createFakeErrorWithoutRetry,
  createFakeErrorWithRetry,
  createFakeMinimalError,
  createServerErrorMatrix,
  ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_SEVERITIES,
  type ErrorSeverity,
  type FakeErrorDisplay,
  type FakeErrorDisplayWithSeverity,
  HTTP_ERROR_INFO,
  HTTP_ERROR_STATUSES,
  type HttpErrorStatus,
  SERVER_ERROR_STATUSES,
} from '../_factories/error-display.factory';

import { ErrorDisplay, type ErrorDisplayProps } from './ErrorDisplay';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Factory type + constant references (F3.11-F3.13)
void CLIENT_ERROR_STATUSES;
void ERROR_CODES;
void ERROR_MESSAGES;
void ERROR_SEVERITIES;
void HTTP_ERROR_STATUSES;
void SERVER_ERROR_STATUSES;
const _typeCheck1: ErrorSeverity | undefined = undefined;
void _typeCheck1;
const _typeCheck2: FakeErrorDisplay | undefined = undefined;
void _typeCheck2;
const _typeCheck3: FakeErrorDisplayWithSeverity | undefined = undefined;
void _typeCheck3;
const _typeCheck4: HttpErrorStatus | undefined = undefined;
void _typeCheck4;

// ============================================================================
// DEMO COMPONENTS
// ============================================================================

function ErrorDisplayDemo(props: ErrorDisplayProps) {
  return (
    <div className="w-[480px]" data-testid="error-display-demo">
      <ErrorDisplay {...props} />
    </div>
  );
}

function MultipleErrorsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4" data-testid="multiple-errors-demo">
      <ErrorDisplay
        message={t('errorDisplay.demo.networkLost')}
        code="ERR_NETWORK"
        onRetry={fn()}
      />
      <ErrorDisplay
        status={403}
        message={t('errorDisplay.demo.accessDenied')}
        code="ERR_FORBIDDEN"
      />
      <ErrorDisplay
        status={500}
        message={t('errorDisplay.demo.internalError')}
        details={{ requestId: 'req_123' }}
        onRetry={fn()}
      />
    </div>
  );
}

function AccessibilityDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4" data-testid="accessibility-demo">
      <ErrorDisplayDemo
        message={t('errorDisplay.demo.screenReaderAnnounce')}
        status={500}
        code="ERR_A11Y_TEST"
        onRetry={fn()}
      />
      <ErrorDisplayDemo
        message={t('errorDisplay.demo.keyboardNav')}
        details={{
          [t('errorDisplay.a11y.ariaRole')]: t('errorDisplay.a11y.alert'),
          [t('errorDisplay.a11y.focusManagement')]: t('errorDisplay.a11y.retryFocusable'),
          [t('errorDisplay.a11y.colorContrast')]: t('errorDisplay.a11y.meetsWcag'),
        }}
        onRetry={fn()}
      />
    </div>
  );
}

function SizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.narrow')}</p>
        <div className="w-[320px]">
          <ErrorDisplay message={t('errorDisplay.demo.compactError')} status={400} onRetry={fn()} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.medium')}</p>
        <div className="w-[480px]">
          <ErrorDisplay
            message={t('errorDisplay.demo.standardError')}
            status={500}
            code="ERR_MEDIUM"
            details={{ context: 'Medium width container' }}
            onRetry={fn()}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.wide')}</p>
        <div className="w-[640px]">
          <ErrorDisplay
            message={t('errorDisplay.demo.wideError')}
            status={503}
            code="ERR_SERVICE_UNAVAILABLE"
            details={{
              service: 'api.example.com',
              retryAfter: '5 minutes',
              supportLink: 'https://support.example.com',
            }}
            onRetry={fn()}
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.fullWidth')}</p>
        <div className="w-full">
          <ErrorDisplay
            message={t('errorDisplay.demo.fullWidthError')}
            status={500}
            code="ERR_FULL_WIDTH"
            onRetry={fn()}
          />
        </div>
      </div>
    </div>
  );
}

function AllHttpErrorsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="all-http-errors">
      {(Object.entries(HTTP_ERROR_INFO) as [string, (typeof HTTP_ERROR_INFO)[400]][]).map(
        ([status, info]) => (
          <div key={status}>
            <p className="mb-2 text-sm font-medium">
              {status} - {info.message}
            </p>
            <div className="w-[480px]">
              <ErrorDisplay
                status={Number(status)}
                code={info.code}
                message={info.description}
                details={info.details}
                onRetry={[400, 500, 502, 503, 504].includes(Number(status)) ? fn() : undefined}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}

function FactoryDataDemo() {
  const data = createFakeErrorDisplay();
  return (
    <div data-testid="factory-data-demo">
      <ErrorDisplayDemo {...data} />
    </div>
  );
}

function FactoryStatusMatrixDemo() {
  const matrix = createErrorStatusMatrix();
  return (
    <div className="flex flex-col gap-4" data-testid="factory-status-matrix">
      {matrix.map(({ error, status }) => (
        <div key={status}>
          <p className="mb-2 text-sm font-medium">HTTP {status}</p>
          <ErrorDisplayDemo {...error} />
        </div>
      ))}
    </div>
  );
}

function FactoryShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createErrorDisplayShowcase();
  const { testData } = showcase;
  return (
    <div className="flex flex-col gap-6" data-testid="factory-showcase">
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.basic', 'Basic')}</p>
        <ErrorDisplayDemo {...testData.basic} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.complete', 'Complete')}</p>
        <ErrorDisplayDemo {...testData.complete} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('errorDisplay.story.minimal', 'Minimal')}</p>
        <ErrorDisplayDemo {...testData.minimal} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {t('errorDisplay.story.withRetry', 'With Retry')}
        </p>
        <ErrorDisplayDemo {...testData.withRetry} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {t('errorDisplay.story.withoutRetry', 'Without Retry')}
        </p>
        <ErrorDisplayDemo {...testData.withoutRetry} />
      </div>
    </div>
  );
}

function MobileDemo() {
  const { t } = useTranslation();
  return (
    <div className="w-[320px]" data-testid="mobile-demo">
      <ErrorDisplay
        message={t('errorDisplay.demo.defaultMessage')}
        status={500}
        code="ERR_INTERNAL"
        details={{ requestId: 'req_mobile_123' }}
        onRetry={fn()}
      />
    </div>
  );
}

function JapaneseDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4" data-testid="japanese-demo">
      <ErrorDisplayDemo
        message={t('errorDisplay.demo.defaultMessage')}
        status={500}
        code="ERR_INTERNAL"
        onRetry={fn()}
      />
      <ErrorDisplayDemo
        message={t('errorDisplay.demo.fetchFailed')}
        status={404}
        code="ERR_NOT_FOUND"
        details={{
          [t('errorDisplay.a11y.ariaRole')]: t('errorDisplay.a11y.alert'),
        }}
      />
    </div>
  );
}

// ============================================================================
// META
// ============================================================================

const meta = {
  title: 'Documentation/Components/ErrorDisplay',
  component: ErrorDisplay,
  tags: ['autodocs'],
  args: {
    message: i18n.t(
      'errorDisplay.story.defaultErrorMessage',
      'An error occurred while processing your request.'
    ),
    onRetry: fn(),
  },
  argTypes: {
    // Content
    message: {
      control: 'text',
      description: i18n.t(
        'errorDisplay.argType.theMainErrorMessageToDisplay',
        'The main error message to display'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    status: {
      control: 'number',
      description: i18n.t('errorDisplay.argType.httpStatusCode', 'HTTP status code'),
      table: {
        category: 'Content',
        type: { summary: 'number' },
      },
    },
    code: {
      control: 'text',
      description: i18n.t('errorDisplay.argType.errorCodeIdentifier', 'Error code identifier'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    details: {
      control: 'object',
      description: i18n.t(
        'errorDisplay.argType.additionalErrorDetailsAsKeyvaluePairs',
        'Additional error details as key-value pairs'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Record<string, string>' },
      },
    },
    // Events
    onRetry: {
      action: 'onRetry',
      description: i18n.t(
        'errorDisplay.argType.callbackWhenRetryButtonIsClicked',
        'Callback when retry button is clicked'
      ),
      table: { category: 'Events' },
    },
  },
  parameters: {
    docs: {
      description: {
        component: `
ErrorDisplay is a reusable error display component for stories that shows error information
in a consistent, accessible format. It uses the Alert component with the destructive variant
and supports optional status codes, error codes, details, and retry functionality.

## Features
- Displays error message with icon
- Optional HTTP status code display
- Optional error code identifier
- Optional key-value details list
- Optional retry button with callback
- Accessible with proper ARIA attributes
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ErrorDisplay>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// CORE STORIES
// ============================================================================

export const Default: Story = {
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t(
      'errorDisplay.story.defaultErrorMessage',
      'An error occurred while processing your request.'
    ),
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-slot')).toBe('error-display');

    const description = errorAlert.querySelector('[data-slot="alert-description"]');
    if (!(description instanceof HTMLElement)) {
      throw new Error('Alert description was not rendered.');
    }
    expect(description.textContent).toContain('An error occurred while processing your request.');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithStatus: Story = {
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t(
      'errorDisplay.story.resourceNotFound',
      'The requested resource could not be found.'
    ),
    status: 404,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('404');

    const statusElement = errorAlert.querySelector('.font-mono');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement?.textContent).toContain('404');
  },
};

export const WithCode: Story = {
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t('errorDisplay.story.authFailed', 'Authentication failed.'),
    code: 'ERR_AUTH_FAILED',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.textContent).toContain('[ERR_AUTH_FAILED]');
  },
};

export const WithDetails: Story = {
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t(
      'errorDisplay.story.validationFailed',
      'Validation failed for the submitted form.'
    ),
    details: {
      field: i18n.t('errorDisplay.story.fieldEmail', 'email'),
      issue: i18n.t('errorDisplay.story.invalidFormat', 'Invalid format'),
      expected: i18n.t('errorDisplay.story.expectedEmail', 'user@example.com'),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();

    const detailsList = errorAlert.querySelector('ul');
    expect(detailsList).toBeInTheDocument();

    const listItems = detailsList?.querySelectorAll('li');
    expect(listItems?.length).toBe(3);

    expect(errorAlert.textContent).toContain('field:');
    expect(errorAlert.textContent).toContain('email');
    expect(errorAlert.textContent).toContain('issue:');
    expect(errorAlert.textContent).toContain('Invalid format');
  },
};

export const WithRetry: Story = {
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t('errorDisplay.story.fetchFailed', 'Failed to fetch data. Please try again.'),
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const retryButton = canvas.getByTestId('error-retry-button');
    expect(retryButton).toBeInTheDocument();
    expect(retryButton.textContent).toContain('Retry');

    await userEvent.click(retryButton);
  },
};

export const Complete: Story = {
  name: i18n.t('errorDisplay.storyName.complete', 'Complete (All Props)'),
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t(
      'errorDisplay.story.requestNotCompleted',
      'The request could not be completed.'
    ),
    status: 422,
    code: 'ERR_VALIDATION',
    details: {
      field: i18n.t('errorDisplay.story.fieldUsername', 'username'),
      minLength: i18n.t('errorDisplay.story.minLength', '3'),
      maxLength: i18n.t('errorDisplay.story.maxLength', '50'),
    },
    onRetry: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();

    expect(errorAlert.getAttribute('data-error-status')).toBe('422');
    expect(errorAlert.textContent).toContain('422');
    expect(errorAlert.textContent).toContain('[ERR_VALIDATION]');
    expect(errorAlert.textContent).toContain('The request could not be completed.');

    const retryButton = canvas.getByTestId('error-retry-button');
    expect(retryButton).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  name: i18n.t('errorDisplay.storyName.dataAttributes', 'Data Attributes'),
  render: (args) => <ErrorDisplayDemo {...args} />,
  args: {
    message: i18n.t('errorDisplay.story.errorWithDataAttrs', 'Error with data attributes.'),
    status: 500,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-slot')).toBe('error-display');
    expect(errorAlert.getAttribute('data-testid')).toBe('story-error');
    expect(errorAlert.getAttribute('data-error-status')).toBe('500');
  },
};

// ============================================================================
// HTTP ERROR STORIES
// ============================================================================

export const Error400BadRequest: Story = {
  name: i18n.t('errorDisplay.storyName.error400BadRequest', 'HTTP 400: Bad Request'),
  render: () => (
    <ErrorDisplayDemo
      status={400}
      code={HTTP_ERROR_INFO[400].code}
      message={HTTP_ERROR_INFO[400].description}
      details={HTTP_ERROR_INFO[400].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('400');
    expect(errorAlert.textContent).toContain('ERR_BAD_REQUEST');
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('errorDisplay.storyName.error401Unauthorized', 'HTTP 401: Unauthorized'),
  render: () => (
    <ErrorDisplayDemo
      status={401}
      code={HTTP_ERROR_INFO[401].code}
      message={HTTP_ERROR_INFO[401].description}
      details={HTTP_ERROR_INFO[401].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('401');
    expect(errorAlert.textContent).toContain('ERR_UNAUTHORIZED');
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('errorDisplay.storyName.error403Forbidden', 'HTTP 403: Forbidden'),
  render: () => (
    <ErrorDisplayDemo
      status={403}
      code={HTTP_ERROR_INFO[403].code}
      message={HTTP_ERROR_INFO[403].description}
      details={HTTP_ERROR_INFO[403].details}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('403');
    expect(errorAlert.textContent).toContain('ERR_FORBIDDEN');
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('errorDisplay.storyName.error404NotFound', 'HTTP 404: Not Found'),
  render: () => (
    <ErrorDisplayDemo
      status={404}
      code={HTTP_ERROR_INFO[404].code}
      message={HTTP_ERROR_INFO[404].description}
      details={HTTP_ERROR_INFO[404].details}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('404');
    expect(errorAlert.textContent).toContain('ERR_NOT_FOUND');
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('errorDisplay.storyName.error409Conflict', 'HTTP 409: Conflict'),
  render: () => (
    <ErrorDisplayDemo
      status={409}
      code={HTTP_ERROR_INFO[409].code}
      message={HTTP_ERROR_INFO[409].description}
      details={HTTP_ERROR_INFO[409].details}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('409');
    expect(errorAlert.textContent).toContain('ERR_CONFLICT');
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'errorDisplay.storyName.error422UnprocessableEntity',
    'HTTP 422: Unprocessable Entity'
  ),
  render: () => (
    <ErrorDisplayDemo
      status={422}
      code={HTTP_ERROR_INFO[422].code}
      message={HTTP_ERROR_INFO[422].description}
      details={HTTP_ERROR_INFO[422].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('422');
    expect(errorAlert.textContent).toContain('ERR_VALIDATION');
  },
};

export const Error429TooManyRequests: Story = {
  name: i18n.t('errorDisplay.storyName.error429TooManyRequests', 'HTTP 429: Too Many Requests'),
  render: () => (
    <ErrorDisplayDemo
      status={429}
      code={HTTP_ERROR_INFO[429].code}
      message={HTTP_ERROR_INFO[429].description}
      details={HTTP_ERROR_INFO[429].details}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('429');
    expect(errorAlert.textContent).toContain('ERR_RATE_LIMITED');
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'errorDisplay.storyName.error500InternalServerError',
    'HTTP 500: Internal Server Error'
  ),
  render: () => (
    <ErrorDisplayDemo
      status={500}
      code={HTTP_ERROR_INFO[500].code}
      message={HTTP_ERROR_INFO[500].description}
      details={HTTP_ERROR_INFO[500].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('500');
    expect(errorAlert.textContent).toContain('ERR_INTERNAL');
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('errorDisplay.storyName.error502BadGateway', 'HTTP 502: Bad Gateway'),
  render: () => (
    <ErrorDisplayDemo
      status={502}
      code={HTTP_ERROR_INFO[502].code}
      message={HTTP_ERROR_INFO[502].description}
      details={HTTP_ERROR_INFO[502].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('502');
    expect(errorAlert.textContent).toContain('ERR_BAD_GATEWAY');
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'errorDisplay.storyName.error503ServiceUnavailable',
    'HTTP 503: Service Unavailable'
  ),
  render: () => (
    <ErrorDisplayDemo
      status={503}
      code={HTTP_ERROR_INFO[503].code}
      message={HTTP_ERROR_INFO[503].description}
      details={HTTP_ERROR_INFO[503].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('503');
    expect(errorAlert.textContent).toContain('ERR_SERVICE_UNAVAILABLE');
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('errorDisplay.storyName.error504GatewayTimeout', 'HTTP 504: Gateway Timeout'),
  render: () => (
    <ErrorDisplayDemo
      status={504}
      code={HTTP_ERROR_INFO[504].code}
      message={HTTP_ERROR_INFO[504].description}
      details={HTTP_ERROR_INFO[504].details}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.getAttribute('data-error-status')).toBe('504');
    expect(errorAlert.textContent).toContain('ERR_GATEWAY_TIMEOUT');
  },
};

// ============================================================================
// OVERVIEW STORIES
// ============================================================================

export const AllHttpErrors: Story = {
  name: i18n.t('errorDisplay.storyName.allHttpErrors', 'All HTTP Errors'),
  render: () => <AllHttpErrorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('all-http-errors');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(11);

    const expectedStatuses = [
      '400',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];
    for (const status of expectedStatuses) {
      const alert = container.querySelector(`[data-error-status="${status}"]`);
      expect(alert).toBeInTheDocument();
    }
  },
};

export const MultipleErrors: Story = {
  name: i18n.t('errorDisplay.storyName.multipleErrors', 'Multiple Errors'),
  render: () => <MultipleErrorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('multiple-errors-demo');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(3);
  },
};

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export const Accessibility: Story = {
  name: i18n.t('errorDisplay.storyName.accessibility', 'Accessibility'),
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('accessibility-demo');
    expect(container).toBeInTheDocument();

    const alerts = canvas.getAllByRole('alert');
    expect(alerts.length).toBe(2);

    for (const alert of alerts) {
      expect(alert.getAttribute('data-slot')).toBe('error-display');

      const title = alert.querySelector('[data-slot="alert-title"]');
      expect(title).toBeInTheDocument();

      const description = alert.querySelector('[data-slot="alert-description"]');
      expect(description).toBeInTheDocument();
    }

    const retryButtons = canvas.getAllByTestId('error-retry-button');
    expect(retryButtons.length).toBe(2);

    for (const button of retryButtons) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).not.toHaveAttribute('aria-disabled', 'true');
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with ARIA role validation and screen reader compatibility.',
      },
    },
  },
};

// ============================================================================
// THEME / VISUAL STORIES
// ============================================================================

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('errorDisplay.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.default', 'Default')}
          </p>
          <Story />
        </div>
        <div id="hover">
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.hoverRetryButton', 'Hover (retry button)')}
          </p>
          <Story />
        </div>
        <div id="focus">
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.focusRetryButton', 'Focus (retry button)')}
          </p>
          <Story />
        </div>
        <div id="active">
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.activeRetryButton', 'Active (retry button)')}
          </p>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    message: i18n.t(
      'errorDisplay.story.pseudoStateError',
      'Error with retry button for pseudo state testing.'
    ),
    onRetry: fn(),
  },
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover [data-testid="error-retry-button"]'],
      focusVisible: ['#focus [data-testid="error-retry-button"]'],
      active: ['#active [data-testid="error-retry-button"]'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// I18N STORIES
// ============================================================================

export const Japanese: Story = {
  name: i18n.t('errorDisplay.storyName.japanese', 'Japanese Locale'),
  render: () => <JapaneseDemo />,
  globals: {
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('japanese-demo');
    expect(container).toBeInTheDocument();

    const alerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(alerts.length).toBe(2);
  },
};

export const DarkJapanese: Story = {
  name: i18n.t('errorDisplay.storyName.darkJapanese', 'Dark + Japanese'),
  render: () => <JapaneseDemo />,
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// LAYOUT STORIES
// ============================================================================

export const Sizes: Story = {
  name: i18n.t('errorDisplay.storyName.sizes', 'Different Widths'),
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const errorAlerts = canvasElement.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(4);
  },
};

// ============================================================================
// EDGE CASE STORIES
// ============================================================================

export const LongMessage: Story = {
  name: i18n.t('errorDisplay.storyName.longMessage', 'Long Message'),
  render: () => (
    <ErrorDisplayDemo
      message="This is a very long error message that demonstrates how the component handles lengthy text content. It might wrap to multiple lines depending on the container width and should still remain readable and properly formatted. The component should gracefully handle this edge case without breaking the layout or causing any visual issues."
      status={500}
      code="ERR_LONG_MESSAGE"
      details={{
        detailKey1: 'This is also a very long detail value that should wrap properly',
        detailKey2: 'Another long value to test wrapping behavior in the details list',
      }}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert.textContent).toContain('This is a very long error message');
  },
};

export const ManyDetails: Story = {
  name: i18n.t('errorDisplay.storyName.manyDetails', 'Many Details'),
  render: () => (
    <ErrorDisplayDemo
      message="Error with many detail entries."
      status={422}
      code="ERR_VALIDATION_MANY"
      details={{
        field1: 'required',
        field2: 'too short',
        field3: 'invalid format',
        field4: 'not unique',
        field5: 'out of range',
        field6: 'invalid type',
        field7: 'exceeds maximum',
        field8: 'below minimum',
      }}
      onRetry={fn()}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();

    const detailsList = errorAlert.querySelector('ul');
    expect(detailsList).toBeInTheDocument();

    const listItems = detailsList?.querySelectorAll('li');
    expect(listItems?.length).toBe(8);
  },
};

export const MinimalError: Story = {
  name: i18n.t('errorDisplay.storyName.minimalError', 'Minimal (Message Only)'),
  render: () => <ErrorDisplayDemo message="Something went wrong." />,
  args: {
    onRetry: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();

    expect(errorAlert.getAttribute('data-error-status')).toBeNull();
    expect(canvas.queryByTestId('error-retry-button')).not.toBeInTheDocument();

    const detailsList = errorAlert.querySelector('ul');
    expect(detailsList).not.toBeInTheDocument();
  },
};

// ============================================================================
// MOBILE STORY
// ============================================================================

export const Mobile: Story = {
  name: i18n.t('errorDisplay.storyName.mobile', 'Mobile Viewport (320px)'),
  render: () => <MobileDemo />,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('mobile-demo');
    expect(container).toBeInTheDocument();

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY STORIES
// ============================================================================

export const FactoryData: Story = {
  name: i18n.t('errorDisplay.storyName.factoryData', 'Factory: Random Error'),
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-data-demo');
    expect(container).toBeInTheDocument();

    const errorAlert = canvas.getByTestId('story-error');
    expect(errorAlert).toBeInTheDocument();
  },
};

export const FactoryStatusMatrix: Story = {
  name: i18n.t('errorDisplay.storyName.factoryStatusMatrix', 'Factory: Status Matrix'),
  render: () => <FactoryStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-status-matrix');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(11);
  },
};

export const FactoryShowcase: Story = {
  name: i18n.t('errorDisplay.storyName.factoryShowcase', 'Factory: Showcase'),
  render: () => <FactoryShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-showcase');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBeGreaterThanOrEqual(5);
  },
};

export const FactoryBulk: Story = {
  name: i18n.t('errorDisplay.storyName.factoryBulk', 'Factory: Bulk Errors'),
  render: () => {
    const errors = createFakeErrorDisplays(5);
    return (
      <div className="flex flex-col gap-4" data-testid="factory-bulk">
        {errors.map((error) => (
          <ErrorDisplayDemo key={`${error.status}-${error.code}`} {...error} />
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-bulk');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(5);
  },
};

export const FactoryEdgeCases: Story = {
  name: i18n.t('errorDisplay.storyName.factoryEdgeCases', 'Factory: Edge Cases'),
  render: () => {
    const longText = createFakeErrorLongText();
    const manyDetails = createFakeErrorManyDetails();
    const minimal = createFakeMinimalError();
    return (
      <div className="flex flex-col gap-4" data-testid="factory-edge-cases">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.longText', 'Long Text')}
          </p>
          <ErrorDisplayDemo {...longText} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.manyDetails', 'Many Details')}
          </p>
          <ErrorDisplayDemo {...manyDetails} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.minimal', 'Minimal')}
          </p>
          <ErrorDisplayDemo {...minimal} />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-edge-cases');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(3);
  },
};

export const FactoryStates: Story = {
  name: i18n.t('errorDisplay.storyName.factoryStates', 'Factory: With/Without Retry'),
  render: () => {
    const withRetry = createFakeErrorWithRetry();
    const withoutRetry = createFakeErrorWithoutRetry();
    const complete = createFakeCompleteError();
    return (
      <div className="flex flex-col gap-4" data-testid="factory-states">
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.withRetry', 'With Retry')}
          </p>
          <ErrorDisplayDemo {...withRetry} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.withoutRetry', 'Without Retry')}
          </p>
          <ErrorDisplayDemo {...withoutRetry} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">
            {i18n.t('errorDisplay.story.complete', 'Complete')}
          </p>
          <ErrorDisplayDemo {...complete} />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-states');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(3);
  },
};

export const FactoryClientErrors: Story = {
  name: i18n.t('errorDisplay.storyName.factoryClientErrors', 'Factory: Client Errors (4xx)'),
  render: () => {
    const matrix = createClientErrorMatrix();
    return (
      <div className="flex flex-col gap-4" data-testid="factory-client-errors">
        {matrix.map(({ error, status }) => (
          <div key={status}>
            <p className="mb-2 text-sm font-medium">HTTP {status}</p>
            <ErrorDisplayDemo {...error} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-client-errors');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(7);
  },
};

export const FactoryServerErrors: Story = {
  name: i18n.t('errorDisplay.storyName.factoryServerErrors', 'Factory: Server Errors (5xx)'),
  render: () => {
    const matrix = createServerErrorMatrix();
    return (
      <div className="flex flex-col gap-4" data-testid="factory-server-errors">
        {matrix.map(({ error, status }) => (
          <div key={status}>
            <p className="mb-2 text-sm font-medium">HTTP {status}</p>
            <ErrorDisplayDemo {...error} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-server-errors');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(4);
  },
};

export const FactoryTestData: Story = {
  name: i18n.t('errorDisplay.storyName.factoryTestData', 'Factory: Test Data'),
  render: () => {
    const testData = createErrorDisplayTestData();
    return (
      <div className="flex flex-col gap-4" data-testid="factory-test-data">
        <ErrorDisplayDemo {...testData.basic} />
        <ErrorDisplayDemo {...testData.complete} />
        <ErrorDisplayDemo {...testData.minimal} />
        <ErrorDisplayDemo {...testData.longText} />
        <ErrorDisplayDemo {...testData.manyDetails} />
        <ErrorDisplayDemo {...testData.withRetry} />
        <ErrorDisplayDemo {...testData.withoutRetry} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-test-data');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(7);
  },
};

export const FactoryForStatus: Story = {
  name: i18n.t('errorDisplay.storyName.factoryForStatus', 'Factory: Specific Status'),
  render: () => {
    const err404 = createFakeErrorForStatus(404);
    const err500 = createFakeErrorForStatus(500);
    const err503 = createFakeErrorForStatus(503);
    return (
      <div className="flex flex-col gap-4" data-testid="factory-for-status">
        <ErrorDisplayDemo {...err404} />
        <ErrorDisplayDemo {...err500} />
        <ErrorDisplayDemo {...err503} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const container = canvas.getByTestId('factory-for-status');
    expect(container).toBeInTheDocument();

    const errorAlerts = container.querySelectorAll('[data-testid="story-error"]');
    expect(errorAlerts.length).toBe(3);
  },
};
