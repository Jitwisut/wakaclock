import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  ExportFormat,
  ExportSizeCategory,
  ExportStatus,
  FakeExportButton,
  FakeExportButtonShowcase,
  FakeExportConfig,
  FakeExportHistoryItem,
  FakeExportLabels,
  FakeExportProgress,
  FakeExportRequest,
  FakeExportResult,
} from '@/.storybook/stories/_factories/export-button.factory';
import {
  createFakeDataTableExportButton,
  createFakeExportButton,
  createFakeExportButtonDisabled,
  createFakeExportButtonLoading,
  createFakeExportButtons,
  createFakeExportButtonShowcase,
  createFakeExportButtonStandard,
  createFakeExportConfig,
  createFakeExportHistory,
  createFakeExportHistoryItem,
  createFakeExportLabels,
  createFakeExportLabelsEn,
  createFakeExportLabelsJa,
  createFakeExportProgress,
  createFakeExportProgressAt,
  createFakeExportRequest,
  createFakeExportRequests,
  createFakeExportResult,
  createFakeExportResultError,
  createFakeExportResultProcessing,
  createFakeExportResults,
  createFakeExportResultSuccess,
  createFakeInvoiceExportButton,
  createFakeReportExportButton,
  EXPORT_EXTENSIONS,
  EXPORT_FORMAT_ICONS,
  EXPORT_FORMAT_LABELS,
  EXPORT_FORMATS,
  EXPORT_MIME_TYPES,
  EXPORT_SIZE_CATEGORIES,
  EXPORT_SIZE_RANGES,
  EXPORT_STATUSES,
} from '@/.storybook/stories/_factories/export-button.factory';
import {
  exportButtonHandlers,
  exportButtonStatusHandlers,
} from '@/.storybook/stories/_handlers/export-button.handlers';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { action } from 'storybook/actions';

import { ExportButton } from '@/components/CardActionMenus';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

function I18nExportButton(props: ComponentProps<typeof ExportButton>) {
  const { t } = useTranslation();

  return (
    <ExportButton
      {...props}
      labels={{
        button: t('exportButton.button'),
        excel: t('exportButton.excel'),
        pdf: t('exportButton.pdf'),
      }}
    />
  );
}

const meta = {
  title: 'Components/Custom/Export Button',
  component: ExportButton,
  tags: ['autodocs'],
  args: {
    disabled: false,
    labels: undefined,
    // Event handlers with fn() for Actions panel logging
    onExport: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
  argTypes: {
    // Content
    labels: {
      control: { type: 'object' },
      description: i18n.t(
        'exportButton.argType.localizationLabelsForButtonAndMenuItems',
        'Localization labels for button and menu items'
      ),
      table: {
        category: 'Content',
        type: { summary: '{ button: string; excel: string; pdf: string }' },
      },
    },
    // Appearance
    className: {
      control: 'text',
      description: i18n.t('exportButton.argType.additionalCssClasses', 'Additional CSS classes'),
      table: {
        category: 'Appearance',
        type: { summary: 'string' },
      },
    },
    // State
    disabled: {
      control: { type: 'boolean' },
      description: i18n.t(
        'exportButton.argType.whetherTheExportButtonIsDisabled',
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
        'exportButton.argType.calledWhenAnExportFormatIsSelected',
        'Called when an export format is selected'
      ),
      table: {
        category: 'Events',
        type: { summary: "(format: 'excel' | 'pdf') => void" },
      },
    },
    onClick: {
      action: 'onClick',
      description: i18n.t('exportButton.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('exportButton.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('exportButton.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('exportButton.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t(
        'exportButton.argType.mouseenterEventHandler',
        'MouseEnter event handler'
      ),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t(
        'exportButton.argType.mouseleaveEventHandler',
        'MouseLeave event handler'
      ),
      table: { category: 'Events' },
    },
    // ExportButton Props Reference:
    // - disabled: Disable the button (boolean)
    // - labels: Localization object (Labels)
    //   - button: Button text (string, default: 'Export')
    //   - excel: Excel option text (string, default: 'Excel')
    //   - pdf: PDF option text (string, default: 'PDF')
    // - onExport: Export handler ((format: 'excel' | 'pdf') => void)
    //
    // Export Formats:
    // - 'excel': Microsoft Excel format
    // - 'pdf': PDF document format
    //
    // Usage Notes:
    // - Uses DropdownMenu for format selection
    // - Two export options: Excel and PDF
    // - Handle actual export logic in onExport callback
    // - Supports i18n through labels prop
  },
  parameters: {
    msw: { handlers: exportButtonHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ExportButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const button = canvas.getByRole('button');
    await userEvent.click(button);

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');

    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    await expect(within(content).getByText('Excel')).toBeInTheDocument();
    await expect(within(content).getByText('PDF')).toBeInTheDocument();
  },
};

export const WithAction: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.withAction', 'With action (onExport)'),
  args: {
    ...(Default.args ?? {}),
    onExport: fn(),
  },
  play: async (context) => {
    await Default.play?.(context);

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    const excel = within(content).getByText('Excel');
    await userEvent.click(excel);

    await expect(context.args.onExport).toHaveBeenCalledTimes(1);
    await expect(context.args.onExport).toHaveBeenCalledWith('excel');
  },
};

export const ActionPanel: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.actionPanel', 'Action panel (storybook/actions)'),
  render: (args) => (
    <ExportButton
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

export const Disabled: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toBeDisabled();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
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
    await expect(canvas.getByRole('button')).toBeInTheDocument();
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
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  render: (args) => <I18nExportButton {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const CustomLabels: Story = {
  render: () => (
    <div className="w-[200px]">
      <ExportButton
        labels={{
          button: 'Download',
          excel: 'Excel Spreadsheet',
          pdf: 'PDF Document',
        }}
      />
    </div>
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
  name: i18n.t('exportButton.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ VARIANTS & SIZES ============

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('exportButton.story.default', 'Default')}
        </p>
        <ExportButton />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('exportButton.story.disabled', 'Disabled')}
        </p>
        <ExportButton disabled />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('exportButton.story.customLabels', 'Custom Labels')}
        </p>
        <ExportButton
          labels={{
            button: 'Download',
            excel: 'Excel Spreadsheet',
            pdf: 'PDF Document',
          }}
        />
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
          {i18n.t('exportButton.story.smallContainer', 'Small Container')}
        </p>
        <div className="w-[100px]">
          <ExportButton />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('exportButton.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[200px]">
          <ExportButton />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('exportButton.story.largeContainer', 'Large Container')}
        </p>
        <div className="w-[400px]">
          <ExportButton />
        </div>
      </div>
    </div>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  name: i18n.t('exportButton.storyName.accessibility', 'Accessibility'),
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

    // Test keyboard navigation
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(doc.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const buttons = createFakeExportButtons(3);
    return (
      <div className="flex flex-wrap gap-4">
        {buttons.map((btn) => (
          <div key={btn.id} className="w-[200px]">
            <ExportButton labels={btn.labels} disabled={btn.disabled} />
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const allButtons = canvasElement.querySelectorAll('button');
    expect(allButtons.length).toBeGreaterThanOrEqual(1);
  },
};

export const WithAsyncData: Story = {
  ...Default,
  parameters: {
    msw: { handlers: exportButtonHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ MSW + STATUS STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: exportButtonHandlers },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.emptyData', 'Empty (no data)'),
  render: () => (
    <div className="w-[200px]">
      <ExportButton disabled />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeDisabled();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('exportButton.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('exportButton.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('exportButton.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('exportButton.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('exportButton.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('exportButton.storyName.error409Conflict', 'Error 409: Conflict'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'exportButton.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('exportButton.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'exportButton.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('exportButton.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'exportButton.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('exportButton.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ SPECIAL STATE STORIES ============

export const NetworkError: Story = {
  name: i18n.t('exportButton.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ MSW EXPORT-SPECIFIC STATUS STORIES ============

export const PdfSuccess: Story = {
  name: i18n.t('exportButton.storyName.pdfSuccess', 'PDF Export Success'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.pdfSuccess },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const PdfError: Story = {
  name: i18n.t('exportButton.storyName.pdfError', 'PDF Export Error'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.pdfError },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

export const LargeDataWarning: Story = {
  name: i18n.t('exportButton.storyName.largeDataWarning', 'Large Data Warning (202)'),
  ...Default,
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.largDataWarning },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: LABELS ============

function DemoExportLabelsEn() {
  const labels = createFakeExportLabelsEn();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(labels).map(([key, value]) => (
          <span key={key} className="bg-muted rounded px-2 py-1 text-sm">
            {key}: {value}
          </span>
        ))}
      </div>
      <ExportButton labels={labels} />
    </div>
  );
}

export const LabelsEn: Story = {
  name: i18n.t('exportButton.storyName.labelsEn', 'Factory: Labels (English)'),
  render: () => <DemoExportLabelsEn />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/button:/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportLabelsJa() {
  const labels = createFakeExportLabelsJa();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(labels).map(([key, value]) => (
          <span key={key} className="bg-muted rounded px-2 py-1 text-sm">
            {key}: {value}
          </span>
        ))}
      </div>
      <ExportButton labels={labels} />
    </div>
  );
}

export const LabelsJa: Story = {
  name: i18n.t('exportButton.storyName.labelsJa', 'Factory: Labels (Japanese)'),
  render: () => <DemoExportLabelsJa />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/button:/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportLabelsRandom() {
  const labels = createFakeExportLabels();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(labels).map(([key, value]) => (
          <span key={key} className="bg-muted rounded px-2 py-1 text-sm">
            {key}: {value}
          </span>
        ))}
      </div>
      <ExportButton labels={labels} />
    </div>
  );
}

export const LabelsRandom: Story = {
  name: i18n.t('exportButton.storyName.labelsRandom', 'Factory: Labels (Random)'),
  render: () => <DemoExportLabelsRandom />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/button:/i)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: BUTTON CONFIGURATIONS ============

function DemoExportButtonSingle() {
  const btn: FakeExportButton = createFakeExportButton();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.default')}</p>
      <p className="text-xs">ID: {btn.id}</p>
      <p className="text-xs">Formats: {btn.formats.join(', ')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryButtonSingle: Story = {
  name: i18n.t('exportButton.storyName.factoryButtonSingle', 'Factory: Single Button'),
  render: () => <DemoExportButtonSingle />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/ID:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportButtonDisabled() {
  const btn = createFakeExportButtonDisabled();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.disabled')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryButtonDisabled: Story = {
  name: i18n.t('exportButton.storyName.factoryButtonDisabled', 'Factory: Disabled Button'),
  render: () => <DemoExportButtonDisabled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toBeDisabled();
  },
};

function DemoExportButtonLoading() {
  const btn = createFakeExportButtonLoading();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.story.loading')}</p>
      <p className="text-xs">Loading: {String(btn.loading)}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryButtonLoading: Story = {
  name: i18n.t('exportButton.storyName.factoryButtonLoading', 'Factory: Loading Button'),
  render: () => <DemoExportButtonLoading />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Loading: true/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportButtonStandard() {
  const btn = createFakeExportButtonStandard();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.variants')}</p>
      <p className="text-xs">Formats: {btn.formats.join(', ')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryButtonStandard: Story = {
  name: i18n.t(
    'exportButton.storyName.factoryButtonStandard',
    'Factory: Standard Button (Excel + PDF)'
  ),
  render: () => <DemoExportButtonStandard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Formats:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: SPECIFIC USE CASES ============

function DemoDataTableExportButton() {
  const btn = createFakeDataTableExportButton();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <p className="text-xs">Data Table Formats: {btn.formats.join(', ')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryDataTableButton: Story = {
  name: i18n.t('exportButton.storyName.factoryDataTableButton', 'Factory: Data Table Export'),
  render: () => <DemoDataTableExportButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Data Table Formats:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoReportExportButton() {
  const btn = createFakeReportExportButton();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <p className="text-xs">Report Formats: {btn.formats.join(', ')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryReportButton: Story = {
  name: i18n.t('exportButton.storyName.factoryReportButton', 'Factory: Report Export'),
  render: () => <DemoReportExportButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Report Formats:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoInvoiceExportButton() {
  const btn = createFakeInvoiceExportButton();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <p className="text-xs">Invoice Formats: {btn.formats.join(', ')}</p>
      <ExportButton labels={btn.labels} disabled={btn.disabled} />
    </div>
  );
}

export const FactoryInvoiceButton: Story = {
  name: i18n.t('exportButton.storyName.factoryInvoiceButton', 'Factory: Invoice Export'),
  render: () => <DemoInvoiceExportButton />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Invoice Formats:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: EXPORT RESULTS ============

function DemoExportResult() {
  const result: FakeExportResult = createFakeExportResult();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>ID: {result.id}</p>
        <p>Format: {result.format}</p>
        <p>Filename: {result.filename}</p>
        <p>Status: {result.status}</p>
        <p>Size: {result.size.toLocaleString()} bytes</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryExportResult: Story = {
  name: i18n.t('exportButton.storyName.factoryExportResult', 'Factory: Export Result'),
  render: () => <DemoExportResult />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Format:/)).toBeInTheDocument();
    await expect(canvas.getByText(/Status:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportResults() {
  const results = createFakeExportResults(3);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      {results.map((result) => (
        <div key={result.id} className="bg-muted rounded p-2 text-xs">
          <p>
            {result.filename} - {result.status} ({result.format})
          </p>
        </div>
      ))}
      <ExportButton />
    </div>
  );
}

export const FactoryExportResults: Story = {
  name: i18n.t('exportButton.storyName.factoryExportResults', 'Factory: Multiple Results'),
  render: () => <DemoExportResults />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvasElement.querySelectorAll('.bg-muted');
    await expect(items.length).toBeGreaterThanOrEqual(3);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportResultSuccess() {
  const result = createFakeExportResultSuccess('pdf');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.success')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>Status: {result.status}</p>
        <p>Format: {result.format}</p>
        <p>Download: {result.downloadUrl}</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryResultSuccess: Story = {
  name: i18n.t('exportButton.storyName.factoryResultSuccess', 'Factory: Successful Result'),
  render: () => <DemoExportResultSuccess />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Status: completed/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportResultError() {
  const result = createFakeExportResultError('excel');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.error')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>Status: {result.status}</p>
        <p>Format: {result.format}</p>
        <p>Filename: {result.filename}</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryResultError: Story = {
  name: i18n.t('exportButton.storyName.factoryResultError', 'Factory: Error Result'),
  render: () => <DemoExportResultError />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Status: error/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportResultProcessing() {
  const result = createFakeExportResultProcessing('csv');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.exporting')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>Status: {result.status}</p>
        <p>Format: {result.format}</p>
        <p>Filename: {result.filename}</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryResultProcessing: Story = {
  name: i18n.t('exportButton.storyName.factoryResultProcessing', 'Factory: Processing Result'),
  render: () => <DemoExportResultProcessing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Status: processing/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: EXPORT REQUESTS ============

function DemoExportRequest() {
  const request: FakeExportRequest = createFakeExportRequest();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>ID: {request.id}</p>
        <p>Format: {request.format}</p>
        <p>Filename: {request.filename}</p>
        <p>Headers: {String(request.includeHeaders)}</p>
        {request.columns ? <p>Columns: {request.columns.join(', ')}</p> : null}
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryExportRequest: Story = {
  name: i18n.t('exportButton.storyName.factoryExportRequest', 'Factory: Export Request'),
  render: () => <DemoExportRequest />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Format:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportRequests() {
  const requests = createFakeExportRequests(4);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      {requests.map((req) => (
        <div key={req.id} className="bg-muted rounded p-2 text-xs">
          <p>
            {req.filename} ({req.format}) - Headers: {String(req.includeHeaders)}
          </p>
        </div>
      ))}
      <ExportButton />
    </div>
  );
}

export const FactoryExportRequests: Story = {
  name: i18n.t('exportButton.storyName.factoryExportRequests', 'Factory: Multiple Requests'),
  render: () => <DemoExportRequests />,
  play: async ({ canvasElement }) => {
    const items = canvasElement.querySelectorAll('.bg-muted');
    await expect(items.length).toBeGreaterThanOrEqual(4);
  },
};

// ============ FACTORY: EXPORT PROGRESS ============

function DemoExportProgress() {
  const progress: FakeExportProgress = createFakeExportProgress();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.exporting')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>Progress: {progress.progress}%</p>
        <p>
          Rows: {progress.currentRow.toLocaleString()} / {progress.totalRows.toLocaleString()}
        </p>
        <p>Status: {progress.status}</p>
        <p>ETA: {progress.estimatedTimeRemaining}s</p>
      </div>
      <div className="bg-primary/20 h-2 w-full rounded">
        <div
          className="bg-primary h-2 rounded"
          style={{ width: `${progress.progress}%` }}
          data-testid="progress-bar"
        />
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryExportProgress: Story = {
  name: i18n.t('exportButton.storyName.factoryExportProgress', 'Factory: Export Progress'),
  render: () => <DemoExportProgress />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Progress:/)).toBeInTheDocument();
    await expect(canvas.getByTestId('progress-bar')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportProgressAt() {
  const progress25 = createFakeExportProgressAt(25);
  const progress50 = createFakeExportProgressAt(50);
  const progress75 = createFakeExportProgressAt(75);
  const progress100 = createFakeExportProgressAt(100);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      {[progress25, progress50, progress75, progress100].map((p) => (
        <div key={p.id} className="flex flex-col gap-1">
          <p className="text-xs">
            {p.progress}% - {p.status}
          </p>
          <div className="bg-primary/20 h-2 w-full rounded">
            <div
              className="bg-primary h-2 rounded"
              style={{ width: `${p.progress}%` }}
              data-testid={`progress-${p.progress}`}
            />
          </div>
        </div>
      ))}
      <ExportButton />
    </div>
  );
}

export const FactoryExportProgressAt: Story = {
  name: i18n.t(
    'exportButton.storyName.factoryExportProgressAt',
    'Factory: Progress at Percentages'
  ),
  render: () => <DemoExportProgressAt />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('progress-25')).toBeInTheDocument();
    await expect(canvas.getByTestId('progress-50')).toBeInTheDocument();
    await expect(canvas.getByTestId('progress-75')).toBeInTheDocument();
    await expect(canvas.getByTestId('progress-100')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: EXPORT HISTORY ============

function DemoExportHistoryItem() {
  const item: FakeExportHistoryItem = createFakeExportHistoryItem();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>Filename: {item.filename}</p>
        <p>Format: {item.format}</p>
        <p>Status: {item.status}</p>
        <p>Size: {item.size.toLocaleString()} bytes</p>
        <p>Downloads: {item.downloadCount}</p>
        <p>Started: {item.startedAt.toLocaleDateString()}</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryHistoryItem: Story = {
  name: i18n.t('exportButton.storyName.factoryHistoryItem', 'Factory: History Item'),
  render: () => <DemoExportHistoryItem />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Filename:/)).toBeInTheDocument();
    await expect(canvas.getByText(/Downloads:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportHistoryList() {
  const history = createFakeExportHistory(5);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      <div className="divide-y">
        {history.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2 text-xs">
            <span>{item.filename}</span>
            <span className="text-muted-foreground">
              {item.format} - {item.status}
            </span>
          </div>
        ))}
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryHistoryList: Story = {
  name: i18n.t('exportButton.storyName.factoryHistoryList', 'Factory: History List'),
  render: () => <DemoExportHistoryList />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvasElement.querySelectorAll('.divide-y > div');
    await expect(rows.length).toBe(5);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: EXPORT CONFIG ============

function DemoExportConfig() {
  const config: FakeExportConfig = createFakeExportConfig();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="bg-muted rounded p-3 text-xs">
        <p>ID: {config.id}</p>
        <p>Allowed Formats: {config.allowedFormats.join(', ')}</p>
        <p>Max File Size: {(config.maxFileSize / 1_000_000).toFixed(0)} MB</p>
        <p>Max Rows: {config.maxRows.toLocaleString()}</p>
        <p>Rate Limit: {config.rateLimitPerHour}/hour</p>
      </div>
      <ExportButton />
    </div>
  );
}

export const FactoryExportConfig: Story = {
  name: i18n.t('exportButton.storyName.factoryExportConfig', 'Factory: Export Config'),
  render: () => <DemoExportConfig />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Allowed Formats:/)).toBeInTheDocument();
    await expect(canvas.getByText(/Rate Limit:/)).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ FACTORY: SHOWCASE ============

function DemoExportButtonShowcase() {
  const showcase: FakeExportButtonShowcase = createFakeExportButtonShowcase();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.variants')}</p>

      <div>
        <p className="mb-2 text-xs font-medium">Buttons ({showcase.buttons.length})</p>
        <div className="flex flex-wrap gap-3">
          {showcase.buttons.map((btn) => (
            <ExportButton key={btn.id} labels={btn.labels} disabled={btn.disabled} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Recent Results ({showcase.results.length})</p>
        {showcase.results.map((result) => (
          <div key={result.id} className="bg-muted mb-1 rounded px-2 py-1 text-xs">
            {result.filename} - {result.status}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Export History ({showcase.history.length})</p>
        {showcase.history.map((item) => (
          <div key={item.id} className="bg-muted mb-1 rounded px-2 py-1 text-xs">
            {item.filename} ({item.format}) - {item.status}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">{i18n.t('exportButton.story.config', 'Config')}</p>
        {showcase.configs.map((cfg) => (
          <div key={cfg.id} className="bg-muted rounded px-2 py-1 text-xs">
            Formats: {cfg.allowedFormats.join(', ')} | Max Rows: {cfg.maxRows.toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FactoryShowcase: Story = {
  name: i18n.t('exportButton.storyName.factoryShowcase', 'Factory: Full Showcase'),
  render: () => <DemoExportButtonShowcase />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvasElement.querySelectorAll('button');
    await expect(buttons.length).toBeGreaterThanOrEqual(3);
    await expect(canvas.getByText(/Recent Results/)).toBeInTheDocument();
    await expect(canvas.getByText(/Export History/)).toBeInTheDocument();
  },
};

// ============ CONSTANTS: FORMATS, STATUSES, LABELS ============

function DemoExportFormats() {
  const formats: ExportFormat[] = EXPORT_FORMATS;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <div className="flex flex-wrap gap-2">
        {formats.map((format) => (
          <span key={format} className="bg-muted rounded px-3 py-1 text-sm font-medium">
            {EXPORT_FORMAT_LABELS[format]}
          </span>
        ))}
      </div>
      <ExportButton />
    </div>
  );
}

export const ConstantsFormats: Story = {
  name: i18n.t('exportButton.storyName.constantsFormats', 'Constants: Export Formats'),
  render: () => <DemoExportFormats />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('CSV')).toBeInTheDocument();
    await expect(canvas.getByText('Excel')).toBeInTheDocument();
    await expect(canvas.getByText('JSON')).toBeInTheDocument();
    await expect(canvas.getByText('PDF')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

function DemoExportStatuses() {
  const statuses: ExportStatus[] = EXPORT_STATUSES;

  const statusColors: Record<ExportStatus, string> = {
    completed: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    idle: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <span
            key={status}
            className={`rounded px-3 py-1 text-sm font-medium ${statusColors[status]}`}
          >
            {status}
          </span>
        ))}
      </div>
      <ExportButton />
    </div>
  );
}

export const ConstantsStatuses: Story = {
  name: i18n.t('exportButton.storyName.constantsStatuses', 'Constants: Export Statuses'),
  render: () => <DemoExportStatuses />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('completed')).toBeInTheDocument();
    await expect(canvas.getByText('error')).toBeInTheDocument();
    await expect(canvas.getByText('idle')).toBeInTheDocument();
    await expect(canvas.getByText('pending')).toBeInTheDocument();
    await expect(canvas.getByText('processing')).toBeInTheDocument();
  },
};

function DemoExportFormatDetails() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.formats')}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 text-left">{i18n.t('exportButton.story.format', 'Format')}</th>
            <th className="px-2 py-1 text-left">{i18n.t('exportButton.story.icon', 'Icon')}</th>
            <th className="px-2 py-1 text-left">
              {i18n.t('exportButton.story.extension', 'Extension')}
            </th>
            <th className="px-2 py-1 text-left">
              {i18n.t('exportButton.story.mimeType', 'MIME Type')}
            </th>
          </tr>
        </thead>
        <tbody>
          {EXPORT_FORMATS.map((format) => (
            <tr key={format} className="border-b">
              <td className="px-2 py-1">{EXPORT_FORMAT_LABELS[format]}</td>
              <td className="px-2 py-1">{EXPORT_FORMAT_ICONS[format]}</td>
              <td className="px-2 py-1">{EXPORT_EXTENSIONS[format]}</td>
              <td className="px-2 py-1">{EXPORT_MIME_TYPES[format]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ExportButton />
    </div>
  );
}

export const ConstantsFormatDetails: Story = {
  name: i18n.t('exportButton.storyName.constantsFormatDetails', 'Constants: Format Details Table'),
  render: () => <DemoExportFormatDetails />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('.csv')).toBeInTheDocument();
    await expect(canvas.getByText('.xlsx')).toBeInTheDocument();
    await expect(canvas.getByText('.json')).toBeInTheDocument();
    await expect(canvas.getByText('.pdf')).toBeInTheDocument();
    await expect(canvas.getByText('text/csv')).toBeInTheDocument();
  },
};

function DemoExportSizeCategories() {
  const categories: ExportSizeCategory[] = EXPORT_SIZE_CATEGORIES;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.sizes')}</p>
      <div className="flex flex-col gap-2">
        {categories.map((cat) => {
          const range = EXPORT_SIZE_RANGES[cat];
          return (
            <div
              key={cat}
              className="bg-muted flex items-center justify-between rounded px-3 py-2 text-sm"
            >
              <span className="font-medium">{cat}</span>
              <span className="text-muted-foreground text-xs">
                {(range.min / 1000).toLocaleString()} KB - {(range.max / 1000).toLocaleString()} KB
              </span>
            </div>
          );
        })}
      </div>
      <ExportButton />
    </div>
  );
}

export const ConstantsSizeCategories: Story = {
  name: i18n.t('exportButton.storyName.constantsSizeCategories', 'Constants: Size Categories'),
  render: () => <DemoExportSizeCategories />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('small')).toBeInTheDocument();
    await expect(canvas.getByText('medium')).toBeInTheDocument();
    await expect(canvas.getByText('large')).toBeInTheDocument();
    await expect(canvas.getByText('very-large')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============ TYPE GUARD: RUNTIME ASSERTIONS ============

function DemoTypeAssertions() {
  // Use types at runtime with type-safe assertions
  const format: ExportFormat = 'csv';
  const status: ExportStatus = 'completed';
  const sizeCategory: ExportSizeCategory = 'medium';
  const labels: FakeExportLabels = createFakeExportLabelsEn();
  const button: FakeExportButton = createFakeExportButton();
  const result: FakeExportResult = createFakeExportResult();
  const request: FakeExportRequest = createFakeExportRequest();
  const progress: FakeExportProgress = createFakeExportProgress();
  const historyItem: FakeExportHistoryItem = createFakeExportHistoryItem();
  const config: FakeExportConfig = createFakeExportConfig();
  const showcase: FakeExportButtonShowcase = createFakeExportButtonShowcase();

  const typeChecks = [
    { label: 'ExportFormat', value: format },
    { label: 'ExportStatus', value: status },
    { label: 'ExportSizeCategory', value: sizeCategory },
    { label: 'FakeExportLabels.button', value: labels.button },
    { label: 'FakeExportButton.id', value: button.id },
    { label: 'FakeExportResult.format', value: result.format },
    { label: 'FakeExportRequest.format', value: request.format },
    { label: 'FakeExportProgress.status', value: progress.status },
    { label: 'FakeExportHistoryItem.format', value: historyItem.format },
    { label: 'FakeExportConfig.maxRows', value: String(config.maxRows) },
    { label: 'FakeExportButtonShowcase.buttons', value: String(showcase.buttons.length) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{i18n.t('exportButton.section.states')}</p>
      <div className="flex flex-col gap-1">
        {typeChecks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs">
            <span className="rounded bg-green-100 px-1 text-green-800">OK</span>
            <span className="font-mono">{check.label}</span>
            <span className="text-muted-foreground">= {check.value}</span>
          </div>
        ))}
      </div>
      <ExportButton />
    </div>
  );
}

export const TypeAssertions: Story = {
  name: i18n.t('exportButton.storyName.typeAssertions', 'Types: Runtime Assertions'),
  render: () => <DemoTypeAssertions />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const okBadges = canvasElement.querySelectorAll('.bg-green-100');
    await expect(okBadges.length).toBe(11);
    await expect(canvas.getByText('ExportFormat')).toBeInTheDocument();
    await expect(canvas.getByText('ExportStatus')).toBeInTheDocument();
    await expect(canvas.getByText('ExportSizeCategory')).toBeInTheDocument();
    await expect(canvas.getByRole('button')).toBeInTheDocument();
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes / Handler wiring
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.getAttribute('data-slot')).toBe('export-button');
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.getAttribute('data-slot')).toBe('export-button');
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button.getAttribute('data-slot')).toBe('export-button');
    expect(button.getAttribute('data-testid')).toBeDefined();
  },
};

export const StatusSuccess: Story = {
  ...Default,
  name: i18n.t('exportButton.storyName.statusSuccess', 'Handler: Success'),
  parameters: {
    msw: { handlers: exportButtonStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.getAttribute('data-slot')).toBe('export-button');
  },
};
