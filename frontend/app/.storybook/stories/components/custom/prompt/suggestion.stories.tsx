import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

import {
  promptSuggestionHandlers,
  promptSuggestionStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-suggestion.handlers';
import { createFakeSuggestions } from '@/.storybook/stories/_factories/chat.factory';

import { Suggestion } from '@/components/ui/custom/prompt/suggestion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type SuggestionDemoProps = {
  children: string;
  disabled: boolean;
  highlight: string;
  onClick?: () => void;
  size: 'default' | 'sm' | 'lg' | 'icon';
  variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
};

function SuggestionDemo({
  children = 'Summarize this document',
  variant = 'outline',
  size = 'lg',
  highlight = '',
  disabled = false,
  onClick,
}: SuggestionDemoProps) {
  return (
    <div data-sb-suggestion className="w-full max-w-2xl">
      <Suggestion
        variant={variant}
        size={size}
        highlight={highlight || undefined}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Suggestion>
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

function SuggestionErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="suggestion-error">
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
function SuggestionLoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl" data-state="loading" data-testid="suggestion-loading">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>
    </div>
  );
}

// Empty state
function SuggestionEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="suggestion-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('suggestion.story.noSuggestionsAvailable', 'No suggestions available')}
      </p>
    </div>
  );
}

// Demo with Faker data (static, no API)
function SuggestionWithFakerData() {
  const suggestions = React.useMemo(() => createFakeSuggestions(5), []);
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Suggestion key={suggestion.id} onClick={() => setSelected(suggestion.text)}>
            {suggestion.text}
          </Suggestion>
        ))}
      </div>
      {selected && (
        <div className="text-muted-foreground text-sm">
          Selected: <strong>{selected}</strong>
        </div>
      )}
    </div>
  );
}

// Demo component with async data fetching via MSW
function SuggestionWithAsyncData() {
  const [suggestions, setSuggestions] = React.useState<ReturnType<typeof createFakeSuggestions>>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/chat/suggestions')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ suggestions: ReturnType<typeof createFakeSuggestions> }>;
      })
      .then((json) => {
        setSuggestions(json.suggestions);
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
    return <SuggestionLoadingSkeleton />;
  }

  if (error) {
    return <SuggestionErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (suggestions.length === 0) {
    return <SuggestionEmptyState />;
  }

  return (
    <div
      className="w-full max-w-2xl space-y-4"
      data-state="success"
      data-testid="suggestion-success"
    >
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Suggestion key={suggestion.id} onClick={() => setSelected(suggestion.text)}>
            {suggestion.text}
          </Suggestion>
        ))}
      </div>
      {selected && (
        <div className="text-muted-foreground text-sm">
          Selected: <strong>{selected}</strong>
        </div>
      )}
    </div>
  );
}

function KeyboardInteractionDemo() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const suggestions = [
    'Summarize this document',
    'Explain how this works',
    'Suggest improvements',
    'Generate code example',
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Press Tab to navigate, Enter or Space to select
      </p>
      <p className="text-muted-foreground text-sm">
        Selected: <strong>{selected ?? i18n.t('suggestion.story.none', 'None')}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <Suggestion key={text} onClick={() => setSelected(text)}>
            {text}
          </Suggestion>
        ))}
      </div>
    </div>
  );
}

function HighlightSearchDemo() {
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = React.useState('sum');

  const suggestions = [
    'Summarize this document',
    'Generate a summary report',
    'Explain how this works',
    'Suggest improvements',
    'Assume default settings',
    'Generate code example',
  ];

  const filtered = suggestions.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full max-w-md space-y-4">
      <div>
        <label htmlFor="suggestion-search" className="text-muted-foreground mb-1 block text-sm">
          Search term:
        </label>
        <input
          id="suggestion-search"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder={i18n.t('promptSuggestion.story.typeToFilter', 'Type to filter...')}
        />
      </div>
      <div className="flex flex-col gap-1">
        {filtered.map((text) => (
          <Suggestion key={text} highlight={searchTerm}>
            {text}
          </Suggestion>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t('suggestion.story.noMatchesFound', 'No matches found')}
          </p>
        )}
      </div>
    </div>
  );
}

function SuggestionListDemo() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const suggestions = [
    'Summarize this document',
    'Explain how this works',
    'Suggest improvements',
    'Generate code example',
  ];

  return (
    <div data-sb-suggestion-list className="w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <Suggestion key={text} onClick={() => setSelected(text)}>
            {text}
          </Suggestion>
        ))}
      </div>

      {selected && (
        <div className="text-muted-foreground text-sm">
          Selected: <strong>{selected}</strong>
        </div>
      )}
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Suggestion',
  component: SuggestionDemo,
  tags: ['autodocs'],
  args: {
    children: i18n.t('suggestion.story.summarizeThisDocument', 'Summarize this document'),
    variant: 'outline',
    size: 'lg',
    highlight: '',
    disabled: false,
    onClick: fn(),
  },
  parameters: {
    msw: {
      handlers: promptSuggestionHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: 'text',
      description: i18n.t('suggestion.argType.suggestionTextContent', 'Suggestion text content'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    highlight: {
      control: 'text',
      description: i18n.t(
        'suggestion.argType.textToHighlightWithinTheSuggestionEnablesHighlightMode',
        'Text to highlight within the suggestion (enables highlight mode)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: '' },
      },
    },
    // Appearance
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
      description: i18n.t('suggestion.argType.buttonStyleVariant', 'Button style variant'),
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'" },
        defaultValue: { summary: 'outline' },
      },
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: i18n.t('suggestion.argType.buttonSize', 'Button size'),
      table: {
        category: 'Appearance',
        type: { summary: "'default' | 'sm' | 'lg' | 'icon'" },
        defaultValue: { summary: 'lg' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'suggestion.argType.disableTheSuggestionButton',
        'Disable the suggestion button'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t(
        'suggestion.argType.calledWhenTheSuggestionIsClicked',
        'Called when the suggestion is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
  },
} satisfies Meta<typeof SuggestionDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  render: () => <SuggestionListDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = canvasElement.querySelector<HTMLElement>('[data-sb-suggestion-list]');
    if (!root) throw new Error('Suggestion root not found.');

    const suggestions = root.querySelectorAll('[data-testid="prompt-suggestion"]');
    expect(suggestions.length).not.toBe(0);

    // Verify data-slot
    expect(suggestions[0].getAttribute('data-slot')).toBe('prompt-suggestion');

    // Click first suggestion
    const firstSuggestion = suggestions[0] as HTMLElement;
    await userEvent.click(firstSuggestion);

    // Verify selection is shown
    await waitFor(() => {
      expect(root.textContent).toContain('Selected');
    });
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.defaultOutline', 'Default (Outline)')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion>Quick action 1</Suggestion>
          <Suggestion>Quick action 2</Suggestion>
          <Suggestion>Quick action 3</Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.withHighlight', 'With Highlight')}
        </p>
        <div className="flex max-w-md flex-col gap-1">
          <Suggestion highlight="sum">
            {i18n.t('suggestion.story.summarizeThisDocument', 'Summarize this document')}
          </Suggestion>
          <Suggestion highlight="code">
            {i18n.t('suggestion.story.generateCodeExample', 'Generate code example')}
          </Suggestion>
          <Suggestion highlight="explain">
            {i18n.t('suggestion.story.explainHowThisWorks', 'Explain how this works')}
          </Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.differentButtonVariants', 'Different Button Variants')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion variant="default">{i18n.t('suggestion.story.primary', 'Primary')}</Suggestion>
          <Suggestion variant="secondary">
            {i18n.t('suggestion.story.secondary', 'Secondary')}
          </Suggestion>
          <Suggestion variant="outline">{i18n.t('suggestion.story.outline', 'Outline')}</Suggestion>
          <Suggestion variant="ghost">{i18n.t('suggestion.story.ghost', 'Ghost')}</Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.disabledState', 'Disabled State')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion disabled>
            {i18n.t('suggestion.story.disabledSuggestion', 'Disabled suggestion')}
          </Suggestion>
          <Suggestion>
            {i18n.t('suggestion.story.enabledSuggestion', 'Enabled suggestion')}
          </Suggestion>
        </div>
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
          {i18n.t('suggestion.story.small', 'Small')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion size="sm">
            {i18n.t('suggestion.story.smallSuggestion', 'Small suggestion')}
          </Suggestion>
          <Suggestion size="sm">
            {i18n.t('suggestion.story.anotherSmall', 'Another small')}
          </Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.default', 'Default')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion>
            {i18n.t('suggestion.story.defaultSuggestion', 'Default suggestion')}
          </Suggestion>
          <Suggestion>{i18n.t('suggestion.story.anotherDefault', 'Another default')}</Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.large', 'Large')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Suggestion size="lg">
            {i18n.t('suggestion.story.largeSuggestion', 'Large suggestion')}
          </Suggestion>
          <Suggestion size="lg">
            {i18n.t('suggestion.story.anotherLarge', 'Another large')}
          </Suggestion>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('suggestion.story.inDifferentContainers', 'In Different Containers')}
        </p>
        <div className="space-y-4">
          <div className="w-[300px] rounded-lg border p-3">
            <div className="flex flex-wrap gap-1">
              <Suggestion size="sm">Option 1</Suggestion>
              <Suggestion size="sm">Option 2</Suggestion>
            </div>
          </div>
          <div className="w-full max-w-lg rounded-lg border p-4">
            <div className="flex flex-wrap gap-2">
              <Suggestion>
                {i18n.t('suggestion.story.summarizeDocument', 'Summarize document')}
              </Suggestion>
              <Suggestion>
                {i18n.t('suggestion.story.extractKeyPoints', 'Extract key points')}
              </Suggestion>
              <Suggestion>
                {i18n.t('suggestion.story.generateOutline', 'Generate outline')}
              </Suggestion>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HighlightMode: Story = {
  args: {
    children: i18n.t('suggestion.story.summarizeThisDocument', 'Summarize this document'),
    highlight: 'sum',
  },
  play: async ({ canvasElement }) => {
    const suggestion = canvasElement.querySelector('[data-testid="prompt-suggestion"]');
    expect(suggestion).toBeInTheDocument();

    // Verify highlight mode styling (ghost variant, full width)
    expect(suggestion?.className).toContain('w-full');
    expect(suggestion?.className).toContain('justify-start');

    // Verify text highlighting
    const highlightedText = suggestion?.querySelector('.text-primary');
    expect(highlightedText).toBeInTheDocument();
    expect(highlightedText?.textContent?.toLowerCase()).toContain('sum');
  },
};

export const HighlightSearch: Story = {
  render: () => <HighlightSearchDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the search input
    const input = canvas.getByPlaceholderText('Type to filter...');
    expect(input).toBeInTheDocument();

    // Type a new search term
    await userEvent.clear(input);
    await userEvent.type(input, 'explain');

    // Verify filtered results
    await waitFor(() => {
      const suggestions = canvasElement.querySelectorAll('[data-testid="prompt-suggestion"]');
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].textContent).toContain('Explain');
    });
  },
};

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const suggestions = canvas.getAllByTestId('prompt-suggestion');
    expect(suggestions.length).toBe(4);

    // Tab to first suggestion
    await userEvent.tab();
    expect(suggestions[0]).toHaveFocus();

    // Press Enter to select
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Summarize');
    });

    // Tab to next suggestion
    await userEvent.tab();
    expect(suggestions[1]).toHaveFocus();

    // Press Space to select
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Explain');
    });

    // Shift+Tab back
    await userEvent.tab({ shift: true });
    expect(suggestions[0]).toHaveFocus();
  },
};

export const DisabledKeyboardBehavior: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Disabled suggestions should be skipped during keyboard navigation
      </p>
      <div className="flex flex-wrap gap-2">
        <Suggestion disabled>Disabled 1</Suggestion>
        <Suggestion>Enabled 1</Suggestion>
        <Suggestion disabled>Disabled 2</Suggestion>
        <Suggestion>Enabled 2</Suggestion>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const suggestions = canvasElement.querySelectorAll('[data-testid="prompt-suggestion"]');
    expect(suggestions.length).toBe(4);

    // Tab should skip disabled buttons
    await userEvent.tab();

    // First enabled button should have focus (skip disabled)
    const enabledButtons = [...suggestions].filter((s) => !(s as HTMLButtonElement).disabled);
    expect(enabledButtons[0]).toHaveFocus();

    // Tab to next enabled
    await userEvent.tab();
    expect(enabledButtons[1]).toHaveFocus();
  },
};

export const AccessibilityTest: Story = {
  render: () => <SuggestionListDemo />,
  play: async ({ canvasElement }) => {
    const suggestions = canvasElement.querySelectorAll('[data-testid="prompt-suggestion"]');

    // All suggestions should be buttons
    suggestions.forEach((suggestion) => {
      expect(suggestion.tagName.toLowerCase()).toBe('button');
      expect(suggestion.getAttribute('type')).toBe('button');
    });

    // Data attributes for testing
    suggestions.forEach((suggestion) => {
      expect(suggestion.getAttribute('data-slot')).toBe('prompt-suggestion');
      expect(suggestion.getAttribute('data-testid')).toBe('prompt-suggestion');
    });
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
  name: i18n.t('suggestion.storyName.japanese', 'Japanese'),
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

    expect(canvasElement.querySelector('[data-testid="prompt-suggestion"]')).toBeInTheDocument();
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
  name: i18n.t('suggestion.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => <SuggestionWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="prompt-suggestion"]')).toBeInTheDocument();
    const suggestions = canvasElement.querySelectorAll('[data-testid="prompt-suggestion"]');
    expect(suggestions.length).toBe(5);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: promptSuggestionHandlers },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="suggestion-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="suggestion-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify suggestions rendered
    expect(canvasElement.querySelector('[data-testid="prompt-suggestion"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.loading },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="suggestion-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <SuggestionEmptyState />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="suggestion-empty"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('suggestion.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.badRequest },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.unauthorized },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.forbidden },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.unprocessableEntity },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.tooManyRequests },
  },
  render: () => <SuggestionWithAsyncData />,
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
    'suggestion.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.internalServerError },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.badGateway },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.serviceUnavailable },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.gatewayTimeout },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.slowResponse },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="suggestion-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 8s)
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-testid="suggestion-success"]')
        ).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('suggestion.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.networkError },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="suggestion-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptSuggestionHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ COMBINED MODE STORIES ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('suggestion.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('suggestion.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('suggestion.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('suggestion.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ UNWIRED HANDLER STATUS STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('suggestion.storyName.error404NotFound', 'Error 404: Not Found'),

  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.notFound },
  },
  render: () => <SuggestionWithAsyncData />,
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
  name: i18n.t('suggestion.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.conflict },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="409"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyDataFromApi: Story = {
  name: i18n.t('suggestion.storyName.emptyDataFromApi', 'Empty Data from API'),
  parameters: {
    msw: { handlers: promptSuggestionStatusHandlers.emptyData },
  },
  render: () => <SuggestionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="suggestion-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ ACCESSIBILITY STORY ============

function AccessibilityDemo() {
  const [selected, setSelected] = React.useState<string | null>(null);

  const suggestions = [
    'Summarize this document',
    'Explain how this works',
    'Suggest improvements',
    'Generate code example',
  ];

  return (
    <div data-sb-suggestion-a11y className="w-full max-w-2xl space-y-4">
      <p className="text-muted-foreground text-sm">
        Selected: <strong>{selected ?? i18n.t('suggestion.story.none', 'None')}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <Suggestion key={text} onClick={() => setSelected(text)}>
            {text}
          </Suggestion>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Suggestion disabled>
          {i18n.t('suggestion.story.disabledSuggestion', 'Disabled suggestion')}
        </Suggestion>
      </div>
    </div>
  );
}

export const Accessibility: Story = {
  name: i18n.t('suggestion.storyName.accessibility', 'Accessibility'),
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all suggestions are buttons
    const suggestions = canvas.getAllByTestId('prompt-suggestion');
    suggestions.forEach((suggestion) => {
      expect(suggestion.tagName.toLowerCase()).toBe('button');
      expect(suggestion.getAttribute('type')).toBe('button');
    });

    // Verify data-slot attributes
    suggestions.forEach((suggestion) => {
      expect(suggestion.getAttribute('data-slot')).toBe('prompt-suggestion');
    });

    // Test keyboard navigation
    await userEvent.tab();
    expect(suggestions[0]).toHaveFocus();

    // Test Enter key activation
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Summarize');
    });

    // Tab to next suggestion
    await userEvent.tab();
    expect(suggestions[1]).toHaveFocus();

    // Test Space key activation
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(canvasElement.textContent).toContain('Explain');
    });

    // Shift+Tab navigation
    await userEvent.tab({ shift: true });
    expect(suggestions[0]).toHaveFocus();

    // Verify disabled suggestions are skipped in tab order
    const disabledSuggestion = canvasElement.querySelector('[disabled]');
    expect(disabledSuggestion).toBeInTheDocument();
    expect(disabledSuggestion).toHaveAttribute('disabled');

    // Tab through all enabled suggestions to verify disabled is skipped
    const enabledSuggestions = [...suggestions].filter((s) => !(s as HTMLButtonElement).disabled);
    for (let i = 1; i < enabledSuggestions.length; i++) {
      await userEvent.tab();
    }
    // Focus should be on last enabled, not disabled
    expect(enabledSuggestions[enabledSuggestions.length - 1]).toHaveFocus();
  },
};

export const HandlerPromptSuggestionSuccess: Story = {
  ...Default,
  name: i18n.t(
    'suggestion.storyName.handlerPromptSuggestionSuccess',
    'Handler: Prompt Suggestion Success'
  ),
  parameters: { msw: { handlers: promptSuggestionStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
