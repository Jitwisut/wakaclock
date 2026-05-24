import type { Meta, StoryObj } from '@storybook/react';

import React from 'react';

import { http, HttpResponse } from 'msw';
import { action } from 'storybook/actions';
import { fn as _fn, expect, userEvent, within } from 'storybook/test';

import { Button } from '@/components/ui/button';

import i18n from 'i18next';

function AddonsShowcase({
  label = i18n.t('addonsShowcase.story.clickMe', 'Click me'),
}: {
  label?: string;
}) {
  const [count, setCount] = React.useState(0);
  const [health, setHealth] = React.useState<'loading' | 'ok' | 'error'>('loading');

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch('/__msw/health');
        if (!res.ok) {
          throw new Error(
            i18n.t('test.httpStatusError', 'HTTP {{status}}', { status: res.status })
          );
        }
        const data = (await res.json()) as { ok?: boolean };
        if (!cancelled) setHealth(data.ok ? 'ok' : 'error');
      } catch {
        if (!cancelled) setHealth('error');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground text-sm">:</div>

      <div className="text-sm">
        MSW fetch <code>/__msw/health</code>: <span data-testid="health">{health}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            action('clicked')(count + 1);
            console.info('clicked', { count: count + 1 });
          }}
        >
          {label}
        </Button>

        <div className="text-sm">
          Count: <span data-testid="count">{count}</span>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Documentation/Addons Showcase',
  component: AddonsShowcase,
  tags: ['autodocs'],
  parameters: {
    msw: {
      handlers: [http.get('/__msw/health', () => HttpResponse.json({ ok: true }))],
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  args: {
    label: i18n.t('addonsShowcase.story.clickMe', 'Click me'),
  },
  argTypes: {
    label: {
      control: 'text',
      description: i18n.t('addonsShowcase.argType.buttonLabelText', 'Button label text'),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Click me' },
      },
    },
  },
} satisfies Meta<typeof AddonsShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="count"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="health"]')).toBeInTheDocument();
  },
};

export const InteractionTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });

    await userEvent.click(button);
    await expect(canvas.getByTestId('count')).toHaveTextContent('1');
  },
};

export const ErrorState: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/__msw/health', () => HttpResponse.json({ ok: false }, { status: 500 })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-testid="health"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Playground,
  globals: {
    ...(Playground.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelectorAll('button').length).toBeGreaterThan(0);
  },
  tags: ['!test'],
};

export const Dark: Story = {
  ...Playground,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="count"]')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Playground,
  globals: { addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="health"]')).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="count"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="health"]')).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Playground,
  name: i18n.t('addonsShowcase.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Playground.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Playground,
  name: i18n.t('addonsShowcase.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Playground.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Playground,
  name: i18n.t('addonsShowcase.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Playground,
  name: i18n.t('addonsShowcase.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
