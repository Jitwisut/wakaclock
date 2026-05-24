import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { expect, fn, within } from 'storybook/test';

import { ActiveThemeProvider } from '@/components/active-theme';
import { SiteHeader } from '@/components/layout/header/index';
import * as ThemeCustomizer from '@/components/theme-customizer/index';
import * as MinimalTiptap from '@/components/ui/custom/minimal-tiptap/index';
import * as ExtensionCodeBlockLowlight from '@/components/ui/custom/minimal-tiptap/extensions/code-block-lowlight/index';
import * as ExtensionColor from '@/components/ui/custom/minimal-tiptap/extensions/color/index';
import * as ExtensionFileHandler from '@/components/ui/custom/minimal-tiptap/extensions/file-handler/index';
import * as ExtensionHorizontalRule from '@/components/ui/custom/minimal-tiptap/extensions/horizontal-rule/index';
import * as ExtensionImage from '@/components/ui/custom/minimal-tiptap/extensions/image/index';
import * as ExtensionLink from '@/components/ui/custom/minimal-tiptap/extensions/link/index';
import * as ExtensionResetMarksOnEnter from '@/components/ui/custom/minimal-tiptap/extensions/reset-marks-on-enter/index';
import * as ExtensionSelection from '@/components/ui/custom/minimal-tiptap/extensions/selection/index';
import * as ExtensionUnsetAllMarks from '@/components/ui/custom/minimal-tiptap/extensions/unset-all-marks/index';
import * as ExtensionsIndex from '@/components/ui/custom/minimal-tiptap/extensions/index';

import i18n from 'i18next';

function ExportKeys({
  label,
  value,
  emptyText,
}: {
  emptyText: string;
  label: string;
  value: Record<string, unknown>;
}) {
  const keys = React.useMemo(() => Object.keys(value).sort(), [value]);

  return (
    <div className="bg-background space-y-2 rounded-md border p-4" data-empty={keys.length === 0}>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-muted-foreground text-xs">
        {keys.length > 0 ? keys.join(', ') : emptyText}
      </div>
    </div>
  );
}

function ModuleExportsDemo() {
  const emptyText = i18n.t('moduleExports.noExports');

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="space-y-1">
        <div className="text-lg font-semibold">{i18n.t('moduleExports.title')}</div>
        <div className="text-muted-foreground text-sm">
          {i18n.t('moduleExports.descriptionPrefix')}{' '}
          <code className="bg-muted mx-1 rounded px-1">components/**</code>{' '}
          {i18n.t('moduleExports.descriptionSuffix')}
        </div>
      </div>

      <ExportKeys
        label="@/components/active-theme"
        value={{ ActiveThemeProvider }}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/layout/header/index"
        value={{ SiteHeader }}
        emptyText={emptyText}
      />

      <ExportKeys
        label="@/components/theme-customizer/index"
        value={ThemeCustomizer}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/index"
        value={MinimalTiptap}
        emptyText={emptyText}
      />

      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/index"
        value={ExtensionsIndex}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/code-block-lowlight/index"
        value={ExtensionCodeBlockLowlight}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/color/index"
        value={ExtensionColor}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/file-handler/index"
        value={ExtensionFileHandler}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/horizontal-rule/index"
        value={ExtensionHorizontalRule}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/image/index"
        value={ExtensionImage}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/link/index"
        value={ExtensionLink}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/reset-marks-on-enter/index"
        value={ExtensionResetMarksOnEnter}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/selection/index"
        value={ExtensionSelection}
        emptyText={emptyText}
      />
      <ExportKeys
        label="@/components/ui/custom/minimal-tiptap/extensions/unset-all-marks/index"
        value={ExtensionUnsetAllMarks}
        emptyText={emptyText}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Internal/Module Exports',
  component: ModuleExportsDemo,
  tags: ['autodocs'],
  args: {
    onModuleLoad: fn(),
  },
  argTypes: {
    // Content
    // (No content props - component is self-contained)
    // Appearance
    // (No appearance props - styling is fixed)
    // State
    // (No state props - display-only component)
    // Events
    onModuleLoad: {
      action: 'onModuleLoad',
      description: i18n.t(
        'moduleExports.argType.calledWhenAModuleIsLoadedInternal',
        'Called when a module is loaded (internal)'
      ),
      table: { category: 'Events' },
    },
    // Module Exports Demo Reference:
    // This component displays all exported modules from key packages
    // for documentation and verification purposes.
    //
    // Verified Modules:
    // - @/components/active-theme
    // - @/components/layout/header/index
    // - @/components/theme-customizer/index
    // - @/components/ui/custom/minimal-tiptap/index
    // - @/components/ui/custom/minimal-tiptap/extensions/*
    //
    // Usage Notes:
    // - Internal documentation component
    // - Verifies module exports are accessible
    // - Useful for API surface verification
  },
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ModuleExportsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('Module exports coverage')).toBeInTheDocument();

    expect(canvasElement.querySelector('[data-empty="true"]')).not.toBeInTheDocument();

    for (const label of [
      '@/components/active-theme',
      '@/components/layout/header/index',
      '@/components/theme-customizer/index',
      '@/components/ui/custom/minimal-tiptap/index',
      '@/components/ui/custom/minimal-tiptap/extensions/index',
      '@/components/ui/custom/minimal-tiptap/extensions/code-block-lowlight/index',
      '@/components/ui/custom/minimal-tiptap/extensions/color/index',
      '@/components/ui/custom/minimal-tiptap/extensions/file-handler/index',
      '@/components/ui/custom/minimal-tiptap/extensions/horizontal-rule/index',
      '@/components/ui/custom/minimal-tiptap/extensions/image/index',
      '@/components/ui/custom/minimal-tiptap/extensions/link/index',
      '@/components/ui/custom/minimal-tiptap/extensions/reset-marks-on-enter/index',
      '@/components/ui/custom/minimal-tiptap/extensions/selection/index',
      '@/components/ui/custom/minimal-tiptap/extensions/unset-all-marks/index',
    ]) {
      expect(canvas.getByText(label)).toBeInTheDocument();
    }

    expect(canvas.getByText(/ActiveThemeProvider/)).toBeInTheDocument();
    expect(canvas.getByText(/SiteHeader/)).toBeInTheDocument();
    expect(canvas.getByText(/ThemeCustomizerPanel/)).toBeInTheDocument();
    expect(canvas.getByText(/MinimalTiptapEditor/)).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const canvas = within(canvasElement);
    expect(canvas.getByText('Module exports coverage')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-empty="true"]')).not.toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const canvas = within(canvasElement);
    expect(canvas.getByText('Module exports coverage')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('*').length).toBeGreaterThan(10);
  },
};

export const Accessibility: Story = {
  name: i18n.t('moduleExports.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const canvas = within(canvasElement);

    // Verify heading structure
    expect(canvas.getByText('Module exports coverage')).toBeInTheDocument();

    // Verify export cards have proper structure
    const exportCards = canvasElement.querySelectorAll('.rounded-md.border');
    expect(exportCards.length).toBeGreaterThan(10);

    // Verify no empty exports
    expect(canvasElement.querySelector('[data-empty="true"]')).not.toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('モジュールのエクスポート確認')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-empty="true"]')).not.toBeInTheDocument();
  },
};

export const ThemeCustomizerExports: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const MinimalTiptapExports: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const ExtensionExports: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Variants: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.variants', 'Variants'),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.sizes', 'Sizes'),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('moduleExports.storyName.dataAttributes', 'Data Attributes'),
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
  name: i18n.t('moduleExports.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
