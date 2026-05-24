import type { Meta, StoryObj } from '@storybook/react';

import { useTheme } from 'next-themes';
import { fn as _fn, expect } from 'storybook/test';

import { useThemeConfig } from '@/components/active-theme';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

function ThemeSnapshot() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { theme: themeConfig } = useThemeConfig();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>{t('theming.story.themingSnapshot', 'Theming snapshot')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">mode: {theme}</Badge>
          <Badge variant="outline">preset: {themeConfig.preset}</Badge>
          <Badge variant="outline">radius: {themeConfig.radius}</Badge>
          <Badge variant="outline">scale: {themeConfig.scale}</Badge>
          <Badge variant="outline">layout: {themeConfig.contentLayout}</Badge>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="bg-background text-foreground rounded-md border p-3 text-sm">
            background
          </div>
          <div className="bg-card text-card-foreground rounded-md border p-3 text-sm">card</div>
          <div className="bg-popover text-popover-foreground rounded-md border p-3 text-sm">
            popover
          </div>
          <div className="bg-primary text-primary-foreground rounded-md border p-3 text-sm">
            primary
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const meta = {
  title: 'Foundations/Theming',
  component: ThemeSnapshot,
  tags: ['autodocs'],
  args: {},
  argTypes: {},
  parameters: {
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
} satisfies Meta<typeof ThemeSnapshot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    // Basic existence check for theming page
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('[class*="Card"]')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Overview,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="badge"]').length).toBeGreaterThan(0);
  },
};

export const RTL: Story = {
  ...Overview,
  globals: { addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="card"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Overview,
  globals: { locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('.grid').length).toBeGreaterThan(0);
  },
  tags: ['!test'],
};

export const Accessibility: Story = {
  ...Overview,
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="badge"]').length).toBeGreaterThanOrEqual(4);
    expect(canvasElement.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Overview,
  name: i18n.t('theming.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Overview,
  name: i18n.t('theming.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Overview,
  name: i18n.t('theming.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Overview,
  name: i18n.t('theming.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
