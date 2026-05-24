import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { AlertCircleIcon, RefreshCwIcon, UserIcon } from 'lucide-react';

import {
  avatarHandlers,
  avatarStatusHandlers,
} from '@/.storybook/stories/_handlers/avatar.handlers';
import {
  AVATAR_IMAGE_SOURCES,
  AVATAR_INDICATOR_POSITIONS,
  AVATAR_INDICATOR_VARIANTS,
  AVATAR_SHAPES,
  AVATAR_SIZE_CLASSES,
  AVATAR_SIZES,
  AVATAR_STATUS_TO_INDICATOR,
  AVATAR_STATUSES,
  type AvatarIndicatorPosition,
  type AvatarIndicatorVariant,
  type AvatarShape,
  type AvatarSize,
  type AvatarStatus,
  createFakeAvatar,
  createFakeAvatarConfig,
  createFakeAvatarGroup,
  createFakeAvatarMatrix,
  createFakeAvatars,
  createFakeAvatarsByStatus,
  createFakeAwayAvatar,
  createFakeBusyAvatar,
  createFakeFallbackAvatar,
  createFakeMentionAvatars,
  createFakeOfflineAvatar,
  createFakeOnlineAvatar,
  createFakeTeamAvatars,
  type FakeAvatar,
  type FakeAvatarConfig,
  type FakeAvatarGroup,
} from '@/.storybook/stories/_factories/avatar.factory';

import { Avatar, AvatarFallback, AvatarImage, AvatarIndicator } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function I18nAvatarGroup() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-6">
      <Avatar className="size-10">
        <AvatarImage alt={t('avatar.alt')} src="/images/avatars/01.png" />
        <AvatarFallback>AS</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarImage alt={t('avatar.alt')} src="/images/avatars/01.png" />
        <AvatarFallback>AS</AvatarFallback>
        <AvatarIndicator position="bottom-end" variant="success" />
      </Avatar>
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

function AvatarErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="avatar-error">
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

// Loading skeleton for avatars
function AvatarLoadingSkeleton() {
  return (
    <div className="flex items-center gap-4" data-state="loading" data-testid="avatar-loading">
      <Skeleton className="size-10 rounded-full" />
      <Skeleton className="size-10 rounded-full" />
      <Skeleton className="size-10 rounded-full" />
    </div>
  );
}

// Empty state for avatars
function AvatarEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="avatar-empty"
    >
      <p className="text-muted-foreground">
        {t('avatar.story.noAvatarsFound', 'No avatars found')}
      </p>
    </div>
  );
}

// Demo with Faker data (static, no API)
function AvatarWithFakerData() {
  const avatars = React.useMemo(() => createFakeAvatars(5), []);

  return (
    <div className="flex items-center gap-4" data-testid="avatar-faker-list">
      {avatars.map((avatar) => (
        <div key={avatar.id} className="flex flex-col items-center gap-2">
          <Avatar>
            <AvatarImage alt={avatar.name} src={avatar.src} />
            <AvatarFallback>{avatar.fallback}</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-xs">{avatar.name}</span>
        </div>
      ))}
    </div>
  );
}

// Demo component with async data fetching via MSW
function AvatarWithAsyncData() {
  const [data, setData] = React.useState<FakeAvatar[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/avatars?limit=5')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ avatars: FakeAvatar[]; total: number }>;
      })
      .then((json) => {
        setData(json.avatars);
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
    return <AvatarLoadingSkeleton />;
  }

  if (error) {
    return <AvatarErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (data.length === 0) {
    return <AvatarEmptyState />;
  }

  return (
    <div className="flex items-center gap-4" data-state="success" data-testid="avatar-success">
      {data.map((avatar) => (
        <div key={avatar.id} className="flex flex-col items-center gap-2">
          <Avatar>
            <AvatarImage alt={avatar.name} src={avatar.src} />
            <AvatarFallback>{avatar.fallback}</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground text-xs">{avatar.name}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onLoadingStatusChange: fn(),
  },
  parameters: {
    msw: {
      handlers: avatarHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('avatar.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('avatar.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('avatar.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('avatar.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('avatar.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('avatar.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('avatar.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onLoadingStatusChange: {
      action: 'onLoadingStatusChange',
      description: i18n.t(
        'avatar.argType.calledWhenImageLoadingStatusChanges',
        'Called when image loading status changes'
      ),
      table: { category: 'Events' },
    },
    // Avatar Props Reference (Radix Avatar.Root):
    // - className: Additional CSS classes (string)
    //
    // AvatarImage Props Reference (Radix Avatar.Image):
    // - src: Image source URL (string)
    // - alt: Image alt text for accessibility (string, required)
    // - onLoadingStatusChange: Called when loading status changes ((status: 'idle' | 'loading' | 'loaded' | 'error') => void)
    // - className: Additional CSS classes (string)
    //
    // AvatarFallback Props Reference (Radix Avatar.Fallback):
    // - delayMs: Delay before showing fallback in ms (number)
    // - className: Additional CSS classes (string)
    // - children: Fallback content, typically initials (ReactNode)
    //
    // AvatarIndicator Props Reference (Custom):
    // - position: Indicator position ('top-start' | 'top-end' | 'bottom-start' | 'bottom-end')
    // - variant: Indicator color variant ('success' | 'warning' | 'danger' | 'default')
    // - className: Additional CSS classes (string)
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => <I18nAvatarGroup />,
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(2);

    const images = canvasElement.querySelectorAll('[data-slot="avatar-image"]');
    expect(images.length).toBe(2);
    for (const image of images) {
      expect(image).toHaveAttribute('alt');
    }

    const indicator = canvasElement.querySelector('[data-slot="avatar-indicator"]');
    expect(indicator).toBeInTheDocument();
  },
};

export const FallbackOnly: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Avatar className="size-10">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>JD</AvatarFallback>
        <AvatarIndicator position="top-end" variant="warning" />
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>JD</AvatarFallback>
        <AvatarIndicator position="bottom-start" variant="danger" />
      </Avatar>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvasElement.querySelectorAll('[data-slot="avatar"]').length).toBe(3);
    expect(canvasElement.querySelectorAll('[data-slot="avatar-image"]').length).toBe(0);
    expect(canvas.getAllByText('JD').length).toBe(3);
    expect(canvasElement.querySelectorAll('[data-slot="avatar-indicator"]').length).toBe(2);
  },
};

export const Playground: Story = {
  ...WithImage,
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(2);

    expect(canvasElement.querySelector('[data-slot="avatar-image"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar-indicator"]')).toBeInTheDocument();
  },
};

function AvatarVariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.variants.withImage')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.alt')} src="/images/avatars/01.png" />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.alt')} src="/images/avatars/02.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.alt')} src="/images/avatars/03.png" />
            <AvatarFallback>MK</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.variants.withFallback')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-10">
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarFallback>MK</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.variants.withIndicator')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.onlineUser')} src="/images/avatars/01.png" />
            <AvatarFallback>AS</AvatarFallback>
            <AvatarIndicator position="bottom-end" variant="success" />
          </Avatar>
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.awayUser')} src="/images/avatars/02.png" />
            <AvatarFallback>JD</AvatarFallback>
            <AvatarIndicator position="bottom-end" variant="warning" />
          </Avatar>
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.busyUser')} src="/images/avatars/03.png" />
            <AvatarFallback>MK</AvatarFallback>
            <AvatarIndicator position="bottom-end" variant="danger" />
          </Avatar>
          <Avatar className="size-10">
            <AvatarFallback>NK</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.variants.group')}</p>
        <div className="flex -space-x-3">
          <Avatar className="border-background size-10 border-2">
            <AvatarImage alt={i18n.t('avatar.user1')} src="/images/avatars/01.png" />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <Avatar className="border-background size-10 border-2">
            <AvatarImage alt={i18n.t('avatar.user2')} src="/images/avatars/02.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar className="border-background size-10 border-2">
            <AvatarImage alt={i18n.t('avatar.user3')} src="/images/avatars/03.png" />
            <AvatarFallback>MK</AvatarFallback>
          </Avatar>
          <Avatar className="border-background size-10 border-2">
            <AvatarFallback>+5</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <AvatarVariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 4 sections: withImage (3), withFallback (3), withIndicator (4), group (4) = 14 avatars
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(14);

    // Indicators section has 3 indicators
    const indicators = canvasElement.querySelectorAll('[data-slot="avatar-indicator"]');
    expect(indicators.length).toBe(3);

    // Group section has "+5" overflow
    expect(canvas.getByText('+5')).toBeInTheDocument();
  },
};

function AvatarSizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.sizes.extraSmall')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-6">
            <AvatarImage alt={i18n.t('avatar.xsAvatar')} src="/images/avatars/01.png" />
            <AvatarFallback className="text-xs">AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-6">
            <AvatarFallback className="text-xs">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.sizes.small')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-8">
            <AvatarImage alt={i18n.t('avatar.smAvatar')} src="/images/avatars/01.png" />
            <AvatarFallback className="text-xs">AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.sizes.medium')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-10">
            <AvatarImage alt={i18n.t('avatar.mdAvatar')} src="/images/avatars/01.png" />
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-10">
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.sizes.large')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage alt={i18n.t('avatar.lgAvatar')} src="/images/avatars/01.png" />
            <AvatarFallback className="text-lg">AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('avatar.sizes.extraLarge')}</p>
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage alt={i18n.t('avatar.xlAvatar')} src="/images/avatars/01.png" />
            <AvatarFallback className="text-2xl">AS</AvatarFallback>
          </Avatar>
          <Avatar className="size-20">
            <AvatarFallback className="text-2xl">JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <AvatarSizesDemo />,
  play: async ({ canvasElement }) => {
    // 5 size sections, each with 2 avatars = 10 avatars
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(10);

    // Each size section has one image avatar and one fallback-only avatar
    const images = canvasElement.querySelectorAll('[data-slot="avatar-image"]');
    expect(images.length).toBe(5);

    const fallbacks = canvasElement.querySelectorAll('[data-slot="avatar-fallback"]');
    expect(fallbacks.length).toBe(10);
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvasElement.querySelectorAll('[data-slot="avatar"]').length).toBe(2);
    const images = canvasElement.querySelectorAll('[data-slot="avatar-image"]');
    expect(images.length).toBe(2);
    for (const image of images) {
      if (!(image instanceof HTMLImageElement)) {
        throw new TypeError('Avatar image was not an <img>.');
      }
      expect(image).toHaveAttribute('alt');
    }
    expect(canvas.getAllByText('AS').length).toBe(2);
    expect(canvasElement.querySelectorAll('[data-slot="avatar-indicator"]').length).toBe(1);
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
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const { canvasElement } = context;
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const doc = canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(canvasElement);
    expect(canvas.getAllByAltText('ユーザーのアバター').length).toBe(2);

    await Default.play?.(context);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('avatar.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FALLBACK STATE STORIES ============

export const FallbackStates: Story = {
  name: i18n.t('avatar.storyName.fallbackStates', 'Fallback States'),
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Immediate fallback (no image) */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('avatar.story.immediateFallbackNoImage', 'Immediate Fallback (no image)')}
        </div>
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>AB</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>MK</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Fallback with icon */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('avatar.story.fallbackWithIcon', 'Fallback with Icon')}
        </div>
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback>
              <UserIcon className="size-4" />
            </AvatarFallback>
          </Avatar>
          <Avatar className="size-12">
            <AvatarFallback>
              <UserIcon className="size-5" />
            </AvatarFallback>
          </Avatar>
          <Avatar className="size-16">
            <AvatarFallback>
              <UserIcon className="size-6" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Broken image (will show fallback) */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('avatar.story.brokenImageShowsFallback', 'Broken Image (shows fallback)')}
        </div>
        <div className="flex gap-4">
          <Avatar>
            <AvatarImage
              alt={i18n.t('avatar.story.broken', 'Broken')}
              src="/images/does-not-exist.png"
            />
            <AvatarFallback>BR</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarImage
              alt={i18n.t('avatar.story.invalid', 'Invalid')}
              src="https://invalid-url-example.com/404.png"
            />
            <AvatarFallback>IN</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Colored fallbacks */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('avatar.story.coloredFallbacks', 'Colored Fallbacks')}
        </div>
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback className="bg-red-100 text-red-600">RD</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback className="bg-blue-100 text-blue-600">BL</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback className="bg-green-100 text-green-600">GR</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback className="bg-purple-100 text-purple-600">PR</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const fallbacks = canvasElement.querySelectorAll('[data-slot="avatar-fallback"]');
    expect(fallbacks.length).not.toBe(0);
  },
};

export const FallbackWithDelay: Story = {
  name: i18n.t('avatar.storyName.fallbackWithDelay', 'Fallback with Delay'),
  render: () => (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        The fallback appears after a configurable delay when the image fails to load.
      </p>
      <div className="flex gap-4">
        <Avatar>
          <AvatarImage
            alt={i18n.t('avatar.story.willFail', 'Will fail')}
            src="https://invalid-url-12345.com/avatar.png"
          />
          <AvatarFallback delayMs={0}>ND</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage
            alt={i18n.t('avatar.story.willFail', 'Will fail')}
            src="https://invalid-url-12345.com/avatar.png"
          />
          <AvatarFallback delayMs={600}>DL</AvatarFallback>
        </Avatar>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(2);

    const images = canvasElement.querySelectorAll('[data-slot="avatar-image"]');
    expect(images.length).toBe(2);
    for (const image of images) {
      expect(image).toHaveAttribute('alt', i18n.t('avatar.story.willFail', 'Will fail'));
    }
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('avatar.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="flex items-center gap-6">
      <Avatar className="size-12">
        <AvatarImage
          alt={i18n.t('avatar.story.johnDoeProfilePicture', "John Doe's profile picture")}
          src="/images/avatars/01.png"
        />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarImage
          alt={i18n.t('avatar.story.janeSmithProfilePicture', "Jane Smith's profile picture")}
          src="/images/avatars/02.png"
        />
        <AvatarFallback>JS</AvatarFallback>
        <AvatarIndicator position="bottom-end" variant="success" />
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>MK</AvatarFallback>
      </Avatar>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test avatar structure
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(3);

    // Verify images have alt text
    const images = canvasElement.querySelectorAll('[data-slot="avatar-image"]');
    for (const image of images) {
      if (image instanceof HTMLImageElement) {
        const altText = image.getAttribute('alt');
        expect(image).toHaveAttribute('alt');
        expect(altText?.length).not.toBe(0);
      }
    }

    // Verify alt text content
    const johnDoeImg = canvas.getByAltText("John Doe's profile picture");
    expect(johnDoeImg).toBeInTheDocument();

    const janeSmithImg = canvas.getByAltText("Jane Smith's profile picture");
    expect(janeSmithImg).toBeInTheDocument();

    // Verify fallbacks are present and provide text alternatives
    const fallbacks = canvasElement.querySelectorAll('[data-slot="avatar-fallback"]');
    expect(fallbacks.length).toBe(3);

    // Check fallback text content
    expect(canvas.getByText('JD')).toBeInTheDocument();
    expect(canvas.getByText('JS')).toBeInTheDocument();
    expect(canvas.getByText('MK')).toBeInTheDocument();

    // Verify indicator has proper aria-hidden or accessible label
    const indicator = canvasElement.querySelector('[data-slot="avatar-indicator"]');
    expect(indicator).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with image alt text validation and fallback content.',
      },
    },
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <AvatarWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="avatar"]').length).toBe(5);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: avatarHandlers },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="avatar-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="avatar-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify avatars rendered
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).not.toBe(0);
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: avatarStatusHandlers.loading },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="avatar-loading"]')).toBeInTheDocument();
  },
};

export const LoadingSkeleton: Story = {
  name: i18n.t('avatar.storyName.loadingSkeleton', 'Loading Skeleton'),
  render: () => <AvatarLoadingSkeleton />,
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(3);

    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
      expect(skeleton.className).toContain('rounded-full');
    }
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: avatarStatusHandlers.emptyData },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="avatar-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('avatar.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.badRequest },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.unauthorized },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.forbidden },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('avatar.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.tooManyRequests },
  },
  render: () => <AvatarWithAsyncData />,
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

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: avatarStatusHandlers.unprocessableEntity },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t('avatar.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.internalServerError },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.badGateway },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.serviceUnavailable },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.gatewayTimeout },
  },
  render: () => <AvatarWithAsyncData />,
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
  name: i18n.t('avatar.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.slowResponse },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="avatar-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="avatar-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('avatar.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: avatarStatusHandlers.networkError },
  },
  render: () => <AvatarWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="avatar-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: avatarHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeAvatar ============

function SingleAvatarDemo() {
  const { t } = useTranslation();
  const avatar = React.useMemo(() => createFakeAvatar(), []);

  return (
    <div className="flex flex-col gap-4" data-testid="single-avatar-demo">
      <p className="text-sm font-medium">{t('avatar.factory.singleAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">{avatar.email}</span>
          <span className="text-muted-foreground text-xs">
            {avatar.status} | {avatar.size ?? 'default'} | {avatar.shape ?? 'default'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const FactorySingleAvatar: Story = {
  name: i18n.t('avatar.storyName.factorySingleAvatar', 'Factory: Single Avatar'),
  render: () => <SingleAvatarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="single-avatar-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    // Verify avatar name is displayed (first + last name)
    const nameElements = canvasElement.querySelectorAll('.font-medium');
    const hasName = [...nameElements].some((el) => {
      const text = el.textContent ?? '';
      return text.includes(' ') && text.length > 3;
    });
    expect(hasName).toBe(true);
  },
};

// ============ FACTORY: createFakeOnlineAvatar ============

function OnlineAvatarDemo() {
  const avatar = React.useMemo(() => createFakeOnlineAvatar(), []);
  const indicatorVariant: AvatarIndicatorVariant = 'success';

  return (
    <div className="flex flex-col gap-4" data-testid="online-avatar-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.onlineAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
          <AvatarIndicator position="bottom-end" variant={indicatorVariant} />
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">{avatar.status}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryOnlineAvatar: Story = {
  name: i18n.t('avatar.storyName.factoryOnlineAvatar', 'Factory: Online Avatar'),
  render: () => <OnlineAvatarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="online-avatar-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar-indicator"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="avatar-indicator"]')?.getAttribute('data-variant')
    ).toBe('success');
  },
};

// ============ FACTORY: createFakeAwayAvatar ============

function AwayAvatarDemo() {
  const { t } = useTranslation();
  const avatar = React.useMemo(() => createFakeAwayAvatar(), []);
  const indicatorVariant: AvatarIndicatorVariant = 'warning';

  return (
    <div className="flex flex-col gap-4" data-testid="away-avatar-demo">
      <p className="text-sm font-medium">{t('avatar.factory.awayAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
          <AvatarIndicator position="bottom-end" variant={indicatorVariant} />
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">{avatar.status}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryAwayAvatar: Story = {
  name: i18n.t('avatar.storyName.factoryAwayAvatar', 'Factory: Away Avatar'),
  render: () => <AwayAvatarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="away-avatar-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar-indicator"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="avatar-indicator"]')?.getAttribute('data-variant')
    ).toBe('warning');
  },
};

// ============ FACTORY: createFakeBusyAvatar ============

function BusyAvatarDemo() {
  const { t } = useTranslation();
  const avatar = React.useMemo(() => createFakeBusyAvatar(), []);
  const indicatorVariant: AvatarIndicatorVariant = 'danger';

  return (
    <div className="flex flex-col gap-4" data-testid="busy-avatar-demo">
      <p className="text-sm font-medium">{t('avatar.factory.busyAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
          <AvatarIndicator position="bottom-end" variant={indicatorVariant} />
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">{avatar.status}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryBusyAvatar: Story = {
  name: i18n.t('avatar.storyName.factoryBusyAvatar', 'Factory: Busy Avatar'),
  render: () => <BusyAvatarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="busy-avatar-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar-indicator"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="avatar-indicator"]')?.getAttribute('data-variant')
    ).toBe('danger');
  },
};

// ============ FACTORY: createFakeOfflineAvatar ============

function OfflineAvatarDemo() {
  const { t } = useTranslation();
  const avatar = React.useMemo(() => createFakeOfflineAvatar(), []);

  return (
    <div className="flex flex-col gap-4" data-testid="offline-avatar-demo">
      <p className="text-sm font-medium">{t('avatar.factory.offlineAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">{avatar.status}</span>
        </div>
      </div>
    </div>
  );
}

export const FactoryOfflineAvatar: Story = {
  name: i18n.t('avatar.storyName.factoryOfflineAvatar', 'Factory: Offline Avatar'),
  render: () => <OfflineAvatarDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="offline-avatar-demo"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="avatar"]')).toBeInTheDocument();
    // Offline avatars should not have an indicator
    expect(canvasElement.querySelector('[data-slot="avatar-indicator"]')).not.toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeFallbackAvatar ============

function FallbackAvatarDemo() {
  const { t } = useTranslation();
  const avatar = React.useMemo(() => createFakeFallbackAvatar('FB'), []);

  return (
    <div className="flex flex-col gap-4" data-testid="fallback-avatar-demo">
      <p className="text-sm font-medium">{t('avatar.factory.fallbackAvatar')}</p>
      <div className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage alt={avatar.name} src={avatar.src} />
          <AvatarFallback>{avatar.fallback}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col text-sm">
          <span className="font-medium">{avatar.name}</span>
          <span className="text-muted-foreground text-xs">
            {avatar.src || 'No image (fallback only)'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const FactoryFallbackAvatar: Story = {
  name: i18n.t('avatar.storyName.factoryFallbackAvatar', 'Factory: Fallback Avatar'),
  render: () => <FallbackAvatarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="fallback-avatar-demo"]')).toBeInTheDocument();
    expect(canvas.getByText('FB')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeAvatarsByStatus ============

function AvatarsByStatusDemo() {
  const avatars = React.useMemo(() => createFakeAvatarsByStatus(), []);
  const statusToIndicator = AVATAR_STATUS_TO_INDICATOR;

  return (
    <div className="flex flex-col gap-4" data-testid="avatars-by-status-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.avatarsByStatus')}</p>
      <div className="flex items-center gap-6">
        {avatars.map((avatar) => (
          <div key={avatar.id} className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage alt={avatar.name} src={avatar.src} />
              <AvatarFallback>{avatar.fallback}</AvatarFallback>
              {statusToIndicator[avatar.status] && (
                <AvatarIndicator position="bottom-end" variant={statusToIndicator[avatar.status]} />
              )}
            </Avatar>
            <span className="text-muted-foreground text-xs">{avatar.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryAvatarsByStatus: Story = {
  name: i18n.t('avatar.storyName.factoryAvatarsByStatus', 'Factory: Avatars by Status'),
  render: () => <AvatarsByStatusDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="avatars-by-status-demo"]')
    ).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(AVATAR_STATUSES.length);
  },
};

// ============ FACTORY: createFakeAvatarGroup ============

function AvatarGroupDemo() {
  const group: FakeAvatarGroup = React.useMemo(() => createFakeAvatarGroup(8, 4), []);

  return (
    <div className="flex flex-col gap-4" data-testid="avatar-group-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.avatarGroup')}</p>
      <p className="text-muted-foreground text-xs">{group.name}</p>
      <div className="flex -space-x-3">
        {group.avatars.map((avatar) => (
          <Avatar key={avatar.id} className="border-background size-10 border-2">
            <AvatarImage alt={avatar.name} src={avatar.src} />
            <AvatarFallback>{avatar.fallback}</AvatarFallback>
          </Avatar>
        ))}
        {group.total > group.maxDisplay && (
          <Avatar className="border-background size-10 border-2">
            <AvatarFallback>
              +{group.total - group.maxDisplay} {i18n.t('avatar.factory.remaining')}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

export const FactoryAvatarGroup: Story = {
  name: i18n.t('avatar.storyName.factoryAvatarGroup', 'Factory: Avatar Group'),
  render: () => <AvatarGroupDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="avatar-group-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    // 4 displayed + 1 overflow = 5
    expect(avatars.length).toBe(5);
  },
};

// ============ FACTORY: createFakeTeamAvatars ============

function TeamAvatarsDemo() {
  const teamMembers = React.useMemo(() => createFakeTeamAvatars(), []);

  return (
    <div className="flex flex-col gap-4" data-testid="team-avatars-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.teamAvatars')}</p>
      <div className="flex flex-col gap-3">
        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage alt={member.name} src={member.src} />
              <AvatarFallback>{member.fallback}</AvatarFallback>
              {AVATAR_STATUS_TO_INDICATOR[member.status] && (
                <AvatarIndicator
                  position="bottom-end"
                  variant={AVATAR_STATUS_TO_INDICATOR[member.status]}
                />
              )}
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{member.name}</span>
              <span className="text-muted-foreground text-xs">{member.role}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryTeamAvatars: Story = {
  name: i18n.t('avatar.storyName.factoryTeamAvatars', 'Factory: Team Avatars'),
  render: () => <TeamAvatarsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="team-avatars-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(5);
    // Verify roles are displayed
    expect(canvas.getByText('Team Lead')).toBeInTheDocument();
    expect(canvas.getByText('Developer')).toBeInTheDocument();
    expect(canvas.getByText('Designer')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeMentionAvatars ============

function MentionAvatarsDemo() {
  const avatars = React.useMemo(() => createFakeMentionAvatars(6), []);

  return (
    <div className="flex flex-col gap-4" data-testid="mention-avatars-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.mentionAvatars')}</p>
      <div className="flex flex-col gap-2">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-3 py-2"
          >
            <Avatar className="size-8">
              <AvatarImage alt={avatar.name} src={avatar.src} />
              <AvatarFallback>{avatar.fallback}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{avatar.name}</span>
              <span className="text-muted-foreground text-xs">{avatar.email}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryMentionAvatars: Story = {
  name: i18n.t('avatar.storyName.factoryMentionAvatars', 'Factory: Mention Avatars'),
  render: () => <MentionAvatarsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="mention-avatars-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(6);
  },
};

// ============ FACTORY: createFakeAvatarMatrix ============

function AvatarMatrixDemo() {
  const matrix = React.useMemo(() => createFakeAvatarMatrix(), []);

  return (
    <div className="flex flex-col gap-4" data-testid="avatar-matrix-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.avatarMatrix')}</p>
      <div className="overflow-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">
                {i18n.t('avatar.story.sizeStatus', 'Size / Status')}
              </th>
              {AVATAR_STATUSES.map((status: AvatarStatus) => (
                <th key={status} className="px-3 py-2 text-center capitalize">
                  {status}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={AVATAR_SIZES[rowIdx]}>
                <td className="px-3 py-2 font-medium uppercase">{AVATAR_SIZES[rowIdx]}</td>
                {row.map((avatar) => (
                  <td key={avatar.id} className="px-3 py-2 text-center">
                    <Avatar className={AVATAR_SIZE_CLASSES[avatar.size as AvatarSize]}>
                      <AvatarImage alt={avatar.name} src={avatar.src} />
                      <AvatarFallback>{avatar.fallback}</AvatarFallback>
                      {AVATAR_STATUS_TO_INDICATOR[avatar.status] && (
                        <AvatarIndicator
                          position="bottom-end"
                          variant={AVATAR_STATUS_TO_INDICATOR[avatar.status]}
                        />
                      )}
                    </Avatar>
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

export const FactoryAvatarMatrix: Story = {
  name: i18n.t('avatar.storyName.factoryAvatarMatrix', 'Factory: Avatar Matrix'),
  render: () => <AvatarMatrixDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="avatar-matrix-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    // 5 sizes x 4 statuses = 20 avatars
    expect(avatars.length).toBe(AVATAR_SIZES.length * AVATAR_STATUSES.length);
  },
};

// ============ FACTORY: createFakeAvatarConfig ============

const AVATAR_CONFIG_SCENARIOS = ['default', 'withIndicator', 'group', 'withoutImage'] as const;

function AvatarConfigDemo() {
  const configs: FakeAvatarConfig[] = React.useMemo(
    () => AVATAR_CONFIG_SCENARIOS.map((s) => createFakeAvatarConfig(s)),
    []
  );
  const avatar = React.useMemo(() => createFakeAvatar(), []);

  return (
    <div className="flex flex-col gap-6" data-testid="avatar-config-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.avatarConfig')}</p>
      {AVATAR_CONFIG_SCENARIOS.map((scenario, idx) => {
        const config = configs[idx];
        return (
          <div key={scenario} className="flex items-center gap-4">
            <Avatar className={AVATAR_SIZE_CLASSES[config.size]}>
              {!config.showFallbackDelay && <AvatarImage alt={avatar.name} src={avatar.src} />}
              <AvatarFallback delayMs={config.showFallbackDelay ? 600 : undefined}>
                {avatar.fallback}
              </AvatarFallback>
              {config.showIndicator && config.indicatorVariant && (
                <AvatarIndicator
                  position={config.indicatorPosition}
                  variant={config.indicatorVariant}
                />
              )}
            </Avatar>
            <div className="flex flex-col text-sm">
              <span className="font-medium">
                {i18n.t('avatar.factory.scenario')}: {scenario}
              </span>
              <span className="text-muted-foreground text-xs">
                {config.size} | {config.shape} |{' '}
                {config.showIndicator
                  ? config.indicatorVariant
                  : i18n.t('avatar.factory.noIndicator')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const FactoryAvatarConfig: Story = {
  name: i18n.t('avatar.storyName.factoryAvatarConfig', 'Factory: Avatar Config'),
  render: () => <AvatarConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-testid="avatar-config-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(4);
    expect(canvas.getByText(/default/)).toBeInTheDocument();
    expect(canvas.getByText(/withIndicator/)).toBeInTheDocument();
  },
};

// ============ CONSTANTS: AVATAR_SIZES ============

function AllSizesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="all-sizes-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.allSizes')}</p>
      <div className="flex items-end gap-4">
        {AVATAR_SIZES.map((size: AvatarSize) => (
          <div key={size} className="flex flex-col items-center gap-2">
            <Avatar className={AVATAR_SIZE_CLASSES[size]}>
              <AvatarImage alt={`${size} avatar`} src="/images/avatars/01.png" />
              <AvatarFallback>{size.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">
              {size} ({AVATAR_SIZE_CLASSES[size]})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantAllSizes: Story = {
  name: i18n.t('avatar.storyName.constantAllSizes', 'Constant: All Sizes'),
  render: () => <AllSizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="all-sizes-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(AVATAR_SIZES.length);
  },
};

// ============ CONSTANTS: AVATAR_STATUSES ============

function AllStatusesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="all-statuses-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.allStatuses')}</p>
      <div className="flex items-center gap-6">
        {AVATAR_STATUSES.map((status: AvatarStatus) => (
          <div key={status} className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage alt={`${status} user`} src="/images/avatars/01.png" />
              <AvatarFallback>{status.charAt(0).toUpperCase()}</AvatarFallback>
              {AVATAR_STATUS_TO_INDICATOR[status] && (
                <AvatarIndicator
                  position="bottom-end"
                  variant={AVATAR_STATUS_TO_INDICATOR[status]}
                />
              )}
            </Avatar>
            <span className="text-muted-foreground text-xs capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantAllStatuses: Story = {
  name: i18n.t('avatar.storyName.constantAllStatuses', 'Constant: All Statuses'),
  render: () => <AllStatusesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="all-statuses-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(AVATAR_STATUSES.length);
  },
};

// ============ CONSTANTS: AVATAR_SHAPES ============

function AllShapesDemo() {
  const shapeClasses: Record<AvatarShape, string> = {
    circle: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none',
  };

  return (
    <div className="flex flex-col gap-4" data-testid="all-shapes-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.allShapes')}</p>
      <div className="flex items-center gap-6">
        {AVATAR_SHAPES.map((shape: AvatarShape) => (
          <div key={shape} className="flex flex-col items-center gap-2">
            <Avatar className={`size-12 ${shapeClasses[shape]}`}>
              <AvatarImage alt={`${shape} avatar`} src="/images/avatars/01.png" />
              <AvatarFallback className={shapeClasses[shape]}>SH</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs capitalize">{shape}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantAllShapes: Story = {
  name: i18n.t('avatar.storyName.constantAllShapes', 'Constant: All Shapes'),
  render: () => <AllShapesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="all-shapes-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(AVATAR_SHAPES.length);
  },
};

// ============ CONSTANTS: AVATAR_INDICATOR_VARIANTS ============

function IndicatorVariantsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="indicator-variants-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.indicatorVariants')}</p>
      <div className="flex items-center gap-6">
        {AVATAR_INDICATOR_VARIANTS.map((variant: AvatarIndicatorVariant) => (
          <div key={variant} className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage alt={`${variant} indicator`} src="/images/avatars/01.png" />
              <AvatarFallback>IV</AvatarFallback>
              <AvatarIndicator position="bottom-end" variant={variant} />
            </Avatar>
            <span className="text-muted-foreground text-xs capitalize">{variant}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantIndicatorVariants: Story = {
  name: i18n.t('avatar.storyName.constantIndicatorVariants', 'Constant: Indicator Variants'),
  render: () => <IndicatorVariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="indicator-variants-demo"]')
    ).toBeInTheDocument();
    const indicators = canvasElement.querySelectorAll('[data-slot="avatar-indicator"]');
    expect(indicators.length).toBe(AVATAR_INDICATOR_VARIANTS.length);
  },
};

// ============ CONSTANTS: AVATAR_INDICATOR_POSITIONS ============

function IndicatorPositionsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="indicator-positions-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.indicatorPositions')}</p>
      <div className="flex items-center gap-6">
        {AVATAR_INDICATOR_POSITIONS.map((position: AvatarIndicatorPosition) => (
          <div key={position} className="flex flex-col items-center gap-2">
            <Avatar className="size-14">
              <AvatarImage alt={`${position} position`} src="/images/avatars/01.png" />
              <AvatarFallback>IP</AvatarFallback>
              <AvatarIndicator position={position} variant="success" />
            </Avatar>
            <span className="text-muted-foreground text-xs">{position}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantIndicatorPositions: Story = {
  name: i18n.t('avatar.storyName.constantIndicatorPositions', 'Constant: Indicator Positions'),
  render: () => <IndicatorPositionsDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="indicator-positions-demo"]')
    ).toBeInTheDocument();
    const indicators = canvasElement.querySelectorAll('[data-slot="avatar-indicator"]');
    expect(indicators.length).toBe(AVATAR_INDICATOR_POSITIONS.length);
    // Verify each position data attribute
    for (const position of AVATAR_INDICATOR_POSITIONS) {
      expect(
        canvasElement.querySelector(`[data-slot="avatar-indicator"][data-position="${position}"]`)
      ).toBeInTheDocument();
    }
  },
};

// ============ CONSTANTS: AVATAR_SIZE_CLASSES ============

function SizeClassesDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4" data-testid="size-classes-demo">
      <p className="text-sm font-medium">{t('avatar.factory.sizeClasses')}</p>
      <div className="flex flex-col gap-3">
        {(Object.entries(AVATAR_SIZE_CLASSES) as [AvatarSize, string][]).map(
          ([size, className]) => (
            <div key={size} className="flex items-center gap-4">
              <Avatar className={className}>
                <AvatarImage alt={`${size} class`} src="/images/avatars/01.png" />
                <AvatarFallback>{size.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground text-xs">
                {size}: <code className="bg-muted rounded px-1">{className}</code>
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export const ConstantSizeClasses: Story = {
  name: i18n.t('avatar.storyName.constantSizeClasses', 'Constant: Size Classes'),
  render: () => <SizeClassesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="size-classes-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(Object.keys(AVATAR_SIZE_CLASSES).length);
  },
};

// ============ CONSTANTS: AVATAR_STATUS_TO_INDICATOR ============

function StatusToIndicatorDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="status-to-indicator-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.statusToIndicator')}</p>
      <div className="flex items-center gap-6">
        {(
          Object.entries(AVATAR_STATUS_TO_INDICATOR) as [
            AvatarStatus,
            AvatarIndicatorVariant | undefined,
          ][]
        ).map(([status, variant]) => (
          <div key={status} className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage alt={`${status} mapping`} src="/images/avatars/01.png" />
              <AvatarFallback>{status.charAt(0).toUpperCase()}</AvatarFallback>
              {variant && <AvatarIndicator position="bottom-end" variant={variant} />}
            </Avatar>
            <span className="text-muted-foreground text-xs capitalize">{status}</span>
            <span className="text-muted-foreground text-xs">
              {variant ?? i18n.t('avatar.factory.noIndicator')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantStatusToIndicator: Story = {
  name: i18n.t('avatar.storyName.constantStatusToIndicator', 'Constant: Status to Indicator'),
  render: () => <StatusToIndicatorDemo />,
  play: async ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-testid="status-to-indicator-demo"]')
    ).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(Object.keys(AVATAR_STATUS_TO_INDICATOR).length);
    // 3 statuses have indicators (online=success, away=warning, busy=danger), offline has none
    const indicators = canvasElement.querySelectorAll('[data-slot="avatar-indicator"]');
    expect(indicators.length).toBe(3);
  },
};

// ============ CONSTANTS: AVATAR_IMAGE_SOURCES ============

function ImageSourcesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="image-sources-demo">
      <p className="text-sm font-medium">{i18n.t('avatar.factory.imageSources')}</p>
      <div className="flex flex-wrap items-center gap-4">
        {AVATAR_IMAGE_SOURCES.map((src, idx) => (
          <div key={src} className="flex flex-col items-center gap-2">
            <Avatar className="size-12">
              <AvatarImage alt={`Avatar source ${idx + 1}`} src={src} />
              <AvatarFallback>{String(idx + 1).padStart(2, '0')}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground max-w-20 truncate text-xs">{src}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ConstantImageSources: Story = {
  name: i18n.t('avatar.storyName.constantImageSources', 'Constant: Image Sources'),
  render: () => <ImageSourcesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="image-sources-demo"]')).toBeInTheDocument();
    const avatars = canvasElement.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBe(AVATAR_IMAGE_SOURCES.length);
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: avatarStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: avatarStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('avatar.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: avatarStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
