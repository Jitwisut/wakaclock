import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { useTranslation } from 'react-i18next';

import {
  tooltipHandlers,
  tooltipStatusHandlers,
} from '@/.storybook/stories/_handlers/tooltip.handlers';
import { createFakeTooltip } from '@/.storybook/stories/_factories/tooltip.factory';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

function TooltipDemo() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button data-tooltip-trigger variant="outline">
          Hover me
        </Button>
      </TooltipTrigger>
      <TooltipContent data-tooltip-content sideOffset={6}>
        Tooltip content
      </TooltipContent>
    </Tooltip>
  );
}

function I18nTooltipDemo() {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button data-tooltip-trigger variant="outline">
          {t('tooltip.trigger')}
        </Button>
      </TooltipTrigger>
      <TooltipContent data-tooltip-content sideOffset={6}>
        {t('tooltip.content')}
      </TooltipContent>
    </Tooltip>
  );
}

const meta = {
  title: 'Components/UI/Tooltip',
  component: TooltipDemo,
  tags: ['autodocs'],
  args: {
    onOpenChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('tooltip.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('tooltip.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('tooltip.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('tooltip.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('tooltip.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('tooltip.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('tooltip.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onOpenChange: {
      action: 'onOpenChange',
      description: i18n.t(
        'tooltip.argType.calledWhenTooltipOpenStateChanges',
        'Called when tooltip open state changes'
      ),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual Tooltip component props documented below
    // Tooltip Props Reference (Radix Tooltip.Root):
    // - open: Controlled open state (boolean)
    // - defaultOpen: Default open state for uncontrolled usage (boolean)
    // - onOpenChange: Called when open state changes ((open: boolean) => void)
    // - delayDuration: Delay before opening in ms (number, default: 700)
    // - skipDelayDuration: Skip delay when hovering quickly (number, default: 300)
    // - disableHoverableContent: Disable hoverable content area (boolean, default: false)
    //
    // TooltipTrigger Props Reference:
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    //
    // TooltipContent Props Reference:
    // - side: Preferred side ('top' | 'right' | 'bottom' | 'left', default: 'top')
    // - sideOffset: Distance from trigger in pixels (number, default: 4)
    // - align: Alignment ('start' | 'center' | 'end', default: 'center')
    // - alignOffset: Alignment offset in pixels (number)
    // - avoidCollisions: Whether to avoid collisions (boolean, default: true)
    // - collisionBoundary: Boundary element(s) (Element | Element[] | null)
    // - collisionPadding: Padding for collision detection (number | Partial<Record<Side, number>>)
    // - sticky: Sticky behavior ('partial' | 'always', default: 'partial')
    // - hideWhenDetached: Hide when trigger is detached (boolean, default: false)
    // - forceMount: Force mount when closed (boolean)
    // - arrowPadding: Arrow padding from edges (number, default: 0)
    // - className: Additional CSS classes (string)
    //
    // TooltipArrow Props Reference:
    // - width: Arrow width in pixels (number, default: 10)
    // - height: Arrow height in pixels (number, default: 5)
    // - className: Additional CSS classes (string)
    //
    // TooltipProvider Props Reference:
    // - delayDuration: Default delay for all tooltips (number, default: 700)
    // - skipDelayDuration: Default skip delay (number, default: 300)
    // - disableHoverableContent: Disable hoverable content globally (boolean)
  },
  parameters: {
    msw: { handlers: tooltipHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof TooltipDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-tooltip-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Tooltip trigger button was not found.');
    }

    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).toBeInTheDocument()
    );

    const content = doc.body.querySelector('[data-tooltip-content]');
    if (!(content instanceof HTMLElement)) {
      throw new Error('Tooltip content was not found.');
    }

    expect(content.textContent?.trim()).toBeInTheDocument();

    await userEvent.unhover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).not.toBeInTheDocument()
    );
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).toBeInTheDocument()
    );
    await userEvent.unhover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).not.toBeInTheDocument()
    );
  },
};

function VariantsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.topSide')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hoverTop', 'Hover (Top)')}</Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            Tooltip appears on top
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.bottomSide')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">
              {i18n.t('tooltip.story.hoverBottom', 'Hover (Bottom)')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            Tooltip appears on bottom
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.leftSide')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hoverLeft', 'Hover (Left)')}</Button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={6}>
            Tooltip appears on left
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.rightSide')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hoverRight', 'Hover (Right)')}</Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={6}>
            Tooltip appears on right
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.withCustomDelay')}</p>
        <Tooltip delayDuration={1000}>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hoverSlow', 'Hover (Slow)')}</Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {i18n.t('tooltip.story.thisTooltipHasALongerDelay', 'This tooltip has a longer delay')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.variants.withRichContent')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hoverRich', 'Hover (Rich)')}</Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">
                {i18n.t('tooltip.story.richTooltip', 'Rich Tooltip')}
              </span>
              <span className="text-muted-foreground text-xs">
                {i18n.t(
                  'tooltip.story.withMultipleLinesOfContent',
                  'With multiple lines of content'
                )}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const tooltips = canvasElement.querySelectorAll('[data-slot="tooltip"]');
    expect(tooltips.length).toBe(6);
  },
};

function SizesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.sizes.compact')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hover', 'Hover')}</Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="px-2 py-1 text-xs">
            Short
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.sizes.default')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hover', 'Hover')}</Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {i18n.t('tooltip.story.standardTooltipContent', 'Standard tooltip content')}
          </TooltipContent>
        </Tooltip>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('tooltip.sizes.wide')}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">{i18n.t('tooltip.story.hover', 'Hover')}</Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} className="max-w-xs">
            This is a wider tooltip that can contain more detailed information and wraps to multiple
            lines when needed.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const tooltips = canvasElement.querySelectorAll('[data-slot="tooltip"]');
    expect(tooltips.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).toBeInTheDocument()
    );
    await userEvent.unhover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).not.toBeInTheDocument()
    );
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    await userEvent.hover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).toBeInTheDocument()
    );
    await userEvent.unhover(trigger);
    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).not.toBeInTheDocument()
    );
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nTooltipDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const trigger = context.canvasElement.querySelector('[data-tooltip-trigger]');
    expect(trigger?.textContent?.trim()).toBe('ホバー');

    await userEvent.hover(trigger as HTMLElement);

    await waitFor(() =>
      expect(doc.body.querySelector('[data-tooltip-content]')).toBeInTheDocument()
    );

    const content = doc.body.querySelector('[data-tooltip-content]');
    expect(content?.textContent?.trim()).toBe('ツールチップの内容');
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
  name: i18n.t('tooltip.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tooltipStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="tooltip"]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('tooltip.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    const trigger = canvasElement.querySelector('[data-tooltip-trigger]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Tooltip trigger was not found.');
    }

    // Test keyboard focus shows tooltip
    trigger.focus();
    expect(doc.activeElement).toBe(trigger);

    // Tooltip should appear on focus
    await waitFor(() => {
      const content = doc.body.querySelector('[data-tooltip-content]');
      expect(content).toBeInTheDocument();
    });

    const content = doc.body.querySelector('[data-tooltip-content]');
    if (!(content instanceof HTMLElement)) {
      throw new Error('Tooltip content was not found.');
    }

    // Verify tooltip has role="tooltip"
    expect(content.getAttribute('role')).toBe('tooltip');
    // Verify tooltip content is accessible
    expect(content.textContent?.trim()).toBeInTheDocument();

    // Test Escape key closes tooltip
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-tooltip-content]')).not.toBeInTheDocument();
    });

    // Blur trigger to clean up
    trigger.blur();
  },
};

// ============ FAKER INTEGRATION STORIES ============

function TooltipWithFakerData() {
  const fakeContent = React.useMemo(() => createFakeTooltip(), []);

  return (
    <div data-testid="faker-tooltip-demo">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">
            {i18n.t('tooltip.story.hoverForFakerTooltip', 'Hover for Faker Tooltip')}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={fakeContent.side} sideOffset={fakeContent.sideOffset}>
          {fakeContent.content}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export const WithFakerData: Story = {
  render: () => <TooltipWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="faker-tooltip-demo"]')).toBeInTheDocument();

    const trigger = canvasElement.querySelector('[data-slot="tooltip-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected tooltip trigger button to be present.');
    }

    await userEvent.hover(trigger);

    const doc = canvasElement.ownerDocument;
    await waitFor(() => {
      expect(doc.body.querySelector('[data-slot="tooltip-content"]')).toBeInTheDocument();
    });

    const content = doc.body.querySelector('[data-slot="tooltip-content"]');
    expect(content?.textContent).toBeInTheDocument();
  },
};

// ============ ASYNC DATA STORIES ============

interface TooltipApiResponse {
  content: string;
  description: string;
  id: string;
  title: string;
}

interface TooltipApiError {
  code: string;
  message: string;
  status: number;
}

function TooltipWithAsyncData() {
  const [data, setData] = React.useState<TooltipApiResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<TooltipApiError | null>(null);
  const [open, setOpen] = React.useState(false);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/dialog-content/test-tooltip')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as TooltipApiError;
          throw err;
        }
        return res.json() as Promise<TooltipApiResponse>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((error_: TooltipApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (open && !data && !loading && !error) {
      fetchData();
    }
  }, [open, data, loading, error, fetchData]);

  const getDataState = (): string => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (data) return 'success';
    return 'idle';
  };

  return (
    <div data-testid="async-tooltip-demo" data-state={getDataState()}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button variant="outline">
            {i18n.t('tooltip.story.hoverForAsyncTooltip', 'Hover for Async Tooltip')}
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>
          {loading && (
            <span data-testid="tooltip-loading" className="text-muted-foreground text-xs">
              Loading...
            </span>
          )}
          {error && (
            <span
              data-testid="tooltip-error"
              data-error-status={error.status}
              className="text-destructive text-xs"
            >
              Error: {error.message}
            </span>
          )}
          {data && !loading && !error && (
            <div data-testid="tooltip-success" className="flex flex-col gap-1">
              <span className="font-semibold">{data.title}</span>
              <span className="text-muted-foreground text-xs">{data.description}</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: tooltipHandlers },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const trigger = canvasElement.querySelector('[data-slot="tooltip-trigger"]');
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Expected tooltip trigger button to be present.');
    }

    await userEvent.hover(trigger);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="tooltip-loading"]')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="tooltip-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: tooltipStatusHandlers.emptyData },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('tooltip.storyName.slowResponse', 'Slow Response (5s)'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.slowResponse },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

// ============ ADDITIONAL HTTP ERROR STORIES ============

export const Error404NotFound: Story = {
  name: i18n.t('tooltip.storyName.error404NotFound', 'Error 404: Not Found'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.notFound },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('tooltip.storyName.error409Conflict', 'Error 409: Conflict'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.conflict },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('tooltip.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.tooManyRequests },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('tooltip.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.badGateway },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('tooltip.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.serviceUnavailable },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('tooltip.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: tooltipStatusHandlers.gatewayTimeout },
  },
  render: () => <TooltipWithAsyncData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="async-tooltip-demo"]')).toBeInTheDocument();
  },
};

// ============ DELAY VARIATION STORIES ============

function DelayVariationsDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Instant (0ms)</p>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="instant-trigger">
              Hover (Instant)
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="instant-content">
            Appears immediately
          </TooltipContent>
        </Tooltip>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Fast (200ms)</p>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="fast-trigger">
              Hover (Fast)
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="fast-content">
            200ms delay
          </TooltipContent>
        </Tooltip>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Default (700ms)</p>
        <Tooltip delayDuration={700}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="default-trigger">
              Hover (Default)
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="default-content">
            700ms delay (default)
          </TooltipContent>
        </Tooltip>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Slow (1500ms)</p>
        <Tooltip delayDuration={1500}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="slow-trigger">
              Hover (Slow)
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="slow-content">
            1500ms delay
          </TooltipContent>
        </Tooltip>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Very Slow (3000ms)</p>
        <Tooltip delayDuration={3000}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="very-slow-trigger">
              Hover (Very Slow)
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="very-slow-content">
            3000ms delay
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export const DelayVariations: Story = {
  name: i18n.t('tooltip.storyName.delayVariations', 'Delay Variations'),
  render: () => <DelayVariationsDemo />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Test instant delay
    const instantTrigger = canvasElement.querySelector('[data-testid="instant-trigger"]');
    await userEvent.hover(instantTrigger!);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="instant-content"]')).toBeInTheDocument();
    });

    await userEvent.unhover(instantTrigger!);
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="instant-content"]')).not.toBeInTheDocument();
    });

    // Test fast delay
    const fastTrigger = canvasElement.querySelector('[data-testid="fast-trigger"]');
    await userEvent.hover(fastTrigger!);

    await waitFor(
      () => {
        expect(doc.body.querySelector('[data-testid="fast-content"]')).toBeInTheDocument();
      },
      { timeout: 500 }
    );

    await userEvent.unhover(fastTrigger!);
  },
};

// ============ CONTROLLED TOOLTIP STORY ============

const ControlledTooltipComponent = () => {
  const [open, setOpen] = React.useState(false);
  const [toggleCount, setToggleCount] = React.useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(!open);
            setToggleCount((c) => c + 1);
          }}
          data-testid="toggle-button"
        >
          Toggle Tooltip
        </Button>
        <span className="text-muted-foreground text-sm">
          Toggle count: <span data-testid="toggle-count">{toggleCount}</span>
        </span>
      </div>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button variant="outline" data-testid="controlled-trigger">
            Controlled Tooltip Trigger
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6} data-testid="controlled-content">
          This tooltip is controlled externally
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export const ControlledTooltip: Story = {
  name: i18n.t('tooltip.storyName.controlledTooltip', 'Controlled Tooltip'),
  render: () => <ControlledTooltipComponent />,
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Initially tooltip should be closed
    expect(doc.body.querySelector('[data-testid="controlled-content"]')).not.toBeInTheDocument();

    // Click toggle button to open
    const toggleButton = canvasElement.querySelector('[data-testid="toggle-button"]');
    await userEvent.click(toggleButton!);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="controlled-content"]')).toBeInTheDocument();
    });

    // Verify toggle count
    expect(canvasElement.querySelector('[data-testid="toggle-count"]')?.textContent).toBe('1');

    // Click toggle button to close
    await userEvent.click(toggleButton!);

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="controlled-content"]')).not.toBeInTheDocument();
    });

    expect(canvasElement.querySelector('[data-testid="toggle-count"]')?.textContent).toBe('2');
  },
};

// ============ KEYBOARD NAVIGATION STORY ============

export const KeyboardNavigation: Story = {
  name: i18n.t('tooltip.storyName.keyboardNavigation', 'Keyboard Navigation'),
  render: () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Focus the button with Tab, then press Escape to dismiss the tooltip.
      </p>
      <div className="flex gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="keyboard-trigger-1">
              First Button
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="keyboard-content-1">
            First tooltip
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid="keyboard-trigger-2">
              Second Button
            </Button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6} data-testid="keyboard-content-2">
            Second tooltip
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;

    // Focus first button
    const trigger1 = canvasElement.querySelector('[data-testid="keyboard-trigger-1"]');
    if (trigger1 instanceof HTMLButtonElement) {
      trigger1.focus();
    }

    // Tooltip should appear on focus
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="keyboard-content-1"]')).toBeInTheDocument();
    });

    // Tab to next button
    await userEvent.tab();

    // First tooltip should close, second should open
    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="keyboard-content-1"]')).not.toBeInTheDocument();
      expect(doc.body.querySelector('[data-testid="keyboard-content-2"]')).toBeInTheDocument();
    });

    // Press Escape to close
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(doc.body.querySelector('[data-testid="keyboard-content-2"]')).not.toBeInTheDocument();
    });
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('tooltip.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('tooltip.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('tooltip.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('tooltip.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// FACTORY CATALOG REFERENCE
// Available factory functions for additional story coverage:
//   createFakeTooltips
//   createFakeTooltipWithVariant
//   createFakeTooltipWithTrigger
//   createFakeHelpTooltip
//   createFakeHelpTooltips
//   createFakeShortcutTooltip
//   createFakeShortcutTooltips
//   createFakeValidationTooltip
//   createFakeValidationTooltips
//   createFakeStatusTooltip
//   createFakeStatusTooltips
//   createFakeRichTooltip
//   createFakeRichTooltips
//   createFakeFormTooltipConfig
//   createFakeFormTooltipConfigs
//   createFakeTooltipToolbar
//   createFakeTooltipMatrix
//   createFakeTooltipVariantMatrix
//   createFakeTooltipDelayMatrix
//   createFakeTooltipShowcase
//   createFakePositionTooltips
//   createFakeTriggerTypeTooltips
//   createFakeIconButtonTooltip
//   createFakeTruncatedTextTooltip
//   createFakeDisabledTooltip
//   createFakeImagePreviewTooltip
//   createFakeAvatarTooltip
//   createFakeNavTooltip
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('tooltip.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: tooltipStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
