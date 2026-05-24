import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { AlertCircleIcon, MicIcon, PaperclipIcon, RefreshCwIcon, SendIcon } from 'lucide-react';

import {
  promptInputHandlers,
  promptInputStatusHandlers,
} from '@/.storybook/stories/_handlers/prompt-input.handlers';
import { createFakeSuggestions } from '@/.storybook/stories/_factories/chat.factory';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Input as PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/custom/prompt/input';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type PromptInputDemoProps = {
  disabled: boolean;
  initialValue: string;
  isLoading: boolean;
  maxHeight: number;
  onAttachClick?: () => void;
  onSubmit?: () => void;
  onValueChange?: (value: string) => void;
  onVoiceClick?: () => void;
  placeholder: string;
  showAttachButton: boolean;
  showVoiceButton: boolean;
};

function PromptInputDemo({
  placeholder = 'Type a message...',
  isLoading = false,
  maxHeight = 240,
  disabled = false,
  showAttachButton = true,
  showVoiceButton = true,
  initialValue = '',
  onSubmit,
  onValueChange,
  onAttachClick,
  onVoiceClick,
}: PromptInputDemoProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState(initialValue);
  const [loading, setLoading] = React.useState(isLoading);

  React.useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    onValueChange?.(newValue);
  };

  const handleSubmit = () => {
    if (!value.trim() || loading || disabled) return;
    onSubmit?.();
    setLoading(true);
    setTimeout(() => {
      setValue('');
      setLoading(false);
    }, 500);
  };

  return (
    <div data-sb-prompt-input className="w-full max-w-2xl">
      <PromptInput
        isLoading={loading}
        onSubmit={handleSubmit}
        onValueChange={handleValueChange}
        value={value}
        maxHeight={maxHeight}
      >
        <PromptInputTextarea
          disabled={loading || disabled}
          placeholder={t('promptInput.placeholder', placeholder)}
        />
        <PromptInputActions className="justify-between">
          <div className="flex gap-1">
            {showAttachButton && (
              <PromptInputAction tooltip={t('promptInput.attach', 'Attach file')}>
                <Button
                  aria-label={t('promptInput.attach', 'Attach file')}
                  size="icon"
                  variant="ghost"
                  disabled={loading || disabled}
                  onClick={onAttachClick}
                >
                  <PaperclipIcon />
                </Button>
              </PromptInputAction>
            )}
            {showVoiceButton && (
              <PromptInputAction tooltip={t('promptInput.voice', 'Voice input')}>
                <Button
                  aria-label={t('promptInput.voice', 'Voice input')}
                  size="icon"
                  variant="ghost"
                  disabled={loading || disabled}
                  onClick={onVoiceClick}
                >
                  <MicIcon />
                </Button>
              </PromptInputAction>
            )}
          </div>
          <PromptInputAction tooltip={t('promptInput.send', 'Send')}>
            <Button
              aria-label={t('promptInput.send', 'Send')}
              disabled={!value.trim() || loading || disabled}
              onClick={handleSubmit}
              size="icon"
              type="button"
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
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

function InputErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="input-error">
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
function InputLoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl" data-state="loading" data-testid="input-loading">
      <div className="rounded-lg border p-4">
        <Skeleton className="mb-3 h-20 w-full" />
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}

// Empty state
function InputEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="input-empty"
    >
      <p className="text-muted-foreground">
        {t('input.story.noSuggestionsAvailable', 'No suggestions available')}
      </p>
    </div>
  );
}

// Demo with Faker data
function InputWithFakerData() {
  const suggestions = React.useMemo(() => createFakeSuggestions(4), []);
  const [value, setValue] = React.useState('');

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="sm"
            onClick={() => setValue(suggestion.text)}
          >
            {suggestion.text}
          </Button>
        ))}
      </div>
      <PromptInput value={value} onValueChange={setValue}>
        <PromptInputTextarea
          placeholder={i18n.t(
            'promptInput.story.typeOrClickSuggestion',
            'Type or click a suggestion...'
          )}
        />
        <PromptInputActions className="justify-end">
          <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
            <Button
              size="icon"
              disabled={!value.trim()}
              aria-label={i18n.t('promptInput.story.send', 'Send')}
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

// Demo component with async data fetching via MSW
function InputWithAsyncData() {
  const [suggestions, setSuggestions] = React.useState<ReturnType<typeof createFakeSuggestions>>(
    []
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [value, setValue] = React.useState('');

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
    return <InputLoadingSkeleton />;
  }

  if (error) {
    return <InputErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (suggestions.length === 0) {
    return <InputEmptyState />;
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-state="success" data-testid="input-success">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            variant="outline"
            size="sm"
            onClick={() => setValue(suggestion.text)}
          >
            {suggestion.text}
          </Button>
        ))}
      </div>
      <PromptInput value={value} onValueChange={setValue}>
        <PromptInputTextarea
          placeholder={i18n.t(
            'promptInput.story.typeOrClickSuggestion',
            'Type or click a suggestion...'
          )}
        />
        <PromptInputActions className="justify-end">
          <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
            <Button
              size="icon"
              disabled={!value.trim()}
              aria-label={i18n.t('promptInput.story.send', 'Send')}
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

function KeyboardInteractionDemo() {
  useTranslation();
  const [value, setValue] = React.useState('');
  const [submitCount, setSubmitCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Press Tab to navigate, Enter to submit (without Shift), Shift+Enter for newline
      </p>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-sm">Submit count: {submitCount}</span>
      </div>
      <div className="w-full max-w-2xl">
        <PromptInput
          value={value}
          onValueChange={setValue}
          onSubmit={() => {
            setSubmitCount((c) => c + 1);
            setValue('');
          }}
        >
          <PromptInputTextarea
            placeholder={i18n.t(
              'promptInput.story.typeAndPressEnter',
              'Type and press Enter to submit...'
            )}
          />
          <PromptInputActions className="justify-end">
            <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
              <Button
                aria-label={i18n.t('promptInput.story.send', 'Send')}
                disabled={!value.trim()}
                onClick={() => {
                  setSubmitCount((c) => c + 1);
                  setValue('');
                }}
                size="icon"
              >
                <SendIcon />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}

function DisabledKeyboardBehaviorDemo() {
  useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Disabled inputs should not receive focus or respond to keyboard
      </p>
      <div className="flex flex-col gap-4">
        <div className="w-full max-w-2xl">
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('input.story.disabled', 'Disabled')}
          </p>
          <PromptInput isLoading value="Disabled state">
            <PromptInputTextarea
              placeholder={i18n.t('promptInput.story.disabled', 'Disabled...')}
              disabled
            />
            <PromptInputActions className="justify-end">
              <Button aria-label={i18n.t('promptInput.story.send', 'Send')} size="icon" disabled>
                <SendIcon />
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
        <div className="w-full max-w-2xl">
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('input.story.enabled', 'Enabled')}
          </p>
          <PromptInput>
            <PromptInputTextarea placeholder={i18n.t('promptInput.story.enabled', 'Enabled...')} />
            <PromptInputActions className="justify-end">
              <Button aria-label={i18n.t('promptInput.story.send', 'Send')} size="icon">
                <SendIcon />
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function I18nInputDemo() {
  const { t } = useTranslation();
  const [value, setValue] = React.useState('');

  return (
    <div data-sb-prompt-input className="w-full max-w-2xl">
      <PromptInput value={value} onValueChange={setValue}>
        <PromptInputTextarea placeholder={t('promptInput.placeholder', 'Type a message...')} />
        <PromptInputActions className="justify-between">
          <div className="flex gap-1">
            <PromptInputAction tooltip={t('promptInput.attach', 'Attach file')}>
              <Button
                aria-label={t('promptInput.attach', 'Attach file')}
                size="icon"
                variant="ghost"
              >
                <PaperclipIcon />
              </Button>
            </PromptInputAction>
            <PromptInputAction tooltip={t('promptInput.voice', 'Voice input')}>
              <Button
                aria-label={t('promptInput.voice', 'Voice input')}
                size="icon"
                variant="ghost"
              >
                <MicIcon />
              </Button>
            </PromptInputAction>
          </div>
          <PromptInputAction tooltip={t('promptInput.send', 'Send')}>
            <Button
              aria-label={t('promptInput.send', 'Send')}
              disabled={!value.trim()}
              size="icon"
              type="button"
            >
              <SendIcon />
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Prompt/Input',
  component: PromptInputDemo,
  tags: ['autodocs'],
  args: {
    placeholder: 'Type a message...',
    isLoading: false,
    maxHeight: 240,
    disabled: false,
    showAttachButton: true,
    showVoiceButton: true,
    initialValue: '',
    onSubmit: fn(),
    onValueChange: fn(),
    onAttachClick: fn(),
    onVoiceClick: fn(),
  },
  parameters: {
    msw: {
      handlers: promptInputHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    placeholder: {
      control: 'text',
      description: i18n.t(
        'input.argType.placeholderTextForTheTextarea',
        'Placeholder text for the textarea'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Type a message...' },
      },
    },
    initialValue: {
      control: 'text',
      description: i18n.t(
        'input.argType.initialValueForTheTextarea',
        'Initial value for the textarea'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: '' },
      },
    },
    // Appearance
    maxHeight: {
      control: { type: 'number', min: 100, max: 500, step: 20 },
      description: i18n.t(
        'input.argType.maximumHeightForTheAutoresizingTextarea',
        'Maximum height for the auto-resizing textarea'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number | string' },
        defaultValue: { summary: '240' },
      },
    },
    showAttachButton: {
      control: 'boolean',
      description: i18n.t('input.argType.showTheAttachFileButton', 'Show the attach file button'),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    showVoiceButton: {
      control: 'boolean',
      description: i18n.t('input.argType.showTheVoiceInputButton', 'Show the voice input button'),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // State
    isLoading: {
      control: 'boolean',
      description: i18n.t(
        'input.argType.loadingStateDisablesInputAndShowsLoadingBehavior',
        'Loading state - disables input and shows loading behavior'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t('input.argType.disableTheEntireInput', 'Disable the entire input'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Events
    onSubmit: {
      action: 'onSubmit',
      description: i18n.t(
        'input.argType.calledWhenTheUserSubmitsTheMessageEnterKeyOrClickSend',
        'Called when the user submits the message (Enter key or click send)'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'input.argType.calledWhenTheTextareaValueChanges',
        'Called when the textarea value changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string) => void' },
      },
    },
    onAttachClick: {
      action: 'onAttachClick',
      description: i18n.t(
        'input.argType.calledWhenTheAttachButtonIsClicked',
        'Called when the attach button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onVoiceClick: {
      action: 'onVoiceClick',
      description: i18n.t(
        'input.argType.calledWhenTheVoiceButtonIsClicked',
        'Called when the voice button is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
  },
} satisfies Meta<typeof PromptInputDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = canvasElement.querySelector<HTMLElement>('[data-sb-prompt-input]');
    if (!root) throw new Error('Prompt input root not found.');

    const canvas = within(root);

    // Verify data attributes
    expect(canvas.getByTestId('prompt-input')).toBeInTheDocument();
    expect(canvas.getByTestId('prompt-input-actions')).toBeInTheDocument();

    // Verify textarea exists and is focusable
    const textarea = root.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea).not.toBeDisabled();

    // Type text and verify
    if (textarea) {
      await userEvent.type(textarea, 'Hello from Storybook');
      expect(textarea.value).toBe('Hello from Storybook');

      // Send button should be enabled
      const sendButton = canvas.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    }
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function VariantsDemo() {
  useTranslation();
  const [value1, setValue1] = React.useState('');
  const [value2, setValue2] = React.useState('');
  const [value3, setValue3] = React.useState('Pre-filled content');

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('input.story.basicInput', 'Basic Input')}
        </p>
        <PromptInput onValueChange={setValue1} value={value1}>
          <PromptInputTextarea
            placeholder={i18n.t('promptInput.story.typeAMessage', 'Type a message...')}
          />
          <PromptInputActions className="justify-end">
            <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
              <Button
                size="icon"
                disabled={!value1.trim()}
                aria-label={i18n.t('promptInput.story.send', 'Send')}
              >
                <SendIcon />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('input.story.withMultipleActions', 'With Multiple Actions')}
        </p>
        <PromptInput onValueChange={setValue2} value={value2}>
          <PromptInputTextarea
            placeholder={i18n.t('promptInput.story.typeAMessage', 'Type a message...')}
          />
          <PromptInputActions className="justify-between">
            <div className="flex gap-1">
              <PromptInputAction tooltip={i18n.t('promptInput.story.attach', 'Attach')}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={i18n.t('promptInput.story.attach', 'Attach')}
                >
                  <PaperclipIcon />
                </Button>
              </PromptInputAction>
              <PromptInputAction tooltip={i18n.t('promptInput.story.voice', 'Voice')}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={i18n.t('promptInput.story.voice', 'Voice')}
                >
                  <MicIcon />
                </Button>
              </PromptInputAction>
            </div>
            <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
              <Button
                size="icon"
                disabled={!value2.trim()}
                aria-label={i18n.t('promptInput.story.send', 'Send')}
              >
                <SendIcon />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('promptInput.story.preFilledContent', 'Pre-filled Content')}
        </p>
        <PromptInput onValueChange={setValue3} value={value3}>
          <PromptInputTextarea
            placeholder={i18n.t('promptInput.story.typeAMessage', 'Type a message...')}
          />
          <PromptInputActions className="justify-end">
            <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
              <Button
                size="icon"
                disabled={!value3.trim()}
                aria-label={i18n.t('promptInput.story.send', 'Send')}
              >
                <SendIcon />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('input.story.loadingState', 'Loading State')}
        </p>
        <PromptInput isLoading value="Sending...">
          <PromptInputTextarea
            placeholder={i18n.t('promptInput.story.typeAMessage', 'Type a message...')}
            disabled
          />
          <PromptInputActions className="justify-end">
            <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
              <Button size="icon" disabled aria-label={i18n.t('promptInput.story.send', 'Send')}>
                <SendIcon />
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('promptInput.story.smallContainer300px', 'Small Container (300px)')}
        </p>
        <div className="w-[300px]">
          <PromptInput>
            <PromptInputTextarea placeholder={i18n.t('promptInput.story.type', 'Type...')} />
            <PromptInputActions className="justify-end">
              <Button size="icon-sm" aria-label={i18n.t('promptInput.story.send', 'Send')}>
                <SendIcon className="size-4" />
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('promptInput.story.mediumContainer500px', 'Medium Container (500px)')}
        </p>
        <div className="w-[500px]">
          <PromptInput>
            <PromptInputTextarea
              placeholder={i18n.t('promptInput.story.typeAMessage', 'Type a message...')}
            />
            <PromptInputActions className="justify-end">
              <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
                <Button size="icon" aria-label={i18n.t('promptInput.story.send', 'Send')}>
                  <SendIcon />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('input.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full max-w-2xl">
          <PromptInput>
            <PromptInputTextarea
              placeholder={i18n.t(
                'promptInput.story.typeDetailedMessage',
                'Type a detailed message...'
              )}
            />
            <PromptInputActions className="justify-between">
              <div className="flex gap-1">
                <PromptInputAction tooltip={i18n.t('promptInput.story.attach', 'Attach')}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={i18n.t('promptInput.story.attach', 'Attach')}
                  >
                    <PaperclipIcon />
                  </Button>
                </PromptInputAction>
              </div>
              <PromptInputAction tooltip={i18n.t('promptInput.story.send', 'Send')}>
                <Button size="icon" aria-label={i18n.t('promptInput.story.send', 'Send')}>
                  <SendIcon />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
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
  render: () => <I18nInputDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    expect(context.canvasElement.querySelector('[data-testid="prompt-input"]')).toBeInTheDocument();
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
  name: i18n.t('input.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
  render: () => <InputWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="prompt-input"]')).toBeInTheDocument();
    const suggestions = canvasElement.querySelectorAll('button');
    expect(suggestions.length).not.toBe(0);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: promptInputHandlers },
  },
  render: () => <InputWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="input-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="input-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify input rendered
    expect(canvasElement.querySelector('[data-testid="prompt-input"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: promptInputStatusHandlers.loading },
  },
  render: () => <InputWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="input-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <InputEmptyState />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="input-empty"]')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('input.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.badRequest },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.unauthorized },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.forbidden },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.unprocessableEntity },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.tooManyRequests },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.internalServerError },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.badGateway },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.serviceUnavailable },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.gatewayTimeout },
  },
  render: () => <InputWithAsyncData />,
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
  name: i18n.t('input.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.slowResponse },
  },
  render: () => <InputWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="input-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 8s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="input-success"]')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('input.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: promptInputStatusHandlers.networkError },
  },
  render: () => <InputWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="input-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: promptInputHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ KEYBOARD INTERACTION STORIES ============

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    // Find textarea
    const textarea = canvasElement.querySelector('textarea');
    expect(textarea).toBeInTheDocument();

    if (textarea) {
      // Tab to textarea
      await userEvent.tab();
      expect(textarea).toHaveFocus();

      // Type text
      await userEvent.type(textarea, 'Test message');
      expect(textarea.value).toBe('Test message');

      // Press Enter to submit
      await userEvent.keyboard('{Enter}');

      // Should have submitted and cleared
      await waitFor(() => {
        expect(canvasElement.textContent).toContain('Submit count: 1');
      });

      // Type again and test Shift+Enter for newline
      await userEvent.type(textarea, 'Line 1');
      await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
      await userEvent.type(textarea, 'Line 2');

      // Should contain newline
      expect(textarea.value).toContain('Line 1');
      expect(textarea.value).toContain('Line 2');
    }
  },
};

export const DisabledKeyboardBehavior: Story = {
  render: () => <DisabledKeyboardBehaviorDemo />,
  play: async ({ canvasElement }) => {
    const textareas = canvasElement.querySelectorAll('textarea');
    expect(textareas.length).toBe(2);

    // First textarea should be disabled
    expect(textareas[0]).toBeDisabled();

    // Second textarea should be enabled
    expect(textareas[1]).not.toBeDisabled();

    // Tab should skip disabled textarea
    await userEvent.tab();
    expect(textareas[1]).toHaveFocus();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('input.storyName.accessibility', 'Accessibility'),
  args: {
    showAttachButton: true,
    showVoiceButton: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all buttons have aria-labels
    const attachButton = canvas.getByRole('button', { name: /attach/i });
    const voiceButton = canvas.getByRole('button', { name: /voice/i });
    const sendButton = canvas.getByRole('button', { name: /send/i });

    expect(attachButton).toHaveAttribute('aria-label');
    expect(voiceButton).toHaveAttribute('aria-label');
    expect(sendButton).toHaveAttribute('aria-label');

    // Verify textarea has placeholder for accessibility
    const textarea = canvasElement.querySelector('textarea');
    expect(textarea).toHaveAttribute('placeholder');

    // Test keyboard navigation through interactive elements
    await userEvent.tab();
    expect(textarea).toHaveFocus();

    // Type text
    await userEvent.type(textarea!, 'Test message');
    expect(textarea!.value).toBe('Test message');

    // Tab through action buttons
    await userEvent.tab();
    expect(attachButton).toHaveFocus();

    await userEvent.tab();
    expect(voiceButton).toHaveFocus();

    await userEvent.tab();
    expect(sendButton).toHaveFocus();

    // Verify data-testid attributes
    expect(canvas.getByTestId('prompt-input')).toBeInTheDocument();
    expect(canvas.getByTestId('prompt-input-actions')).toBeInTheDocument();

    // Test Enter key submission
    textarea!.focus();
    await userEvent.clear(textarea!);
    await userEvent.type(textarea!, 'Submit with Enter');
    await userEvent.keyboard('{Enter}');

    // Verify form interaction
    await waitFor(() => {
      expect(textarea!.value).toBe('');
    });
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   validationError
//   slowSubmission
//   emptyAutocomplete
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: promptInputStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: promptInputStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: promptInputStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('input.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: promptInputStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
