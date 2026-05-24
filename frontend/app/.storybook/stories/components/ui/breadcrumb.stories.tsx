import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type React from 'react';
import { useEffect, useState } from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  breadcrumbHandlers,
  breadcrumbStatusHandlers,
} from '@/.storybook/stories/_handlers/breadcrumb.handlers';
import {
  BREADCRUMB_ICONS,
  BREADCRUMB_ITEM_TYPES,
  BREADCRUMB_PATHS,
  BREADCRUMB_SEGMENTS,
  BREADCRUMB_SEPARATORS,
  type BreadcrumbIcon,
  type BreadcrumbItemType,
  type BreadcrumbSeparator as BreadcrumbSeparatorType,
  createFakeBreadcrumb,
  createFakeBreadcrumbConfig,
  createFakeBreadcrumbMatrix,
  createFakeBreadcrumbs,
  createFakeBreadcrumbTrail,
  createFakeCollapsedBreadcrumbs,
  createFakeDashboardBreadcrumbs,
  createFakeEcommerceBreadcrumbs,
  createFakeFileBreadcrumbs,
  createFakeSettingsBreadcrumbs,
  createFakeSimpleBreadcrumbs,
  type FakeBreadcrumb,
  type FakeBreadcrumbConfig,
  type FakeBreadcrumbTrail,
} from '@/.storybook/stories/_factories/breadcrumb.factory';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// ============ ASYNC DATA DEMO COMPONENTS ============

interface BreadcrumbWithFakerDataProps {
  itemCount?: number;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
}

function BreadcrumbWithFakerData({
  itemCount = 4,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: BreadcrumbWithFakerDataProps) {
  const fakeBreadcrumbs = createFakeBreadcrumbs(itemCount);

  return (
    <Breadcrumb onClick={onClick} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}>
      <BreadcrumbList>
        {fakeBreadcrumbs.map((crumb, index) => (
          <BreadcrumbItem key={crumb.id}>
            {index > 0 && <BreadcrumbSeparator />}
            {crumb.current ? (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

interface BreadcrumbWithAsyncDataProps {
  apiEndpoint?: string;
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: () => void;
}

function BreadcrumbWithAsyncData({
  apiEndpoint = '/api/breadcrumbs',
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: BreadcrumbWithAsyncDataProps) {
  const { t } = useTranslation();
  const [breadcrumbs, setBreadcrumbs] = useState<FakeBreadcrumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBreadcrumbs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiEndpoint}?path=/home/documents/projects`);
        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string };
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { breadcrumbs?: FakeBreadcrumb[] };
        setBreadcrumbs(data.breadcrumbs || []);
      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'Failed to load breadcrumbs');
      } finally {
        setLoading(false);
      }
    };
    fetchBreadcrumbs();
  }, [apiEndpoint]);

  if (loading) {
    return (
      <div className="flex gap-2" data-testid="breadcrumb-loading">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="w-[400px]" data-testid="breadcrumb-error">
        <AlertTitle>{t('breadcrumb.story.error', 'Error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (breadcrumbs.length === 0) {
    return (
      <div className="text-muted-foreground text-sm" data-testid="breadcrumb-empty">
        No navigation path available
      </div>
    );
  }

  return (
    <Breadcrumb
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-testid="breadcrumb-async"
    >
      <BreadcrumbList>
        {breadcrumbs.map((crumb, index) => (
          <BreadcrumbItem key={crumb.id}>
            {index > 0 && <BreadcrumbSeparator />}
            {crumb.current ? (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function BreadcrumbDemo() {
  const { t } = useTranslation();

  return (
    <Breadcrumb data-testid="breadcrumb-demo">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">{t('breadcrumb.home')}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">{t('breadcrumb.dashboard')}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{t('breadcrumb.settings')}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const meta = {
  title: 'Components/UI/Breadcrumb',
  component: BreadcrumbDemo,
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
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('breadcrumb.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('breadcrumb.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('breadcrumb.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('breadcrumb.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('breadcrumb.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('breadcrumb.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('breadcrumb.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    // Note: argTypes for demo wrapper - actual Breadcrumb component props documented below
    // Breadcrumb Props Reference:
    // - separator: Custom separator element (ReactNode)
    // - className: Additional CSS classes (string)
    // - children: BreadcrumbList element (ReactNode)
    //
    // BreadcrumbList Props Reference:
    // - className: Additional CSS classes (string)
    // - children: BreadcrumbItem elements (ReactNode)
    //
    // BreadcrumbItem Props Reference:
    // - className: Additional CSS classes (string)
    // - children: BreadcrumbLink, BreadcrumbPage, or BreadcrumbEllipsis (ReactNode)
    //
    // BreadcrumbLink Props Reference:
    // - href: Link destination URL (string)
    // - asChild: Render as child element (boolean)
    // - className: Additional CSS classes (string)
    // - children: Link text content (ReactNode)
    //
    // BreadcrumbPage Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Current page text (ReactNode)
    // - Automatically has aria-current="page"
    //
    // BreadcrumbSeparator Props Reference:
    // - children: Custom separator content (ReactNode, default: ChevronRightIcon)
    // - className: Additional CSS classes (string)
    //
    // BreadcrumbEllipsis Props Reference:
    // - className: Additional CSS classes (string)
    // - Has aria-hidden="true" by default
  },
  parameters: {
    msw: { handlers: breadcrumbHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof BreadcrumbDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb-ellipsis"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-slot="breadcrumb-page"][aria-current="page"]')
    ).toBeInTheDocument();

    const anchors = canvasElement.querySelectorAll('a[data-slot="breadcrumb-link"]');
    expect(anchors.length).toBe(2);

    const separators = canvasElement.querySelectorAll('[data-slot="breadcrumb-separator"]');
    expect(separators.length).toBe(3);
  },
};

export const Playground: Story = {
  ...Default,
  play: async (context) => {
    await Default.play?.(context);
  },
};

// ============ VARIANTS ============

export const Variants: Story = {
  name: i18n.t(
    'breadcrumb.storyName.variants',
    'Variants (basic, with separator, with ellipsis, with dropdown)'
  ),
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Basic */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.basic', 'Basic')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.home', 'Home')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{i18n.t('breadcrumb.story.current', 'Current')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* With Custom Separator */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.withCustomSeparator', 'With Custom Separator')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.home', 'Home')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">
                {i18n.t('breadcrumb.story.products', 'Products')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{i18n.t('breadcrumb.story.details', 'Details')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* With Ellipsis */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.withEllipsis', 'With Ellipsis')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.home', 'Home')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">
                {i18n.t('breadcrumb.story.category', 'Category')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {i18n.t('breadcrumb.story.currentPage', 'Current Page')}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* With Dropdown (simulated) */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t(
            'breadcrumb.story.withDropdownEllipsisAsMenu',
            'With Dropdown (ellipsis as menu)'
          )}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.root', 'Root')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis className="cursor-pointer hover:opacity-70" />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">
                {i18n.t('breadcrumb.story.parent', 'Parent')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{i18n.t('breadcrumb.story.active', 'Active')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(4);
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-ellipsis"]').length).toBe(2);
  },
};

// ============ SIZES ============

export const Sizes: Story = {
  name: i18n.t('breadcrumb.storyName.sizes', 'Sizes (compact spacing, default, wide spacing)'),
  render: () => (
    <div className="flex flex-col gap-6">
      {/* Compact Spacing */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.compactSpacing', 'Compact Spacing')}
        </div>
        <Breadcrumb>
          <BreadcrumbList className="gap-1">
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-xs">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-3" />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-xs">
                Products
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-3" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs">
                {i18n.t('breadcrumb.story.details', 'Details')}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Default */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.default', 'Default')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.home', 'Home')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">
                {i18n.t('breadcrumb.story.products', 'Products')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{i18n.t('breadcrumb.story.details', 'Details')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Wide Spacing */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs">
          {i18n.t('breadcrumb.story.wideSpacing', 'Wide Spacing')}
        </div>
        <Breadcrumb>
          <BreadcrumbList className="gap-3">
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-base">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-5" />
            <BreadcrumbItem>
              <BreadcrumbLink href="#" className="text-base">
                Products
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="[&>svg]:size-5" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-base">
                {i18n.t('breadcrumb.story.details', 'Details')}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(3);
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
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const canvas = within(context.canvasElement);
    expect(canvas.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
    expect(canvas.getByRole('link', { name: '設定' })).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('breadcrumb.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: (args) => <BreadcrumbWithFakerData {...args} itemCount={4} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb"]')).toBeInTheDocument();

    const list = canvas.getByRole('list');
    expect(list).toBeInTheDocument();

    const links = canvasElement.querySelectorAll('a[data-slot="breadcrumb-link"]');
    expect(links.length).toBeGreaterThan(0);

    const currentPage = canvasElement.querySelector('[data-slot="breadcrumb-page"]');
    expect(currentPage).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for async data to load
    await canvas.findByRole('navigation', { name: 'breadcrumb' });
    expect(canvasElement.querySelector('[data-testid="breadcrumb-async"]')).toBeInTheDocument();

    const links = canvasElement.querySelectorAll('a[data-slot="breadcrumb-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// ============ HTTP 4xx ERROR STORIES ============

export const Error400BadRequest: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

// ============ HTTP 5xx ERROR STORIES ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb"]')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const Loading: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loading = await canvas.findByTestId('breadcrumb-loading');
    expect(loading).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const empty = await canvas.findByTestId('breadcrumb-empty');
    expect(empty).toBeInTheDocument();
    expect(canvas.getByText('No navigation path available')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Should initially show loading state
    const loading = await canvas.findByTestId('breadcrumb-loading');
    expect(loading).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  render: (args) => <BreadcrumbWithAsyncData {...args} />,
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },
  parameters: {
    msw: { handlers: breadcrumbStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByTestId('breadcrumb-error');
    expect(canvas.getByText('Error')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('breadcrumb.storyName.accessibility', 'Accessibility'),
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">{i18n.t('breadcrumb.story.home', 'Home')}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">
            {i18n.t('breadcrumb.story.products', 'Products')}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#">
            {i18n.t('breadcrumb.story.category', 'Category')}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{i18n.t('breadcrumb.story.currentPage', 'Current Page')}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Test navigation landmark
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    expect(nav.getAttribute('aria-label')).toBe('breadcrumb');

    // Test breadcrumb structure
    expect(canvasElement.querySelector('[data-slot="breadcrumb"]')).toBeInTheDocument();

    // Test all links are accessible
    const links = canvas.getAllByRole('link');
    expect(links.length).toBe(3);

    // Verify links have href attributes
    for (const link of links) {
      expect(link.getAttribute('href')).toBeInTheDocument();
      expect(link.getAttribute('data-slot')).toBe('breadcrumb-link');
    }

    // Test keyboard navigation through links
    links[0].focus();
    expect(doc.activeElement).toBe(links[0]);

    await userEvent.keyboard('{Tab}');
    expect(doc.activeElement).toBe(links[1]);

    await userEvent.keyboard('{Tab}');
    expect(doc.activeElement).toBe(links[2]);

    // Verify current page has aria-current
    const currentPage = canvasElement.querySelector('[data-slot="breadcrumb-page"]');
    expect(currentPage).toBeInTheDocument();
    expect(currentPage?.getAttribute('aria-current')).toBe('page');

    // Verify separators are presentational (not focusable)
    const separators = canvasElement.querySelectorAll('[data-slot="breadcrumb-separator"]');
    expect(separators.length).toBe(3);
    for (const separator of separators) {
      expect(separator.getAttribute('role')).toBe('presentation');
      expect(separator.getAttribute('aria-hidden')).toBe('true');
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Accessibility testing with navigation landmark, keyboard navigation, and aria-current validation.',
      },
    },
  },
};

// ============ HELPER: render breadcrumb item by type ============

function renderBreadcrumbContent(crumb: FakeBreadcrumb) {
  if (crumb.type === 'ellipsis') {
    return <BreadcrumbEllipsis />;
  }
  if (crumb.current) {
    return <BreadcrumbPage>{crumb.label}</BreadcrumbPage>;
  }
  return <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>;
}

function renderBreadcrumbContentWithIcon(crumb: FakeBreadcrumb, showIcons: boolean) {
  if (crumb.type === 'ellipsis') {
    return <BreadcrumbEllipsis />;
  }
  const prefix = showIcons && crumb.icon ? `[${crumb.icon}] ` : '';
  if (crumb.current) {
    return (
      <BreadcrumbPage>
        {prefix}
        {crumb.label}
      </BreadcrumbPage>
    );
  }
  return (
    <BreadcrumbLink href={crumb.href}>
      {prefix}
      {crumb.label}
    </BreadcrumbLink>
  );
}

function getSeparatorSymbol(separator: BreadcrumbSeparatorType): string | undefined {
  const symbols: Record<BreadcrumbSeparatorType, string | undefined> = {
    arrow: '\u2192',
    chevron: undefined,
    dot: '\u00B7',
    slash: '/',
  };
  return symbols[separator];
}

// ============ FACTORY: createFakeBreadcrumb (single item) ============

function SingleBreadcrumbItemDemo() {
  const item = createFakeBreadcrumb();
  const itemWithOverrides = createFakeBreadcrumb({
    label: i18n.t('breadcrumb.products'),
    icon: 'folder',
    current: false,
    type: 'link',
  });
  const currentItem = createFakeBreadcrumb({
    label: i18n.t('breadcrumb.currentPage'),
    current: true,
    type: 'current',
    href: undefined,
  });

  return (
    <div className="flex flex-col gap-4" data-testid="single-breadcrumb-demo">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.story.randomBreadcrumbItem', 'Random breadcrumb item')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.story.itemWithOverrides', 'Item with overrides')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={itemWithOverrides.href}>
                {itemWithOverrides.icon ? `[${itemWithOverrides.icon}] ` : ''}
                {itemWithOverrides.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.story.currentPageItem', 'Current page item')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{currentItem.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

export const FactoryCreateFakeBreadcrumb: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeBreadcrumb',
    'Factory: createFakeBreadcrumb (single item)'
  ),
  render: () => <SingleBreadcrumbItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('single-breadcrumb-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(3);
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]').length).toBe(2);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSimpleBreadcrumbs ============

function SimpleBreadcrumbsDemo() {
  const defaultSimple = createFakeSimpleBreadcrumbs();
  const customSimple = createFakeSimpleBreadcrumbs(i18n.t('breadcrumb.settings'));

  return (
    <div className="flex flex-col gap-4" data-testid="simple-breadcrumbs-demo">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.story.defaultSimpleTrail', 'Default simple trail')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {defaultSimple.map((crumb, index) => (
              <BreadcrumbItem key={crumb.id}>
                {index > 0 && <BreadcrumbSeparator />}
                {crumb.current ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.story.customLabelSimpleTrail', 'Custom label simple trail')}
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {customSimple.map((crumb, index) => (
              <BreadcrumbItem key={crumb.id}>
                {index > 0 && <BreadcrumbSeparator />}
                {crumb.current ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

export const FactoryCreateFakeSimpleBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeSimpleBreadcrumbs',
    'Factory: createFakeSimpleBreadcrumbs'
  ),
  render: () => <SimpleBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('simple-breadcrumbs-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(2);
    // Each simple trail has 1 link + 1 page
    const links = canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]');
    expect(links.length).toBe(2);
    const pages = canvasElement.querySelectorAll('[data-slot="breadcrumb-page"]');
    expect(pages.length).toBe(2);
  },
};

// ============ FACTORY: createFakeDashboardBreadcrumbs ============

function DashboardBreadcrumbsDemo() {
  const items = createFakeDashboardBreadcrumbs();

  return (
    <div data-testid="dashboard-breadcrumbs-demo">
      <div className="text-muted-foreground mb-1 text-xs">
        {i18n.t('breadcrumb.dashboard')} {i18n.t('breadcrumb.ariaLabel')}
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((crumb, index) => (
            <BreadcrumbItem key={crumb.id}>
              {index > 0 && <BreadcrumbSeparator />}
              {crumb.current ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const FactoryCreateFakeDashboardBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeDashboardBreadcrumbs',
    'Factory: createFakeDashboardBreadcrumbs'
  ),
  render: () => <DashboardBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('dashboard-breadcrumbs-demo')).toBeInTheDocument();
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    // Dashboard trail: Home > Dashboard (2 items, 1 link, 1 page)
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]').length).toBe(1);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeEcommerceBreadcrumbs ============

function EcommerceBreadcrumbsDemo() {
  const items = createFakeEcommerceBreadcrumbs();

  return (
    <div data-testid="ecommerce-breadcrumbs-demo">
      <div className="text-muted-foreground mb-1 text-xs">
        {i18n.t('breadcrumb.products')} - E-commerce deep hierarchy
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((crumb, index) => (
            <BreadcrumbItem key={crumb.id}>
              {index > 0 && <BreadcrumbSeparator />}
              {crumb.current ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const FactoryCreateFakeEcommerceBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeEcommerceBreadcrumbs',
    'Factory: createFakeEcommerceBreadcrumbs'
  ),
  render: () => <EcommerceBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('ecommerce-breadcrumbs-demo')).toBeInTheDocument();
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    // Ecommerce trail: Home > Products > Electronics > Smartphones > iPhone 15 (5 items)
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]').length).toBe(4);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeFileBreadcrumbs ============

function FileBreadcrumbsDemo() {
  const items = createFakeFileBreadcrumbs();

  return (
    <div data-testid="file-breadcrumbs-demo">
      <div className="text-muted-foreground mb-1 text-xs">
        {i18n.t(
          'breadcrumb.story.filePathBreadcrumbsWithIcons',
          'File path breadcrumbs with icons'
        )}
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((crumb, index) => (
            <BreadcrumbItem key={crumb.id}>
              {index > 0 && <BreadcrumbSeparator />}
              {crumb.current ? (
                <BreadcrumbPage>
                  {crumb.icon ? `[${crumb.icon}] ` : ''}
                  {crumb.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>
                  {crumb.icon ? `[${crumb.icon}] ` : ''}
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const FactoryCreateFakeFileBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeFileBreadcrumbs',
    'Factory: createFakeFileBreadcrumbs'
  ),
  render: () => <FileBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-breadcrumbs-demo')).toBeInTheDocument();
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    // File trail: Home > Documents > Projects > 2024 > Q1 Report.pdf (5 items)
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]').length).toBe(4);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSettingsBreadcrumbs ============

function SettingsBreadcrumbsDemo() {
  const items = createFakeSettingsBreadcrumbs();

  return (
    <div data-testid="settings-breadcrumbs-demo">
      <div className="text-muted-foreground mb-1 text-xs">
        {i18n.t('breadcrumb.settings')} - {i18n.t('breadcrumb.security')}
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((crumb, index) => (
            <BreadcrumbItem key={crumb.id}>
              {index > 0 && <BreadcrumbSeparator />}
              {crumb.current ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const FactoryCreateFakeSettingsBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeSettingsBreadcrumbs',
    'Factory: createFakeSettingsBreadcrumbs'
  ),
  render: () => <SettingsBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('settings-breadcrumbs-demo')).toBeInTheDocument();
    const nav = canvas.getByRole('navigation', { name: 'breadcrumb' });
    expect(nav).toBeInTheDocument();
    // Settings trail: Home > Settings > Account > Security (4 items)
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]').length).toBe(3);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCollapsedBreadcrumbs ============

function CollapsedBreadcrumbsDemo() {
  const defaultCollapsed = createFakeCollapsedBreadcrumbs();
  const customCollapsed = createFakeCollapsedBreadcrumbs(8, 4);

  return (
    <div className="flex flex-col gap-4" data-testid="collapsed-breadcrumbs-demo">
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {i18n.t('breadcrumb.home')} - Default collapsed (6 total, 3 visible)
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {defaultCollapsed.map((crumb, index) => (
              <BreadcrumbItem key={crumb.id}>
                {index > 0 && <BreadcrumbSeparator />}
                {renderBreadcrumbContent(crumb)}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          Custom collapsed (8 total, 4 visible)
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {customCollapsed.map((crumb, index) => (
              <BreadcrumbItem key={crumb.id}>
                {index > 0 && <BreadcrumbSeparator />}
                {renderBreadcrumbContent(crumb)}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

export const FactoryCreateFakeCollapsedBreadcrumbs: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeCollapsedBreadcrumbs',
    'Factory: createFakeCollapsedBreadcrumbs'
  ),
  render: () => <CollapsedBreadcrumbsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('collapsed-breadcrumbs-demo')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(2);
    // Both trails should have ellipsis
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-ellipsis"]').length).toBe(2);
  },
};

// ============ FACTORY: createFakeBreadcrumbTrail ============

function BreadcrumbTrailDemo() {
  const contexts: Array<'admin' | 'dashboard' | 'ecommerce' | 'files' | 'settings'> = [
    'dashboard',
    'ecommerce',
    'files',
    'settings',
    'admin',
  ];

  const trails: FakeBreadcrumbTrail[] = contexts.map((context) =>
    createFakeBreadcrumbTrail({ context, separator: 'chevron' })
  );

  const collapsedTrail: FakeBreadcrumbTrail = createFakeBreadcrumbTrail({
    context: 'ecommerce',
    collapsed: true,
    separator: 'slash',
  });

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-trail-demo">
      {trails.map((trail, trailIndex) => (
        <div key={contexts[trailIndex]}>
          <div className="text-muted-foreground mb-1 text-xs">
            {i18n.t('breadcrumb.ariaLabel')} - {contexts[trailIndex]} (separator: {trail.separator})
          </div>
          <Breadcrumb>
            <BreadcrumbList>
              {trail.items.map((crumb, index) => (
                <BreadcrumbItem key={crumb.id}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {renderBreadcrumbContent(crumb)}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      ))}
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          Collapsed trail (maxItems: {collapsedTrail.maxItems})
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {collapsedTrail.items.map((crumb, index) => (
              <BreadcrumbItem key={crumb.id}>
                {index > 0 && (
                  <BreadcrumbSeparator>
                    {collapsedTrail.separator === 'slash' ? '/' : undefined}
                  </BreadcrumbSeparator>
                )}
                {renderBreadcrumbContent(crumb)}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}

export const FactoryCreateFakeBreadcrumbTrail: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeBreadcrumbTrail',
    'Factory: createFakeBreadcrumbTrail'
  ),
  render: () => <BreadcrumbTrailDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-trail-demo')).toBeInTheDocument();
    // 5 context trails + 1 collapsed = 6 breadcrumbs
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(6);
    // Collapsed trail should have ellipsis
    expect(
      canvasElement.querySelectorAll('[data-slot="breadcrumb-ellipsis"]').length
    ).toBeGreaterThanOrEqual(1);
  },
};

// ============ FACTORY: createFakeBreadcrumbMatrix ============

function BreadcrumbMatrixDemo() {
  const { t } = useTranslation();
  const matrix: FakeBreadcrumbTrail[] = createFakeBreadcrumbMatrix();

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-matrix-demo">
      <div className="text-muted-foreground text-xs">
        {t('breadcrumb.ariaLabel')} - All separator variants
      </div>
      {matrix.map((trail) => (
        <div key={trail.separator}>
          <div className="text-muted-foreground mb-1 text-xs">Separator: {trail.separator}</div>
          <Breadcrumb>
            <BreadcrumbList>
              {trail.items.map((crumb, index) => (
                <BreadcrumbItem key={crumb.id}>
                  {index > 0 && (
                    <BreadcrumbSeparator>{getSeparatorSymbol(trail.separator)}</BreadcrumbSeparator>
                  )}
                  {crumb.current ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      ))}
    </div>
  );
}

export const FactoryCreateFakeBreadcrumbMatrix: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeBreadcrumbMatrix',
    'Factory: createFakeBreadcrumbMatrix'
  ),
  render: () => <BreadcrumbMatrixDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-matrix-demo')).toBeInTheDocument();
    // 4 separator types (arrow, chevron, dot, slash) = 4 breadcrumbs
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(4);
  },
};

// ============ FACTORY: createFakeBreadcrumbConfig ============

function BreadcrumbConfigDemo() {
  const scenarios: Array<'collapsed' | 'default' | 'withIcons'> = [
    'default',
    'collapsed',
    'withIcons',
  ];

  const configs: FakeBreadcrumbConfig[] = scenarios.map((s) => createFakeBreadcrumbConfig(s));
  const items = createFakeBreadcrumbs(5);

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-config-demo">
      <div className="text-muted-foreground text-xs">
        {i18n.t('breadcrumb.ariaLabel')} - Configs
      </div>
      {configs.map((config, configIndex) => {
        const visibleItems = config.collapseMiddle
          ? [
              items[0],
              { ...items[1], type: 'ellipsis' as BreadcrumbItemType, label: '...' },
              ...items.slice(-Math.min(config.maxVisible - 1, items.length)),
            ]
          : items.slice(0, config.maxVisible);

        return (
          <div key={scenarios[configIndex]}>
            <div className="text-muted-foreground mb-1 text-xs">
              Config: {scenarios[configIndex]} | separator: {config.separator} | icons:{' '}
              {config.showIcons ? 'yes' : 'no'} | collapse: {config.collapseMiddle ? 'yes' : 'no'} |
              max: {config.maxVisible}
            </div>
            <Breadcrumb>
              <BreadcrumbList>
                {visibleItems.map((crumb, index) => (
                  <BreadcrumbItem key={crumb.id}>
                    {index > 0 && <BreadcrumbSeparator />}
                    {renderBreadcrumbContentWithIcon(crumb, config.showIcons)}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        );
      })}
    </div>
  );
}

export const FactoryCreateFakeBreadcrumbConfig: Story = {
  name: i18n.t(
    'breadcrumb.storyName.factoryCreateFakeBreadcrumbConfig',
    'Factory: createFakeBreadcrumbConfig'
  ),
  render: () => <BreadcrumbConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-config-demo')).toBeInTheDocument();
    // 3 config scenarios = 3 breadcrumbs
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(3);
    // The collapsed config should include an ellipsis
    expect(
      canvasElement.querySelectorAll('[data-slot="breadcrumb-ellipsis"]').length
    ).toBeGreaterThanOrEqual(1);
  },
};

// ============ CONSTANT: BREADCRUMB_SEPARATORS ============

function BreadcrumbSeparatorsDemo() {
  const { t } = useTranslation();
  const items = createFakeSimpleBreadcrumbs(t('breadcrumb.settings'));

  const separatorSymbols: Record<BreadcrumbSeparatorType, string | undefined> = {
    arrow: '\u2192',
    chevron: undefined,
    dot: '\u00B7',
    slash: '/',
  };

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-separators-demo">
      <div className="text-muted-foreground text-xs">
        All {BREADCRUMB_SEPARATORS.length} separator types
      </div>
      {BREADCRUMB_SEPARATORS.map((sep) => (
        <div key={sep}>
          <div className="text-muted-foreground mb-1 text-xs">Separator: {sep}</div>
          <Breadcrumb>
            <BreadcrumbList>
              {items.map((crumb, index) => (
                <BreadcrumbItem key={crumb.id}>
                  {index > 0 && <BreadcrumbSeparator>{separatorSymbols[sep]}</BreadcrumbSeparator>}
                  {crumb.current ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      ))}
    </div>
  );
}

export const ConstantBreadcrumbSeparators: Story = {
  name: i18n.t(
    'breadcrumb.storyName.constantBreadcrumbSeparators',
    'Constant: BREADCRUMB_SEPARATORS'
  ),
  render: () => <BreadcrumbSeparatorsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-separators-demo')).toBeInTheDocument();
    // 4 separator types
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(
      BREADCRUMB_SEPARATORS.length
    );
  },
};

// ============ CONSTANT: BREADCRUMB_ICONS ============

function BreadcrumbIconsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-icons-demo">
      <div className="text-muted-foreground text-xs">
        {i18n.t('breadcrumb.story.allIconTypes', { count: BREADCRUMB_ICONS.length })}
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          {BREADCRUMB_ICONS.map((icon: BreadcrumbIcon, index) => (
            <BreadcrumbItem key={icon}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbLink href="#">
                [{icon}] {i18n.t('breadcrumb.home')}
              </BreadcrumbLink>
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const ConstantBreadcrumbIcons: Story = {
  name: i18n.t('breadcrumb.storyName.constantBreadcrumbIcons', 'Constant: BREADCRUMB_ICONS'),
  render: () => <BreadcrumbIconsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-icons-demo')).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]');
    expect(links.length).toBe(BREADCRUMB_ICONS.length);
  },
};

// ============ CONSTANT: BREADCRUMB_ITEM_TYPES ============

function BreadcrumbItemTypesDemo() {
  const typeRenderers: Record<BreadcrumbItemType, React.ReactNode> = {
    link: <BreadcrumbLink href="#">{i18n.t('breadcrumb.products')}</BreadcrumbLink>,
    current: <BreadcrumbPage>{i18n.t('breadcrumb.currentPage')}</BreadcrumbPage>,
    ellipsis: <BreadcrumbEllipsis />,
  };

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-item-types-demo">
      <div className="text-muted-foreground text-xs">
        All {BREADCRUMB_ITEM_TYPES.length} item types
      </div>
      {BREADCRUMB_ITEM_TYPES.map((itemType) => (
        <div key={itemType}>
          <div className="text-muted-foreground mb-1 text-xs">Type: {itemType}</div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>{typeRenderers[itemType]}</BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      ))}
    </div>
  );
}

export const ConstantBreadcrumbItemTypes: Story = {
  name: i18n.t(
    'breadcrumb.storyName.constantBreadcrumbItemTypes',
    'Constant: BREADCRUMB_ITEM_TYPES'
  ),
  render: () => <BreadcrumbItemTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-item-types-demo')).toBeInTheDocument();
    // 3 item types = 3 breadcrumbs
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(
      BREADCRUMB_ITEM_TYPES.length
    );
    // Verify each type is represented
    expect(canvasElement.querySelector('[data-slot="breadcrumb-link"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="breadcrumb-ellipsis"]')).toBeInTheDocument();
  },
};

// ============ CONSTANT: BREADCRUMB_SEGMENTS ============

function BreadcrumbSegmentsDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2" data-testid="breadcrumb-segments-demo">
      <div className="text-muted-foreground text-xs">
        {t('breadcrumb.ariaLabel')} - All {BREADCRUMB_SEGMENTS.length} predefined segments
      </div>
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          {BREADCRUMB_SEGMENTS.map((segment, index) => (
            <BreadcrumbItem key={segment}>
              {index > 0 && <BreadcrumbSeparator />}
              {index === BREADCRUMB_SEGMENTS.length - 1 ? (
                <BreadcrumbPage>{segment}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href="#">{segment}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export const ConstantBreadcrumbSegments: Story = {
  name: i18n.t('breadcrumb.storyName.constantBreadcrumbSegments', 'Constant: BREADCRUMB_SEGMENTS'),
  render: () => <BreadcrumbSegmentsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-segments-demo')).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="breadcrumb-link"]');
    // All segments minus the last one (which is a page)
    expect(links.length).toBe(BREADCRUMB_SEGMENTS.length - 1);
    expect(canvasElement.querySelector('[data-slot="breadcrumb-page"]')).toBeInTheDocument();
  },
};

// ============ CONSTANT: BREADCRUMB_PATHS ============

function BreadcrumbPathsDemo() {
  const pathKeys = Object.keys(BREADCRUMB_PATHS) as Array<keyof typeof BREADCRUMB_PATHS>;

  return (
    <div className="flex flex-col gap-4" data-testid="breadcrumb-paths-demo">
      <div className="text-muted-foreground text-xs">
        {i18n.t('breadcrumb.ariaLabel')} - All {pathKeys.length} predefined paths
      </div>
      {pathKeys.map((pathKey) => {
        const segments = BREADCRUMB_PATHS[pathKey];
        return (
          <div key={pathKey}>
            <div className="text-muted-foreground mb-1 text-xs">Path: {pathKey}</div>
            <Breadcrumb>
              <BreadcrumbList>
                {segments.map((segment, index) => (
                  <BreadcrumbItem key={`${pathKey}-${segment}`}>
                    {index > 0 && <BreadcrumbSeparator />}
                    {index === segments.length - 1 ? (
                      <BreadcrumbPage>{segment}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href="#">{segment}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        );
      })}
    </div>
  );
}

export const ConstantBreadcrumbPaths: Story = {
  name: i18n.t('breadcrumb.storyName.constantBreadcrumbPaths', 'Constant: BREADCRUMB_PATHS'),
  render: () => <BreadcrumbPathsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('breadcrumb-paths-demo')).toBeInTheDocument();
    const pathKeys = Object.keys(BREADCRUMB_PATHS);
    // 5 path contexts = 5 breadcrumbs
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb"]').length).toBe(pathKeys.length);
    // Each path should have a current page
    expect(canvasElement.querySelectorAll('[data-slot="breadcrumb-page"]').length).toBe(
      pathKeys.length
    );
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: breadcrumbStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('breadcrumb.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: breadcrumbStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
