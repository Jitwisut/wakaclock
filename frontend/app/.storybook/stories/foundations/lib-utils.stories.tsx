import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { cn, generateAvatarFallback, getInitials } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Demo component showcasing cn utility
function CnDemo() {
  const { t } = useTranslation();
  return (
    <Card className="w-[500px]" data-testid="cn-demo">
      <CardHeader>
        <CardTitle>{t('libUtils.story.cnClassNameUtility', 'cn() - Class Name Utility')}</CardTitle>
        <CardDescription>
          {t(
            'libUtils.story.combinesClsxAndTailwindMerge',
            'Combines clsx and tailwind-merge for intelligent class merging'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="text-sm font-medium">{t('libUtils.story.examples', 'Examples:')}</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">{t('libUtils.story.input', 'Input')}</th>
                <th className="py-2 text-left">{t('libUtils.story.output', 'Output')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">cn('px-2', 'px-4')</td>
                <td className="py-2 font-mono text-xs" data-testid="cn-result-1">
                  {cn('px-2', 'px-4')}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">cn('text-red-500', 'text-blue-500')</td>
                <td className="py-2 font-mono text-xs" data-testid="cn-result-2">
                  {cn('text-red-500', 'text-blue-500')}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">{"cn('flex', {hidden: true})"}</td>
                <td className="py-2 font-mono text-xs" data-testid="cn-result-3">
                  {cn('flex', { hidden: true })}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-mono text-xs">{"cn('flex', {hidden: false})"}</td>
                <td className="py-2 font-mono text-xs" data-testid="cn-result-4">
                  {cn('flex', { hidden: false })}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-xs">cn('p-4', null, undefined, 'mt-2')</td>
                <td className="py-2 font-mono text-xs" data-testid="cn-result-5">
                  {cn('p-4', null, undefined, 'mt-2')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { cn } from '@/lib/utils';

// Usage in components
<div className={cn(
  'base-class',
  variant === 'primary' && 'bg-primary',
  className // allows override
)} />`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing generateAvatarFallback
function AvatarFallbackDemo() {
  const examples = ['John Doe', 'Alice', 'Bob Smith Jr', 'Mary Jane Watson', '', '   ', 'Single'];

  return (
    <Card className="w-[500px]" data-testid="avatar-fallback-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('libUtils.story.generateAvatarFallback', 'generateAvatarFallback()')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'libUtils.story.generatesInitialsFromAFullName',
            'Generates initials from a full name for avatar fallbacks'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {examples.map((name) => (
            <div key={name || 'empty'} className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback data-testid={`avatar-${name || 'empty'}`}>
                  {generateAvatarFallback(name) || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{name || '(empty)'}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  → "{generateAvatarFallback(name)}"
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing getInitials
function GetInitialsDemo() {
  const examples = [
    'John Doe',
    'Alice',
    'Bob Smith Jr',
    'Mary Jane Watson Parker',
    '',
    '   Multiple   Spaces   Here   ',
    'Single',
  ];

  return (
    <Card className="w-[500px]" data-testid="get-initials-demo">
      <CardHeader>
        <CardTitle>{i18n.t('libUtils.story.getInitials', 'getInitials()')}</CardTitle>
        <CardDescription>
          {i18n.t(
            'libUtils.story.getsFirstAndLastInitialsFromAFullName',
            'Gets first and last initials from a full name'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">{i18n.t('libUtils.story.input', 'Input')}</th>
              <th className="py-2 text-left">{i18n.t('libUtils.story.output', 'Output')}</th>
            </tr>
          </thead>
          <tbody>
            {examples.map((name) => (
              <tr key={name || 'empty'} className="border-b last:border-0">
                <td className="py-2 font-mono text-xs">"{name}"</td>
                <td className="py-2">
                  <Badge variant="secondary" data-testid={`initials-${name || 'empty'}`}>
                    {getInitials(name) || '(empty)'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bg-muted/50 rounded-lg p-3 text-xs">
          <p className="mb-2 font-medium">
            {i18n.t(
              'libUtils.story.differenceFromGenerateavatarfallback',
              'Difference from generateAvatarFallback:'
            )}
          </p>
          <ul className="text-muted-foreground list-inside list-disc space-y-1">
            <li>
              {i18n.t(
                'libUtils.story.getInitialsReturnsFirstLast',
                'getInitials returns only first + last initials (max 2)'
              )}
            </li>
            <li>
              {i18n.t(
                'libUtils.story.generateAvatarFallbackReturnsAll',
                'generateAvatarFallback returns ALL initials'
              )}
            </li>
            <li>
              {i18n.t(
                'libUtils.story.comparisonExample',
                '"John Doe Smith" → getInitials: "JS", generateAvatarFallback: "JDS"'
              )}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined demo
function UtilsDemo() {
  return (
    <div className="space-y-6">
      <CnDemo />
      <AvatarFallbackDemo />
      <GetInitialsDemo />
    </div>
  );
}

// Wrapper for meta
function LibUtilsWrapper() {
  return <CnDemo />;
}

const meta = {
  title: 'Foundations/Lib Utils',
  component: LibUtilsWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/utils.ts

Core utility functions used throughout the application.

### cn() - Class Name Utility

Combines \`clsx\` and \`tailwind-merge\` for intelligent class name merging.

\`\`\`tsx
import { cn } from '@/lib/utils';

// Merges and deduplicates Tailwind classes
cn('px-2 py-1', 'px-4'); // → 'py-1 px-4'

// Conditional classes
cn('flex', isHidden && 'hidden');

// Object syntax
cn('base', { 'active': isActive, 'disabled': isDisabled });
\`\`\`

### generateAvatarFallback()

Generates ALL initials from a name string.

\`\`\`tsx
generateAvatarFallback('John Doe Smith'); // → 'JDS'
\`\`\`

### getInitials()

Gets first and last initials only (max 2 characters).

\`\`\`tsx
getInitials('John Doe Smith'); // → 'JS'
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LibUtilsWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <CnDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify cn demo is rendered
    expect(canvas.getByTestId('cn-demo')).toBeInTheDocument();

    // Verify cn results
    expect(canvas.getByTestId('cn-result-1')).toHaveTextContent('px-4');
    expect(canvas.getByTestId('cn-result-2')).toHaveTextContent('text-blue-500');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CnUtility: Story = {
  render: () => <CnDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('cn-demo')).toBeInTheDocument();

    // Verify tailwind-merge behavior (last class wins)
    expect(canvas.getByTestId('cn-result-1')).toHaveTextContent('px-4');
    expect(canvas.getByTestId('cn-result-2')).toHaveTextContent('text-blue-500');

    // Verify conditional classes
    expect(canvas.getByTestId('cn-result-3')).toHaveTextContent('hidden');
    expect(canvas.getByTestId('cn-result-4')).toHaveTextContent('flex');

    // Verify null/undefined handling
    expect(canvas.getByTestId('cn-result-5')).toHaveTextContent('p-4 mt-2');
  },
};

export const AvatarFallbackUtility: Story = {
  render: () => <AvatarFallbackDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('avatar-fallback-demo')).toBeInTheDocument();

    // Verify John Doe → JD
    expect(canvas.getByTestId('avatar-0')).toHaveTextContent('JD');

    // Verify single name
    expect(canvas.getByTestId('avatar-1')).toHaveTextContent('A');
  },
};

export const GetInitialsUtility: Story = {
  render: () => <GetInitialsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('get-initials-demo')).toBeInTheDocument();

    // Verify first + last initials
    expect(canvas.getByTestId('initials-0')).toHaveTextContent('JD');

    // Verify single name
    expect(canvas.getByTestId('initials-1')).toHaveTextContent('A');

    // Verify multi-word name (first + last only)
    expect(canvas.getByTestId('initials-2')).toHaveTextContent('BJ');
  },
};

export const AllUtilities: Story = {
  render: () => <UtilsDemo />,
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
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('libUtils.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify semantic structure
    expect(canvas.getByTestId('cn-demo')).toBeInTheDocument();

    // Verify table structure for examples
    const tables = canvasElement.querySelectorAll('table');
    expect(tables.length).not.toBe(0);
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('libUtils.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('libUtils.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('libUtils.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('libUtils.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
