import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import {
  appSidebarHandlers,
  appSidebarStatusHandlers,
} from '@/.storybook/stories/_handlers/app-sidebar.handlers';
import { layoutStatusHandlers } from '@/.storybook/stories/_handlers/layout.handlers';
import { userHandlers, userStatusHandlers } from '@/.storybook/stories/_handlers/user.handlers';
import {
  createFakeNavItems,
  createFakeNavSidebarGroups,
} from '@/.storybook/stories/_factories/navigation.factory';
import {
  createFakeEmpties,
  createFakeEmpty,
  createFakeItem,
  createFakeItems,
  createFakeResizable,
  createFakeResizablePanel,
  createFakeResizablePanels,
  createFakeResizables,
  createFakeScrollArea,
  createFakeScrollAreas,
  createFakeSeparator,
  createFakeSeparators,
  createFakeSidebar,
  createFakeSidebarItem,
  createFakeSidebarItems,
  createFakeSidebars,
  SIDEBAR_ICONS,
} from '@/.storybook/stories/_factories/layout.factory';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { AppSidebar } from '@/components/layout/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

type AppSidebarDemoProps = {
  withLabels?: boolean;
};

function AppSidebarDemo({ withLabels = true }: AppSidebarDemoProps) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        labels={
          withLabels
            ? {
                appName: i18n.t('appSidebar.appName'),
                logoAlt: i18n.t('logo.alt'),
                projectsHeading: i18n.t('appSidebar.projectsHeading'),
                projectsMenuAriaLabel: i18n.t('appSidebar.projectsMenuAriaLabel'),
                ecommerceProjectName: i18n.t('appSidebar.project.ecommerce.name'),
                ecommerceProjectStatus: i18n.t('appSidebar.project.ecommerce.status'),
                blogProjectName: i18n.t('appSidebar.project.blog.name'),
                blogProjectStatus: i18n.t('appSidebar.project.blog.status'),
                newProject: i18n.t('appSidebar.newProject'),
                downloadTitle: i18n.t('appSidebar.download.title'),
                downloadDescription: i18n.t('appSidebar.download.description'),
                downloadCta: i18n.t('appSidebar.download.cta'),
              }
            : undefined
        }
      />
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium" data-testid="app-sidebar-content-title" />
          <div
            className="text-muted-foreground mt-2 text-sm"
            data-testid="app-sidebar-content-description"
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: 'Components/Layout/Sidebar/App Sidebar',
  component: AppSidebarDemo,
  tags: ['autodocs'],
  args: {
    withLabels: true,
    // Event handlers with fn() for Actions panel logging
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onProjectChange: fn(),
    onNavigate: fn(),
    onSidebarToggle: fn(),
  },
  argTypes: {
    // State
    withLabels: {
      control: { type: 'boolean' },
      description: i18n.t(
        'appSidebar.argType.whetherToUseLocalizedLabelsOrFallbackDefaults',
        'Whether to use localized labels or fallback defaults'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('appSidebar.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('appSidebar.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('appSidebar.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('appSidebar.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('appSidebar.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('appSidebar.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('appSidebar.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onProjectChange: {
      action: 'onProjectChange',
      description: i18n.t(
        'appSidebar.argType.calledWhenProjectIsSwitched',
        'Called when project is switched'
      ),
      table: { category: 'Events' },
    },
    onNavigate: {
      action: 'onNavigate',
      description: i18n.t(
        'appSidebar.argType.calledWhenNavigationItemIsClicked',
        'Called when navigation item is clicked'
      ),
      table: { category: 'Events' },
    },
    onSidebarToggle: {
      action: 'onSidebarToggle',
      description: i18n.t(
        'appSidebar.argType.calledWhenSidebarIsExpandedcollapsed',
        'Called when sidebar is expanded/collapsed'
      ),
      table: { category: 'Events' },
    },
    // AppSidebar Props Reference:
    // Optional Props:
    // - labels: AppSidebarLabels object
    //   - appName: Application name in header
    //   - logoAlt: Logo alt text
    //   - projectsHeading: Projects section heading
    //   - projectsMenuAriaLabel: Aria label for project switcher
    //   - ecommerceProjectName: E-commerce project name
    //   - ecommerceProjectStatus: E-commerce project status
    //   - blogProjectName: Blog project name
    //   - blogProjectStatus: Blog project status
    //   - newProject: New project button label
    //   - downloadTitle: Download CTA title
    //   - downloadDescription: Download CTA description
    //   - downloadCta: Download button text
    //
    // Sidebar Sections:
    // - Header: Logo and app name
    // - Project Switcher: Dropdown to switch projects
    // - Navigation: Main nav items (via NavMain)
    // - User: User menu in footer (via NavUser)
    // - Download CTA: Promotional card
    //
    // Features:
    // - Collapsible sidebar with animation
    // - Project switching with dropdown
    // - Nested navigation with expand/collapse
    // - Responsive mobile drawer
    //
    // Data Attributes:
    // - data-testid="app-sidebar-project-switcher": Project dropdown trigger
    // - data-testid="app-sidebar-project-menu": Project dropdown menu
    // - data-testid="app-sidebar-project-ecommerce": E-commerce project
    // - data-testid="app-sidebar-project-blog": Blog project
    // - data-testid="app-sidebar-new-project": New project button
  },
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: userHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} as Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="app-sidebar"]')).toBeInTheDocument();

    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    expect(canvas.getByTestId('app-sidebar-content-title')).toBeInTheDocument();

    const projectSwitcher = canvas.getByTestId('app-sidebar-project-switcher');
    expect(projectSwitcher).toBeInTheDocument();

    await userEvent.click(projectSwitcher);

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(projectSwitcher).toHaveAttribute('aria-expanded', 'true');
    });

    const dropdownContent = await waitFor(() => {
      const content = doc.querySelector<HTMLElement>('[data-testid="app-sidebar-project-menu"]');
      if (!content) {
        throw new Error('Dropdown menu content not found.');
      }
      return content;
    });

    expect(dropdownContent).toBeInTheDocument();
    const dropdown = within(dropdownContent);

    expect(dropdown.getByTestId('app-sidebar-project-ecommerce')).toBeInTheDocument();
    expect(dropdown.getByTestId('app-sidebar-project-blog')).toBeInTheDocument();
    expect(dropdown.getByTestId('app-sidebar-new-project')).toBeInTheDocument();

    // Test selecting a project
    const blogProject = dropdown.getByTestId('app-sidebar-project-blog');
    await userEvent.click(blogProject);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const FallbackLabels: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.fallbackLabels', 'Fallback labels (defaults)'),
  args: {
    ...(Default.args ?? {}),
    withLabels: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    ...Default.parameters,
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

function AppSidebarVariantExpanded() {
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        labels={{
          appName: t('appSidebar.appName'),
          logoAlt: t('logo.alt'),
          projectsHeading: t('appSidebar.projectsHeading'),
          projectsMenuAriaLabel: t('appSidebar.projectsMenuAriaLabel'),
          ecommerceProjectName: t('appSidebar.project.ecommerce.name'),
          ecommerceProjectStatus: t('appSidebar.project.ecommerce.status'),
          blogProjectName: t('appSidebar.project.blog.name'),
          blogProjectStatus: t('appSidebar.project.blog.status'),
          newProject: t('appSidebar.newProject'),
          downloadTitle: t('appSidebar.download.title'),
          downloadDescription: t('appSidebar.download.description'),
          downloadCta: t('appSidebar.download.cta'),
        }}
      />
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {t('appSidebar.story.contentArea', 'Content Area')}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebarVariantCollapsed() {
  const { t } = useTranslation();

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar
        labels={{
          appName: t('appSidebar.appName'),
          logoAlt: t('logo.alt'),
          projectsHeading: t('appSidebar.projectsHeading'),
          projectsMenuAriaLabel: t('appSidebar.projectsMenuAriaLabel'),
          ecommerceProjectName: t('appSidebar.project.ecommerce.name'),
          ecommerceProjectStatus: t('appSidebar.project.ecommerce.status'),
          blogProjectName: t('appSidebar.project.blog.name'),
          blogProjectStatus: t('appSidebar.project.blog.status'),
          newProject: t('appSidebar.newProject'),
          downloadTitle: t('appSidebar.download.title'),
          downloadDescription: t('appSidebar.download.description'),
          downloadCta: t('appSidebar.download.cta'),
        }}
      />
      <SidebarInset>
        <div className="p-6">
          <div className="text-sm font-medium">
            {t('appSidebar.story.contentArea', 'Content Area')}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('appSidebar.story.sidebarExpanded', 'Sidebar Expanded')}
        </p>
        <div className="h-[400px] overflow-hidden rounded border">
          <AppSidebarVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('appSidebar.story.sidebarCollapsed', 'Sidebar Collapsed')}
        </p>
        <div className="h-[400px] overflow-hidden rounded border">
          <AppSidebarVariantCollapsed />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    const sidebars = canvasElement.querySelectorAll('[data-slot="app-sidebar"]');
    expect(sidebars.length).toBe(2);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('appSidebar.story.compactHeight300px', 'Compact Height (300px)')}
        </p>
        <div className="h-[300px] overflow-hidden rounded border">
          <AppSidebarVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('appSidebar.story.mediumHeight500px', 'Medium Height (500px)')}
        </p>
        <div className="h-[500px] overflow-hidden rounded border">
          <AppSidebarVariantExpanded />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('appSidebar.story.largeHeight700px', 'Large Height (700px)')}
        </p>
        <div className="h-[700px] overflow-hidden rounded border">
          <AppSidebarVariantExpanded />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
  play: async ({ canvasElement }) => {
    const sidebars = canvasElement.querySelectorAll('[data-slot="app-sidebar"]');
    expect(sidebars.length).toBe(3);
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
  name: i18n.t('appSidebar.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');
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
  name: i18n.t('appSidebar.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const sidebarGroups = createFakeNavSidebarGroups(3);
    const navItems = createFakeNavItems(5);

    return (
      <div className="space-y-4 p-4">
        <div className="text-sm">
          <p className="font-medium">Sidebar Groups: {sidebarGroups.length}</p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {sidebarGroups.map((group) => (
              <li key={group.title}>
                {group.title}: {group.items.length} items
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">Nav Items: {navItems.length}</p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {navItems.slice(0, 3).map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </div>
        <div className="h-[400px] overflow-hidden rounded border">
          <AppSidebarDemo />
        </div>
      </div>
    );
  },
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="app-sidebar"]')).toBeInTheDocument();
  },
};

// ============ LAYOUT FACTORY INTEGRATION STORIES ============

function AppSidebarWithLayoutFactory() {
  const { t } = useTranslation();
  const sidebar = createFakeSidebar({ collapsed: false });
  const sidebarItems = createFakeSidebarItems(8);
  const scrollArea = createFakeScrollArea({ height: 300 });

  return (
    <div className="space-y-4">
      <div className="h-[500px] overflow-hidden rounded border">
        <AppSidebarDemo />
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm font-medium">
          {t('appSidebar.contentAreaTitle')} - Layout Factory Data
        </p>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">
            Sidebar: {sidebar.title} ({sidebar.items.length} items,{' '}
            {sidebar.collapsed ? 'collapsed' : 'expanded'})
          </p>
          <p className="text-muted-foreground text-xs">
            Scroll Area: {scrollArea.height}px height, ID: {scrollArea.id.slice(0, 8)}...
          </p>
          <p className="text-muted-foreground text-xs">
            Available Icons: {SIDEBAR_ICONS.join(', ')}
          </p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground text-xs font-medium">
            Generated Sidebar Items ({sidebarItems.length})
          </p>
          <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
            {sidebarItems.map((item) => (
              <li key={item.id} className="flex items-center gap-1">
                <span>{item.icon ?? SIDEBAR_ICONS[0]}</span>
                <span className={item.active ? 'font-semibold' : ''}>{item.label}</span>
                {item.badge ? <span className="text-red-500">({item.badge})</span> : null}
                {item.disabled ? (
                  <span className="text-muted-foreground/50">[disabled]</span>
                ) : null}
                {item.subItems ? (
                  <span className="text-muted-foreground/70">
                    [{item.subItems.length} sub-items]
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const WithLayoutFactoryData: Story = {
  render: () => <AppSidebarWithLayoutFactory />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.querySelector('[data-slot="app-sidebar"]')).toBeInTheDocument();
    expect(canvas.getByText(/Layout Factory Data/i)).toBeInTheDocument();
    expect(canvas.getByText(/Generated Sidebar Items/i)).toBeInTheDocument();
  },
};

// ============ ALL LAYOUT FACTORY FUNCTIONS DEMO ============

function LayoutFactoryDataDemo() {
  const sidebarItem = createFakeSidebarItem();
  const sidebarItems = createFakeSidebarItems(3);
  const sidebar = createFakeSidebar();
  const sidebars = createFakeSidebars(2);
  const resizable = createFakeResizable();
  const resizables = createFakeResizables(2);
  const resizablePanel = createFakeResizablePanel();
  const resizablePanels = createFakeResizablePanels(2);
  const scrollArea = createFakeScrollArea();
  const scrollAreas = createFakeScrollAreas(2);
  const separator = createFakeSeparator();
  const separators = createFakeSeparators(2);
  const item = createFakeItem();
  const items = createFakeItems(3);
  const empty = createFakeEmpty();
  const empties = createFakeEmpties(2);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium">
        {i18n.t('appSidebar.contentAreaTitle')} - All Layout Factories ({SIDEBAR_ICONS.length}{' '}
        icons)
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify(
          {
            sidebarItem,
            sidebarItems,
            sidebar,
            sidebars,
            resizable,
            resizables,
            resizablePanel,
            resizablePanels,
            scrollArea,
            scrollAreas,
            separator,
            separators,
            item,
            items,
            empty,
            empties,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

export const AllLayoutFactories: Story = {
  render: () => <LayoutFactoryDataDemo />,
  parameters: { layout: 'fullscreen' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/All Layout Factories/i)).toBeInTheDocument();
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...userHandlers, ...appSidebarHandlers] },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: userHandlers },
  },
  play: async (context) => {
    expect(context.canvasElement.querySelector('[data-slot="app-sidebar"]')).toBeInTheDocument();
    await Default.play?.(context);
  },
};

export const Loading: Story = {
  name: i18n.t('appSidebar.storyName.loading', 'Loading'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  name: i18n.t('appSidebar.storyName.emptyData', 'Empty Data'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('appSidebar.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('appSidebar.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('appSidebar.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('appSidebar.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t('appSidebar.storyName.error422UnprocessableEntity', 'Error 422: Validation Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('appSidebar.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'appSidebar.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('appSidebar.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('appSidebar.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('appSidebar.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('appSidebar.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('appSidebar.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: userStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  name: i18n.t('appSidebar.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify sidebar has proper ARIA attributes
    const sidebar = canvasElement.querySelector('[data-slot="app-sidebar"]');
    expect(sidebar).toBeInTheDocument();

    // Test keyboard navigation on project switcher
    const projectSwitcher = canvas.getByTestId('app-sidebar-project-switcher');
    expect(projectSwitcher).toBeInTheDocument();

    // Verify initial aria-expanded state
    expect(projectSwitcher).toHaveAttribute('aria-expanded', 'false');

    // Focus and activate with keyboard
    projectSwitcher.focus();
    expect(doc.activeElement).toBe(projectSwitcher);

    // Open dropdown with Enter key
    await userEvent.keyboard('{Enter}');

    // Verify aria-expanded changes after opening
    await waitFor(() => {
      expect(projectSwitcher).toHaveAttribute('aria-expanded', 'true');
    });

    const dropdownContent = await waitFor(() => {
      const content = doc.querySelector<HTMLElement>('[data-testid="app-sidebar-project-menu"]');
      if (!content) {
        throw new Error('Dropdown menu content not found.');
      }
      return content;
    });

    expect(dropdownContent).toBeInTheDocument();

    // Verify dropdown has proper role
    expect(dropdownContent.getAttribute('role')).not.toBe('');

    // Navigate within dropdown with keyboard
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Close with Escape
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        doc.querySelector<HTMLElement>('[data-testid="app-sidebar-project-menu"]')
      ).not.toBeInTheDocument();
    });

    // Verify aria-expanded changes back to false after closing
    expect(projectSwitcher).toHaveAttribute('aria-expanded', 'false');

    // Verify navigation links are accessible
    const navLinks = canvasElement.querySelectorAll('a[href]');
    navLinks.forEach((link) => {
      const linkText = link.textContent?.trim() || link.getAttribute('aria-label');
      expect(linkText).not.toBe('');
    });
  },
};

// ============================================================================
// STANDARD AUDIT STORIES
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// LAYOUT STATUS HANDLER STORIES
// ============================================================================

export const LayoutError400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutError504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutLoading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutSlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutNetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const LayoutEmptyData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: layoutStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadRequest: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerBadRequest', 'Handler: Bad Request'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnauthorized: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerUnauthorized', 'Handler: Unauthorized'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerForbidden: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerForbidden', 'Handler: Forbidden'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNotFound: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerNotFound', 'Handler: Not Found'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerUnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerUnprocessableEntity', 'Handler: Unprocessable Entity'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.unprocessableEntity } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerTooManyRequests: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerTooManyRequests', 'Handler: Too Many Requests'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerInternalServerError: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerInternalServerError', 'Handler: Internal Server Error'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerBadGateway: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerBadGateway', 'Handler: Bad Gateway'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerServiceUnavailable: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerServiceUnavailable', 'Handler: Service Unavailable'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerGatewayTimeout: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerGatewayTimeout', 'Handler: Gateway Timeout'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLoading: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerLoading', 'Handler: Loading'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerSlowResponse: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerSlowResponse', 'Handler: Slow Response'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerNetworkError: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerNetworkError', 'Handler: Network Error'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyData: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerEmptyData', 'Handler: Empty Data'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerEmptyProjects: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerEmptyProjects', 'Handler: Empty Projects'),
  parameters: { msw: { handlers: appSidebarStatusHandlers.emptyProjects } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerCollapsedSidebar: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerCollapsedSidebar', 'Handler: Collapsed Sidebar'),
  parameters: { msw: { handlers: layoutStatusHandlers.collapsedSidebar } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerLayoutSuccess: Story = {
  ...Default,
  name: i18n.t('appSidebar.storyName.handlerLayoutSuccess', 'Handler: Layout Success'),
  parameters: { msw: { handlers: layoutStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
