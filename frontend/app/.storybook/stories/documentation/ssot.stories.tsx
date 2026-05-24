import type { Meta, StoryObj } from '@storybook/react';

import { fn as _fn, expect } from 'storybook/test';

import {
  FILEMAP_META_PARAMETERS,
  STORYBOOK_BACKGROUND_VALUES,
  STORYBOOK_BRAND,
  STORYBOOK_GLOBAL_TYPES,
  STORYBOOK_MANAGER_SIDEBAR,
  STORYBOOK_MANAGER_TOOLBAR,
  STORYBOOK_PREVIEW_INITIAL_GLOBALS,
  STORYBOOK_PREVIEW_PARAMETERS,
  STORYBOOK_STORY_SORT_ORDER,
  STORYBOOK_VIEWPORT_OPTIONS,
} from '@/.storybook/ssot';

import i18n from 'i18next';

const meta = {
  title: 'Documentation/SSOT',
  tags: ['autodocs'],
  args: {},
  argTypes: {},
  parameters: {
    controls: { disable: true },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function formatJson(value: unknown) {
  const placeholder = '__STORYBOOK_SSOT_UNDEFINED__';
  return JSON.stringify(
    value,
    (_key, next) => (next === undefined ? placeholder : next),
    2
  ).replaceAll(new RegExp(`\"${placeholder}\"`, 'g'), 'undefined');
}

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    // Basic existence check for documentation page
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('h2')).toBeInTheDocument();
  },
  render: (_args, context) => {
    const globalTypes = Object.entries(STORYBOOK_GLOBAL_TYPES).map(([key, value]) => {
      const typed = value as {
        defaultValue?: unknown;
        description?: unknown;
        toolbar?: {
          dynamicTitle?: unknown;
          icon?: unknown;
          items?: unknown;
          title?: unknown;
        };
      };

      return {
        key,
        description: typed.description,
        defaultValue: typed.defaultValue,
        toolbar: typed.toolbar
          ? {
              title: typed.toolbar.title,
              icon: typed.toolbar.icon,
              dynamicTitle: typed.toolbar.dynamicTitle,
              items: typed.toolbar.items,
            }
          : undefined,
      };
    });

    const effectiveParameters = {
      a11y: context.parameters.a11y,
      backgrounds: context.parameters.backgrounds,
      docs: context.parameters.docs,
      layout: context.parameters.layout,
      mockingDate: context.parameters.mockingDate,
      nextjs: context.parameters.nextjs,
      viewport: context.parameters.viewport,
    };

    const ssotDefaults = {
      brand: STORYBOOK_BRAND,
      storySortOrder: STORYBOOK_STORY_SORT_ORDER,
      manager: {
        sidebar: STORYBOOK_MANAGER_SIDEBAR,
        toolbar: STORYBOOK_MANAGER_TOOLBAR,
      },
      initialGlobals: STORYBOOK_PREVIEW_INITIAL_GLOBALS,
      parameters: {
        a11y: STORYBOOK_PREVIEW_PARAMETERS.a11y,
        backgrounds: STORYBOOK_PREVIEW_PARAMETERS.backgrounds,
        docs: STORYBOOK_PREVIEW_PARAMETERS.docs,
        layout: STORYBOOK_PREVIEW_PARAMETERS.layout,
        mockingDate: STORYBOOK_PREVIEW_PARAMETERS.mockingDate,
        nextjs: STORYBOOK_PREVIEW_PARAMETERS.nextjs,
        viewport: {
          options: STORYBOOK_VIEWPORT_OPTIONS,
        },
      },
      globalTypes,
      filemapOverrides: FILEMAP_META_PARAMETERS,
    };

    return (
      <div className="w-full max-w-3xl space-y-8 text-sm">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">
            {i18n.t('ssot.story.ssotDefaults', 'SSOT Defaults')}
          </h2>
          <p className="text-muted-foreground">
            This page renders the constants from <code>.storybook/ssot.ts</code> and the effective
            Storybook <code>globals</code>/<code>parameters</code> for this story.
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold">
            {i18n.t('ssot.story.runtimeGlobals', 'Runtime Globals')}
          </h3>
          <pre className="bg-muted/40 overflow-auto rounded-md border p-3 text-xs">
            {formatJson(context.globals)}
          </pre>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">
            {i18n.t('ssot.story.runtimeParametersEffective', 'Runtime Parameters (effective)')}
          </h3>
          <pre className="bg-muted/40 overflow-auto rounded-md border p-3 text-xs">
            {formatJson(effectiveParameters)}
          </pre>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{i18n.t('ssot.story.ssotConstants', 'SSOT Constants')}</h3>
          <pre className="bg-muted/40 overflow-auto rounded-md border p-3 text-xs">
            {formatJson(ssotDefaults)}
          </pre>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{i18n.t('ssot.story.quickLinks', 'Quick Links')}</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Backgrounds: {STORYBOOK_BACKGROUND_VALUES.map((item) => item.name).join(', ')}</li>
            <li>
              Viewports: {Object.keys(STORYBOOK_VIEWPORT_OPTIONS).length} options (open the Viewport
              tool in the toolbar)
            </li>
          </ul>
        </section>
      </div>
    );
  },
};

export const Dark: Story = {
  ...Overview,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('h2')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('pre').length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Overview,
  globals: { addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('section').length).toBeGreaterThan(0);
  },
};

export const Japanese: Story = {
  ...Overview,
  globals: { locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('.space-y-8')).toBeInTheDocument();
  },
  tags: ['!test'],
};

export const Accessibility: Story = {
  ...Overview,
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('h2')).toBeInTheDocument();
    expect(canvasElement.querySelector('h3')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('pre').length).toBeGreaterThanOrEqual(3);
  },
};

export const DarkRTL: Story = {
  ...Overview,
  name: i18n.t('ssot.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Overview,
  name: i18n.t('ssot.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Overview,
  name: i18n.t('ssot.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Overview,
  name: i18n.t('ssot.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
