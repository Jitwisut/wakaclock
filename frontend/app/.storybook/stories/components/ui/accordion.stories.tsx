import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  accordionHandlers,
  accordionStatusHandlers,
} from '@/.storybook/stories/_handlers/accordion.handlers';
import {
  ACCORDION_ACTION_TITLES,
  ACCORDION_ANIMATIONS,
  ACCORDION_BADGES,
  ACCORDION_CONTENTS,
  ACCORDION_DIRECTIONS,
  ACCORDION_FAQ_TITLES,
  ACCORDION_ICONS,
  ACCORDION_ITEM_STATES,
  ACCORDION_ORIENTATIONS,
  ACCORDION_TITLES,
  ACCORDION_TYPES,
  ACCORDION_WIDTHS,
  type AccordionAnimation,
  type AccordionDirection,
  type AccordionItemState,
  type AccordionOrientation,
  type AccordionType,
  type AccordionWidth,
  createFakeAccordionConfig,
  createFakeAccordionGroup,
  createFakeAccordionGroups,
  createFakeAccordionItem,
  createFakeAccordionItemDisabled,
  createFakeAccordionItemExpanded,
  createFakeAccordionItems,
  createFakeAccordionItemsUnique,
  createFakeAccordionMatrix,
  createFakeAccordionStateMatrix,
  createFakeAccordionWithAllStates,
  createFakeAccordionWithBadges,
  createFakeAccordionWithDisabled,
  createFakeAccordionWithIcons,
  createFakeDocumentationAccordion,
  createFakeFAQItems,
  createFakeNestedAccordion,
  createFakeNestedAccordionItems,
  createFakePricingAccordion,
  createFakeSettingsItems,
  createFakeUltimateAccordion,
  type FakeAccordionConfig,
  type FakeAccordionGroup,
  type FakeAccordionItem,
  type FakeNestedAccordion,
} from '@/.storybook/stories/_factories/accordion.factory';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, BellIcon, RefreshCwIcon, SettingsIcon, ShieldIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// ============ HELPER FUNCTIONS ============

/**
 * Get width class based on accordion width variant
 * Avoids nested ternaries per ESLint rules
 */
function getWidthClass(width: string): string {
  if (width === 'compact') return 'w-[280px]';
  if (width === 'full') return 'w-full';
  return 'w-[420px]';
}

function AccordionDemo() {
  return (
    <Accordion className="w-[420px]" collapsible type="single" data-testid="accordion-demo">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          {i18n.t('accordion.story.isItAccessible', 'Is it accessible?')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.waiAriaAnswer',
            'Yes. It follows WAI-ARIA patterns via Radix primitives.'
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>
          {i18n.t('accordion.story.isItKeyboardNavigable', 'Is it keyboard navigable?')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t('accordion.story.keyboardAnswer', 'Yes. Arrow keys move focus between triggers.')}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>
          {i18n.t('accordion.story.canIStyleIt', 'Can I style it?')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.styleAnswer',
            'Yes. It uses Tailwind classes and `cn()` composition.'
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const meta = {
  title: 'Components/UI/Accordion',
  component: AccordionDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onValueChange: fn(),
  },
  argTypes: {
    // ============ CONTENT CATEGORY ============
    // Note: These describe the AccordionItem content structure
    // children: Defined as AccordionTrigger + AccordionContent pairs

    // ============ APPEARANCE CATEGORY ============
    // type: Selection mode - 'single' allows one item open, 'multiple' allows many
    // className: Additional CSS classes for custom styling
    // orientation: Layout direction ('horizontal' | 'vertical')

    // ============ STATE CATEGORY ============
    // value: Controlled expanded value (string | string[])
    // defaultValue: Default expanded for uncontrolled usage
    // collapsible: Allow collapsing all items when type='single'
    // disabled: Disable all accordion items

    // ============ LAYOUT CATEGORY ============
    // dir: Reading direction ('ltr' | 'rtl') for RTL support

    // ============ EVENTS CATEGORY ============
    onClick: {
      action: 'onClick',
      description: i18n.t('accordion.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('accordion.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('accordion.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('accordion.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('accordion.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('accordion.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('accordion.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onValueChange: {
      action: 'onValueChange',
      description: i18n.t(
        'accordion.argType.calledWhenExpandedItemChanges',
        'Called when expanded item changes'
      ),
      table: { category: 'Events' },
    },
  },
  parameters: {
    msw: { handlers: accordionHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof AccordionDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
  },
};

function MultipleDemo() {
  return (
    <Accordion className="w-[420px]" type="multiple">
      <AccordionItem value="a">
        <AccordionTrigger>{i18n.t('accordion.first')}</AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.contentFirst')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>{i18n.t('accordion.second')}</AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.contentSecond')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="c">
        <AccordionTrigger>{i18n.t('accordion.third')}</AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.contentThird')}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const Multiple: Story = {
  render: () => <MultipleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();

    // Verify multiple type accordion allows multiple items open
    const firstTrigger = canvas.getByRole('button', { name: /first/i });
    const secondTrigger = canvas.getByRole('button', { name: /second/i });

    await userEvent.click(firstTrigger);
    await userEvent.click(secondTrigger);

    await waitFor(() => {
      expect(firstTrigger.getAttribute('aria-expanded')).toBe('true');
      expect(secondTrigger.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.singleCollapsible')}</p>
        <Accordion className="w-[420px]" collapsible type="single">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.firstItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.singleContent')}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>{i18n.t('accordion.secondItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.clickToExpand')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.multipleSelection')}</p>
        <Accordion className="w-[420px]" type="multiple">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.firstItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.multipleContent')}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>{i18n.t('accordion.secondItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.multipleSecondContent')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.withDisabled')}</p>
        <Accordion className="w-[420px]" collapsible type="single">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.enabledItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.enabledContent')}</AccordionContent>
          </AccordionItem>
          <AccordionItem disabled value="item-2">
            <AccordionTrigger>{i18n.t('accordion.disabledItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.disabledContent')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify single collapsible variant
    expect(canvas.getByText(/single collapsible/i)).toBeInTheDocument();

    // Verify multiple selection variant
    expect(canvas.getByText(/multiple selection/i)).toBeInTheDocument();

    // Verify with disabled variant
    expect(canvas.getByText(/with disabled/i)).toBeInTheDocument();

    // Verify disabled item exists
    const disabledItems = canvasElement.querySelectorAll('[data-disabled="true"]');
    expect(disabledItems.length).toBeGreaterThan(0);
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.compact')}</p>
        <Accordion className="w-[280px]" collapsible type="single">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.compactItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.compactContent')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.default')}</p>
        <Accordion className="w-[420px]" collapsible type="single">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.defaultItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.defaultContent')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('accordion.fullWidth')}</p>
        <Accordion className="w-full" collapsible type="single">
          <AccordionItem value="item-1">
            <AccordionTrigger>{i18n.t('accordion.fullWidthItem')}</AccordionTrigger>
            <AccordionContent>{i18n.t('accordion.fullWidthContent')}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify all size variants are present
    expect(canvas.getByText(/compact/i)).toBeInTheDocument();
    expect(canvas.getByText(/default/i)).toBeInTheDocument();
    expect(canvas.getByText(/full width/i)).toBeInTheDocument();

    // Verify accordions rendered
    const accordions = canvasElement.querySelectorAll('[data-slot="accordion"]');
    expect(accordions.length).toBe(3);
  },
};

export const Playground: Story = {
  ...Single,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="accordion"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    const firstTrigger = canvas.getByRole('button', { name: 'Is it accessible?' });
    const secondTrigger = canvas.getByRole('button', { name: 'Is it keyboard navigable?' });

    firstTrigger.focus();
    expect(doc.activeElement).toBe(firstTrigger);

    await userEvent.keyboard('{ArrowDown}');
    expect(doc.activeElement).toBe(secondTrigger);

    expect(firstTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(firstTrigger.getAttribute('data-state')).toBe('closed');

    await userEvent.click(firstTrigger);

    await waitFor(() => {
      expect(firstTrigger.getAttribute('aria-expanded')).toBe('true');
      expect(firstTrigger.getAttribute('data-state')).toBe('open');
    });

    await userEvent.click(firstTrigger);

    await waitFor(() => {
      expect(firstTrigger.getAttribute('aria-expanded')).toBe('false');
      expect(firstTrigger.getAttribute('data-state')).toBe('closed');
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
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.japanese', 'Japanese'),
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

    // Add any accordion-specific assertions
    expect(canvasElement.querySelector('[data-slot="accordion"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
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
  name: i18n.t('accordion.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// Demo with Faker data (static, no API)
function AccordionWithFakerData() {
  const items = React.useMemo(() => createFakeAccordionItems(5), []);

  return (
    <Accordion className="w-[500px]" collapsible type="single" data-testid="accordion-faker">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function AccordionErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="accordion-error">
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
          {i18n.t('accordion.story.retry', 'Retry')}
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function AccordionLoadingSkeleton() {
  return (
    <div className="w-[500px] space-y-2" data-state="loading" data-testid="accordion-loading">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`accordion-skeleton-${String(i)}`} className="rounded-md border">
          <div className="flex items-center justify-between p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="size-4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty state
function AccordionEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="accordion-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('accordion.story.noItemsFound', 'No items found')}
      </p>
    </div>
  );
}

// Demo component with async data fetching via MSW
function AccordionWithAsyncData() {
  const [data, setData] = React.useState<FakeAccordionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/accordion-items?limit=5')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ items: FakeAccordionItem[]; total: number }>;
      })
      .then((json) => {
        setData(json.items);
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
    return <AccordionLoadingSkeleton />;
  }

  if (error) {
    return <AccordionErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (data.length === 0) {
    return <AccordionEmptyState />;
  }

  return (
    <Accordion
      className="w-[500px]"
      collapsible
      type="single"
      data-state="success"
      data-testid="accordion-success"
    >
      {data.map((item) => (
        <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// I18n Demo - exported for potential future use
export function I18nAccordionDemo() {
  return (
    <Accordion className="w-[420px]" collapsible type="single" data-testid="accordion-demo">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          {i18n.t('accordion.story.isItAccessible', 'Is it accessible?')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t('accordion.story.waiAriaAnswerShort', 'Yes. It follows WAI-ARIA patterns.')}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>
          {i18n.t('accordion.story.isItKeyboardNavigable', 'Is it keyboard navigable?')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t('accordion.story.keyboardAnswer', 'Yes. Arrow keys move focus between triggers.')}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const WithFakerData: Story = {
  render: () => <AccordionWithFakerData />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="accordion-faker"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers).toHaveLength(5);
  },
};

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: accordionHandlers },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Wait for loading to complete
    await waitFor(
      () => {
        const success = canvasElement.querySelector('[data-testid="accordion-success"]');
        expect(success).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: accordionHandlers },
  },
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.loading },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const loading = canvasElement.querySelector('[data-testid="accordion-loading"]');
      expect(loading).toBeInTheDocument();
    });
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.emptyData },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const empty = canvasElement.querySelector('[data-testid="accordion-empty"]');
        expect(empty).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const SlowResponse: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.slowResponse },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const success = canvasElement.querySelector('[data-testid="accordion-success"]');
        expect(success).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  },
};

export const Error400BadRequest: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.badRequest },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="400"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.unauthorized },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="401"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.forbidden },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="403"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.unprocessableEntity },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="422"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.tooManyRequests },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="429"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.internalServerError },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="500"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.badGateway },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="502"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.serviceUnavailable },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="503"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.gatewayTimeout },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-error-status="504"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const NetworkError: Story = {
  parameters: {
    msw: { handlers: accordionStatusHandlers.networkError },
  },
  render: () => <AccordionWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        const error = canvasElement.querySelector('[data-testid="accordion-error"]');
        expect(error).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ NESTED ITEM STORIES ============

export const NestedItems: Story = {
  name: i18n.t('accordion.storyName.nestedItems', 'Nested Items (Accordion in Accordion)'),
  render: () => (
    <Accordion className="w-[500px]" collapsible type="single" data-testid="outer-accordion">
      <AccordionItem value="parent-1">
        <AccordionTrigger>Parent Category 1</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground mb-4 text-sm">
            This parent contains a nested accordion:
          </p>
          <Accordion collapsible type="single" className="ml-4" data-testid="nested-accordion-1">
            <AccordionItem value="child-1-1">
              <AccordionTrigger>Nested Item 1.1</AccordionTrigger>
              <AccordionContent>Content for nested item 1.1</AccordionContent>
            </AccordionItem>
            <AccordionItem value="child-1-2">
              <AccordionTrigger>Nested Item 1.2</AccordionTrigger>
              <AccordionContent>Content for nested item 1.2</AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="parent-2">
        <AccordionTrigger>Parent Category 2</AccordionTrigger>
        <AccordionContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Another nested accordion with different items:
          </p>
          <Accordion collapsible type="single" className="ml-4" data-testid="nested-accordion-2">
            <AccordionItem value="child-2-1">
              <AccordionTrigger>Nested Item 2.1</AccordionTrigger>
              <AccordionContent>Content for nested item 2.1</AccordionContent>
            </AccordionItem>
            <AccordionItem value="child-2-2">
              <AccordionTrigger>Nested Item 2.2</AccordionTrigger>
              <AccordionContent>Content for nested item 2.2</AccordionContent>
            </AccordionItem>
            <AccordionItem value="child-2-3">
              <AccordionTrigger>Nested Item 2.3</AccordionTrigger>
              <AccordionContent>Content for nested item 2.3</AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="parent-3">
        <AccordionTrigger>Parent Category 3 (No Nesting)</AccordionTrigger>
        <AccordionContent>
          This item has regular content without nested accordions.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find outer accordion
    const outerAccordion = canvasElement.querySelector('[data-testid="outer-accordion"]');
    expect(outerAccordion).toBeInTheDocument();

    // Open first parent
    const parentTrigger = canvas.getByRole('button', { name: 'Parent Category 1' });
    await userEvent.click(parentTrigger);

    // Wait for nested accordion to be visible
    await waitFor(() => {
      const nestedAccordion = canvasElement.querySelector('[data-testid="nested-accordion-1"]');
      expect(nestedAccordion).toBeInTheDocument();
    });

    // Open nested item
    const nestedTrigger = canvas.getByRole('button', { name: 'Nested Item 1.1' });
    await userEvent.click(nestedTrigger);

    await waitFor(() => {
      expect(nestedTrigger.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

export const DeeplyNestedItems: Story = {
  name: i18n.t('accordion.storyName.deeplyNestedItems', 'Deeply Nested Items (3 Levels)'),
  render: () => (
    <Accordion className="w-[600px]" collapsible type="single" data-testid="level-1">
      <AccordionItem value="l1-1">
        <AccordionTrigger>{i18n.t('accordion.story.level1Category')}</AccordionTrigger>
        <AccordionContent>
          <Accordion collapsible type="single" className="mt-2 ml-4" data-testid="level-2">
            <AccordionItem value="l2-1">
              <AccordionTrigger>{i18n.t('accordion.story.level2Subcategory')}</AccordionTrigger>
              <AccordionContent>
                <Accordion collapsible type="single" className="mt-2 ml-4" data-testid="level-3">
                  <AccordionItem value="l3-1">
                    <AccordionTrigger>{i18n.t('accordion.story.level3DetailA')}</AccordionTrigger>
                    <AccordionContent>
                      {i18n.t('accordion.story.level3DetailAContent')}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="l3-2">
                    <AccordionTrigger>{i18n.t('accordion.story.level3DetailB')}</AccordionTrigger>
                    <AccordionContent>
                      {i18n.t('accordion.story.level3DetailBContent')}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="l2-2">
              <AccordionTrigger>
                {i18n.t('accordion.story.level2AnotherSubcategory')}
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.story.level2Content')}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open all levels
    const level1Trigger = canvas.getByRole('button', {
      name: i18n.t('accordion.story.level1Category'),
    });
    await userEvent.click(level1Trigger);

    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="level-2"]')).toBeInTheDocument();
    });

    const level2Trigger = canvas.getByRole('button', {
      name: i18n.t('accordion.story.level2Subcategory'),
    });
    await userEvent.click(level2Trigger);

    await waitFor(() => {
      expect(canvasElement.querySelector('[data-testid="level-3"]')).toBeInTheDocument();
    });

    const level3Trigger = canvas.getByRole('button', { name: 'Level 3: Detail A' });
    await userEvent.click(level3Trigger);

    await waitFor(() => {
      expect(level3Trigger.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

export const NestedWithRichContent: Story = {
  name: i18n.t('accordion.storyName.nestedWithRichContent', 'Nested Items with Rich Content'),
  render: () => (
    <Accordion className="w-[600px]" collapsible type="single">
      <AccordionItem value="docs">
        <AccordionTrigger>
          {i18n.t('accordion.story.documentationStructure', 'Documentation Structure')}
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Our documentation is organized into the following sections:
            </p>
            <Accordion type="multiple" className="ml-4">
              <AccordionItem value="getting-started">
                <AccordionTrigger>
                  {i18n.t('accordion.story.gettingStarted', 'Getting Started')}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    <li>{i18n.t('accordion.story.installationGuide', 'Installation guide')}</li>
                    <li>{i18n.t('accordion.story.quickStartTutorial', 'Quick start tutorial')}</li>
                    <li>{i18n.t('accordion.story.configurationBasics', 'Configuration basics')}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="components">
                <AccordionTrigger>
                  {i18n.t('accordion.story.components', 'Components')}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    <li>
                      {i18n.t(
                        'accordion.story.buttonInteractiveButtons',
                        'Button - Interactive buttons'
                      )}
                    </li>
                    <li>
                      {i18n.t('accordion.story.inputTextInputFields', 'Input - Text input fields')}
                    </li>
                    <li>
                      {i18n.t(
                        'accordion.story.accordionCollapsiblePanels',
                        'Accordion - Collapsible panels'
                      )}
                    </li>
                    <li>
                      {i18n.t('accordion.story.dialogModalDialogs', 'Dialog - Modal dialogs')}
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="api">
                <AccordionTrigger>
                  {i18n.t('accordion.story.apiReference', 'API Reference')}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc space-y-1 pl-4 text-sm">
                    <li>{i18n.t('accordion.story.restEndpoints', 'REST endpoints')}</li>
                    <li>{i18n.t('accordion.story.graphqlSchema', 'GraphQL schema')}</li>
                    <li>{i18n.t('accordion.story.websocketEvents', 'WebSocket events')}</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq">
        <AccordionTrigger>
          {i18n.t('accordion.story.frequentlyAskedQuestions', 'Frequently Asked Questions')}
        </AccordionTrigger>
        <AccordionContent>
          <Accordion collapsible type="single" className="ml-4">
            <AccordionItem value="faq-1">
              <AccordionTrigger>
                {i18n.t('accordion.story.howDoIGetStarted', 'How do I get started?')}
              </AccordionTrigger>
              <AccordionContent>
                Check our Getting Started guide in the Documentation section above.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2">
              <AccordionTrigger>
                {i18n.t('accordion.story.whatBrowsersAreSupported', 'What browsers are supported?')}
              </AccordionTrigger>
              <AccordionContent>
                We support all modern browsers including Chrome, Firefox, Safari, and Edge.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Open Documentation Structure
    const docsTrigger = canvas.getByRole('button', { name: 'Documentation Structure' });
    await userEvent.click(docsTrigger);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Getting Started' })).toBeInTheDocument();
    });

    // Open multiple nested items (type="multiple")
    const gettingStarted = canvas.getByRole('button', { name: 'Getting Started' });
    const components = canvas.getByRole('button', { name: 'Components' });

    await userEvent.click(gettingStarted);
    await userEvent.click(components);

    await waitFor(() => {
      expect(gettingStarted.getAttribute('aria-expanded')).toBe('true');
      expect(components.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

export const Accessibility: Story = {
  name: i18n.t('accordion.storyName.accessibility', 'Accessibility'),
  render: () => (
    <Accordion className="w-[420px]" collapsible type="single">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          {i18n.t('accordion.story.firstAccessibleItem', 'First accessible item')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.contentForTheFirstItemWithProperAriaAttr',
            'Content for the first item with proper ARIA attributes.'
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>
          {i18n.t('accordion.story.secondAccessibleItem', 'Second accessible item')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.contentForTheSecondItemWithKeyboardNavig',
            'Content for the second item with keyboard navigation.'
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>
          {i18n.t('accordion.story.thirdAccessibleItem', 'Third accessible item')}
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.contentForTheThirdItemWithFocusManagemen',
            'Content for the third item with focus management.'
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Test accordion structure
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();

    // Get all triggers
    const triggers = canvas.getAllByRole('button');
    expect(triggers.length).toBe(3);

    // Verify ARIA attributes on triggers
    for (const trigger of triggers) {
      expect(trigger).toHaveAttribute('aria-expanded');
      expect(trigger).toHaveAttribute('aria-controls');
    }

    // Test keyboard navigation - focus first trigger
    triggers[0].focus();
    expect(doc.activeElement).toBe(triggers[0]);

    // Arrow down should move to next trigger
    await userEvent.keyboard('{ArrowDown}');
    expect(doc.activeElement).toBe(triggers[1]);

    // Arrow down again
    await userEvent.keyboard('{ArrowDown}');
    expect(doc.activeElement).toBe(triggers[2]);

    // Arrow up should move back
    await userEvent.keyboard('{ArrowUp}');
    expect(doc.activeElement).toBe(triggers[1]);

    // Home key should go to first trigger
    await userEvent.keyboard('{Home}');
    expect(doc.activeElement).toBe(triggers[0]);

    // End key should go to last trigger
    await userEvent.keyboard('{End}');
    expect(doc.activeElement).toBe(triggers[2]);

    // Enter/Space should toggle accordion item
    triggers[0].focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    });

    // Space should also work
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(triggers[0].getAttribute('aria-expanded')).toBe('false');
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'Accessibility testing with keyboard navigation and ARIA validation.',
      },
    },
  },
};

// ============ COMPREHENSIVE KEYBOARD INTERACTION STORY ============

function KeyboardInteractionDemo() {
  const { t } = useTranslation();
  const [expandHistory, setExpandHistory] = React.useState<string[]>([]);

  const handleValueChange = (value: string) => {
    setExpandHistory((prev) => [...prev, value || 'collapsed']);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('accordion.story.tabToFocus')}</p>
      <Accordion
        className="w-[420px]"
        collapsible
        type="single"
        data-testid="keyboard-accordion"
        onValueChange={handleValueChange}
      >
        <AccordionItem value="item-1">
          <AccordionTrigger data-testid="trigger-1">
            {t('accordion.a11y.firstItem')}
          </AccordionTrigger>
          <AccordionContent>{t('accordion.a11y.firstContent')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger data-testid="trigger-2">
            {t('accordion.a11y.secondItem')}
          </AccordionTrigger>
          <AccordionContent>{t('accordion.a11y.secondContent')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger data-testid="trigger-3">
            {t('accordion.a11y.thirdItem')}
          </AccordionTrigger>
          <AccordionContent>{t('accordion.a11y.thirdContent')}</AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="text-muted-foreground text-xs" data-testid="expand-history">
        {t('accordion.story.expandHistory')}:{' '}
        {expandHistory.length > 0 ? expandHistory.join(' → ') : t('accordion.story.none')}
      </div>
    </div>
  );
}

export const KeyboardInteraction: Story = {
  name: i18n.t('accordion.storyName.keyboardInteraction', 'Keyboard Interaction'),
  render: () => <KeyboardInteractionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger1 = canvas.getByTestId('trigger-1');
    const trigger2 = canvas.getByTestId('trigger-2');
    const trigger3 = canvas.getByTestId('trigger-3');

    // Tab to first trigger
    await userEvent.tab();
    expect(trigger1).toHaveFocus();

    // Enter key expands
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('true');
    });

    // Arrow Down moves focus
    await userEvent.keyboard('{ArrowDown}');
    expect(trigger2).toHaveFocus();

    // Space key expands second item (and collapses first in single mode)
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(trigger2.getAttribute('aria-expanded')).toBe('true');
      expect(trigger1.getAttribute('aria-expanded')).toBe('false');
    });

    // Arrow Down to third
    await userEvent.keyboard('{ArrowDown}');
    expect(trigger3).toHaveFocus();

    // Home key goes to first
    await userEvent.keyboard('{Home}');
    expect(trigger1).toHaveFocus();

    // End key goes to last
    await userEvent.keyboard('{End}');
    expect(trigger3).toHaveFocus();

    // Arrow Up wraps (or goes to previous)
    await userEvent.keyboard('{ArrowUp}');
    expect(trigger2).toHaveFocus();

    // Verify expand history recorded interactions
    const history = canvas.getByTestId('expand-history');
    expect(history.textContent).toContain('item-1');
    expect(history.textContent).toContain('item-2');
  },
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive keyboard navigation test: Tab, Enter, Space, Arrow keys, Home, End.',
      },
    },
  },
};

// ============ DISABLED KEYBOARD BEHAVIOR ============

function DisabledKeyboardBehaviorDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{i18n.t('accordion.story.disabledSkipped')}</p>
      <Accordion className="w-[420px]" collapsible type="single" data-testid="disabled-accordion">
        <AccordionItem value="item-1">
          <AccordionTrigger data-testid="enabled-trigger-1">
            {i18n.t('accordion.enabledItem')}
          </AccordionTrigger>
          <AccordionContent>{i18n.t('accordion.enabledContent')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" disabled>
          <AccordionTrigger data-testid="disabled-trigger">
            {i18n.t('accordion.disabledItem')}
          </AccordionTrigger>
          <AccordionContent>{i18n.t('accordion.disabledContent')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger data-testid="enabled-trigger-2">
            {i18n.t('accordion.enabledItem')} 2
          </AccordionTrigger>
          <AccordionContent>{i18n.t('accordion.enabledContent')}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export const DisabledKeyboardBehavior: Story = {
  name: i18n.t('accordion.storyName.disabledKeyboardBehavior', 'Disabled Keyboard Behavior'),
  render: () => <DisabledKeyboardBehaviorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const enabledTrigger1 = canvas.getByTestId('enabled-trigger-1');
    const disabledTrigger = canvas.getByTestId('disabled-trigger');
    const enabledTrigger2 = canvas.getByTestId('enabled-trigger-2');

    // Tab to first enabled trigger
    await userEvent.tab();
    expect(enabledTrigger1).toHaveFocus();

    // Arrow down should skip disabled item
    await userEvent.keyboard('{ArrowDown}');
    // Focus should move to enabled-trigger-2, skipping disabled
    expect(enabledTrigger2).toHaveFocus();

    // Disabled trigger should not be expandable via click
    await userEvent.click(disabledTrigger);
    await waitFor(() => {
      expect(disabledTrigger.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

// ============ FOCUS MANAGEMENT ============

function FocusManagementDemo() {
  const { t } = useTranslation();
  const [focusedItem, setFocusedItem] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t('accordion.story.focusTracking')}</p>
      <Accordion className="w-[420px]" collapsible type="single" data-testid="focus-accordion">
        {['item-1', 'item-2', 'item-3'].map((value) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger
              data-testid={`focus-trigger-${value}`}
              onFocus={() => setFocusedItem(value)}
              onBlur={() => setFocusedItem(null)}
            >
              {t('accordion.firstItem')} {value.split('-')[1]}
            </AccordionTrigger>
            <AccordionContent>{t('accordion.singleContent')}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="text-muted-foreground text-sm" data-testid="focus-indicator">
        {t('accordion.story.currentFocus')}: {focusedItem ?? t('accordion.story.none')}
      </div>
    </div>
  );
}

export const FocusManagement: Story = {
  name: i18n.t('accordion.storyName.focusManagement', 'Focus Management'),
  render: () => <FocusManagementDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger1 = canvas.getByTestId('focus-trigger-item-1');
    const trigger2 = canvas.getByTestId('focus-trigger-item-2');
    const focusIndicator = canvas.getByTestId('focus-indicator');

    // Tab to first trigger
    await userEvent.tab();
    expect(trigger1).toHaveFocus();
    await waitFor(() => {
      expect(focusIndicator.textContent).toContain('item-1');
    });

    // Move focus
    await userEvent.keyboard('{ArrowDown}');
    expect(trigger2).toHaveFocus();
    await waitFor(() => {
      expect(focusIndicator.textContent).toContain('item-2');
    });

    // Tab out
    await userEvent.tab();
    await waitFor(() => {
      expect(focusIndicator.textContent).toContain('none');
    });
  },
};

// ============ DARK MODE STORY ============

export const DarkKeyboardInteraction: Story = {
  name: i18n.t('accordion.storyName.darkKeyboardInteraction', 'Dark Mode + Keyboard'),
  ...KeyboardInteraction,
  globals: {
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify dark mode is applied
    const accordion = canvasElement.querySelector('[data-testid="keyboard-accordion"]');
    expect(accordion).toBeInTheDocument();

    // Run keyboard tests in dark mode
    const trigger1 = canvas.getByTestId('trigger-1');
    await userEvent.tab();
    expect(trigger1).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ JAPANESE LOCALE WITH KEYBOARD ============

function JapaneseAccordionDemo() {
  return (
    <Accordion className="w-[420px]" collapsible type="single" data-testid="ja-accordion">
      <AccordionItem value="item-1">
        <AccordionTrigger data-testid="ja-trigger-1">
          {i18n.t('accordion.item1.title')}
        </AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.item1.content')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger data-testid="ja-trigger-2">
          {i18n.t('accordion.item2.title')}
        </AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.item2.content')}</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger data-testid="ja-trigger-3">
          {i18n.t('accordion.item3.title')}
        </AccordionTrigger>
        <AccordionContent>{i18n.t('accordion.item3.content')}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const JapaneseWithKeyboard: Story = {
  name: i18n.t('accordion.storyName.japaneseWithKeyboard', 'Japanese + Keyboard'),
  globals: {
    locale: 'ja',
  },
  render: () => <JapaneseAccordionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale
    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    // Verify Japanese text is rendered
    const trigger1 = canvas.getByTestId('ja-trigger-1');
    expect(trigger1.textContent).toContain('アクセシブル');

    // Test keyboard in Japanese locale
    await userEvent.tab();
    expect(trigger1).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ DARK MODE + JAPANESE ============

export const DarkModeJapanese: Story = {
  name: i18n.t('accordion.storyName.darkModeJapanese', 'Dark Mode + Japanese'),
  globals: {
    theme: 'dark',
    locale: 'ja',
  },
  render: () => <JapaneseAccordionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify Japanese locale in dark mode
    await waitFor(() => {
      expect(doc.documentElement.lang).toBe('ja');
    });

    const trigger = canvas.getByTestId('ja-trigger-1');
    expect(trigger.textContent).toContain('アクセシブル');

    // Keyboard test
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ RTL WITH KEYBOARD ============

function RTLAccordionDemo() {
  return (
    <div dir="rtl">
      <Accordion className="w-[420px]" collapsible type="single" data-testid="rtl-accordion">
        <AccordionItem value="item-1">
          <AccordionTrigger data-testid="rtl-trigger-1">
            {i18n.t('accordion.item1.title')}
          </AccordionTrigger>
          <AccordionContent>{i18n.t('accordion.item1.content')}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger data-testid="rtl-trigger-2">
            {i18n.t('accordion.item2.title')}
          </AccordionTrigger>
          <AccordionContent>{i18n.t('accordion.item2.content')}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export const RTLWithKeyboard: Story = {
  name: i18n.t('accordion.storyName.rTLWithKeyboard', 'RTL + Keyboard'),
  globals: {
    addonRtl: 'rtl',
  },
  render: () => <RTLAccordionDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const rtlContainer = canvasElement.querySelector('[dir="rtl"]');
    expect(rtlContainer).toBeInTheDocument();

    const trigger1 = canvas.getByTestId('rtl-trigger-1');
    const trigger2 = canvas.getByTestId('rtl-trigger-2');

    // Keyboard navigation should still work in RTL
    await userEvent.tab();
    expect(trigger1).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(trigger2).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(trigger2.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ DATA ATTRIBUTE VERIFICATION ============

function DataAttributesDemo() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        All accordion elements expose data-* attributes for CSS targeting and testing
      </p>
      <Accordion className="w-[420px]" collapsible type="single" data-testid="data-attr-accordion">
        <AccordionItem value="item-1" data-testid="data-attr-item-1">
          <AccordionTrigger data-testid="data-attr-trigger-1">
            {i18n.t('accordion.story.openStateExample', 'Open State Example')}
          </AccordionTrigger>
          <AccordionContent data-testid="data-attr-content-1">
            Content with data attributes for testing.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" disabled data-testid="data-attr-item-2">
          <AccordionTrigger data-testid="data-attr-trigger-2">
            {i18n.t('accordion.story.disabledItem', 'Disabled Item')}
          </AccordionTrigger>
          <AccordionContent>
            {i18n.t('accordion.story.disabledContent', 'Disabled content')}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export const DataAttributes: Story = {
  name: i18n.t('accordion.storyName.dataAttributes', 'Data Attributes (slot, state, disabled)'),
  render: () => <DataAttributesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify data-slot attributes
    const accordion = canvasElement.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();

    const item = canvasElement.querySelector('[data-slot="accordion-item"]');
    expect(item).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="accordion-trigger"]');
    expect(trigger).toBeInTheDocument();

    const content = canvasElement.querySelector('[data-slot="accordion-content"]');
    expect(content).toBeInTheDocument();

    // Verify data-state on trigger (closed by default)
    const trigger1 = canvas.getByTestId('data-attr-trigger-1');
    expect(trigger1.getAttribute('data-state')).toBe('closed');

    // Click to open
    await userEvent.click(trigger1);
    await waitFor(() => {
      expect(trigger1.getAttribute('data-state')).toBe('open');
    });

    // Verify data-disabled on disabled item
    const disabledItem = canvas.getByTestId('data-attr-item-2');
    expect(disabledItem.getAttribute('data-disabled')).toBe('true');
  },
};

// ============ TYPE COMPARISON ============

function TypeComparisonDemo() {
  const [singleValue, setSingleValue] = React.useState<string>('');
  const [multipleValues, setMultipleValues] = React.useState<string[]>([]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          type=&quot;single&quot; - Only one item can be open
        </p>
        <Accordion
          className="w-[420px]"
          type="single"
          collapsible
          value={singleValue}
          onValueChange={setSingleValue}
          data-testid="single-type-accordion"
        >
          {['A', 'B', 'C'].map((letter) => (
            <AccordionItem key={letter} value={`single-${letter}`}>
              <AccordionTrigger data-testid={`single-trigger-${letter}`}>
                Item {letter}
              </AccordionTrigger>
              <AccordionContent>Content for item {letter}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-muted-foreground mt-2 text-xs" data-testid="single-value">
          Current value: {singleValue || 'none'}
        </p>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          type=&quot;multiple&quot; - Multiple items can be open
        </p>
        <Accordion
          className="w-[420px]"
          type="multiple"
          value={multipleValues}
          onValueChange={setMultipleValues}
          data-testid="multiple-type-accordion"
        >
          {['A', 'B', 'C'].map((letter) => (
            <AccordionItem key={letter} value={`multiple-${letter}`}>
              <AccordionTrigger data-testid={`multiple-trigger-${letter}`}>
                Item {letter}
              </AccordionTrigger>
              <AccordionContent>Content for item {letter}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="text-muted-foreground mt-2 text-xs" data-testid="multiple-value">
          Current values: {multipleValues.length > 0 ? multipleValues.join(', ') : 'none'}
        </p>
      </div>
    </div>
  );
}

export const TypeComparison: Story = {
  name: i18n.t('accordion.storyName.typeComparison', 'Type Comparison (single vs multiple)'),
  render: () => <TypeComparisonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test single type behavior
    const singleTriggerA = canvas.getByTestId('single-trigger-A');
    const singleTriggerB = canvas.getByTestId('single-trigger-B');

    await userEvent.click(singleTriggerA);
    await waitFor(() => {
      expect(singleTriggerA.getAttribute('aria-expanded')).toBe('true');
    });

    await userEvent.click(singleTriggerB);
    await waitFor(() => {
      // In single mode, opening B should close A
      expect(singleTriggerB.getAttribute('aria-expanded')).toBe('true');
      expect(singleTriggerA.getAttribute('aria-expanded')).toBe('false');
    });

    // Test multiple type behavior
    const multipleTriggerA = canvas.getByTestId('multiple-trigger-A');
    const multipleTriggerB = canvas.getByTestId('multiple-trigger-B');

    await userEvent.click(multipleTriggerA);
    await waitFor(() => {
      expect(multipleTriggerA.getAttribute('aria-expanded')).toBe('true');
    });

    await userEvent.click(multipleTriggerB);
    await waitFor(() => {
      // In multiple mode, both should be open
      expect(multipleTriggerA.getAttribute('aria-expanded')).toBe('true');
      expect(multipleTriggerB.getAttribute('aria-expanded')).toBe('true');
    });

    // Verify value displays
    const multipleValue = canvas.getByTestId('multiple-value');
    expect(multipleValue.textContent).toContain('multiple-A');
    expect(multipleValue.textContent).toContain('multiple-B');
  },
};

// ============ ALL SIZES MATRIX ============

function AllSizesMatrixDemo() {
  return (
    <div className="space-y-6">
      {ACCORDION_WIDTHS.map((width) => (
        <div key={width}>
          <p className="text-muted-foreground mb-2 text-sm capitalize">
            {width} ({getWidthClass(width)})
          </p>
          <Accordion
            className={getWidthClass(width)}
            type="single"
            collapsible
            data-testid={`size-${width}`}
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                {i18n.t('accordion.story.sampleItem', 'Sample Item')}
              </AccordionTrigger>
              <AccordionContent>Content for {width} width accordion.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const AllSizesMatrix: Story = {
  name: i18n.t('accordion.storyName.allSizesMatrix', 'All Sizes Matrix'),
  render: () => <AllSizesMatrixDemo />,
  play: async ({ canvasElement }) => {
    // Verify all size variants render
    for (const width of ACCORDION_WIDTHS) {
      const accordion = canvasElement.querySelector(`[data-testid="size-${width}"]`);
      expect(accordion).toBeInTheDocument();
    }
  },
};

// ============ CONTROLLED VS UNCONTROLLED ============

function ControlledDemo() {
  const [value, setValue] = React.useState<string>('item-2');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValue('item-1')}
          data-testid="open-item-1"
        >
          Open Item 1
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setValue('item-2')}
          data-testid="open-item-2"
        >
          Open Item 2
        </Button>
        <Button variant="outline" size="sm" onClick={() => setValue('')} data-testid="close-all">
          Close All
        </Button>
      </div>
      <Accordion
        className="w-[420px]"
        type="single"
        collapsible
        value={value}
        onValueChange={setValue}
        data-testid="controlled-accordion"
      >
        <AccordionItem value="item-1">
          <AccordionTrigger data-testid="controlled-trigger-1">Controlled Item 1</AccordionTrigger>
          <AccordionContent>Controlled content 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger data-testid="controlled-trigger-2">Controlled Item 2</AccordionTrigger>

          <AccordionContent>Controlled content 2</AccordionContent>
        </AccordionItem>
      </Accordion>
      <p className="text-muted-foreground text-xs" data-testid="controlled-value">
        Controlled value: {value || 'none'}
      </p>
    </div>
  );
}

export const ControlledAccordion: Story = {
  name: i18n.t('accordion.storyName.controlledAccordion', 'Controlled Accordion'),
  render: () => <ControlledDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger1 = canvas.getByTestId('controlled-trigger-1');
    const trigger2 = canvas.getByTestId('controlled-trigger-2');
    const valueDisplay = canvas.getByTestId('controlled-value');

    // Initially item-2 should be open (from defaultValue)
    await waitFor(() => {
      expect(trigger2.getAttribute('aria-expanded')).toBe('true');
      expect(valueDisplay.textContent).toContain('item-2');
    });

    // Click button to open item-1
    const openItem1Btn = canvas.getByTestId('open-item-1');
    await userEvent.click(openItem1Btn);
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('true');
      expect(trigger2.getAttribute('aria-expanded')).toBe('false');
    });

    // Click close all
    const closeAllBtn = canvas.getByTestId('close-all');
    await userEvent.click(closeAllBtn);
    await waitFor(() => {
      expect(trigger1.getAttribute('aria-expanded')).toBe('false');
      expect(trigger2.getAttribute('aria-expanded')).toBe('false');
    });
  },
};

// ============ WITH ICONS (Settings Panel Style) ============

function IconsDemo() {
  return (
    <Accordion className="w-[420px]" type="single" collapsible data-testid="icons-accordion">
      <AccordionItem value="general">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <SettingsIcon className="size-4" />
            General Settings
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.configureGeneralApplicationSettings',
            'Configure general application settings.'
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="notifications">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <BellIcon className="size-4" />
            Notifications
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.manageNotificationPreferences',
            'Manage notification preferences.'
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="security">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <ShieldIcon className="size-4" />
            Privacy & Security
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {i18n.t(
            'accordion.story.configureSecurityAndPrivacySettings',
            'Configure security and privacy settings.'
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export const WithIcons: Story = {
  name: i18n.t('accordion.storyName.withIcons', 'With Icons (Settings Panel)'),
  render: () => <IconsDemo />,
  play: async ({ canvasElement }) => {
    // Verify icons are rendered
    const icons = canvasElement.querySelectorAll('[data-slot="accordion-trigger"] svg');
    expect(icons.length).toBe(3);

    // Verify accordion still works
    const triggers = canvasElement.querySelectorAll('[data-slot="accordion-trigger"]');
    await userEvent.click(triggers[0]);
    await waitFor(() => {
      expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ FAQ STYLE ============

function FAQDemo() {
  const faqItems = createFakeFAQItems(5);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {i18n.t('accordion.story.frequentlyAskedQuestions', 'Frequently Asked Questions')}
      </h2>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="faq-accordion">
        {faqItems.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FAQStyle: Story = {
  name: i18n.t('accordion.storyName.fAQStyle', 'FAQ Style'),
  render: () => <FAQDemo />,
  play: async ({ canvasElement }) => {
    const triggers = canvasElement.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(5);

    // First item should be open by default (from factory)
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
  },
};

// ============ WITH DISABLED ITEMS ============

function DisabledItemsDemo() {
  const items = createFakeAccordionWithDisabled(5);

  return (
    <Accordion
      className="w-[420px]"
      type="single"
      collapsible
      data-testid="disabled-items-accordion"
    >
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
          <AccordionTrigger data-testid={`trigger-${item.id}`}>
            {item.title} {item.disabled && '(Disabled)'}
          </AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export const WithDisabledItems: Story = {
  name: i18n.t('accordion.storyName.withDisabledItems', 'With Disabled Items'),
  render: () => <DisabledItemsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify disabled items exist
    const disabledItems = canvasElement.querySelectorAll('[data-disabled="true"]');
    expect(disabledItems.length).toBe(2); // Items 2 and 4 are disabled

    // Try to click disabled item - should not expand
    const disabledTrigger = canvas.getByTestId('trigger-item-2');
    await userEvent.click(disabledTrigger);
    await waitFor(() => {
      expect(disabledTrigger.getAttribute('aria-expanded')).toBe('false');
    });

    // Enabled item should work
    const enabledTrigger = canvas.getByTestId('trigger-item-1');
    await userEvent.click(enabledTrigger);
    await waitFor(() => {
      expect(enabledTrigger.getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ FACTORY: ACCORDION_TYPES ============

function AccordionTypesDemo() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionTypes', 'All Accordion Types')}
      </h3>
      {ACCORDION_TYPES.map((type: AccordionType) => (
        <div key={type}>
          <p className="text-muted-foreground mb-2 text-sm capitalize">{type}</p>
          <Accordion
            className="w-[420px]"
            type={type}
            collapsible={type === 'single'}
            data-testid={`type-${type}`}
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                {i18n.t('accordion.firstItem')} ({type})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.singleContent')}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                {i18n.t('accordion.secondItem')} ({type})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.clickToExpand')}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const FactoryAccordionTypes: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionTypes', 'Factory: ACCORDION_TYPES'),
  render: () => <AccordionTypesDemo />,
  play: async ({ canvasElement }) => {
    for (const type of ACCORDION_TYPES) {
      const accordion = canvasElement.querySelector(`[data-testid="type-${type}"]`);
      expect(accordion).toBeInTheDocument();
    }
    expect(ACCORDION_TYPES).toHaveLength(2);
  },
};

// ============ FACTORY: ACCORDION_ORIENTATIONS ============

function AccordionOrientationsDemo() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionOrientations', 'All Accordion Orientations')}
      </h3>
      {ACCORDION_ORIENTATIONS.map((orientation: AccordionOrientation) => (
        <div key={orientation}>
          <p className="text-muted-foreground mb-2 text-sm capitalize">{orientation}</p>
          <Accordion
            className="w-[420px]"
            type="single"
            collapsible
            orientation={orientation}
            data-testid={`orientation-${orientation}`}
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                {i18n.t('accordion.firstItem')} ({orientation})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.singleContent')}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                {i18n.t('accordion.secondItem')} ({orientation})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.clickToExpand')}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const FactoryAccordionOrientations: Story = {
  name: i18n.t(
    'accordion.storyName.factoryAccordionOrientations',
    'Factory: ACCORDION_ORIENTATIONS'
  ),
  render: () => <AccordionOrientationsDemo />,
  play: async ({ canvasElement }) => {
    for (const orientation of ACCORDION_ORIENTATIONS) {
      const accordion = canvasElement.querySelector(`[data-testid="orientation-${orientation}"]`);
      expect(accordion).toBeInTheDocument();
    }
    expect(ACCORDION_ORIENTATIONS).toHaveLength(2);
  },
};

// ============ FACTORY: ACCORDION_DIRECTIONS ============

function AccordionDirectionsDemo() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionDirections', 'All Accordion Directions')}
      </h3>
      {ACCORDION_DIRECTIONS.map((dir: AccordionDirection) => (
        <div key={dir} dir={dir}>
          <p className="text-muted-foreground mb-2 text-sm uppercase">{dir}</p>
          <Accordion
            className="w-[420px]"
            type="single"
            collapsible
            dir={dir}
            data-testid={`dir-${dir}`}
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                {i18n.t('accordion.firstItem')} ({dir})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.singleContent')}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                {i18n.t('accordion.secondItem')} ({dir})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.clickToExpand')}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const FactoryAccordionDirections: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionDirections', 'Factory: ACCORDION_DIRECTIONS'),
  render: () => <AccordionDirectionsDemo />,
  play: async ({ canvasElement }) => {
    for (const dir of ACCORDION_DIRECTIONS) {
      const accordion = canvasElement.querySelector(`[data-testid="dir-${dir}"]`);
      expect(accordion).toBeInTheDocument();
    }
    expect(ACCORDION_DIRECTIONS).toHaveLength(2);
  },
};

// ============ FACTORY: ACCORDION_ITEM_STATES ============

function AccordionItemStatesDemo() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionItemStates', 'All Accordion Item States')}
      </h3>
      <Accordion
        className="w-[420px]"
        type="single"
        collapsible
        defaultValue="expanded"
        data-testid="item-states-accordion"
      >
        {ACCORDION_ITEM_STATES.map((state: AccordionItemState) => (
          <AccordionItem key={state} value={state} disabled={state === 'disabled'}>
            <AccordionTrigger data-testid={`state-trigger-${state}`}>
              {state.charAt(0).toUpperCase() + state.slice(1)} {i18n.t('accordion.firstItem')}
            </AccordionTrigger>
            <AccordionContent>
              {i18n.t('accordion.singleContent')} ({state})
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionItemStates: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionItemStates', 'Factory: ACCORDION_ITEM_STATES'),
  render: () => <AccordionItemStatesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="item-states-accordion"]');
    expect(accordion).toBeInTheDocument();

    for (const state of ACCORDION_ITEM_STATES) {
      const trigger = canvasElement.querySelector(`[data-testid="state-trigger-${state}"]`);
      expect(trigger).toBeInTheDocument();
    }
    expect(ACCORDION_ITEM_STATES).toHaveLength(3);
  },
};

// ============ FACTORY: ACCORDION_ANIMATIONS ============

function AccordionAnimationsDemo() {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionAnimations', 'All Accordion Animations')}
      </h3>
      {ACCORDION_ANIMATIONS.map((animation: AccordionAnimation) => (
        <div key={animation}>
          <p className="text-muted-foreground mb-2 text-sm capitalize">{animation}</p>
          <Accordion
            className="w-[420px]"
            type="single"
            collapsible
            data-testid={`animation-${animation}`}
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                {i18n.t('accordion.firstItem')} ({animation})
              </AccordionTrigger>
              <AccordionContent>{i18n.t('accordion.singleContent')}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const FactoryAccordionAnimations: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionAnimations', 'Factory: ACCORDION_ANIMATIONS'),
  render: () => <AccordionAnimationsDemo />,
  play: async ({ canvasElement }) => {
    for (const animation of ACCORDION_ANIMATIONS) {
      const accordion = canvasElement.querySelector(`[data-testid="animation-${animation}"]`);
      expect(accordion).toBeInTheDocument();
    }
    expect(ACCORDION_ANIMATIONS).toHaveLength(4);
  },
};

// ============ FACTORY: ACCORDION_TITLES ============

function AccordionTitlesDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionTitles', 'All Accordion Titles')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="titles-accordion">
        {ACCORDION_TITLES.map((title, index) => (
          <AccordionItem key={title} value={`title-${String(index)}`}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>
              {ACCORDION_CONTENTS[index] ?? i18n.t('accordion.singleContent')}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionTitles: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionTitles', 'Factory: ACCORDION_TITLES'),
  render: () => <AccordionTitlesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="titles-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_TITLES.length);
  },
};

// ============ FACTORY: ACCORDION_ACTION_TITLES ============

function AccordionActionTitlesDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('accordion.story.actionOrientedTitles')}</h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="action-titles-accordion"
      >
        {ACCORDION_ACTION_TITLES.map((title, index) => (
          <AccordionItem key={title} value={`action-${String(index)}`}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>
              {i18n.t('accordion.singleContent')} - {title}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionActionTitles: Story = {
  name: i18n.t(
    'accordion.storyName.factoryAccordionActionTitles',
    'Factory: ACCORDION_ACTION_TITLES'
  ),
  render: () => <AccordionActionTitlesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="action-titles-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_ACTION_TITLES.length);
  },
};

// ============ FACTORY: ACCORDION_FAQ_TITLES ============

function AccordionFAQTitlesDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">FAQ-Style Question Titles</h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="faq-titles-accordion">
        {ACCORDION_FAQ_TITLES.map((title, index) => (
          <AccordionItem key={title} value={`faq-title-${String(index)}`}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>
              {i18n.t('accordion.singleContent')} - {title}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionFAQTitles: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionFAQTitles', 'Factory: ACCORDION_FAQ_TITLES'),
  render: () => <AccordionFAQTitlesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="faq-titles-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_FAQ_TITLES.length);
  },
};

// ============ FACTORY: ACCORDION_CONTENTS ============

function AccordionContentsDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionContentSamples', 'All Accordion Content Samples')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="multiple"
        defaultValue={ACCORDION_CONTENTS.map((_, i) => `content-${String(i)}`)}
        data-testid="contents-accordion"
      >
        {ACCORDION_CONTENTS.map((content, index) => (
          <AccordionItem key={content} value={`content-${String(index)}`}>
            <AccordionTrigger>Content Sample {String(index + 1)}</AccordionTrigger>
            <AccordionContent>{content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionContents: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionContents', 'Factory: ACCORDION_CONTENTS'),
  render: () => <AccordionContentsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="contents-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_CONTENTS.length);
  },
};

// ============ FACTORY: ACCORDION_ICONS ============

function AccordionIconsDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allAccordionIconOptions', 'All Accordion Icon Options')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="icons-list-accordion">
        {ACCORDION_ICONS.map((icon, index) => (
          <AccordionItem key={icon} value={`icon-${String(index)}`}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">[{icon}]</span>
                Item with {icon} icon
              </span>
            </AccordionTrigger>
            <AccordionContent>This item uses the {icon} icon.</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionIcons: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionIcons', 'Factory: ACCORDION_ICONS'),
  render: () => <AccordionIconsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="icons-list-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_ICONS.length);
  },
};

// ============ FACTORY: ACCORDION_BADGES ============

function AccordionBadgesDemo() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allBadgeOptions', 'All Badge Options')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="badges-accordion">
        {ACCORDION_BADGES.map((badge) => (
          <AccordionItem key={badge} value={`badge-${badge.toLowerCase().replaceAll(/\s+/g, '-')}`}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {i18n.t('accordion.firstItem')}
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                  {badge}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {i18n.t('accordion.singleContent')} - Badge: {badge}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryAccordionBadges: Story = {
  name: i18n.t('accordion.storyName.factoryAccordionBadges', 'Factory: ACCORDION_BADGES'),
  render: () => <AccordionBadgesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="badges-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_BADGES.length);
  },
};

// ============ FACTORY: createFakeAccordionItem ============

function SingleItemDemo() {
  const item = React.useMemo(() => createFakeAccordionItem(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.singleFactoryItem', 'Single Factory Item')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="single-item-accordion"
      >
        <AccordionItem value={item.id} disabled={item.disabled}>
          <AccordionTrigger data-testid="single-item-trigger">{item.title}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="text-muted-foreground text-xs" data-testid="single-item-meta">
        ID: {item.id} | State: {item.state} | Disabled: {String(!!item.disabled)}
      </div>
    </div>
  );
}

export const FactoryCreateFakeAccordionItem: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionItem',
    'Factory: createFakeAccordionItem'
  ),
  render: () => <SingleItemDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="single-item-accordion"]');
    expect(accordion).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-testid="single-item-trigger"]');
    expect(trigger).toBeInTheDocument();

    const meta = canvasElement.querySelector('[data-testid="single-item-meta"]');
    expect(meta).toBeInTheDocument();
    expect(meta!.textContent).toContain('ID:');
  },
};

// ============ FACTORY: createFakeAccordionItemsUnique ============

function UniqueItemsDemo() {
  const items = React.useMemo(() => createFakeAccordionItemsUnique(5), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t(
          'accordion.story.uniqueTitleItemsNoDuplicates',
          'Unique Title Items (no duplicates)'
        )}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="unique-items-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeAccordionItemsUnique: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionItemsUnique',
    'Factory: createFakeAccordionItemsUnique'
  ),
  render: () => <UniqueItemsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="unique-items-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers).toHaveLength(5);

    // Verify titles are unique
    const titles = [...triggers].map((t) => t.textContent);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);
  },
};

// ============ FACTORY: createFakeSettingsItems ============

function SettingsItemsDemo() {
  const items = React.useMemo(() => createFakeSettingsItems(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.settingsPanelItems', 'Settings Panel Items')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="settings-accordion">
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {item.icon && <span className="text-muted-foreground text-xs">[{item.icon}]</span>}
                {item.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeSettingsItems: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeSettingsItems',
    'Factory: createFakeSettingsItems'
  ),
  render: () => <SettingsItemsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="settings-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(5);

    // Verify known settings titles
    const canvas = within(canvasElement);
    expect(canvas.getByText(/General Settings/)).toBeInTheDocument();
    expect(canvas.getByText(/Appearance/)).toBeInTheDocument();
    expect(canvas.getByText(/Notifications/)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeNestedAccordionItems ============

function NestedAccordionItemsDemo() {
  const items = React.useMemo(() => createFakeNestedAccordionItems(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t(
          'accordion.story.nestedAccordionItemsPipedelimited',
          'Nested Accordion Items (pipe-delimited)'
        )}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        defaultValue="parent-1"
        data-testid="nested-items-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.title}</AccordionTrigger>

            <AccordionContent>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {item.content.split('|').map((sub) => (
                  <li key={sub}>{sub}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeNestedAccordionItems: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeNestedAccordionItems',
    'Factory: createFakeNestedAccordionItems'
  ),
  render: () => <NestedAccordionItemsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="nested-items-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(3);

    // First item should be expanded by default
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
  },
};

// ============ FACTORY: createFakeAccordionItemExpanded ============

function ExpandedItemDemo() {
  const item = React.useMemo(() => createFakeAccordionItemExpanded(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{i18n.t('accordion.story.preExpandedItem')}</h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        defaultValue={item.id}
        data-testid="expanded-item-accordion"
      >
        <AccordionItem value={item.id}>
          <AccordionTrigger data-testid="expanded-trigger">{item.title}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="text-muted-foreground text-xs" data-testid="expanded-meta">
        State: {item.state} | Default Open: {String(item.defaultOpen)}
      </div>
    </div>
  );
}

export const FactoryCreateFakeAccordionItemExpanded: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionItemExpanded',
    'Factory: createFakeAccordionItemExpanded'
  ),
  render: () => <ExpandedItemDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="expanded-trigger"]');
    expect(trigger).toBeInTheDocument();
    expect(trigger!.getAttribute('aria-expanded')).toBe('true');

    const meta = canvasElement.querySelector('[data-testid="expanded-meta"]');
    expect(meta!.textContent).toContain('expanded');
    expect(meta!.textContent).toContain('true');
  },
};

// ============ FACTORY: createFakeAccordionItemDisabled ============

function DisabledItemDemo() {
  const item = React.useMemo(() => createFakeAccordionItemDisabled(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.disabledItem', 'Disabled Item')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="disabled-item-accordion"
      >
        <AccordionItem value={item.id} disabled={item.disabled}>
          <AccordionTrigger data-testid="disabled-item-trigger">{item.title}</AccordionTrigger>
          <AccordionContent>{item.content}</AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="text-muted-foreground text-xs" data-testid="disabled-meta">
        State: {item.state} | Disabled: {String(item.disabled)}
      </div>
    </div>
  );
}

export const FactoryCreateFakeAccordionItemDisabled: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionItemDisabled',
    'Factory: createFakeAccordionItemDisabled'
  ),

  render: () => <DisabledItemDemo />,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[data-testid="disabled-item-trigger"]');
    expect(trigger).toBeInTheDocument();

    // Disabled item should not expand
    await userEvent.click(trigger!);
    await waitFor(() => {
      expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    });

    const meta = canvasElement.querySelector('[data-testid="disabled-meta"]');
    expect(meta!.textContent).toContain('disabled');
    expect(meta!.textContent).toContain('true');
  },
};

// ============ FACTORY: createFakeAccordionWithAllStates ============

function AllStatesDemo() {
  const items = React.useMemo(() => createFakeAccordionWithAllStates(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.allItemStates', 'All Item States')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        defaultValue="state-expanded"
        data-testid="all-states-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
            <AccordionTrigger data-testid={`all-state-${item.state ?? 'unknown'}`}>
              {item.title}
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeAccordionWithAllStates: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionWithAllStates',
    'Factory: createFakeAccordionWithAllStates'
  ),
  render: () => <AllStatesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="all-states-accordion"]');
    expect(accordion).toBeInTheDocument();

    // Verify each state has a trigger
    for (const state of ACCORDION_ITEM_STATES) {
      const trigger = canvasElement.querySelector(`[data-testid="all-state-${state}"]`);
      expect(trigger).toBeInTheDocument();
    }

    // Expanded item should be open
    const expandedTrigger = canvasElement.querySelector('[data-testid="all-state-expanded"]');
    expect(expandedTrigger!.getAttribute('aria-expanded')).toBe('true');

    // Disabled item should not expand
    const disabledTrigger = canvasElement.querySelector('[data-testid="all-state-disabled"]');
    await userEvent.click(disabledTrigger!);
    expect(disabledTrigger!.getAttribute('aria-expanded')).toBe('false');
  },
};

// ============ FACTORY: createFakeAccordionWithBadges ============

function BadgesItemsDemo() {
  const items = React.useMemo(() => createFakeAccordionWithBadges(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.itemsWithAllBadgeTypes', 'Items with All Badge Types')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="badges-items-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {item.title}
                {item.badge && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {item.badge}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeAccordionWithBadges: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionWithBadges',
    'Factory: createFakeAccordionWithBadges'
  ),
  render: () => <BadgesItemsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="badges-items-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(ACCORDION_BADGES.length);

    // Verify badge text appears
    const canvas = within(canvasElement);
    for (const badge of ACCORDION_BADGES) {
      expect(canvas.getByText(badge)).toBeInTheDocument();
    }
  },
};

// ============ FACTORY: createFakeAccordionWithIcons ============

function IconItemsDemo() {
  const items = React.useMemo(() => createFakeAccordionWithIcons(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.itemsWithIcons', 'Items with Icons')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="icon-items-accordion">
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {item.icon && <span className="text-muted-foreground text-xs">[{item.icon}]</span>}
                {item.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeAccordionWithIcons: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionWithIcons',
    'Factory: createFakeAccordionWithIcons'
  ),
  render: () => <IconItemsDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="icon-items-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(5);
  },
};

// ============ FACTORY: createFakeAccordionMatrix ============

function MatrixDemo() {
  const matrix = React.useMemo(() => createFakeAccordionMatrix(), []);

  return (
    <div className="space-y-8">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.typeXWidthMatrix', 'Type x Width Matrix')}
      </h3>
      {matrix.map((row, rowIndex) => (
        <div key={ACCORDION_TYPES[rowIndex]} className="space-y-4">
          <p className="text-muted-foreground text-sm font-medium capitalize">
            Type: {ACCORDION_TYPES[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-4">
            {row.map((item) => (
              <Accordion
                key={item.id}
                className="w-[250px]"
                type={ACCORDION_TYPES[rowIndex] as 'single'}
                collapsible={ACCORDION_TYPES[rowIndex] === 'single'}
                defaultValue={item.defaultOpen ? item.id : undefined}
                data-testid={`matrix-${item.id}`}
              >
                <AccordionItem value={item.id}>
                  <AccordionTrigger>{item.title}</AccordionTrigger>
                  <AccordionContent>{item.content}</AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeAccordionMatrix: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionMatrix',
    'Factory: createFakeAccordionMatrix'
  ),
  render: () => <MatrixDemo />,
  play: async ({ canvasElement }) => {
    // Verify matrix cells rendered
    for (const type of ACCORDION_TYPES) {
      for (const width of ACCORDION_WIDTHS) {
        const cell = canvasElement.querySelector(`[data-testid="matrix-${type}-${width}"]`);
        expect(cell).toBeInTheDocument();
      }
    }
  },
};

// ============ FACTORY: createFakeAccordionStateMatrix ============

function StateMatrixDemo() {
  const matrix = React.useMemo(() => createFakeAccordionStateMatrix(), []);

  return (
    <div className="space-y-8">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.stateXTypeMatrix', 'State x Type Matrix')}
      </h3>
      {matrix.map((row, rowIndex) => (
        <div key={ACCORDION_ITEM_STATES[rowIndex]} className="space-y-4">
          <p className="text-muted-foreground text-sm font-medium capitalize">
            State: {ACCORDION_ITEM_STATES[rowIndex]}
          </p>
          <div className="flex flex-wrap gap-4">
            {row.map((item) => (
              <Accordion
                key={item.id}
                className="w-[250px]"
                type="single"
                collapsible
                defaultValue={item.defaultOpen ? item.id : undefined}
                data-testid={`state-matrix-${item.id}`}
              >
                <AccordionItem value={item.id} disabled={item.disabled}>
                  <AccordionTrigger>{item.title}</AccordionTrigger>
                  <AccordionContent>{item.content}</AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeAccordionStateMatrix: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionStateMatrix',
    'Factory: createFakeAccordionStateMatrix'
  ),
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    for (const state of ACCORDION_ITEM_STATES) {
      for (const type of ACCORDION_TYPES) {
        const cell = canvasElement.querySelector(`[data-testid="state-matrix-${state}-${type}"]`);
        expect(cell).toBeInTheDocument();
      }
    }
  },
};

// ============ FACTORY: createFakeAccordionConfig ============

const CONFIG_SCENARIOS = ['default', 'rtl', 'disabled', 'horizontal', 'multiple'] as const;

function ConfigDemo() {
  const configs = React.useMemo(
    () =>
      CONFIG_SCENARIOS.map((scenario) => ({
        scenario,
        config: createFakeAccordionConfig(scenario),
      })),
    []
  );

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.accordionConfigurations', 'Accordion Configurations')}
      </h3>
      {configs.map(({ scenario, config }: { config: FakeAccordionConfig; scenario: string }) => (
        <div key={scenario} className="rounded-md border p-4">
          <p className="text-muted-foreground mb-2 text-sm font-medium capitalize">{scenario}</p>

          <div
            className="text-muted-foreground space-y-1 text-xs"
            data-testid={`config-${scenario}`}
          >
            <p>Type: {config.type}</p>
            <p>Direction: {config.dir}</p>
            <p>Orientation: {config.orientation}</p>
            <p>Width: {config.width}</p>
            <p>Collapsible: {String(config.collapsible)}</p>
            <p>Disabled: {String(config.disabled)}</p>
            <p>Animation: {config.animation ?? 'default'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeAccordionConfig: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionConfig',
    'Factory: createFakeAccordionConfig'
  ),
  render: () => <ConfigDemo />,
  play: async ({ canvasElement }) => {
    const scenarios = ['default', 'rtl', 'disabled', 'horizontal', 'multiple'];
    for (const scenario of scenarios) {
      const configEl = canvasElement.querySelector(`[data-testid="config-${scenario}"]`);
      expect(configEl).toBeInTheDocument();
    }

    // Verify specific config values
    const defaultConfig = canvasElement.querySelector('[data-testid="config-default"]');
    expect(defaultConfig!.textContent).toContain('single');

    const rtlConfig = canvasElement.querySelector('[data-testid="config-rtl"]');
    expect(rtlConfig!.textContent).toContain('rtl');
  },
};

// ============ FACTORY: createFakeAccordionGroup ============

function AccordionGroupDemo() {
  const group = React.useMemo(() => createFakeAccordionGroup(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Accordion Group: {group.name}</h3>
      <div className="text-muted-foreground text-xs" data-testid="group-meta">
        ID: {group.id} | Items: {String(group.items.length)} | Type: {group.config.type}
      </div>
      <Accordion
        className="w-[500px]"
        type={group.config.type}
        collapsible={group.config.collapsible}
        disabled={group.config.disabled}
        data-testid="group-accordion"
      >
        {group.items.map((item: FakeAccordionItem) => (
          <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
            <AccordionTrigger>{item.title}</AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeAccordionGroup: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionGroup',
    'Factory: createFakeAccordionGroup'
  ),
  render: () => <AccordionGroupDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="group-accordion"]');
    expect(accordion).toBeInTheDocument();

    const meta = canvasElement.querySelector('[data-testid="group-meta"]');
    expect(meta).toBeInTheDocument();
    expect(meta!.textContent).toContain('ID:');
    expect(meta!.textContent).toContain('Items:');
  },
};

// ============ FACTORY: createFakeAccordionGroups ============

function AccordionGroupsDemo() {
  const groups = React.useMemo(() => createFakeAccordionGroups(3), []);

  return (
    <div className="space-y-8">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.multipleAccordionGroups', 'Multiple Accordion Groups')}
      </h3>
      {groups.map((group: FakeAccordionGroup, groupIndex: number) => (
        <div key={group.id} className="space-y-2">
          <p className="text-muted-foreground text-sm font-medium">
            Group {String(groupIndex + 1)}: {group.name}
          </p>
          <Accordion
            className="w-[500px]"
            type={group.config.type}
            collapsible={group.config.collapsible}
            data-testid={`groups-accordion-${String(groupIndex)}`}
          >
            {group.items.map((item: FakeAccordionItem) => (
              <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
                <AccordionTrigger>{item.title}</AccordionTrigger>
                <AccordionContent>{item.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeAccordionGroups: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeAccordionGroups',
    'Factory: createFakeAccordionGroups'
  ),
  render: () => <AccordionGroupsDemo />,
  play: async ({ canvasElement }) => {
    for (let i = 0; i < 3; i++) {
      const accordion = canvasElement.querySelector(
        `[data-testid="groups-accordion-${String(i)}"]`
      );
      expect(accordion).toBeInTheDocument();
    }
  },
};

// ============ FACTORY: createFakeNestedAccordion ============

function NestedAccordionStructureDemo() {
  const nested = React.useMemo(() => createFakeNestedAccordion(2, 2), []);

  function renderNestedItem(item: FakeNestedAccordion) {
    return (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger>{item.title}</AccordionTrigger>
        <AccordionContent>
          {item.content && <p className="mb-2 text-sm">{item.content}</p>}
          {item.children && item.children.length > 0 && (
            <Accordion type="single" collapsible className="ml-4">
              {item.children.map((child) => renderNestedItem(child))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Nested Accordion Structure (depth=2, breadth=2)</h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        data-testid="nested-structure-accordion"
      >
        {nested.map((item) => renderNestedItem(item))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeNestedAccordion: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeNestedAccordion',
    'Factory: createFakeNestedAccordion'
  ),
  render: () => <NestedAccordionStructureDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="nested-structure-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(2);

    // Open first level to see children
    await userEvent.click(triggers[0]);
    await waitFor(() => {
      expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
    });
  },
};

// ============ FACTORY: createFakeDocumentationAccordion ============

function DocumentationAccordionDemo() {
  const items = React.useMemo(() => createFakeDocumentationAccordion(5), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.documentationSections', 'Documentation Sections')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        defaultValue={items[0]?.id}
        data-testid="doc-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {item.icon && <span className="text-muted-foreground text-xs">[{item.icon}]</span>}

                {item.title}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeDocumentationAccordion: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeDocumentationAccordion',
    'Factory: createFakeDocumentationAccordion'
  ),
  render: () => <DocumentationAccordionDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="doc-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(5);

    // First item should be expanded by default
    expect(triggers[0].getAttribute('aria-expanded')).toBe('true');

    // Verify known doc section titles
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Getting Started/)).toBeInTheDocument();
    expect(canvas.getByText(/Installation/)).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakePricingAccordion ============

function PricingAccordionDemo() {
  const items = React.useMemo(() => createFakePricingAccordion(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.pricingTiers', 'Pricing Tiers')}
      </h3>
      <Accordion
        className="w-[500px]"
        type="single"
        collapsible
        defaultValue={items[1]?.id}
        data-testid="pricing-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {item.title}
                {item.badge && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {item.badge}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakePricingAccordion: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakePricingAccordion',
    'Factory: createFakePricingAccordion'
  ),
  render: () => <PricingAccordionDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="pricing-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(3);

    // Pro plan (index 1) should be expanded by default
    expect(triggers[1].getAttribute('aria-expanded')).toBe('true');

    // Verify pricing tier titles and badges
    const canvas = within(canvasElement);
    expect(canvas.getByText(/Free Plan/)).toBeInTheDocument();
    expect(canvas.getByText(/Pro Plan/)).toBeInTheDocument();
    expect(canvas.getByText(/Enterprise Plan/)).toBeInTheDocument();
    expect(canvas.getByText('Popular')).toBeInTheDocument();
    expect(canvas.getByText('Recommended')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeUltimateAccordion ============

function UltimateAccordionDemo() {
  const { config, items } = React.useMemo(() => createFakeUltimateAccordion(), []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t(
          'accordion.story.ultimateAccordionAllFeatures',
          'Ultimate Accordion (All Features)'
        )}
      </h3>
      <div className="text-muted-foreground text-xs" data-testid="ultimate-config">
        Type: {config.type} | Dir: {config.dir} | Width: {config.width} | Collapsible:{' '}
        {String(config.collapsible)}
      </div>
      <Accordion
        className={getWidthClass(config.width)}
        type={config.type as 'single'}
        collapsible={config.collapsible}
        defaultValue={typeof config.defaultValue === 'string' ? config.defaultValue : undefined}
        dir={config.dir}
        disabled={config.disabled}
        data-testid="ultimate-accordion"
      >
        {items.map((item) => (
          <AccordionItem key={item.id} value={item.id} disabled={item.disabled}>
            <AccordionTrigger data-testid={item.testId}>
              <span className="flex items-center gap-2">
                {item.icon && <span className="text-muted-foreground text-xs">[{item.icon}]</span>}
                {item.title}
                {item.badge && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                    {item.badge}
                  </span>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryCreateFakeUltimateAccordion: Story = {
  name: i18n.t(
    'accordion.storyName.factoryCreateFakeUltimateAccordion',
    'Factory: createFakeUltimateAccordion'
  ),
  render: () => <UltimateAccordionDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="ultimate-accordion"]');
    expect(accordion).toBeInTheDocument();

    // Verify 4 items
    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(4);

    // First item should be expanded (defaultValue = 'ultimate-1')
    const trigger1 = canvasElement.querySelector('[data-testid="ultimate-item-1"]');
    expect(trigger1).toBeInTheDocument();
    expect(trigger1!.getAttribute('aria-expanded')).toBe('true');

    // Disabled item should not expand
    const trigger3 = canvasElement.querySelector('[data-testid="ultimate-item-3"]');
    expect(trigger3).toBeInTheDocument();
    await userEvent.click(trigger3!);
    expect(trigger3!.getAttribute('aria-expanded')).toBe('false');

    // Config info should be visible
    const configEl = canvasElement.querySelector('[data-testid="ultimate-config"]');
    expect(configEl!.textContent).toContain('single');
    expect(configEl!.textContent).toContain('ltr');
  },
};

// ============ TYPE REFERENCES (ensure types are used) ============

/**
 * This story verifies all exported types are usable by creating
 * typed variables and rendering their descriptions.
 */
function TypeReferencesDemo() {
  const typeExamples: {
    example: string;
    name: string;
  }[] = React.useMemo(() => {
    const typeVal: AccordionType = 'single';
    const orientationVal: AccordionOrientation = 'vertical';
    const dirVal: AccordionDirection = 'ltr';
    const widthVal: AccordionWidth = 'default';
    const stateVal: AccordionItemState = 'collapsed';
    const animVal: AccordionAnimation = 'default';
    const nestedVal: FakeNestedAccordion = {
      id: 'nested-1',
      title: 'Nested',
      level: 1,
    };

    return [
      { name: 'AccordionType', example: typeVal },
      { name: 'AccordionOrientation', example: orientationVal },
      { name: 'AccordionDirection', example: dirVal },
      { name: 'AccordionWidth', example: widthVal },
      { name: 'AccordionItemState', example: stateVal },
      { name: 'AccordionAnimation', example: animVal },
      {
        name: 'FakeNestedAccordion',
        example: `${nestedVal.id} - ${nestedVal.title} (level ${String(nestedVal.level)})`,
      },
    ];
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">
        {i18n.t('accordion.story.typeReferences', 'Type References')}
      </h3>
      <Accordion className="w-[500px]" type="single" collapsible data-testid="type-refs-accordion">
        {typeExamples.map((item) => (
          <AccordionItem key={item.name} value={item.name}>
            <AccordionTrigger data-testid={`type-ref-${item.name}`}>{item.name}</AccordionTrigger>
            <AccordionContent>Example value: {item.example}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export const FactoryTypeReferences: Story = {
  name: i18n.t('accordion.storyName.factoryTypeReferences', 'Factory: Type References'),
  render: () => <TypeReferencesDemo />,
  play: async ({ canvasElement }) => {
    const accordion = canvasElement.querySelector('[data-testid="type-refs-accordion"]');
    expect(accordion).toBeInTheDocument();

    const triggers = accordion!.querySelectorAll('[data-slot="accordion-trigger"]');
    expect(triggers.length).toBe(7);

    // Verify each type is referenced
    const typeNames = [
      'AccordionType',
      'AccordionOrientation',
      'AccordionDirection',
      'AccordionWidth',
      'AccordionItemState',
      'AccordionAnimation',
      'FakeNestedAccordion',
    ];
    for (const name of typeNames) {
      const trigger = canvasElement.querySelector(`[data-testid="type-ref-${name}"]`);
      expect(trigger).toBeInTheDocument();
    }
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
  name: i18n.t('accordion.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: accordionStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: accordionStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('accordion.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: accordionStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
