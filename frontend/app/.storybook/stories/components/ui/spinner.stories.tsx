import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  CONTEXT_ARIA_LABELS,
  createFakeButtonSpinner,
  createFakeCardSpinner,
  createFakeFullPageSpinner,
  createFakeInlineSpinner,
  createFakeLargeSpinner,
  createFakeLoadingSpinner,
  createFakeMediumSpinner,
  createFakeProcessingSpinner,
  createFakeProgressSpinner,
  createFakeSavingSpinner,
  createFakeSmallSpinner,
  createFakeSpinner,
  createFakeSpinners,
  createFakeSpinnerWithContext,
  createFakeSyncingSpinner,
  createFakeTableSpinner,
  createFakeXLSpinner,
  createSpinnerColorMatrix,
  createSpinnerContextMatrix,
  createSpinnerShowcase,
  createSpinnerSizeMatrix,
  createSpinnerStateMatrix,
  createSpinnerTestData,
  type FakeButtonSpinner,
  type FakeCardSpinner,
  type FakeFullPageSpinner,
  type FakeInlineSpinner,
  type FakeProgressSpinner,
  type FakeSpinner,
  type FakeSpinnerWithContext,
  type FakeTableSpinner,
  LOADING_CONTEXTS,
  LOADING_MESSAGES,
  LOADING_STATES,
  type LoadingContext,
  type LoadingState,
  SPINNER_COLOR_CLASSES,
  SPINNER_COLORS,
  SPINNER_SIZE_PIXELS,
  SPINNER_SIZES,
  type SpinnerColor,
  type SpinnerSize,
} from '@/.storybook/stories/_factories/spinner.factory';
import {
  spinnerHandlers,
  spinnerStatusHandlers,
} from '@/.storybook/stories/_handlers/spinner.handlers';

import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4" data-testid="spinner-demo">
      <Spinner aria-label={t('spinner.loading')} className="size-4" />
      <Spinner aria-label={t('spinner.loading')} className="size-6" />
      <Spinner aria-label={t('spinner.loading')} className="size-8" />
      <Spinner aria-label={t('spinner.loading')} className="size-10" />
    </div>
  );
}

const meta = {
  title: 'Components/UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: spinnerHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('spinner.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('spinner.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('spinner.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('spinner.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('spinner.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('spinner.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('spinner.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'spinner.argType.cssClassesToControlSizeAndColorOfSpinner',
        'CSS classes to control size and color of spinner'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'spinner.argType.accessibleLabelForScreenReaders',
        'Accessible label for screen readers'
      ),
      table: {
        category: 'Accessibility',
        defaultValue: { summary: 'Loading...' },
        type: { summary: 'string' },
      },
    },
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => <Spinner aria-label={i18n.t('spinner.story.loading', 'Loading')} />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
    const spinner = canvasElement.querySelector('svg[role="status"]');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading');
  },
};

export const Sizes: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-4" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">size-4</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-6" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">size-6</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-8" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">size-8</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-10" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">size-10</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-12" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">size-12</span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function VariantsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      {/* Default */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">{t('spinner.variants.default')}</p>
        <Spinner className="size-8" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
      </div>
      {/* Primary Color */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">{t('spinner.variants.primaryColor')}</p>
        <Spinner
          className="text-primary size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      {/* Destructive Color */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">
          {t('spinner.variants.destructiveColor')}
        </p>
        <Spinner
          className="text-destructive size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      {/* Muted Color */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">{t('spinner.variants.mutedColor')}</p>
        <Spinner
          className="text-muted-foreground size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      {/* In Button */}
      <div className="space-y-2">
        <p className="text-muted-foreground mb-2 text-sm">{t('spinner.variants.inButton')}</p>
        <Button disabled>
          <Spinner className="size-4" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        </Button>
      </div>
    </div>
  );
}

export const Variants: Story = {
  tags: ['!test'],
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-8" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        <span className="text-muted-foreground text-xs">
          {i18n.t('spinner.story.default', 'Default')}
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner
          className="text-primary size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
        <span className="text-muted-foreground text-xs">
          {i18n.t('spinner.story.primary', 'Primary')}
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner
          className="text-destructive size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
        <span className="text-muted-foreground text-xs">
          {i18n.t('spinner.story.destructive', 'Destructive')}
        </span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner
          className="text-muted-foreground size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
        <span className="text-muted-foreground text-xs">
          {i18n.t('spinner.story.muted', 'Muted')}
        </span>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(4);
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Primary')).toBeInTheDocument();
    expect(canvas.getByText('Destructive')).toBeInTheDocument();
    expect(canvas.getByText('Muted')).toBeInTheDocument();
  },
};

export const InButton: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button disabled>
        <Spinner className="size-4" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        Loading...
      </Button>
      <Button variant="secondary" disabled>
        <Spinner className="size-4" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        Processing
      </Button>
      <Button variant="outline" disabled>
        <Spinner className="size-4" aria-label={i18n.t('spinner.story.loading', 'Loading')} />
        Saving
      </Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(3);
    const buttons = canvasElement.querySelectorAll('[data-slot="button"]');
    expect(buttons.length).toBe(3);
    expect(canvas.getByText('Loading...')).toBeInTheDocument();
    expect(canvas.getByText('Processing')).toBeInTheDocument();
    expect(canvas.getByText('Saving')).toBeInTheDocument();
  },
};

export const LoadingCard: Story = {
  render: () => (
    <div className="flex h-[200px] w-[300px] flex-col items-center justify-center gap-3 rounded-lg border">
      <Spinner
        className="size-8"
        aria-label={i18n.t('spinner.story.loadingContent', 'Loading content')}
      />
      <p className="text-muted-foreground text-sm">
        {i18n.t('spinner.story.loadingContent', 'Loading content...')}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
    expect(canvas.getByText('Loading content...')).toBeInTheDocument();
    const spinner = canvasElement.querySelector('svg[role="status"]');
    expect(spinner?.getAttribute('aria-label')).toBe('Loading content');
  },
};

export const FullPageLoading: Story = {
  render: () => (
    <div className="bg-background/50 flex h-[400px] w-full flex-col items-center justify-center gap-4 rounded-lg border">
      <Spinner
        className="size-12"
        aria-label={i18n.t('spinner.story.loadingPage', 'Loading page')}
      />
      <div className="text-center">
        <p className="font-medium">{i18n.t('spinner.story.loading', 'Loading')}</p>
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'spinner.story.pleaseWaitWhileWeFetchYourData',
            'Please wait while we fetch your data'
          )}
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
    expect(canvas.getByText('Loading')).toBeInTheDocument();
    expect(canvas.getByText('Please wait while we fetch your data')).toBeInTheDocument();
  },
};

export const InlineLoading: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="flex items-center gap-2">
        <Spinner className="size-4" aria-label={i18n.t('spinner.story.fetching', 'Fetching')} />
        <span>{i18n.t('spinner.story.fetchingUserData', 'Fetching user data...')}</span>
      </p>
      <p className="flex items-center gap-2">
        <Spinner
          className="text-primary size-4"
          aria-label={i18n.t('spinner.story.processing', 'Processing')}
        />
        <span>{i18n.t('spinner.story.processingYourRequest', 'Processing your request...')}</span>
      </p>
      <p className="flex items-center gap-2">
        <Spinner
          className="text-muted-foreground size-4"
          aria-label={i18n.t('spinner.story.syncing', 'Syncing')}
        />
        <span className="text-muted-foreground">
          {i18n.t('spinner.story.syncingInBackground', 'Syncing in background...')}
        </span>
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(3);
    expect(canvas.getByText('Fetching user data...')).toBeInTheDocument();
    expect(canvas.getByText('Processing your request...')).toBeInTheDocument();
    expect(canvas.getByText('Syncing in background...')).toBeInTheDocument();
  },
};

export const WithProgress: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Spinner
          className="size-16"
          aria-label={i18n.t('spinner.story.percentComplete', '75% complete')}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium">75%</span>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        {i18n.t('spinner.story.uploadingFile', 'Uploading file...')}
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
    expect(canvas.getByText('75%')).toBeInTheDocument();
    expect(canvas.getByText('Uploading file...')).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Sizes,
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
      <Spinner className="size-10" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();

    const spinners = canvasElement.querySelectorAll('svg[role="status"]');

    expect(spinners.length).toBe(4);

    const expectedSizes = ['size-4', 'size-6', 'size-8', 'size-10'];

    spinners.forEach((spinner, index) => {
      expect(spinner.getAttribute('aria-label')?.trim()).toBeInTheDocument();

      const className = spinner.getAttribute('class') ?? '';

      expect(className).toContain('animate-spin');
      expect(className).toContain(expectedSizes[index] ?? '');
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
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nSizesDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const firstSpinner = context.canvasElement.querySelector('svg[role="status"]');
    expect(firstSpinner?.getAttribute('aria-label')).toBe('読み込み中');

    await Default.play?.(context);
  },
};

export const CustomClass: Story = {
  render: () => (
    <Spinner
      className="text-primary size-8"
      aria-label={i18n.t('spinner.story.loading', 'Loading')}
    />
  ),
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

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('spinner.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerHandlers },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: spinnerStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(0);
    expect(canvasElement.querySelector('svg[role="status"]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('spinner.storyName.accessibility', 'Accessibility'),
  render: () => <I18nSizesDemo />,
  play: async ({ canvasElement }) => {
    // Get all spinners
    const spinners = canvasElement.querySelectorAll('svg[role="status"]');
    expect(spinners.length).not.toBe(0);

    spinners.forEach((spinner) => {
      if (!(spinner instanceof SVGElement)) return;

      // Verify role="status" for screen readers
      expect(spinner.getAttribute('role')).toBe('status');

      // Verify aria-label is present
      expect(spinner.getAttribute('aria-label')).toBeInTheDocument();

      // Verify spinner has animation class
      const className = spinner.getAttribute('class') ?? '';
      expect(className).toContain('animate-spin');
    });

    // Verify data-slot attribute is present
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  name: i18n.t('spinner.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeSpinners = createFakeSpinners(5);

    return (
      <div className="flex flex-wrap items-center gap-4" data-testid="spinner-faker">
        {fakeSpinners.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-2">
            <Spinner className={s.className} aria-label={s.ariaLabel} />
            <span className="text-muted-foreground text-xs">{s.size}</span>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="spinner-faker"]')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(5);
  },
};

// ============ FACTORY: createFakeSpinner ============

function FakeSpinnerDemo() {
  const spinner: FakeSpinner = createFakeSpinner({ color: 'primary', size: 'size-8' });

  return (
    <div className="flex flex-col items-center gap-2" data-testid="fake-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-muted-foreground text-xs">{spinner.size}</span>
    </div>
  );
}

export const FakeSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.fakeSpinnerStory', 'Factory: createFakeSpinner'),
  render: () => <FakeSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fake-spinner-demo')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSmallSpinner ============

function SmallSpinnerDemo() {
  const spinner = createFakeSmallSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="small-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-muted-foreground text-xs">Small ({spinner.size})</span>
    </div>
  );
}

export const SmallSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.smallSpinnerStory', 'Factory: createFakeSmallSpinner'),
  render: () => <SmallSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('small-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Small/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeMediumSpinner ============

function MediumSpinnerDemo() {
  const spinner = createFakeMediumSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="medium-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-muted-foreground text-xs">Medium ({spinner.size})</span>
    </div>
  );
}

export const MediumSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.mediumSpinnerStory', 'Factory: createFakeMediumSpinner'),
  render: () => <MediumSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('medium-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Medium/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLargeSpinner ============

function LargeSpinnerDemo() {
  const spinner = createFakeLargeSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="large-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-muted-foreground text-xs">Large ({spinner.size})</span>
    </div>
  );
}

export const LargeSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.largeSpinnerStory', 'Factory: createFakeLargeSpinner'),
  render: () => <LargeSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('large-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Large/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeXLSpinner ============

function XLSpinnerDemo() {
  const spinner = createFakeXLSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="xl-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-muted-foreground text-xs">XL ({spinner.size})</span>
    </div>
  );
}

export const XLSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.xLSpinnerStory', 'Factory: createFakeXLSpinner'),
  render: () => <XLSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('xl-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText(/XL/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSpinnerWithContext ============

function SpinnerWithContextDemo() {
  const spinner: FakeSpinnerWithContext = createFakeSpinnerWithContext('form', {
    state: 'loading',
  });

  return (
    <div className="flex flex-col gap-2" data-testid="spinner-context-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('spinner.loading')} &mdash; Context: {spinner.context}, State: {spinner.state}
      </p>
      <Spinner className={spinner.className} aria-label={spinner.ariaLabel} />
      {spinner.message && <span className="text-xs">{spinner.message}</span>}
    </div>
  );
}

export const SpinnerWithContextStory: Story = {
  name: i18n.t(
    'spinner.storyName.spinnerWithContextStory',
    'Factory: createFakeSpinnerWithContext'
  ),
  render: () => <SpinnerWithContextDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('spinner-context-demo')).toBeInTheDocument();
    expect(canvas.getByText(/Context: form/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeButtonSpinner ============

function ButtonSpinnerDemo() {
  const spinner: FakeButtonSpinner = createFakeButtonSpinner({
    buttonVariant: 'default',
    buttonText: 'Submitting...',
  });

  return (
    <div className="flex flex-col gap-3" data-testid="button-spinner-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.variants.inButton')}</p>
      <Button variant={spinner.buttonVariant} disabled={spinner.buttonDisabled}>
        <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
        {spinner.buttonText}
      </Button>
    </div>
  );
}

export const ButtonSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.buttonSpinnerStory', 'Factory: createFakeButtonSpinner'),
  render: () => <ButtonSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('button-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('Submitting...')).toBeInTheDocument();
    const button = canvasElement.querySelector('[data-slot="button"]');
    expect(button).toBeInTheDocument();
    expect(button?.hasAttribute('disabled')).toBe(true);
  },
};

// ============ FACTORY: createFakeProgressSpinner ============

function ProgressSpinnerDemo() {
  const spinner: FakeProgressSpinner = createFakeProgressSpinner({
    current: 65,
    max: 100,
    showPercentage: true,
  });

  const pct = Math.round((spinner.current / spinner.max) * 100);

  return (
    <div className="flex flex-col items-center gap-3" data-testid="progress-spinner-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.loading')}</p>
      <div className="relative">
        <Spinner className={spinner.className} aria-label={`${pct}% complete`} />
        {spinner.showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium">{pct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ProgressSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.progressSpinnerStory', 'Factory: createFakeProgressSpinner'),
  render: () => <ProgressSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('progress-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('65%')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeFullPageSpinner ============

function FullPageSpinnerDemo() {
  const spinner: FakeFullPageSpinner = createFakeFullPageSpinner({
    title: 'Loading',
    description: 'Please wait while we fetch your data',
    backdrop: true,
  });

  return (
    <div
      className={`flex h-[300px] w-full flex-col items-center justify-center gap-4 rounded-lg border ${spinner.backdrop ? 'bg-background/50' : ''}`}
      data-testid="fullpage-spinner-demo"
    >
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <div className="text-center">
        <p className="font-medium">{spinner.title}</p>
        {spinner.description && (
          <p className="text-muted-foreground text-sm">{spinner.description}</p>
        )}
      </div>
    </div>
  );
}

export const FullPageSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.fullPageSpinnerStory', 'Factory: createFakeFullPageSpinner'),
  render: () => <FullPageSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('fullpage-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('Loading')).toBeInTheDocument();
    expect(canvas.getByText('Please wait while we fetch your data')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeInlineSpinner ============

function InlineSpinnerDemo() {
  const spinner: FakeInlineSpinner = createFakeInlineSpinner({
    message: 'Loading items...',
    showMessage: true,
  });

  return (
    <div className="flex items-center gap-2" data-testid="inline-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      {spinner.showMessage && <span className="text-sm">{spinner.message}</span>}
    </div>
  );
}

export const InlineSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.inlineSpinnerStory', 'Factory: createFakeInlineSpinner'),
  render: () => <InlineSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('inline-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('Loading items...')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCardSpinner ============

function CardSpinnerDemo() {
  const spinner: FakeCardSpinner = createFakeCardSpinner({
    title: 'Loading',
    subtitle: 'Fetching content...',
    cardWidth: '350px',
    cardHeight: '250px',
  });

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border"
      data-testid="card-spinner-demo"
      style={{ width: spinner.cardWidth, height: spinner.cardHeight }}
    >
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      {spinner.title && <p className="font-medium">{spinner.title}</p>}
      {spinner.subtitle && <p className="text-muted-foreground text-sm">{spinner.subtitle}</p>}
    </div>
  );
}

export const CardSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.cardSpinnerStory', 'Factory: createFakeCardSpinner'),
  render: () => <CardSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('Loading')).toBeInTheDocument();
    expect(canvas.getByText('Fetching content...')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTableSpinner ============

function TableSpinnerDemo() {
  const spinner: FakeTableSpinner = createFakeTableSpinner({
    columnCount: 4,
    rowCount: 5,
    showHeaders: true,
  });

  return (
    <div className="space-y-3" data-testid="table-spinner-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t('spinner.loading')} &mdash; {spinner.columnCount} columns, {spinner.rowCount} rows
      </p>
      <div className="flex h-[200px] w-full items-center justify-center rounded-lg border">
        <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      </div>
    </div>
  );
}

export const TableSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.tableSpinnerStory', 'Factory: createFakeTableSpinner'),
  render: () => <TableSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('table-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText(/4 columns, 5 rows/)).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLoadingSpinner ============

function LoadingSpinnerDemo() {
  const spinner: FakeSpinnerWithContext = createFakeLoadingSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="loading-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-sm">{spinner.message ?? i18n.t('spinner.loading')}</span>
      <span className="text-muted-foreground text-xs">({spinner.state})</span>
    </div>
  );
}

export const LoadingSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.loadingSpinnerStory', 'Factory: createFakeLoadingSpinner'),
  render: () => <LoadingSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('loading-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('(loading)')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeProcessingSpinner ============

function ProcessingSpinnerDemo() {
  const spinner: FakeSpinnerWithContext = createFakeProcessingSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="processing-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-sm">{spinner.message ?? 'Processing...'}</span>
      <span className="text-muted-foreground text-xs">({spinner.state})</span>
    </div>
  );
}

export const ProcessingSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.processingSpinnerStory', 'Factory: createFakeProcessingSpinner'),
  render: () => <ProcessingSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('processing-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('(processing)')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSavingSpinner ============

function SavingSpinnerDemo() {
  const spinner: FakeSpinnerWithContext = createFakeSavingSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="saving-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-sm">{spinner.message ?? 'Saving...'}</span>
      <span className="text-muted-foreground text-xs">({spinner.state})</span>
    </div>
  );
}

export const SavingSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.savingSpinnerStory', 'Factory: createFakeSavingSpinner'),
  render: () => <SavingSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('saving-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('(saving)')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSyncingSpinner ============

function SyncingSpinnerDemo() {
  const spinner: FakeSpinnerWithContext = createFakeSyncingSpinner();

  return (
    <div className="flex items-center gap-2" data-testid="syncing-spinner-demo">
      <Spinner className={spinner.className} aria-label={i18n.t('spinner.loading')} />
      <span className="text-sm">{spinner.message ?? 'Syncing...'}</span>
      <span className="text-muted-foreground text-xs">({spinner.state})</span>
    </div>
  );
}

export const SyncingSpinnerStory: Story = {
  name: i18n.t('spinner.storyName.syncingSpinnerStory', 'Factory: createFakeSyncingSpinner'),
  render: () => <SyncingSpinnerDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('syncing-spinner-demo')).toBeInTheDocument();
    expect(canvas.getByText('(syncing)')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="spinner"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSpinnerSizeMatrix ============

function SizeMatrixDemo() {
  const matrix = createSpinnerSizeMatrix();

  return (
    <div className="flex flex-wrap items-end gap-4" data-testid="size-matrix-demo">
      {matrix.map((entry) => (
        <div key={entry.size} className="flex flex-col items-center gap-2">
          <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
          <span className="text-muted-foreground text-xs">
            {entry.size} ({entry.pixels}px)
          </span>
        </div>
      ))}
    </div>
  );
}

export const SizeMatrixStory: Story = {
  name: i18n.t('spinner.storyName.sizeMatrixStory', 'Factory: createSpinnerSizeMatrix'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('size-matrix-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(SPINNER_SIZES.length);
  },
};

// ============ FACTORY: createSpinnerColorMatrix ============

function ColorMatrixDemo() {
  const matrix = createSpinnerColorMatrix();

  return (
    <div className="flex flex-wrap items-center gap-4" data-testid="color-matrix-demo">
      {matrix.map((entry) => (
        <div key={entry.color} className="flex flex-col items-center gap-2">
          <Spinner className={`size-8 ${entry.className}`} aria-label={i18n.t('spinner.loading')} />
          <span className="text-muted-foreground text-xs">{entry.color}</span>
        </div>
      ))}
    </div>
  );
}

export const ColorMatrixStory: Story = {
  name: i18n.t('spinner.storyName.colorMatrixStory', 'Factory: createSpinnerColorMatrix'),
  render: () => <ColorMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('color-matrix-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(SPINNER_COLORS.length);
    expect(canvas.getByText('primary')).toBeInTheDocument();
    expect(canvas.getByText('destructive')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSpinnerContextMatrix ============

function ContextMatrixDemo() {
  const matrix = createSpinnerContextMatrix();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="context-matrix-demo">
      {matrix.map((entry) => (
        <div key={entry.context} className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
          <span className="text-muted-foreground text-xs font-medium">{entry.context}</span>
          {entry.spinner.message && (
            <span className="text-muted-foreground text-xs">{entry.spinner.message}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export const ContextMatrixStory: Story = {
  name: i18n.t('spinner.storyName.contextMatrixStory', 'Factory: createSpinnerContextMatrix'),
  render: () => <ContextMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('context-matrix-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(LOADING_CONTEXTS.length);
    expect(canvas.getByText('button')).toBeInTheDocument();
    expect(canvas.getByText('fullpage')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSpinnerStateMatrix ============

function StateMatrixDemo() {
  const matrix = createSpinnerStateMatrix();

  return (
    <div className="flex flex-wrap gap-4" data-testid="state-matrix-demo">
      {matrix.map((entry) => (
        <div key={entry.state} className="flex flex-col items-center gap-2 rounded-lg border p-4">
          <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
          <span className="text-xs font-medium">{entry.state}</span>
          {entry.spinner.message && (
            <span className="text-muted-foreground text-xs">{entry.spinner.message}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export const StateMatrixStory: Story = {
  name: i18n.t('spinner.storyName.stateMatrixStory', 'Factory: createSpinnerStateMatrix'),
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('state-matrix-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(LOADING_STATES.length);
    expect(canvas.getByText('loading')).toBeInTheDocument();
    expect(canvas.getByText('processing')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSpinnerTestData ============

function TestDataDemo() {
  const data = createSpinnerTestData();

  return (
    <div className="space-y-4" data-testid="test-data-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.loading')}</p>
      <div className="flex flex-wrap gap-4">
        {(
          [
            { label: 'basic', spinner: data.basic },
            { label: 'small', spinner: data.small },
            { label: 'medium', spinner: data.medium },
            { label: 'large', spinner: data.large },
            { label: 'xl', spinner: data.xl },
            { label: 'primary', spinner: data.primary },
            { label: 'muted', spinner: data.muted },
            { label: 'destructive', spinner: data.destructive },
          ] as { label: string; spinner: FakeSpinner }[]
        ).map((entry) => (
          <div key={entry.label} className="flex flex-col items-center gap-1">
            <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
            <span className="text-muted-foreground text-xs">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const TestDataStory: Story = {
  name: i18n.t('spinner.storyName.testDataStory', 'Factory: createSpinnerTestData'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('test-data-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(8);
    expect(canvas.getByText('basic')).toBeInTheDocument();
    expect(canvas.getByText('primary')).toBeInTheDocument();
  },
};

// ============ FACTORY: createSpinnerShowcase ============

function ShowcaseDemo() {
  const showcase = createSpinnerShowcase();

  return (
    <div className="space-y-8" data-testid="showcase-demo">
      <div>
        <h3 className="mb-3 text-sm font-medium">
          {i18n.t('spinner.variants.default')} &mdash; Size Matrix
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          {showcase.sizeMatrix.map((entry) => (
            <div key={entry.size} className="flex flex-col items-center gap-1">
              <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
              <span className="text-muted-foreground text-xs">{entry.size}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">
          {i18n.t('spinner.story.colorMatrix', 'Color Matrix')}
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          {showcase.colorMatrix.map((entry) => (
            <div key={entry.color} className="flex flex-col items-center gap-1">
              <Spinner
                className={`size-8 ${entry.className}`}
                aria-label={i18n.t('spinner.loading')}
              />
              <span className="text-muted-foreground text-xs">{entry.color}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-medium">
          {i18n.t('spinner.story.stateMatrix', 'State Matrix')}
        </h3>
        <div className="flex flex-wrap gap-3">
          {showcase.stateMatrix.map((entry) => (
            <div key={entry.state} className="flex items-center gap-2 rounded border p-2">
              <Spinner className={entry.spinner.className} aria-label={i18n.t('spinner.loading')} />
              <span className="text-xs">{entry.state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ShowcaseStory: Story = {
  name: i18n.t('spinner.storyName.showcaseStory', 'Factory: createSpinnerShowcase'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('showcase-demo')).toBeInTheDocument();
    expect(canvas.getByText('Color Matrix')).toBeInTheDocument();
    expect(canvas.getByText('State Matrix')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBeGreaterThan(10);
  },
};

// ============ CONSTANTS: SPINNER_SIZES + SPINNER_SIZE_PIXELS ============

function SpinnerSizesConstDemo() {
  return (
    <div className="space-y-3" data-testid="spinner-sizes-const-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.loading')}</p>
      <div className="flex flex-wrap items-end gap-4">
        {SPINNER_SIZES.map((size: SpinnerSize) => (
          <div key={size} className="flex flex-col items-center gap-1">
            <Spinner className={size} aria-label={i18n.t('spinner.loading')} />
            <span className="text-muted-foreground text-xs">
              {size} ({SPINNER_SIZE_PIXELS[size]}px)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SpinnerSizesConstStory: Story = {
  name: i18n.t(
    'spinner.storyName.spinnerSizesConstStory',
    'Constants: SPINNER_SIZES + SPINNER_SIZE_PIXELS'
  ),
  render: () => <SpinnerSizesConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('spinner-sizes-const-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(SPINNER_SIZES.length);
    expect(canvas.getByText(/size-4/)).toBeInTheDocument();
    expect(canvas.getByText(/16px/)).toBeInTheDocument();
  },
};

// ============ CONSTANTS: SPINNER_COLORS + SPINNER_COLOR_CLASSES ============

function SpinnerColorsConstDemo() {
  return (
    <div className="space-y-3" data-testid="spinner-colors-const-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.variants.primaryColor')}</p>
      <div className="flex flex-wrap items-center gap-4">
        {SPINNER_COLORS.map((color: SpinnerColor) => (
          <div key={color} className="flex flex-col items-center gap-1">
            <Spinner
              className={`size-8 ${SPINNER_COLOR_CLASSES[color]}`}
              aria-label={i18n.t('spinner.loading')}
            />
            <span className="text-muted-foreground text-xs">{color}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SpinnerColorsConstStory: Story = {
  name: i18n.t(
    'spinner.storyName.spinnerColorsConstStory',
    'Constants: SPINNER_COLORS + SPINNER_COLOR_CLASSES'
  ),
  render: () => <SpinnerColorsConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('spinner-colors-const-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(SPINNER_COLORS.length);
    expect(canvas.getByText('primary')).toBeInTheDocument();
    expect(canvas.getByText('destructive')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LOADING_CONTEXTS + CONTEXT_ARIA_LABELS ============

function LoadingContextsConstDemo() {
  return (
    <div className="space-y-3" data-testid="loading-contexts-const-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.loading')}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {LOADING_CONTEXTS.map((ctx: LoadingContext) => (
          <div key={ctx} className="flex flex-col items-center gap-2 rounded-lg border p-3">
            <Spinner className="size-6" aria-label={CONTEXT_ARIA_LABELS[ctx]} />
            <span className="text-xs font-medium">{ctx}</span>
            <span className="text-muted-foreground text-center text-xs">
              {CONTEXT_ARIA_LABELS[ctx]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const LoadingContextsConstStory: Story = {
  name: i18n.t(
    'spinner.storyName.loadingContextsConstStory',
    'Constants: LOADING_CONTEXTS + CONTEXT_ARIA_LABELS'
  ),
  render: () => <LoadingContextsConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('loading-contexts-const-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(LOADING_CONTEXTS.length);
    expect(canvas.getByText('button')).toBeInTheDocument();
    expect(canvas.getByText('Button loading')).toBeInTheDocument();
    expect(canvas.getByText('fullpage')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: LOADING_STATES + LOADING_MESSAGES ============

function LoadingStatesConstDemo() {
  return (
    <div className="space-y-3" data-testid="loading-states-const-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('spinner.loading')}</p>
      <div className="flex flex-wrap gap-4">
        {LOADING_STATES.map((state: LoadingState) => (
          <div key={state} className="flex flex-col gap-1 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Spinner className="size-4" aria-label={i18n.t('spinner.loading')} />
              <span className="text-xs font-medium">{state}</span>
            </div>
            <span className="text-muted-foreground text-xs">{LOADING_MESSAGES[state][0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const LoadingStatesConstStory: Story = {
  name: i18n.t(
    'spinner.storyName.loadingStatesConstStory',
    'Constants: LOADING_STATES + LOADING_MESSAGES'
  ),
  render: () => <LoadingStatesConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('loading-states-const-demo')).toBeInTheDocument();
    const spinners = canvasElement.querySelectorAll('[data-slot="spinner"]');
    expect(spinners.length).toBe(LOADING_STATES.length);
    expect(canvas.getByText('loading')).toBeInTheDocument();
    expect(canvas.getByText('Loading...')).toBeInTheDocument();
    expect(canvas.getByText('saving')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: spinnerStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: spinnerStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: spinnerStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: spinnerStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: spinnerStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: spinnerStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: spinnerStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: spinnerStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: spinnerStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
