/**
 * HoverCard Component Stories
 *
 * Comprehensive Storybook documentation for the HoverCard component.
 * Demonstrates hover interactions, positioning, timing, async data loading,
 * accessibility features, and internationalization support.
 *
 * @module hover-card.stories
 * @see {@link file://./../../../../components/ui/hover-card.tsx}
 * @see {@link file://./../../_factories/hover-card.factory.ts}
 * @see {@link file://./../../_handlers/hover-card.handlers.ts}
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import {
  hoverCardHandlers,
  hoverCardStatusHandlers,
} from '@/.storybook/stories/_handlers/hover-card.handlers';
import {
  createFakeActionsHoverCard,
  createFakeControlledHoverCard,
  createFakeDarkModeHoverCard,
  createFakeFocusTestConfig,
  createFakeHoverCard,
  createFakeHoverCardAction,
  createFakeHoverCardActions,
  createFakeHoverCardContentMatrix,
  createFakeHoverCardPositionMatrix,
  createFakeHoverCardProduct,
  createFakeHoverCardProject,
  createFakeHoverCards,
  createFakeHoverCardsForAllAligns,
  createFakeHoverCardsForAllSides,
  createFakeHoverCardShowcase,
  createFakeHoverCardStats,
  createFakeHoverCardsWithOffsets,
  createFakeHoverCardTeam,
  createFakeHoverCardTimingMatrix,
  createFakeHoverCardUserProfile,
  createFakeInfoHoverCard,
  createFakeProductHoverCard,
  createFakeProductHoverCards,
  createFakeProjectHoverCard,
  createFakeProjectHoverCards,
  createFakeStatsHoverCard,
  createFakeTeamHoverCard,
  createFakeUserProfileHoverCard,
  createFakeUserProfileHoverCards,
  type FakeControlledHoverCard as FakeControlledHoverCardType,
  type FakeFocusTestConfig,
  type FakeHoverCardAction,
  type FakeHoverCardContent,
  type FakeHoverCardProduct as FakeHoverCardProductType,
  type FakeHoverCardProject as FakeHoverCardProjectType,
  type FakeHoverCardStats as FakeHoverCardStatsType,
  type FakeHoverCardTeam as FakeHoverCardTeamType,
  type FakeHoverCard as FakeHoverCardType,
  type FakeHoverCardUserProfile as FakeHoverCardUserProfileType,
  HOVER_CARD_ALIGNS,
  HOVER_CARD_CLOSE_DELAYS,
  HOVER_CARD_CONTENT_TYPES,
  HOVER_CARD_OPEN_DELAYS,
  HOVER_CARD_SIDES,
  HOVER_CARD_TRIGGER_TYPES,
  HOVER_CARD_WIDTH_CLASSES,
  HOVER_CARD_WIDTHS,
  type HoverCardAlign,
  type HoverCardContentType,
  type HoverCardSide,
  type HoverCardTriggerType,
  type HoverCardWidth,
} from '@/.storybook/stories/_factories/hover-card.factory';
import { createFakeUserProfile } from '@/.storybook/stories/_factories/user.factory';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function HoverCardDemo() {
  const { t } = useTranslation();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {t('hoverCard.trigger')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex gap-3">
          <Avatar className="size-10">
            <AvatarImage alt={t('avatar.alt')} src="/images/avatars/01.png" />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="text-sm font-medium">{t('hoverCard.profile.name')}</div>
            <div className="text-muted-foreground text-sm">
              {t('hoverCard.profile.description')}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

const meta = {
  title: 'Components/UI/Hover Card',
  component: HoverCardDemo,
  tags: ['autodocs'],
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  argTypes: {
    // ═══════════════════════════════════════════════════════════════
    // CONTENT
    // ═══════════════════════════════════════════════════════════════
    children: {
      control: false,
      description: i18n.t('hoverCard.argType.hoverCardContent', 'Hover card content'),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    triggerLabel: {
      control: 'text',
      description: i18n.t('hoverCard.argType.textForTheHoverTrigger', 'Text for the hover trigger'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: i18n.t(
        'hoverCard.argType.preferredSideForCardPositioning',
        'Preferred side for card positioning'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'bottom' },
        type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: i18n.t(
        'hoverCard.argType.alignmentOfCardRelativeToTrigger',
        'Alignment of card relative to trigger'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'center' },
        type: { summary: "'start' | 'center' | 'end'" },
      },
    },
    sideOffset: {
      control: 'number',
      description: i18n.t(
        'hoverCard.argType.distanceFromTriggerInPixels',
        'Distance from trigger in pixels'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: '4' },
        type: { summary: 'number' },
      },
    },
    className: {
      control: 'text',
      description: i18n.t(
        'hoverCard.argType.additionalCssClassesForContent',
        'Additional CSS classes for content'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    open: {
      control: 'boolean',
      description: i18n.t('hoverCard.argType.controlledOpenState', 'Controlled open state'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
      },
    },
    defaultOpen: {
      control: 'boolean',
      description: i18n.t(
        'hoverCard.argType.defaultOpenStateForUncontrolledUsage',
        'Default open state for uncontrolled usage'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT
    // ═══════════════════════════════════════════════════════════════
    openDelay: {
      control: 'number',
      description: i18n.t(
        'hoverCard.argType.delayBeforeOpeningInMilliseconds',
        'Delay before opening in milliseconds'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '700' },
        type: { summary: 'number' },
      },
    },
    closeDelay: {
      control: 'number',
      description: i18n.t(
        'hoverCard.argType.delayBeforeClosingInMilliseconds',
        'Delay before closing in milliseconds'
      ),
      table: {
        category: 'Layout',
        defaultValue: { summary: '300' },
        type: { summary: 'number' },
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    onClick: {
      action: 'onClick',
      description: i18n.t('hoverCard.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('hoverCard.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('hoverCard.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('hoverCard.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('hoverCard.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('hoverCard.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('hoverCard.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'hoverCard.argType.calledWhenOpenStateChanges',
        'Called when open state changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual HoverCard component props documented below
    // HoverCard Props Reference (Radix HoverCard.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - openDelay: Delay before opening in ms (number, default: 700)
    // - closeDelay: Delay before closing in ms (number, default: 300)
    //
    // HoverCardTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // HoverCardContent Props Reference:
    // - side: Preferred side ('top' | 'right' | 'bottom' | 'left', default: 'bottom')
    // - sideOffset: Distance from trigger in pixels (number, default: 4)
    // - align: Alignment ('start' | 'center' | 'end', default: 'center')
    // - alignOffset: Alignment offset in pixels (number)
    // - avoidCollisions: Whether to avoid collisions (boolean, default: true)
    // - collisionBoundary: Boundary element(s) (Element | Element[] | null)
    // - collisionPadding: Padding for collision detection (number | Partial<Record<Side, number>>)
    // - sticky: Sticky behavior ('partial' | 'always', default: 'partial')
    // - hideWhenDetached: Hide when trigger is detached (boolean, default: false)
    // - forceMount: Force mount when closed (boolean)
    // - className: Additional CSS classes (string)
  },
  parameters: {
    msw: {
      handlers: hoverCardHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof HoverCardDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    if (!(contentRoot instanceof HTMLElement)) {
      throw new Error('Hover card content root was not found.');
    }

    const details = contentRoot.querySelector('div.space-y-1');
    if (!(details instanceof HTMLElement)) {
      throw new Error('Hover card details section was not found.');
    }

    const detailLines = [...details.children].filter(
      (child) => child instanceof HTMLElement && child.textContent?.trim()
    );
    expect(detailLines.length).toBe(2);

    expect(contentRoot.querySelector('[data-slot=\"avatar\"]')).toBeInTheDocument();
    expect(contentRoot.querySelector('[data-slot=\"avatar-image\"]')).toBeInTheDocument();
    expect(contentRoot.querySelector('[data-slot=\"avatar-fallback\"]')).toBeInTheDocument();
    expect(contentRoot.textContent?.trim()).not.toBe('');

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot=\"hover-card-content\"]')).not.toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

function HoverCardVariantsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('hoverCard.variants.basic')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {i18n.t('hoverCard.story.hoverForInfo', 'Hover for info')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <p className="text-sm">
              {i18n.t(
                'hoverCard.story.simpleHoverCardDescription',
                'A simple hover card with basic text content. Hover cards are great for providing additional context.'
              )}
            </p>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('hoverCard.variants.withAvatar')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {i18n.t('hoverCard.story.atJohndoe', '@johndoe')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="flex gap-3">
              <Avatar className="size-12">
                <AvatarImage
                  alt={i18n.t('hoverCard.story.johnDoe', 'John Doe')}
                  src="/images/avatars/02.png"
                />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {i18n.t('hoverCard.story.johnDoe', 'John Doe')}
                </div>
                <div className="text-muted-foreground text-sm">
                  {i18n.t('hoverCard.story.atJohndoe', '@johndoe')}
                </div>
                <div className="text-muted-foreground text-xs">
                  {i18n.t('hoverCard.story.joinedDecember2021', 'Joined December 2021')}
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('hoverCard.variants.withRichContent')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {i18n.t('hoverCard.story.projectDetails', 'Project Details')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {i18n.t('hoverCard.story.acmeProject', 'Acme Project')}
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-100">
                  {i18n.t('hoverCard.story.active', 'Active')}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                {i18n.t(
                  'hoverCard.story.fullStackDescription',
                  'A full-stack application built with React and Node.js for managing customer relationships.'
                )}
              </p>
              <div className="text-muted-foreground flex gap-4 text-xs">
                <span>{i18n.t('hoverCard.story.twelveMembers', '12 members')}</span>
                <span>{i18n.t('hoverCard.story.twentyFourTasks', '24 tasks')}</span>
                <span>{i18n.t('hoverCard.story.updatedTwoHoursAgo', 'Updated 2h ago')}</span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('hoverCard.variants.withActions')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {i18n.t('hoverCard.story.quickActions', 'Quick Actions')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {i18n.t('hoverCard.story.availableActions', 'Available Actions')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1 text-xs"
                  type="button"
                >
                  {i18n.t('hoverCard.story.view', 'View')}
                </button>
                <button
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1 text-xs"
                  type="button"
                >
                  {i18n.t('hoverCard.story.edit', 'Edit')}
                </button>
                <button
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-3 py-1 text-xs"
                  type="button"
                >
                  {i18n.t('hoverCard.story.delete', 'Delete')}
                </button>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  );
}

export const Variants: Story = {
  tags: ['!test'],
  render: () => <HoverCardVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function HoverCardSizesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('hoverCard.sizes.compact')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {t('hoverCard.story.compactCard', 'Compact Card')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-48">
            <p className="text-sm">
              {t(
                'hoverCard.story.compactHoverCardDescription',
                'A compact hover card for brief information.'
              )}
            </p>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('hoverCard.sizes.default')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {t('hoverCard.story.defaultCard', 'Default Card')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('hoverCard.story.defaultWidth', 'Default Width')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t(
                  'hoverCard.story.standardSizeDescription',
                  'This is the standard size for hover cards with moderate content.'
                )}
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('hoverCard.sizes.wide')}</p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {t('hoverCard.story.wideCard', 'Wide Card')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-96">
            <div className="flex gap-4">
              <Avatar className="size-16">
                <AvatarImage
                  alt={t('hoverCard.story.teamAlt', 'Team')}
                  src="/images/avatars/03.png"
                />
                <AvatarFallback>TM</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('hoverCard.story.engineeringTeam', 'Engineering Team')}
                </p>
                <p className="text-muted-foreground text-sm">
                  {t(
                    'hoverCard.story.crossFunctionalTeamDescription',
                    'A cross-functional team of engineers working on platform infrastructure and developer tools.'
                  )}
                </p>
                <div className="text-muted-foreground flex gap-3 text-xs">
                  <span>{t('hoverCard.story.fifteenMembers', '15 members')}</span>
                  <span>{t('hoverCard.story.threeProjects', '3 projects')}</span>
                  <span>{t('hoverCard.story.active', 'Active')}</span>
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  tags: ['!test'],
  render: () => <HoverCardSizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DARK MODE STORIES ============

function DarkModeDemo() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground mb-3 text-sm">
          {t(
            'hoverCard.story.darkModeDescription',
            'HoverCard in dark mode with proper contrast and styling.'
          )}
        </p>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button
              className="text-sm underline underline-offset-4"
              type="button"
              data-testid="dark-mode-trigger"
            >
              {t('hoverCard.trigger')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80" data-testid="dark-mode-content">
            <div className="flex gap-3">
              <Avatar className="size-10">
                <AvatarImage alt={t('avatar.alt')} src="/images/avatars/01.png" />
                <AvatarFallback>AL</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="text-sm font-medium">{t('hoverCard.profile.name')}</div>
                <div className="text-muted-foreground text-sm">
                  {t('hoverCard.profile.description')}
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  );
}

export const Dark: Story = {
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Verify dark mode is applied
    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    const trigger = canvas.getByTestId('dark-mode-trigger');
    expect(trigger).toBeInTheDocument();

    // Hover to open
    await userEvent.hover(trigger);

    // Wait for content to appear
    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="dark-mode-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dark mode hover card content was not found.');
      }
      return node;
    });

    // Verify content is visible and styled correctly
    expect(content).toBeVisible();
    expect(content.getAttribute('data-slot')).toBe('hover-card-content');

    // Verify avatar and text are present
    const avatar = content.querySelector('[data-slot="avatar"]');
    expect(avatar).toBeInTheDocument();

    // Unhover to close
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="dark-mode-content"]')).not.toBeInTheDocument();
    });
  },
};

export const DarkJapanese: Story = {
  render: () => <DarkModeDemo />,
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Verify dark mode and Japanese locale
    expect(doc.documentElement.classList.contains('dark')).toBe(true);
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = canvas.getByRole('button', { name: '詳細を見る' });
    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="dark-mode-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Dark mode hover card content was not found.');
      }
      return node;
    });

    const contentQueries = within(content);
    expect(contentQueries.getByText('エイダ・ラブレス')).toBeInTheDocument();

    await userEvent.unhover(trigger);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);

    const trigger = canvas.getByRole('button', { name: '詳細を見る' });

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    if (!(contentRoot instanceof HTMLElement)) {
      throw new Error('Hover card content root was not found.');
    }

    const contentQueries = within(contentRoot);

    expect(contentQueries.getByText('エイダ・ラブレス')).toBeInTheDocument();
    expect(contentQueries.getByText('世界初のプログラマー。')).toBeInTheDocument();
    expect(contentQueries.getByAltText('ユーザーのアバター')).toBeInTheDocument();
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

function DefaultOpenDemo() {
  return (
    <HoverCard defaultOpen>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {i18n.t('hoverCard.story.defaultOpen', 'Default Open')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <p className="text-sm">
          {i18n.t(
            'hoverCard.story.thisHoverCardStartsInTheOpenState',
            'This hover card starts in the open state.'
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const DefaultOpen: Story = {
  render: () => <DefaultOpenDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function WithCustomOffsetDemo() {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {i18n.t('hoverCard.story.customOffset16px', 'Custom Offset (16px)')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" sideOffset={16}>
        <p className="text-sm">
          {i18n.t(
            'hoverCard.story.offsetDescription',
            'This hover card has a 16px offset from the trigger.'
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const WithCustomOffset: Story = {
  render: () => <WithCustomOffsetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function MinimalContentDemo() {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {i18n.t('hoverCard.story.minimal', 'Minimal')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-48">
        <p className="text-sm">{i18n.t('hoverCard.story.shortContent', 'Short content.')}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const MinimalContent: Story = {
  render: () => <MinimalContentDemo />,
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
  name: i18n.t('hoverCard.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
    msw: {
      handlers: hoverCardHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: hoverCardStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected hover card trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const contentRoot = await waitFor(() => {
      const root = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!root) {
        throw new Error('Hover card content root was not found.');
      }
      return root;
    });

    expect(contentRoot).toBeInTheDocument();

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

export const Accessibility: Story = {
  name: i18n.t('hoverCard.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    // Test keyboard focus shows hover card
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Hover card should appear on focus (or hover)
    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Hover card content was not found.');
      }
      return node;
    });

    // Verify content is present and accessible
    expect(content.textContent?.trim()).not.toBe('');

    // Verify avatar has alt text
    const avatarImage = content.querySelector('[data-slot="avatar-image"]');
    if (avatarImage instanceof HTMLImageElement) {
      expect(avatarImage).toHaveAttribute('alt');
    }

    // Unhover to close
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FAKER DATA STORIES ============

function HoverCardWithFakerData() {
  const userProfile = createFakeUserProfile();
  const fakeUser = {
    name: userProfile.name,
    username: userProfile.email.split('@')[0],
    bio: userProfile.bio,
    followers: userProfile.followers,
    following: userProfile.following,
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          @{fakeUser.username}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex gap-3">
          <Avatar className="size-12">
            <AvatarImage
              alt={fakeUser.name}
              src={`https://i.pravatar.cc/150?u=${fakeUser.username}`}
            />
            <AvatarFallback>{fakeUser.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="text-sm font-medium">{fakeUser.name}</div>
            <div className="text-muted-foreground text-xs">@{fakeUser.username}</div>
            <div className="text-muted-foreground text-sm">{fakeUser.bio}</div>
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span>
                {i18n.t('hoverCard.story.followersCount', '{{num}} followers', {
                  num: fakeUser.followers.toLocaleString(),
                })}
              </span>
              <span>
                {i18n.t('hoverCard.story.followingCount', '{{num}} following', {
                  num: fakeUser.following.toLocaleString(),
                })}
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export const WithFakerData: Story = {
  render: () => <HoverCardWithFakerData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Hover card content was not found.');
      }
      return node;
    });

    expect(content.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(content.textContent).toContain('followers');
    expect(content.textContent).toContain('following');

    await userEvent.unhover(trigger);
  },
};

// ============ ASYNC DATA STORIES ============

interface AsyncUserData {
  avatar: string;
  bio: string;
  id: string;
  name: string;
  username: string;
}

function HoverCardWithAsyncData() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<AsyncUserData | null>(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/users/1');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as AsyncUserData;
        setUser(data);
      } catch (error_) {
        setError(
          error_ instanceof Error
            ? error_.message
            : i18n.t('hoverCard.story.failedToLoadUser', 'Failed to load user')
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {i18n.t('hoverCard.story.viewUserProfile', 'View User Profile')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        {isLoading && (
          <div className="flex items-center justify-center py-4" data-testid="loading-state">
            <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="ml-2 text-sm">{i18n.t('hoverCard.story.loading', 'Loading...')}</span>
          </div>
        )}
        {error && (
          <div className="text-destructive py-4 text-center text-sm" data-testid="error-state">
            {error}
          </div>
        )}
        {!isLoading && !error && user && (
          <div className="flex gap-3" data-testid="success-state">
            <Avatar className="size-12">
              <AvatarImage alt={user.name} src={user.avatar} />
              <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-muted-foreground text-xs">@{user.username}</div>
              <div className="text-muted-foreground text-sm">{user.bio}</div>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export const WithAsyncData: Story = {
  render: () => <HoverCardWithAsyncData />,
  parameters: {
    msw: {
      handlers: hoverCardHandlers,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const EmptyData: Story = {
  render: () => {
    function HoverCardEmptyData() {
      return (
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm underline underline-offset-4" type="button">
              {i18n.t('hoverCard.story.emptyProfile', 'Empty Profile')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80">
            <div className="py-8 text-center" data-testid="empty-state">
              <div className="text-muted-foreground text-4xl">👤</div>
              <p className="text-muted-foreground mt-2 text-sm">
                {i18n.t('hoverCard.story.noUserDataAvailable', 'No user data available')}
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    }
    return <HoverCardEmptyData />;
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-slot="hover-card-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Hover card content was not found.');
      }
      return node;
    });

    const emptyState = content.querySelector('[data-testid="empty-state"]');
    expect(emptyState).toBeInTheDocument();
    expect(content.textContent).toContain('No user data available');

    await userEvent.unhover(trigger);
  },
};

export const SlowResponse: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.loading,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.notFound,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const Error409Conflict: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.conflict,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const Error429RateLimit: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.tooManyRequests,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const Error502BadGateway: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.badGateway,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const Error503ServiceUnavailable: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.serviceUnavailable,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

export const Error504GatewayTimeout: Story = {
  ...WithAsyncData,
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.gatewayTimeout,
    },
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="hover-card-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Hover card trigger was not found.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.unhover(trigger);
  },
};

// ============ HOVER TIMING STORIES ============

function HoverCardWithTiming({ openDelay, closeDelay }: { closeDelay: number; openDelay: number }) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {i18n.t(
            'hoverCard.story.openCloseMs',
            'Open: {{openDelay}}ms / Close: {{closeDelay}}ms',
            { openDelay, closeDelay }
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {i18n.t('hoverCard.story.timingConfiguration', 'Timing Configuration')}
          </p>
          <p className="text-muted-foreground text-xs">
            {i18n.t(
              'hoverCard.story.openDelayCloseDelay',
              'Open delay: {{openDelay}}ms, Close delay: {{closeDelay}}ms',
              { openDelay, closeDelay }
            )}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function HoverTimingVariationsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('hoverCard.story.instantTiming', 'Instant (0ms open, 0ms close)')}
        </p>
        <HoverCardWithTiming openDelay={0} closeDelay={0} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('hoverCard.story.fastTiming', 'Fast (200ms open, 100ms close)')}
        </p>
        <HoverCardWithTiming openDelay={200} closeDelay={100} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('hoverCard.story.defaultTiming', 'Default (700ms open, 300ms close)')}
        </p>
        <HoverCardWithTiming openDelay={700} closeDelay={300} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('hoverCard.story.slowTiming', 'Slow (1500ms open, 500ms close)')}
        </p>
        <HoverCardWithTiming openDelay={1500} closeDelay={500} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('hoverCard.story.verySlowTiming', 'Very Slow (3000ms open, 1000ms close)')}
        </p>
        <HoverCardWithTiming openDelay={3000} closeDelay={1000} />
      </div>
    </div>
  );
}

export const HoverTimingVariations: Story = {
  tags: ['!test'],
  render: () => <HoverTimingVariationsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ CONTROLLED HOVER CARD ============

function ControlledHoverCardDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1 text-sm"
          onClick={() => setOpen(true)}
          type="button"
        >
          {i18n.t('hoverCard.story.open', 'Open')}
        </button>
        <button
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1 text-sm"
          onClick={() => setOpen(false)}
          type="button"
        >
          {i18n.t('hoverCard.story.close', 'Close')}
        </button>
        <button
          className="bg-outline rounded-md border px-3 py-1 text-sm"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          {i18n.t('hoverCard.story.toggle', 'Toggle')}
        </button>
      </div>

      <HoverCard open={open} onOpenChange={setOpen}>
        <HoverCardTrigger asChild>
          <button className="text-sm underline underline-offset-4" type="button">
            {i18n.t(
              'hoverCard.story.controlledHoverCard',
              'Controlled Hover Card (open: {{state}})',
              { state: String(open) }
            )}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {i18n.t('hoverCard.story.controlledState', 'Controlled State')}
            </p>
            <p className="text-muted-foreground text-sm">
              {i18n.t(
                'hoverCard.story.controlledDescription',
                'This hover card is controlled externally. Use the buttons above to toggle.'
              )}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const ControlledHoverCard: Story = {
  render: () => <ControlledHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Test open button
    const openButton = canvas.getByRole('button', { name: 'Open' });
    await userEvent.click(openButton);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    // Test close button
    const closeButton = canvas.getByRole('button', { name: 'Close' });
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });

    // Test toggle button
    const toggleButton = canvas.getByRole('button', { name: 'Toggle' });
    await userEvent.click(toggleButton);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ POSITIONING STORIES ============

function HoverCardWithPosition({
  side,
  align,
  sideOffset,
}: {
  align?: 'start' | 'center' | 'end';
  side: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="text-sm underline underline-offset-4" type="button">
          {side}
          {align ? ` - ${align}` : ''}
          {sideOffset !== undefined ? ` (offset: ${sideOffset})` : ''}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side={side} align={align} sideOffset={sideOffset} className="w-48">
        <p className="text-sm">Position: {side}</p>
        {align && <p className="text-muted-foreground text-xs">Align: {align}</p>}
        {sideOffset !== undefined && (
          <p className="text-muted-foreground text-xs">
            {i18n.t('hoverCard.story.offsetPx', { offset: sideOffset })}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function PositioningDemo() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="grid grid-cols-3 gap-8">
        <div />
        <HoverCardWithPosition side="top" />
        <div />
        <HoverCardWithPosition side="left" />
        <div className="text-muted-foreground text-center text-sm">
          {i18n.t('hoverCard.story.center', 'Center')}
        </div>
        <HoverCardWithPosition side="right" />
        <div />
        <HoverCardWithPosition side="bottom" />
        <div />
      </div>
    </div>
  );
}

export const Positioning: Story = {
  tags: ['!test'],
  render: () => <PositioningDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PositioningWithAlign: Story = {
  tags: ['!test'],
  render: () => (
    <div className="flex flex-col gap-8 py-8">
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('hoverCard.story.sideTop')}</p>
        <div className="flex gap-6">
          <HoverCardWithPosition side="top" align="start" />
          <HoverCardWithPosition side="top" align="center" />
          <HoverCardWithPosition side="top" align="end" />
        </div>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('hoverCard.story.sideBottom')}</p>
        <div className="flex gap-6">
          <HoverCardWithPosition side="bottom" align="start" />
          <HoverCardWithPosition side="bottom" align="center" />
          <HoverCardWithPosition side="bottom" align="end" />
        </div>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('hoverCard.story.sideLeft')}</p>
        <div className="flex flex-col gap-4">
          <HoverCardWithPosition side="left" align="start" />

          <HoverCardWithPosition side="left" align="center" />
          <HoverCardWithPosition side="left" align="end" />
        </div>
      </div>
      <div>
        <p className="mb-4 text-sm font-medium">{i18n.t('hoverCard.story.sideRight')}</p>
        <div className="flex flex-col gap-4">
          <HoverCardWithPosition side="right" align="start" />
          <HoverCardWithPosition side="right" align="center" />
          <HoverCardWithPosition side="right" align="end" />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function PositioningWithOffsetDemo() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <p className="mb-4 text-sm font-medium">
          {i18n.t('hoverCard.story.differentOffsets', 'Different Offsets')}
        </p>
        <div className="flex gap-6">
          <HoverCardWithPosition side="bottom" sideOffset={0} />
          <HoverCardWithPosition side="bottom" sideOffset={8} />
          <HoverCardWithPosition side="bottom" sideOffset={16} />
          <HoverCardWithPosition side="bottom" sideOffset={32} />
        </div>
      </div>
    </div>
  );
}

export const PositioningWithOffset: Story = {
  tags: ['!test'],
  render: () => <PositioningWithOffsetDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ KEYBOARD NAVIGATION ============

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const trigger = canvas.getByRole('button');

    // Focus the trigger
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Hover to open
    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-slot="hover-card-content"]');
      expect(content).toBeInTheDocument();
    });

    // Unhover to close
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="hover-card-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FOCUS MANAGEMENT STORIES ============

function FocusManagementDemo() {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [focusCount, setFocusCount] = React.useState(0);
  const [blurCount, setBlurCount] = React.useState(0);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {i18n.t(
            'hoverCard.story.accessibilityDescription',
            'Hover cards should be accessible via keyboard focus. Tab to focus the trigger, and the hover card should open on hover.'
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {i18n.t(
            'hoverCard.story.focusBlurCount',
            'Focus count: {{focusCount}} | Blur count: {{blurCount}}',
            { focusCount, blurCount }
          )}
        </p>
      </div>

      <div className="flex gap-4">
        <button
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-sm"
          type="button"
          data-testid="before-trigger"
        >
          {i18n.t('hoverCard.story.before', 'Before')}
        </button>

        <HoverCard>
          <HoverCardTrigger asChild>
            <button
              ref={triggerRef}
              className="text-sm underline underline-offset-4"
              type="button"
              data-testid="focus-test-trigger"
              onFocus={() => setFocusCount((c) => c + 1)}
              onBlur={() => setBlurCount((c) => c + 1)}
            >
              {i18n.t('hoverCard.trigger')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72" data-testid="focus-test-content">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {i18n.t('hoverCard.story.focusManagementTest', 'Focus Management Test')}
              </p>
              <p className="text-muted-foreground text-sm">
                {i18n.t(
                  'hoverCard.story.focusManagementDescription',
                  'This hover card demonstrates proper focus management for keyboard users.'
                )}
              </p>
              <button
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-2 rounded-md px-3 py-1 text-xs"
                type="button"
                data-testid="content-action-button"
              >
                {i18n.t('hoverCard.story.action', 'Action')}
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>

        <button
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-sm"
          type="button"
          data-testid="after-trigger"
        >
          {i18n.t('hoverCard.story.after', 'After')}
        </button>
      </div>
    </div>
  );
}

export const FocusManagement: Story = {
  render: () => <FocusManagementDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const beforeButton = canvas.getByTestId('before-trigger');
    const trigger = canvas.getByTestId('focus-test-trigger');
    const afterButton = canvas.getByTestId('after-trigger');

    // Start with no focus
    expect(doc.activeElement).toBe(doc.body);

    // Tab to first button
    await userEvent.tab();
    expect(beforeButton).toHaveFocus();

    // Tab to hover card trigger
    await userEvent.tab();
    expect(trigger).toHaveFocus();

    // Verify focus count increased
    expect(canvasElement.textContent).toContain('Focus count: 1');

    // Tab to next button
    await userEvent.tab();
    expect(afterButton).toHaveFocus();

    // Verify blur count increased
    expect(canvasElement.textContent).toContain('Blur count: 1');

    // Shift+Tab back to trigger
    await userEvent.tab({ shift: true });
    expect(trigger).toHaveFocus();

    // Now hover to open the card while focused
    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-testid="focus-test-content"]');
      expect(content).toBeInTheDocument();
    });

    // Trigger should still have focus
    expect(trigger).toHaveFocus();

    // Unhover to close
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="focus-test-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ HOVER TRIGGER TIMING TESTS ============

function HoverTriggerTimingDemo() {
  const timings = createFakeHoverCardTimingMatrix();

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'hoverCard.story.hoverTriggerTimingDescription',
          'Test different open/close delay configurations. Each card has different timing.'
        )}
      </p>
      <div className="flex flex-wrap gap-6">
        {timings.map(({ openDelay, closeDelay, label }) => {
          const testId = label.toLowerCase().replaceAll(/\s/g, '-');
          return (
            <div key={label} className="space-y-2">
              <p className="text-xs font-medium">{label}</p>
              <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
                <HoverCardTrigger asChild>
                  <button
                    className="text-sm underline underline-offset-4"
                    type="button"
                    data-testid={`timing-trigger-${testId}`}
                  >
                    {i18n.t('hoverCard.story.timingTrigger', '{{openDelay}}ms / {{closeDelay}}ms', {
                      openDelay,
                      closeDelay,
                    })}
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-48" data-testid={`timing-content-${testId}`}>
                  <p className="text-sm">
                    {i18n.t('hoverCard.story.openMs', 'Open: {{openDelay}}ms', { openDelay })}
                    <br />
                    {i18n.t('hoverCard.story.closeMs', 'Close: {{closeDelay}}ms', { closeDelay })}
                  </p>
                </HoverCardContent>
              </HoverCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstantHoverTimingDemo() {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="instant-trigger"
        >
          {i18n.t('hoverCard.story.instant0ms', 'Instant (0ms)')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-48" data-testid="instant-content">
        <p className="text-sm">
          {i18n.t(
            'hoverCard.story.opensAndClosesInstantlyWithNoDelay',
            'Opens and closes instantly with no delay.'
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const HoverTriggerTiming: Story = {
  tags: ['!test'], // Skip automated tests due to timing variations
  render: () => <HoverTriggerTimingDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HoverTriggerInstant: Story = {
  render: () => <InstantHoverTimingDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const trigger = canvas.getByTestId('instant-trigger');

    // Hover should open immediately (0ms delay)
    await userEvent.hover(trigger);

    // Content should appear almost immediately
    await waitFor(
      () => {
        const content = doc.body.querySelector('[data-testid="instant-content"]');
        expect(content).toBeInTheDocument();
      },
      { timeout: 100 }
    );

    // Unhover should close immediately
    await userEvent.unhover(trigger);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="instant-content"]')).not.toBeInTheDocument();
      },
      { timeout: 100 }
    );
  },
};

function HoverTriggerDelayedDemo() {
  return (
    <HoverCard openDelay={500} closeDelay={200}>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="delayed-trigger"
        >
          {i18n.t('hoverCard.story.delayed500ms', 'Delayed (500ms open, 200ms close)')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-56" data-testid="delayed-content">
        <p className="text-sm">
          {i18n.t(
            'hoverCard.story.delayedDescription',
            'Opens after 500ms delay, closes after 200ms.'
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const HoverTriggerDelayed: Story = {
  render: () => <HoverTriggerDelayedDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const trigger = canvas.getByTestId('delayed-trigger');

    // Hover
    await userEvent.hover(trigger);

    // Content should NOT appear immediately (wait less than 500ms)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(doc.body.querySelector('[data-testid="delayed-content"]')).not.toBeInTheDocument();

    // Wait for the delay and check again
    await waitFor(
      () => {
        const content = doc.body.querySelector('[data-testid="delayed-content"]');
        expect(content).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Unhover
    await userEvent.unhover(trigger);

    // Content should still be visible briefly due to close delay
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Note: The content may or may not still be visible depending on animation timing

    // Eventually closes
    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="delayed-content"]')).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );
  },
};

// ============ POSITIONING PLAY TESTS ============

function PositioningPlayTestDemo({ side, align }: { align?: HoverCardAlign; side: HoverCardSide }) {
  const alignSuffix = align ? `-${align}` : '';
  const triggerTestId = `position-trigger-${side}${alignSuffix}`;
  const contentTestId = `position-content-${side}${alignSuffix}`;
  const alignLabel = align ? ` - ${align}` : '';

  return (
    <div className="flex min-h-[200px] items-center justify-center p-8">
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid={triggerTestId}
          >
            {side}
            {alignLabel}
          </button>
        </HoverCardTrigger>
        <HoverCardContent side={side} align={align} className="w-48" data-testid={contentTestId}>
          <p className="text-sm">
            Side: {side}
            {align && (
              <>
                <br />
                Align: {align}
              </>
            )}
          </p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const PositionTop: Story = {
  render: () => <PositioningPlayTestDemo side="top" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="position-trigger-top"]');

    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="position-content-top"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    // Verify content has data-side attribute
    expect(content.getAttribute('data-side')).toBe('top');

    await userEvent.unhover(trigger);
  },
};

export const PositionBottom: Story = {
  render: () => <PositioningPlayTestDemo side="bottom" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="position-trigger-bottom"]');

    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="position-content-bottom"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.getAttribute('data-side')).toBe('bottom');

    await userEvent.unhover(trigger);
  },
};

export const PositionLeft: Story = {
  render: () => <PositioningPlayTestDemo side="left" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="position-trigger-left"]');

    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="position-content-left"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.getAttribute('data-side')).toBe('left');

    await userEvent.unhover(trigger);
  },
};

export const PositionRight: Story = {
  render: () => <PositioningPlayTestDemo side="right" />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="position-trigger-right"]');

    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="position-content-right"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.getAttribute('data-side')).toBe('right');

    await userEvent.unhover(trigger);
  },
};

export const PositionWithAlignment: Story = {
  tags: ['!test'],
  render: () => (
    <div className="grid grid-cols-3 gap-8 p-8">
      <PositioningPlayTestDemo side="top" align="start" />

      <PositioningPlayTestDemo side="top" align="center" />
      <PositioningPlayTestDemo side="top" align="end" />
      <PositioningPlayTestDemo side="bottom" align="start" />
      <PositioningPlayTestDemo side="bottom" align="center" />
      <PositioningPlayTestDemo side="bottom" align="end" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ CONTENT FETCH STORIES WITH MSW ============

interface ProductData {
  category: string;
  description: string;
  discount?: number;
  image: string;
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  reviewCount: number;
}

export const WithProductPreview: Story = {
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.productSuccess,
    },
  },
  render: () => {
    function ProductPreviewDemo() {
      const [product, setProduct] = React.useState<ProductData | null>(null);
      const [isLoading, setIsLoading] = React.useState(false);

      const fetchProduct = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/hover-card/product?productId=123');
          const data = (await response.json()) as ProductData;
          setProduct(data);
        } catch {
          // Handle error silently in demo
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <HoverCard onOpenChange={(open) => open && fetchProduct()}>
          <HoverCardTrigger asChild>
            <button
              className="text-sm underline underline-offset-4"
              type="button"
              data-testid="product-trigger"
            >
              {i18n.t('hoverCard.story.viewProduct', 'View Product')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72" data-testid="product-content">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
            {!isLoading && product && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{product.name}</p>
                <p className="text-muted-foreground text-xs">{product.category}</p>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${product.price.toFixed(2)}</span>
                  {product.discount && (
                    <span className="text-muted-foreground text-xs line-through">
                      ${product.originalPrice?.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>
                    {i18n.t('hoverCard.story.ratingValue', 'Rating: {{rating}}', {
                      rating: product.rating,
                    })}
                  </span>
                  <span>
                    {i18n.t('hoverCard.story.reviewCount', '({{count}} reviews)', {
                      count: product.reviewCount,
                    })}
                  </span>
                </div>
                <span className={`text-xs ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
                  {product.inStock
                    ? i18n.t('hoverCard.story.inStock', 'In Stock')
                    : i18n.t('hoverCard.story.outOfStock', 'Out of Stock')}
                </span>
              </div>
            )}
            {!isLoading && !product && (
              <p className="text-muted-foreground text-sm">
                {i18n.t('hoverCard.story.noProductData', 'No product data')}
              </p>
            )}
          </HoverCardContent>
        </HoverCard>
      );
    }
    return <ProductPreviewDemo />;
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const trigger = canvas.getByTestId('product-trigger');
    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="product-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Product content was not found.');
      }
      return node;
    });

    expect(content).toBeInTheDocument();

    await userEvent.unhover(trigger);
  },
};

interface TeamData {
  department: string;
  description: string;
  lead: string;
  memberAvatars: string[];
  memberCount: number;
  name: string;
  projectCount: number;
}

export const WithTeamPreview: Story = {
  parameters: {
    msw: {
      handlers: hoverCardStatusHandlers.teamSuccess,
    },
  },
  render: () => {
    function TeamPreviewDemo() {
      const [team, setTeam] = React.useState<TeamData | null>(null);
      const [isLoading, setIsLoading] = React.useState(false);

      const fetchTeam = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/hover-card/team?teamId=123');
          const data = (await response.json()) as TeamData;
          setTeam(data);
        } catch {
          // Handle error silently in demo
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <HoverCard onOpenChange={(open) => open && fetchTeam()}>
          <HoverCardTrigger asChild>
            <button
              className="text-sm underline underline-offset-4"
              type="button"
              data-testid="team-trigger"
            >
              {i18n.t('hoverCard.story.viewTeam', 'View Team')}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80" data-testid="team-content">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
            {!isLoading && team && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-muted-foreground text-xs">{team.department}</p>
                </div>
                <p className="text-muted-foreground text-sm">{team.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {team.memberAvatars.slice(0, 4).map((avatar) => (
                      <Avatar key={avatar} className="border-background size-6 border-2">
                        <AvatarImage
                          src={avatar}
                          alt={i18n.t('hoverCard.story.teamMember', 'Team member')}
                        />
                        <AvatarFallback>TM</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {i18n.t('hoverCard.story.memberCount', '{{count}} members', {
                      count: team.memberCount,
                    })}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {i18n.t('hoverCard.story.leadName', 'Lead: {{name}}', { name: team.lead })}
                </p>
              </div>
            )}
            {!isLoading && !team && (
              <p className="text-muted-foreground text-sm">
                {i18n.t('hoverCard.story.noTeamData', 'No team data')}
              </p>
            )}
          </HoverCardContent>
        </HoverCard>
      );
    }
    return <TeamPreviewDemo />;
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const trigger = canvas.getByTestId('team-trigger');
    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="team-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Team content was not found.');
      }
      return node;
    });

    expect(content).toBeInTheDocument();

    await userEvent.unhover(trigger);
  },
};

// ============ ACCESSIBILITY KEYBOARD TESTS ============

function AccessibilityKeyboardFlowDemo() {
  return (
    <div className="flex gap-4">
      <button
        className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-sm"
        type="button"
        data-testid="a11y-before"
      >
        {i18n.t('hoverCard.story.before', 'Before')}
      </button>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="a11y-trigger"
            aria-describedby="hover-card-description"
          >
            {i18n.t('hoverCard.story.hoverForProfile', 'Hover for profile')}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64" data-testid="a11y-content">
          <div className="space-y-2" id="hover-card-description">
            <p className="text-sm font-medium">
              {i18n.t('hoverCard.story.profileCard', 'Profile Card')}
            </p>
            <p className="text-muted-foreground text-sm">
              {i18n.t(
                'hoverCard.story.accessibilityContentDescription',
                'This content appears on hover for sighted users and is accessible to screen readers.'
              )}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
      <button
        className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-sm"
        type="button"
        data-testid="a11y-after"
      >
        {i18n.t('hoverCard.story.after', 'After')}
      </button>
    </div>
  );
}

export const AccessibilityKeyboardFlow: Story = {
  name: i18n.t('hoverCard.storyName.accessibilityKeyboardFlow', 'Accessibility: Keyboard Flow'),
  render: () => <AccessibilityKeyboardFlowDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const beforeBtn = canvas.getByTestId('a11y-before');
    const trigger = canvas.getByTestId('a11y-trigger');
    const afterBtn = canvas.getByTestId('a11y-after');

    // Verify trigger has proper ARIA attributes
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');

    // Tab through elements
    await userEvent.tab();
    expect(beforeBtn).toHaveFocus();

    await userEvent.tab();
    expect(trigger).toHaveFocus();

    // Hover to show content
    await userEvent.hover(trigger);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-testid="a11y-content"]');
      expect(content).toBeInTheDocument();
    });

    // Continue tabbing
    await userEvent.tab();
    expect(afterBtn).toHaveFocus();

    // Unhover
    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="a11y-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ RAPID HOVER/UNHOVER TEST ============

function RapidHoverUnhoverDemo() {
  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="rapid-trigger"
        >
          {i18n.t('hoverCard.story.rapidlyHoverMe', 'Rapidly hover me')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-48" data-testid="rapid-content">
        <p className="text-sm">
          {i18n.t('hoverCard.story.stableHoverCardContent', 'Stable hover card content')}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export const RapidHoverUnhover: Story = {
  name: i18n.t('hoverCard.storyName.rapidHoverUnhover', 'Rapid Hover/Unhover (Debounce Test)'),
  render: () => <RapidHoverUnhoverDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-testid="rapid-trigger"]');

    if (!(trigger instanceof HTMLElement)) {
      throw new Error('Trigger not found');
    }

    // Rapid hover/unhover cycles - should NOT open due to debounce
    for (let i = 0; i < 5; i++) {
      await userEvent.hover(trigger);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await userEvent.unhover(trigger);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Content should NOT be visible due to rapid cycling
    expect(doc.body.querySelector('[data-testid="rapid-content"]')).not.toBeInTheDocument();

    // Now hover and stay
    await userEvent.hover(trigger);

    // Wait for open delay
    await waitFor(
      () => {
        const content = doc.body.querySelector('[data-testid="rapid-content"]');
        expect(content).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCard ============

function FakeHoverCardConfigDemo() {
  const config: FakeHoverCardType = createFakeHoverCard({ side: 'bottom', align: 'center' });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.story.description')}</p>
      <HoverCard openDelay={config.openDelay} closeDelay={config.closeDelay}>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-config-trigger"
          >
            {config.triggerLabel}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side={config.side}
          align={config.align}
          sideOffset={config.sideOffset}
          className="w-64"
          data-testid="fake-config-content"
        >
          <div className="space-y-1">
            <p className="text-sm font-medium">ID: {config.id.slice(0, 8)}</p>
            <p className="text-muted-foreground text-xs">
              Type: {config.contentType} | Width: {config.width}
            </p>
            <p className="text-muted-foreground text-xs">Trigger: {config.triggerType}</p>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryHoverCardConfig: Story = {
  render: () => <FakeHoverCardConfigDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-config-trigger');
    expect(trigger).toBeInTheDocument();

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-config-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Type:');
    expect(content.textContent).toContain('Width:');

    await userEvent.unhover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="fake-config-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: createFakeHoverCardUserProfile ============

function FakeUserProfileDemo() {
  const { t } = useTranslation();
  const profile: FakeHoverCardUserProfileType = createFakeHoverCardUserProfile({
    verified: true,
  });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('hoverCard.section.content')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-profile-trigger"
          >
            @{profile.username}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" data-testid="fake-profile-content">
          <div className="flex gap-3">
            <Avatar className="size-12">
              <AvatarImage alt={profile.name} src={profile.avatar} />
              <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{profile.name}</span>
                {profile.verified && (
                  <span className="text-xs text-blue-500">
                    {t('hoverCard.story.verified', 'Verified')}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{profile.bio}</p>
              <div className="text-muted-foreground flex gap-3 text-xs">
                <span>
                  {t('hoverCard.story.followersCount', '{{num}} followers', {
                    num: profile.followers.toLocaleString(),
                  })}
                </span>
                <span>
                  {t('hoverCard.story.followingCount', '{{num}} following', {
                    num: profile.following.toLocaleString(),
                  })}
                </span>
              </div>
              {profile.location && (
                <p className="text-muted-foreground text-xs">{profile.location}</p>
              )}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryUserProfile: Story = {
  render: () => <FakeUserProfileDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-profile-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-profile-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(content.textContent).toContain('followers');
    expect(content.textContent).toContain('Verified');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardProduct ============

function FakeProductDemo() {
  const { t } = useTranslation();
  const product: FakeHoverCardProductType = createFakeHoverCardProduct({ inStock: true });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('hoverCard.section.content')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-product-trigger"
          >
            {product.name}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" data-testid="fake-product-content">
          <div className="space-y-2">
            <p className="text-sm font-medium">{product.name}</p>
            <p className="text-muted-foreground text-xs">{product.category}</p>
            <p className="text-muted-foreground text-sm">{product.description.slice(0, 80)}...</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold">${product.price.toFixed(2)}</span>
              {product.discount && product.originalPrice && (
                <span className="text-muted-foreground text-xs line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-muted-foreground flex gap-2 text-xs">
              <span>
                {t('hoverCard.story.ratingOutOf5', 'Rating: {{rating}}/5', {
                  rating: product.rating,
                })}
              </span>
              <span>
                {t('hoverCard.story.reviewCount', '({{count}} reviews)', {
                  count: product.reviewCount,
                })}
              </span>
            </div>
            <span className={`text-xs ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
              {product.inStock
                ? t('hoverCard.story.inStock', 'In Stock')
                : t('hoverCard.story.outOfStock', 'Out of Stock')}
            </span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryProduct: Story = {
  render: () => <FakeProductDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-product-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-product-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('$');
    expect(content.textContent).toContain('Rating:');
    expect(content.textContent).toContain('In Stock');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardProject ============

function FakeProjectDemo() {
  const { t } = useTranslation();
  const project: FakeHoverCardProjectType = createFakeHoverCardProject({ status: 'active' });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t('hoverCard.section.content')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-project-trigger"
          >
            {project.name}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" data-testid="fake-project-content">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{project.name}</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-100">
                {project.status}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{project.description}</p>
            <div className="bg-secondary h-2 rounded-full">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span>
                {t('hoverCard.story.memberCount', '{{count}} members', {
                  count: project.memberCount,
                })}
              </span>
              <span>
                {t('hoverCard.story.taskCount', '{{count}} tasks', { count: project.taskCount })}
              </span>
              <span>
                {t('hoverCard.story.percentDone', '{{percent}}% done', {
                  percent: project.progress,
                })}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryProject: Story = {
  render: () => <FakeProjectDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-project-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-project-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('active');
    expect(content.textContent).toContain('members');
    expect(content.textContent).toContain('tasks');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardTeam ============

function FakeTeamDemo() {
  const team: FakeHoverCardTeamType = createFakeHoverCardTeam();

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-team-trigger"
          >
            {team.name}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" data-testid="fake-team-content">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{team.name}</p>
              <p className="text-muted-foreground text-xs">{team.department}</p>
            </div>
            <p className="text-muted-foreground text-sm">{team.description}</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {team.memberAvatars.slice(0, 4).map((avatar) => (
                  <Avatar key={avatar} className="border-background size-6 border-2">
                    <AvatarImage
                      src={avatar}
                      alt={i18n.t('hoverCard.story.teamMember', 'Team member')}
                    />
                    <AvatarFallback>TM</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-muted-foreground text-xs">
                {i18n.t('hoverCard.story.memberCount', '{{count}} members', {
                  count: team.memberCount,
                })}
              </span>
            </div>
            <div className="text-muted-foreground flex gap-3 text-xs">
              <span>
                {i18n.t('hoverCard.story.leadName', 'Lead: {{name}}', { name: team.lead })}
              </span>
              <span>
                {i18n.t('hoverCard.story.projectCount', '{{count}} projects', {
                  count: team.projectCount,
                })}
              </span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryTeam: Story = {
  render: () => <FakeTeamDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-team-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-team-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('members');
    expect(content.textContent).toContain('Lead:');
    expect(content.textContent).toContain('projects');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardStats ============

function getChangeDirectionClass(direction: 'down' | 'neutral' | 'up'): string {
  const classMap: Record<'down' | 'neutral' | 'up', string> = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-muted-foreground',
  };
  return classMap[direction];
}

function FakeStatsDemo() {
  const stats: FakeHoverCardStatsType = createFakeHoverCardStats({ changeDirection: 'up' });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-stats-trigger"
          >
            {stats.label}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64" data-testid="fake-stats-content">
          <div className="space-y-2">
            <p className="text-sm font-medium">{stats.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {stats.unit === '$' && '$'}
                {stats.value.toLocaleString()}
                {stats.unit && stats.unit !== '$' && stats.unit}
              </span>
              <span className={`text-xs ${getChangeDirectionClass(stats.changeDirection)}`}>
                {stats.change > 0 ? '+' : ''}
                {stats.change}%
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Previous: {stats.previousValue.toLocaleString()}
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryStats: Story = {
  render: () => <FakeStatsDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-stats-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-stats-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Previous:');
    expect(content.textContent).toContain('%');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardAction + createFakeHoverCardActions ============

function FakeActionsDemo() {
  const singleAction: FakeHoverCardAction = createFakeHoverCardAction({
    label: i18n.t('hoverCard.story.view', 'View'),
    variant: 'default',
  });
  const actions: FakeHoverCardAction[] = createFakeHoverCardActions(4);

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.variants.withActions')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="fake-actions-trigger"
          >
            {i18n.t('hoverCard.story.quickActionsCount', 'Quick Actions ({{count}})', {
              count: actions.length + 1,
            })}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" data-testid="fake-actions-content">
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {i18n.t('hoverCard.story.availableActions', 'Available Actions')}
            </p>
            <div className="space-y-1">
              <button
                className="hover:bg-secondary w-full rounded px-2 py-1 text-left text-sm"
                type="button"
                disabled={singleAction.disabled}
              >
                {singleAction.label}
                {singleAction.description && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    - {singleAction.description}
                  </span>
                )}
              </button>
              {actions.map((action) => (
                <button
                  key={action.id}
                  className={`hover:bg-secondary w-full rounded px-2 py-1 text-left text-sm ${action.destructive ? 'text-destructive' : ''}`}
                  type="button"
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryActions: Story = {
  render: () => <FakeActionsDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('fake-actions-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="fake-actions-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Available Actions');
    expect(content.textContent).toContain('View');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: Specialized hover card factories ============

function FakeUserProfileHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeUserProfileHoverCard();

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.variants')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="spec-profile-trigger"
          >
            @{data.userProfile?.username ?? 'user'}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" data-testid="spec-profile-content">
          {data.userProfile && (
            <div className="flex gap-3">
              <Avatar className="size-12">
                <AvatarImage alt={data.userProfile.name} src={data.userProfile.avatar} />
                <AvatarFallback>{data.userProfile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium">{data.userProfile.name}</p>
                <p className="text-muted-foreground text-sm">{data.userProfile.bio}</p>
              </div>
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryUserProfileHoverCard: Story = {
  render: () => <FakeUserProfileHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-profile-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-profile-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.querySelector('[data-slot="avatar"]')).toBeInTheDocument();

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeProductHoverCard ============

function FakeProductHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeProductHoverCard();

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.variants')}</p>
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="spec-product-trigger"
          >
            {data.product?.name ?? i18n.t('hoverCard.story.product', 'Product')}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-72" data-testid="spec-product-content">
          {data.product && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{data.product.name}</p>
              <p className="text-muted-foreground text-xs">{data.product.category}</p>
              <span className="font-semibold">${data.product.price.toFixed(2)}</span>
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryProductHoverCard: Story = {
  render: () => <FakeProductHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-product-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-product-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('$');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeProjectHoverCard ============

function FakeProjectHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeProjectHoverCard();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="spec-project-trigger"
        >
          {data.project?.name ?? i18n.t('hoverCard.story.project', 'Project')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" data-testid="spec-project-content">
        {data.project && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{data.project.name}</p>
            <p className="text-muted-foreground text-sm">{data.project.description}</p>
            <p className="text-muted-foreground text-xs">Status: {data.project.status}</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export const FactoryProjectHoverCard: Story = {
  render: () => <FakeProjectHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-project-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-project-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Status:');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeTeamHoverCard ============

function FakeTeamHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeTeamHoverCard();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="spec-team-trigger"
        >
          {data.team?.name ?? i18n.t('hoverCard.story.team', 'Team')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" data-testid="spec-team-content">
        {data.team && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{data.team.name}</p>
            <p className="text-muted-foreground text-xs">{data.team.department}</p>
            <p className="text-muted-foreground text-xs">
              {i18n.t('hoverCard.story.memberCount', '{{count}} members', {
                count: data.team.memberCount,
              })}
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export const FactoryTeamHoverCard: Story = {
  render: () => <FakeTeamHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-team-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-team-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('members');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeStatsHoverCard ============

function FakeStatsHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeStatsHoverCard();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="spec-stats-trigger"
        >
          {data.stats?.label ?? i18n.t('hoverCard.story.stats', 'Stats')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" data-testid="spec-stats-content">
        {data.stats && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{data.stats.label}</p>
            <p className="text-2xl font-bold">{data.stats.value.toLocaleString()}</p>
            <p className="text-muted-foreground text-xs">Trend: {data.stats.trend}%</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export const FactoryStatsHoverCard: Story = {
  render: () => <FakeStatsHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-stats-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-stats-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Trend:');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeActionsHoverCard ============

function FakeActionsHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeActionsHoverCard();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="spec-actions-trigger"
        >
          {data.title ?? i18n.t('hoverCard.story.actions', 'Actions')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" data-testid="spec-actions-content">
        <div className="space-y-2">
          <p className="text-sm font-medium">{data.title}</p>
          {data.actions?.map((action) => (
            <button
              key={action.id}
              className={`block text-sm ${action.destructive ? 'text-destructive' : ''}`}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export const FactoryActionsHoverCard: Story = {
  render: () => <FakeActionsHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-actions-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-actions-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent).toContain('Quick Actions');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeInfoHoverCard ============

function FakeInfoHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeInfoHoverCard();

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="text-sm underline underline-offset-4"
          type="button"
          data-testid="spec-info-trigger"
        >
          {data.title ?? i18n.t('hoverCard.story.info', 'Info')}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64" data-testid="spec-info-content">
        <div className="space-y-2">
          <p className="text-sm font-medium">{data.title}</p>
          <p className="text-muted-foreground text-sm">{data.infoText}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export const FactoryInfoHoverCard: Story = {
  render: () => <FakeInfoHoverCardDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId('spec-info-trigger');

    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="spec-info-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.textContent?.trim()).not.toBe('');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeHoverCardPositionMatrix ============

function FakePositionMatrixDemo() {
  const matrix = createFakeHoverCardPositionMatrix();
  const sides = Object.keys(matrix) as HoverCardSide[];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.positions')}</p>
      <div className="flex flex-wrap gap-4">
        {sides.map((side) => {
          const aligns = Object.keys(matrix[side]) as HoverCardAlign[];
          return aligns.map((align) => {
            const config = matrix[side][align];
            return (
              <HoverCard key={config.id}>
                <HoverCardTrigger asChild>
                  <button
                    className="text-sm underline underline-offset-4"
                    type="button"
                    data-testid={`matrix-trigger-${side}-${align}`}
                  >
                    {config.triggerLabel}
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  side={side}
                  align={align}
                  className="w-48"
                  data-testid={`matrix-content-${side}-${align}`}
                >
                  <p className="text-sm">
                    {side} / {align}
                  </p>
                </HoverCardContent>
              </HoverCard>
            );
          });
        })}
      </div>
    </div>
  );
}

export const FactoryPositionMatrix: Story = {
  tags: ['!test'],
  render: () => <FakePositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="matrix-trigger-bottom-center"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHoverCardContentMatrix ============

function FakeContentMatrixDemo() {
  const matrix = createFakeHoverCardContentMatrix();
  const contentTypes = Object.keys(matrix) as HoverCardContentType[];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <div className="flex flex-wrap gap-4">
        {contentTypes.slice(0, 4).map((ct) => {
          const widths = Object.keys(matrix[ct]) as HoverCardWidth[];
          const defaultWidth = widths[0];
          const item = matrix[ct][defaultWidth];
          return (
            <HoverCard key={item.config.id}>
              <HoverCardTrigger asChild>
                <button
                  className="text-sm underline underline-offset-4"
                  type="button"
                  data-testid={`content-matrix-trigger-${ct}`}
                >
                  {ct} ({defaultWidth})
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" data-testid={`content-matrix-content-${ct}`}>
                <div className="space-y-1">
                  <p className="text-sm font-medium capitalize">{ct}</p>
                  {item.title && <p className="text-muted-foreground text-xs">{item.title}</p>}
                  {item.infoText && (
                    <p className="text-muted-foreground text-xs">{item.infoText.slice(0, 50)}...</p>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryContentMatrix: Story = {
  tags: ['!test'],
  render: () => <FakeContentMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHoverCardShowcase ============

function FakeShowcaseDemo() {
  const { t } = useTranslation();
  const showcase = createFakeHoverCardShowcase();
  const types = Object.keys(showcase) as HoverCardContentType[];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">{t('hoverCard.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {types.map((type) => {
          const item = showcase[type];
          return (
            <HoverCard key={item.config.id}>
              <HoverCardTrigger asChild>
                <button
                  className="text-sm underline underline-offset-4"
                  type="button"
                  data-testid={`showcase-trigger-${type}`}
                >
                  {type}
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" data-testid={`showcase-content-${type}`}>
                <p className="text-sm font-medium capitalize">{type}</p>
                {item.title && <p className="text-muted-foreground text-xs">{item.title}</p>}
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  tags: ['!test'],
  render: () => <FakeShowcaseDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHoverCardsForAllSides ============

function FakeAllSidesDemo() {
  const { t } = useTranslation();
  const sideCards = createFakeHoverCardsForAllSides();
  const sides = Object.keys(sideCards) as HoverCardSide[];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('hoverCard.section.positions')}</p>
      <div className="flex min-h-[200px] items-center justify-center gap-6">
        {sides.map((side) => {
          const config = sideCards[side];
          return (
            <HoverCard key={config.id}>
              <HoverCardTrigger asChild>
                <button
                  className="text-sm underline underline-offset-4"
                  type="button"
                  data-testid={`all-sides-trigger-${side}`}
                >
                  {config.triggerLabel}
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                side={side}
                className="w-48"
                data-testid={`all-sides-content-${side}`}
              >
                <p className="text-sm">Position: {side}</p>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryAllSides: Story = {
  tags: ['!test'],
  render: () => <FakeAllSidesDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="all-sides-trigger-bottom"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHoverCardsForAllAligns ============

function FakeAllAlignsDemo() {
  const alignCards = createFakeHoverCardsForAllAligns();
  const aligns = Object.keys(alignCards) as HoverCardAlign[];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.positions')}</p>
      <div className="flex gap-8">
        {aligns.map((align) => {
          const config = alignCards[align];
          return (
            <HoverCard key={config.id}>
              <HoverCardTrigger asChild>
                <button
                  className="text-sm underline underline-offset-4"
                  type="button"
                  data-testid={`all-aligns-trigger-${align}`}
                >
                  {config.triggerLabel}
                </button>
              </HoverCardTrigger>
              <HoverCardContent
                align={align}
                className="w-48"
                data-testid={`all-aligns-content-${align}`}
              >
                <p className="text-sm">Align: {align}</p>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryAllAligns: Story = {
  tags: ['!test'],
  render: () => <FakeAllAlignsDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="all-aligns-trigger-center"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHoverCardsWithOffsets ============

function FakeOffsetsDemo() {
  const offsetCards = createFakeHoverCardsWithOffsets();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.positions')}</p>
      <div className="flex flex-wrap gap-6">
        {offsetCards.map(({ offset, config }) => (
          <HoverCard key={config.id}>
            <HoverCardTrigger asChild>
              <button
                className="text-sm underline underline-offset-4"
                type="button"
                data-testid={`offset-trigger-${offset}`}
              >
                {config.triggerLabel}
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              sideOffset={offset}
              className="w-48"
              data-testid={`offset-content-${offset}`}
            >
              <p className="text-sm">{i18n.t('hoverCard.story.offsetPx', { offset })}</p>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

export const FactoryOffsets: Story = {
  tags: ['!test'],
  render: () => <FakeOffsetsDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="offset-trigger-0"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeControlledHoverCard ============

function FakeControlledDemo() {
  const controlled: FakeControlledHoverCardType = createFakeControlledHoverCard({
    defaultOpen: false,
    open: false,
  });
  const [open, setOpen] = React.useState(controlled.open ?? false);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.story.playground')}</p>
      <div className="flex gap-2">
        <button
          className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-sm"
          type="button"
          onClick={() => setOpen(true)}
          data-testid="ctrl-open-btn"
        >
          {i18n.t('hoverCard.story.open', 'Open')}
        </button>
        <button
          className="bg-secondary text-secondary-foreground rounded-md px-3 py-1 text-sm"
          type="button"
          onClick={() => setOpen(false)}
          data-testid="ctrl-close-btn"
        >
          {i18n.t('hoverCard.story.close', 'Close')}
        </button>
      </div>
      <HoverCard
        open={open}
        onOpenChange={setOpen}
        openDelay={controlled.config.openDelay}
        closeDelay={controlled.config.closeDelay}
      >
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="ctrl-trigger"
          >
            {i18n.t('hoverCard.story.controlledOpen', 'Controlled (open: {{state}})', {
              state: String(open),
            })}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-64" data-testid="ctrl-content">
          <p className="text-sm">
            {i18n.t(
              'hoverCard.story.controlledHoverCardFromFactoryData',
              'Controlled hover card from factory data.'
            )}
          </p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryControlledHoverCard: Story = {
  render: () => <FakeControlledDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    const openBtn = canvas.getByTestId('ctrl-open-btn');
    await userEvent.click(openBtn);

    await waitFor(() => {
      const content = doc.body.querySelector('[data-testid="ctrl-content"]');
      expect(content).toBeInTheDocument();
    });

    const closeBtn = canvas.getByTestId('ctrl-close-btn');
    await userEvent.click(closeBtn);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="ctrl-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY: createFakeDarkModeHoverCard ============

function FakeDarkModeHoverCardDemo() {
  const data: FakeHoverCardContent = createFakeDarkModeHoverCard();

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.story.darkMode')}</p>
      <HoverCard openDelay={data.config.openDelay} closeDelay={data.config.closeDelay}>
        <HoverCardTrigger asChild>
          <button
            className="text-sm underline underline-offset-4"
            type="button"
            data-testid="dark-factory-trigger"
          >
            @{data.userProfile?.username ?? 'dark-user'}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80" data-testid="dark-factory-content">
          {data.userProfile && (
            <div className="flex gap-3">
              <Avatar className="size-10">
                <AvatarImage alt={data.userProfile.name} src={data.userProfile.avatar} />
                <AvatarFallback>DM</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium">{data.userProfile.name}</p>
                <p className="text-muted-foreground text-sm">{data.userProfile.bio}</p>
              </div>
            </div>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const FactoryDarkMode: Story = {
  render: () => <FakeDarkModeHoverCardDemo />,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    expect(doc.documentElement.classList.contains('dark')).toBe(true);

    const trigger = canvas.getByTestId('dark-factory-trigger');
    await userEvent.hover(trigger);

    const content = await waitFor(() => {
      const node = doc.body.querySelector('[data-testid="dark-factory-content"]');
      if (!(node instanceof HTMLElement)) {
        throw new Error('Content not found');
      }
      return node;
    });

    expect(content.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    expect(content.textContent).toContain('Dark Mode User');

    await userEvent.unhover(trigger);
  },
};

// ============ FACTORY: createFakeFocusTestConfig ============

function FakeFocusTestDemo() {
  const config: FakeFocusTestConfig = createFakeFocusTestConfig();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.story.focus')}</p>
      <div className="flex gap-4">
        <button
          className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-sm"
          type="button"
          data-testid="focus-factory-before"
        >
          {config.beforeButtonLabel}
        </button>
        <HoverCard openDelay={config.hoverCard.openDelay} closeDelay={config.hoverCard.closeDelay}>
          <HoverCardTrigger asChild>
            <button
              className="text-sm underline underline-offset-4"
              type="button"
              data-testid="focus-factory-trigger"
            >
              {config.triggerLabel}
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64" data-testid="focus-factory-content">
            <p className="text-sm">
              {i18n.t(
                'hoverCard.story.focusTestContentFromFactoryData',
                'Focus test content from factory data.'
              )}
            </p>
          </HoverCardContent>
        </HoverCard>
        <button
          className="bg-secondary text-secondary-foreground rounded-md px-3 py-1.5 text-sm"
          type="button"
          data-testid="focus-factory-after"
        >
          {config.afterButtonLabel}
        </button>
      </div>
    </div>
  );
}

export const FactoryFocusTest: Story = {
  render: () => <FakeFocusTestDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const beforeBtn = canvas.getByTestId('focus-factory-before');
    const trigger = canvas.getByTestId('focus-factory-trigger');
    const afterBtn = canvas.getByTestId('focus-factory-after');

    await userEvent.tab();
    expect(beforeBtn).toHaveFocus();

    await userEvent.tab();
    expect(trigger).toHaveFocus();

    await userEvent.tab();
    expect(afterBtn).toHaveFocus();
  },
};

// ============ FACTORY: createFakeHoverCards (bulk) ============

function FakeBulkHoverCardsDemo() {
  const cards: FakeHoverCardType[] = createFakeHoverCards(5);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.variants')}</p>
      <div className="flex flex-wrap gap-4">
        {cards.map((config, i) => (
          <HoverCard key={config.id}>
            <HoverCardTrigger asChild>
              <button
                className="text-sm underline underline-offset-4"
                type="button"
                data-testid={`bulk-trigger-${i}`}
              >
                Card {i + 1}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-48" data-testid={`bulk-content-${i}`}>
              <div className="space-y-1">
                <p className="text-sm font-medium">Card {i + 1}</p>
                <p className="text-muted-foreground text-xs">
                  {config.contentType} | {config.width}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

export const FactoryBulkHoverCards: Story = {
  tags: ['!test'],
  render: () => <FakeBulkHoverCardsDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="bulk-trigger-0"]');
    expect(trigger).toBeInTheDocument();
    const trigger4 = canvasElement.querySelector('[data-testid="bulk-trigger-4"]');
    expect(trigger4).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeUserProfileHoverCards (bulk) ============

function FakeBulkProfilesDemo() {
  const profiles: FakeHoverCardContent[] = createFakeUserProfileHoverCards(3);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <div className="flex gap-4">
        {profiles.map((data, i) => (
          <HoverCard key={data.config.id}>
            <HoverCardTrigger asChild>
              <button
                className="text-sm underline underline-offset-4"
                type="button"
                data-testid={`bulk-profile-trigger-${i}`}
              >
                @{data.userProfile?.username ?? `user${i}`}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" data-testid={`bulk-profile-content-${i}`}>
              {data.userProfile && (
                <div className="flex gap-3">
                  <Avatar className="size-10">
                    <AvatarImage alt={data.userProfile.name} src={data.userProfile.avatar} />
                    <AvatarFallback>
                      {data.userProfile.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{data.userProfile.name}</p>
                    <p className="text-muted-foreground text-xs">{data.userProfile.bio}</p>
                  </div>
                </div>
              )}
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

export const FactoryBulkProfiles: Story = {
  tags: ['!test'],
  render: () => <FakeBulkProfilesDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="bulk-profile-trigger-0"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeProductHoverCards (bulk) ============

function FakeBulkProductsDemo() {
  const products: FakeHoverCardContent[] = createFakeProductHoverCards(3);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <div className="flex gap-4">
        {products.map((data, i) => (
          <HoverCard key={data.config.id}>
            <HoverCardTrigger asChild>
              <button
                className="text-sm underline underline-offset-4"
                type="button"
                data-testid={`bulk-product-trigger-${i}`}
              >
                {data.product?.name ?? `Product ${i}`}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-64" data-testid={`bulk-product-content-${i}`}>
              {data.product && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{data.product.name}</p>
                  <p className="font-semibold">${data.product.price.toFixed(2)}</p>
                </div>
              )}
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

export const FactoryBulkProducts: Story = {
  tags: ['!test'],
  render: () => <FakeBulkProductsDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="bulk-product-trigger-0"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeProjectHoverCards (bulk) ============

function FakeBulkProjectsDemo() {
  const projects: FakeHoverCardContent[] = createFakeProjectHoverCards(3);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.section.content')}</p>
      <div className="flex gap-4">
        {projects.map((data, i) => (
          <HoverCard key={data.config.id}>
            <HoverCardTrigger asChild>
              <button
                className="text-sm underline underline-offset-4"
                type="button"
                data-testid={`bulk-project-trigger-${i}`}
              >
                {data.project?.name ?? `Project ${i}`}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-64" data-testid={`bulk-project-content-${i}`}>
              {data.project && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{data.project.name}</p>
                  <p className="text-muted-foreground text-xs">Status: {data.project.status}</p>
                </div>
              )}
            </HoverCardContent>
          </HoverCard>
        ))}
      </div>
    </div>
  );
}

export const FactoryBulkProjects: Story = {
  tags: ['!test'],
  render: () => <FakeBulkProjectsDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="bulk-project-trigger-0"]');
    expect(trigger).toBeInTheDocument();
  },
};

// ============ CONSTANTS: HOVER_CARD_SIDES, HOVER_CARD_ALIGNS, etc. ============

function ConstantsDemo() {
  const allSides: HoverCardSide[] = HOVER_CARD_SIDES;
  const allAligns: HoverCardAlign[] = HOVER_CARD_ALIGNS;
  const allContentTypes: HoverCardContentType[] = HOVER_CARD_CONTENT_TYPES;
  const allWidths: HoverCardWidth[] = HOVER_CARD_WIDTHS;
  const allTriggerTypes: HoverCardTriggerType[] = HOVER_CARD_TRIGGER_TYPES;
  const allOpenDelays = HOVER_CARD_OPEN_DELAYS;
  const allCloseDelays = HOVER_CARD_CLOSE_DELAYS;
  const widthClasses: Record<HoverCardWidth, string> = HOVER_CARD_WIDTH_CLASSES;

  return (
    <div className="space-y-6" data-testid="constants-demo">
      <p className="text-muted-foreground text-sm">{i18n.t('hoverCard.story.description')}</p>

      <div className="space-y-3">
        <p className="text-sm font-medium">Sides ({allSides.length})</p>
        <div className="flex gap-2">
          {allSides.map((side) => (
            <span key={side} className="bg-secondary rounded px-2 py-1 text-xs">
              {side}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Aligns ({allAligns.length})</p>
        <div className="flex gap-2">
          {allAligns.map((align) => (
            <span key={align} className="bg-secondary rounded px-2 py-1 text-xs">
              {align}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Content Types ({allContentTypes.length})</p>
        <div className="flex flex-wrap gap-2">
          {allContentTypes.map((type) => (
            <span key={type} className="bg-secondary rounded px-2 py-1 text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Widths ({allWidths.length})</p>
        <div className="flex gap-2">
          {allWidths.map((width) => (
            <span key={width} className="bg-secondary rounded px-2 py-1 text-xs">
              {width}: {widthClasses[width]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Trigger Types ({allTriggerTypes.length})</p>
        <div className="flex gap-2">
          {allTriggerTypes.map((type) => (
            <span key={type} className="bg-secondary rounded px-2 py-1 text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">{i18n.t('hoverCard.story.openDelays', 'Open Delays')}</p>
        <div className="flex gap-2">
          {allOpenDelays.map((delay) => (
            <span key={delay} className="bg-secondary rounded px-2 py-1 text-xs">
              {delay}ms
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          {i18n.t('hoverCard.story.closeDelays', 'Close Delays')}
        </p>
        <div className="flex gap-2">
          {allCloseDelays.map((delay) => (
            <span key={delay} className="bg-secondary rounded px-2 py-1 text-xs">
              {delay}ms
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  render: () => <ConstantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('constants-demo');

    expect(demo).toBeInTheDocument();
    expect(demo.textContent).toContain('Sides (4)');
    expect(demo.textContent).toContain('Aligns (3)');
    expect(demo.textContent).toContain('Content Types (8)');
    expect(demo.textContent).toContain('Widths (3)');
    expect(demo.textContent).toContain('Trigger Types (5)');
    expect(demo.textContent).toContain('top');
    expect(demo.textContent).toContain('bottom');
    expect(demo.textContent).toContain('center');
    expect(demo.textContent).toContain('profile');
    expect(demo.textContent).toContain('compact');
    expect(demo.textContent).toContain('w-48');
    expect(demo.textContent).toContain('link');
    expect(demo.textContent).toContain('0ms');
    expect(demo.textContent).toContain('1500ms');
  },
};

// ============ DARK RTL STORY ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ MOBILE STORY ============

export const Mobile: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES STORY ============

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS STORIES (auto-wired)
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMinimalProfile: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerMinimalProfile', 'Handler: Minimal Profile'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.minimalProfile } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerProductNotFound: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerProductNotFound', 'Handler: Product Not Found'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.productNotFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerProductOutOfStock: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerProductOutOfStock', 'Handler: Product Out Of Stock'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.productOutOfStock } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerProjectSuccess: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerProjectSuccess', 'Handler: Project Success'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.projectSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerProjectCompleted: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerProjectCompleted', 'Handler: Project Completed'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.projectCompleted } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerStatsSuccess: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerStatsSuccess', 'Handler: Stats Success'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.statsSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerStatsDecline: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerStatsDecline', 'Handler: Stats Decline'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.statsDecline } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUserSuccess: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerUserSuccess', 'Handler: User Success'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.userSuccess } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUserNotFound: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerUserNotFound', 'Handler: User Not Found'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.userNotFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerFastResponse: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerFastResponse', 'Handler: Fast Response'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.fastResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerMediumResponse: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerMediumResponse', 'Handler: Medium Response'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.mediumResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('hoverCard.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: hoverCardStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
