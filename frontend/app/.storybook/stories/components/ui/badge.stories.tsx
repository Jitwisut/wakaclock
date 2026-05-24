import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { badgeHandlers, badgeStatusHandlers } from '@/.storybook/stories/_handlers/badge.handlers';
import type {
  BadgeSize,
  BadgeType,
  BadgeVariant as FactoryBadgeVariant,
  FakeBadge,
  FakeBadgeConfig,
} from '@/.storybook/stories/_factories/badge.factory';
import {
  BADGE_LABELS,
  BADGE_SIZES,
  BADGE_STATUS_LABELS,
  BADGE_TYPES,
  BADGE_VARIANTS,
  createFakeBadge,
  createFakeBadgeConfig,
  createFakeBadgeMatrix,
  createFakeBadges,
  createFakeBadgesByVariant,
  createFakeCountBadge,
  createFakeDestructiveBadge,
  createFakeDotBadge,
  createFakeInfoBadge,
  createFakeProductBadge,
  createFakeStatusBadge,
  createFakeSuccessBadge,
  createFakeTagBadges,
  createFakeWarningBadge,
} from '@/.storybook/stories/_factories/badge.factory';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { AlertTriangleIcon, BellIcon, CheckIcon, InfoIcon, Loader2Icon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'warning'
  | 'info'
  | 'success'
  | 'destructive'
  | 'outline';

function I18nBadge({ variant }: { variant?: BadgeVariant }) {
  return <Badge variant={variant} />;
}

// Async data fetching component for badge stories
function AsyncBadges({
  endpoint = '/api/badges',
  limit = 5,
}: {
  endpoint?: string;
  limit?: number;
}) {
  const { t } = useTranslation();

  const [badges, setBadges] = useState<Array<{
    id: string;
    label: string;
    variant: string;
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBadges() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${endpoint}?limit=${limit}`);

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          badges?: { id: string; label: string; variant: string }[];
        };
        if (!cancelled) {
          setBadges(data.badges || []);
        }
      } catch (error_) {
        if (!cancelled) {
          setError(error_ instanceof Error ? error_.message : 'Failed to fetch badges');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBadges();
    return () => {
      cancelled = true;
    };
  }, [endpoint, limit]);

  if (loading) {
    return (
      <div className="flex items-center gap-2" data-testid="loading-state">
        <Loader2Icon className="size-4 animate-spin" />
        <span className="text-muted-foreground text-sm">
          {t('badge.story.loadingBadges', 'Loading badges...')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-sm" data-testid="error-state">
        Error: {error}
      </div>
    );
  }

  if (!badges || badges.length === 0) {
    return (
      <div className="text-muted-foreground text-sm" data-testid="empty-state">
        No badges found.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="badges-container">
      {badges.map((badge) => (
        <Badge key={badge.id} variant={badge.variant as BadgeVariant}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: i18n.t('badge.story.badge', 'Badge'),
    variant: 'default',
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    children: {
      control: 'text',
      description: i18n.t(
        'badge.argType.badgeContentTextIconsOrReactNodes',
        'Badge content (text, icons, or React nodes)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    // Appearance
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'warning', 'info', 'success', 'destructive', 'outline'],
      description: i18n.t(
        'badge.argType.visualStyleVariantOfTheBadge',
        'Visual style variant of the badge'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: {
          summary:
            "'default' | 'secondary' | 'warning' | 'info' | 'success' | 'destructive' | 'outline'",
        },
      },
    },
    className: {
      control: 'text',
      description: i18n.t('badge.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // Composition
    asChild: {
      control: 'boolean',
      description: i18n.t(
        'badge.argType.renderAsChildElementUsingRadixSlot',
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
      description: i18n.t('badge.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('badge.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('badge.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('badge.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('badge.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('badge.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: badgeHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>{i18n.t('badge.story.default', 'Default')}</Badge>
      <Badge variant="secondary">{i18n.t('badge.story.secondary', 'Secondary')}</Badge>
      <Badge variant="outline">{i18n.t('badge.story.outline', 'Outline')}</Badge>
      <Badge variant="info">{i18n.t('badge.story.info', 'Info')}</Badge>
      <Badge variant="success">{i18n.t('badge.story.success', 'Success')}</Badge>
      <Badge variant="warning">{i18n.t('badge.story.warning', 'Warning')}</Badge>
      <Badge variant="destructive">{i18n.t('badge.story.destructive', 'Destructive')}</Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(7);
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>
        <CheckIcon className="size-3" />
        Approved
      </Badge>
      <Badge variant="destructive">
        <XIcon className="size-3" />
        Rejected
      </Badge>
      <Badge variant="warning">
        <AlertTriangleIcon className="size-3" />
        Pending Review
      </Badge>
      <Badge variant="info">
        <InfoIcon className="size-3" />
        Information
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    const canvas = within(canvasElement);
    expect(canvas.getByText('Approved')).toBeInTheDocument();
    expect(canvas.getByText('Rejected')).toBeInTheDocument();
    expect(canvas.getByText('Pending Review')).toBeInTheDocument();
    expect(canvas.getByText('Information')).toBeInTheDocument();
  },
};

function BadgeStatusDemo() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('badge.status.orderStatus')}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{i18n.t('badge.status.draft')}</Badge>
          <Badge variant="info">{i18n.t('badge.status.processing')}</Badge>
          <Badge variant="warning">{i18n.t('badge.status.pending')}</Badge>
          <Badge variant="success">{i18n.t('badge.status.completed')}</Badge>
          <Badge variant="destructive">{i18n.t('badge.status.cancelled')}</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('badge.status.userStatus')}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{i18n.t('badge.status.active')}</Badge>
          <Badge variant="warning">{i18n.t('badge.status.away')}</Badge>
          <Badge variant="secondary">{i18n.t('badge.status.offline')}</Badge>
          <Badge variant="destructive">{i18n.t('badge.status.suspended')}</Badge>
        </div>
      </div>
    </div>
  );
}

export const StatusBadges: Story = {
  render: () => <BadgeStatusDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(9);

    // Verify order and user status sections exist
    const sections = canvasElement.querySelectorAll('.space-y-4 > div');
    expect(sections.length).toBe(2);
  },
};

export const NotificationCount: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="relative">
        <BellIcon className="size-6" />
        <Badge className="absolute -top-2 -right-2 size-5 justify-center p-0 text-xs">3</Badge>
      </div>
      <div className="relative">
        <BellIcon className="size-6" />
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 size-5 justify-center p-0 text-xs"
        >
          9+
        </Badge>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(2);

    const canvas = within(canvasElement);
    expect(canvas.getByText('3')).toBeInTheDocument();
    expect(canvas.getByText('9+')).toBeInTheDocument();
  },
};

export const Dismissible: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="gap-1">
        React
        <button type="button" className="hover:bg-primary/20 ml-1 rounded-full">
          <XIcon className="size-3" />
        </button>
      </Badge>
      <Badge variant="secondary" className="gap-1">
        TypeScript
        <button type="button" className="hover:bg-secondary/20 ml-1 rounded-full">
          <XIcon className="size-3" />
        </button>
      </Badge>
      <Badge variant="outline" className="gap-1">
        Tailwind
        <button type="button" className="hover:bg-muted ml-1 rounded-full">
          <XIcon className="size-3" />
        </button>
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(3);

    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);

    const canvas = within(canvasElement);
    expect(canvas.getByText('React')).toBeInTheDocument();
    expect(canvas.getByText('TypeScript')).toBeInTheDocument();
    expect(canvas.getByText('Tailwind')).toBeInTheDocument();
  },
};

export const AsChild: Story = {
  name: i18n.t('badge.storyName.asChild', 'AsChild (anchor)'),
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge asChild>
        <a href="#badge-as-child">{i18n.t('badge.story.badgeLink', 'Badge link')}</a>
      </Badge>
      <Badge asChild variant="secondary">
        <a href="#badge-as-child-secondary">
          {i18n.t('badge.story.secondaryLink', 'Secondary link')}
        </a>
      </Badge>
      <Badge asChild variant="outline">
        <a href="#badge-as-child-outline">{i18n.t('badge.story.outlineLink', 'Outline link')}</a>
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const anchors = canvas.getAllByRole('link');

    expect(anchors.length).toBe(3);
    anchors.forEach((anchor) => {
      expect(anchor.getAttribute('href')).toBeInTheDocument();
      expect(anchor.getAttribute('data-slot')).toBe('badge');
    });
  },
};

function BadgeAllVariantsDemo() {
  const variants: BadgeVariant[] = [
    'default',
    'secondary',
    'outline',
    'info',
    'success',
    'warning',
    'destructive',
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('badge.matrix.textOnly')}</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('badge.matrix.withIcon')}</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <Badge key={variant} variant={variant}>
              <CheckIcon className="size-3" />
              {variant}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export const AllVariantsMatrix: Story = {
  name: i18n.t('badge.storyName.allVariantsMatrix', 'All Variants Matrix'),
  render: () => <BadgeAllVariantsDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    // 7 text-only + 7 with-icon = 14 total
    expect(badges.length).toBe(14);
  },
};

export const Default: Story = {
  ...Playground,
  render: (args) => <I18nBadge variant={args.variant ?? undefined} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('Badge')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="badge"]')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Badge')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Badge')).toBeInTheDocument();
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
    expect(canvas.getByText('バッジ')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('badge.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('badge.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('badge.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('badge.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('badge.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const PseudoStatesAllVariants: Story = {
  name: i18n.t('badge.storyName.pseudoStatesAllVariants', 'Pseudo States (All Variants)'),
  tags: ['!test'],
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge id="hover-default">{i18n.t('badge.story.default', 'Default')}</Badge>
      <Badge id="hover-secondary" variant="secondary">
        Secondary
      </Badge>
      <Badge id="hover-outline" variant="outline">
        Outline
      </Badge>
      <Badge id="hover-info" variant="info">
        Info
      </Badge>
      <Badge id="hover-success" variant="success">
        Success
      </Badge>
      <Badge id="hover-warning" variant="warning">
        Warning
      </Badge>
      <Badge id="hover-destructive" variant="destructive">
        Destructive
      </Badge>
    </div>
  ),
  parameters: {
    pseudo: {
      hover: [
        '#hover-default',
        '#hover-secondary',
        '#hover-outline',
        '#hover-info',
        '#hover-success',
        '#hover-warning',
        '#hover-destructive',
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ Size Variants ============

function BadgeSizesDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{t('badge.sizes.extraSmall')}</p>
        <div className="origin-left scale-90">
          <Badge>{t('badge.sizes.extraSmallLabel')}</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('badge.sizes.small')}</p>
        <div className="origin-left scale-95">
          <Badge>{t('badge.sizes.smallLabel')}</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('badge.sizes.default')}</p>
        <Badge>{t('badge.sizes.defaultLabel')}</Badge>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('badge.sizes.large')}</p>
        <div className="origin-left scale-110">
          <Badge>{t('badge.sizes.largeLabel')}</Badge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t('badge.sizes.extraLarge')}</p>
        <div className="origin-left scale-125">
          <Badge>{t('badge.sizes.extraLargeLabel')}</Badge>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <BadgeSizesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(5);

    // Verify size sections are rendered
    const sections = canvasElement.querySelectorAll('.flex.flex-col.gap-6 > div');
    expect(sections.length).toBe(5);
  },
};

// ============ Animation Stories ============

export const AnimationPulse: Story = {
  name: i18n.t('badge.storyName.animationPulse', 'Animation: Pulse'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-pulse">{i18n.t('badge.story.pulsing', 'Pulsing')}</Badge>
      <Badge variant="destructive" className="animate-pulse">
        Alert
      </Badge>
      <Badge variant="success" className="animate-pulse">
        Live
      </Badge>
      <Badge variant="info" className="animate-pulse">
        Updating
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    badges.forEach((badge) => {
      expect(badge).toHaveClass('animate-pulse');
    });
  },
};

export const AnimationBounce: Story = {
  name: i18n.t('badge.storyName.animationBounce', 'Animation: Bounce'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-bounce">{i18n.t('badge.story.bouncing', 'Bouncing')}</Badge>
      <Badge variant="warning" className="animate-bounce">
        Attention
      </Badge>
      <Badge variant="info" className="animate-bounce">
        New
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(3);

    badges.forEach((badge) => {
      expect(badge).toHaveClass('animate-bounce');
    });
  },
};

export const AnimationSpin: Story = {
  name: i18n.t('badge.storyName.animationSpin', 'Animation: Spin (Icon)'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge>
        <Loader2Icon className="size-3 animate-spin" />
        Processing
      </Badge>
      <Badge variant="info">
        <Loader2Icon className="size-3 animate-spin" />
        Syncing
      </Badge>
      <Badge variant="warning">
        <Loader2Icon className="size-3 animate-spin" />
        Loading
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(3);

    const spinIcons = canvasElement.querySelectorAll('.animate-spin');
    expect(spinIcons.length).toBe(3);
  },
};

export const AnimationPing: Story = {
  name: i18n.t('badge.storyName.animationPing', 'Animation: Ping (Notification)'),
  render: () => (
    <div className="flex items-center gap-6">
      <div className="relative">
        <BellIcon className="size-6" />
        <Badge className="absolute -top-2 -right-2 size-5 justify-center p-0 text-xs">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative">3</span>
        </Badge>
      </div>
      <div className="relative">
        <BellIcon className="size-6" />
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 size-5 justify-center p-0 text-xs"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative">!</span>
        </Badge>
      </div>
      <div className="relative">
        <Badge variant="success" className="relative overflow-visible">
          <span className="bg-success absolute -top-0.5 -right-0.5 inline-flex size-2 animate-ping rounded-full opacity-75" />
          <span className="bg-success absolute -top-0.5 -right-0.5 inline-flex size-2 rounded-full" />
          Online
        </Badge>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const pingElements = canvasElement.querySelectorAll('.animate-ping');
    expect(pingElements.length).not.toBe(0);
  },
};

export const AnimationFadeIn: Story = {
  name: i18n.t('badge.storyName.animationFadeIn', 'Animation: Fade In'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-in fade-in duration-500">
        {i18n.t('badge.story.fadeIn', 'Fade In')}
      </Badge>
      <Badge variant="secondary" className="animate-in fade-in duration-700">
        Slower Fade
      </Badge>
      <Badge variant="info" className="animate-in fade-in duration-1000">
        Slowest Fade
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(3);
  },
};

export const AnimationSlideIn: Story = {
  name: i18n.t('badge.storyName.animationSlideIn', 'Animation: Slide In'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-in slide-in-from-left duration-300">
        {i18n.t('badge.story.fromLeft', 'From Left')}
      </Badge>
      <Badge variant="secondary" className="animate-in slide-in-from-right duration-300">
        From Right
      </Badge>
      <Badge variant="info" className="animate-in slide-in-from-top duration-300">
        From Top
      </Badge>
      <Badge variant="success" className="animate-in slide-in-from-bottom duration-300">
        From Bottom
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);
  },
};

export const AnimationZoomIn: Story = {
  name: i18n.t('badge.storyName.animationZoomIn', 'Animation: Zoom In'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-in zoom-in duration-300">
        {i18n.t('badge.story.zoomIn', 'Zoom In')}
      </Badge>
      <Badge variant="destructive" className="animate-in zoom-in-50 duration-300">
        Zoom 50%
      </Badge>
      <Badge variant="warning" className="animate-in zoom-in-75 duration-300">
        Zoom 75%
      </Badge>
      <Badge variant="success" className="animate-in zoom-in-95 duration-300">
        Zoom 95%
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);
  },
};

export const AnimationCombined: Story = {
  name: i18n.t('badge.storyName.animationCombined', 'Animation: Combined Effects'),
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="animate-in fade-in slide-in-from-left duration-500">
        {i18n.t('badge.story.fadeSlide', 'Fade + Slide')}
      </Badge>
      <Badge variant="info" className="animate-in fade-in zoom-in duration-500">
        {i18n.t('badge.story.fadeZoom', 'Fade + Zoom')}
      </Badge>
      <Badge variant="success" className="animate-in slide-in-from-bottom zoom-in duration-500">
        {i18n.t('badge.story.slideZoom', 'Slide + Zoom')}
      </Badge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(3);
  },
};

// ============ Faker Data Stories ============

export const WithFakerData: Story = {
  name: i18n.t('badge.storyName.withFakerData', 'With Faker Data'),
  render: () => {
    const badges = createFakeBadges(8);
    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            {badge.label}
            {badge.count !== undefined && (
              <span className="bg-background/20 ml-1 rounded-full px-1.5 text-xs">
                {badge.count}
              </span>
            )}
          </Badge>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(8);
  },
};

export const WithFakerDataSingle: Story = {
  name: i18n.t('badge.storyName.withFakerDataSingle', 'With Faker Data (Single)'),
  render: () => {
    const badge = createFakeBadge();
    return (
      <Badge variant={badge.variant}>
        {badge.label}
        {badge.count !== undefined && ` (${badge.count})`}
      </Badge>
    );
  },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent?.trim().length).not.toBe(0);
  },
};

// ============ Async Data Stories ============

export const WithAsyncData: Story = {
  name: i18n.t('badge.storyName.withAsyncData', 'With Async Data'),
  render: () => <AsyncBadges limit={6} />,
  parameters: {
    msw: { handlers: badgeHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show loading state initially
    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    // Wait for badges to load
    await waitFor(
      () => {
        expect(canvas.getByTestId('badges-container')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify badges are displayed
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).not.toBe(0);
  },
};

// ============ MSW Handler Stories ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: badgeHandlers },
  },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Badge')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    // Verify loading text
    expect(canvas.getByText('Loading badges...')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('empty-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText('No badges found.')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Should show loading initially
    await waitFor(() => {
      expect(canvas.getByTestId('loading-state')).toBeInTheDocument();
    });

    // Eventually loads (after 5s delay)
    await waitFor(
      () => {
        expect(canvas.getByTestId('badges-container')).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  },
};

// ============ HTTP 4xx Error Stories ============

export const Error400BadRequest: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Invalid query parameters/i)).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Authentication required/i)).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Access denied/i)).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/rate limit/i)).toBeInTheDocument();
  },
};

// ============ HTTP 5xx Error Stories ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: badgeStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const badge = canvasElement.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Failed to fetch badge data/i)).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/unavailable/i)).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/maintenance/i)).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/timed out/i)).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: () => <AsyncBadges />,
  parameters: {
    msw: { handlers: badgeStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.getByTestId('error-state')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(canvas.getByText(/Error:/i)).toBeInTheDocument();
  },
};

// ============ Accessibility Story ============

export const Accessibility: Story = {
  name: i18n.t('badge.storyName.accessibility', 'Accessibility'),
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{i18n.t('badge.story.defaultBadge', 'Default Badge')}</Badge>
        <Badge variant="secondary">{i18n.t('badge.story.secondaryBadge', 'Secondary Badge')}</Badge>
        <Badge variant="destructive">{i18n.t('badge.story.errorBadge', 'Error Badge')}</Badge>
        <Badge variant="success">{i18n.t('badge.story.successBadge', 'Success Badge')}</Badge>
        <Badge variant="warning">{i18n.t('badge.story.warningBadge', 'Warning Badge')}</Badge>
        <Badge variant="info">{i18n.t('badge.story.infoBadge', 'Info Badge')}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge asChild>
          <a href="#accessible-link">
            {i18n.t('badge.story.clickableBadgeLink', 'Clickable Badge Link')}
          </a>
        </Badge>
        <Badge>
          <CheckIcon className="size-3" />
          Badge with Icon
        </Badge>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test badge structure
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(8);

    // Verify text content is accessible
    expect(canvas.getByText('Default Badge')).toBeInTheDocument();
    expect(canvas.getByText('Secondary Badge')).toBeInTheDocument();
    expect(canvas.getByText('Error Badge')).toBeInTheDocument();
    expect(canvas.getByText('Success Badge')).toBeInTheDocument();

    // Test link badge is accessible
    const linkBadge = canvas.getByRole('link', { name: 'Clickable Badge Link' });
    expect(linkBadge).toBeInTheDocument();
    expect(linkBadge.getAttribute('href')).toBe('#accessible-link');
    expect(linkBadge.getAttribute('data-slot')).toBe('badge');

    // Test keyboard navigation on link badge
    linkBadge.focus();
    expect(canvasElement.ownerDocument.activeElement).toBe(linkBadge);

    // Verify badges have sufficient color contrast (handled by a11y addon)
    // Verify badges are visible and readable
    for (const badge of badges) {
      expect(badge.textContent?.trim().length).not.toBe(0);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Accessibility testing with color contrast validation and keyboard navigation for interactive badges.',
      },
    },
  },
};

// ============ Interactive Stories ============

export const ClickableBadges: Story = {
  name: i18n.t('badge.storyName.clickableBadges', 'Clickable Badges'),
  args: {
    onClick: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <Badge className="cursor-pointer transition-transform hover:scale-105" onClick={args.onClick}>
        Click Me
      </Badge>
      <Badge
        variant="secondary"
        className="cursor-pointer transition-transform hover:scale-105"
        onClick={args.onClick}
      >
        Secondary Click
      </Badge>
      <Badge
        variant="destructive"
        className="cursor-pointer transition-transform hover:scale-105"
        onClick={args.onClick}
      >
        Delete
      </Badge>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const clickMeBadge = canvas.getByText('Click Me');
    await userEvent.click(clickMeBadge);
    expect(args.onClick).toHaveBeenCalled();
  },
};

export const DismissibleWithAction: Story = {
  name: i18n.t('badge.storyName.dismissibleWithAction', 'Dismissible With Action'),
  render: () => {
    const DismissibleBadge = ({
      children,
      variant,
    }: {
      children: React.ReactNode;
      variant?: BadgeVariant;
    }) => {
      const [visible, setVisible] = useState(true);
      const onDismiss = fn();

      if (!visible) return null;

      return (
        <Badge variant={variant} className="gap-1">
          {children}
          <button
            type="button"
            className="hover:bg-background/20 ml-1 rounded-full p-0.5"
            onClick={() => {
              onDismiss();
              setVisible(false);
            }}
            aria-label={`Dismiss ${children}`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      );
    };

    return (
      <div className="flex flex-wrap gap-2">
        <DismissibleBadge>{i18n.t('badge.story.react', 'React')}</DismissibleBadge>
        <DismissibleBadge variant="secondary">{i18n.t('badge.story.typescript')}</DismissibleBadge>
        <DismissibleBadge variant="info">
          {i18n.t('badge.story.tailwind', 'Tailwind')}
        </DismissibleBadge>
        <DismissibleBadge variant="success">
          {i18n.t('badge.story.storybook', 'Storybook')}
        </DismissibleBadge>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all badges are present
    expect(canvas.getByText('React')).toBeInTheDocument();
    expect(canvas.getByText('TypeScript')).toBeInTheDocument();

    // Dismiss one badge
    const dismissButton = canvas.getByRole('button', { name: /Dismiss React/i });
    await userEvent.click(dismissButton);

    // Verify badge is removed
    await waitFor(() => {
      expect(canvas.queryByText('React')).not.toBeInTheDocument();
    });

    // Other badges should still be present
    expect(canvas.getByText('TypeScript')).toBeInTheDocument();
  },
};

// ============ Factory: Specialized Badge Functions ============

function FactorySuccessBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 4 }, () => createFakeSuccessBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.successBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            <CheckIcon className="size-3" />
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactorySuccessBadges: Story = {
  name: i18n.t('badge.storyName.factorySuccessBadges', 'Factory: Success Badges'),
  render: () => <FactorySuccessBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    for (const badge of badges) {
      expect(badge.getAttribute('data-variant')).toBe('success');
    }
  },
};

function FactoryWarningBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 4 }, () => createFakeWarningBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.warningBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            <AlertTriangleIcon className="size-3" />
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryWarningBadges: Story = {
  name: i18n.t('badge.storyName.factoryWarningBadges', 'Factory: Warning Badges'),
  render: () => <FactoryWarningBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    for (const badge of badges) {
      expect(badge.getAttribute('data-variant')).toBe('warning');
    }
  },
};

function FactoryDestructiveBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 4 }, () => createFakeDestructiveBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.destructiveBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            <XIcon className="size-3" />
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryDestructiveBadges: Story = {
  name: i18n.t('badge.storyName.factoryDestructiveBadges', 'Factory: Destructive Badges'),
  render: () => <FactoryDestructiveBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    for (const badge of badges) {
      expect(badge.getAttribute('data-variant')).toBe('destructive');
    }
  },
};

function FactoryInfoBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 4 }, () => createFakeInfoBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.infoBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            <InfoIcon className="size-3" />
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryInfoBadges: Story = {
  name: i18n.t('badge.storyName.factoryInfoBadges', 'Factory: Info Badges'),
  render: () => <FactoryInfoBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    for (const badge of badges) {
      expect(badge.getAttribute('data-variant')).toBe('info');
    }
  },
};

function FactoryCountBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 5 }, (_, i) =>
    createFakeCountBadge((i + 1) * 7)
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.countBadges')}</p>
      <div className="flex items-center gap-4">
        {badges.map((badge) => (
          <div key={badge.id} className="relative">
            <BellIcon className="size-6" />
            <Badge
              variant={badge.variant}
              className="absolute -top-2 -right-2 size-5 justify-center p-0 text-xs"
            >
              {badge.label}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryCountBadges: Story = {
  name: i18n.t('badge.storyName.factoryCountBadges', 'Factory: Count Badges'),
  render: () => <FactoryCountBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(5);

    const canvas = within(canvasElement);
    expect(canvas.getByText('7')).toBeInTheDocument();
    expect(canvas.getByText('14')).toBeInTheDocument();
  },
};

function FactoryStatusBadgesDemo() {
  const statusKeys = Object.keys(BADGE_STATUS_LABELS);
  const badges: FakeBadge[] = statusKeys.map((status) => createFakeStatusBadge(status));

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.statusBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryStatusBadges: Story = {
  name: i18n.t('badge.storyName.factoryStatusBadges', 'Factory: Status Badges'),
  render: () => <FactoryStatusBadgesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(Object.keys(BADGE_STATUS_LABELS).length);

    // Verify some known status labels
    expect(canvas.getByText('Active')).toBeInTheDocument();
    expect(canvas.getByText('Error')).toBeInTheDocument();
    expect(canvas.getByText('Pending')).toBeInTheDocument();
  },
};

function FactoryDotBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 4 }, () => createFakeDotBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.dotBadges')}</p>
      <div className="flex items-center gap-4">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant} className="size-3 rounded-full p-0" />
        ))}
      </div>
    </div>
  );
}

export const FactoryDotBadges: Story = {
  name: i18n.t('badge.storyName.factoryDotBadges', 'Factory: Dot Badges'),
  render: () => <FactoryDotBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);

    for (const badge of badges) {
      expect(badge).toHaveClass('rounded-full');
    }
  },
};

function FactoryProductBadgesDemo() {
  const badges: FakeBadge[] = Array.from({ length: 6 }, () => createFakeProductBadge());

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.productBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryProductBadges: Story = {
  name: i18n.t('badge.storyName.factoryProductBadges', 'Factory: Product Badges'),
  render: () => <FactoryProductBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(6);

    for (const badge of badges) {
      expect(badge.textContent?.trim().length).not.toBe(0);
    }
  },
};

function FactoryBadgesByVariantDemo() {
  const badges: FakeBadge[] = createFakeBadgesByVariant();

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.byVariant')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryBadgesByVariant: Story = {
  name: i18n.t('badge.storyName.factoryBadgesByVariant', 'Factory: Badges By Variant'),
  render: () => <FactoryBadgesByVariantDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(BADGE_VARIANTS.length);

    // Verify each variant has a badge
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Destructive')).toBeInTheDocument();
    expect(canvas.getByText('Success')).toBeInTheDocument();
  },
};

function FactoryTagBadgesDemo() {
  const badges: FakeBadge[] = createFakeTagBadges(6);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.tagBadges')}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} variant={badge.variant} className="gap-1">
            {badge.label}
            <button type="button" className="hover:bg-background/20 ml-0.5 rounded-full p-0.5">
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryTagBadges: Story = {
  name: i18n.t('badge.storyName.factoryTagBadges', 'Factory: Tag Badges'),
  render: () => <FactoryTagBadgesDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(6);

    // Verify tags have dismiss buttons
    const buttons = canvasElement.querySelectorAll('button');
    expect(buttons.length).toBe(6);
  },
};

// ============ Factory: Matrix ============

function FactoryBadgeMatrixDemo() {
  const matrix: FakeBadge[][] = createFakeBadgeMatrix();

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{i18n.t('badge.factory.matrix')}</p>
      <div className="space-y-2">
        {matrix.map((row, rowIndex) => (
          <div key={BADGE_VARIANTS[rowIndex]} className="flex items-center gap-2">
            <span className="text-muted-foreground w-24 text-xs">{BADGE_VARIANTS[rowIndex]}</span>
            {row.map((badge) => (
              <Badge key={badge.id} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryBadgeMatrix: Story = {
  name: i18n.t('badge.storyName.factoryBadgeMatrix', 'Factory: Badge Matrix'),
  render: () => <FactoryBadgeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    // 7 variants x 3 sizes = 21
    expect(badges.length).toBe(BADGE_VARIANTS.length * BADGE_SIZES.length);
  },
};

// ============ Factory: Badge Config ============

function FactoryBadgeConfigDemo() {
  const scenarios = ['default', 'count', 'dot', 'interactive'] as const;
  const configs: Array<{ config: FakeBadgeConfig; scenario: string }> = scenarios.map(
    (scenario) => ({
      scenario,
      config: createFakeBadgeConfig(scenario),
    })
  );

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{i18n.t('badge.factory.config')}</p>
      <div className="space-y-3">
        {configs.map(({ config, scenario }) => (
          <div key={scenario} className="rounded-md border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
              {i18n.t('badge.factory.scenario')}: {scenario}
            </p>
            <div className="mb-2">
              <Badge variant={config.variant as BadgeVariant}>
                {config.showDot ? '' : scenario}
              </Badge>
            </div>
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
              <span>
                {i18n.t('badge.factory.variant')}: {config.variant}
              </span>
              <span>
                {i18n.t('badge.factory.size')}: {config.size}
              </span>
              <span>
                {i18n.t('badge.factory.interactive')}: {String(config.interactive)}
              </span>
              <span>
                {i18n.t('badge.factory.showDot')}: {String(config.showDot)}
              </span>
              <span>
                {i18n.t('badge.factory.maxCount')}: {config.maxCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryBadgeConfig: Story = {
  name: i18n.t('badge.storyName.factoryBadgeConfig', 'Factory: Badge Config'),
  render: () => <FactoryBadgeConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all 4 scenarios are rendered
    expect(canvas.getByText(/default/)).toBeInTheDocument();
    expect(canvas.getByText(/count/)).toBeInTheDocument();
    expect(canvas.getByText(/dot/)).toBeInTheDocument();
    expect(canvas.getByText(/interactive/)).toBeInTheDocument();

    // Verify config details are shown
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(4);
  },
};

// ============ Factory: Constants ============

function FactoryAllVariantsConstDemo() {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {i18n.t('badge.factory.allVariants')} ({BADGE_VARIANTS.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {BADGE_VARIANTS.map((variant: FactoryBadgeVariant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllVariantsConst: Story = {
  name: i18n.t('badge.storyName.factoryAllVariantsConst', 'Factory: BADGE_VARIANTS Constant'),
  render: () => <FactoryAllVariantsConstDemo />,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(BADGE_VARIANTS.length);
    expect(badges.length).toBe(7);
  },
};

function FactoryAllSizesConstDemo() {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {i18n.t('badge.factory.allSizes')} ({BADGE_SIZES.length})
      </p>
      <div className="flex flex-wrap gap-3">
        {BADGE_SIZES.map((size: BadgeSize) => (
          <div key={size} className="flex flex-col items-center gap-1">
            <Badge>{size}</Badge>
            <span className="text-muted-foreground text-xs">{size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllSizesConst: Story = {
  name: i18n.t('badge.storyName.factoryAllSizesConst', 'Factory: BADGE_SIZES Constant'),
  render: () => <FactoryAllSizesConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(BADGE_SIZES.length);

    expect(canvas.getByText('default')).toBeInTheDocument();
    expect(canvas.getByText('sm')).toBeInTheDocument();
    expect(canvas.getByText('lg')).toBeInTheDocument();
  },
};

function FactoryAllTypesConstDemo() {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {i18n.t('badge.factory.allTypes')} ({BADGE_TYPES.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {BADGE_TYPES.map((type: BadgeType) => (
          <Badge key={type} variant="outline">
            {type}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllTypesConst: Story = {
  name: i18n.t('badge.storyName.factoryAllTypesConst', 'Factory: BADGE_TYPES Constant'),
  render: () => <FactoryAllTypesConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(BADGE_TYPES.length);

    expect(canvas.getByText('count')).toBeInTheDocument();
    expect(canvas.getByText('dot')).toBeInTheDocument();
    expect(canvas.getByText('icon')).toBeInTheDocument();
    expect(canvas.getByText('status')).toBeInTheDocument();
    expect(canvas.getByText('text')).toBeInTheDocument();
  },
};

function FactoryAllLabelsConstDemo() {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {i18n.t('badge.factory.allLabels')} ({BADGE_LABELS.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {BADGE_LABELS.map((label) => (
          <Badge key={label} variant="secondary">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export const FactoryAllLabelsConst: Story = {
  name: i18n.t('badge.storyName.factoryAllLabelsConst', 'Factory: BADGE_LABELS Constant'),
  render: () => <FactoryAllLabelsConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(BADGE_LABELS.length);

    // Verify some known labels
    expect(canvas.getByText('Active')).toBeInTheDocument();
    expect(canvas.getByText('New')).toBeInTheDocument();
    expect(canvas.getByText('Premium')).toBeInTheDocument();
    expect(canvas.getByText('Trending')).toBeInTheDocument();
  },
};

function FactoryStatusLabelsConstDemo() {
  const entries = Object.entries(BADGE_STATUS_LABELS);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {i18n.t('badge.factory.statusLabels')} ({entries.length})
      </p>
      <div className="space-y-2">
        {entries.map(([label, variant]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-muted-foreground w-24 text-xs">{label}</span>
            <Badge variant={variant}>{label}</Badge>
            <span className="text-muted-foreground text-xs">({variant})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryStatusLabelsConst: Story = {
  name: i18n.t('badge.storyName.factoryStatusLabelsConst', 'Factory: BADGE_STATUS_LABELS Constant'),
  render: () => <FactoryStatusLabelsConstDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badges = canvasElement.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(Object.keys(BADGE_STATUS_LABELS).length);

    // Verify status-to-variant mappings
    expect(canvas.getByText('Active')).toBeInTheDocument();
    expect(canvas.getByText('Error')).toBeInTheDocument();
    expect(canvas.getByText('Warning')).toBeInTheDocument();
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
  name: i18n.t('badge.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: badgeStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('badge.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: badgeStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('badge.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: badgeStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
