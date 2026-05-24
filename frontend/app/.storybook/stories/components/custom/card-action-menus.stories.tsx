import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { faker } from '@faker-js/faker';
import { useTranslation } from 'react-i18next';
import { action } from 'storybook/actions';
import type { ComponentProps } from 'react';

import {
  cardActionMenusHandlers,
  cardActionMenusStatusHandlers,
} from '@/.storybook/stories/_handlers/card-action-menus.handlers';
import { formHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import type {
  CardActionType,
  CardExportFormat,
  FakeCardActionMenu,
  FakeExportButtonConfig,
} from '@/.storybook/stories/_factories/card-action-menus.factory';
import {
  CARD_ACTION_LABELS,
  CARD_ACTION_TYPES,
  CARD_EXPORT_FORMATS,
  createFakeCardActionMenu,
  createFakeCardActionMenus,
  createFakeCardActionMenuSet,
  createFakeDisabledCardAction,
  createFakeExportButtonConfig,
} from '@/.storybook/stories/_factories/card-action-menus.factory';

import { ExportButton } from '@/components/CardActionMenus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// Demo wrapper showing CardActionMenus in context
function CardActionMenusDemo(props: ComponentProps<typeof ExportButton>) {
  const { t } = useTranslation();

  return (
    <Card
      className="w-[420px]"
      data-slot="card-action-menus-demo"
      data-testid="card-action-menus-demo"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{t('cardActionMenus.story.dataExport', 'Data Export')}</CardTitle>
          <CardDescription>{t('cardActionMenus.story.exportDescription')}</CardDescription>
        </div>
        <ExportButton
          {...props}
          labels={{
            button: t('cardActionMenus.story.exportLabel'),
            excel: t('cardActionMenus.story.excelLabel'),
            pdf: t('cardActionMenus.story.pdfLabel'),
          }}
        />
      </CardHeader>
      <CardContent>
        <div className="bg-muted h-32 rounded-lg" data-testid="card-content-placeholder" />
      </CardContent>
    </Card>
  );
}

const meta = {
  title: 'Components/Custom/Card Action Menus',
  component: ExportButton,
  tags: ['autodocs'],
  args: {
    disabled: false,
    labels: undefined,
    onExport: fn(),
  },
  argTypes: {
    // Content
    labels: {
      control: { type: 'object' },
      description: i18n.t(
        'cardActionMenus.argType.localizationLabelsForButtonAndMenuItems',
        'Localization labels for button and menu items'
      ),
      table: {
        category: 'Content',
        type: { summary: '{ button: string; excel: string; pdf: string }' },
      },
    },
    // State
    disabled: {
      control: { type: 'boolean' },
      description: i18n.t(
        'cardActionMenus.argType.whetherTheExportButtonIsDisabled',
        'Whether the export button is disabled'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Events
    onExport: {
      action: 'onExport',
      description: i18n.t(
        'cardActionMenus.argType.calledWhenAnExportFormatIsSelected',
        'Called when an export format is selected'
      ),
      table: {
        category: 'Events',
        type: { summary: "(format: 'excel' | 'pdf') => void" },
      },
    },
    // CardActionMenus.tsx Exports Reference:
    // - ExportButton: Dropdown menu for data export
    //
    // ExportButton Props:
    // - disabled: Disable the button (boolean)
    // - labels: Localization object (ExportButtonLabels)
    //   - button: Button text (string, default: 'Export')
    //   - excel: Excel option text (string, default: 'Excel')
    //   - pdf: PDF option text (string, default: 'PDF')
    // - onExport: Export handler ((format: 'excel' | 'pdf') => void)
    // - className: Additional CSS classes (string)
    //
    // Export Formats:
    // - 'excel': Microsoft Excel format
    // - 'pdf': PDF document format
    //
    // Usage Notes:
    // - Component file exports ExportButton for card header actions
    // - Uses DropdownMenu for format selection
    // - Supports i18n through labels prop
    // - Integrates with card layouts for action menus
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ExportButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <CardActionMenusDemo {...args} />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify the demo card is rendered
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();

    // Verify export button is present
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const WithExportAction: Story = {
  render: (args) => <CardActionMenusDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click the export button to open dropdown
    const button = canvas.getByRole('button');
    await userEvent.click(button);

    // Wait for dropdown to appear
    await waitFor(() => {
      const content = document.querySelector('[data-slot="dropdown-menu-content"]');
      expect(content).toBeInTheDocument();
    });

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    // Click Excel option
    const excelOption = within(content).getByText('Excel');
    await userEvent.click(excelOption);

    // Verify callback was called
    expect(args.onExport).toHaveBeenCalledWith('excel');
  },
};

export const WithPdfExport: Story = {
  render: (args) => <CardActionMenusDemo {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click the export button to open dropdown
    const button = canvas.getByRole('button');
    await userEvent.click(button);

    // Wait for dropdown to appear
    await waitFor(() => {
      const content = document.querySelector('[data-slot="dropdown-menu-content"]');
      expect(content).toBeInTheDocument();
    });

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    // Click PDF option
    const pdfOption = within(content).getByText('PDF');
    await userEvent.click(pdfOption);

    // Verify callback was called
    expect(args.onExport).toHaveBeenCalledWith('pdf');
  },
};

export const Disabled: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeDisabled();
  },
};

export const ActionPanel: Story = {
  ...Default,
  name: i18n.t('cardActionMenus.storyName.actionPanel', 'Action panel (storybook/actions)'),
  render: (args) => (
    <CardActionMenusDemo
      {...args}
      onExport={(format) => {
        action('export')(format);
      }}
    />
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('cardActionMenus.story.inCardHeader', 'In Card Header')}
        </p>
        <CardActionMenusDemo />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('cardActionMenus.story.disabledState', 'Disabled State')}
        </p>
        <CardActionMenusDemo disabled />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('cardActionMenus.story.customLabels', 'Custom Labels')}
        </p>
        <Card className="w-[420px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{i18n.t('cardActionMenus.story.report', 'Report')}</CardTitle>
            <ExportButton
              labels={{
                button: i18n.t('cardActionMenus.story.downloadLabel'),
                excel: i18n.t('cardActionMenus.story.excelSpreadsheet'),
                pdf: i18n.t('cardActionMenus.story.pdfDocument'),
              }}
            />
          </CardHeader>
        </Card>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('cardActionMenus.story.narrowCard', 'Narrow Card')}
        </p>
        <Card className="w-[280px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {i18n.t('cardActionMenus.story.export', 'Export')}
            </CardTitle>
            <ExportButton />
          </CardHeader>
        </Card>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('cardActionMenus.story.wideCard', 'Wide Card')}
        </p>
        <Card className="w-[600px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>
                {i18n.t('cardActionMenus.story.analyticsDashboard', 'Analytics Dashboard')}
              </CardTitle>
              <CardDescription>
                {i18n.t(
                  'cardActionMenus.story.exportYourAnalyticsData',
                  'Export your analytics data'
                )}
              </CardDescription>
            </div>
            <ExportButton />
          </CardHeader>
        </Card>
      </div>
    </div>
  ),
  tags: ['!test'],
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
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
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
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const CustomLabels: Story = {
  render: (args) => (
    <CardActionMenusDemo
      {...args}
      labels={{
        button: i18n.t('cardActionMenus.story.downloadLabel'),
        excel: i18n.t('cardActionMenus.story.excelSpreadsheet'),
        pdf: i18n.t('cardActionMenus.story.pdfDocument'),
      }}
    />
  ),
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
  name: i18n.t('cardActionMenus.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (storyFn) => {
      const StoryRenderer = storyFn;
      return (
        <div className="flex flex-wrap items-start gap-3">
          <div id="hover">
            <StoryRenderer />
          </div>
          <div id="focus">
            <StoryRenderer />
          </div>
          <div id="active">
            <StoryRenderer />
          </div>
        </div>
      );
    },
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover button'],
      focusVisible: ['#focus button'],
      active: ['#active button'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const randomLabels = {
      button: faker.helpers.arrayElement([
        i18n.t('cardActionMenus.story.export', 'Export'),
        i18n.t('cardActionMenus.story.download', 'Download'),
        i18n.t('cardActionMenus.story.save', 'Save'),
      ]),
      excel: faker.helpers.arrayElement([
        i18n.t('cardActionMenus.story.excel', 'Excel'),
        i18n.t('cardActionMenus.story.spreadsheet', 'Spreadsheet'),
        i18n.t('cardActionMenus.story.xlsx', 'XLSX'),
      ]),
      pdf: faker.helpers.arrayElement([
        i18n.t('cardActionMenus.story.pdf', 'PDF'),
        i18n.t('cardActionMenus.story.document', 'Document'),
        i18n.t('cardActionMenus.story.reportLabel', 'Report'),
      ]),
    };
    return <CardActionMenusDemo labels={randomLabels} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: [...formHandlers, ...cardActionMenusHandlers] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  render: () => <CardActionMenusDemo disabled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeDisabled();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('cardActionMenus.storyName.accessibility', 'Accessibility'),
  render: (args) => <CardActionMenusDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const doc = canvasElement.ownerDocument;

    // Verify button is accessible
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();

    // Test keyboard navigation - open with Enter
    button.focus();
    expect(doc.activeElement).toBe(button);

    await userEvent.keyboard('{Enter}');

    // Wait for dropdown menu to open
    await waitFor(() => {
      const content = doc.querySelector('[data-slot="dropdown-menu-content"]');
      expect(content).toBeInTheDocument();
    });

    const content = doc.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    // Verify menu items are accessible
    const menu = within(content);
    expect(menu.getByText('Excel')).toBeInTheDocument();
    expect(menu.getByText('PDF')).toBeInTheDocument();

    // Test escape to close
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FACTORY DATA STORIES ============

function FakerCardActionMenusDemo() {
  const menuItems = createFakeCardActionMenuSet();
  const config = createFakeExportButtonConfig();

  return (
    <div className="w-full max-w-md space-y-4">
      <p className="text-sm font-medium" data-testid="faker-label">
        {i18n.t('cardActionMenus.exportLabel')}
      </p>
      <ExportButton
        labels={{
          button: config.buttonLabel,
          excel: config.excelLabel,
          pdf: config.pdfLabel,
        }}
        disabled={config.disabled}
      />
      <pre
        className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs"
        data-testid="faker-json"
      >
        {JSON.stringify(menuItems, null, 2)}
      </pre>
    </div>
  );
}

export const WithFactoryData: Story = {
  render: () => <FakerCardActionMenusDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    expect(canvas.getByTestId('faker-label')).toBeInTheDocument();
    expect(canvas.getByTestId('faker-json')).toBeInTheDocument();

    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

// ============ FACTORY SHOWCASE ============

export const FactoryShowcase: Story = {
  render: () => {
    const menu: FakeCardActionMenu = createFakeCardActionMenu();
    const menus: FakeCardActionMenu[] = createFakeCardActionMenus(3);
    const disabled: FakeCardActionMenu = createFakeDisabledCardAction();
    const exportConfig: FakeExportButtonConfig = createFakeExportButtonConfig();
    const allTypes: CardActionType[] = [...CARD_ACTION_TYPES];
    const allFormats: CardExportFormat[] = [...CARD_EXPORT_FORMATS];
    return (
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium">Action Types: {allTypes.join(', ')}</h3>
        <p className="text-xs">Labels: {Object.values(CARD_ACTION_LABELS).join(', ')}</p>
        <p className="text-xs">Export Formats: {allFormats.join(', ')}</p>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify({ menu, menus, disabled, exportConfig }, null, 2)}
        </pre>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ COMBINED GLOBALS ============

export const DarkRTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ MOBILE ============

export const Mobile: Story = {
  ...Default,
  parameters: {
    ...(Default.parameters ?? {}),
    viewport: { defaultViewport: 'mobile1' },
    chromatic: { viewports: [320] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ DATA ATTRIBUTES ============

export const DataAttributes: Story = {
  ...Default,
  render: (args) => <CardActionMenusDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify data-slot on export button wrapper
    const exportButton = canvas.getByTestId('export-button');
    expect(exportButton).toBeInTheDocument();
    expect(exportButton.getAttribute('data-slot')).toBe('export-button');

    // Verify data-testid on demo card
    const demo = canvas.getByTestId('card-action-menus-demo');
    expect(demo).toBeInTheDocument();
    expect(demo.getAttribute('data-slot')).toBe('card-action-menus-demo');
  },
};

// ============ MISSING ERROR CODES ============

export const Error404NotFound: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ DOMAIN-SPECIFIC STATUS HANDLERS ============

export const StatusSuccess: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const ConfirmationRequired: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.confirmationRequired },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const PartialSuccess: Story = {
  ...Default,
  parameters: {
    msw: { handlers: cardActionMenusStatusHandlers.partialSuccess },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('card-action-menus-demo')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};
