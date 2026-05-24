import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

import { cardHandlers, cardStatusHandlers } from '@/.storybook/stories/_handlers/card.handlers';
import {
  CARD_ACTION_TYPES,
  CARD_BADGES,
  CARD_CONTENT_TYPES,
  CARD_LAYOUTS,
  CARD_SIZE_WIDTHS,
  CARD_SIZES,
  CARD_STATUSES,
  CARD_TITLES,
  type CardActionType,
  type CardContentType,
  type CardLayout,
  type CardSize,
  type CardStatus,
  createFakeArticleCard,
  createFakeArticleCards,
  createFakeCard,
  createFakeCardConfig,
  createFakeCardMatrix,
  createFakeCards,
  createFakeCompactCard,
  createFakeDashboardStats,
  createFakeDemoCards,
  createFakeFeaturedCard,
  createFakeHorizontalCard,
  createFakeImageCard,
  createFakePricingCard,
  createFakePricingTable,
  createFakeProductCard,
  createFakeProductCards,
  createFakeProfileCard,
  createFakeProfileCards,
  createFakeStatsCard,
  createFakeTextOnlyCard,
  type FakeArticleCard,
  type FakeCard,
  type FakeCardConfig,
  type FakePricingCard,
  type FakeProductCard,
  type FakeProfileCard,
  type FakeStatsCard,
} from '@/.storybook/stories/_factories/card.factory';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function CardDemo() {
  const { t } = useTranslation();

  return (
    <Card className="w-[480px]">
      <CardHeader className="border-b">
        <div>
          <CardTitle>{t('card.title')}</CardTitle>
          <CardDescription>{t('card.description')}</CardDescription>
        </div>
        <CardAction>
          <Button size="sm" variant="outline">
            {t('card.action.edit')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">{t('card.content.primary')}</div>
        <div className="text-muted-foreground text-sm">{t('card.content.secondary')}</div>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t">
        <Button variant="outline">{t('card.action.cancel')}</Button>
        <Button>{t('card.action.save')}</Button>
      </CardFooter>
    </Card>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function CardErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="card-error">
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

// Loading skeleton for cards
function CardLoadingSkeleton() {
  return (
    <div className="w-[480px]" data-state="loading" data-testid="card-loading">
      <Card>
        <CardHeader className="border-b">
          <div className="space-y-2">
            <Skeleton className="h-5 w-[180px]" />
            <Skeleton className="h-4 w-[240px]" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </CardFooter>
      </Card>
    </div>
  );
}

// Empty state for cards
function CardEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="card-empty"
    >
      <p className="text-muted-foreground">{t('card.story.noCardsFound', 'No cards found')}</p>
    </div>
  );
}

// Demo with Faker data (static, no API)
function CardWithFakerData() {
  const cards = React.useMemo(() => createFakeCards(3), []);

  return (
    <div className="flex flex-col gap-4">
      {cards.map((card) => (
        <Card key={card.id} className="w-[480px]">
          {card.image && (
            <div className="h-48 overflow-hidden rounded-t-lg">
              <img src={card.image} alt="" className="size-full object-cover" />
            </div>
          )}
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
            <CardDescription>{card.description}</CardDescription>
          </CardHeader>
          {card.footer && (
            <CardFooter className="border-t">
              <p className="text-muted-foreground text-sm">{card.footer}</p>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}

// Demo component with async data fetching via MSW
function CardWithAsyncData() {
  const [data, setData] = React.useState<FakeCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/cards?limit=3')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ cards: FakeCard[]; pagination: unknown }>;
      })
      .then((json) => {
        setData(json.cards);
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
    return <CardLoadingSkeleton />;
  }

  if (error) {
    return <CardErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (data.length === 0) {
    return <CardEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4" data-state="success" data-testid="card-success">
      {data.map((card) => (
        <Card key={card.id} className="w-[480px]">
          {card.image && (
            <div className="h-48 overflow-hidden rounded-t-lg">
              <img src={card.image} alt="" className="size-full object-cover" />
            </div>
          )}
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
            <CardDescription>{card.description}</CardDescription>
          </CardHeader>
          {card.footer && (
            <CardFooter className="border-t">
              <p className="text-muted-foreground text-sm">{card.footer}</p>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/UI/Card',
  component: CardDemo,
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
  parameters: {
    msw: {
      handlers: cardHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Content
    children: {
      control: false,
      description: i18n.t(
        'card.argType.cardContentCardheaderCardcontentCardfooter',
        'Card content (CardHeader, CardContent, CardFooter)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ReactNode' },
      },
    },
    title: {
      control: 'text',
      description: i18n.t('card.argType.cardTitleText', 'Card title text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    description: {
      control: 'text',
      description: i18n.t('card.argType.cardDescriptionText', 'Card description text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t(
        'card.argType.additionalCssClassesForTheCardContainer',
        'Additional CSS classes for the card container'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    variant: {
      control: 'select',
      options: ['default', 'outline', 'elevated', 'interactive'],
      description: i18n.t(
        'card.argType.visualStyleVariantOfTheCard',
        'Visual style variant of the card'
      ),
      table: {
        category: 'Appearance',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'outline' | 'elevated' | 'interactive'" },
      },
    },
    // State
    loading: {
      control: 'boolean',
      description: i18n.t(
        'card.argType.whetherTheCardIsInLoadingState',
        'Whether the card is in loading state'
      ),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      control: 'boolean',
      description: i18n.t('card.argType.whetherTheCardIsDisabled', 'Whether the card is disabled'),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    selected: {
      control: 'boolean',
      description: i18n.t('card.argType.whetherTheCardIsSelected', 'Whether the card is selected'),
      table: {
        category: 'State',
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    // Layout
    size: {
      control: 'select',
      options: ['compact', 'default', 'large', 'full'],
      description: i18n.t('card.argType.sizeVariantOfTheCard', 'Size variant of the card'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'default' },
        type: { summary: "'compact' | 'default' | 'large' | 'full'" },
      },
    },
    layout: {
      control: 'select',
      options: ['default', 'horizontal', 'stacked', 'vertical'],
      description: i18n.t('card.argType.layoutDirectionOfTheCard', 'Layout direction of the card'),
      table: {
        category: 'Layout',
        defaultValue: { summary: 'default' },
        type: { summary: "'default' | 'horizontal' | 'stacked' | 'vertical'" },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('card.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('card.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('card.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('card.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('card.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('card.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('card.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof CardDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-footer"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-title"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-description"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-action"]')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="button"]').length).toBe(3);

    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
    await userEvent.click(buttons[0]);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();

    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(3);
  },
};

// ============ VARIANTS ============

function VariantsDemo() {
  return (
    <div className="flex flex-wrap gap-6">
      {/* Basic */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('card.story.basic', 'Basic')}
        </div>
        <Card className="w-[280px]">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.basicCard', 'Basic Card')}</CardTitle>
            <CardDescription>
              {i18n.t('card.story.simpleCardDescription', 'A simple card with header only.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {i18n.t('card.story.someContentGoesHere', 'Some content goes here.')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* With Footer */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('card.story.withFooter', 'With Footer')}
        </div>
        <Card className="w-[280px]">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.cardWithFooter', 'Card with Footer')}</CardTitle>
            <CardDescription>
              {i18n.t('card.story.includesActionButtons', 'Includes action buttons.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{i18n.t('card.story.mainContentArea', 'Main content area.')}</p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button size="sm" variant="outline">
              {i18n.t('card.story.cancel', 'Cancel')}
            </Button>
            <Button size="sm">{i18n.t('card.story.save', 'Save')}</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Interactive/Clickable */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('card.story.interactiveClickable', 'Interactive/Clickable')}
        </div>
        <Card className="w-[280px] cursor-pointer transition-shadow hover:shadow-lg">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.clickableCard', 'Clickable Card')}</CardTitle>
            <CardDescription>
              {i18n.t('card.story.hoverToSeeEffect', 'Hover to see effect.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {i18n.t('card.story.clickAnywhereOnThisCard', 'Click anywhere on this card.')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* With Image */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('card.story.withImage', 'With Image')}
        </div>
        <Card className="w-[280px] overflow-hidden">
          <div className="bg-muted flex h-32 items-center justify-center">
            <svg
              className="text-muted-foreground size-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              viewBox="0 0 24 24"
            >
              <rect height="16" rx="2" width="20" x="2" y="4" />
              <circle cx="8" cy="10" r="2" />
              <path d="M14 12l4 4H4l4-4 2 2z" />
            </svg>
          </div>
          <CardHeader>
            <CardTitle>{i18n.t('card.story.imageCard', 'Image Card')}</CardTitle>
            <CardDescription>
              {i18n.t('card.story.cardWithMediaContent', 'Card with media content.')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

export const Variants: Story = {
  name: i18n.t(
    'card.storyName.variants',
    'Variants (basic, with footer, interactive/clickable, with image)'
  ),
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(4);
    expect(canvasElement.querySelectorAll('[data-slot="card-footer"]').length).toBe(1);
  },
};

// ============ SIZES ============

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      {/* Small Width */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">Small Width (240px)</div>
        <Card className="w-[240px]">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.compactCard', 'Compact Card')}</CardTitle>
            <CardDescription>{i18n.t('card.story.narrowLayout', 'Narrow layout.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {i18n.t(
                'card.story.compactContentAreaForSmallerSpaces',
                'Compact content area for smaller spaces.'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Default */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">Default (480px)</div>
        <Card className="w-[480px]">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.defaultCard', 'Default Card')}</CardTitle>
            <CardDescription>
              {i18n.t('card.story.standardCardWidth', 'Standard card width.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              This is the default card size with more room for content and actions.
            </p>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline">{i18n.t('card.story.cancel', 'Cancel')}</Button>
            <Button>{i18n.t('card.story.confirm', 'Confirm')}</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Full Width */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('card.story.fullWidth', 'Full Width')}
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{i18n.t('card.story.fullWidthCard', 'Full Width Card')}</CardTitle>
            <CardDescription>
              {i18n.t(
                'card.story.spansTheEntireContainerWidth',
                'Spans the entire container width.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              This card takes up all available horizontal space, suitable for dashboard layouts or
              full-width content sections.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  name: i18n.t('card.storyName.sizes', 'Sizes (small width, default, full width)'),
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-footer"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-footer"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('プロジェクト')).toBeInTheDocument();
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
  name: i18n.t('card.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function AccessibilityDemo() {
  return (
    <Card className="w-[350px]" tabIndex={0}>
      <CardHeader>
        <CardTitle>{i18n.t('card.story.accessibleCard', 'Accessible Card')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'card.story.testKeyboardNavigationAndFocusManagement',
            'Test keyboard navigation and focus management'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          {i18n.t(
            'card.story.thisCardDemonstratesAccessibilityFeature',
            'This card demonstrates accessibility features.'
          )}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">{i18n.t('card.story.cancel', 'Cancel')}</Button>
        <Button>{i18n.t('card.story.confirm', 'Confirm')}</Button>
      </CardFooter>
    </Card>
  );
}

export const Accessibility: Story = {
  render: () => <AccessibilityDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test card structure exists
    const card = canvasElement.querySelector('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // Test buttons are focusable
    const cancelButton = canvas.getByRole('button', { name: 'Cancel' });
    const confirmButton = canvas.getByRole('button', { name: 'Confirm' });
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();

    // Test keyboard navigation
    await userEvent.tab();
    await userEvent.tab();
    expect(canvasElement.ownerDocument.activeElement).toBe(cancelButton);

    await userEvent.tab();
    expect(canvasElement.ownerDocument.activeElement).toBe(confirmButton);

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <CardWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(3);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: cardHandlers },
  },
  render: () => <CardWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="card-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="card-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify cards rendered
    const cards = canvasElement.querySelectorAll('[data-slot="card"]');
    expect(cards.length).not.toBe(0);
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: cardStatusHandlers.loading },
  },
  render: () => <CardWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="card-loading"]')).toBeInTheDocument();
  },
};

export const LoadingSkeleton: Story = {
  name: i18n.t('card.storyName.loadingSkeleton', 'Loading Skeleton'),
  render: () => <CardLoadingSkeleton />,
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).not.toBe(0);

    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('animate-pulse');
    }
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: cardStatusHandlers.emptyData },
  },
  render: () => <CardWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="card-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('card.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: cardStatusHandlers.badRequest },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: cardStatusHandlers.unauthorized },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: cardStatusHandlers.forbidden },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: cardStatusHandlers.tooManyRequests },
  },
  render: () => <CardWithAsyncData />,
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
    msw: { handlers: cardStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t('card.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: cardStatusHandlers.internalServerError },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: cardStatusHandlers.badGateway },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: cardStatusHandlers.serviceUnavailable },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: cardStatusHandlers.gatewayTimeout },
  },
  render: () => <CardWithAsyncData />,
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
  name: i18n.t('card.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: cardStatusHandlers.slowResponse },
  },
  render: () => <CardWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="card-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="card-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('card.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: cardStatusHandlers.networkError },
  },
  render: () => <CardWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="card-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-header"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-footer"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCard (single) ============

function FactoryCreateFakeCardDemo() {
  const { t } = useTranslation();
  const card = React.useMemo(() => createFakeCard(), []);

  return (
    <div data-testid="factory-single-card">
      <h3 className="mb-3 text-lg font-semibold">{t('card.title')}</h3>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
          <CardDescription>{card.description}</CardDescription>
        </CardHeader>
        {card.content && (
          <CardContent>
            <p className="text-sm">{card.content}</p>
          </CardContent>
        )}
        {card.footer && (
          <CardFooter className="border-t">
            <p className="text-muted-foreground text-sm">{card.footer}</p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export const FactoryCreateFakeCard: Story = {
  name: i18n.t('card.storyName.factoryCreateFakeCard', 'Factory: createFakeCard'),
  render: () => <FactoryCreateFakeCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-single-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-title"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-description"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeProfileCard ============

function FactoryProfileCardDemo() {
  const profile = React.useMemo(() => createFakeProfileCard(), []);

  return (
    <div data-testid="factory-profile-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.profile.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.profile.description')}</p>
      <Card className="w-[350px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="size-12 rounded-full object-cover"
            />
            <div>
              <CardTitle>{profile.name}</CardTitle>
              <CardDescription>{profile.jobTitle}</CardDescription>
            </div>
          </div>
          {profile.online !== undefined && (
            <CardAction>
              <Badge variant={profile.online ? 'default' : 'secondary'}>
                {profile.online
                  ? i18n.t('card.story.online', 'Online')
                  : i18n.t('card.story.offline', 'Offline')}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm">{profile.bio}</p>
          <p className="text-muted-foreground mt-2 text-xs">{profile.email}</p>
        </CardContent>
        <CardFooter className="gap-2 border-t">
          <Button size="sm" variant="outline">
            {i18n.t('card.action.follow')}
          </Button>
          <Button size="sm">{i18n.t('card.action.message')}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const FactoryProfileCard: Story = {
  name: i18n.t('card.storyName.factoryProfileCard', 'Factory: createFakeProfileCard'),
  render: () => <FactoryProfileCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-profile-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const img = canvasElement.querySelector('img');
    expect(img).toBeInTheDocument();

    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(2);
  },
};

// ============ FACTORY: createFakeProfileCards (bulk) ============

function FactoryProfileCardsDemo() {
  const profiles = React.useMemo(() => createFakeProfileCards(3), []);

  return (
    <div data-testid="factory-profile-cards">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.profile.title')}</h3>
      <div className="flex flex-wrap gap-4">
        {profiles.map((profile: FakeProfileCard) => (
          <Card key={profile.id} className="w-[280px]">
            <CardHeader>
              <div className="flex items-center gap-3">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="size-10 rounded-full object-cover"
                />
                <div>
                  <CardTitle className="text-sm">{profile.name}</CardTitle>
                  <CardDescription className="text-xs">{profile.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryProfileCards: Story = {
  name: i18n.t('card.storyName.factoryProfileCards', 'Factory: createFakeProfileCards'),
  render: () => <FactoryProfileCardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-profile-cards')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(3);
  },
};

// ============ FACTORY: createFakeProductCard ============

function FactoryProductCardDemo() {
  const product = React.useMemo(() => createFakeProductCard(), []);

  return (
    <div data-testid="factory-product-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.product.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.product.description')}</p>
      <Card className="w-[320px] overflow-hidden">
        {product.image && (
          <div className="h-48 overflow-hidden">
            <img src={product.image} alt={product.title} className="size-full object-cover" />
          </div>
        )}
        <CardHeader>
          <div>
            <CardTitle>{product.title}</CardTitle>
            <CardDescription>{product.category}</CardDescription>
          </div>
          {product.discount && (
            <CardAction>
              <Badge variant="destructive">
                {product.discount}% {i18n.t('card.product.off')}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
            {product.originalPrice && (
              <span className="text-muted-foreground text-sm line-through">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span>{'*'.repeat(Math.round(product.rating))}</span>
            <span className="text-muted-foreground">
              ({product.reviewCount} {i18n.t('card.product.reviews')})
            </span>
          </div>
          <Badge className="mt-2" variant={product.inStock ? 'default' : 'secondary'}>
            {product.inStock ? i18n.t('card.product.inStock') : i18n.t('card.product.outOfStock')}
          </Badge>
        </CardContent>
        <CardFooter className="gap-2 border-t">
          <Button className="flex-1" size="sm">
            {i18n.t('card.action.addToCart')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const FactoryProductCard: Story = {
  name: i18n.t('card.storyName.factoryProductCard', 'Factory: createFakeProductCard'),
  render: () => <FactoryProductCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-product-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const addToCartButton = canvas.getByRole('button', { name: /add to cart/i });
    expect(addToCartButton).toBeInTheDocument();
    await userEvent.click(addToCartButton);
  },
};

// ============ FACTORY: createFakeProductCards (bulk) ============

function FactoryProductCardsDemo() {
  const products = React.useMemo(() => createFakeProductCards(4), []);

  return (
    <div data-testid="factory-product-cards">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.product.title')}</h3>
      <div className="flex flex-wrap gap-4">
        {products.map((product: FakeProductCard) => (
          <Card key={product.id} className="w-[220px]">
            <CardHeader>
              <CardTitle className="text-sm">{product.title}</CardTitle>
              <CardDescription className="text-xs">${product.price.toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={product.inStock ? 'default' : 'secondary'}>
                {product.inStock
                  ? i18n.t('card.product.inStock')
                  : i18n.t('card.product.outOfStock')}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryProductCards: Story = {
  name: i18n.t('card.storyName.factoryProductCards', 'Factory: createFakeProductCards'),
  render: () => <FactoryProductCardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-product-cards')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(4);
  },
};

// ============ FACTORY: createFakePricingCard ============

function FactoryPricingCardDemo() {
  const pricing = React.useMemo(() => createFakePricingCard(), []);

  return (
    <div data-testid="factory-pricing-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.pricing.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.pricing.description')}</p>
      <Card className={`w-[300px] ${pricing.highlighted ? 'ring-primary ring-2' : ''}`}>
        <CardHeader>
          <div>
            <CardTitle>{pricing.planName}</CardTitle>
            <CardDescription>
              {pricing.price === 0 ? (
                i18n.t('card.pricing.free')
              ) : (
                <>
                  <span className="text-2xl font-bold">${pricing.price}</span>
                  {pricing.billingPeriod === 'monthly'
                    ? i18n.t('card.pricing.perMonth')
                    : i18n.t('card.pricing.perYear')}
                </>
              )}
            </CardDescription>
          </div>
          {pricing.highlighted && (
            <CardAction>
              <Badge>{i18n.t('card.pricing.recommended')}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {pricing.features.map((feature: string) => (
              <li key={feature} className="text-sm">
                {feature}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="border-t">
          <Button className="w-full" variant={pricing.highlighted ? 'default' : 'outline'}>
            {i18n.t('card.action.subscribe')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const FactoryPricingCard: Story = {
  name: i18n.t('card.storyName.factoryPricingCard', 'Factory: createFakePricingCard'),
  render: () => <FactoryPricingCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-pricing-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const subscribeButton = canvas.getByRole('button', { name: /subscribe/i });
    expect(subscribeButton).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakePricingTable ============

function FactoryPricingTableDemo() {
  const pricingTable = React.useMemo(() => createFakePricingTable(), []);

  return (
    <div data-testid="factory-pricing-table">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.pricing.title')}</h3>
      <div className="flex flex-wrap gap-4">
        {pricingTable.map((plan: FakePricingCard) => (
          <Card
            key={plan.id}
            className={`w-[280px] ${plan.highlighted ? 'ring-primary ring-2' : ''}`}
          >
            <CardHeader>
              <div>
                <CardTitle>{plan.planName}</CardTitle>
                <CardDescription>
                  {plan.price === 0 ? (
                    i18n.t('card.pricing.free')
                  ) : (
                    <>
                      <span className="text-xl font-bold">${plan.price}</span>
                      {i18n.t('card.pricing.perMonth')}
                    </>
                  )}
                </CardDescription>
              </div>
              {plan.highlighted && (
                <CardAction>
                  <Badge>{i18n.t('card.pricing.recommended')}</Badge>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {plan.features.map((feature: string) => (
                  <li key={feature} className="text-sm">
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="border-t">
              <Button className="w-full" variant={plan.highlighted ? 'default' : 'outline'}>
                {i18n.t('card.action.subscribe')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryPricingTable: Story = {
  name: i18n.t('card.storyName.factoryPricingTable', 'Factory: createFakePricingTable'),
  render: () => <FactoryPricingTableDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-pricing-table')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(3);

    const buttons = canvas.getAllByRole('button', { name: /subscribe/i });
    expect(buttons.length).toBe(3);
  },
};

// ============ FACTORY: createFakeStatsCard ============

function getChangeVariant(direction: string): 'default' | 'destructive' | 'secondary' {
  if (direction === 'up') return 'default';
  if (direction === 'down') return 'destructive';
  return 'secondary';
}

function getChangePrefix(direction: string): string {
  if (direction === 'up') return '+';
  if (direction === 'down') return '-';
  return '';
}

function FactoryStatsCardDemo() {
  const stats = React.useMemo(() => createFakeStatsCard(), []);

  return (
    <div data-testid="factory-stats-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.stats.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.stats.description')}</p>
      <Card className="w-[280px]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{stats.metric}</CardTitle>
          <CardAction>
            <Badge variant={getChangeVariant(stats.changeDirection)}>
              {getChangePrefix(stats.changeDirection)}
              {stats.changePercent}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.unit === '$' ? '$' : ''}
            {stats.value.toLocaleString()}
            {stats.unit === '%' ? '%' : ''}
            {stats.unit === 'k' ? 'k' : ''}
          </div>
          <p className="text-muted-foreground text-xs">
            {i18n.t('card.stats.from')} {stats.timePeriod}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const FactoryStatsCard: Story = {
  name: i18n.t('card.storyName.factoryStatsCard', 'Factory: createFakeStatsCard'),
  render: () => <FactoryStatsCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-stats-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card-title"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeDashboardStats ============

function FactoryDashboardStatsDemo() {
  const dashboardStats = React.useMemo(() => createFakeDashboardStats(), []);

  return (
    <div data-testid="factory-dashboard-stats">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.stats.title')}</h3>
      <div className="grid grid-cols-2 gap-4">
        {dashboardStats.map((stats: FakeStatsCard) => (
          <Card key={stats.id} className="w-[220px]">
            <CardHeader>
              <CardTitle className="text-xs font-medium">{stats.metric}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {stats.unit === '$' ? '$' : ''}
                {stats.value.toLocaleString()}
                {stats.unit === '%' ? '%' : ''}
              </div>
              <p className="text-muted-foreground text-xs">
                {stats.changeDirection === 'up' ? '+' : '-'}
                {stats.changePercent}% {i18n.t('card.stats.from')} {stats.timePeriod}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryDashboardStats: Story = {
  name: i18n.t('card.storyName.factoryDashboardStats', 'Factory: createFakeDashboardStats'),
  render: () => <FactoryDashboardStatsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-dashboard-stats')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(4);
  },
};

// ============ FACTORY: createFakeArticleCard ============

function FactoryArticleCardDemo() {
  const article = React.useMemo(() => createFakeArticleCard(), []);

  return (
    <div data-testid="factory-article-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.article.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.article.description')}</p>
      <Card className="w-[400px] overflow-hidden">
        {article.image && (
          <div className="h-48 overflow-hidden">
            <img src={article.image} alt={article.title} className="size-full object-cover" />
          </div>
        )}
        <CardHeader>
          <div>
            <Badge variant="outline" className="mb-2">
              {article.category}
            </Badge>
            <CardTitle>{article.title}</CardTitle>
            <CardDescription>{article.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {article.authorAvatar && (
              <img
                src={article.authorAvatar}
                alt={article.author}
                className="size-6 rounded-full"
              />
            )}
            <span className="text-sm">
              {i18n.t('card.article.by')} {article.author}
            </span>
            <span className="text-muted-foreground text-xs">
              {article.readTime} {i18n.t('card.article.minRead')}
            </span>
          </div>
          {article.tags && article.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {article.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="border-t">
          <Button variant="outline" size="sm">
            {i18n.t('card.action.readMore')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const FactoryArticleCard: Story = {
  name: i18n.t('card.storyName.factoryArticleCard', 'Factory: createFakeArticleCard'),
  render: () => <FactoryArticleCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-article-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const readMoreButton = canvas.getByRole('button', { name: /read more/i });
    expect(readMoreButton).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeArticleCards (bulk) ============

function FactoryArticleCardsDemo() {
  const articles = React.useMemo(() => createFakeArticleCards(3), []);

  return (
    <div data-testid="factory-article-cards">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.article.title')}</h3>
      <div className="flex flex-col gap-4">
        {articles.map((article: FakeArticleCard) => (
          <Card key={article.id} className="w-[480px]">
            <CardHeader>
              <div>
                <CardTitle className="text-sm">{article.title}</CardTitle>
                <CardDescription className="text-xs">
                  {i18n.t('card.article.by')} {article.author} - {article.readTime}{' '}
                  {i18n.t('card.article.minRead')}
                </CardDescription>
              </div>
              <CardAction>
                <Badge variant="outline">{article.category}</Badge>
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryArticleCards: Story = {
  name: i18n.t('card.storyName.factoryArticleCards', 'Factory: createFakeArticleCards'),
  render: () => <FactoryArticleCardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-article-cards')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(3);
  },
};

// ============ FACTORY: createFakeImageCard ============

function FactoryImageCardDemo() {
  const imageCard = React.useMemo(() => createFakeImageCard(), []);

  return (
    <div data-testid="factory-image-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.image.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.image.description')}</p>
      <Card className="w-[350px] overflow-hidden">
        {imageCard.image && (
          <div className="h-48 overflow-hidden">
            <img src={imageCard.image} alt={imageCard.title} className="size-full object-cover" />
          </div>
        )}
        <CardHeader>
          <CardTitle>{imageCard.title}</CardTitle>
          <CardDescription>{imageCard.description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export const FactoryImageCard: Story = {
  name: i18n.t('card.storyName.factoryImageCard', 'Factory: createFakeImageCard'),
  render: () => <FactoryImageCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-image-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const img = canvasElement.querySelector('img');
    expect(img).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeTextOnlyCard ============

function FactoryTextOnlyCardDemo() {
  const textCard = React.useMemo(() => createFakeTextOnlyCard(), []);

  return (
    <div data-testid="factory-text-only-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.textOnly.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.textOnly.description')}</p>
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>{textCard.title}</CardTitle>
          <CardDescription>{textCard.description}</CardDescription>
        </CardHeader>
        {textCard.content && (
          <CardContent>
            <p className="text-sm">{textCard.content}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export const FactoryTextOnlyCard: Story = {
  name: i18n.t('card.storyName.factoryTextOnlyCard', 'Factory: createFakeTextOnlyCard'),
  render: () => <FactoryTextOnlyCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-text-only-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    const img = canvasElement.querySelector('img');
    expect(img).not.toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCompactCard ============

function FactoryCompactCardDemo() {
  const compactCard = React.useMemo(() => createFakeCompactCard(), []);

  return (
    <div data-testid="factory-compact-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.compact.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.compact.description')}</p>
      <Card className="w-[240px]">
        <CardHeader>
          <CardTitle className="text-sm">{compactCard.title}</CardTitle>
          <CardDescription className="text-xs">{compactCard.description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export const FactoryCompactCard: Story = {
  name: i18n.t('card.storyName.factoryCompactCard', 'Factory: createFakeCompactCard'),
  render: () => <FactoryCompactCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-compact-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    expect(canvasElement.querySelector('[data-slot="card-footer"]')).not.toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeFeaturedCard ============

function FactoryFeaturedCardDemo() {
  const featuredCard = React.useMemo(() => createFakeFeaturedCard(), []);

  return (
    <div data-testid="factory-featured-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.featured.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.featured.description')}</p>
      <Card className="w-[400px] overflow-hidden">
        {featuredCard.image && (
          <div className="h-56 overflow-hidden">
            <img
              src={featuredCard.image}
              alt={featuredCard.title}
              className="size-full object-cover"
            />
          </div>
        )}
        <CardHeader>
          <div>
            <CardTitle>{featuredCard.title}</CardTitle>
            <CardDescription>{featuredCard.description}</CardDescription>
          </div>
          {featuredCard.badge && (
            <CardAction>
              <Badge>{featuredCard.badge}</Badge>
            </CardAction>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}

export const FactoryFeaturedCard: Story = {
  name: i18n.t('card.storyName.factoryFeaturedCard', 'Factory: createFakeFeaturedCard'),
  render: () => <FactoryFeaturedCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-featured-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();

    expect(canvas.getByText('Featured')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeHorizontalCard ============

function FactoryHorizontalCardDemo() {
  const horizontalCard = React.useMemo(() => createFakeHorizontalCard(), []);

  return (
    <div data-testid="factory-horizontal-card">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.horizontal.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.horizontal.description')}</p>
      <Card className="flex w-[480px] flex-row overflow-hidden">
        {horizontalCard.image && (
          <div className="w-[200px] shrink-0 overflow-hidden">
            <img
              src={horizontalCard.image}
              alt={horizontalCard.title}
              className="size-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <CardHeader>
            <CardTitle>{horizontalCard.title}</CardTitle>
            <CardDescription>{horizontalCard.description}</CardDescription>
          </CardHeader>
          {horizontalCard.footer && (
            <CardFooter className="border-t">
              <p className="text-muted-foreground text-sm">{horizontalCard.footer}</p>
            </CardFooter>
          )}
        </div>
      </Card>
    </div>
  );
}

export const FactoryHorizontalCard: Story = {
  name: i18n.t('card.storyName.factoryHorizontalCard', 'Factory: createFakeHorizontalCard'),
  render: () => <FactoryHorizontalCardDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-horizontal-card')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCardMatrix ============

function FactoryCardMatrixDemo() {
  const matrix = React.useMemo(() => createFakeCardMatrix(), []);

  return (
    <div data-testid="factory-card-matrix">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.matrix.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.matrix.description')}</p>
      <div className="grid grid-cols-4 gap-3">
        {matrix.map((card: FakeCard) => (
          <Card key={card.id} className="w-[200px]">
            <CardHeader>
              <CardTitle className="text-xs">{card.title}</CardTitle>
              <CardDescription className="text-xs">
                {card.layout} / {card.size}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryCardMatrix: Story = {
  name: i18n.t('card.storyName.factoryCardMatrix', 'Factory: createFakeCardMatrix'),
  render: () => <FactoryCardMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-card-matrix')).toBeInTheDocument();

    // 4 layouts x 4 sizes = 16 cards
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(16);
  },
};

// ============ FACTORY: createFakeCardConfig ============

const CARD_CONFIG_SCENARIOS = ['default', 'full', 'minimal', 'withImage'] as const;

function FactoryCardConfigDemo() {
  const configs = React.useMemo(
    () => CARD_CONFIG_SCENARIOS.map((s) => ({ scenario: s, config: createFakeCardConfig(s) })),
    []
  );

  return (
    <div data-testid="factory-card-config">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.config.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.config.description')}</p>
      <div className="flex flex-wrap gap-4">
        {configs.map(({ scenario, config }: { config: FakeCardConfig; scenario: string }) => (
          <Card key={scenario} className="w-[250px]">
            <CardHeader>
              <CardTitle className="text-sm">
                {i18n.t('card.config.scenario')}: {scenario}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs">
                <li>Layout: {config.layout}</li>
                <li>Size: {config.size}</li>
                <li>
                  Image:{' '}
                  {config.hasImage
                    ? i18n.t('card.story.yes', 'Yes')
                    : i18n.t('card.story.no', 'No')}
                </li>
                <li>
                  Badge:{' '}
                  {config.hasBadge
                    ? i18n.t('card.story.yes', 'Yes')
                    : i18n.t('card.story.no', 'No')}
                </li>
                <li>
                  Footer:{' '}
                  {config.hasFooter
                    ? i18n.t('card.story.yes', 'Yes')
                    : i18n.t('card.story.no', 'No')}
                </li>
                <li>
                  Actions:{' '}
                  {config.hasActions
                    ? i18n.t('card.story.yes', 'Yes')
                    : i18n.t('card.story.no', 'No')}
                </li>
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const FactoryCardConfig: Story = {
  name: i18n.t('card.storyName.factoryCardConfig', 'Factory: createFakeCardConfig'),
  render: () => <FactoryCardConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-card-config')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(4);
  },
};

// ============ FACTORY: createFakeDemoCards ============

function FactoryDemoCardsDemo() {
  const demoCards = React.useMemo(() => createFakeDemoCards(), []);
  const keys = Object.keys(demoCards);

  return (
    <div data-testid="factory-demo-cards">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.demo.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.demo.description')}</p>
      <div className="flex flex-wrap gap-4">
        {keys.map((key) => {
          const value = demoCards[key];
          const isArray = Array.isArray(value);
          const count = isArray ? value.length : 1;

          return (
            <Card key={key} className="w-[200px]">
              <CardHeader>
                <CardTitle className="text-xs">{key}</CardTitle>
                <CardDescription className="text-xs">
                  {count} {isArray ? 'items' : 'item'}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export const FactoryDemoCards: Story = {
  name: i18n.t('card.storyName.factoryDemoCards', 'Factory: createFakeDemoCards'),
  render: () => <FactoryDemoCardsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('factory-demo-cards')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).not.toBe(0);
  },
};

// ============ CONSTANTS: CARD_LAYOUTS ============

function ConstantCardLayoutsDemo() {
  return (
    <div data-testid="constant-card-layouts">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.layouts.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.layouts.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_LAYOUTS.map((layout: CardLayout) => (
          <Card key={layout} className="w-[180px]">
            <CardHeader>
              <CardTitle className="text-sm">{layout}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardLayouts: Story = {
  name: i18n.t('card.storyName.constantCardLayouts', 'Constant: CARD_LAYOUTS'),
  render: () => <ConstantCardLayoutsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-layouts')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(CARD_LAYOUTS.length);
  },
};

// ============ CONSTANTS: CARD_SIZES ============

function ConstantCardSizesDemo() {
  return (
    <div data-testid="constant-card-sizes">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.sizes.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.sizes.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_SIZES.map((size: CardSize) => (
          <Card key={size} className="w-[180px]">
            <CardHeader>
              <CardTitle className="text-sm">{size}</CardTitle>
              <CardDescription className="text-xs">Width: {CARD_SIZE_WIDTHS[size]}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardSizes: Story = {
  name: i18n.t('card.storyName.constantCardSizes', 'Constant: CARD_SIZES'),
  render: () => <ConstantCardSizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-sizes')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(CARD_SIZES.length);
  },
};

// ============ CONSTANTS: CARD_CONTENT_TYPES ============

function ConstantCardContentTypesDemo() {
  return (
    <div data-testid="constant-card-content-types">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.contentTypes.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">
        {i18n.t('card.contentTypes.description')}
      </p>
      <div className="flex flex-wrap gap-3">
        {CARD_CONTENT_TYPES.map((type: CardContentType) => (
          <Card key={type} className="w-[160px]">
            <CardHeader>
              <CardTitle className="text-sm">{type}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardContentTypes: Story = {
  name: i18n.t('card.storyName.constantCardContentTypes', 'Constant: CARD_CONTENT_TYPES'),
  render: () => <ConstantCardContentTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-content-types')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(
      CARD_CONTENT_TYPES.length
    );
  },
};

// ============ CONSTANTS: CARD_STATUSES ============

function getStatusBadgeVariant(status: CardStatus): 'default' | 'outline' | 'secondary' {
  if (status === 'active' || status === 'featured') return 'default';
  if (status === 'disabled') return 'secondary';
  return 'outline';
}

function ConstantCardStatusesDemo() {
  return (
    <div data-testid="constant-card-statuses">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.statuses.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.statuses.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_STATUSES.map((status: CardStatus) => (
          <Card key={status} className="w-[160px]">
            <CardHeader>
              <CardTitle className="text-sm">{status}</CardTitle>
              <CardAction>
                <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardStatuses: Story = {
  name: i18n.t('card.storyName.constantCardStatuses', 'Constant: CARD_STATUSES'),
  render: () => <ConstantCardStatusesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-statuses')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(CARD_STATUSES.length);
  },
};

// ============ CONSTANTS: CARD_ACTION_TYPES ============

function ConstantCardActionTypesDemo() {
  return (
    <div data-testid="constant-card-action-types">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.actionTypes.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.actionTypes.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_ACTION_TYPES.map((actionType: CardActionType) => (
          <Card key={actionType} className="w-[160px]">
            <CardHeader>
              <CardTitle className="text-sm">{actionType}</CardTitle>
            </CardHeader>
            <CardFooter className="border-t">
              <Button size="sm" variant="outline" className="w-full">
                {i18n.t(`card.action.${actionType}`)}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardActionTypes: Story = {
  name: i18n.t('card.storyName.constantCardActionTypes', 'Constant: CARD_ACTION_TYPES'),
  render: () => <ConstantCardActionTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-action-types')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(
      CARD_ACTION_TYPES.length
    );

    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).toBe(CARD_ACTION_TYPES.length);
    await userEvent.click(buttons[0]);
  },
};

// ============ CONSTANTS: CARD_TITLES ============

function ConstantCardTitlesDemo() {
  return (
    <div data-testid="constant-card-titles">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.titles.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.titles.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_TITLES.map((title: string) => (
          <Card key={title} className="w-[200px]">
            <CardHeader>
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardTitles: Story = {
  name: i18n.t('card.storyName.constantCardTitles', 'Constant: CARD_TITLES'),
  render: () => <ConstantCardTitlesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-titles')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(CARD_TITLES.length);

    expect(canvas.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(canvas.getByText('Account Settings')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: CARD_BADGES ============

function ConstantCardBadgesDemo() {
  return (
    <div data-testid="constant-card-badges">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.badges.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.badges.description')}</p>
      <div className="flex flex-wrap gap-3">
        {CARD_BADGES.map((badge: string) => (
          <Card key={badge} className="w-[140px]">
            <CardHeader>
              <CardTitle className="text-sm">{badge}</CardTitle>
              <CardAction>
                <Badge>{badge}</Badge>
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardBadges: Story = {
  name: i18n.t('card.storyName.constantCardBadges', 'Constant: CARD_BADGES'),
  render: () => <ConstantCardBadgesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-badges')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(CARD_BADGES.length);

    expect(canvas.getAllByText('New').length).not.toBe(0);
    expect(canvas.getAllByText('Featured').length).not.toBe(0);
  },
};

// ============ CONSTANTS: CARD_SIZE_WIDTHS ============

function ConstantCardSizeWidthsDemo() {
  const entries = Object.entries(CARD_SIZE_WIDTHS) as [CardSize, string][];

  return (
    <div data-testid="constant-card-size-widths">
      <h3 className="mb-3 text-lg font-semibold">{i18n.t('card.sizeWidths.title')}</h3>
      <p className="text-muted-foreground mb-4 text-sm">{i18n.t('card.sizeWidths.description')}</p>
      <div className="flex flex-col gap-3">
        {entries.map(([size, widthClass]: [CardSize, string]) => (
          <Card key={size} className="w-[300px]">
            <CardHeader>
              <CardTitle className="text-sm">{size}</CardTitle>
              <CardAction>
                <Badge variant="outline">{widthClass}</Badge>
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const ConstantCardSizeWidths: Story = {
  name: i18n.t('card.storyName.constantCardSizeWidths', 'Constant: CARD_SIZE_WIDTHS'),
  render: () => <ConstantCardSizeWidthsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('constant-card-size-widths')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBe(
      Object.keys(CARD_SIZE_WIDTHS).length
    );
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('card.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('card.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('card.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('card.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  name: i18n.t('card.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: cardStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
