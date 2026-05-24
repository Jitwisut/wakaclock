import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { useTranslation } from 'react-i18next';

import type {
  FakeFormattingToggleGroup,
  FakeMediaToggle,
  FakeToggle,
  FakeToggleGroupItem,
  FakeToggleWithLabel,
  FakeViewTogglePair,
  ToggleIconType,
  ToggleSize,
  ToggleState,
  ToggleVariant,
} from '@/.storybook/stories/_factories/toggle.factory';
import {
  createFakeAlignmentToggleGroup,
  createFakeBookmarkToggle,
  createFakeDisabledToggle,
  createFakeFavoriteToggle,
  createFakeFormattingToggle,
  createFakeFormattingToggleGroup,
  createFakeMediaToggle,
  createFakeMicToggle,
  createFakeMuteToggle,
  createFakeNotificationToggle,
  createFakePlayPauseToggle,
  createFakePressedToggle,
  createFakeToggle,
  createFakeToggles,
  createFakeToggleWithLabel,
  createFakeUnpressedToggle,
  createFakeVideoToggle,
  createFakeViewTogglePair,
  createToggleIconTypeMatrix,
  createToggleShowcase,
  createToggleSizeMatrix,
  createToggleStateMatrix,
  createToggleTestData,
  createToggleVariantMatrix,
  TOGGLE_ARIA_LABELS,
  TOGGLE_ICON_TYPES,
  TOGGLE_ICONS,
  TOGGLE_SIZES,
  TOGGLE_STATES,
  TOGGLE_VARIANTS,
} from '@/.storybook/stories/_factories/toggle.factory';
import {
  toggleHandlers,
  toggleStatusHandlers,
} from '@/.storybook/stories/_handlers/toggle.handlers';

import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BellIcon,
  BellOffIcon,
  BoldIcon,
  BookmarkIcon,
  GridIcon,
  HeartIcon,
  ItalicIcon,
  ListIcon,
  MicIcon,
  MicOffIcon,
  PauseIcon,
  PlayIcon,
  StarIcon,
  StrikethroughIcon,
  UnderlineIcon,
  VideoIcon,
  VideoOffIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';

import { Toggle } from '@/components/ui/toggle';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type ControlledToggleDemoProps = {
  ariaLabel: string;
};

function ControlledToggleDemo({ ariaLabel }: ControlledToggleDemoProps) {
  useTranslation();
  const [pressed, setPressed] = React.useState(false);
  return (
    <Toggle
      aria-label={ariaLabel}
      data-toggle-kind="bold"
      onPressedChange={setPressed}
      pressed={pressed}
      variant="outline"
    >
      <BoldIcon />
    </Toggle>
  );
}

function I18nControlledToggleDemo() {
  const { t } = useTranslation();
  return <ControlledToggleDemo ariaLabel={t('toggle.ariaLabel.bold')} />;
}

const meta = {
  title: 'Components/UI/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  args: {
    variant: 'default',
    size: 'default',
    disabled: false,
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onPressedChange: fn(),
  },
  parameters: {
    msw: { handlers: toggleHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'toggle.argType.toggleContentIconOrText',
        'Toggle content (icon or text)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    variant: {
      control: 'select',
      options: ['default', 'outline'],
      description: i18n.t('toggle.argType.visualStyleVariant', 'Visual style variant'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'outline'" },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: i18n.t('toggle.argType.sizeOfTheToggleButton', 'Size of the toggle button'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'sm' | 'default' | 'lg'" },
      },
    },
    className: {
      control: 'text',
      description: i18n.t(
        'toggle.argType.additionalCssClassesForCustomStyling',
        'Additional CSS classes for custom styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    pressed: {
      control: 'boolean',
      description: i18n.t('toggle.argType.controlledPressedState', 'Controlled pressed state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultPressed: {
      control: 'boolean',
      description: i18n.t(
        'toggle.argType.defaultPressedStateForUncontrolledUsage',
        'Default pressed state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'toggle.argType.whetherTheToggleIsDisabled',
        'Whether the toggle is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Accessibility
    'aria-label': {
      control: 'text',
      description: i18n.t(
        'toggle.argType.accessibleLabelForScreenReaders',
        'Accessible label for screen readers'
      ),
      table: {
        category: 'Accessibility',
        type: { summary: 'string' },
      },
    },
    // Events
    onPressedChange: {
      action: 'onPressedChange',
      description: i18n.t(
        'toggle.argType.calledWhenPressedStateChanges',
        'Called when pressed state changes'
      ),
      table: { category: 'Events' },
    },
    onClick: {
      action: 'onClick',
      description: i18n.t('toggle.argType.calledOnClick', 'Called on click'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t(
        'toggle.argType.calledWhenToggleReceivesFocus',
        'Called when toggle receives focus'
      ),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t(
        'toggle.argType.calledWhenToggleLosesFocus',
        'Called when toggle loses focus'
      ),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Toggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Controlled: Story = {
  render: () => <ControlledToggleDemo ariaLabel="Toggle bold" />,
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-slot="toggle"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');

    if (toggle instanceof HTMLButtonElement) {
      await userEvent.click(toggle);
      await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'));
    }
  },
};

export const Disabled: Story = {
  render: () => (
    <Toggle
      aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
      disabled
      variant="outline"
    >
      <ItalicIcon />
    </Toggle>
  ),
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-slot="toggle"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle as HTMLButtonElement).toBeDisabled();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Toggle
        aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
        size="sm"
        variant="outline"
      >
        <UnderlineIcon />
      </Toggle>
      <Toggle
        aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
        size="default"
        variant="outline"
      >
        <UnderlineIcon />
      </Toggle>
      <Toggle
        aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
        size="lg"
        variant="outline"
      >
        <UnderlineIcon />
      </Toggle>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');
    expect(toggles.length).toBe(3);

    for (const toggle of toggles) {
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    }
  },
};

export const Playground: Story = {
  ...Controlled,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Variants: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Default Variant - Unpressed */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.defaultUnpressed', 'Default (Unpressed)')}
        </p>
        <Toggle aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')} variant="default">
          <BoldIcon />
        </Toggle>
      </div>

      {/* Default Variant - Pressed */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.defaultPressed', 'Default (Pressed)')}
        </p>
        <Toggle
          aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')}
          variant="default"
          defaultPressed
        >
          <BoldIcon />
        </Toggle>
      </div>

      {/* Disabled */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('toggle.story.disabled', 'Disabled')}</p>
        <Toggle aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')} disabled>
          <ItalicIcon />
        </Toggle>
      </div>

      {/* Outline Variant */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.outlineVariant', 'Outline Variant')}
        </p>
        <Toggle
          aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
          variant="outline"
        >
          <UnderlineIcon />
        </Toggle>
      </div>

      {/* With Text */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{i18n.t('toggle.story.withText', 'With Text')}</p>
        <Toggle
          aria-label={i18n.t('toggle.story.toggleBoldWithText', 'Toggle bold with text')}
          variant="outline"
        >
          <BoldIcon />
          <span>{i18n.t('toggle.story.bold', 'Bold')}</span>
        </Toggle>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="toggle"]')).toBeInTheDocument();

    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    if (!(toggle instanceof HTMLButtonElement)) {
      throw new Error('Bold toggle button was not found.');
    }

    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));

    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'));
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
  render: () => <I18nControlledToggleDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const toggle = context.canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle?.getAttribute('aria-label')).toBe('太字を切り替え');

    await Default.play?.(context);
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
  name: i18n.t('toggle.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ ACCESSIBILITY ============

const AccessibleToggle = () => {
  const [boldPressed, setBoldPressed] = React.useState(false);
  const [italicPressed, setItalicPressed] = React.useState(false);

  return (
    <div
      className="flex items-center gap-2"
      role="toolbar"
      aria-label={i18n.t('toggle.story.textFormatting', 'Text formatting')}
    >
      <Toggle
        aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')}
        pressed={boldPressed}
        onPressedChange={setBoldPressed}
        variant="outline"
        data-testid="bold-toggle"
      >
        <BoldIcon aria-hidden="true" />
      </Toggle>
      <Toggle
        aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
        pressed={italicPressed}
        onPressedChange={setItalicPressed}
        variant="outline"
        data-testid="italic-toggle"
      >
        <ItalicIcon aria-hidden="true" />
      </Toggle>
    </div>
  );
};

export const Accessibility: Story = {
  render: () => <AccessibleToggle />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Find toolbar
    const toolbar = canvas.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.getAttribute('aria-label')).toBe('Text formatting');

    // Find toggle buttons
    const boldToggle = canvas.getByRole('button', { name: 'Toggle bold' });
    const italicToggle = canvas.getByRole('button', { name: 'Toggle italic' });
    expect(boldToggle).toBeInTheDocument();
    expect(italicToggle).toBeInTheDocument();

    // Verify initial state
    expect(boldToggle.getAttribute('aria-pressed')).toBe('false');
    expect(italicToggle.getAttribute('aria-pressed')).toBe('false');

    // Test keyboard navigation
    await userEvent.tab();
    expect(doc.activeElement).toBe(boldToggle);

    // Test keyboard activation with Space
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(boldToggle.getAttribute('aria-pressed')).toBe('true');
    });

    // Tab to italic toggle
    await userEvent.tab();
    expect(doc.activeElement).toBe(italicToggle);

    // Test keyboard activation with Enter
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(italicToggle.getAttribute('aria-pressed')).toBe('true');
    });
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleHandlers },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('toggle.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('toggle.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('toggle.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('toggle.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const SlowResponse: Story = {
  name: i18n.t('toggle.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: toggleStatusHandlers.slowSubmission },
  },
  play: async ({ canvasElement }) => {
    const toggle = canvasElement.querySelector('[data-toggle-kind="bold"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
  },
};

export const EmptyData: Story = {
  name: i18n.t('toggle.storyName.emptyData', 'Empty/Default State'),
  render: () => (
    <div className="flex flex-col gap-4" data-testid="toggle-empty" data-state="empty">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.unpressedTogglesDefaultState', 'Unpressed Toggles (Default State)')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')} variant="outline">
            <BoldIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
            variant="outline"
          >
            <ItalicIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
            variant="outline"
          >
            <UnderlineIcon />
          </Toggle>
        </div>
        <p className="text-muted-foreground text-xs">
          {i18n.t(
            'toggle.story.allTogglesInDefaultUnpressedState',
            'All toggles in default unpressed state'
          )}
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="toggle-empty"]')).toBeInTheDocument();
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');
    for (const toggle of toggles) {
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    }
  },
};

export const WithFakerData: Story = {
  name: i18n.t('toggle.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const fakeToggles = createFakeToggles(5);

    return (
      <div className="flex flex-col gap-4" data-testid="toggle-faker">
        <div className="space-y-2">
          <p className="text-sm font-medium">Factory-Generated Toggles</p>
          <div className="flex items-center gap-2">
            {fakeToggles.map((t) => (
              <Toggle
                key={t.id}
                aria-label={t.ariaLabel}
                variant={t.variant}
                size={t.size}
                defaultPressed={t.pressed}
                disabled={t.disabled}
              >
                {t.ariaLabel}
              </Toggle>
            ))}
          </div>
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="toggle-faker"]')).toBeInTheDocument();
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');
    expect(toggles.length).toBe(5);
  },
};

// ============ TOGGLE STATE STORIES ============

export const AllPressedStates: Story = {
  name: i18n.t('toggle.storyName.allPressedStates', 'All Pressed States'),
  render: () => (
    <div className="flex flex-col gap-4" data-testid="toggle-all-pressed">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.allTogglesPressed', 'All Toggles Pressed')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle
            aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')}
            variant="outline"
            defaultPressed
          >
            <BoldIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
            variant="outline"
            defaultPressed
          >
            <ItalicIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
            variant="outline"
            defaultPressed
          >
            <UnderlineIcon />
          </Toggle>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');
    for (const toggle of toggles) {
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    }
  },
};

export const MixedPressedStates: Story = {
  name: i18n.t('toggle.storyName.mixedPressedStates', 'Mixed Pressed States'),
  render: () => (
    <div className="flex flex-col gap-4" data-testid="toggle-mixed-states">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.mixedToggleStates', 'Mixed Toggle States')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle
            aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')}
            variant="outline"
            defaultPressed
          >
            <BoldIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
            variant="outline"
          >
            <ItalicIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
            variant="outline"
            defaultPressed
          >
            <UnderlineIcon />
          </Toggle>
        </div>
        <p className="text-muted-foreground text-xs">Bold: on, Italic: off, Underline: on</p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');
    expect(toggles[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(toggles[1]?.getAttribute('aria-pressed')).toBe('false');
    expect(toggles[2]?.getAttribute('aria-pressed')).toBe('true');
  },
};

function ToggleGroupDemo() {
  useTranslation();
  const [activeToggles, setActiveToggles] = React.useState<Set<string>>(new Set(['bold']));

  const handleToggle = (id: string) => {
    setActiveToggles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="toggle-group">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.formattingToolbar', 'Formatting Toolbar')}
        </p>
        <div
          className="flex items-center gap-1"
          role="toolbar"
          aria-label={i18n.t('toggle.story.textFormatting', 'Text formatting')}
        >
          <Toggle
            aria-label={i18n.t('toggle.story.toggleBold', 'Toggle bold')}
            variant="outline"
            pressed={activeToggles.has('bold')}
            onPressedChange={() => handleToggle('bold')}
            data-testid="toolbar-bold"
          >
            <BoldIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleItalic', 'Toggle italic')}
            variant="outline"
            pressed={activeToggles.has('italic')}
            onPressedChange={() => handleToggle('italic')}
            data-testid="toolbar-italic"
          >
            <ItalicIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
            variant="outline"
            pressed={activeToggles.has('underline')}
            onPressedChange={() => handleToggle('underline')}
            data-testid="toolbar-underline"
          >
            <UnderlineIcon />
          </Toggle>
        </div>
        <p className="text-muted-foreground text-xs">
          Active: {activeToggles.size > 0 ? [...activeToggles].join(', ') : 'none'}
        </p>
      </div>
    </div>
  );
}

export const ToggleGroup: Story = {
  name: i18n.t('toggle.storyName.toggleGroup', 'Toggle Group (Toolbar)'),
  render: () => <ToggleGroupDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="toggle-group"]')).toBeInTheDocument();

    const boldToggle = canvasElement.querySelector(
      '[data-testid="toolbar-bold"]'
    ) as HTMLButtonElement;
    const italicToggle = canvasElement.querySelector(
      '[data-testid="toolbar-italic"]'
    ) as HTMLButtonElement;

    // Bold should be initially pressed
    expect(boldToggle.getAttribute('aria-pressed')).toBe('true');

    // Click italic to toggle on
    await userEvent.click(italicToggle);
    await waitFor(() => {
      expect(italicToggle.getAttribute('aria-pressed')).toBe('true');
    });

    // Click bold to toggle off
    await userEvent.click(boldToggle);
    await waitFor(() => {
      expect(boldToggle.getAttribute('aria-pressed')).toBe('false');
    });
  },
};

export const DisabledToggleStates: Story = {
  name: i18n.t('toggle.storyName.disabledToggleStates', 'Disabled Toggle States'),
  render: () => (
    <div className="flex flex-col gap-4" data-testid="toggle-disabled-states">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.disabledToggles', 'Disabled Toggles')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle
            aria-label={i18n.t('toggle.story.toggleBoldDisabled', 'Toggle bold (disabled)')}
            variant="outline"
            disabled
          >
            <BoldIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t(
              'toggle.story.toggleItalicDisabledPressed',
              'Toggle italic (disabled pressed)'
            )}
            variant="outline"
            disabled
            defaultPressed
          >
            <ItalicIcon />
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleUnderline', 'Toggle underline')}
            variant="outline"
          >
            <UnderlineIcon />
          </Toggle>
        </div>
        <p className="text-muted-foreground text-xs">
          Bold: disabled, Italic: disabled + pressed, Underline: enabled
        </p>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const toggles = canvasElement.querySelectorAll('[data-slot="toggle"]');

    // First toggle should be disabled
    expect(toggles[0] as HTMLButtonElement).toBeDisabled();
    expect(toggles[0]?.getAttribute('aria-pressed')).toBe('false');

    // Second toggle should be disabled and pressed
    expect(toggles[1] as HTMLButtonElement).toBeDisabled();
    expect(toggles[1]?.getAttribute('aria-pressed')).toBe('true');

    // Third toggle should be enabled
    expect(toggles[2] as HTMLButtonElement).toBeEnabled();
  },
};

function ToggleWithTextDemo() {
  useTranslation();
  const [darkMode, setDarkMode] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);

  return (
    <div className="flex flex-col gap-4" data-testid="toggle-with-text">
      <div className="space-y-4">
        <p className="text-sm font-medium">
          {i18n.t('toggle.story.featureToggles', 'Feature Toggles')}
        </p>
        <div className="flex flex-col gap-3">
          <Toggle
            aria-label={i18n.t('toggle.story.toggleDarkMode', 'Toggle dark mode')}
            variant="outline"
            pressed={darkMode}
            onPressedChange={setDarkMode}
            className="justify-start gap-2 px-3"
            data-testid="toggle-dark-mode"
          >
            <span className="text-sm">
              {darkMode
                ? i18n.t('toggle.story.darkModeOn', 'Dark Mode On')
                : i18n.t('toggle.story.darkModeOff', 'Dark Mode Off')}
            </span>
          </Toggle>
          <Toggle
            aria-label={i18n.t('toggle.story.toggleNotifications', 'Toggle notifications')}
            variant="outline"
            pressed={notifications}
            onPressedChange={setNotifications}
            className="justify-start gap-2 px-3"
            data-testid="toggle-notifications"
          >
            <span className="text-sm">
              {notifications
                ? i18n.t('toggle.story.notificationsOn', 'Notifications On')
                : i18n.t('toggle.story.notificationsOff', 'Notifications Off')}
            </span>
          </Toggle>
        </div>
      </div>
    </div>
  );
}

export const ToggleWithText: Story = {
  name: i18n.t('toggle.storyName.toggleWithText', 'Toggle with Text Labels'),
  render: () => <ToggleWithTextDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="toggle-with-text"]')).toBeInTheDocument();

    const darkModeToggle = canvasElement.querySelector(
      '[data-testid="toggle-dark-mode"]'
    ) as HTMLButtonElement;
    const notificationsToggle = canvasElement.querySelector(
      '[data-testid="toggle-notifications"]'
    ) as HTMLButtonElement;

    // Dark mode should be off initially
    expect(darkModeToggle.textContent).toContain('Off');
    expect(darkModeToggle.getAttribute('aria-pressed')).toBe('false');

    // Notifications should be on initially
    expect(notificationsToggle.textContent).toContain('On');
    expect(notificationsToggle.getAttribute('aria-pressed')).toBe('true');

    // Toggle dark mode on
    await userEvent.click(darkModeToggle);
    await waitFor(() => {
      expect(darkModeToggle.textContent).toContain('On');
      expect(darkModeToggle.getAttribute('aria-pressed')).toBe('true');
    });
  },
};

// ============ ICON HELPER ============

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  AlignCenter: AlignCenterIcon,
  AlignJustify: AlignJustifyIcon,
  AlignLeft: AlignLeftIcon,
  AlignRight: AlignRightIcon,
  Bell: BellIcon,
  BellOff: BellOffIcon,
  Bold: BoldIcon,
  Bookmark: BookmarkIcon,
  Grid: GridIcon,
  Heart: HeartIcon,
  Italic: ItalicIcon,
  List: ListIcon,
  Mic: MicIcon,
  MicOff: MicOffIcon,
  Pause: PauseIcon,
  Play: PlayIcon,
  Star: StarIcon,
  Strikethrough: StrikethroughIcon,
  Underline: UnderlineIcon,
  Video: VideoIcon,
  VideoOff: VideoOffIcon,
  Volume2: Volume2Icon,
  VolumeX: VolumeXIcon,
};

function ToggleIcon({ name }: { name: string }) {
  useTranslation();
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) return <span>{name}</span>;
  return <IconComponent />;
}

// ============ FACTORY-WIRED STORIES ============

// --- createFakeToggle ---

function SingleFakeToggleDemo() {
  const { t } = useTranslation();
  const data: FakeToggle = createFakeToggle({ icon: 'Bold', iconType: 'format', pressed: false });

  return (
    <div className="flex flex-col gap-4" data-testid="single-fake-toggle">
      <p className="text-sm font-medium">{t('toggle.notPressed')}</p>
      <Toggle
        aria-label={data.ariaLabel}
        data-testid={data.testId}
        defaultPressed={data.pressed}
        disabled={data.disabled}
        size={data.size}
        variant={data.variant}
      >
        <ToggleIcon name={data.icon} />
      </Toggle>
    </div>
  );
}

export const SingleFakeToggle: Story = {
  name: i18n.t('toggle.storyName.singleFakeToggle', 'Factory: Single Toggle (createFakeToggle)'),
  render: () => <SingleFakeToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('single-fake-toggle');
    expect(container).toBeInTheDocument();
    const toggle = container.querySelector('[data-slot="toggle"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed');
  },
};

// --- createFakeFormattingToggle ---

function FormattingToggleDemo() {
  const bold = createFakeFormattingToggle('Bold', { pressed: false });
  const italic = createFakeFormattingToggle('Italic', { pressed: true });
  const underline = createFakeFormattingToggle('Underline', { pressed: false });
  const strikethrough = createFakeFormattingToggle('Strikethrough', { pressed: false });

  return (
    <div className="flex flex-col gap-4" data-testid="formatting-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <div className="flex items-center gap-2">
        {[bold, italic, underline, strikethrough].map((item) => (
          <Toggle
            key={item.id}
            aria-label={item.ariaLabel}
            defaultPressed={item.pressed}
            variant={item.variant}
          >
            <ToggleIcon name={item.icon} />
          </Toggle>
        ))}
      </div>
    </div>
  );
}

export const FormattingToggle: Story = {
  name: i18n.t(
    'toggle.storyName.formattingToggle',
    'Factory: Formatting Toggle (createFakeFormattingToggle)'
  ),
  render: () => <FormattingToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('formatting-toggle');
    expect(container).toBeInTheDocument();
    const toggles = container.querySelectorAll('[data-slot="toggle"]');
    expect(toggles).toHaveLength(4);
    // Italic is pressed
    expect(toggles[1]?.getAttribute('aria-pressed')).toBe('true');
  },
};

// --- createFakeFavoriteToggle ---

function FavoriteToggleDemo() {
  const favorite: FakeToggle = createFakeFavoriteToggle({ pressed: false });

  return (
    <div className="flex flex-col gap-4" data-testid="favorite-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={favorite.ariaLabel}
        defaultPressed={favorite.pressed}
        variant={favorite.variant}
        data-testid="fav-toggle"
      >
        <ToggleIcon name={favorite.icon} />
      </Toggle>
    </div>
  );
}

export const FavoriteToggle: Story = {
  name: i18n.t(
    'toggle.storyName.favoriteToggle',
    'Factory: Favorite Toggle (createFakeFavoriteToggle)'
  ),
  render: () => <FavoriteToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('favorite-toggle');
    expect(container).toBeInTheDocument();
    const toggle = canvas.getByTestId('fav-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakeBookmarkToggle ---

function BookmarkToggleDemo() {
  const bookmark: FakeToggle = createFakeBookmarkToggle({ pressed: false });

  return (
    <div className="flex flex-col gap-4" data-testid="bookmark-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={bookmark.ariaLabel}
        defaultPressed={bookmark.pressed}
        variant={bookmark.variant}
        data-testid="bm-toggle"
      >
        <BookmarkIcon />
      </Toggle>
    </div>
  );
}

export const BookmarkToggle: Story = {
  name: i18n.t(
    'toggle.storyName.bookmarkToggle',
    'Factory: Bookmark Toggle (createFakeBookmarkToggle)'
  ),
  render: () => <BookmarkToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('bm-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakeNotificationToggle ---

function NotificationToggleDemo() {
  const notification: FakeToggle = createFakeNotificationToggle({ pressed: true });
  const [pressed, setPressed] = React.useState(notification.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="notification-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.pressed')}</p>
      <Toggle
        aria-label={notification.ariaLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant={notification.variant}
        data-testid="notif-toggle"
      >
        {pressed ? <BellIcon /> : <BellOffIcon />}
      </Toggle>
    </div>
  );
}

export const NotificationToggle: Story = {
  name: i18n.t(
    'toggle.storyName.notificationToggle',
    'Factory: Notification Toggle (createFakeNotificationToggle)'
  ),
  render: () => <NotificationToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('notif-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'));
  },
};

// --- createFakeToggleWithLabel ---

function ToggleWithLabelDemo() {
  const data: FakeToggleWithLabel = createFakeToggleWithLabel({
    icon: 'Bold',
    iconType: 'format',
    label: 'Bold Text',
    showLabel: true,
    pressed: false,
  });

  return (
    <div className="flex flex-col gap-4" data-testid="toggle-with-label">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <Toggle
        aria-label={data.ariaLabel}
        defaultPressed={data.pressed}
        variant={data.variant}
        data-testid="labeled-toggle"
        className="gap-2"
      >
        <ToggleIcon name={data.icon} />
        {data.showLabel && <span className="text-sm">{data.label}</span>}
      </Toggle>
    </div>
  );
}

export const LabeledToggle: Story = {
  name: i18n.t(
    'toggle.storyName.labeledToggle',
    'Factory: Toggle with Label (createFakeToggleWithLabel)'
  ),
  render: () => <ToggleWithLabelDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('labeled-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle.textContent).toContain('Bold Text');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  },
};

// --- createFakeFormattingToggleGroup ---

function FormattingGroupDemo() {
  const group: FakeFormattingToggleGroup = createFakeFormattingToggleGroup({
    type: 'multiple',
  });

  return (
    <div className="flex flex-col gap-4" data-testid="formatting-group">
      <p className="text-sm font-medium">
        {i18n.t('toggle.ariaLabel.bold')} - {group.type}
      </p>
      <div
        className="flex items-center gap-1"
        role="toolbar"
        aria-label={i18n.t('toggle.story.formatting', 'Formatting')}
      >
        {group.toggles.map((item) => (
          <Toggle
            key={item.id}
            aria-label={item.ariaLabel}
            defaultPressed={item.pressed}
            variant={item.variant}
          >
            <ToggleIcon name={item.icon} />
          </Toggle>
        ))}
      </div>
    </div>
  );
}

export const FormattingGroup: Story = {
  name: i18n.t(
    'toggle.storyName.formattingGroup',
    'Factory: Formatting Group (createFakeFormattingToggleGroup)'
  ),
  render: () => <FormattingGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('formatting-group');
    expect(container).toBeInTheDocument();
    const toolbar = canvas.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Formatting');
    const toggles = toolbar.querySelectorAll('[data-slot="toggle"]');
    expect(toggles).toHaveLength(4);
  },
};

// --- createFakeAlignmentToggleGroup ---

function AlignmentGroupDemo() {
  const group: FakeFormattingToggleGroup = createFakeAlignmentToggleGroup();

  return (
    <div className="flex flex-col gap-4" data-testid="alignment-group">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <div
        className="flex items-center gap-1"
        role="toolbar"
        aria-label={i18n.t('toggle.story.alignment', 'Alignment')}
      >
        {group.toggles.map((item) => (
          <Toggle
            key={item.id}
            aria-label={item.ariaLabel}
            defaultPressed={item.pressed}
            variant={item.variant}
          >
            <ToggleIcon name={item.icon} />
          </Toggle>
        ))}
      </div>
    </div>
  );
}

export const AlignmentGroup: Story = {
  name: i18n.t(
    'toggle.storyName.alignmentGroup',
    'Factory: Alignment Group (createFakeAlignmentToggleGroup)'
  ),
  render: () => <AlignmentGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('alignment-group');
    expect(container).toBeInTheDocument();
    const toolbar = canvas.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Alignment');
    const toggles = toolbar.querySelectorAll('[data-slot="toggle"]');
    expect(toggles).toHaveLength(4);
    // Exactly one should be pressed (single-select)
    const pressedCount = [...toggles].filter(
      (t) => t.getAttribute('aria-pressed') === 'true'
    ).length;
    expect(pressedCount).toBe(1);
  },
};

// --- createFakeViewTogglePair ---

function ViewTogglePairDemo() {
  const pair: FakeViewTogglePair = createFakeViewTogglePair({ activeView: 'grid' });
  const [activeView, setActiveView] = React.useState<'grid' | 'list'>(pair.activeView);

  return (
    <div className="flex flex-col gap-4" data-testid="view-toggle-pair">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.list')}</p>
      <div className="flex items-center gap-1">
        <Toggle
          aria-label={i18n.t('toggle.story.gridView', 'Grid view')}
          pressed={activeView === 'grid'}
          onPressedChange={() => setActiveView('grid')}
          variant="outline"
          data-testid="grid-toggle"
        >
          <GridIcon />
        </Toggle>
        <Toggle
          aria-label={i18n.t('toggle.story.listView', 'List view')}
          pressed={activeView === 'list'}
          onPressedChange={() => setActiveView('list')}
          variant="outline"
          data-testid="list-toggle"
        >
          <ListIcon />
        </Toggle>
      </div>
      <p className="text-muted-foreground text-xs">Active: {activeView}</p>
    </div>
  );
}

export const ViewTogglePair: Story = {
  name: i18n.t(
    'toggle.storyName.viewTogglePair',
    'Factory: View Toggle Pair (createFakeViewTogglePair)'
  ),
  render: () => <ViewTogglePairDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const gridToggle = canvas.getByTestId('grid-toggle');
    const listToggle = canvas.getByTestId('list-toggle');
    expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
    expect(listToggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(listToggle);
    await waitFor(() => {
      expect(listToggle).toHaveAttribute('aria-pressed', 'true');
      expect(gridToggle).toHaveAttribute('aria-pressed', 'false');
    });
  },
};

// --- createFakeMediaToggle ---

function MediaToggleDemo() {
  const media: FakeMediaToggle = createFakeMediaToggle('playPause', { pressed: false });
  const [pressed, setPressed] = React.useState(media.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="media-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={pressed ? media.onLabel : media.offLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant="outline"
        data-testid="media-ctrl"
      >
        {pressed ? <PauseIcon /> : <PlayIcon />}
      </Toggle>
    </div>
  );
}

export const MediaToggle: Story = {
  name: i18n.t('toggle.storyName.mediaToggle', 'Factory: Media Toggle (createFakeMediaToggle)'),
  render: () => <MediaToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('media-ctrl');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakePlayPauseToggle ---

function PlayPauseToggleDemo() {
  const data: FakeMediaToggle = createFakePlayPauseToggle({ pressed: false });
  const [pressed, setPressed] = React.useState(data.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="play-pause-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={pressed ? data.onLabel : data.offLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant="outline"
        data-testid="play-pause-ctrl"
      >
        {pressed ? <PauseIcon /> : <PlayIcon />}
      </Toggle>
    </div>
  );
}

export const PlayPauseToggle: Story = {
  name: i18n.t(
    'toggle.storyName.playPauseToggle',
    'Factory: Play/Pause Toggle (createFakePlayPauseToggle)'
  ),
  render: () => <PlayPauseToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('play-pause-ctrl');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakeMuteToggle ---

function MuteToggleDemo() {
  const data: FakeMediaToggle = createFakeMuteToggle({ pressed: true });
  const [pressed, setPressed] = React.useState(data.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="mute-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.pressed')}</p>
      <Toggle
        aria-label={pressed ? data.onLabel : data.offLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant="outline"
        data-testid="mute-ctrl"
      >
        {pressed ? <Volume2Icon /> : <VolumeXIcon />}
      </Toggle>
    </div>
  );
}

export const MuteToggle: Story = {
  name: i18n.t('toggle.storyName.muteToggle', 'Factory: Mute Toggle (createFakeMuteToggle)'),
  render: () => <MuteToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('mute-ctrl');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'false'));
  },
};

// --- createFakeMicToggle ---

function MicToggleDemo() {
  const data: FakeMediaToggle = createFakeMicToggle({ pressed: false });
  const [pressed, setPressed] = React.useState(data.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="mic-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={pressed ? data.onLabel : data.offLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant="outline"
        data-testid="mic-ctrl"
      >
        {pressed ? <MicIcon /> : <MicOffIcon />}
      </Toggle>
    </div>
  );
}

export const MicToggle: Story = {
  name: i18n.t('toggle.storyName.micToggle', 'Factory: Mic Toggle (createFakeMicToggle)'),
  render: () => <MicToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('mic-ctrl');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakeVideoToggle ---

function VideoToggleDemo() {
  const data: FakeMediaToggle = createFakeVideoToggle({ pressed: false });
  const [pressed, setPressed] = React.useState(data.pressed);

  return (
    <div className="flex flex-col gap-4" data-testid="video-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={pressed ? data.onLabel : data.offLabel}
        pressed={pressed}
        onPressedChange={setPressed}
        variant="outline"
        data-testid="video-ctrl"
      >
        {pressed ? <VideoIcon /> : <VideoOffIcon />}
      </Toggle>
    </div>
  );
}

export const VideoToggle: Story = {
  name: i18n.t('toggle.storyName.videoToggle', 'Factory: Video Toggle (createFakeVideoToggle)'),
  render: () => <VideoToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('video-ctrl');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
  },
};

// --- createFakePressedToggle ---

function PressedToggleDemo() {
  const data: FakeToggle = createFakePressedToggle({ icon: 'Star', iconType: 'favorite' });

  return (
    <div className="flex flex-col gap-4" data-testid="pressed-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.pressed')}</p>
      <Toggle
        aria-label={data.ariaLabel}
        defaultPressed={data.pressed}
        variant={data.variant}
        data-testid="pressed-ctrl"
      >
        <StarIcon />
      </Toggle>
    </div>
  );
}

export const PressedToggle: Story = {
  name: i18n.t(
    'toggle.storyName.pressedToggle',
    'Factory: Pressed Toggle (createFakePressedToggle)'
  ),
  render: () => <PressedToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('pressed-ctrl');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  },
};

// --- createFakeUnpressedToggle ---

function UnpressedToggleDemo() {
  const data: FakeToggle = createFakeUnpressedToggle({ icon: 'Heart', iconType: 'favorite' });

  return (
    <div className="flex flex-col gap-4" data-testid="unpressed-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.notPressed')}</p>
      <Toggle
        aria-label={data.ariaLabel}
        defaultPressed={data.pressed}
        variant={data.variant}
        data-testid="unpressed-ctrl"
      >
        <HeartIcon />
      </Toggle>
    </div>
  );
}

export const UnpressedToggle: Story = {
  name: i18n.t(
    'toggle.storyName.unpressedToggle',
    'Factory: Unpressed Toggle (createFakeUnpressedToggle)'
  ),
  render: () => <UnpressedToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('unpressed-ctrl');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  },
};

// --- createFakeDisabledToggle ---

function DisabledFactoryToggleDemo() {
  const data: FakeToggle = createFakeDisabledToggle({ icon: 'Bold', iconType: 'format' });

  return (
    <div className="flex flex-col gap-4" data-testid="disabled-factory-toggle">
      <p className="text-sm font-medium">{i18n.t('toggle.disabled')}</p>
      <Toggle
        aria-label={data.ariaLabel}
        defaultPressed={data.pressed}
        disabled={data.disabled}
        variant={data.variant}
        data-testid="disabled-ctrl"
      >
        <BoldIcon />
      </Toggle>
    </div>
  );
}

export const DisabledFactoryToggle: Story = {
  name: i18n.t(
    'toggle.storyName.disabledFactoryToggle',
    'Factory: Disabled Toggle (createFakeDisabledToggle)'
  ),
  render: () => <DisabledFactoryToggleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByTestId('disabled-ctrl');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeDisabled();
  },
};

// --- createToggleVariantMatrix + TOGGLE_VARIANTS ---

function VariantMatrixDemo() {
  const matrix = createToggleVariantMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="variant-matrix">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <p className="text-muted-foreground text-xs">Variants: {TOGGLE_VARIANTS.join(', ')}</p>
      <div className="flex items-center gap-2">
        {matrix.map(({ toggle, variant }: { toggle: FakeToggle; variant: ToggleVariant }) => (
          <div key={toggle.id} className="flex flex-col items-center gap-1">
            <Toggle
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant={variant}
              data-testid={`variant-${variant}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
            <span className="text-xs">{variant}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const VariantMatrix: Story = {
  name: i18n.t(
    'toggle.storyName.variantMatrix',
    'Factory: Variant Matrix (createToggleVariantMatrix)'
  ),
  render: () => <VariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('variant-matrix');
    expect(container).toBeInTheDocument();
    for (const variant of TOGGLE_VARIANTS) {
      expect(canvas.getByTestId(`variant-${variant}`)).toBeInTheDocument();
    }
  },
};

// --- createToggleSizeMatrix + TOGGLE_SIZES ---

function SizeMatrixDemo() {
  const matrix = createToggleSizeMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="size-matrix">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <p className="text-muted-foreground text-xs">Sizes: {TOGGLE_SIZES.join(', ')}</p>
      <div className="flex items-center gap-2">
        {matrix.map(({ size, toggle }: { size: ToggleSize; toggle: FakeToggle }) => (
          <div key={toggle.id} className="flex flex-col items-center gap-1">
            <Toggle
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              size={size}
              variant="outline"
              data-testid={`size-${size}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
            <span className="text-xs">{size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SizeMatrix: Story = {
  name: i18n.t('toggle.storyName.sizeMatrix', 'Factory: Size Matrix (createToggleSizeMatrix)'),
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('size-matrix');
    expect(container).toBeInTheDocument();
    for (const size of TOGGLE_SIZES) {
      expect(canvas.getByTestId(`size-${size}`)).toBeInTheDocument();
    }
  },
};

// --- createToggleStateMatrix + TOGGLE_STATES ---

function StateMatrixDemo() {
  const matrix = createToggleStateMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="state-matrix">
      <p className="text-sm font-medium">
        {i18n.t('toggle.pressed')} / {i18n.t('toggle.notPressed')}
      </p>
      <p className="text-muted-foreground text-xs">States: {TOGGLE_STATES.join(', ')}</p>
      <div className="flex items-center gap-2">
        {matrix.map(({ state, toggle }: { state: ToggleState; toggle: FakeToggle }) => (
          <div key={toggle.id} className="flex flex-col items-center gap-1">
            <Toggle
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant="outline"
              data-testid={`state-${state}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
            <span className="text-xs">{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const StateMatrix: Story = {
  name: i18n.t('toggle.storyName.stateMatrix', 'Factory: State Matrix (createToggleStateMatrix)'),
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('state-matrix');
    expect(container).toBeInTheDocument();
    const offToggle = canvas.getByTestId('state-off');
    const onToggle = canvas.getByTestId('state-on');
    expect(offToggle).toHaveAttribute('aria-pressed', 'false');
    expect(onToggle).toHaveAttribute('aria-pressed', 'true');
  },
};

// --- createToggleIconTypeMatrix + TOGGLE_ICON_TYPES + TOGGLE_ICONS ---

function IconTypeMatrixDemo() {
  const matrix = createToggleIconTypeMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="icon-type-matrix">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <p className="text-muted-foreground text-xs">Icon types: {TOGGLE_ICON_TYPES.join(', ')}</p>
      <div className="flex flex-wrap items-center gap-3">
        {matrix.map(({ iconType, toggle }: { iconType: ToggleIconType; toggle: FakeToggle }) => (
          <div key={toggle.id} className="flex flex-col items-center gap-1">
            <Toggle
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant="outline"
              data-testid={`icontype-${iconType}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
            <span className="text-xs">{iconType}</span>
            <span className="text-muted-foreground text-xs">
              ({TOGGLE_ICONS[iconType].length} icons)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const IconTypeMatrix: Story = {
  name: i18n.t(
    'toggle.storyName.iconTypeMatrix',
    'Factory: Icon Type Matrix (createToggleIconTypeMatrix)'
  ),
  render: () => <IconTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('icon-type-matrix');
    expect(container).toBeInTheDocument();
    for (const iconType of TOGGLE_ICON_TYPES) {
      expect(canvas.getByTestId(`icontype-${iconType}`)).toBeInTheDocument();
    }
  },
};

// --- TOGGLE_ARIA_LABELS ---

function AriaLabelsDemo() {
  const ariaKeys = Object.keys(TOGGLE_ARIA_LABELS);

  return (
    <div className="flex flex-col gap-4" data-testid="aria-labels-demo">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {ariaKeys.slice(0, 8).map((iconName) => (
          <Toggle
            key={iconName}
            aria-label={TOGGLE_ARIA_LABELS[iconName]}
            variant="outline"
            data-testid={`aria-${iconName}`}
          >
            <ToggleIcon name={iconName} />
          </Toggle>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{ariaKeys.length} aria labels defined</p>
    </div>
  );
}

export const AriaLabels: Story = {
  name: i18n.t('toggle.storyName.ariaLabels', 'Factory: Aria Labels (TOGGLE_ARIA_LABELS)'),
  render: () => <AriaLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('aria-labels-demo');
    expect(container).toBeInTheDocument();
    const toggles = container.querySelectorAll('[data-slot="toggle"]');
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute('aria-label');
      expect(toggle.getAttribute('aria-label')).not.toBe('');
    }
  },
};

// --- createToggleTestData ---

function TestDataDemo() {
  const testData = createToggleTestData();

  return (
    <div className="flex flex-col gap-6" data-testid="test-data-demo">
      <p className="text-sm font-medium">{i18n.t('toggle.ariaLabel.bold')}</p>

      {/* Basic toggles */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('toggle.story.basicStates', 'Basic states')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle
            aria-label={testData.basic.ariaLabel}
            defaultPressed={testData.basic.pressed}
            variant="outline"
            data-testid="td-basic"
          >
            <ToggleIcon name={testData.basic.icon} />
          </Toggle>
          <Toggle
            aria-label={testData.pressed.ariaLabel}
            defaultPressed={testData.pressed.pressed}
            variant="outline"
            data-testid="td-pressed"
          >
            <ToggleIcon name={testData.pressed.icon} />
          </Toggle>
          <Toggle
            aria-label={testData.unpressed.ariaLabel}
            defaultPressed={testData.unpressed.pressed}
            variant="outline"
            data-testid="td-unpressed"
          >
            <ToggleIcon name={testData.unpressed.icon} />
          </Toggle>
          <Toggle
            aria-label={testData.disabled.ariaLabel}
            defaultPressed={testData.disabled.pressed}
            disabled
            variant="outline"
            data-testid="td-disabled"
          >
            <ToggleIcon name={testData.disabled.icon} />
          </Toggle>
        </div>
      </div>

      {/* Media toggles */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('toggle.story.mediaControls', 'Media controls')}
        </p>
        <div className="flex items-center gap-2">
          <Toggle aria-label={testData.playPause.offLabel} variant="outline" data-testid="td-play">
            <PlayIcon />
          </Toggle>
          <Toggle aria-label={testData.mute.onLabel} variant="outline" data-testid="td-mute">
            <Volume2Icon />
          </Toggle>
          <Toggle aria-label={testData.mic.offLabel} variant="outline" data-testid="td-mic">
            <MicIcon />
          </Toggle>
          <Toggle aria-label={testData.video.offLabel} variant="outline" data-testid="td-video">
            <VideoIcon />
          </Toggle>
        </div>
      </div>

      {/* Labeled toggle */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {i18n.t('toggle.story.withLabel', 'With label')}
        </p>
        <Toggle
          aria-label={testData.withLabel.ariaLabel}
          variant="outline"
          className="gap-2"
          data-testid="td-labeled"
        >
          <ToggleIcon name={testData.withLabel.icon} />
          {testData.withLabel.showLabel && (
            <span className="text-sm">{testData.withLabel.label}</span>
          )}
        </Toggle>
      </div>
    </div>
  );
}

export const TestData: Story = {
  name: i18n.t('toggle.storyName.testData', 'Factory: Test Data (createToggleTestData)'),
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('test-data-demo');
    expect(container).toBeInTheDocument();
    expect(canvas.getByTestId('td-basic')).toBeInTheDocument();
    expect(canvas.getByTestId('td-pressed')).toHaveAttribute('aria-pressed', 'true');
    expect(canvas.getByTestId('td-unpressed')).toHaveAttribute('aria-pressed', 'false');
    expect(canvas.getByTestId('td-disabled')).toBeDisabled();
    expect(canvas.getByTestId('td-play')).toBeInTheDocument();
    expect(canvas.getByTestId('td-mute')).toBeInTheDocument();
    expect(canvas.getByTestId('td-mic')).toBeInTheDocument();
    expect(canvas.getByTestId('td-video')).toBeInTheDocument();
    expect(canvas.getByTestId('td-labeled')).toBeInTheDocument();
  },
};

// --- createToggleShowcase ---

function ShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createToggleShowcase();

  return (
    <div className="flex flex-col gap-6" data-testid="showcase-demo">
      <p className="text-sm font-medium">{t('toggle.ariaLabel.bold')}</p>

      {/* Variant matrix */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {t('toggle.story.variantMatrix', 'Variant Matrix')}
        </p>
        <div className="flex items-center gap-2">
          {showcase.variantMatrix.map(({ toggle, variant }) => (
            <Toggle
              key={toggle.id}
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant={variant}
              data-testid={`sc-variant-${variant}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
          ))}
        </div>
      </div>

      {/* Size matrix */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {t('toggle.story.sizeMatrix', 'Size Matrix')}
        </p>
        <div className="flex items-center gap-2">
          {showcase.sizeMatrix.map(({ size, toggle }) => (
            <Toggle
              key={toggle.id}
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              size={size}
              variant="outline"
              data-testid={`sc-size-${size}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
          ))}
        </div>
      </div>

      {/* State matrix */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {t('toggle.story.stateMatrix', 'State Matrix')}
        </p>
        <div className="flex items-center gap-2">
          {showcase.stateMatrix.map(({ state, toggle }) => (
            <Toggle
              key={toggle.id}
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant="outline"
              data-testid={`sc-state-${state}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
          ))}
        </div>
      </div>

      {/* Icon type matrix */}
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">
          {t('toggle.story.iconTypeMatrix', 'Icon Type Matrix')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showcase.iconTypeMatrix.map(({ iconType, toggle }) => (
            <Toggle
              key={toggle.id}
              aria-label={toggle.ariaLabel}
              defaultPressed={toggle.pressed}
              variant="outline"
              data-testid={`sc-icontype-${iconType}`}
            >
              <ToggleIcon name={toggle.icon} />
            </Toggle>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Showcase: Story = {
  name: i18n.t('toggle.storyName.showcase', 'Factory: Showcase (createToggleShowcase)'),
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('showcase-demo');
    expect(container).toBeInTheDocument();
    // Verify variant matrix
    for (const variant of TOGGLE_VARIANTS) {
      expect(canvas.getByTestId(`sc-variant-${variant}`)).toBeInTheDocument();
    }
    // Verify size matrix
    for (const size of TOGGLE_SIZES) {
      expect(canvas.getByTestId(`sc-size-${size}`)).toBeInTheDocument();
    }
    // Verify state matrix
    expect(canvas.getByTestId('sc-state-off')).toHaveAttribute('aria-pressed', 'false');
    expect(canvas.getByTestId('sc-state-on')).toHaveAttribute('aria-pressed', 'true');
    // Verify icon type matrix
    for (const iconType of TOGGLE_ICON_TYPES) {
      expect(canvas.getByTestId(`sc-icontype-${iconType}`)).toBeInTheDocument();
    }
  },
};

// --- FakeToggleGroupItem type usage ---

function ToggleGroupItemDemo() {
  const { t } = useTranslation();
  const groupItems: FakeToggleGroupItem[] = [
    {
      ...createFakeToggle({ icon: 'Bold', iconType: 'format', pressed: false, variant: 'outline' }),
      groupId: 'fmt-group-1',
      index: 0,
      value: 'bold',
    },
    {
      ...createFakeToggle({
        icon: 'Italic',
        iconType: 'format',
        pressed: false,
        variant: 'outline',
      }),
      groupId: 'fmt-group-1',
      index: 1,
      value: 'italic',
    },
    {
      ...createFakeToggle({
        icon: 'Underline',
        iconType: 'format',
        pressed: false,
        variant: 'outline',
      }),
      groupId: 'fmt-group-1',
      index: 2,
      value: 'underline',
    },
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="group-item-demo">
      <p className="text-sm font-medium">{t('toggle.ariaLabel.bold')}</p>
      <div
        className="flex items-center gap-1"
        role="toolbar"
        aria-label={i18n.t('toggle.story.groupItems', 'Group items')}
      >
        {groupItems.map((item) => (
          <Toggle
            key={item.id}
            aria-label={item.ariaLabel}
            defaultPressed={item.pressed}
            variant={item.variant}
            data-testid={`gi-${item.value}`}
          >
            <ToggleIcon name={item.icon} />
          </Toggle>
        ))}
      </div>
    </div>
  );
}

export const GroupItemDemo: Story = {
  name: i18n.t(
    'toggle.storyName.groupItemDemo',
    'Factory: Toggle Group Item (FakeToggleGroupItem)'
  ),
  render: () => <ToggleGroupItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvas.getByTestId('group-item-demo');
    expect(container).toBeInTheDocument();
    expect(canvas.getByTestId('gi-bold')).toBeInTheDocument();
    expect(canvas.getByTestId('gi-italic')).toBeInTheDocument();
    expect(canvas.getByTestId('gi-underline')).toBeInTheDocument();
    const toolbar = canvas.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-label', 'Group items');
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   slowResponse
//   emptyData
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('toggle.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: toggleStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('toggle.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: toggleStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('toggle.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: toggleStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('toggle.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: toggleStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('toggle.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: toggleStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
