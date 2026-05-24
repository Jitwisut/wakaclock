import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

import {
  promptMarkdownHandlers,
  promptMarkdownStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-markdown.handlers';
import type { createFakeChatMessage } from '@/.storybook/stories/_factories/chat.factory';
import { createFakeChatMessages } from '@/.storybook/stories/_factories/chat.factory';

import { Markdown } from '@/components/ui/custom/prompt/markdown';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

const SAMPLE_MARKDOWN = `# Heading 1

This is a paragraph with **bold** and *italic* text.

## Heading 2

Here's a code block:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Lists

- Item 1
- Item 2
- Item 3

1. First
2. Second
3. Third

> This is a blockquote

Inline \`code\` example.
`;

const CODE_BLOCK_MARKDOWN = `Here's some TypeScript code:

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
\`\`\`
`;

const LINK_MARKDOWN = `# Links Example

Here's a [link to Google](https://google.com) and another [link to GitHub](https://github.com).

You can also use [relative links](/about) in your markdown.
`;

type MarkdownDemoProps = {
  className: string;
  content: string;
  onLinkClick?: (href: string) => void;
  showBorder: boolean;
};

function MarkdownDemo({
  content = SAMPLE_MARKDOWN,
  className = 'prose dark:prose-invert',
  showBorder = false,
}: MarkdownDemoProps) {
  return (
    <div data-sb-markdown className="w-full max-w-2xl">
      <Markdown className={`${className} ${showBorder ? 'rounded-lg border p-4' : ''}`}>
        {i18n.t('markdown.sample', content)}
      </Markdown>
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

function MarkdownErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="markdown-error">
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
function MarkdownLoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl" data-state="loading" data-testid="markdown-loading">
      <div className="space-y-4 rounded-lg border p-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

// Empty state
function MarkdownEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="markdown-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('markdown.story.noContentToDisplay', 'No content to display')}
      </p>
    </div>
  );
}

// Demo with Faker data (static, no API)
function MarkdownWithFakerData() {
  const messages = React.useMemo(() => createFakeChatMessages(3), []);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {messages.map((message) => (
        <div key={message.id} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{message.role}</span>
            <span className="text-muted-foreground text-xs">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <Markdown className="prose prose-sm dark:prose-invert">{message.content}</Markdown>
        </div>
      ))}
    </div>
  );
}

// Demo component with async data fetching via MSW
function MarkdownWithAsyncData() {
  const [data, setData] = React.useState<ReturnType<typeof createFakeChatMessage> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/chat/messages')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ messages: ReturnType<typeof createFakeChatMessages> }>;
      })
      .then((json) => {
        // Use first message content as markdown
        if (json.messages.length > 0) {
          setData(json.messages[0]);
        }
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
    return <MarkdownLoadingSkeleton />;
  }

  if (error) {
    return <MarkdownErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (!data) {
    return <MarkdownEmptyState />;
  }

  return (
    <div className="w-full max-w-2xl" data-state="success" data-testid="markdown-success">
      <div className="rounded-lg border p-4">
        <Markdown className="prose dark:prose-invert">{data.content}</Markdown>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Markdown',
  component: MarkdownDemo,
  tags: ['autodocs'],
  args: {
    content: SAMPLE_MARKDOWN,
    className: 'prose dark:prose-invert',
    showBorder: false,
    onLinkClick: fn(),
  },
  parameters: {
    msw: {
      handlers: promptMarkdownHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    content: {
      control: 'text',
      description: i18n.t(
        'markdown.argType.markdownContentStringToRender',
        'Markdown content string to render'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'markdown.argType.additionalCssClassesUseTailwindProseClasses',
        'Additional CSS classes (use Tailwind prose classes)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
        defaultValue: { summary: 'prose dark:prose-invert' },
      },
    },
    showBorder: {
      control: 'boolean',
      description: i18n.t(
        'markdown.argType.showBorderAroundTheMarkdownContent',
        'Show border around the markdown content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Events
    onLinkClick: {
      action: 'onLinkClick',
      description: i18n.t(
        'markdown.argType.calledWhenALinkIsClickedOptional',
        'Called when a link is clicked (optional)'
      ),
      table: {
        category: 'Events',
        type: { summary: '(href: string) => void' },
      },
    },
  },
} satisfies Meta<typeof MarkdownDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = canvasElement.querySelector<HTMLElement>('[data-sb-markdown]');
    if (!root) throw new Error('Markdown root not found.');

    // Verify data-testid
    expect(root.querySelector('[data-testid="markdown"]')).toBeInTheDocument();

    // Verify semantic headings
    expect(root.querySelector('h1')).toBeInTheDocument();
    expect(root.querySelector('h2')).toBeInTheDocument();
    expect(root.querySelector('h3')).toBeInTheDocument();

    // Verify code blocks
    expect(root.querySelector('code')).toBeInTheDocument();

    // Verify lists
    expect(root.querySelector('ul')).toBeInTheDocument();
    expect(root.querySelector('ol')).toBeInTheDocument();
    expect(root.querySelector('li')).toBeInTheDocument();

    // Verify blockquote
    expect(root.querySelector('blockquote')).toBeInTheDocument();

    // Verify text formatting
    expect(root.querySelector('strong')).toBeInTheDocument();
    expect(root.querySelector('em')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.simpleText', 'Simple Text')}
        </p>
        <Markdown className="prose dark:prose-invert rounded-lg border p-4">
          This is a simple paragraph with **bold** and *italic* text.
        </Markdown>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.codeBlock', 'Code Block')}
        </p>
        <Markdown className="prose dark:prose-invert rounded-lg border p-4">
          {`Here's some code:

\`\`\`javascript
const sum = (a, b) => a + b;
console.log(sum(1, 2));
\`\`\`
`}
        </Markdown>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.lists', 'Lists')}
        </p>
        <Markdown className="prose dark:prose-invert rounded-lg border p-4">
          {`## Shopping List

- Apples
- Bananas
- Oranges

## Steps

1. First step
2. Second step
3. Third step
`}
        </Markdown>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.blockquote', 'Blockquote')}
        </p>
        <Markdown className="prose dark:prose-invert rounded-lg border p-4">
          {`> "The only way to do great work is to love what you do."
>
> — Steve Jobs
`}
        </Markdown>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.tableGfm', 'Table (GFM)')}
        </p>
        <Markdown className="prose dark:prose-invert rounded-lg border p-4">
          {`| Name | Age | City |
|------|-----|------|
| John | 25 | NYC |
| Jane | 30 | LA |
| Bob | 35 | Chicago |
`}
        </Markdown>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.smallProsesm', 'Small (prose-sm)')}
        </p>
        <div className="w-[400px]">
          <Markdown className="prose prose-sm dark:prose-invert rounded-lg border p-3">
            This is **small** prose with `inline code` and a [link](#).
          </Markdown>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.defaultProse', 'Default (prose)')}
        </p>
        <div className="w-[500px]">
          <Markdown className="prose dark:prose-invert rounded-lg border p-4">
            This is **default** prose with `inline code` and a [link](#).
          </Markdown>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('markdown.story.largeProselg', 'Large (prose-lg)')}
        </p>
        <div className="w-full max-w-2xl">
          <Markdown className="prose prose-lg dark:prose-invert rounded-lg border p-5">
            This is **large** prose with `inline code` and a [link](#).
          </Markdown>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CodeBlockHighlighting: Story = {
  args: {
    content: CODE_BLOCK_MARKDOWN,
    showBorder: true,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-markdown]');
    if (!root) throw new Error('Markdown root not found.');

    // Verify code block exists
    const codeBlock = root.querySelector('[data-slot="code-block"]');
    expect(codeBlock).toBeInTheDocument();

    // Verify pre element
    expect(root.querySelector('pre')).toBeInTheDocument();
  },
};

export const LinkNavigation: Story = {
  args: {
    content: LINK_MARKDOWN,
    showBorder: true,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-markdown]');
    if (!root) throw new Error('Markdown root not found.');

    // Verify links exist
    const links = root.querySelectorAll('a');
    expect(links.length).not.toBe(0);

    // All links should have href
    links.forEach((link) => {
      expect(link).toHaveAttribute('href');
    });
  },
};

export const KeyboardNavigation: Story = {
  args: {
    content: LINK_MARKDOWN,
    showBorder: true,
  },
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelectorAll('a');
    expect(links.length).not.toBe(0);

    // Tab to first link
    await userEvent.tab();

    // First link should have focus
    await waitFor(() => {
      expect(links[0]).toHaveFocus();
    });

    // Tab to second link
    await userEvent.tab();
    await waitFor(() => {
      expect(links[1]).toHaveFocus();
    });

    // Shift+Tab back to first link
    await userEvent.tab({ shift: true });
    await waitFor(() => {
      expect(links[0]).toHaveFocus();
    });
  },
};

export const AccessibilityTest: Story = {
  args: {
    content: SAMPLE_MARKDOWN,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-markdown]');
    if (!root) throw new Error('Markdown root not found.');

    // Verify data-testid for testing
    expect(root.querySelector('[data-testid="markdown"]')).toBeInTheDocument();

    // Verify semantic structure
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).not.toBe(0);

    // Verify heading hierarchy (h1 before h2, h2 before h3, etc.)
    const headingLevels = [...headings].map((h) => parseInt(h.tagName.charAt(1), 10));

    // Check heading levels don't skip (e.g., h1 to h3 without h2)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      // Allow same level, one level deeper, or going back up
      expect(diff).toBeLessThanOrEqual(1);
    }

    // Verify lists have proper structure
    const lists = root.querySelectorAll('ul, ol');
    lists.forEach((list) => {
      expect(list.querySelector('li')).toBeInTheDocument();
    });

    // Verify blockquotes are semantic
    const blockquotes = root.querySelectorAll('blockquote');
    expect(blockquotes.length).not.toBe(0);
  },
};

export const EmptyContent: Story = {
  args: {
    content: '',
    showBorder: true,
  },
  play: async ({ canvasElement }) => {
    // Should still render the markdown container
    const markdown = canvasElement.querySelector('[data-testid="markdown"]');
    expect(markdown).toBeInTheDocument();
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
  ...Default,
  name: i18n.t('markdown.storyName.japanese', 'Japanese'),
  args: {
    content: `# 見出し1

これは**太字**と*斜体*のテキストを含む段落です。

## 見出し2

\`\`\`typescript
function 挨拶(名前: string): string {
  return \`こんにちは、\${名前}さん！\`;
}
\`\`\`

### リスト

- アイテム1
- アイテム2
- アイテム3

> これは引用です
`,
  },
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    expect(canvasElement.querySelector('[data-testid="markdown"]')).toBeInTheDocument();

    // Verify Japanese content renders
    expect(canvasElement.textContent).toContain('見出し');
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
  name: i18n.t('markdown.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => <MarkdownWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="markdown"]')).toBeInTheDocument();
    const messages = canvasElement.querySelectorAll('.rounded-lg.border');
    expect(messages.length).toBe(3);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: promptMarkdownHandlers },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="markdown-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="markdown-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify markdown rendered
    expect(canvasElement.querySelector('[data-testid="markdown"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.loading },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="markdown-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <MarkdownEmptyState />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="markdown-empty"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('markdown.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.badRequest },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.unauthorized },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.forbidden },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.unprocessableEntity },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.tooManyRequests },
  },
  render: () => <MarkdownWithAsyncData />,
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
    'markdown.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.internalServerError },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.badGateway },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.serviceUnavailable },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.gatewayTimeout },
  },
  render: () => <MarkdownWithAsyncData />,
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
  name: i18n.t('markdown.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.slowResponse },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="markdown-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 8s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="markdown-success"]')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('markdown.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.networkError },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="markdown-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptMarkdownHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

// ============ COMBINED MODE STORIES ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('markdown.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('markdown.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('markdown.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('markdown.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ UNWIRED HANDLER STATUS STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('markdown.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.notFound },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="404"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('markdown.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: promptMarkdownStatusHandlers.conflict },
  },
  render: () => <MarkdownWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('markdown.storyName.accessibility', 'Accessibility'),
  args: {
    content: SAMPLE_MARKDOWN,
  },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-sb-markdown]');
    if (!root) throw new Error('Markdown root not found.');

    // Verify data-testid for testing
    expect(root.querySelector('[data-testid="markdown"]')).toBeInTheDocument();

    // Verify semantic heading structure
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).not.toBe(0);

    // Verify heading hierarchy (no skipped levels)
    const headingLevels = [...headings].map((h) => parseInt(h.tagName.charAt(1), 10));
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }

    // Verify lists have proper structure
    const lists = root.querySelectorAll('ul, ol');
    lists.forEach((list) => {
      expect(list.querySelector('li')).toBeInTheDocument();
    });

    // Verify code blocks are present
    expect(root.querySelector('code')).toBeInTheDocument();

    // Verify blockquotes are semantic
    expect(root.querySelector('blockquote')).toBeInTheDocument();

    // Test keyboard navigation through links
    const links = root.querySelectorAll('a');
    if (links.length > 0) {
      await userEvent.tab();
      await waitFor(() => {
        expect(links[0]).toHaveFocus();
      });

      // Verify all links have href
      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    }

    // Verify text formatting elements exist
    expect(root.querySelector('strong')).toBeInTheDocument();
    expect(root.querySelector('em')).toBeInTheDocument();
  },
};

export const HandlerPromptMarkdownSuccess: Story = {
  ...Default,
  name: i18n.t(
    'markdown.storyName.handlerPromptMarkdownSuccess',
    'Handler: Prompt Markdown Success'
  ),
  parameters: { msw: { handlers: promptMarkdownStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
