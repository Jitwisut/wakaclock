import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';

import type {
  FakeReel,
  FakeReelItem,
  FakeReelItemWithMetrics,
  FakeReelLabels,
  FakeReelUser,
  ReelAspectRatio,
  ReelCategory,
  ReelMediaType,
  ReelPlaybackState,
} from '@/.storybook/stories/_factories/reel.factory';
import {
  createFakeAllReadReel,
  createFakeImageReel,
  createFakeLongDurationReel,
  createFakePausedReel,
  createFakePlayingReel,
  createFakeReel,
  createFakeReelAtIndex,
  createFakeReelItem,
  createFakeReelItems,
  createFakeReelItemWithMetrics,
  createFakeReelLabels,
  createFakeReels,
  createFakeReelUser,
  createFakeShortDurationReel,
  createFakeSingleItemReel,
  createFakeUnmutedReel,
  createFakeUnreadReel,
  createFakeUserStoryReel,
  createFakeVideoReel,
  createReelDurationMatrix,
  createReelIndexMatrix,
  createReelMediaTypeMatrix,
  createReelPlaybackStateMatrix,
  createReelShowcase,
  createReelTestData,
  DEFAULT_REEL_LABELS,
  formatCount,
  REEL_ASPECT_RATIOS,
  REEL_CATEGORIES,
  REEL_DURATIONS,
  REEL_MEDIA_TYPES,
  REEL_PLAYBACK_STATES,
} from '@/.storybook/stories/_factories/reel.factory';
import { reelHandlers, reelStatusHandlers } from '@/.storybook/stories/_handlers/reel.handlers';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Reel,
  ReelContent,
  ReelControls,
  ReelImage,
  ReelItem,
  type ReelItem as ReelItemType,
  type ReelLabels,
  ReelMuteButton,
  ReelNavigation,
  ReelNextButton,
  ReelPlayButton,
  ReelPreviousButton,
  ReelProgress,
} from '@/components/ui/reel';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

const defaultData: ReelItemType[] = [
  {
    id: 1,
    type: 'image',
    username: 'Ada Lovelace',
    avatar: '/images/avatars/01.png',
    src: '/images/food/coffee3.jpg',
    duration: 4,
    alt: 'Coffee',
    title: 'Coffee break',
    description: 'A quick espresso shot.',
    isRead: false,
  },
  {
    id: 2,
    type: 'image',
    username: 'Grace Hopper',
    avatar: '/images/avatars/02.png',
    src: '/images/food/pizza2.jpg',
    duration: 4,
    alt: 'Pizza',
    title: 'Slice of pizza',
    description: 'Cheesy and crisp.',
    isRead: false,
  },
  {
    id: 3,
    type: 'image',
    username: 'Alan Turing',
    avatar: '/images/avatars/03.png',
    src: '/images/food/burger2.jpg',
    duration: 4,
    alt: 'Burger',
    title: 'Burger time',
    description: 'Classic comfort food.',
    isRead: true,
  },
];

type ReelDemoProps = {
  data?: ReelItemType[];
  labels?: Partial<ReelLabels>;
  navigationLabel?: string;
  progressAriaLabel?: ReelProgressAriaLabel;
};

type ReelProgressAriaLabel = (item: ReelItemType, index: number, isActive: boolean) => string;

const defaultProgressAriaLabel: ReelProgressAriaLabel = (item, index, isActive) =>
  `Reel progress ${index + 1} (${item.id})${isActive ? ' (active)' : ''}`;

function ReelDemo({
  data = defaultData,
  labels,
  navigationLabel = 'Navigate reel items',
  progressAriaLabel = defaultProgressAriaLabel,
}: ReelDemoProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  return (
    <div
      className="flex justify-center"
      data-reel-current-id={data[currentIndex]?.id}
      data-reel-current-index={currentIndex}
      data-reel-demo
      data-testid="reel-demo"
    >
      <Reel
        className="h-[620px] rounded-xl"
        data={data}
        labels={labels}
        onIndexChange={setCurrentIndex}
      >
        <ReelContent>
          {(item) => (
            <ReelItem>
              <ReelImage
                alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                duration={item.duration}
                src={item.src}
              />
              <ReelProgress>
                {(item, index, isActive, progress) => (
                  <Progress
                    aria-label={progressAriaLabel(item, index, isActive)}
                    className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
                    data-reel-progress-active={String(isActive)}
                    data-reel-progress-index={index}
                    data-reel-progress
                    value={progress}
                  />
                )}
              </ReelProgress>

              <div className="absolute top-0 right-0 left-0 z-30 flex items-center gap-2 p-4 pt-6 text-white">
                <Avatar className="size-8 border border-white/20">
                  <AvatarImage alt={item.username} src={item.avatar} />
                  <AvatarFallback>{item.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-sm font-medium" data-reel-username>
                  {item.username}
                </div>
              </div>

              <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                <div className="text-sm font-medium" data-reel-title>
                  {item.title}
                </div>
                <div className="text-sm text-white/80" data-reel-description>
                  {item.description}
                </div>
              </div>
            </ReelItem>
          )}
        </ReelContent>

        <ReelNavigation aria-label={navigationLabel} data-reel-navigation />

        <ReelControls>
          <div className="flex items-center gap-2">
            <ReelPreviousButton data-reel-control="previous" />
            <ReelNextButton data-reel-control="next" />
          </div>
          <div className="flex items-center gap-2">
            <ReelPlayButton data-reel-control="play" />
            <ReelMuteButton data-reel-control="mute" />
          </div>
        </ReelControls>
      </Reel>
    </div>
  );
}

function I18nReelDemo() {
  const { t } = useTranslation();

  const labels: ReelLabels = {
    previous: t('reel.controls.previous'),
    next: t('reel.controls.next'),
    play: t('reel.controls.play'),
    pause: t('reel.controls.pause'),
    mute: t('reel.controls.mute'),
    unmute: t('reel.controls.unmute'),
  };

  const data: ReelItemType[] = [
    {
      id: 1,
      type: 'image',
      username: 'Ada Lovelace',
      avatar: '/images/avatars/01.png',
      src: '/images/food/coffee3.jpg',
      duration: 4,
      alt: t('reel.item1.alt'),
      title: t('reel.item1.title'),
      description: t('reel.item1.description'),
      isRead: false,
    },
    {
      id: 2,
      type: 'image',
      username: 'Grace Hopper',
      avatar: '/images/avatars/02.png',
      src: '/images/food/pizza2.jpg',
      duration: 4,
      alt: t('reel.item2.alt'),
      title: t('reel.item2.title'),
      description: t('reel.item2.description'),
      isRead: false,
    },
    {
      id: 3,
      type: 'image',
      username: 'Alan Turing',
      avatar: '/images/avatars/03.png',
      src: '/images/food/burger2.jpg',
      duration: 4,
      alt: t('reel.item3.alt'),
      title: t('reel.item3.title'),
      description: t('reel.item3.description'),
      isRead: true,
    },
  ];

  return (
    <div data-testid="i18n-reel-demo">
      <ReelDemo
        data={data}
        labels={labels}
        navigationLabel={t('reel.navigation.ariaLabel')}
        progressAriaLabel={(item, index, isActive) =>
          t(isActive ? 'reel.progress.ariaLabel.active' : 'reel.progress.ariaLabel.inactive', {
            index: index + 1,
            id: item.id,
          })
        }
      />
    </div>
  );
}

const meta = {
  title: 'Components/UI/Reel',
  component: ReelDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    data: {
      control: 'object',
      description: i18n.t(
        'reel.argType.arrayOfReelItemsToDisplay',
        'Array of reel items to display'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReelItemType[]' },
      },
    },
    labels: {
      control: 'object',
      description: i18n.t(
        'reel.argType.buttonLabelsForAccessibilityPreviousNextPlayPauseMuteUnmute',
        'Button labels for accessibility (previous, next, play, pause, mute, unmute)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Partial<ReelLabels>' },
      },
    },
    navigationLabel: {
      control: 'text',
      description: i18n.t(
        'reel.argType.accessibleLabelForTheNavigationOverlay',
        'Accessible label for the navigation overlay'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Navigate reel items' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'reel.argType.additionalCssClassesForStyling',
        'Additional CSS classes for styling'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    autoPlay: {
      control: 'boolean',
      description: i18n.t('reel.argType.autoadvanceThroughItems', 'Auto-advance through items'),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    loop: {
      control: 'boolean',
      description: i18n.t(
        'reel.argType.loopBackToStartAfterLastItem',
        'Loop back to start after last item'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Layout
    direction: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: i18n.t('reel.argType.reelScrollDirection', 'Reel scroll direction'),
      table: {
        category: 'Layout',
        type: { summary: "'horizontal' | 'vertical'" },
        defaultValue: { summary: 'horizontal' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('reel.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('reel.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('reel.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('reel.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('reel.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('reel.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('reel.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onIndexChange: {
      action: 'onIndexChange',
      description: i18n.t(
        'reel.argType.calledWhenActiveIndexChanges',
        'Called when active index changes'
      ),
      table: { category: 'Events' },
    },
    // Reel Props Reference (Instagram Stories-like component):
    // - data: Array of reel items (ReelItem[])
    // - onIndexChange: Called when active index changes ((index: number) => void)
    // - labels: Button labels for accessibility (ReelLabels)
    //   - previous: Previous button label (string)
    //   - next: Next button label (string)
    //   - play: Play button label (string)
    //   - pause: Pause button label (string)
    //   - mute: Mute button label (string)
    //   - unmute: Unmute button label (string)
    // - autoPlay: Auto-advance through items (boolean, default: true)
    // - loop: Loop back to start after last item (boolean)
    // - className: Additional CSS classes (string)
    //
    // ReelItem Type:
    // - id: Unique item identifier (string | number)
    // - type: Content type ('image' | 'video')
    // - src: Media source URL (string)
    // - alt: Alt text for images (string)
    // - duration: Display duration in seconds (number)
    // - username: Author username (string)
    // - avatar: Author avatar URL (string)
    // - title: Item title (string)
    // - description: Item description (string)
    // - isRead: Whether item has been viewed (boolean)
    //
    // ReelContent Props Reference:
    // - children: Render function for each item ((item: ReelItem) => ReactNode)
    //
    // ReelNavigation Props Reference:
    // - aria-label: Accessible label (string, required)
    // Note: Invisible navigation overlay for touch/click
    //
    // ReelControls Props Reference:
    // - children: Control buttons (ReactNode)
    // Note: Container for ReelPlayButton, ReelMuteButton, etc.
    //
    // ReelProgress Props Reference:
    // - children: Render function for progress bars ((item, index, isActive, progress) => ReactNode)
    //
    // Control Components:
    // - ReelPreviousButton, ReelNextButton, ReelPlayButton, ReelMuteButton
  },
  parameters: {
    msw: { handlers: reelHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();

    const reelContent = canvasElement.querySelector('[data-reel-content]');

    if (!(reelContent instanceof HTMLElement)) {
      throw new Error('Reel content container was not found.');
    }

    const demoRoot = canvasElement.querySelector('[data-reel-demo]');

    if (!(demoRoot instanceof HTMLElement)) {
      throw new Error('Reel demo root was not found.');
    }

    const navigation = canvasElement.querySelector('[data-reel-navigation]');

    if (!(navigation instanceof HTMLButtonElement)) {
      throw new Error('Reel navigation button was not found.');
    }

    const playButton = canvasElement.querySelector('[data-reel-control="play"]');

    if (!(playButton instanceof HTMLButtonElement)) {
      throw new Error('Reel play/pause button was not found.');
    }

    const pauseLabel = playButton.getAttribute('aria-label');
    await userEvent.click(playButton);
    await waitFor(() => {
      expect(playButton.getAttribute('aria-label')).not.toBe(pauseLabel);
    });

    const previousButton = canvasElement.querySelector('[data-reel-control="previous"]');
    const nextButton = canvasElement.querySelector('[data-reel-control="next"]');

    if (!(previousButton instanceof HTMLButtonElement)) {
      throw new Error('Reel previous button was not found.');
    }

    if (!(nextButton instanceof HTMLButtonElement)) {
      throw new Error('Reel next button was not found.');
    }

    expect(previousButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    const muteToggle = canvasElement.querySelector('[data-reel-control="mute"]');

    if (!(muteToggle instanceof HTMLButtonElement)) {
      throw new Error('Reel mute button was not found.');
    }

    const unmuteLabel = muteToggle.getAttribute('aria-label');

    const progressBars = canvasElement.querySelectorAll('[data-reel-progress]');
    const activeProgress = canvasElement.querySelector('[data-reel-progress-active="true"]');

    expect(progressBars.length).toBe(3);
    expect(activeProgress?.getAttribute('data-reel-progress-index')).toBe('0');

    const getCurrentId = () => demoRoot.getAttribute('data-reel-current-id');

    expect(getCurrentId()).toBe('1');

    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(getCurrentId()).toBe('2');
    });

    expect(previousButton).not.toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    const activeProgressAfterNext = canvasElement.querySelector(
      '[data-reel-progress-active="true"]'
    );

    expect(activeProgressAfterNext?.getAttribute('data-reel-progress-index')).toBe('1');

    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(getCurrentId()).toBe('3');
    });

    expect(nextButton).toBeDisabled();

    await userEvent.click(muteToggle);
    await waitFor(() => {
      expect(muteToggle.getAttribute('aria-label')).not.toBe(unmuteLabel);
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    await Default.play?.(context);
  },
};

function VariantsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{t('reel.variants.horizontalScroll')}</p>
        <div className="flex justify-center">
          <Reel className="h-[400px] rounded-xl" data={defaultData.slice(0, 2)}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                    <div className="text-sm font-medium">{item.title}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
            <ReelControls>
              <div className="flex items-center gap-2">
                <ReelPreviousButton />
                <ReelNextButton />
              </div>
            </ReelControls>
          </Reel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('reel.variants.withProgress')}</p>
        <div className="flex justify-center">
          <Reel className="h-[400px] rounded-xl" data={defaultData}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <ReelProgress>
                    {(_item, index, _isActive, progress) => (
                      <Progress
                        aria-label={i18n.t('reel.story.progressIndex', 'Progress {{index}}', {
                          index: index + 1,
                        })}
                        className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
                        value={progress}
                      />
                    )}
                  </ReelProgress>
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                    <div className="text-sm font-medium">{item.title}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
          </Reel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('reel.variants.withFullControls')}</p>
        <div className="flex justify-center">
          <Reel className="h-[400px] rounded-xl" data={defaultData}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <ReelProgress>
                    {(_item, index, _isActive, progress) => (
                      <Progress
                        aria-label={i18n.t('reel.story.progressIndex', 'Progress {{index}}', {
                          index: index + 1,
                        })}
                        className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
                        value={progress}
                      />
                    )}
                  </ReelProgress>
                  <div className="absolute top-0 right-0 left-0 z-30 flex items-center gap-2 p-4 pt-6 text-white">
                    <Avatar className="size-8 border border-white/20">
                      <AvatarImage alt={item.username} src={item.avatar} />
                      <AvatarFallback>{item.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-sm font-medium">{item.username}</div>
                  </div>
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-sm text-white/80">{item.description}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
            <ReelControls>
              <div className="flex items-center gap-2">
                <ReelPreviousButton />
                <ReelNextButton />
              </div>
              <div className="flex items-center gap-2">
                <ReelPlayButton />
                <ReelMuteButton />
              </div>
            </ReelControls>
          </Reel>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all three variant reels are rendered
    const reels = canvasElement.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(3);

    // Verify first reel (horizontal scroll) has controls
    const firstReel = reels[0];
    expect(firstReel?.querySelector('[data-reel-navigation]')).toBeInTheDocument();
    expect(firstReel?.querySelector('[data-reel-control="previous"]')).toBeInTheDocument();
    expect(firstReel?.querySelector('[data-reel-control="next"]')).toBeInTheDocument();

    // Verify second reel (with progress) has progress bars
    const secondReel = reels[1];
    const progressBars = secondReel?.querySelectorAll('[data-reel-progress]');
    expect(progressBars?.length).not.toBe(0);

    // Verify third reel (full controls) has all controls
    const thirdReel = reels[2];
    expect(thirdReel?.querySelector('[data-reel-control="play"]')).toBeInTheDocument();
    expect(thirdReel?.querySelector('[data-reel-control="mute"]')).toBeInTheDocument();
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('reel.sizes.small')}</p>
        <div className="flex justify-center">
          <Reel className="h-[300px] rounded-xl" data={defaultData.slice(0, 2)}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-3 text-white">
                    <div className="text-xs font-medium">{item.title}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
            <ReelControls>
              <div className="flex items-center gap-1">
                <ReelPreviousButton />
                <ReelNextButton />
              </div>
            </ReelControls>
          </Reel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('reel.sizes.medium')}</p>
        <div className="flex justify-center">
          <Reel className="h-[480px] rounded-xl" data={defaultData.slice(0, 2)}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-white/80">{item.description}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
            <ReelControls>
              <div className="flex items-center gap-2">
                <ReelPreviousButton />
                <ReelNextButton />
              </div>
            </ReelControls>
          </Reel>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('reel.sizes.large')}</p>
        <div className="flex justify-center">
          <Reel className="h-[620px] rounded-xl" data={defaultData.slice(0, 2)}>
            <ReelContent>
              {(item) => (
                <ReelItem>
                  <ReelImage
                    alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                    duration={item.duration}
                    src={item.src}
                  />
                  <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                    <div className="text-base font-medium">{item.title}</div>
                    <div className="text-sm text-white/80">{item.description}</div>
                  </div>
                </ReelItem>
              )}
            </ReelContent>
            <ReelNavigation
              aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
            />
            <ReelControls>
              <div className="flex items-center gap-2">
                <ReelPreviousButton />
                <ReelNextButton />
              </div>
            </ReelControls>
          </Reel>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify all three size reels are rendered
    const reels = canvasElement.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(3);

    // Verify each reel has navigation and controls
    for (const reel of reels) {
      expect(reel.querySelector('[data-reel-navigation]')).toBeInTheDocument();
      expect(reel.querySelector('[data-reel-control="previous"]')).toBeInTheDocument();
      expect(reel.querySelector('[data-reel-control="next"]')).toBeInTheDocument();
    }
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async (context) => {
    await Default.play?.(context);
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('reel.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: () => <I18nReelDemo />,
  play: async (context) => {
    const root = context.canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(root.ownerDocument.documentElement.lang).toBe('ja');

    const navigation = root.querySelector('[data-reel-navigation]');

    if (!(navigation instanceof HTMLButtonElement)) {
      throw new Error('Reel navigation button was not found.');
    }

    expect(navigation.getAttribute('aria-label')).toBe('リールをナビゲート');

    const playButton = root.querySelector('[data-reel-control="play"]');

    if (!(playButton instanceof HTMLButtonElement)) {
      throw new Error('Reel play/pause button was not found.');
    }

    expect(playButton.getAttribute('aria-label')).toBe('一時停止');

    const muteButton = root.querySelector('[data-reel-control="mute"]');

    if (!(muteButton instanceof HTMLButtonElement)) {
      throw new Error('Reel mute button was not found.');
    }

    expect(muteButton.getAttribute('aria-label')).toBe('ミュート解除');

    const title = root.querySelector('[data-reel-title]');

    if (!(title instanceof HTMLElement)) {
      throw new Error('Reel title was not found.');
    }

    expect(title.textContent).toBe('コーヒーブレイク');

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
  name: i18n.t('reel.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function FakerReelDemo() {
  const fakerData = createFakeReelItems(5).map((item, i) => ({
    ...item,
    id: i + 1,
    type: 'image' as const,
    src: `https://picsum.photos/seed/reel${String(i + 1)}/400/700`,
  }));

  return (
    <div className="flex justify-center" data-reel-faker-demo data-testid="faker-reel-demo">
      <Reel className="h-[620px] rounded-xl" data={fakerData}>
        <ReelContent>
          {(item) => (
            <ReelItem>
              <ReelImage
                alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                duration={item.duration}
                src={item.src}
              />
              <ReelProgress>
                {(_item, index, isActive, progress) => (
                  <Progress
                    aria-label={i18n.t('reel.story.progressIndex', 'Progress {{index}}', {
                      index: index + 1,
                    })}
                    className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
                    data-reel-progress-active={String(isActive)}
                    data-reel-progress-index={index}
                    data-reel-progress
                    value={progress}
                  />
                )}
              </ReelProgress>
              <div className="absolute top-0 right-0 left-0 z-30 flex items-center gap-2 p-4 pt-6 text-white">
                <Avatar className="size-8 border border-white/20">
                  <AvatarImage alt={item.username} src={item.avatar} />
                  <AvatarFallback>{item.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-sm font-medium">{item.username}</div>
              </div>
              <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-sm text-white/80">{item.description}</div>
              </div>
            </ReelItem>
          )}
        </ReelContent>
        <ReelNavigation
          aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
        />
        <ReelControls>
          <div className="flex items-center gap-2">
            <ReelPreviousButton />
            <ReelNextButton />
          </div>
          <div className="flex items-center gap-2">
            <ReelPlayButton />
            <ReelMuteButton />
          </div>
        </ReelControls>
      </Reel>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <FakerReelDemo />,
  play: async ({ canvasElement }) => {
    // Verify reel with faker data renders properly
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();

    // Verify 5 progress bars are rendered
    const progressBars = canvasElement.querySelectorAll('[data-reel-progress]');
    expect(progressBars.length).toBe(5);

    // Verify controls are present
    expect(canvasElement.querySelector('[data-reel-control="play"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-reel-control="mute"]')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...WithFakerData,
  parameters: {
    msw: { handlers: reelHandlers },
  },
  play: async ({ canvasElement }) => {
    // Verify reel renders with async data handlers
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    });
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelHandlers },
  },
  play: async ({ canvasElement }) => {
    // Verify reel renders with MSW handlers
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    });

    // Verify controls are present
    expect(canvasElement.querySelector('[data-reel-control="play"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-reel-control="mute"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with loading handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with slow response handler
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

export const EmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with empty data handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 400 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 401 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 403 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 404 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 422 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 429 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 500 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 502 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 503 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with 504 error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: reelStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    // Verify reel renders with network error handler
    expect(canvasElement.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('reel.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify reel container exists
    const reel = canvasElement.querySelector('[data-slot="reel"]');
    expect(reel).toBeInTheDocument();

    // Verify navigation button exists and has aria-label
    const navigation = canvasElement.querySelector('[data-reel-navigation]');
    expect(navigation).toBeInTheDocument();
    if (navigation instanceof HTMLButtonElement) {
      expect(navigation).toHaveAttribute('aria-label');
    }

    // Verify control buttons exist and have aria-labels
    const playButton = canvasElement.querySelector('[data-reel-control="play"]');
    const muteButton = canvasElement.querySelector('[data-reel-control="mute"]');
    const prevButton = canvasElement.querySelector('[data-reel-control="previous"]');
    const nextButton = canvasElement.querySelector('[data-reel-control="next"]');

    expect(playButton).toBeInTheDocument();
    expect(muteButton).toBeInTheDocument();
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Verify buttons have accessible labels
    if (playButton instanceof HTMLButtonElement) {
      expect(playButton).toHaveAttribute('aria-label');
    }
    if (muteButton instanceof HTMLButtonElement) {
      expect(muteButton).toHaveAttribute('aria-label');
    }

    // Verify progress bars have aria-labels
    const progressBars = canvasElement.querySelectorAll('[data-reel-progress]');
    expect(progressBars.length).not.toBe(0);
    for (const progress of progressBars) {
      expect(progress).toHaveAttribute('aria-label');
    }

    // Test keyboard navigation on controls
    if (playButton instanceof HTMLButtonElement) {
      playButton.focus();
      expect(document.activeElement).toBe(playButton);

      // Toggle play/pause via keyboard
      const initialLabel = playButton.getAttribute('aria-label');
      await userEvent.keyboard('{Enter}');
      await waitFor(() => {
        expect(playButton.getAttribute('aria-label')).not.toBe(initialLabel);
      });
    }

    // Test keyboard navigation through controls
    if (prevButton instanceof HTMLButtonElement) {
      prevButton.focus();
      await userEvent.tab();
      expect(document.activeElement).not.toBe(prevButton);
    }

    // Verify reel images have alt text
    const images = canvasElement.querySelectorAll('[data-slot="reel-image"] img');
    for (const img of images) {
      expect(img).toHaveAttribute('alt');
    }
  },
};

// ============ FACTORY WIRING STORIES ============

// Helper to render a FakeReel config into a visual Reel component
function FactoryReelRenderer({ reel, testId }: { reel: FakeReel; testId?: string }) {
  const [currentIndex, setCurrentIndex] = React.useState(reel.currentIndex);
  const data: ReelItemType[] = reel.items.map((item) => ({
    id: item.id,
    type: item.type,
    username: item.username,
    avatar: item.avatar,
    src:
      item.type === 'image'
        ? `https://picsum.photos/seed/${String(item.id).slice(0, 8)}/400/700`
        : item.src,
    duration: item.duration,
    alt: item.alt,
    title: item.title,
    description: item.description,
    isRead: item.isRead,
  }));

  return (
    <div
      className="flex justify-center"
      data-reel-current-index={currentIndex}
      data-reel-item-count={data.length}
      data-testid={testId ?? 'factory-reel'}
    >
      <Reel
        className="h-[400px] rounded-xl"
        data={data}
        labels={reel.labels}
        onIndexChange={setCurrentIndex}
      >
        <ReelContent>
          {(item) => (
            <ReelItem>
              <ReelImage
                alt={item.alt ?? item.title ?? i18n.t('reel.story.reelImage', 'Reel image')}
                duration={item.duration}
                src={item.src}
              />
              <ReelProgress>
                {(_item, index, isActive, progress) => (
                  <Progress
                    aria-label={i18n.t('reel.story.progressIndex', 'Progress {{index}}', {
                      index: index + 1,
                    })}
                    className="h-0.5 flex-1 bg-white/30 [&>div]:bg-white [&>div]:transition-none"
                    data-reel-progress-active={String(isActive)}
                    data-reel-progress-index={index}
                    data-reel-progress
                    value={progress}
                  />
                )}
              </ReelProgress>
              <div className="absolute top-0 right-0 left-0 z-30 flex items-center gap-2 p-4 pt-6 text-white">
                <Avatar className="size-8 border border-white/20">
                  <AvatarImage alt={item.username} src={item.avatar} />
                  <AvatarFallback>{item.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-sm font-medium" data-reel-username>
                  {item.username}
                </div>
              </div>
              <div className="absolute right-0 bottom-0 left-0 z-30 p-4 text-white">
                <div className="text-sm font-medium" data-reel-title>
                  {item.title}
                </div>
                <div className="text-sm text-white/80" data-reel-description>
                  {item.description}
                </div>
              </div>
            </ReelItem>
          )}
        </ReelContent>
        <ReelNavigation
          aria-label={i18n.t('reel.story.navigateReelItems', 'Navigate reel items')}
          data-reel-navigation
        />
        <ReelControls>
          <div className="flex items-center gap-2">
            <ReelPreviousButton data-reel-control="previous" />
            <ReelNextButton data-reel-control="next" />
          </div>
          <div className="flex items-center gap-2">
            <ReelPlayButton data-reel-control="play" />
            <ReelMuteButton data-reel-control="mute" />
          </div>
        </ReelControls>
      </Reel>
    </div>
  );
}

// -- Single Item Factory --

function SingleItemFactoryDemo() {
  const { t } = useTranslation();
  const item: FakeReelItem = createFakeReelItem({ type: 'image' });
  const reel = createFakeReel(1, {
    items: [item],
  });

  return (
    <div data-testid="single-item-factory-demo">
      <p className="mb-2 text-sm font-medium">{t('reel.factory.singleItemFactory')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {t('reel.factory.singleItemFactory.desc')}
      </p>
      <FactoryReelRenderer reel={reel} testId="single-item-factory-reel" />
    </div>
  );
}

export const FactorySingleItem: Story = {
  render: () => <SingleItemFactoryDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="single-item-factory-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    const itemCount = root.querySelector('[data-reel-item-count]');
    expect(itemCount?.getAttribute('data-reel-item-count')).toBe('1');
  },
};

// -- Video Reel Factory --

function VideoReelDemo() {
  const reel = createFakeVideoReel(3);

  return (
    <div data-testid="video-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.videoOnly')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.videoOnly.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="video-reel" />
    </div>
  );
}

export const FactoryVideoReel: Story = {
  render: () => <VideoReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="video-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-item-count]')?.getAttribute('data-reel-item-count')).toBe(
      '3'
    );
  },
};

// -- Image Reel Factory --

function ImageReelDemo() {
  const reel = createFakeImageReel(4);

  return (
    <div data-testid="image-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.imageOnly')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.imageOnly.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="image-reel" />
    </div>
  );
}

export const FactoryImageReel: Story = {
  render: () => <ImageReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="image-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-item-count]')?.getAttribute('data-reel-item-count')).toBe(
      '4'
    );
  },
};

// -- Playing Reel Factory --

function PlayingReelDemo() {
  const reel = createFakePlayingReel();

  return (
    <div data-testid="playing-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.playing')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.playing.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="playing-reel" />
    </div>
  );
}

export const FactoryPlayingReel: Story = {
  render: () => <PlayingReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="playing-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-control="play"]')).toBeInTheDocument();
  },
};

// -- Paused Reel Factory --

function PausedReelDemo() {
  const reel = createFakePausedReel();

  return (
    <div data-testid="paused-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.paused')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.paused.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="paused-reel" />
    </div>
  );
}

export const FactoryPausedReel: Story = {
  render: () => <PausedReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="paused-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-control="play"]')).toBeInTheDocument();
  },
};

// -- Unmuted Reel Factory --

function UnmutedReelDemo() {
  const reel = createFakeUnmutedReel();

  return (
    <div data-testid="unmuted-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.unmuted')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.unmuted.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="unmuted-reel" />
    </div>
  );
}

export const FactoryUnmutedReel: Story = {
  render: () => <UnmutedReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="unmuted-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-control="mute"]')).toBeInTheDocument();
  },
};

// -- Reel At Index Factory --

function ReelAtIndexDemo() {
  const reel = createFakeReelAtIndex(2, 5);

  return (
    <div data-testid="at-index-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.atIndex', { index: 2 })}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.atIndex.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="at-index-reel" />
    </div>
  );
}

export const FactoryReelAtIndex: Story = {
  render: () => <ReelAtIndexDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="at-index-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-item-count]')?.getAttribute('data-reel-item-count')).toBe(
      '5'
    );
  },
};

// -- All Read Reel Factory --

function AllReadReelDemo() {
  const reel = createFakeAllReadReel(4);

  return (
    <div data-testid="all-read-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.allRead')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.allRead.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="all-read-reel" />
    </div>
  );
}

export const FactoryAllReadReel: Story = {
  render: () => <AllReadReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="all-read-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// -- Unread Reel Factory --

function UnreadReelDemo() {
  const reel = createFakeUnreadReel(4);

  return (
    <div data-testid="unread-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.unread')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.unread.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="unread-reel" />
    </div>
  );
}

export const FactoryUnreadReel: Story = {
  render: () => <UnreadReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="unread-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// -- Single Item Reel Factory --

function SingleItemReelDemo() {
  const reel = createFakeSingleItemReel();

  return (
    <div data-testid="single-item-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.singleItem')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.singleItem.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="single-item-reel" />
    </div>
  );
}

export const FactorySingleItemReel: Story = {
  render: () => <SingleItemReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="single-item-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-item-count]')?.getAttribute('data-reel-item-count')).toBe(
      '1'
    );
  },
};

// -- Short Duration Reel Factory --

function ShortDurationReelDemo() {
  const reel = createFakeShortDurationReel(3);

  return (
    <div data-testid="short-duration-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.shortDuration')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.shortDuration.desc')}
      </p>
      <FactoryReelRenderer reel={reel} testId="short-duration-reel" />
    </div>
  );
}

export const FactoryShortDurationReel: Story = {
  render: () => <ShortDurationReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="short-duration-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// -- Long Duration Reel Factory --

function LongDurationReelDemo() {
  const reel = createFakeLongDurationReel(3);

  return (
    <div data-testid="long-duration-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.longDuration')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.longDuration.desc')}
      </p>
      <FactoryReelRenderer reel={reel} testId="long-duration-reel" />
    </div>
  );
}

export const FactoryLongDurationReel: Story = {
  render: () => <LongDurationReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="long-duration-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// -- User Story Reel Factory --

function UserStoryReelDemo() {
  const reel = createFakeUserStoryReel('creative_soul', 4);

  return (
    <div data-testid="user-story-reel-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.userStory')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.userStory.desc')}</p>
      <FactoryReelRenderer reel={reel} testId="user-story-reel" />
    </div>
  );
}

export const FactoryUserStoryReel: Story = {
  render: () => <UserStoryReelDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="user-story-reel-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    // All usernames should be the same creator
    const usernames = root.querySelectorAll('[data-reel-username]');
    if (usernames.length > 0) {
      const firstUsername = usernames[0]?.textContent;
      expect(firstUsername).toBe('creative_soul');
    }
  },
};

// -- Multiple Reels Factory --

function MultipleReelsDemo() {
  const reels = createFakeReels(3, 3);

  return (
    <div className="flex flex-col gap-6" data-testid="multiple-reels-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.multipleReels')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.multipleReels.desc')}
      </p>
      {reels.map((reel, idx) => (
        <FactoryReelRenderer key={reel.id} reel={reel} testId={`multi-reel-${String(idx)}`} />
      ))}
    </div>
  );
}

export const FactoryMultipleReels: Story = {
  render: () => <MultipleReelsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="multiple-reels-demo"]')).toBeInTheDocument();
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(3);
  },
};

// -- Complete Reel Config Factory --

function CompleteReelConfigDemo() {
  const reel = createFakeReel(4);

  return (
    <div data-testid="complete-reel-config-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.section.content')}</p>
      <div className="text-muted-foreground mb-2 text-xs">
        <span>ID: {reel.id.slice(0, 8)}</span>
        <span className="mx-2">|</span>
        <span>Items: {reel.items.length}</span>
        <span className="mx-2">|</span>
        <span>Playing: {String(reel.isPlaying)}</span>
        <span className="mx-2">|</span>
        <span>Muted: {String(reel.isMuted)}</span>
      </div>
      <FactoryReelRenderer reel={reel} testId="complete-reel-config" />
    </div>
  );
}

export const FactoryCompleteReelConfig: Story = {
  render: () => <CompleteReelConfigDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="complete-reel-config-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-reel-item-count]')?.getAttribute('data-reel-item-count')).toBe(
      '4'
    );
  },
};

// -- Item With Metrics Factory --

function ItemWithMetricsDemo() {
  const items: FakeReelItemWithMetrics[] = Array.from({ length: 3 }, () =>
    createFakeReelItemWithMetrics({ type: 'image' })
  );

  return (
    <div className="flex flex-col gap-4" data-testid="metrics-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.metrics')}</p>
      {items.map((item) => (
        <div key={String(item.id)} className="rounded-lg border p-4" data-testid="metrics-item">
          <div className="mb-1 text-sm font-medium">{item.username}</div>
          <div className="text-muted-foreground text-xs">{item.title}</div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span data-testid="metric-views">
              {i18n.t('reel.factory.metrics.views', {
                formattedCount: formatCount(item.viewCount),
              })}
            </span>
            <span data-testid="metric-likes">
              {i18n.t('reel.factory.metrics.likes', {
                formattedCount: formatCount(item.likeCount),
              })}
            </span>
            <span data-testid="metric-comments">
              {i18n.t('reel.factory.metrics.comments', {
                formattedCount: formatCount(item.commentCount),
              })}
            </span>
            <span data-testid="metric-shares">
              {i18n.t('reel.factory.metrics.shares', {
                formattedCount: formatCount(item.shareCount),
              })}
            </span>
            <span data-testid="metric-saves">
              {i18n.t('reel.factory.metrics.saves', {
                formattedCount: formatCount(item.saveCount),
              })}
            </span>
            <span>{item.isLiked ? '❤' : ''}</span>
            <span>{item.isSaved ? '🔖' : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryItemWithMetrics: Story = {
  render: () => <ItemWithMetricsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="metrics-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="metrics-item"]');
    expect(items.length).toBe(3);
    expect(root.querySelector('[data-testid="metric-views"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="metric-likes"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="metric-comments"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="metric-shares"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="metric-saves"]')).toBeInTheDocument();
  },
};

// -- Reel Labels Factory --

function ReelLabelsDemo() {
  const { t } = useTranslation();
  const customLabels: FakeReelLabels = createFakeReelLabels({
    previous: 'Go back',
    next: 'Go forward',
    play: 'Start',
    pause: 'Stop',
    mute: 'Silence',
    unmute: 'Sound on',
  });
  const reel = createFakeReel(3, { labels: customLabels });

  return (
    <div data-testid="labels-demo">
      <p className="mb-2 text-sm font-medium">{t('reel.factory.labels')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{t('reel.factory.labels.desc')}</p>
      <div className="mb-4 flex flex-wrap gap-2 text-xs" data-testid="labels-list">
        {Object.entries(customLabels).map(([key, value]) => (
          <span key={key} className="bg-muted rounded px-2 py-1" data-testid={`label-${key}`}>
            {key}: {value}
          </span>
        ))}
      </div>
      <FactoryReelRenderer reel={reel} testId="labels-reel" />
    </div>
  );
}

export const FactoryReelLabels: Story = {
  render: () => <ReelLabelsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="labels-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="labels-list"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-previous"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-next"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-play"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-pause"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-mute"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="label-unmute"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// -- Reel User Factory --

function ReelUserDemo() {
  const { t } = useTranslation();
  const users: FakeReelUser[] = Array.from({ length: 5 }, () => createFakeReelUser());

  return (
    <div className="flex flex-col gap-3" data-testid="user-demo">
      <p className="mb-2 text-sm font-medium">{t('reel.factory.user')}</p>
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-3 rounded-lg border p-3"
          data-testid="user-card"
        >
          <Avatar className="size-10">
            <AvatarImage alt={user.name} src={user.avatar} />
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" data-testid="user-name">
                {user.name}
              </span>
              {user.isVerified && (
                <span className="text-xs text-blue-500" data-testid="user-verified">
                  {t('reel.factory.user.verified')}
                </span>
              )}
            </div>
            <div className="text-muted-foreground text-xs">@{user.username}</div>
            <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
              <span data-testid="user-followers">
                {t('reel.factory.user.followers', { formattedCount: formatCount(user.followers) })}
              </span>
              {user.isFollowing && (
                <span data-testid="user-following">{t('reel.factory.user.following')}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryReelUser: Story = {
  render: () => <ReelUserDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="user-demo"]')).toBeInTheDocument();
    const cards = root.querySelectorAll('[data-testid="user-card"]');
    expect(cards.length).toBe(5);
    expect(root.querySelector('[data-testid="user-name"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="user-followers"]')).toBeInTheDocument();
  },
};

// -- Default Labels Constant --

function DefaultLabelsDemo() {
  return (
    <div data-testid="default-labels-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.labels')}</p>
      <div className="flex flex-wrap gap-2" data-testid="default-labels-list">
        {Object.entries(DEFAULT_REEL_LABELS).map(([key, value]) => (
          <span
            key={key}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid={`default-label-${key}`}
          >
            {key}: {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryDefaultLabels: Story = {
  render: () => <DefaultLabelsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="default-labels-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-labels-list"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-previous"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-next"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-play"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-pause"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-mute"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="default-label-unmute"]')).toBeInTheDocument();
  },
};

// -- FormatCount Utility --

function FormatCountDemo() {
  const { t } = useTranslation();
  const testValues = [0, 500, 1000, 5432, 100_000, 1_500_000, 10_000_000];

  return (
    <div data-testid="format-count-demo">
      <p className="mb-2 text-sm font-medium">{t('reel.factory.formatCount', { value: '...' })}</p>
      <div className="flex flex-wrap gap-2" data-testid="format-count-list">
        {testValues.map((val) => (
          <span
            key={val}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="format-count-item"
          >
            {val.toLocaleString()} = {formatCount(val)}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryFormatCount: Story = {
  render: () => <FormatCountDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="format-count-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="format-count-item"]');
    expect(items.length).toBe(7);
    // Verify formatting logic
    expect(formatCount(500)).toBe('500');
    expect(formatCount(1000)).toBe('1.0K');
    expect(formatCount(1_500_000)).toBe('1.5M');
  },
};

// -- Constants: Media Types --

function MediaTypesDemo() {
  const mediaTypes: ReelMediaType[] = REEL_MEDIA_TYPES;

  return (
    <div data-testid="media-types-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.mediaTypes')}</p>
      <div className="flex flex-wrap gap-2" data-testid="media-types-list">
        {mediaTypes.map((type) => (
          <span
            key={type}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="media-type-item"
          >
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryMediaTypes: Story = {
  render: () => <MediaTypesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="media-types-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="media-type-item"]');
    expect(items.length).toBe(REEL_MEDIA_TYPES.length);
  },
};

// -- Constants: Playback States --

function PlaybackStatesDemo() {
  const states: ReelPlaybackState[] = REEL_PLAYBACK_STATES;

  return (
    <div data-testid="playback-states-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.playbackStates')}</p>
      <div className="flex flex-wrap gap-2" data-testid="playback-states-list">
        {states.map((state) => (
          <span
            key={state}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="playback-state-item"
          >
            {state}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryPlaybackStates: Story = {
  render: () => <PlaybackStatesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="playback-states-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="playback-state-item"]');
    expect(items.length).toBe(REEL_PLAYBACK_STATES.length);
  },
};

// -- Constants: Aspect Ratios --

function AspectRatiosDemo() {
  const ratios: ReelAspectRatio[] = REEL_ASPECT_RATIOS;

  return (
    <div data-testid="aspect-ratios-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.aspectRatios')}</p>
      <div className="flex flex-wrap gap-2" data-testid="aspect-ratios-list">
        {ratios.map((ratio) => (
          <span
            key={ratio}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="aspect-ratio-item"
          >
            {ratio}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryAspectRatios: Story = {
  render: () => <AspectRatiosDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="aspect-ratios-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="aspect-ratio-item"]');
    expect(items.length).toBe(REEL_ASPECT_RATIOS.length);
  },
};

// -- Constants: Categories --

function CategoriesDemo() {
  const categories: ReelCategory[] = REEL_CATEGORIES;

  return (
    <div data-testid="categories-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.categories')}</p>
      <div className="flex flex-wrap gap-2" data-testid="categories-list">
        {categories.map((category) => (
          <span
            key={category}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="category-item"
          >
            {category}
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryCategories: Story = {
  render: () => <CategoriesDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="categories-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="category-item"]');
    expect(items.length).toBe(REEL_CATEGORIES.length);
  },
};

// -- Constants: Durations --

function DurationsDemo() {
  return (
    <div data-testid="durations-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.durations')}</p>
      <div className="flex flex-wrap gap-2" data-testid="durations-list">
        {REEL_DURATIONS.map((dur) => (
          <span
            key={dur}
            className="bg-muted rounded px-2 py-1 text-xs"
            data-testid="duration-item"
          >
            {dur}s
          </span>
        ))}
      </div>
    </div>
  );
}

export const FactoryDurations: Story = {
  render: () => <DurationsDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="durations-demo"]')).toBeInTheDocument();
    const items = root.querySelectorAll('[data-testid="duration-item"]');
    expect(items.length).toBe(REEL_DURATIONS.length);
  },
};

// -- Media Type Matrix --

function MediaTypeMatrixDemo() {
  const matrix = createReelMediaTypeMatrix();

  return (
    <div className="flex flex-col gap-6" data-testid="media-type-matrix-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.mediaTypeMatrix')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.mediaTypeMatrix.desc')}
      </p>
      {matrix.map((reel, idx) => (
        <div key={reel.id}>
          <p className="mb-1 text-xs font-medium">{REEL_MEDIA_TYPES[idx]}</p>
          <FactoryReelRenderer reel={reel} testId={`media-matrix-${String(idx)}`} />
        </div>
      ))}
    </div>
  );
}

export const FactoryMediaTypeMatrix: Story = {
  render: () => <MediaTypeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="media-type-matrix-demo"]')).toBeInTheDocument();
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(REEL_MEDIA_TYPES.length);
  },
};

// -- Playback State Matrix --

function PlaybackStateMatrixDemo() {
  const matrix = createReelPlaybackStateMatrix();

  return (
    <div className="flex flex-col gap-6" data-testid="playback-matrix-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.playbackMatrix')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.playbackMatrix.desc')}
      </p>
      {matrix.map((reel, idx) => (
        <FactoryReelRenderer key={reel.id} reel={reel} testId={`playback-matrix-${String(idx)}`} />
      ))}
    </div>
  );
}

export const FactoryPlaybackStateMatrix: Story = {
  render: () => <PlaybackStateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="playback-matrix-demo"]')).toBeInTheDocument();
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(4);
  },
};

// -- Duration Matrix --

function DurationMatrixDemo() {
  const matrix = createReelDurationMatrix();

  return (
    <div className="flex flex-col gap-6" data-testid="duration-matrix-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.durationMatrix')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.durationMatrix.desc')}
      </p>
      {matrix.map((reel, idx) => (
        <div key={reel.id}>
          <p className="mb-1 text-xs font-medium">{REEL_DURATIONS[idx]}s</p>
          <FactoryReelRenderer reel={reel} testId={`duration-matrix-${String(idx)}`} />
        </div>
      ))}
    </div>
  );
}

export const FactoryDurationMatrix: Story = {
  render: () => <DurationMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="duration-matrix-demo"]')).toBeInTheDocument();
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(REEL_DURATIONS.length);
  },
};

// -- Index Matrix --

function IndexMatrixDemo() {
  const matrix = createReelIndexMatrix(4);

  return (
    <div className="flex flex-col gap-6" data-testid="index-matrix-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.indexMatrix')}</p>
      <p className="text-muted-foreground mb-4 text-xs">
        {i18n.t('reel.factory.indexMatrix.desc')}
      </p>
      {matrix.map((reel, idx) => (
        <div key={reel.id}>
          <p className="mb-1 text-xs font-medium">Start Index: {idx}</p>
          <FactoryReelRenderer reel={reel} testId={`index-matrix-${String(idx)}`} />
        </div>
      ))}
    </div>
  );
}

export const FactoryIndexMatrix: Story = {
  render: () => <IndexMatrixDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="index-matrix-demo"]')).toBeInTheDocument();
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(4);
  },
};

// -- Showcase Factory --

function ShowcaseDemo() {
  const showcase = createReelShowcase();

  return (
    <div className="flex flex-col gap-8" data-testid="showcase-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.showcase')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.showcase.desc')}</p>
      {showcase.map((entry) => (
        <div key={entry.name} data-testid="showcase-entry">
          <p className="mb-1 text-sm font-medium">{entry.name}</p>
          <p className="text-muted-foreground mb-2 text-xs">{entry.description}</p>
          <FactoryReelRenderer
            reel={entry.reel}
            testId={`showcase-${entry.name.toLowerCase().replaceAll(/\s+/g, '-')}`}
          />
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="showcase-demo"]')).toBeInTheDocument();
    const entries = root.querySelectorAll('[data-testid="showcase-entry"]');
    expect(entries.length).toBe(10);
    const reels = root.querySelectorAll('[data-slot="reel"]');
    expect(reels.length).toBe(10);
  },
};

// -- Test Data Factory --

function TestDataDemo() {
  const testData = createReelTestData();

  return (
    <div className="flex flex-col gap-4" data-testid="test-data-demo">
      <p className="mb-2 text-sm font-medium">{i18n.t('reel.factory.testData')}</p>
      <p className="text-muted-foreground mb-4 text-xs">{i18n.t('reel.factory.testData.desc')}</p>
      <div className="grid grid-cols-2 gap-3 text-xs" data-testid="test-data-summary">
        <div className="rounded border p-2" data-testid="td-items">
          Items: {testData.items.length}
        </div>
        <div className="rounded border p-2" data-testid="td-metrics">
          Items w/ Metrics: {testData.itemsWithMetrics.length}
        </div>
        <div className="rounded border p-2" data-testid="td-users">
          Users: {testData.users.length}
        </div>
        <div className="rounded border p-2" data-testid="td-reels">
          Reels: {testData.reels.length}
        </div>
        <div className="rounded border p-2" data-testid="td-media-matrix">
          Media Matrix: {testData.mediaTypeMatrix.length}
        </div>
        <div className="rounded border p-2" data-testid="td-playback-matrix">
          Playback Matrix: {testData.playbackStateMatrix.length}
        </div>
        <div className="rounded border p-2" data-testid="td-duration-matrix">
          Duration Matrix: {testData.durationMatrix.length}
        </div>
        <div className="rounded border p-2" data-testid="td-index-matrix">
          Index Matrix: {testData.indexMatrix.length}
        </div>
        <div className="col-span-2 rounded border p-2" data-testid="td-showcase">
          Showcase: {testData.showcase.length}
        </div>
      </div>
      {testData.reels.length > 0 && (
        <FactoryReelRenderer reel={testData.reels[0]} testId="test-data-reel" />
      )}
    </div>
  );
}

export const FactoryTestData: Story = {
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="test-data-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="test-data-summary"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-items"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-metrics"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-users"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-reels"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-media-matrix"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-playback-matrix"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-duration-matrix"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-index-matrix"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="td-showcase"]')).toBeInTheDocument();
    expect(root.querySelector('[data-slot="reel"]')).toBeInTheDocument();
  },
};

// ============ TYPE-ONLY REFERENCE STORY ============
// This story ensures all type exports (FakeReelItem, FakeReelItemWithMetrics,
// FakeReelLabels, FakeReel, FakeReelUser, ReelMediaType, ReelPlaybackState,
// ReelAspectRatio, ReelCategory) are referenced in the codebase.

function TypeReferenceDemo() {
  const { t } = useTranslation();

  // Reference all type exports to ensure they are wired
  const sampleItem: FakeReelItem = createFakeReelItem();
  const sampleMetrics: FakeReelItemWithMetrics = createFakeReelItemWithMetrics();
  const sampleLabels: FakeReelLabels = createFakeReelLabels();
  const sampleReel: FakeReel = createFakeReel(2);
  const sampleUser: FakeReelUser = createFakeReelUser();
  const sampleMediaType: ReelMediaType = REEL_MEDIA_TYPES[0];
  const samplePlayback: ReelPlaybackState = REEL_PLAYBACK_STATES[0];
  const sampleAspect: ReelAspectRatio = REEL_ASPECT_RATIOS[0];
  const sampleCategory: ReelCategory = REEL_CATEGORIES[0];

  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="type-reference-demo">
      <p className="mb-2 text-sm font-medium">{t('reel.factory.testData')}</p>
      <div className="rounded border p-2" data-testid="type-ref-item">
        FakeReelItem: {sampleItem.username} ({sampleItem.type})
      </div>
      <div className="rounded border p-2" data-testid="type-ref-metrics">
        FakeReelItemWithMetrics: {formatCount(sampleMetrics.viewCount)} views
      </div>
      <div className="rounded border p-2" data-testid="type-ref-labels">
        FakeReelLabels: {sampleLabels.play}/{sampleLabels.pause}
      </div>
      <div className="rounded border p-2" data-testid="type-ref-reel">
        FakeReel: {sampleReel.items.length} items, playing={String(sampleReel.isPlaying)}
      </div>
      <div className="rounded border p-2" data-testid="type-ref-user">
        FakeReelUser: {sampleUser.name} (@{sampleUser.username})
      </div>
      <div className="rounded border p-2" data-testid="type-ref-media">
        ReelMediaType: {sampleMediaType}
      </div>
      <div className="rounded border p-2" data-testid="type-ref-playback">
        ReelPlaybackState: {samplePlayback}
      </div>
      <div className="rounded border p-2" data-testid="type-ref-aspect">
        ReelAspectRatio: {sampleAspect}
      </div>
      <div className="rounded border p-2" data-testid="type-ref-category">
        ReelCategory: {sampleCategory}
      </div>
    </div>
  );
}

export const FactoryTypeReference: Story = {
  render: () => <TypeReferenceDemo />,
  play: async ({ canvasElement }) => {
    const root = canvasElement;
    expect(root.querySelector('[data-testid="type-reference-demo"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-item"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-metrics"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-labels"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-reel"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-user"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-media"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-playback"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-aspect"]')).toBeInTheDocument();
    expect(root.querySelector('[data-testid="type-ref-category"]')).toBeInTheDocument();
  },
};

// ============================================================================
// CROSS-CUTTING CONCERN STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('reel.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('reel.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('reel.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('reel.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// ADDITIONAL HANDLER STATUS STORIES
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('reel.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: reelStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('reel.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: reelStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
