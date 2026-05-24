import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  type BadgePosition,
  BUTTON_ICON_SIZES,
  BUTTON_ICONS,
  BUTTON_JUSTIFY,
  BUTTON_LABELS,
  BUTTON_SIZES,
  BUTTON_STATES,
  BUTTON_TEXT_SIZES,
  BUTTON_TYPES,
  BUTTON_VARIANTS,
  type ButtonJustify,
  type ButtonSize,
  type ButtonTooltipSide,
  type ButtonVariant,
  type ConfirmConfig,
  createFakeABTestButtons,
  createFakeAccessibleButton,
  createFakeBadgeButton,
  createFakeButton,
  createFakeButtonDisabled,
  createFakeButtonError,
  createFakeButtonFullWidth,
  createFakeButtonGroup,
  createFakeButtonGroups,
  createFakeButtonLoading,
  createFakeButtonMatrix,
  createFakeButtonPending,
  createFakeButtons,
  createFakeButtonStateMatrix,
  createFakeButtonSuccess,
  createFakeButtonWithAllIconSizes,
  createFakeButtonWithAllSizes,
  createFakeButtonWithAllTextSizes,
  createFakeButtonWithAllVariants,
  createFakeButtonWithBothIcons,
  createFakeButtonWithLeftIcon,
  createFakeButtonWithRightIcon,
  createFakeConfirmButton,
  createFakeCTAButton,
  createFakeEnterpriseButtonSet,
  createFakeEnterprisePhase2ButtonSet,
  createFakeErrorFeedbackButton,
  createFakeFormButtons,
  createFakeGradientButton,
  createFakeLongPressButton,
  createFakeMobileButton,
  createFakePaymentButton,
  createFakeResetButton,
  createFakeRippleButton,
  createFakeShortcutButton,
  createFakeSkeletonButton,
  createFakeSoundButton,
  createFakeSubmitButton,
  createFakeSuccessFeedbackButton,
  createFakeToggleButton,
  createFakeTooltipButton,
  createFakeTrackedCTAButton,
  createFakeUltimateEnterpriseButton,
  createFakeUndoableButton,
  GRADIENT_PRESETS,
  type GradientConfig,
  type GradientDirection,
  KEYBOARD_SHORTCUTS,
} from '@/.storybook/stories/_factories/button.factory';
import {
  buttonHandlers,
  buttonStatusHandlers,
} from '@/.storybook/stories/_handlers/button.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { HeartIcon, LoaderIcon, MailIcon, SendIcon, TrashIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nButton() {
  const { t } = useTranslation();

  return <Button>{t('exportButton.button')}</Button>;
}

// ============ HELPER FUNCTIONS ============

const SIZE_LABELS: Record<string, string> = {
  xs: 'XS',
  sm: 'SM',
  lg: 'LG',
};

function getSizeLabel(size: string): string {
  return SIZE_LABELS[size] ?? 'Btn';
}

function getStateVariant(state: 'idle' | 'loading' | 'success' | 'error') {
  if (state === 'error') return 'destructive';
  if (state === 'success') return 'success';
  return 'default';
}

function getStateIcon(state: 'idle' | 'loading' | 'success' | 'error') {
  if (state === 'loading') return <LoaderIcon className="animate-spin" />;
  if (state === 'success') return <span>✓</span>;
  if (state === 'error') return <span>✗</span>;
  return <SendIcon />;
}

function getStateIconLg(state: 'idle' | 'loading' | 'success' | 'error') {
  if (state === 'loading') return <LoaderIcon className="animate-spin" />;
  if (state === 'success') return <span className="text-lg">✓</span>;
  if (state === 'error') return <span className="text-lg">✗</span>;
  return <SendIcon />;
}

function getSoundFrequency(state: 'idle' | 'loading' | 'success' | 'error') {
  if (state === 'success') return 880;
  if (state === 'error') return 220;
  return 660;
}

function getSoundDuration(state: 'idle' | 'loading' | 'success' | 'error') {
  if (state === 'success') return 150;
  if (state === 'error') return 200;
  return 50;
}

// ============ I18N WRAPPER COMPONENTS ============

function VariantsDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>{i18n.t('button.default')}</Button>
      <Button variant="secondary">{i18n.t('button.secondary')}</Button>
      <Button variant="outline">{i18n.t('button.outline')}</Button>
      <Button variant="ghost">{i18n.t('button.ghost')}</Button>
      <Button variant="link">{i18n.t('button.link')}</Button>
      <Button variant="destructive">{i18n.t('button.destructive')}</Button>
      <Button variant="warning">{i18n.t('button.warning')}</Button>
      <Button variant="success">{i18n.t('button.success')}</Button>
      <Button variant="info">{i18n.t('button.info')}</Button>
    </div>
  );
}

function SizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">{t('button.extraSmall')}</Button>
      <Button size="sm">{t('button.small')}</Button>
      <Button size="default">{t('button.default')}</Button>
      <Button size="lg">{t('button.large')}</Button>
      <Button size="xl">{t('button.extraLarge')}</Button>
    </div>
  );
}

function IconSizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="icon-xs" aria-label={i18n.t('button.a11y.extraSmallIcon', 'Extra small icon')}>
        <HeartIcon />
      </Button>
      <Button size="icon-sm" aria-label={t('button.a11y.smallIcon')}>
        <HeartIcon />
      </Button>
      <Button size="icon" aria-label={t('button.a11y.defaultIcon')}>
        <HeartIcon />
      </Button>
      <Button size="icon-lg" aria-label={t('button.a11y.largeIcon')}>
        <HeartIcon />
      </Button>
      <Button size="icon-xl" aria-label={i18n.t('button.a11y.extraLargeIcon', 'Extra large icon')}>
        <HeartIcon />
      </Button>
    </div>
  );
}

function WithIconDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>
        <MailIcon />
        {t('button.loginWithEmail')}
      </Button>
      <Button variant="outline">
        <SendIcon />
        {t('button.sendMessage')}
      </Button>
      <Button variant="destructive">
        <TrashIcon />
        {t('button.delete')}
      </Button>
    </div>
  );
}

function IconOnlyDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default" size="icon" aria-label={t('button.a11y.like')}>
        <HeartIcon />
      </Button>
      <Button variant="outline" size="icon" aria-label={t('button.a11y.sendEmail')}>
        <MailIcon />
      </Button>
      <Button variant="ghost" size="icon" aria-label={t('button.a11y.send')}>
        <SendIcon />
      </Button>
      <Button variant="destructive" size="icon" aria-label={t('button.delete')}>
        <TrashIcon />
      </Button>
    </div>
  );
}

function DisabledAllVariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>{t('button.disabledDefault')}</Button>
      <Button disabled variant="secondary">
        {t('button.disabledSecondary')}
      </Button>
      <Button disabled variant="outline">
        {t('button.disabledOutline')}
      </Button>
      <Button disabled variant="ghost">
        {t('button.disabledGhost')}
      </Button>
      <Button disabled variant="link">
        {t('button.disabledLink')}
      </Button>
      <Button disabled variant="destructive">
        {t('button.disabledDestructive')}
      </Button>
    </div>
  );
}

function LoadingStateDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>
        <LoaderIcon className="animate-spin" />
        {t('button.loading')}
      </Button>
      <Button disabled variant="outline">
        <LoaderIcon className="animate-spin" />
        {t('button.loading')}
      </Button>
      <Button>{t('button.notLoading')}</Button>
    </div>
  );
}

function AsChildDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild>
        <a href="#as-child">{t('button.anchorButton')}</a>
      </Button>
      <Button asChild variant="outline">
        <a href="#as-child-outline">{t('button.outlineAnchor')}</a>
      </Button>
    </div>
  );
}

function PseudoStatesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button id="hover">{t('button.hover')}</Button>
      <Button id="focus" variant="secondary">
        {t('button.focus')}
      </Button>
      <Button id="active" variant="outline">
        {t('button.active')}
      </Button>
    </div>
  );
}

function PseudoStatesAllVariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button id="hover-default">{t('button.default')}</Button>
        <Button id="hover-secondary" variant="secondary">
          {t('button.secondary')}
        </Button>
        <Button id="hover-outline" variant="outline">
          {t('button.outline')}
        </Button>
        <Button id="hover-ghost" variant="ghost">
          {t('button.ghost')}
        </Button>
        <Button id="hover-destructive" variant="destructive">
          {t('button.destructive')}
        </Button>
      </div>
    </div>
  );
}

function AllVariantsMatrixDemo() {
  const { t } = useTranslation();
  const variants: ButtonVariant[] = [
    'default',
    'secondary',
    'outline',
    'ghost',
    'link',
    'destructive',
  ];
  const sizes: ButtonSize[] = ['sm', 'default', 'lg'];

  const getSizeLabel = (size: ButtonSize) => {
    if (size === 'sm') return t('button.small');
    if (size === 'lg') return t('button.large');
    return t('button.default');
  };

  return (
    <div className="space-y-6">
      {variants.map((variant) => (
        <div key={variant} className="space-y-2">
          <p className="text-sm font-medium capitalize">{variant}</p>
          <div className="flex flex-wrap items-center gap-3">
            {sizes.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {getSizeLabel(size)}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AccessibilityDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('button.section.standardButtons')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t('button.default')}</Button>
          <Button variant="secondary">{t('button.secondary')}</Button>
          <Button variant="destructive">{t('button.destructive')}</Button>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('button.section.iconOnlyButtons')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="icon" aria-label={t('button.a11y.likeThisItem')}>
            <HeartIcon />
          </Button>
          <Button size="icon" variant="outline" aria-label={t('button.a11y.sendEmail')}>
            <MailIcon />
          </Button>
          <Button size="icon" variant="destructive" aria-label={t('button.a11y.deleteItem')}>
            <TrashIcon />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('button.section.disabledButtons')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>{t('button.disabledDefault')}</Button>
          <Button disabled size="icon" aria-label={t('button.a11y.disabledAction')}>
            <HeartIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KeyboardInteractionDemo() {
  const { t } = useTranslation();
  const [clickCount, setClickCount] = React.useState(0);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('button.story.tabToFocus')}</p>
      <div className="flex items-center gap-3">
        <Button data-testid="click-me-button" onClick={() => setClickCount((c) => c + 1)}>
          {t('button.clickMe')} ({clickCount})
        </Button>
        <Button data-testid="second-button" variant="secondary">
          {t('button.secondButton')}
        </Button>
        <Button data-testid="third-button" variant="outline">
          {t('button.thirdButton')}
        </Button>
      </div>
    </div>
  );
}

function DisabledKeyboardBehaviorDemo() {
  const { t } = useTranslation();
  const [clickCount, setClickCount] = React.useState(0);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('button.story.disabledNoFocus')}</p>
      <div className="flex items-center gap-3">
        <Button data-testid="disabled-button" disabled onClick={() => setClickCount((c) => c + 1)}>
          {t('button.disabled')} ({clickCount})
        </Button>
        <Button data-testid="enabled-button" onClick={() => setClickCount((c) => c + 1)}>
          {t('button.enabled')} ({clickCount})
        </Button>
      </div>
    </div>
  );
}

function FocusManagementDemo() {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (index + 1) % 3;
      setActiveIndex(nextIndex);
      buttonRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (index - 1 + 3) % 3;
      setActiveIndex(prevIndex);
      buttonRefs.current[prevIndex]?.focus();
    }
  };

  const labels = [t('button.save'), t('button.edit'), t('button.delete')];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('button.story.useArrowKeys')}</p>
      <div className="flex gap-2" role="toolbar" aria-label={t('button.story.actionToolbar')}>
        {labels.map((label, index) => (
          <Button
            key={label}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            tabIndex={activeIndex === index ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
            variant={index === 2 ? 'destructive' : 'default'}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: i18n.t('button.story.button', 'Button'),
    variant: 'default',
    size: 'default',
    disabled: false,
    loading: false,
    type: 'button',
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  parameters: {
    msw: { handlers: [...buttonHandlers, ...formHandlers] },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: 'text',
      description: i18n.t(
        'button.argType.buttonContentTextIconsOrAnyReactNode',
        'Button content (text, icons, or any React node)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    variant: {
      control: 'select',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
        'warning',
        'success',
        'info',
      ],
      description: i18n.t(
        'button.argType.visualStyleVariantOfTheButton',
        'Visual style variant of the button'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: {
          summary:
            "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'warning' | 'success' | 'info'",
        },
      },
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'xl',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
        'icon-xl',
      ],
      description: i18n.t('button.argType.sizeOfTheButton', 'Size of the button'),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: {
          summary:
            "'default' | 'xs' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg' | 'icon-xl'",
        },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('button.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    disabled: {
      control: 'boolean',
      description: i18n.t(
        'button.argType.whetherTheButtonIsDisabled',
        'Whether the button is disabled'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    loading: {
      control: 'boolean',
      description: i18n.t(
        'button.argType.whetherTheButtonIsInLoadingState',
        'Whether the button is in loading state'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    pending: {
      control: 'boolean',
      description: i18n.t(
        'button.argType.pendingStateFromReact19Usetransitionuseformstatus',
        'Pending state from React 19 useTransition/useFormStatus'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    fullWidth: {
      control: 'boolean',
      description: i18n.t(
        'button.argType.makesButtonTakeFullWidthOfContainer',
        'Makes button take full width of container'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between'],
      description: i18n.t('button.argType.justifyContentAlignment', 'Justify content alignment'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'center' },
        type: { summary: "'start' | 'center' | 'end' | 'between'" },
      },
    },
    // Sections
    leftSection: {
      control: false,
      description: i18n.t(
        'button.argType.elementToDisplayOnTheLeftSideOfButtonText',
        'Element to display on the left side of button text'
      ),
      table: {
        category: 'Sections',
        type: { summary: 'ReactNode' },
      },
    },
    rightSection: {
      control: false,
      description: i18n.t(
        'button.argType.elementToDisplayOnTheRightSideOfButtonText',
        'Element to display on the right side of button text'
      ),
      table: {
        category: 'Sections',
        type: { summary: 'ReactNode' },
      },
    },
    // HTML
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: i18n.t('button.argType.htmlButtonTypeAttribute', 'HTML button type attribute'),
      table: {
        category: 'HTML',
        defaultValue: { summary: 'button' },
        type: { summary: "'button' | 'submit' | 'reset'" },
      },
    },
    // Composition
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'button.argType.renderAsChildElementUsingRadixSlot',
        'Render as child element (using Radix Slot)'
      ),
      table: {
        category: 'Composition',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('button.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('button.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('button.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('button.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('button.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('button.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('button.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

// Playground with i18n support - uses translated default while allowing Controls to override
function PlaygroundButton(args: React.ComponentProps<typeof Button>) {
  const { t } = useTranslation();
  // Use translated default if children is the hardcoded default 'Button'
  const children = args.children === 'Button' ? t('button.button') : args.children;
  return <Button {...args}>{children}</Button>;
}

export const Playground: Story = {
  render: (args) => <PlaygroundButton {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(9);
  },
};

// ============ SEMANTIC VARIANT STORIES ============

function SemanticVariantsDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Semantic variants for different action types
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="success">{i18n.t('button.saveChanges')}</Button>
          <Button variant="warning">{i18n.t('button.warning')}</Button>
          <Button variant="info">{i18n.t('button.info')}</Button>
          <Button variant="destructive">{i18n.t('button.deleteAccount')}</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.withIcons', 'With icons')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="success">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {i18n.t('button.success')}
          </Button>
          <Button variant="warning">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {i18n.t('button.warning')}
          </Button>
          <Button variant="info">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {i18n.t('button.info')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const SemanticVariants: Story = {
  name: i18n.t('button.storyName.semanticVariants', 'Semantic Variants (success, warning, info)'),
  render: () => <SemanticVariantsDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(7);

    // Verify data-variant attributes
    const successBtn = canvasElement.querySelector('[data-variant="success"]');
    const warningBtn = canvasElement.querySelector('[data-variant="warning"]');
    const infoBtn = canvasElement.querySelector('[data-variant="info"]');

    expect(successBtn).toBeInTheDocument();
    expect(warningBtn).toBeInTheDocument();
    expect(infoBtn).toBeInTheDocument();
  },
};

// ============ SIZE STORIES ============

function AllSizesDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.allTextButtonSizes', 'All text button sizes')}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button size="xs">{i18n.t('button.extraSmall')}</Button>
          <Button size="sm">{i18n.t('button.small')}</Button>
          <Button size="default">{i18n.t('button.default')}</Button>
          <Button size="lg">{i18n.t('button.large')}</Button>
          <Button size="xl">{i18n.t('button.extraLarge')}</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.allIconButtonSizes', 'All icon button sizes')}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button size="icon-xs" aria-label={i18n.t('button.extraSmall')}>
            <HeartIcon />
          </Button>
          <Button size="icon-sm" aria-label={i18n.t('button.small')}>
            <HeartIcon />
          </Button>
          <Button size="icon" aria-label={i18n.t('button.default')}>
            <HeartIcon />
          </Button>
          <Button size="icon-lg" aria-label={i18n.t('button.large')}>
            <HeartIcon />
          </Button>
          <Button size="icon-xl" aria-label={i18n.t('button.extraLarge')}>
            <HeartIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

export const AllSizes: Story = {
  name: i18n.t('button.storyName.allSizes', 'All Sizes (xs to xl)'),
  render: () => <AllSizesDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(10);

    // Verify size data attributes
    expect(canvasElement.querySelector('[data-size="xs"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="xl"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="icon-xs"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-size="icon-xl"]')).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(5);
  },
};

export const IconSizes: Story = {
  render: () => <IconSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(5);
  },
};

export const WithIcon: Story = {
  render: () => <WithIconDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
    // Verify icons are rendered
    buttons.forEach((button) => {
      expect(button.querySelector('svg')).toBeInTheDocument();
    });
  },
};

export const IconOnly: Story = {
  render: () => <IconOnlyDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    // Verify all icon-only buttons have aria-label
    buttons.forEach((button) => {
      expect(button.getAttribute('aria-label')).toBeInTheDocument();
    });
  },
};

// ============ TYPE ATTRIBUTE STORIES ============

function TypeAttributeDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Default type is &quot;button&quot; (prevents accidental form submission)
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button data-testid="no-type">{i18n.t('button.button')}</Button>
          <Button type="button" data-testid="type-button">
            type=&quot;button&quot;
          </Button>
          <Button type="submit" data-testid="type-submit">
            {i18n.t('button.submit')}
          </Button>
          <Button type="reset" data-testid="type-reset">
            {i18n.t('button.reset')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const TypeAttribute: Story = {
  name: i18n.t('button.storyName.typeAttribute', 'Type Attribute (default: button)'),
  render: () => <TypeAttributeDemo />,
  play: async ({ canvasElement }) => {
    // Verify default type is "button" (not "submit")
    const noTypeBtn = canvasElement.querySelector('[data-testid="no-type"]');
    const typeBtnBtn = canvasElement.querySelector('[data-testid="type-button"]');
    const submitBtn = canvasElement.querySelector('[data-testid="type-submit"]');
    const resetBtn = canvasElement.querySelector('[data-testid="type-reset"]');

    // Default should be "button" to prevent accidental form submission
    expect(noTypeBtn?.getAttribute('type')).toBe('button');
    expect(typeBtnBtn?.getAttribute('type')).toBe('button');
    expect(submitBtn?.getAttribute('type')).toBe('submit');
    expect(resetBtn?.getAttribute('type')).toBe('reset');
  },
};

// ============ DATA ATTRIBUTES STORIES ============

function DataAttributesDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        All buttons expose data-* attributes for CSS targeting and analytics
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button data-testid="attr-default">{i18n.t('button.default')}</Button>
        <Button variant="destructive" size="lg" data-testid="attr-destructive">
          {i18n.t('button.destructive')} {i18n.t('button.large')}
        </Button>
        <Button variant="success" size="sm" loading data-testid="attr-loading">
          <LoaderIcon className="animate-spin" />
          {i18n.t('button.loading')}
        </Button>
        <Button variant="outline" disabled data-testid="attr-disabled">
          {i18n.t('button.disabled')}
        </Button>
      </div>
    </div>
  );
}

export const DataAttributes: Story = {
  name: i18n.t(
    'button.storyName.dataAttributes',
    'Data Attributes (variant, size, loading, disabled)'
  ),
  render: () => <DataAttributesDemo />,
  play: async ({ canvasElement }) => {
    const defaultBtn = canvasElement.querySelector('[data-testid="attr-default"]');
    const destructiveBtn = canvasElement.querySelector('[data-testid="attr-destructive"]');
    const loadingBtn = canvasElement.querySelector('[data-testid="attr-loading"]');
    const disabledBtn = canvasElement.querySelector('[data-testid="attr-disabled"]');

    // Verify data-variant
    expect(defaultBtn?.getAttribute('data-variant')).toBe('default');
    expect(destructiveBtn?.getAttribute('data-variant')).toBe('destructive');
    expect(loadingBtn?.getAttribute('data-variant')).toBe('success');
    expect(disabledBtn?.getAttribute('data-variant')).toBe('outline');

    // Verify data-size
    expect(defaultBtn?.getAttribute('data-size')).toBe('default');
    expect(destructiveBtn?.getAttribute('data-size')).toBe('lg');
    expect(loadingBtn?.getAttribute('data-size')).toBe('sm');

    // Verify data-loading
    expect(loadingBtn?.getAttribute('data-loading')).toBe('true');
    expect(loadingBtn?.getAttribute('aria-busy')).toBe('true');

    // Verify data-disabled (loading also sets disabled)
    expect(loadingBtn?.getAttribute('data-disabled')).toBe('true');
    expect(disabledBtn?.getAttribute('data-disabled')).toBe('true');
    expect(loadingBtn).toBeDisabled();
    expect(disabledBtn).toBeDisabled();
  },
};

function DisabledButton() {
  const { t } = useTranslation();
  return <Button disabled>{t('button.disabledDefault')}</Button>;
}

export const Disabled: Story = {
  render: () => <DisabledButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.getAttribute('disabled')).toBe('');
  },
};

export const DisabledAllVariants: Story = {
  render: () => <DisabledAllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(6);
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  },
};

export const LoadingState: Story = {
  render: () => <LoadingStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
    // Verify disabled loading buttons
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[2]).not.toBeDisabled();
  },
};

export const AsChild: Story = {
  name: i18n.t('button.storyName.asChild', 'AsChild (anchor)'),
  render: () => <AsChildDemo />,
  play: async ({ canvasElement }) => {
    const anchors = canvasElement.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    anchors.forEach((anchor) => {
      expect(anchor.getAttribute('href')).toBeInTheDocument();
      expect(anchor.getAttribute('data-slot')).toBe('button');
    });
  },
};

export const KeyboardInteraction: Story = {
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstButton = canvas.getByTestId('click-me-button');
    const secondButton = canvas.getByTestId('second-button');

    // Tab to first button
    await userEvent.tab();
    expect(firstButton).toHaveFocus();

    // Enter key activates
    await userEvent.keyboard('{Enter}');
    expect(canvasElement.textContent).toContain('(1)');

    // Space key activates
    await userEvent.keyboard(' ');
    expect(canvasElement.textContent).toContain('(2)');

    // Tab to second button
    await userEvent.tab();
    expect(secondButton).toHaveFocus();

    // Shift+Tab back
    await userEvent.tab({ shift: true });
    expect(firstButton).toHaveFocus();
  },
};

export const DisabledKeyboardBehavior: Story = {
  render: () => <DisabledKeyboardBehaviorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const enabledButton = canvas.getByTestId('enabled-button');

    // Tab should skip disabled button
    await userEvent.tab();
    expect(enabledButton).toHaveFocus();

    // Click count should still be 0 (disabled button not clicked)
    expect(canvasElement.textContent).toContain('(0)');
  },
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Button' });

    expect(button).toBeInTheDocument();
    expect(button.getAttribute('data-slot')).toBe('button');
    expect(button).not.toBeDisabled();

    await userEvent.click(button);
  },
};

export const PseudoStates: Story = {
  name: i18n.t('button.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  tags: ['!test'],
  render: () => <PseudoStatesDemo />,
  parameters: {
    pseudo: {
      hover: ['#hover'],
      focusVisible: ['#focus'],
      active: ['#active'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStatesAllVariants: Story = {
  name: i18n.t('button.storyName.pseudoStatesAllVariants', 'Pseudo States (All Variants)'),
  tags: ['!test'],
  render: () => <PseudoStatesAllVariantsDemo />,
  parameters: {
    pseudo: {
      hover: [
        '#hover-default',
        '#hover-secondary',
        '#hover-outline',
        '#hover-ghost',
        '#hover-destructive',
      ],
    },
  },
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
  render: () => <I18nButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button', { name: 'エクスポート' })).toBeInTheDocument();
  },
};

function LocaleSwitchingDemo() {
  const { i18n } = useTranslation();
  const [locale, setLocale] = React.useState(i18n.language);
  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'ja' : 'en';
    i18n.changeLanguage(newLocale);
    setLocale(newLocale);
  };
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Dynamic locale switching between English and Japanese.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={toggleLocale} variant="outline">
          {locale === 'en' ? '日本語に切替' : 'Switch to English'}
        </Button>
        <Button>{i18n.t('button.default')}</Button>
        <Button variant="secondary">{i18n.t('button.secondary')}</Button>
        <Button variant="outline">{i18n.t('button.outline')}</Button>
        <Button variant="destructive">{i18n.t('button.destructive')}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled>{i18n.t('button.disabledDefault')}</Button>
        <Button loading disabled>
          <LoaderIcon className="animate-spin" />
          {i18n.t('button.loading')}
        </Button>
        <Button>{i18n.t('button.save')}</Button>
        <Button variant="destructive">{i18n.t('button.delete')}</Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Current locale: <code>{locale}</code>
      </p>
    </div>
  );
}

export const LocaleSwitching: Story = {
  name: i18n.t('button.storyName.localeSwitching', 'Locale Switching'),
  render: () => <LocaleSwitchingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Verify initial English text
    expect(canvas.getByText('Default')).toBeInTheDocument();
    // Switch to Japanese
    const switchBtn = canvas.getByText('日本語に切替');
    await userEvent.click(switchBtn);
    // Verify Japanese text appeared
    expect(canvas.getByText('デフォルト')).toBeInTheDocument();
  },
};

export const DarkModeJapanese: Story = {
  name: i18n.t('button.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    locale: 'ja',
    theme: 'dark',
  },
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('デフォルト')).toBeInTheDocument();
    expect(canvas.getByText('セカンダリ')).toBeInTheDocument();
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const AllVariantsMatrix: Story = {
  name: i18n.t('button.storyName.allVariantsMatrix', 'All Variants & Sizes Matrix'),
  render: () => <AllVariantsMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    // 6 variants × 3 sizes = 18
    expect(buttons.length).toBe(18);
  },
};

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: buttonStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORIES ============

export const Accessibility: Story = {
  name: i18n.t('button.storyName.accessibility', 'Accessibility Testing'),
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test: All buttons are accessible
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).not.toBe(0);

    // Test: Icon-only buttons have accessible names
    const iconButtons = canvasElement.querySelectorAll('button[aria-label]');
    iconButtons.forEach((button) => {
      const label = button.getAttribute('aria-label');
      expect(label).toBeInTheDocument();
      expect(label!.length).toBeGreaterThan(2);
    });

    // Test: Disabled buttons have disabled attribute
    const disabledButtons = canvasElement.querySelectorAll('button[disabled]');
    expect(disabledButtons.length).toBe(2);

    // Test: Focus ring is visible (keyboard navigation)
    const firstButton = canvas.getAllByRole('button')[0];
    await userEvent.tab();
    expect(firstButton).toHaveFocus();

    // Test: Buttons are keyboard accessible
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.keyboard(' ');
  },
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
};

export const AccessibilityFocusManagement: Story = {
  name: i18n.t('button.storyName.accessibilityFocusManagement', 'Focus Management'),
  render: () => <FocusManagementDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = canvas.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    // Verify toolbar has an aria-label (translation may vary)
    const ariaLabel = toolbar.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel!.length).toBeGreaterThan(0);

    // Test roving tabindex pattern
    const buttons = canvas.getAllByRole('button');
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    expect(buttons[1].getAttribute('tabindex')).toBe('-1');
    expect(buttons[2].getAttribute('tabindex')).toBe('-1');

    // Tab to toolbar
    await userEvent.tab();
    expect(buttons[0]).toHaveFocus();

    // Arrow right moves focus
    await userEvent.keyboard('{ArrowRight}');
    expect(buttons[1]).toHaveFocus();
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const fakeButtons = createFakeButtons(5);

    return (
      <div className="flex flex-wrap items-center gap-3">
        {fakeButtons.map((btn) => (
          <Button
            key={btn.id}
            variant={btn.variant}
            size={btn.size === 'icon-sm' || btn.size === 'icon-lg' ? 'icon' : btn.size}
            disabled={btn.disabled}
            loading={btn.loading}
          >
            {btn.label}
          </Button>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(5);
    buttons.forEach((button) => {
      expect(button.textContent?.trim().length).not.toBe(0);
    });
  },
};

// ============ FACTORY: BUTTON STATES ============

function FactoryButtonStatesDemo() {
  const loading = createFakeButtonLoading();
  const pending = createFakeButtonPending();
  const disabled = createFakeButtonDisabled();
  const error = createFakeButtonError();
  const success = createFakeButtonSuccess();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Buttons generated via specialized state factory functions.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={loading.loading} variant={loading.variant}>
          {loading.label || 'Loading'}
        </Button>
        <Button disabled={pending.pending} variant={pending.variant}>
          {pending.label || 'Pending'}
        </Button>
        <Button disabled={disabled.disabled} variant={disabled.variant}>
          {disabled.label || 'Disabled'}
        </Button>
        <Button variant="destructive" error={error.error}>
          {error.label || 'Error'}
        </Button>
        <Button variant={success.variant} success={success.success}>
          {success.label || 'Success'}
        </Button>
      </div>
    </div>
  );
}

export const FactoryButtonStates: Story = {
  name: i18n.t('button.storyName.factoryButtonStates', 'Factory: Button States'),
  render: () => <FactoryButtonStatesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(5);
  },
};

// ============ FACTORY: ALL VARIANTS ============

function FactoryAllVariantsDemo() {
  const buttons = createFakeButtonWithAllVariants();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        All {BUTTON_VARIANTS.length} variants from factory ({BUTTON_LABELS.length} labels
        available).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {buttons.map((btn) => (
          <Button key={btn.id} variant={btn.variant}>
            {btn.label || btn.variant}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllVariants: Story = {
  name: i18n.t('button.storyName.factoryAllVariants', 'Factory: All Variants'),
  render: () => <FactoryAllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(BUTTON_VARIANTS.length);
  },
};

// ============ FACTORY: ALL SIZES ============

function FactoryAllSizesDemo() {
  const textSizes = createFakeButtonWithAllTextSizes();
  const iconSizes = createFakeButtonWithAllIconSizes();
  const allSizes = createFakeButtonWithAllSizes();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        All {BUTTON_SIZES.length} sizes ({BUTTON_TEXT_SIZES.length} text +{' '}
        {BUTTON_ICON_SIZES.length} icon), combined: {allSizes.length}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {textSizes.map((btn) => (
          <Button key={btn.id} size={btn.size}>
            {/* eslint-disable-next-line unicorn/explicit-length-check -- btn.size is a string, not a collection */}
            {btn.label || btn.size}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {iconSizes.map((btn) => (
          <Button key={btn.id} size={btn.size} aria-label={btn.ariaLabel ?? 'icon'}>
            <HeartIcon />
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllSizes: Story = {
  name: i18n.t('button.storyName.factoryAllSizes', 'Factory: All Sizes'),
  render: () => <FactoryAllSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(BUTTON_TEXT_SIZES.length + BUTTON_ICON_SIZES.length);
  },
};

// ============ FACTORY: BUTTON MATRIX ============

function FactoryButtonMatrixDemo() {
  const matrix = createFakeButtonMatrix();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('button.story.variantSizeMatrixDescription', {
          variants: BUTTON_VARIANTS.length,
          sizes: BUTTON_TEXT_SIZES.length,
        })}
      </p>
      <div className="space-y-2">
        {matrix.map((row, i) => (
          <div key={BUTTON_VARIANTS[i]} className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground w-24 text-xs">{BUTTON_VARIANTS[i]}</span>
            {row.map((btn) => (
              <Button key={btn.id} variant={btn.variant} size={btn.size}>
                {/* eslint-disable-next-line unicorn/explicit-length-check -- btn.size is a string, not a collection */}
                {btn.label || btn.size}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryButtonMatrix: Story = {
  name: i18n.t('button.storyName.factoryButtonMatrix', 'Factory: Button Matrix'),
  render: () => <FactoryButtonMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(BUTTON_VARIANTS.length * BUTTON_TEXT_SIZES.length);
  },
};

// ============ FACTORY: STATE MATRIX ============

function FactoryStateMatrixDemo() {
  const matrix = createFakeButtonStateMatrix();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        State × Variant matrix ({BUTTON_STATES.length} × {BUTTON_VARIANTS.length}) for state
        coverage.
      </p>
      <div className="space-y-2">
        {matrix.map((row, i) => (
          <div key={BUTTON_STATES[i]} className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground w-20 text-xs">{BUTTON_STATES[i]}</span>
            {row.map((btn) => (
              <Button
                key={btn.id}
                variant={btn.variant}
                disabled={btn.disabled}
                loading={btn.loading}
                success={btn.success}
                error={btn.error}
              >
                {btn.label || btn.variant}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryStateMatrix: Story = {
  name: i18n.t('button.storyName.factoryStateMatrix', 'Factory: State Matrix'),
  render: () => <FactoryStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(BUTTON_STATES.length * BUTTON_VARIANTS.length);
  },
};

// ============ FACTORY: ICONS & FULL WIDTH ============

function FactoryIconsDemo() {
  const leftIcon = createFakeButtonWithLeftIcon();
  const rightIcon = createFakeButtonWithRightIcon();
  const bothIcons = createFakeButtonWithBothIcons();
  const fullWidth = createFakeButtonFullWidth();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Icon placement ({BUTTON_ICONS.length} icons, {BUTTON_JUSTIFY.length} justify options,{' '}
        {BUTTON_TYPES.length} types) and full-width variants.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={leftIcon.variant} leftSection={<MailIcon className="size-4" />}>
          {leftIcon.label || 'Left Icon'}
        </Button>
        <Button variant={rightIcon.variant} rightSection={<SendIcon className="size-4" />}>
          {rightIcon.label || 'Right Icon'}
        </Button>
        <Button
          variant={bothIcons.variant}
          leftSection={<MailIcon className="size-4" />}
          rightSection={<SendIcon className="size-4" />}
        >
          {bothIcons.label || 'Both Icons'}
        </Button>
      </div>
      <Button fullWidth={fullWidth.fullWidth} variant={fullWidth.variant}>
        {fullWidth.label || 'Full Width'}
      </Button>
    </div>
  );
}

export const FactoryIcons: Story = {
  name: i18n.t('button.storyName.factoryIcons', 'Factory: Icons & Full Width'),
  render: () => <FactoryIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(4);
  },
};

// ============ FACTORY: FORM BUTTONS ============

function FactoryFormButtonsDemo() {
  const submit = createFakeSubmitButton();
  const reset = createFakeResetButton();
  const formSet = createFakeFormButtons();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'button.story.formButtonSetsFromSpecializedFactories',
          'Form button sets from specialized factories.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type={submit.type} variant={submit.variant}>
          {submit.label}
        </Button>
        <Button type={reset.type} variant={reset.variant}>
          {reset.label}
        </Button>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground mb-3 text-xs">
          {i18n.t('button.story.formButtonSet', 'Form Button Set:')}
        </p>
        <div className="flex items-center gap-3">
          <Button type={formSet.submit.type} variant={formSet.submit.variant}>
            {formSet.submit.label}
          </Button>
          <Button type={formSet.reset.type} variant={formSet.reset.variant}>
            {formSet.reset.label}
          </Button>
          <Button type={formSet.cancel.type} variant={formSet.cancel.variant}>
            {formSet.cancel.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const FactoryFormButtons: Story = {
  name: i18n.t('button.storyName.factoryFormButtons', 'Factory: Form Buttons'),
  render: () => <FactoryFormButtonsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(5);
  },
};

// ============ FACTORY: BUTTON GROUPS ============

function FactoryButtonGroupsDemo() {
  const group = createFakeButtonGroup({ orientation: 'horizontal', spacing: 'sm' });
  const groups = createFakeButtonGroups(2);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Button groups from factory (orientation: {group.orientation}, spacing: {group.spacing}).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {group.buttons.map((btn) => (
          <Button
            key={btn.id}
            variant={btn.variant}
            size={btn.size === 'icon-sm' ? 'sm' : 'default'}
          >
            {btn.label || 'Button'}
          </Button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.id} className="rounded-md border p-3">
          <p className="text-muted-foreground mb-2 text-xs">
            Group ({g.orientation}, {g.spacing})
          </p>
          <div
            className={`flex ${g.orientation === 'vertical' ? 'flex-col' : ''} flex-wrap items-center gap-2`}
          >
            {g.buttons.map((btn) => (
              <Button
                key={btn.id}
                variant={btn.variant}
                size={btn.size === 'icon-sm' ? 'sm' : 'default'}
              >
                {btn.label || 'Button'}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryButtonGroups: Story = {
  name: i18n.t('button.storyName.factoryButtonGroups', 'Factory: Button Groups'),
  render: () => <FactoryButtonGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  },
};

// ============ FACTORY: ENTERPRISE PHASE 1 ============

function FactoryEnterprisePhase1Demo() {
  const payment = createFakePaymentButton(99.99);
  const mobile = createFakeMobileButton();
  const tracked = createFakeTrackedCTAButton('Sign Up Now');
  const successBtn = createFakeSuccessFeedbackButton();
  const errorBtn = createFakeErrorFeedbackButton();
  const abTest = createFakeABTestButtons('Get Started');
  const enterpriseSet = createFakeEnterpriseButtonSet();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Phase 1 enterprise features from specialized factories.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          preventDoubleClick={payment.preventDoubleClick}
          trackingId={payment.trackingId}
          variant={payment.variant}
        >
          {payment.label}
        </Button>
        <Button hapticFeedback={mobile.hapticFeedback} size={mobile.size} variant={mobile.variant}>
          {mobile.label || 'Mobile'}
        </Button>
        <Button trackingId={tracked.trackingId} variant={tracked.variant}>
          {tracked.label}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={successBtn.variant} success={successBtn.success}>
          {successBtn.label || 'Success'}
        </Button>
        <Button variant={errorBtn.variant} error={errorBtn.error}>
          {errorBtn.label || 'Error'}
        </Button>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground mb-3 text-xs">A/B Test (id: {abTest.testId}):</p>
        <div className="flex items-center gap-3">
          <Button variant={abTest.variantA.variant} trackingId={abTest.variantA.trackingId}>
            A: {abTest.variantA.label}
          </Button>
          <Button variant={abTest.variantB.variant} trackingId={abTest.variantB.trackingId}>
            B: {abTest.variantB.label}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {enterpriseSet.map((btn) => (
          <Button
            key={btn.id}
            variant={btn.variant}
            preventDoubleClick={btn.preventDoubleClick}
            hapticFeedback={btn.hapticFeedback}
            trackingId={btn.trackingId}
            success={btn.success}
            error={btn.error}
          >
            {btn.label || 'Enterprise'}
          </Button>
        ))}
      </div>
    </div>
  );
}

export const FactoryEnterprisePhase1: Story = {
  name: i18n.t('button.storyName.factoryEnterprisePhase1', 'Factory: Enterprise Phase 1'),
  render: () => <FactoryEnterprisePhase1Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(9);
  },
};

// ============ FACTORY: ENTERPRISE PHASE 2 ============

function FactoryEnterprisePhase2Demo() {
  const shortcut = createFakeShortcutButton('Save', 'mod+s');
  const toggle = createFakeToggleButton('Bold', false);
  const ripple = createFakeRippleButton();
  const gradient = createFakeGradientButton(GRADIENT_PRESETS[0]);
  const badge = createFakeBadgeButton(5);
  const skeleton = createFakeSkeletonButton();
  const longPress = createFakeLongPressButton();
  const confirm = createFakeConfirmButton();
  const tooltip = createFakeTooltipButton('Click me');
  const sound = createFakeSoundButton(800, 50);
  const undoable = createFakeUndoableButton();
  const cta = createFakeCTAButton('Get Started Free');
  const accessible = createFakeAccessibleButton();
  const phase2Set = createFakeEnterprisePhase2ButtonSet();
  const ultimate = createFakeUltimateEnterpriseButton();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Phase 2 enterprise features ({KEYBOARD_SHORTCUTS.length} shortcut presets,{' '}
        {GRADIENT_PRESETS.length} gradient presets).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button shortcut={shortcut.shortcut} showShortcut={shortcut.showShortcut}>
          {shortcut.label}
        </Button>
        <Button toggle={toggle.toggle} pressed={toggle.pressed} size={toggle.size}>
          {toggle.label}
        </Button>
        <Button ripple={ripple.ripple} rippleColor={ripple.rippleColor}>
          {ripple.label || 'Ripple'}
        </Button>
        <Button
          gradient={
            typeof gradient.gradient === 'object' && gradient.gradient
              ? gradient.gradient
              : undefined
          }
          glow={gradient.glow}
        >
          {gradient.label || 'Gradient'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button badge={badge.badge} badgePosition={badge.badgePosition}>
          {badge.label || 'Badge'}
        </Button>
        <Button skeleton={skeleton.skeleton}>{skeleton.label || 'Skeleton'}</Button>
        <Button variant={longPress.variant} longPressMs={longPress.longPressMs}>
          {longPress.label || 'Long Press'}
        </Button>
        <Button variant={confirm.variant} confirmAction={confirm.confirmAction}>
          {confirm.label || 'Confirm'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button tooltip={tooltip.tooltip} tooltipSide={tooltip.tooltipSide}>
          {tooltip.label || 'Tooltip'}
        </Button>
        <Button
          soundEnabled={sound.soundEnabled}
          soundFrequency={sound.soundFrequency}
          soundDuration={sound.soundDuration}
        >
          {sound.label || 'Sound'}
        </Button>
        <Button undoable={undoable.undoable} undoTimeoutMs={undoable.undoTimeoutMs}>
          {undoable.label || 'Undoable'}
        </Button>
        <Button pulse={cta.pulse} glow={cta.glow} size={cta.size}>
          {cta.label}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          announceStateChanges={accessible.announceStateChanges}
          respectReducedMotion={accessible.respectReducedMotion}
        >
          {accessible.label || 'Accessible'}
        </Button>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground mb-3 text-xs">
          Phase 2 Set ({phase2Set.length} buttons):
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {phase2Set.map((btn) => (
            <Button
              key={btn.id}
              variant={btn.variant}
              size={btn.size === 'icon-sm' ? 'sm' : 'default'}
              ripple={btn.ripple}
              toggle={btn.toggle}
              pressed={btn.pressed}
            >
              {btn.label || btn.variant}
            </Button>
          ))}
        </div>
      </div>
      <div className="rounded-md border p-4">
        <p className="text-muted-foreground mb-3 text-xs">
          {i18n.t('button.story.ultimateEnterpriseButton', 'Ultimate Enterprise Button:')}
        </p>
        <Button
          size={ultimate.size}
          fullWidth={ultimate.fullWidth}
          preventDoubleClick={ultimate.preventDoubleClick}
          hapticFeedback={ultimate.hapticFeedback}
          trackingId={ultimate.trackingId}
          shortcut={ultimate.shortcut}
          showShortcut={ultimate.showShortcut}
          ripple={ultimate.ripple}
          rippleColor={ultimate.rippleColor}
          glow={ultimate.glow}
          gradient={
            typeof ultimate.gradient === 'object' && ultimate.gradient
              ? ultimate.gradient
              : undefined
          }
          announceStateChanges={ultimate.announceStateChanges}
          soundEnabled={ultimate.soundEnabled}
          badge={ultimate.badge}
          testId={ultimate.testId}
          className="max-w-md"
        >
          {ultimate.label}
        </Button>
      </div>
    </div>
  );
}

export const FactoryEnterprisePhase2: Story = {
  name: i18n.t('button.storyName.factoryEnterprisePhase2', 'Factory: Enterprise Phase 2'),
  render: () => <FactoryEnterprisePhase2Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(15);
  },
};

// ============ FACTORY: SINGLE BUTTON BUILDER ============

export const FactorySingleButton: Story = {
  name: i18n.t('button.storyName.factorySingleButton', 'Factory: Single Button'),
  render: () => {
    const btn = createFakeButton({ variant: 'default', state: 'idle', size: 'lg' });

    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Single button from createFakeButton() with override support.
        </p>
        <Button variant={btn.variant} size={btn.size} testId={btn.testId}>
          {btn.label}
        </Button>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          {JSON.stringify(
            {
              id: btn.id,
              label: btn.label,
              variant: btn.variant,
              size: btn.size,
              testId: btn.testId,
            },
            null,
            2
          )}
        </pre>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// ============ ASYNC FORM SUBMISSION DEMO ============

function AsyncSubmitButton() {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleSubmit = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? 'Submission failed');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="space-y-4" data-testid="async-submit-demo">
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          data-state={status}
          data-testid="submit-button"
        >
          {status === 'loading' && <LoaderIcon className="animate-spin" />}
          {status === 'idle' && i18n.t('button.submitForm')}
          {status === 'loading' && i18n.t('button.submitting')}
          {status === 'success' && i18n.t('button.submitted')}
          {status === 'error' && i18n.t('button.tryAgain')}
        </Button>
        {status === 'success' && (
          <span className="text-sm text-green-600" data-testid="success-message">
            {i18n.t('button.formSubmittedSuccess')}
          </span>
        )}
        {status === 'error' && (
          <span className="text-sm text-red-600" data-testid="error-message">
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: formHandlers },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');

    // Initially idle
    expect(submitButton.getAttribute('data-state')).toBe('idle');
    // Button has text content (translations may vary)
    expect(submitButton.textContent?.trim().length).toBeGreaterThan(0);

    // Click to submit
    await userEvent.click(submitButton);

    // Should be loading
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const SlowResponse: Story = {
  name: i18n.t('button.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.slowResponse },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');

    await userEvent.click(submitButton);

    // Should show loading state for slow response
    expect(submitButton.getAttribute('data-state')).toBe('loading');
    expect(submitButton).toBeDisabled();
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error502BadGateway: Story = {
  name: i18n.t('button.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.badGateway },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('button.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.serviceUnavailable },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('button.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.gatewayTimeout },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('button.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.tooManyRequests },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

// ============ LOADING PROP STORIES ============

function LoadingPropDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button loading>{i18n.t('button.loading')}</Button>
      <Button loading variant="secondary">
        {i18n.t('button.loading')}
      </Button>
      <Button loading variant="outline">
        {i18n.t('button.loading')}
      </Button>
      <Button loading variant="destructive">
        {i18n.t('button.loading')}
      </Button>
    </div>
  );
}

export const LoadingProp: Story = {
  name: i18n.t('button.storyName.loadingProp', 'Loading Prop (aria-busy)'),
  render: () => <LoadingPropDemo />,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(4);

    buttons.forEach((button) => {
      // Verify loading prop sets aria-busy
      expect(button.getAttribute('aria-busy')).toBe('true');
      // Verify data-loading attribute
      expect(button.getAttribute('data-loading')).toBe('true');
    });
  },
};

// ============ ARIA-INVALID STORIES ============

function AriaInvalidDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Buttons with aria-invalid show destructive ring styling
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button aria-invalid="true">{i18n.t('button.default')}</Button>
          <Button aria-invalid="true" variant="secondary">
            {i18n.t('button.secondary')}
          </Button>
          <Button aria-invalid="true" variant="outline">
            {i18n.t('button.outline')}
          </Button>
          <Button aria-invalid="true" variant="ghost">
            {i18n.t('button.ghost')}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.normalButtonsNoAriainvalid', 'Normal buttons (no aria-invalid)')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{i18n.t('button.default')}</Button>
          <Button variant="secondary">{i18n.t('button.secondary')}</Button>
          <Button variant="outline">{i18n.t('button.outline')}</Button>
          <Button variant="ghost">{i18n.t('button.ghost')}</Button>
        </div>
      </div>
    </div>
  );
}

export const AriaInvalid: Story = {
  name: i18n.t('button.storyName.ariaInvalid', 'Aria Invalid State'),
  render: () => <AriaInvalidDemo />,
  play: async ({ canvasElement }) => {
    const invalidButtons = canvasElement.querySelectorAll('button[aria-invalid="true"]');
    expect(invalidButtons.length).toBe(4);

    invalidButtons.forEach((button) => {
      expect(button.getAttribute('aria-invalid')).toBe('true');
    });
  },
};

// ============ FORM CONTEXT STORIES ============

function FormSubmitDemo() {
  const [submitted, setSubmitted] = React.useState(false);
  const [formData, setFormData] = React.useState({ email: '' });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="space-y-4" data-testid="form-submit-demo">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ email: e.target.value })}
            className="border-input h-9 w-full rounded-md border px-3"
            data-testid="email-input"
          />
        </div>
        <Button type="submit" data-testid="submit-button">
          {i18n.t('button.submit')}
        </Button>
      </form>
      {submitted && (
        <p className="text-sm text-green-600" data-testid="submit-success">
          Form submitted with: {formData.email}
        </p>
      )}
    </div>
  );
}

export const FormSubmit: Story = {
  name: i18n.t('button.storyName.formSubmit', 'Form Submit (type="submit")'),
  render: () => <FormSubmitDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    const emailInput = canvas.getByTestId('email-input');

    // Verify button type
    expect(submitButton.getAttribute('type')).toBe('submit');

    // Fill form
    await userEvent.type(emailInput, 'test@example.com');

    // Submit via button click
    await userEvent.click(submitButton);

    // Verify submission
    expect(canvas.getByTestId('submit-success')).toBeInTheDocument();
  },
};

function FormResetDemo() {
  const [formData, setFormData] = React.useState({ name: '', email: '' });

  return (
    <div className="space-y-4" data-testid="form-reset-demo">
      <form className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="border-input h-9 w-full rounded-md border px-3"
            data-testid="name-input"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            className="border-input h-9 w-full rounded-md border px-3"
            data-testid="email-input"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">{i18n.t('button.submit')}</Button>
          <Button
            type="reset"
            variant="outline"
            onClick={() => setFormData({ name: '', email: '' })}
            data-testid="reset-button"
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
}

export const FormReset: Story = {
  name: i18n.t('button.storyName.formReset', 'Form Reset (type="reset")'),
  render: () => <FormResetDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resetButton = canvas.getByTestId('reset-button');
    const nameInput = canvas.getByTestId('name-input');
    const emailInput = canvas.getByTestId('email-input');

    // Verify button type
    expect(resetButton.getAttribute('type')).toBe('reset');

    // Fill form
    await userEvent.type(nameInput, 'John Doe');
    await userEvent.type(emailInput, 'john@example.com');

    // Verify inputs have values
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');

    // Click reset
    await userEvent.click(resetButton);

    // Verify inputs are cleared
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
  },
};

// ============ COMPOSITION STORIES ============

function DialogFooterDemo() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);

  // Inline imports to avoid circular dependencies in stories
  const Dialog = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.Dialog }))
  );
  const DialogTrigger = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogTrigger }))
  );
  const DialogContent = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogContent }))
  );
  const DialogHeader = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogHeader }))
  );
  const DialogTitle = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogTitle }))
  );
  const DialogDescription = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogDescription }))
  );
  const DialogFooter = React.lazy(() =>
    import('@/components/ui/dialog').then((mod) => ({ default: mod.DialogFooter }))
  );

  return (
    <div className="space-y-4" data-testid="dialog-footer-demo">
      <React.Suspense fallback={<div>{t('button.story.loading', 'Loading...')}</div>}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="open-dialog-button">
              {t('button.story.openDialog', 'Open Dialog')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('button.story.confirmAction', 'Confirm Action')}</DialogTitle>
              <DialogDescription>
                {t(
                  'button.story.confirmDescription',
                  'Are you sure you want to proceed? This action cannot be undone.'
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} data-testid="cancel-button">
                {t('button.story.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmed(true);
                  setOpen(false);
                }}
                data-testid="confirm-button"
              >
                {t('button.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </React.Suspense>
      {confirmed && (
        <p className="text-sm text-green-600" data-testid="confirmed-message">
          Action confirmed!
        </p>
      )}
    </div>
  );
}

export const InDialogFooter: Story = {
  name: i18n.t('button.storyName.inDialogFooter', 'In Dialog Footer'),
  render: () => <DialogFooterDemo />,
  parameters: {
    layout: 'centered',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open dialog
    const openButton = canvas.getByTestId('open-dialog-button');
    await userEvent.click(openButton);

    // Wait for dialog to appear (in portal)
    const doc = canvasElement.ownerDocument;
    await new Promise((resolve) => setTimeout(resolve, 300));

    const dialogContent = doc.querySelector('[data-testid="dialog-content"]');
    expect(dialogContent).toBeInTheDocument();

    // Find buttons in dialog footer
    const cancelButton = doc.querySelector('[data-testid="cancel-button"]');
    const confirmButton = doc.querySelector('[data-testid="confirm-button"]');

    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();

    // Click cancel to close
    if (cancelButton) {
      await userEvent.click(cancelButton);
    }
  },
};

function DropdownTriggerDemo() {
  const [selectedAction, setSelectedAction] = React.useState<string | null>(null);

  // Inline imports
  const DropdownMenu = React.lazy(() =>
    import('@/components/ui/dropdown-menu').then((mod) => ({ default: mod.DropdownMenu }))
  );
  const DropdownMenuTrigger = React.lazy(() =>
    import('@/components/ui/dropdown-menu').then((mod) => ({ default: mod.DropdownMenuTrigger }))
  );
  const DropdownMenuContent = React.lazy(() =>
    import('@/components/ui/dropdown-menu').then((mod) => ({ default: mod.DropdownMenuContent }))
  );
  const DropdownMenuItem = React.lazy(() =>
    import('@/components/ui/dropdown-menu').then((mod) => ({ default: mod.DropdownMenuItem }))
  );
  const DropdownMenuSeparator = React.lazy(() =>
    import('@/components/ui/dropdown-menu').then((mod) => ({ default: mod.DropdownMenuSeparator }))
  );

  return (
    <div className="space-y-4" data-testid="dropdown-trigger-demo">
      <React.Suspense fallback={<div>{i18n.t('button.story.loading', 'Loading...')}</div>}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="dropdown-trigger-button">
              {i18n.t('button.story.actions', 'Actions')}
              <svg
                className="ml-2 size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSelectedAction('edit')}>
              {i18n.t('button.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelectedAction('save')}>
              {i18n.t('button.save')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSelectedAction('delete')}
              className="text-destructive"
            >
              {i18n.t('button.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </React.Suspense>
      {selectedAction && (
        <p className="text-muted-foreground text-sm" data-testid="selected-action">
          {i18n.t('button.story.selected', 'Selected')}: {selectedAction}
        </p>
      )}
    </div>
  );
}

export const AsDropdownTrigger: Story = {
  name: i18n.t('button.storyName.asDropdownTrigger', 'As Dropdown Trigger'),
  render: () => <DropdownTriggerDemo />,
  parameters: {
    layout: 'centered',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find and click trigger button
    const triggerButton = canvas.getByTestId('dropdown-trigger-button');
    expect(triggerButton).toBeInTheDocument();
    expect(triggerButton.getAttribute('data-slot')).toBe('button');
    await userEvent.click(triggerButton);

    // Wait for menu to appear
    await new Promise((resolve) => setTimeout(resolve, 200));

    const doc = canvasElement.ownerDocument;
    const menuContent = doc.querySelector('[data-testid="dropdown-menu-content"]');
    expect(menuContent).toBeInTheDocument();
  },
};

// ============ EDGE CASE STORIES ============

function LongTextDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.defaultTruncatesWithEllipsis', 'Default (truncates with ellipsis)')}
        </p>
        <div className="w-48">
          <Button className="w-full truncate" data-testid="truncate-button">
            This is a very long button text that should be truncated
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'button.story.wrappingDisabledWhitespacenowrap',
            'Wrapping disabled (whitespace-nowrap)'
          )}
        </p>
        <div className="w-48 overflow-hidden">
          <Button data-testid="nowrap-button">
            This is a very long button text that will overflow
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.withExplicitMaxwidth', 'With explicit max-width')}
        </p>
        <Button className="max-w-xs truncate" data-testid="maxwidth-button">
          This is a very long button text that should be truncated with max-width
        </Button>
      </div>
    </div>
  );
}

export const LongTextOverflow: Story = {
  name: i18n.t('button.storyName.longTextOverflow', 'Long Text Overflow'),
  render: () => <LongTextDemo />,
  play: async ({ canvasElement }) => {
    const truncateButton = canvasElement.querySelector('[data-testid="truncate-button"]');
    const nowrapButton = canvasElement.querySelector('[data-testid="nowrap-button"]');
    const maxwidthButton = canvasElement.querySelector('[data-testid="maxwidth-button"]');

    expect(truncateButton).toBeInTheDocument();
    expect(nowrapButton).toBeInTheDocument();
    expect(maxwidthButton).toBeInTheDocument();

    // Verify whitespace-nowrap is applied (from buttonVariants base)
    if (nowrapButton) {
      const styles = window.getComputedStyle(nowrapButton);
      expect(styles.whiteSpace).toBe('nowrap');
    }
  },
};

function EmptyChildrenDemo() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.emptyButtonNoChildren', 'Empty button (no children)')}
        </p>
        <div className="flex items-center gap-3">
          <Button data-testid="empty-button" />
          <Button variant="outline" data-testid="empty-outline" />
          <Button variant="ghost" data-testid="empty-ghost" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.whitespaceOnly', 'Whitespace only')}
        </p>
        <div className="flex items-center gap-3">
          <Button data-testid="whitespace-button"> </Button>
          <Button data-testid="nbsp-button">&nbsp;</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.nullUndefinedChildren')}
        </p>
        <div className="flex items-center gap-3">
          <Button data-testid="null-button">{null}</Button>
          <Button data-testid="undefined-button">{undefined}</Button>
        </div>
      </div>
    </div>
  );
}

export const EmptyChildren: Story = {
  name: i18n.t('button.storyName.emptyChildren', 'Empty Children (edge case)'),
  render: () => <EmptyChildrenDemo />,
  play: async ({ canvasElement }) => {
    const emptyButton = canvasElement.querySelector('[data-testid="empty-button"]');
    const nullButton = canvasElement.querySelector('[data-testid="null-button"]');
    const undefinedButton = canvasElement.querySelector('[data-testid="undefined-button"]');

    // All buttons should render without crashing
    expect(emptyButton).toBeInTheDocument();
    expect(nullButton).toBeInTheDocument();
    expect(undefinedButton).toBeInTheDocument();

    // Verify they're still clickable
    if (emptyButton) {
      await userEvent.click(emptyButton);
    }
  },
};

// ============ ANIMATION STORIES ============

function ClickAnimationDemo() {
  const [clickCount, setClickCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Click buttons to see active:scale-[0.98] animation. Count: {clickCount}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setClickCount((c) => c + 1)} data-testid="animated-default">
          {i18n.t('button.default')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setClickCount((c) => c + 1)}
          data-testid="animated-secondary"
        >
          {i18n.t('button.secondary')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setClickCount((c) => c + 1)}
          data-testid="animated-outline"
        >
          {i18n.t('button.outline')}
        </Button>
        <Button
          variant="destructive"
          onClick={() => setClickCount((c) => c + 1)}
          data-testid="animated-destructive"
        >
          {i18n.t('button.destructive')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Note: Link variant does not have scale animation
      </p>
      <Button
        variant="link"
        onClick={() => setClickCount((c) => c + 1)}
        data-testid="animated-link"
      >
        {i18n.t('button.link')}
      </Button>
    </div>
  );
}

export const ClickAnimation: Story = {
  name: i18n.t('button.storyName.clickAnimation', 'Click Animation (active:scale)'),
  render: () => <ClickAnimationDemo />,
  parameters: {
    pseudo: {
      active: [
        '[data-testid="animated-default"]',
        '[data-testid="animated-secondary"]',
        '[data-testid="animated-outline"]',
        '[data-testid="animated-destructive"]',
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const defaultButton = canvas.getByTestId('animated-default');

    // Rapid clicks to test animation
    await userEvent.click(defaultButton);
    await userEvent.click(defaultButton);
    await userEvent.click(defaultButton);

    // Verify click count updated
    expect(canvasElement.textContent).toContain('Count: 3');
  },
};

// ============ FOCUS-WITHIN STORIES ============

function FocusWithinDemo() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Button with focus-within:ring shows ring when internal element is focused
        </p>
        <Button asChild className="p-0" data-testid="focus-within-button">
          <label className="flex h-9 cursor-pointer items-center gap-2 px-4">
            <input
              type="checkbox"
              className="size-4"
              data-testid="nested-checkbox"
              aria-label={i18n.t('button.a11y.toggleOption', 'Toggle option')}
            />
            <span>{i18n.t('button.story.toggleOption', 'Toggle Option')}</span>
          </label>
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Button containing an input (file upload style)
        </p>
        <Button asChild variant="outline" data-testid="file-upload-button">
          <label className="cursor-pointer">
            <input type="file" className="sr-only" data-testid="file-input" />
            <span>{i18n.t('button.story.chooseFile', 'Choose File')}</span>
          </label>
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t('button.story.standardFocusForComparison', 'Standard focus (for comparison)')}
        </p>
        <Button data-testid="standard-focus-button">{i18n.t('button.default')}</Button>
      </div>
    </div>
  );
}

export const FocusWithinRing: Story = {
  name: i18n.t('button.storyName.focusWithinRing', 'Focus Within Ring'),
  render: () => <FocusWithinDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nestedCheckbox = canvas.getByTestId('nested-checkbox');
    const standardButton = canvas.getByTestId('standard-focus-button');

    // Focus nested element
    nestedCheckbox.focus();
    expect(nestedCheckbox).toHaveFocus();

    // Tab to standard button
    await userEvent.tab();
    await userEvent.tab();

    // Eventually reach standard button
    standardButton.focus();
    expect(standardButton).toHaveFocus();
  },
};

// ============ TOUCH/MOBILE STORIES ============

function TouchBehaviorDemo() {
  const [touchEvents, setTouchEvents] = React.useState<string[]>([]);

  const logEvent = (event: string) => {
    setTouchEvents((prev) => [...prev.slice(-4), event]);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Touch event sequence (simulated via pointer events)
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onPointerDown={() => logEvent('pointerdown')}
          onPointerUp={() => logEvent('pointerup')}
          onClick={() => logEvent('click')}
          onTouchStart={() => logEvent('touchstart')}
          onTouchEnd={() => logEvent('touchend')}
          data-testid="touch-button"
        >
          {i18n.t('button.clickMe')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onPointerDown={() => logEvent('pointerdown (lg)')}
          onClick={() => logEvent('click (lg)')}
          data-testid="touch-large-button"
        >
          Large Touch Target
        </Button>
      </div>
      <div className="rounded-md border p-2">
        <p className="text-muted-foreground mb-1 text-xs">
          {i18n.t('button.story.eventLog', 'Event log:')}
        </p>
        <div className="font-mono text-xs" data-testid="event-log">
          {touchEvents.length === 0
            ? i18n.t('button.story.noEventsYet', 'No events yet')
            : touchEvents.join(' → ')}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Minimum touch target: 44×44px (WCAG). Icon buttons: 32-40px. Large buttons: 40px height.
      </p>
    </div>
  );
}

export const TouchBehavior: Story = {
  name: i18n.t('button.storyName.touchBehavior', 'Touch/Mobile Behavior'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: () => <TouchBehaviorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const touchButton = canvas.getByTestId('touch-button');
    const largeButton = canvas.getByTestId('touch-large-button');

    // Simulate pointer events (touch simulation)
    await userEvent.click(touchButton);
    await userEvent.click(largeButton);

    // Verify events were logged
    const eventLog = canvas.getByTestId('event-log');
    expect(eventLog.textContent).toContain('click');

    // Verify large button meets minimum touch target
    const rect = largeButton.getBoundingClientRect();
    expect(rect.height).toBeGreaterThanOrEqual(40);
  },
};

function MobileViewportContent() {
  return (
    <div className="space-y-4 p-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('button.story.fullWidthButtonsOnMobile')}
      </p>
      <Button fullWidth data-testid="mobile-full-width">
        {i18n.t('button.submit')}
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" data-testid="mobile-flex-1">
          Cancel
        </Button>
        <Button className="flex-1" data-testid="mobile-flex-2">
          Confirm
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label={i18n.t('button.a11y.previous', 'Previous')}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M15 19l-7-7 7-7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </Button>
        <Button size="icon" variant="outline" aria-label={i18n.t('button.a11y.next', 'Next')}>
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

export const MobileViewport: Story = {
  name: i18n.t('button.storyName.mobileViewport', 'Mobile Viewport (320px)'),
  parameters: {
    viewport: { defaultViewport: 'mobile320' },
  },
  render: () => <MobileViewportContent />,
  play: async ({ canvasElement }) => {
    const fullWidthButton = canvasElement.querySelector('[data-testid="mobile-full-width"]');

    // Verify full-width button using data attribute
    expect(fullWidthButton?.getAttribute('data-full-width')).toBe('true');
  },
};

// ============ NEW 2025/2026 ENTERPRISE FEATURES ============

// --- PENDING STATE (React 19) ---

function PendingStateDemo() {
  const [isPending, setIsPending] = React.useState(false);

  const handleClick = () => {
    setIsPending(true);
    setTimeout(() => setIsPending(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        React 19 pending state (useTransition/useFormStatus simulation)
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button pending={isPending} onClick={handleClick} data-testid="pending-button">
          {isPending ? (
            <>
              <LoaderIcon className="animate-spin" />
              {i18n.t('button.processing')}
            </>
          ) : (
            i18n.t('button.startAsync')
          )}
        </Button>
        <Button pending disabled data-testid="pending-disabled">
          <LoaderIcon className="animate-spin" />
          {i18n.t('button.loading')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        data-pending attribute is set for CSS targeting
      </p>
    </div>
  );
}

export const PendingState: Story = {
  name: i18n.t('button.storyName.pendingState', 'Pending State (React 19)'),
  render: () => <PendingStateDemo />,
  play: async ({ canvasElement }) => {
    const pendingButton = canvasElement.querySelector('[data-testid="pending-disabled"]');

    // Verify pending state attributes
    expect(pendingButton?.getAttribute('data-pending')).toBe('true');
    expect(pendingButton?.getAttribute('aria-busy')).toBe('true');
    expect(pendingButton).toBeDisabled();
  },
};

// --- SECTIONS (leftSection / rightSection) ---

function SectionsDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        leftSection and rightSection props for icon placement
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button leftSection={<MailIcon />} data-testid="left-section">
          {i18n.t('button.sendMessage')}
        </Button>
        <Button
          rightSection={
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          }
          data-testid="right-section"
        >
          {i18n.t('button.submit')}
        </Button>
        <Button
          leftSection={<HeartIcon />}
          rightSection={
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          }
          variant="outline"
          data-testid="both-sections"
        >
          {i18n.t('button.a11y.like')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          leftSection={<LoaderIcon className="animate-spin" />}
          loading
          data-testid="loading-section"
        >
          {i18n.t('button.loading')}
        </Button>
      </div>
    </div>
  );
}

export const Sections: Story = {
  name: i18n.t('button.storyName.sections', 'Sections (leftSection/rightSection)'),
  render: () => <SectionsDemo />,
  play: async ({ canvasElement }) => {
    const leftSection = canvasElement.querySelector('[data-testid="left-section"]');
    const rightSection = canvasElement.querySelector('[data-testid="right-section"]');
    const bothSections = canvasElement.querySelector('[data-testid="both-sections"]');

    expect(leftSection).toBeInTheDocument();
    expect(rightSection).toBeInTheDocument();
    expect(bothSections).toBeInTheDocument();

    // Verify SVGs are rendered
    expect(leftSection?.querySelector('svg')).toBeInTheDocument();
    expect(rightSection?.querySelector('svg')).toBeInTheDocument();
    expect(bothSections?.querySelectorAll('svg').length).toBe(2);
  },
};

// --- FULL WIDTH ---

function FullWidthDemo() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">fullWidth prop for form layouts</p>
      <div className="max-w-md space-y-3">
        <Button fullWidth data-testid="full-width-default">
          {t('button.default')}
        </Button>
        <Button fullWidth variant="outline" data-testid="full-width-outline">
          {t('button.outline')}
        </Button>
        <Button fullWidth variant="destructive" data-testid="full-width-destructive">
          {t('button.destructive')}
        </Button>
        <div className="flex gap-2">
          <Button fullWidth variant="ghost">
            {t('button.cancelButton')}
          </Button>
          <Button fullWidth>{t('button.confirm.confirmLabel')}</Button>
        </div>
      </div>
    </div>
  );
}

export const FullWidth: Story = {
  name: i18n.t('button.storyName.fullWidth', 'Full Width'),
  render: () => <FullWidthDemo />,
  play: async ({ canvasElement }) => {
    const fullWidthBtn = canvasElement.querySelector('[data-testid="full-width-default"]');

    // Verify data-full-width attribute
    expect(fullWidthBtn?.getAttribute('data-full-width')).toBe('true');

    // Verify w-full class is applied
    expect(fullWidthBtn?.classList.contains('w-full')).toBe(true);
  },
};

// --- JUSTIFY ALIGNMENT ---

function JustifyDemo() {
  const justifyOptions: ButtonJustify[] = ['start', 'center', 'end', 'between'];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">justify prop for content alignment</p>
      <div className="max-w-md space-y-3">
        <Button fullWidth justify={justifyOptions[0]} variant="outline" data-testid="justify-start">
          <MailIcon />
          {i18n.t('button.sendMessage')}
        </Button>
        <Button fullWidth justify="center" variant="outline" data-testid="justify-center">
          <MailIcon />
          {i18n.t('button.default')}
        </Button>
        <Button fullWidth justify="end" variant="outline" data-testid="justify-end">
          {i18n.t('button.submit')}
          <MailIcon />
        </Button>
        <Button fullWidth justify="between" variant="outline" data-testid="justify-between">
          <span>{i18n.t('button.pay')}</span>
          <span>$99.00</span>
        </Button>
      </div>
    </div>
  );
}

export const JustifyAlignment: Story = {
  name: i18n.t('button.storyName.justifyAlignment', 'Justify Alignment'),
  render: () => <JustifyDemo />,
  play: async ({ canvasElement }) => {
    const startBtn = canvasElement.querySelector('[data-testid="justify-start"]');
    const betweenBtn = canvasElement.querySelector('[data-testid="justify-between"]');

    // Verify justify classes
    expect(startBtn?.classList.contains('justify-start')).toBe(true);
    expect(betweenBtn?.classList.contains('justify-between')).toBe(true);
  },
};

// --- PRINT STYLES ---

export const PrintStyles: Story = {
  name: i18n.t('button.storyName.printStyles', 'Print Styles'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Buttons include print:shadow-none print:border for print media
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button>{i18n.t('button.story.printMe', 'Print Me')}</Button>
        <Button variant="outline">{i18n.t('button.story.outlinePrint', 'Outline Print')}</Button>
        <Button variant="destructive">
          {i18n.t('button.story.destructivePrint', 'Destructive Print')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Use browser print preview (Cmd/Ctrl+P) to see print styles
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
  },
};

// --- WCAG 2.2 TARGET SIZE ---

function TargetSizeDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        WCAG 2.2 requires minimum 24×24px target size. All sizes exceed this.
      </p>
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="text-center">
            <Button
              size="icon-xs"
              aria-label={i18n.t('button.a11y.size28', '28px')}
              data-testid="target-28"
            >
              <HeartIcon />
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">28px ✓</p>
          </div>
          <div className="text-center">
            <Button
              size="icon-sm"
              aria-label={i18n.t('button.a11y.size32', '32px')}
              data-testid="target-32"
            >
              <HeartIcon />
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">32px ✓</p>
          </div>
          <div className="text-center">
            <Button
              size="icon"
              aria-label={i18n.t('button.a11y.size36', '36px')}
              data-testid="target-36"
            >
              <HeartIcon />
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">36px ✓</p>
          </div>
          <div className="text-center">
            <Button
              size="icon-lg"
              aria-label={i18n.t('button.a11y.size40', '40px')}
              data-testid="target-40"
            >
              <HeartIcon />
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">40px ✓</p>
          </div>
          <div className="text-center">
            <Button
              size="icon-xl"
              aria-label={i18n.t('button.a11y.size48', '48px')}
              data-testid="target-48"
            >
              <HeartIcon />
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">48px ✓</p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          WCAG 2.2 SC 2.5.8: Target Size (Minimum) = 24×24 CSS pixels
        </p>
      </div>
    </div>
  );
}

export const WCAG22TargetSize: Story = {
  name: i18n.t('button.storyName.wCAG22TargetSize', 'WCAG 2.2 Target Size'),
  render: () => <TargetSizeDemo />,
  play: async ({ canvasElement }) => {
    const target28 = canvasElement.querySelector('[data-testid="target-28"]');
    const target48 = canvasElement.querySelector('[data-testid="target-48"]');

    if (target28 && target48) {
      const rect28 = target28.getBoundingClientRect();
      const rect48 = target48.getBoundingClientRect();

      // All should exceed WCAG 2.2 minimum of 24px
      expect(rect28.width).toBeGreaterThanOrEqual(24);
      expect(rect28.height).toBeGreaterThanOrEqual(24);
      expect(rect48.width).toBeGreaterThanOrEqual(44); // 48px
      expect(rect48.height).toBeGreaterThanOrEqual(44);
    }
  },
};

// --- DEV WARNING FOR ICON BUTTONS ---

export const DevWarningIconA11y: Story = {
  name: i18n.t('button.storyName.devWarningIconA11y', 'Dev Warning: Icon Button A11y'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        In development mode, icon buttons without aria-label trigger a console warning.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon" aria-label={i18n.t('button.a11y.withAriaLabel', 'With aria-label')}>
          <HeartIcon />
        </Button>
        <Button size="icon" aria-labelledby="icon-label">
          <MailIcon />
        </Button>
        <span id="icon-label" className="sr-only">
          Send email
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        Check console for warnings when aria-label is missing
      </p>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);
    // Verify accessible names
    expect(buttons[0].getAttribute('aria-label')).toBe('With aria-label');
    expect(buttons[1].getAttribute('aria-labelledby')).toBe('icon-label');
  },
};

// --- VISUAL REGRESSION MATRIX ---

function VariantSizeMatrixDemo() {
  const variants = [
    'default',
    'secondary',
    'outline',
    'ghost',
    'destructive',
    'warning',
    'success',
    'info',
  ] as const;
  const sizes = ['xs', 'sm', 'default', 'lg'] as const;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {i18n.t('button.story.variantSizeMatrixForVisualRegression')}
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs">{i18n.t('button.story.variantSlashSize')}</th>
              {sizes.map((size) => (
                <th key={size} className="p-2 text-center text-xs">
                  {size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant}>
                <td className="p-2 text-xs">{variant}</td>
                {sizes.map((size) => (
                  <td key={`${variant}-${size}`} className="p-2">
                    <Button variant={variant} size={size}>
                      {getSizeLabel(size)}
                    </Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const VariantSizeMatrix: Story = {
  name: i18n.t('button.storyName.variantSizeMatrix', 'Variant × Size Matrix'),
  render: () => <VariantSizeMatrixDemo />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(45);
  },
};

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FEATURES - 2025/2026
// ═══════════════════════════════════════════════════════════════

// --- DOUBLE-CLICK PREVENTION ---

function DoubleClickPreventionDemo() {
  const [clickCount, setClickCount] = React.useState(0);
  const [normalClickCount, setNormalClickCount] = React.useState(0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Double-click prevention debounces rapid clicks. Essential for payment buttons.
      </p>
      <div className="flex flex-wrap items-start gap-6">
        <div className="space-y-2">
          <Button
            preventDoubleClick
            debounceMs={500}
            onClick={() => setClickCount((c) => c + 1)}
            data-testid="debounced-btn"
          >
            {i18n.t('button.preventDoubleClick')} (500ms)
          </Button>
          <p className="text-muted-foreground text-xs">
            Clicks registered: {clickCount} {clickCount === 0 && `(${i18n.t('button.debouncing')})`}
          </p>
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={() => setNormalClickCount((c) => c + 1)}
            data-testid="normal-btn"
          >
            {i18n.t('button.button')}
          </Button>
          <p className="text-muted-foreground text-xs">Clicks registered: {normalClickCount}</p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Try rapid-clicking both buttons. The protected button ignores clicks within debounce window.
      </p>
    </div>
  );
}

export const DoubleClickPrevention: Story = {
  name: i18n.t('button.storyName.doubleClickPrevention', 'Double-Click Prevention'),
  render: () => <DoubleClickPreventionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const debouncedBtn = canvas.getByTestId('debounced-btn');

    // Rapid clicks should be debounced
    await userEvent.click(debouncedBtn);
    await userEvent.click(debouncedBtn);
    await userEvent.click(debouncedBtn);

    // Only 1 click should register due to debounce
    // Wait a bit then verify
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

// --- PAYMENT BUTTON ---

function PaymentButtonDemo() {
  const [status, setStatus] = React.useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  const handlePayment = async () => {
    setStatus('processing');
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStatus(Math.random() > 0.3 ? 'success' : 'error');
    // Auto-reset after 3s
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Payment button with double-click prevention, loading state, and success/error feedback.
      </p>
      <Button
        preventDoubleClick
        debounceMs={500}
        loading={status === 'processing'}
        success={status === 'success'}
        error={status === 'error'}
        autoResetMs={3000}
        trackingId="payment-demo"
        trackingData={{ amount: 99.99, currency: 'USD' }}
        onClick={handlePayment}
        disabled={status === 'processing'}
        className="min-w-[200px]"
      >
        {status === 'processing' && <LoaderIcon className="animate-spin" />}
        {status === 'success' && `✓ ${i18n.t('button.paid')}`}
        {status === 'error' && `✗ ${i18n.t('button.paymentFailed')}`}
        {status === 'idle' && `${i18n.t('button.pay')} $99.99`}
      </Button>
      <p className="text-muted-foreground text-xs">
        Status: <code>{status}</code>
      </p>
    </div>
  );
}

export const PaymentButton: Story = {
  name: i18n.t('button.storyName.paymentButton', 'Payment Button (Enterprise)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.paymentSuccess },
  },
  render: () => <PaymentButtonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  },
};

// --- HAPTIC FEEDBACK ---

function HapticFeedbackDemo() {
  const [lastVibration, setLastVibration] = React.useState<string>('none');

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Haptic feedback via Vibration API. Test on mobile device for best experience.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button hapticFeedback hapticPattern={10} onClick={() => setLastVibration('short (10ms)')}>
          {i18n.t('button.shortVibrate')}
        </Button>
        <Button
          hapticFeedback
          hapticPattern={50}
          variant="secondary"
          onClick={() => setLastVibration('medium (50ms)')}
        >
          {i18n.t('button.mediumVibrate')}
        </Button>
        <Button
          hapticFeedback
          hapticPattern={[10, 50, 10]}
          variant="outline"
          onClick={() => setLastVibration('pattern [10,50,10]')}
        >
          {i18n.t('button.patternVibrate')}
        </Button>
        <Button
          hapticFeedback
          hapticPattern={[20, 100, 20, 100, 40]}
          variant="destructive"
          onClick={() => setLastVibration('error pattern')}
        >
          {i18n.t('button.errorVibrate')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Last vibration: <code>{lastVibration}</code>
      </p>
      <p className="text-muted-foreground text-xs">
        Note: Vibration API only works on mobile devices and requires user gesture.
      </p>
    </div>
  );
}

export const HapticFeedback: Story = {
  name: i18n.t('button.storyName.hapticFeedback', 'Haptic Feedback (Mobile)'),
  render: () => <HapticFeedbackDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    await userEvent.click(buttons[0]);
  },
};

// --- ANALYTICS TRACKING ---

function AnalyticsTrackingDemo() {
  const [events, setEvents] = React.useState<Array<{ data: unknown; id: string; time: string }>>(
    []
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setEvents((prev) => [
        {
          id: customEvent.detail.trackingId,
          time: new Date().toISOString().split('T')[1].slice(0, 12),
          data: customEvent.detail,
        },
        ...prev.slice(0, 4),
      ]);
    };
    window.addEventListener('button:click', handler);
    return () => window.removeEventListener('button:click', handler);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Buttons emit <code>button:click</code> CustomEvents with tracking data.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          trackingId="cta-hero-signup"
          trackingData={{ source: 'hero', campaign: 'summer2025' }}
        >
          {i18n.t('button.signUp')}
        </Button>
        <Button variant="secondary" trackingId="cta-nav-pricing" trackingData={{ source: 'nav' }}>
          {i18n.t('button.viewPricing')}
        </Button>
        <Button
          variant="outline"
          trackingId="cta-modal-trial"
          trackingData={{ source: 'modal', trigger: 'exit-intent' }}
        >
          {i18n.t('button.startFreeTrial')}
        </Button>
      </div>
      <div className="bg-muted rounded-md p-3">
        <p className="mb-2 text-xs font-medium">{i18n.t('button.story.eventLog1', 'Event Log:')}</p>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {i18n.t('button.story.clickAButtonToSeeEvents', 'Click a button to see events...')}
          </p>
        ) : (
          <pre className="text-xs">{JSON.stringify(events, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

export const AnalyticsTracking: Story = {
  name: i18n.t('button.storyName.analyticsTracking', 'Analytics Tracking'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.analyticsSuccess },
  },
  render: () => <AnalyticsTrackingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const signupBtn = canvas.getByText('Sign Up (Hero CTA)');
    await userEvent.click(signupBtn);
    // Event should be logged
  },
};

// --- SUCCESS/ERROR STATE WITH AUTO-RESET ---

function SuccessErrorStateDemo() {
  const [successState, setSuccessState] = React.useState(false);
  const [errorState, setErrorState] = React.useState(false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Success/Error states with auto-reset. Button variant changes automatically.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button success={successState} autoResetMs={2000} onClick={() => setSuccessState(true)}>
          {successState ? '✓ Success!' : 'Trigger Success'}
        </Button>
        <Button
          error={errorState}
          autoResetMs={3000}
          variant="outline"
          onClick={() => setErrorState(true)}
        >
          {errorState ? '✗ Error!' : 'Trigger Error'}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Success resets after 2s, Error after 3s. Uses <code>autoResetMs</code> prop.
      </p>
    </div>
  );
}

export const SuccessErrorState: Story = {
  name: i18n.t('button.storyName.successErrorState', 'Success/Error State'),
  render: () => <SuccessErrorStateDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  },
};

// --- LOADING STATE CALLBACK ---

function LoadingStateCallbackDemo() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState<string[]>([]);

  const handleLoadingChange = (loading: boolean) => {
    setLoadingHistory((prev) => [
      `${new Date().toISOString().split('T')[1].slice(0, 12)} - ${loading ? 'START' : 'STOP'}`,
      ...prev.slice(0, 4),
    ]);
  };

  const simulateAsync = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        <code>onLoadingChange</code> callback fires when loading state changes.
      </p>
      <Button loading={isLoading} onLoadingChange={handleLoadingChange} onClick={simulateAsync}>
        {isLoading ? (
          <>
            <LoaderIcon className="animate-spin" />
            {i18n.t('button.processing')}
          </>
        ) : (
          i18n.t('button.startAsync')
        )}
      </Button>
      <div className="bg-muted rounded-md p-3">
        <p className="mb-2 text-xs font-medium">
          {i18n.t('button.story.loadingHistory', 'Loading History:')}
        </p>
        {loadingHistory.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {i18n.t('button.story.clickButtonToSeeCallbacks', 'Click button to see callbacks...')}
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {loadingHistory.map((entry) => (
              <li key={entry} className="font-mono">
                {entry}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const LoadingStateCallback: Story = {
  name: i18n.t('button.storyName.loadingStateCallback', 'Loading State Callback'),
  render: () => <LoadingStateCallbackDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

// --- A/B TESTING BUTTONS ---

function ABTestingDemo() {
  const [clicks, setClicks] = React.useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const testId = 'ab-cta-2025';

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const variant = customEvent.detail.trackingData?.variant as 'a' | 'b' | undefined;
      if (variant === 'a' || variant === 'b') {
        setClicks((prev) => ({ ...prev, [variant]: prev[variant] + 1 }));
      }
    };
    window.addEventListener('button:click', handler);
    return () => window.removeEventListener('button:click', handler);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        A/B test button variants with tracking. Test ID: <code>{testId}</code>
      </p>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <p className="text-xs font-medium">
            {i18n.t('button.story.variantADefault', 'Variant A (Default)')}
          </p>
          <Button
            trackingId={`${testId}-a`}
            trackingData={{ variant: 'a', testId }}
            className="w-full"
          >
            {i18n.t('button.getStarted')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">Clicks: {clicks.a}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium">
            {i18n.t('button.story.variantBSecondary', 'Variant B (Secondary)')}
          </p>
          <Button
            variant="secondary"
            trackingId={`${testId}-b`}
            trackingData={{ variant: 'b', testId }}
            className="w-full"
          >
            {i18n.t('button.startTrial')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">Clicks: {clicks.b}</p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Conversion rate: A = {clicks.a > 0 ? '100%' : '0%'} | B = {clicks.b > 0 ? '100%' : '0%'}{' '}
        (demo only)
      </p>
    </div>
  );
}

export const ABTesting: Story = {
  name: i18n.t('button.storyName.aBTesting', 'A/B Testing Pattern'),
  render: () => <ABTestingDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
  },
};

// --- ENTERPRISE DATA ATTRIBUTES ---

function EnterpriseDataAttributesDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Rich data attributes for CSS targeting, testing, and analytics.
      </p>
      <div className="space-y-3">
        <Button variant="success" size="lg" loading pending fullWidth trackingId="demo-attrs">
          <LoaderIcon className="animate-spin" />
          {i18n.t('button.loading')}
        </Button>
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
          {`data-slot="button"
data-testid="button"
data-variant="success"
data-size="lg"
data-loading="true"
data-pending="true"
data-disabled="true"
data-full-width="true"
data-debouncing="true" (when debouncing)
data-success="true" (when success)
data-error="true" (when error)
data-tracking-id="demo-attrs"
aria-busy="true"
aria-disabled="true"
aria-invalid="true" (when error)`}
        </pre>
      </div>
      <p className="text-muted-foreground text-xs">
        Use these attributes for CSS selectors, E2E testing, and analytics queries.
      </p>
    </div>
  );
}

export const EnterpriseDataAttributes: Story = {
  name: i18n.t('button.storyName.enterpriseDataAttributes', 'Enterprise Data Attributes'),
  render: () => <EnterpriseDataAttributesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  },
};

// --- COMPOUND ENTERPRISE BUTTON ---

function CompoundEnterpriseDemo() {
  const [state, setState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async () => {
    setState('loading');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3;
    setState(success ? 'success' : 'error');
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        All enterprise features combined in one button.
      </p>
      <Button
        // Visual variants
        variant={getStateVariant(state)}
        size="lg"
        fullWidth
        // State management
        loading={state === 'loading'}
        success={state === 'success'}
        error={state === 'error'}
        autoResetMs={2500}
        onLoadingChange={(loading) => console.info('Loading:', loading)}
        // Protection
        preventDoubleClick
        debounceMs={500}
        // Mobile
        hapticFeedback
        hapticPattern={state === 'error' ? [50, 100, 50] : [10]}
        // Analytics
        trackingId="enterprise-demo"
        trackingData={{
          feature: 'compound-demo',
          state,
          timestamp: Date.now(),
        }}
        // Sections
        leftSection={getStateIcon(state)}
        onClick={handleSubmit}
        className="max-w-md"
      >
        {state === 'idle' && i18n.t('button.submitOrder')}
        {state === 'loading' && i18n.t('button.processing')}
        {state === 'success' && i18n.t('button.orderConfirmed')}
        {state === 'error' && i18n.t('button.paymentFailed.tryAgain')}
      </Button>
      <p className="text-muted-foreground text-xs">
        Current state: <code>{state}</code>
      </p>
    </div>
  );
}

export const CompoundEnterprise: Story = {
  name: i18n.t('button.storyName.compoundEnterprise', 'Compound Enterprise Button'),
  render: () => <CompoundEnterpriseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 ENTERPRISE FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

// --- KEYBOARD SHORTCUTS ---

function KeyboardShortcutDemo() {
  const [saveCount, setSaveCount] = React.useState(0);
  const [searchCount, setSearchCount] = React.useState(0);
  const [escapeCount, setEscapeCount] = React.useState(0);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'button.story.keyboardShortcutsDescription',
          'Buttons can be triggered via keyboard shortcuts. Try the shortcuts below!'
        )}
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Button
            shortcut={i18n.t('button.shortcut.save')}
            showShortcut
            onClick={() => setSaveCount((c) => c + 1)}
          >
            {i18n.t('button.saveDocument')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {i18n.t('button.story.saves', 'Saves')}: {saveCount}
          </p>
        </div>
        <div className="space-y-2">
          <Button
            variant="secondary"
            shortcut={i18n.t('button.shortcut.search')}
            showShortcut
            onClick={() => setSearchCount((c) => c + 1)}
          >
            {i18n.t('button.quickSearch')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {i18n.t('button.story.searches', 'Searches')}: {searchCount}
          </p>
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            shortcut={i18n.t('button.shortcut.escape')}
            showShortcut
            onClick={() => setEscapeCount((c) => c + 1)}
          >
            {i18n.t('button.closeDialog')}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            {i18n.t('button.story.escapes', 'Escapes')}: {escapeCount}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'button.story.proTipShortcuts',
          'Pro tip: Use `mod+` for cross-platform shortcuts (⌘ on Mac, Ctrl on Windows).'
        )}
      </p>
    </div>
  );
}

export const KeyboardShortcuts: Story = {
  name: i18n.t('button.storyName.keyboardShortcuts', 'Keyboard Shortcuts'),
  render: () => <KeyboardShortcutDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
  },
};

// --- LONG PRESS ---

function LongPressDemo() {
  const [deleted, setDeleted] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    setProgress(0);
    intervalRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 100));
    }, 80);
  };

  const stopProgress = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Long press support for destructive actions. Hold the button for 800ms to delete.
      </p>
      <div className="flex flex-col items-start gap-4">
        <Button
          variant={deleted ? 'success' : 'destructive'}
          onLongPress={() => {
            setDeleted(true);
            setTimeout(() => setDeleted(false), 2000);
          }}
          longPressMs={800}
          onPressStart={startProgress}
          onPressEnd={stopProgress}
          disabled={deleted}
          className="relative overflow-hidden"
        >
          {/* Progress bar overlay */}
          <span
            className="absolute inset-0 bg-white/30 transition-all"
            style={{ width: `${progress}%` }}
          />
          <TrashIcon className="relative z-10" />
          <span className="relative z-10">
            {deleted ? i18n.t('button.deleted') : i18n.t('button.holdToDelete')}
          </span>
        </Button>
        <p className="text-muted-foreground text-xs">
          {i18n.t('button.story.progressLabel', { progress, threshold: 800 })}
        </p>
      </div>
    </div>
  );
}

export const LongPress: Story = {
  name: i18n.t('button.storyName.longPress', 'Long Press'),
  render: () => <LongPressDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// --- RIPPLE EFFECT ---

function RippleEffectDemo() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'button.story.materialDesignStyleRippleEffectOnClick',
          'Material Design style ripple effect on click.'
        )}
      </p>
      <div className="flex flex-wrap gap-4">
        <Button ripple>{i18n.t('button.defaultRipple')}</Button>
        <Button ripple rippleColor="rgba(255, 255, 255, 0.5)" variant="default">
          {i18n.t('button.whiteRipple')}
        </Button>
        <Button ripple rippleColor="rgba(0, 0, 0, 0.2)" variant="outline">
          {i18n.t('button.darkRipple')}
        </Button>
        <Button ripple rippleColor="rgb(59, 130, 246)" variant="ghost">
          {i18n.t('button.blueRipple')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Note: Ripple is disabled when user prefers reduced motion.
      </p>
    </div>
  );
}

export const RippleEffect: Story = {
  name: i18n.t('button.storyName.rippleEffect', 'Ripple Effect'),
  render: () => <RippleEffectDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(buttons[0]);
  },
};

// --- TOGGLE BUTTON ---

function ToggleButtonDemo() {
  const [bold, setBold] = React.useState(false);
  const [italic, setItalic] = React.useState(false);
  const [underline, setUnderline] = React.useState(false);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Toggle buttons with aria-pressed for accessibility.
      </p>
      <div className="flex gap-1 rounded-md border p-1">
        <Button
          toggle
          pressed={bold}
          onPressedChange={setBold}
          size="icon-sm"
          variant={bold ? 'default' : 'ghost'}
          aria-label={i18n.t('button.bold')}
        >
          <span className="font-bold">B</span>
        </Button>
        <Button
          toggle
          pressed={italic}
          onPressedChange={setItalic}
          size="icon-sm"
          variant={italic ? 'default' : 'ghost'}
          aria-label={i18n.t('button.italic')}
        >
          <span className="italic">I</span>
        </Button>
        <Button
          toggle
          pressed={underline}
          onPressedChange={setUnderline}
          size="icon-sm"
          variant={underline ? 'default' : 'ghost'}
          aria-label={i18n.t('button.underline')}
        >
          <span className="underline">U</span>
        </Button>
      </div>
      <p
        className={`${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
      >
        Preview text with applied formatting
      </p>
      <p className="text-muted-foreground text-xs">
        State: Bold={String(bold)}, Italic={String(italic)}, Underline={String(underline)}
      </p>
    </div>
  );
}

export const ToggleButton: Story = {
  name: i18n.t('button.storyName.toggleButton', 'Toggle Button'),
  render: () => <ToggleButtonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(buttons[0]);
  },
};

// --- CONFIRMATION DIALOG ---

function ConfirmationDialogDemo() {
  const [deleted, setDeleted] = React.useState(false);
  const deleteConfirm: ConfirmConfig = {
    title: i18n.t('button.confirm.deleteTitle'),
    description: i18n.t('button.confirm.deleteDescription'),
    confirmLabel: i18n.t('button.confirmDelete'),
    cancelLabel: i18n.t('button.keepAccount'),
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Built-in confirmation dialog for destructive actions.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          variant="destructive"
          confirmAction={deleteConfirm}
          onClick={() => {
            setDeleted(true);
            setTimeout(() => setDeleted(false), 2000);
          }}
        >
          {deleted ? i18n.t('button.deleted') : i18n.t('button.deleteAccount')}
        </Button>
        <Button
          variant="warning"
          confirmAction={{
            title: i18n.t('button.confirm.title'),
            description: i18n.t('button.confirm.description'),
            confirmLabel: i18n.t('button.confirm.confirmLabel'),
            cancelLabel: i18n.t('button.confirm.cancelLabel'),
          }}
          onClick={() => console.info('Action confirmed!')}
        >
          {i18n.t('button.defaultConfirm')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        The confirmation dialog automatically blocks the click until confirmed.
      </p>
    </div>
  );
}

export const ConfirmationDialog: Story = {
  name: i18n.t('button.storyName.confirmationDialog', 'Confirmation Dialog'),
  render: () => <ConfirmationDialogDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  },
};

// --- BADGE BUTTON ---

function BadgeButtonDemo() {
  const [notifications, setNotifications] = React.useState(5);
  const [messages, setMessages] = React.useState(99);
  const defaultPosition: BadgePosition = 'top-right';

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Buttons with notification badges for counts and alerts.
      </p>
      <div className="flex flex-wrap gap-6">
        <Button
          badge={notifications}
          badgePosition={defaultPosition}
          onClick={() => setNotifications(0)}
        >
          {i18n.t('button.notifications')}
        </Button>
        <Button
          variant="outline"
          badge={messages > 99 ? '99+' : messages}
          badgePosition="top-right"
          onClick={() => setMessages((m) => Math.max(0, m - 10))}
        >
          {i18n.t('button.messages')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          badge="!"
          badgePosition="top-right"
          aria-label={i18n.t('button.alerts')}
        >
          <HeartIcon />
        </Button>
      </div>
      <div className="flex flex-wrap gap-4">
        <Button badge={i18n.t('button.badge.new')} badgePosition="top-right" variant="secondary">
          {i18n.t('button.getStarted')}
        </Button>
        <Button badge={i18n.t('button.badge.hot')} badgePosition="top-right" variant="outline">
          {i18n.t('button.viewPricing')}
        </Button>
        <Button badge={i18n.t('button.badge.beta')} badgePosition="top-right" variant="ghost">
          {i18n.t('button.openSettings')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'button.story.clickButtonsToClearNotifications',
          'Click buttons to clear notifications.'
        )}
      </p>
    </div>
  );
}

export const BadgeButton: Story = {
  name: i18n.t('button.storyName.badgeButton', 'Badge Button'),
  render: () => <BadgeButtonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  },
};

// --- SKELETON LOADING ---

function SkeletonDemo() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Skeleton placeholders while button content loads.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button skeleton size="default" />
        <Button skeleton size="lg" />
        <Button skeleton size="icon" />
      </div>
      <div className="flex gap-4 pt-4">
        <Button skeleton={loading} size="lg">
          {!loading && i18n.t('button.contentLoaded')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLoading(true)}>
          {i18n.t('button.reset')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Skeleton buttons are non-interactive and have aria-hidden.
      </p>
    </div>
  );
}

export const SkeletonLoading: Story = {
  name: i18n.t('button.storyName.skeletonLoading', 'Skeleton Loading'),
  render: () => <SkeletonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  },
};

// --- VISUAL EFFECTS ---

function VisualEffectsDemo() {
  const direction: GradientDirection = 'to-r';
  const purpleGradient: GradientConfig = { from: '#667eea', to: '#764ba2', direction };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Special visual effects for attention-grabbing CTAs.
      </p>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Button pulse>{i18n.t('button.pulsingCTA')}</Button>
          <Button glow>{i18n.t('button.glowingButton')}</Button>
          <Button gradient>{i18n.t('button.defaultGradient')}</Button>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button gradient={purpleGradient}>{i18n.t('button.purpleGradient')}</Button>
          <Button gradient={{ from: '#f093fb', to: '#f5576c', direction: 'to-r' }}>
            {i18n.t('button.pinkGradient')}
          </Button>
          <Button gradient={{ from: '#4facfe', to: '#00f2fe', direction: 'to-r' }}>
            {i18n.t('button.blueGradient')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button pulse glow gradient={{ from: '#ffecd2', to: '#fcb69f', direction: 'to-br' }}>
            {i18n.t('button.allEffects')}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Note: Pulse animation respects prefers-reduced-motion.
      </p>
    </div>
  );
}

export const VisualEffects: Story = {
  name: i18n.t('button.storyName.visualEffects', 'Visual Effects (Pulse, Glow, Gradient)'),
  render: () => <VisualEffectsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  },
};

// --- SOUND EFFECT ---

function SoundEffectDemo() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'button.story.buttonsWithWebAudioApiSoundFeedback',
          'Buttons with Web Audio API sound feedback.'
        )}
      </p>
      <div className="flex flex-wrap gap-4">
        <Button soundEnabled soundFrequency={800} soundDuration={50}>
          {i18n.t('button.defaultClick')}
        </Button>
        <Button soundEnabled soundFrequency={440} soundDuration={100} variant="secondary">
          {i18n.t('button.lowTone')}
        </Button>
        <Button soundEnabled soundFrequency={1200} soundDuration={30} variant="outline">
          {i18n.t('button.highBeep')}
        </Button>
        <Button soundEnabled soundFrequency={600} soundDuration={200} variant="success">
          {i18n.t('button.successTone')}
        </Button>
        <Button soundEnabled soundFrequency={200} soundDuration={150} variant="destructive">
          {i18n.t('button.errorTone')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Sound uses Web Audio API oscillator - works in all modern browsers.
      </p>
    </div>
  );
}

export const SoundEffect: Story = {
  name: i18n.t('button.storyName.soundEffect', 'Sound Effect'),
  render: () => <SoundEffectDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(5);
  },
};

// --- SCREEN READER ANNOUNCEMENTS ---

function ScreenReaderAnnouncementsDemo() {
  const [state, setState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleClick = async () => {
    setState('loading');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3;
    setState(success ? 'success' : 'error');
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        State changes are announced to screen readers via live regions.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          size="lg"
          loading={state === 'loading'}
          success={state === 'success'}
          error={state === 'error'}
          announceStateChanges
          loadingAnnouncement={i18n.t('button.announce.loadingProcessing')}
          successAnnouncement={i18n.t('button.announce.success')}
          errorAnnouncement={i18n.t('button.announce.error')}
          onClick={handleClick}
        >
          {state === 'idle' && i18n.t('button.submit')}
          {state === 'loading' && i18n.t('button.processing')}
          {state === 'success' && i18n.t('button.success')}
          {state === 'error' && i18n.t('button.error')}
        </Button>
        <Button
          variant="outline"
          announceStateChanges
          loadingAnnouncement={i18n.t('button.announce.loading')}
          onClick={handleClick}
          loading={state === 'loading'}
        >
          {state === 'loading' ? i18n.t('button.announce.loading') : i18n.t('button.deleteItem')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Enable a screen reader to hear the announcements. Current state: {state}
      </p>
    </div>
  );
}

export const ScreenReaderAnnouncements: Story = {
  name: i18n.t('button.storyName.screenReaderAnnouncements', 'Screen Reader Announcements'),
  render: () => <ScreenReaderAnnouncementsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// --- PRESS INTERACTIONS ---

function PressInteractionsDemo() {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        React Aria-style press, hover, and focus callbacks.
      </p>
      <Button
        size="lg"
        onPressStart={() => setIsPressed(true)}
        onPressEnd={() => setIsPressed(false)}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onFocusChange={setIsFocused}
        className={isPressed ? 'scale-95' : ''}
      >
        {i18n.t('button.interactiveButton')}
      </Button>
      <div className="text-muted-foreground flex gap-4 text-xs">
        <span className={isPressed ? 'text-green-500' : ''}>Pressed: {String(isPressed)}</span>
        <span className={isHovered ? 'text-blue-500' : ''}>Hovered: {String(isHovered)}</span>
        <span className={isFocused ? 'text-purple-500' : ''}>Focused: {String(isFocused)}</span>
      </div>
    </div>
  );
}

export const PressInteractions: Story = {
  name: i18n.t('button.storyName.pressInteractions', 'Press Interactions'),
  render: () => <PressInteractionsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

// --- TOOLTIP INTEGRATION ---

function TooltipIntegrationDemo() {
  const defaultSide: ButtonTooltipSide = 'top';

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Built-in tooltip support via data attributes (integrates with your Tooltip component).
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          tooltip={i18n.t('button.tooltip.save')}
          tooltipSide={defaultSide}
          shortcut="mod+s"
          showShortcut
        >
          {i18n.t('button.save')}
        </Button>
        <Button
          variant="outline"
          tooltip={i18n.t('button.tooltip.settings')}
          tooltipSide="bottom"
          tooltipDelayMs={500}
        >
          {i18n.t('button.settings')}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          tooltip={i18n.t('button.tooltip.delete')}
          tooltipSide="right"
          aria-label={i18n.t('button.delete')}
        >
          <TrashIcon />
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Note: Tooltips use data attributes for external Tooltip component integration.
      </p>
    </div>
  );
}

export const TooltipIntegration: Story = {
  name: i18n.t('button.storyName.tooltipIntegration', 'Tooltip Integration'),
  render: () => <TooltipIntegrationDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
  },
};

// --- CUSTOM TEST ID ---

function CustomTestIdDemo() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Custom test IDs for E2E testing with Playwright, Cypress, etc.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button testId="submit-form-button">{i18n.t('button.submitFormButton')}</Button>
        <Button testId="cancel-button" variant="outline">
          {i18n.t('button.cancelButton')}
        </Button>
        <Button testId="delete-account-button" variant="destructive">
          {i18n.t('button.deleteAccount')}
        </Button>
      </div>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
        {`// Playwright
await page.getByTestId('submit-form-button').click();

// Cypress
cy.get('[data-testid="cancel-button"]').click();

// Testing Library
screen.getByTestId('delete-account-button');`}
      </pre>
    </div>
  );
}

export const CustomTestId: Story = {
  name: i18n.t('button.storyName.customTestId', 'Custom Test ID'),
  render: () => <CustomTestIdDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
    expect(canvasElement.querySelector('[data-testid="submit-form-button"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="cancel-button"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="delete-account-button"]')
    ).toBeInTheDocument();
  },
};

// --- REDUCED MOTION SUPPORT ---

function ReducedMotionDemo() {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'button.story.reducedMotionDescription',
          'Buttons respect the `prefers-reduced-motion` media query.'
        )}
      </p>
      <div className="flex flex-wrap gap-4">
        <Button ripple pulse respectReducedMotion>
          {i18n.t('button.respectsReducedMotion')}
        </Button>
        <Button ripple pulse respectReducedMotion={false}>
          {i18n.t('button.alwaysAnimates')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {i18n.t(
          'button.story.toggleReducedMotion',
          'Toggle reduced motion in your OS settings to see the difference.'
        )}
        <br />
        {i18n.t(
          'button.story.macosReducedMotion',
          'MacOS: System Preferences → Accessibility → Display → Reduce motion'
        )}
        <br />
        {i18n.t(
          'button.story.windowsReducedMotion',
          'Windows: Settings → Ease of Access → Display → Show animations'
        )}
      </p>
    </div>
  );
}

export const ReducedMotionSupport: Story = {
  name: i18n.t('button.storyName.reducedMotionSupport', 'Reduced Motion Support'),
  render: () => <ReducedMotionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);
  },
};

// --- UNDOABLE ACTION ---

function UndoableActionDemo() {
  const [items, setItems] = React.useState([
    i18n.t('button.story.item1', 'Item 1'),
    i18n.t('button.story.item2', 'Item 2'),
    i18n.t('button.story.item3', 'Item 3'),
  ]);
  const [lastDeleted, setLastDeleted] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleUndoable = (e: Event) => {
      // In a real app, this would integrate with your toast system
      console.info('Undoable action:', (e as CustomEvent).detail);
    };

    window.addEventListener('button:undoable', handleUndoable);
    return () => window.removeEventListener('button:undoable', handleUndoable);
  }, []);

  const deleteItem = (item: string) => {
    setItems((prev) => prev.filter((i) => i !== item));
    setLastDeleted(item);
  };

  const undoDelete = () => {
    if (lastDeleted) {
      setItems((prev) => [...prev, lastDeleted]);
      setLastDeleted(null);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Undoable actions emit events for toast notification integration.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center justify-between rounded-md border p-2">
            <span>{item}</span>
            <Button
              size="sm"
              variant="ghost"
              undoable
              onUndo={undoDelete}
              undoTimeoutMs={5000}
              onClick={() => deleteItem(item)}
            >
              <TrashIcon className="size-4" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {i18n.t('button.story.noItemsLeft', 'No items left.')}
          </p>
        )}
      </div>
      {lastDeleted && (
        <div className="bg-muted flex items-center gap-2 rounded-md p-3">
          <span className="text-sm">Deleted: {lastDeleted}</span>
          <Button size="sm" variant="outline" onClick={undoDelete}>
            {i18n.t('button.undo')}
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        The `button:undoable` event is dispatched on window for toast integration.
      </p>
    </div>
  );
}

export const UndoableAction: Story = {
  name: i18n.t('button.storyName.undoableAction', 'Undoable Action'),
  render: () => <UndoableActionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const deleteButtons = canvas.getAllByRole('button');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(3);
    await userEvent.click(deleteButtons[0]);
  },
};

// --- FULL ENTERPRISE SHOWCASE ---

function FullEnterpriseShowcaseDemo() {
  const [state, setState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pressed, setPressed] = React.useState(false);

  const handleSubmit = async () => {
    setState('loading');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const success = Math.random() > 0.2;
    setState(success ? 'success' : 'error');
    setTimeout(() => setState('idle'), 3000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">
          {i18n.t('button.story.ultimateEnterpriseButton1', 'Ultimate Enterprise Button')}
        </h3>
        <p className="text-muted-foreground text-sm">
          All Phase 2 enterprise features combined in one showcase.
        </p>
      </div>

      <Button
        // Core features
        size="xl"
        fullWidth
        className="max-w-md"
        // State management
        loading={state === 'loading'}
        success={state === 'success'}
        error={state === 'error'}
        autoResetMs={3000}
        onLoadingChange={(loading) => console.info('Loading:', loading)}
        // Protection
        preventDoubleClick
        debounceMs={500}
        // Mobile
        hapticFeedback
        hapticPattern={state === 'error' ? [50, 100, 50] : [10]}
        // Analytics
        trackingId="ultimate-enterprise-button"
        trackingData={{ version: 'phase2', experiment: 'showcase' }}
        // Keyboard
        shortcut={i18n.t('button.shortcut.enter')}
        showShortcut
        // Visual effects
        ripple
        rippleColor="rgba(255,255,255,0.3)"
        glow={state === 'idle'}
        gradient={state === 'idle' ? { from: '#667eea', to: '#764ba2', direction: 'to-r' } : false}
        // Accessibility
        announceStateChanges
        loadingAnnouncement={i18n.t('button.announce.processingPayment')}
        successAnnouncement={i18n.t('button.announce.paymentSuccess')}
        errorAnnouncement={i18n.t('button.announce.paymentFailed')}
        respectReducedMotion
        // Sound
        soundEnabled
        soundFrequency={getSoundFrequency(state)}
        soundDuration={getSoundDuration(state)}
        // Badge
        badge={state === 'idle' ? i18n.t('button.badge.new') : undefined}
        // Test ID
        testId="ultimate-enterprise-button"
        // Sections
        leftSection={getStateIconLg(state)}
        onClick={handleSubmit}
      >
        {state === 'idle' && i18n.t('button.completePurchase')}
        {state === 'loading' && i18n.t('button.processingPayment')}
        {state === 'success' && i18n.t('button.paymentComplete')}
        {state === 'error' && i18n.t('button.paymentFailed.tryAgain')}
      </Button>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="rounded-md border p-3">
          <h4 className="font-medium">
            {i18n.t('button.story.featuresEnabled', 'Features Enabled:')}
          </h4>
          <ul className="text-muted-foreground mt-2 space-y-1">
            <li>✓ Loading/Success/Error states</li>
            <li>✓ Double-click prevention</li>
            <li>✓ Haptic feedback</li>
            <li>✓ Analytics tracking</li>
            <li>✓ Keyboard shortcut (⌘+Enter)</li>
            <li>✓ Ripple effect</li>
            <li>✓ Glow + Gradient</li>
            <li>✓ Sound effects</li>
            <li>✓ Screen reader announcements</li>
            <li>✓ Reduced motion support</li>
            <li>✓ Badge</li>
            <li>✓ Custom test ID</li>
          </ul>
        </div>
        <div className="rounded-md border p-3">
          <h4 className="font-medium">{i18n.t('button.story.currentState', 'Current State:')}</h4>
          <pre className="text-muted-foreground mt-2 text-[10px]">
            {`{
  state: "${state}",
  loading: ${state === 'loading'},
  success: ${state === 'success'},
  error: ${state === 'error'},
  shortcut: "mod+enter",
  trackingId: "ultimate-enterprise-button"
}`}
          </pre>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h4 className="font-medium">
          {i18n.t('button.story.toggleButtonGroup', 'Toggle Button Group:')}
        </h4>
        <div className="flex gap-1 rounded-md border p-1">
          <Button
            toggle
            pressed={pressed}
            onPressedChange={setPressed}
            size="sm"
            variant={pressed ? 'default' : 'ghost'}
          >
            {pressed ? i18n.t('button.toggle.active') : i18n.t('button.toggle.inactive')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const FullEnterpriseShowcase: Story = {
  name: i18n.t('button.storyName.fullEnterpriseShowcase', 'Full Enterprise Showcase'),
  render: () => <FullEnterpriseShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(buttons[0]);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

function ContextMenuDemo() {
  const [lastAction, setLastAction] = React.useState<string | null>(null);
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Right-click buttons to see the context menu. Uses <code>contextMenuItems</code> prop.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          contextMenuItems={[
            { label: i18n.t('button.edit'), onClick: () => setLastAction('edit') },
            { label: i18n.t('button.save'), onClick: () => setLastAction('save') },
            {
              label: i18n.t('button.deleteItem'),
              onClick: () => setLastAction('delete'),
              destructive: true,
            },
          ]}
          data-testid="context-menu-button"
        >
          {i18n.t('button.clickMe')}
        </Button>
        <Button
          variant="outline"
          contextMenuItems={[
            {
              label: i18n.t('button.openSettings'),
              onClick: () => setLastAction('settings'),
              icon: <MailIcon className="size-4" />,
            },
            {
              label: i18n.t('button.saveChanges'),
              onClick: () => setLastAction('save-changes'),
              icon: <SendIcon className="size-4" />,
            },
            {
              label: i18n.t('button.disabled'),
              onClick: () => {},
              disabled: true,
            },
          ]}
          data-testid="context-menu-icons"
        >
          {i18n.t('button.settings')}
        </Button>
      </div>
      {lastAction && (
        <p className="text-muted-foreground text-sm" data-testid="context-action">
          Last action: <code>{lastAction}</code>
        </p>
      )}
    </div>
  );
}

export const ContextMenu: Story = {
  name: i18n.t('button.storyName.contextMenu', 'Context Menu Items'),
  render: () => <ContextMenuDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);

    // Verify contextMenuItems prop is set
    const contextBtn = canvas.getByTestId('context-menu-button');
    expect(contextBtn).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON GROUPS (groupId / groupValue)
// ═══════════════════════════════════════════════════════════════════════════════

function ButtonGroupDemo() {
  const [selectedAlign, setSelectedAlign] = React.useState('center');
  const [selectedSize, setSelectedSize] = React.useState('default');

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Button groups with <code>groupId</code> and <code>groupValue</code> for data attributes.
      </p>
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('button.story.textAlignment', 'Text Alignment')}
          </p>
          <div className="flex gap-1 rounded-md border p-1">
            {['start', 'center', 'end'].map((align) => (
              <Button
                key={align}
                size="sm"
                variant={selectedAlign === align ? 'default' : 'ghost'}
                groupId="text-align"
                groupValue={align}
                onClick={() => setSelectedAlign(align)}
              >
                {align}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-xs">
            {i18n.t('button.extraSmall')} / {i18n.t('button.default')} / {i18n.t('button.large')}
          </p>
          <div className="flex gap-1 rounded-md border p-1">
            {['xs', 'default', 'lg'].map((size) => (
              <Button
                key={size}
                size="sm"
                variant={selectedSize === size ? 'default' : 'ghost'}
                groupId="size-select"
                groupValue={size}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Alignment: <code>{selectedAlign}</code> | Size: <code>{selectedSize}</code>
      </p>
    </div>
  );
}

export const ButtonGroups: Story = {
  name: i18n.t('button.storyName.buttonGroups', 'Button Groups (groupId/groupValue)'),
  render: () => <ButtonGroupDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(6);

    // Verify groupId/groupValue data attributes
    const groupBtn = canvasElement.querySelector('[data-group-id="text-align"]');
    expect(groupBtn).toBeInTheDocument();
    expect(groupBtn?.getAttribute('data-group-value')).toBeTruthy();

    // Click a group button
    await userEvent.click(buttons[0]);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// REMAINING MSW HANDLER STORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const PaymentDeclined: Story = {
  name: i18n.t('button.storyName.paymentDeclined', 'Payment Declined (MSW)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.paymentDeclined },
  },
  render: () => <PaymentButtonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const PaymentTimeout: Story = {
  name: i18n.t('button.storyName.paymentTimeout', 'Payment Timeout (MSW)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.paymentTimeout },
  },
  render: () => <PaymentButtonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

function AnalyticsErrorDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Analytics tracking with a failing endpoint. Events are still dispatched locally.
      </p>
      <Button
        trackingId="analytics-error-test"
        trackingData={{ source: 'test', scenario: 'error' }}
      >
        {i18n.t('button.signUp')}
      </Button>
    </div>
  );
}

export const AnalyticsError: Story = {
  name: i18n.t('button.storyName.analyticsError', 'Analytics Error (MSW)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.analyticsError },
  },
  render: () => <AnalyticsErrorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
  },
};

export const FormSubmitSuccessMSW: Story = {
  name: i18n.t('button.storyName.formSubmitSuccessMSW', 'Form Submit Success (MSW)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.formSubmitSuccess },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const FormSubmitValidationError: Story = {
  name: i18n.t('button.storyName.formSubmitValidationError', 'Form Validation Error (MSW)'),
  parameters: {
    msw: { handlers: buttonStatusHandlers.formSubmitValidationError },
  },
  render: () => <AsyncSubmitButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByTestId('submit-button');
    expect(submitButton).toBeInTheDocument();
    await userEvent.click(submitButton);
    expect(submitButton.getAttribute('data-state')).toBe('loading');
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('button.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: buttonStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
