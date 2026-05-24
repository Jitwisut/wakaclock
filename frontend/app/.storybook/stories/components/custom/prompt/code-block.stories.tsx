import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  codeBlockHandlers,
  codeBlockStatusHandlers,
} from '@/.storybook/stories/_handlers/code-block.handlers';
import {
  createFakeCodeBlock,
  createFakeCodeBlocks,
} from '@/.storybook/stories/_factories/chat.factory';
import { CodeBlock, CodeBlockCode, CodeBlockGroup } from '@/components/ui/custom/prompt/code-block';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function PromptCodeBlockDemo({
  code,
  language,
  theme,
  filename,
  onCopy,
}: {
  code: string;
  filename?: string;
  language: string;
  onCopy?: (value: string) => void;
  theme: string;
}) {
  const copyLabel = i18n.t('promptCodeBlock.copy');

  return (
    <div className="w-full max-w-3xl">
      <CodeBlock>
        <CodeBlockGroup className="border-border border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium">{language}</div>
            {filename && <div className="text-muted-foreground text-xs">({filename})</div>}
          </div>
          <Button aria-label={copyLabel} onClick={() => onCopy?.(code)} size="sm" variant="outline">
            {copyLabel}
          </Button>
        </CodeBlockGroup>
        <CodeBlockCode code={code} language={language} theme={theme} />
      </CodeBlock>
    </div>
  );
}

// Demo with Faker data (static, no API)
function CodeBlockWithFakerData() {
  const codeBlocks = React.useMemo(() => createFakeCodeBlocks(3), []);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      {codeBlocks.map((block, index) => (
        <CodeBlock key={`code-block-${String(index)}`}>
          <CodeBlockGroup className="border-border border-b px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium">{block.language}</div>
              {block.filename && (
                <div className="text-muted-foreground text-xs">({block.filename})</div>
              )}
            </div>
            <Button aria-label={i18n.t('codeBlock.story.copy', 'Copy')} size="sm" variant="outline">
              Copy
            </Button>
          </CodeBlockGroup>
          <CodeBlockCode code={block.code} language={block.language} theme="github-dark" />
        </CodeBlock>
      ))}
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function CodeBlockErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="code-block-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function CodeBlockLoadingSkeleton() {
  return (
    <div className="w-full max-w-3xl" data-state="loading" data-testid="code-block-loading">
      <div className="rounded-lg border">
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="p-4">
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="mb-2 h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

// Empty state
function CodeBlockEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="code-block-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('codeBlock.story.noCodeToDisplay', 'No code to display')}
      </p>
    </div>
  );
}

// Demo component with async data fetching via MSW
function CodeBlockWithAsyncData() {
  const [data, setData] = React.useState<ReturnType<typeof createFakeCodeBlock> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/chat/suggestions')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        // Simulate code block in response
        return { codeBlock: createFakeCodeBlock('typescript') };
      })
      .then((json) => {
        setData(json.codeBlock);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <CodeBlockLoadingSkeleton />;
  }

  if (error) {
    return <CodeBlockErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (!data) {
    return <CodeBlockEmptyState />;
  }

  return (
    <div className="w-full max-w-3xl" data-state="success" data-testid="code-block-success">
      <CodeBlock>
        <CodeBlockGroup className="border-border border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium">{data.language}</div>
            {data.filename && (
              <div className="text-muted-foreground text-xs">({data.filename})</div>
            )}
          </div>
          <Button aria-label={i18n.t('codeBlock.story.copy', 'Copy')} size="sm" variant="outline">
            Copy
          </Button>
        </CodeBlockGroup>
        <CodeBlockCode code={data.code} language={data.language} theme="github-dark" />
      </CodeBlock>
    </div>
  );
}

function I18nCodeBlockDemo() {
  const { t } = useTranslation();
  const codeBlock = createFakeCodeBlock('typescript');

  return (
    <div className="w-full max-w-3xl">
      <CodeBlock>
        <CodeBlockGroup className="border-border border-b px-4 py-2">
          <div className="text-xs font-medium">{codeBlock.language}</div>
          <Button aria-label={t('promptCodeBlock.copy')} size="sm" variant="outline">
            {t('promptCodeBlock.copy')}
          </Button>
        </CodeBlockGroup>
        <CodeBlockCode code={codeBlock.code} language={codeBlock.language} theme="github-dark" />
      </CodeBlock>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Code Block',
  component: PromptCodeBlockDemo,
  tags: ['autodocs'],
  args: {
    language: 'tsx',
    theme: 'github-dark',
    code: `export function hello(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`,
    filename: undefined,
    onCopy: fn(),
  },
  argTypes: {
    // Content
    language: {
      control: 'select',
      options: ['tsx', 'ts', 'js', 'json', 'bash', 'css', 'html', 'md', 'python', 'rust', 'go'],
      description: i18n.t(
        'codeBlock.argType.programmingLanguageForSyntaxHighlighting',
        'Programming language for syntax highlighting'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'tsx' },
      },
    },
    code: {
      control: 'text',
      description: i18n.t('codeBlock.argType.codeContentToDisplay', 'Code content to display'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    filename: {
      control: 'text',
      description: i18n.t(
        'codeBlock.argType.optionalFilenameToDisplay',
        'Optional filename to display'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    theme: {
      control: 'select',
      options: ['github-dark', 'github-light', 'nord', 'dracula', 'vitesse-dark', 'vitesse-light'],
      description: i18n.t(
        'codeBlock.argType.syntaxHighlightingColorTheme',
        'Syntax highlighting color theme'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'github-dark' },
      },
    },
    // Events
    onCopy: {
      action: 'onCopy',
      description: i18n.t(
        'codeBlock.argType.calledWhenCopyButtonIsClicked',
        'Called when copy button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string) => void' },
      },
    },
  },
  parameters: {
    msw: { handlers: codeBlockHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof PromptCodeBlockDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="code-block"]')).toBeInTheDocument();

    if (typeof args.onCopy !== 'function') {
      throw new TypeError('Expected `onCopy` to be provided.');
    }

    const canvas = within(canvasElement);
    const copyButton = canvas.getByRole('button', { name: 'Copy' });

    await waitFor(() => {
      expect(canvasElement.textContent).toContain('export function hello');
    });

    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(canvasElement.textContent).toContain('return');
    });

    await waitFor(() => {
      expect(args.onCopy).toHaveBeenCalledTimes(1);
    });

    expect(args.onCopy).toHaveBeenCalledWith(args.code);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">TypeScript/TSX</h3>
        <PromptCodeBlockDemo
          code={`export function hello(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`}
          language="tsx"
          theme="github-dark"
        />
      </div>
      <div>
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">JSON</h3>
        <PromptCodeBlockDemo
          code={`{\n  "name": "example",\n  "version": "1.0.0"\n}`}
          language="json"
          theme="github-dark"
        />
      </div>
      <div>
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('codeBlock.story.bash', 'Bash')}
        </h3>
        <PromptCodeBlockDemo
          code={`#!/bin/bash\necho "Hello, World!"\nnpm install`}
          language="bash"
          theme="github-dark"
        />
      </div>
      <div>
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('codeBlock.story.python', 'Python')}
        </h3>
        <PromptCodeBlockDemo
          code={`def fibonacci(n: int) -> list[int]:\n    if n <= 0:\n        return []\n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[i-1] + fib[i-2])\n    return fib[:n]`}
          language="python"
          theme="github-dark"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="max-w-sm">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('codeBlock.story.smallContainer', 'Small Container')}
        </h3>
        <PromptCodeBlockDemo code="const x = 1;" language="tsx" theme="github-dark" />
      </div>
      <div className="max-w-2xl">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('codeBlock.story.mediumContainer', 'Medium Container')}
        </h3>
        <PromptCodeBlockDemo
          code={`export function hello(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`}
          language="tsx"
          theme="github-dark"
        />
      </div>
      <div className="max-w-4xl">
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {i18n.t('codeBlock.story.largeContainer', 'Large Container')}
        </h3>
        <PromptCodeBlockDemo
          code={`export function hello(name: string) {\n  return \`Hello, \${name}!\`;\n}\n\nexport function goodbye(name: string) {\n  return \`Goodbye, \${name}!\`;\n}\n`}
          language="tsx"
          theme="github-dark"
        />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

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

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nCodeBlockDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByRole('button', { name: 'コピー' })).toBeInTheDocument();
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

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('codeBlock.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <CodeBlockWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="code-block"]')).toBeInTheDocument();
    const codeBlocks = canvasElement.querySelectorAll('[data-slot="code-block"]');
    expect(codeBlocks.length).toBe(3);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: codeBlockHandlers },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="code-block-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="code-block-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify code block rendered
    expect(canvasElement.querySelector('[data-slot="code-block"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.loading },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="code-block-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <CodeBlockEmptyState />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="code-block-empty"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('codeBlock.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.badRequest },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('codeBlock.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.unauthorized },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('codeBlock.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.forbidden },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('codeBlock.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.unprocessableEntity },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('codeBlock.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.tooManyRequests },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'codeBlock.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.internalServerError },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('codeBlock.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.badGateway },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('codeBlock.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.serviceUnavailable },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('codeBlock.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.gatewayTimeout },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('codeBlock.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.slowResponse },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="code-block-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 8s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="code-block-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('codeBlock.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.networkError },
  },
  render: () => <CodeBlockWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="code-block-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: codeBlockHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('codeBlock.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify code block has proper structure
    const codeBlock = canvasElement.querySelector('[data-slot="code-block"]');
    expect(codeBlock).toBeInTheDocument();

    // Verify copy button has aria-label
    const canvas = within(canvasElement);
    const copyButton = canvas.getByRole('button', { name: /copy/i });
    expect(copyButton).toHaveAttribute('aria-label');

    // Verify pre element for code
    expect(canvasElement.querySelector('pre')).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    expect(copyButton).toHaveFocus();

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
  },
};

// ============================================================================
// GOLD-STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusNotFound: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.statusNotFound', 'Handler: Not Found'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusConflict: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.statusConflict', 'Handler: Conflict'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const StatusExecutionError: Story = {
  ...Default,
  name: i18n.t('codeBlock.storyName.statusExecutionError', 'Handler: Execution Error'),
  parameters: {
    msw: { handlers: codeBlockStatusHandlers.executionError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
