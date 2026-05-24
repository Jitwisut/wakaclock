import type { Meta, StoryObj } from '@storybook/react';

import { fn as _fn, expect } from 'storybook/test';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

function Introduction() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <div className="text-2xl font-semibold">
          {t('introduction.story.componentLibraryStorybook', 'Component Library Storybook')}
        </div>
        <div className="text-muted-foreground">
          {t(
            'introduction.story.productionGradeDocs',
            'Production-grade docs, a11y checks, and state coverage.'
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t('introduction.story.tooling', 'Tooling')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{t('introduction.story.autodocs', 'Autodocs')}</Badge>
            <Badge variant="outline">{t('introduction.story.a11y', 'A11y')}</Badge>
            <Badge variant="outline">
              {t('introduction.story.nextjsAppRouterMocks', 'Next.js App Router mocks')}
            </Badge>
            <Badge variant="outline">
              {t(
                'introduction.story.nextThemesActiveThemeProvider',
                'next-themes + ActiveThemeProvider'
              )}
            </Badge>
          </div>
          <Separator />
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>
              {t('introduction.story.useToolbarToSwitch', 'Use the toolbar to switch')}{' '}
              <span className="font-medium">{t('introduction.story.theme', 'theme')}</span>,{' '}
              <span className="font-medium">{t('introduction.story.preset', 'preset')}</span>,{' '}
              <span className="font-medium">{t('introduction.story.radius', 'radius')}</span>,{' '}
              <span className="font-medium">{t('introduction.story.scale', 'scale')}</span>,{' '}
              {t('introduction.story.and', 'and')}{' '}
              <span className="font-medium">
                {t('introduction.story.contentLayout', 'content layout')}
              </span>
              .
            </li>
            <li>
              {t('introduction.story.useThe', 'Use the')}{' '}
              <span className="font-medium">
                {t('introduction.story.accessibility', 'Accessibility')}
              </span>{' '}
              {t(
                'introduction.story.panelToCatchViolationsEarly',
                'panel to catch violations early.'
              )}
            </li>
            <li>
              {t('introduction.story.storiesShouldCover', 'Stories should cover:')}{' '}
              <span className="font-medium">{t('introduction.story.default', 'default')}</span>,{' '}
              <span className="font-medium">{t('introduction.story.variants', 'variants')}</span>,{' '}
              <span className="font-medium">{t('introduction.story.disabled', 'disabled')}</span>,{' '}
              {t(
                'introduction.story.andKeyInteractionStates',
                'and key interaction states (open/closed, loading, error, empty).'
              )}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const meta = {
  title: 'Documentation/Introduction',
  component: Introduction,
  tags: ['autodocs'],
  args: {},
  argTypes: {},
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
} satisfies Meta<typeof Introduction>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  play: async ({ canvasElement }) => {
    // Basic existence check for documentation page
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('.text-2xl')).toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...Overview,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('.text-2xl')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('.space-y-6').length).toBeGreaterThan(0);
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
    expect(canvasElement.querySelectorAll('li').length).toBeGreaterThan(0);
  },
  tags: ['!test'],
};

export const Accessibility: Story = {
  ...Overview,
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('.text-2xl')).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('[data-slot="badge"]').length).toBeGreaterThan(0);
  },
};

export const DarkRTL: Story = {
  ...Overview,
  name: i18n.t('introduction.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Overview,
  name: i18n.t('introduction.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Overview.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Overview,
  name: i18n.t('introduction.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Overview,
  name: i18n.t('introduction.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
