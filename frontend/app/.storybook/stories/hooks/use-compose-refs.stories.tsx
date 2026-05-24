import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import { useCallback, useRef, useState } from 'react';

import { composeRefs, useComposedRefs } from '@/lib/compose-refs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// Seed faker for deterministic tests
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

seedFaker();

// Demo component showcasing composeRefs function
function ComposeRefsDemo() {
  const { t } = useTranslation();
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const [callbackCalled, setCallbackCalled] = useState(false);

  const callbackRef = useCallback((node: HTMLInputElement | null) => {
    if (node) setCallbackCalled(true);
  }, []);

  const composedRef = composeRefs(ref1, ref2, callbackRef);

  const focusInput = () => {
    ref1.current?.focus();
  };

  const getRef2Value = () => ref2.current?.value ?? '';

  return (
    <Card className="w-[500px]" data-testid="compose-refs-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('useComposeRefs.story.composeRefsFunction', 'composeRefs() Function')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'useComposeRefs.story.composesMultipleRefsIntoASingleCallbackR',
            'Composes multiple refs into a single callback ref'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium">
              {i18n.t('useComposeRefs.story.inputWith3ComposedRefs', 'Input with 3 composed refs:')}
            </p>
            <Input
              ref={composedRef}
              placeholder={i18n.t('useComposeRefs.story.typeSomething', 'Type something...')}
              data-testid="composed-input"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={focusInput} size="sm" variant="outline">
              {i18n.t('useComposeRefs.story.focusViaRef1', 'Focus via ref1')}
            </Button>
            <Button
              onClick={() => {
                // eslint-disable-next-line no-alert
                globalThis.alert(`ref2 value: ${getRef2Value()}`);
              }}
              size="sm"
              variant="outline"
            >
              {i18n.t('useComposeRefs.story.getValueViaRef2', 'Get value via ref2')}
            </Button>
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.ref1Assigned', 'ref1 assigned:')}
              </span>
              <Badge variant={ref1.current ? 'default' : 'secondary'} data-testid="ref1-status">
                {ref1.current
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.ref2Assigned', 'ref2 assigned:')}
              </span>
              <Badge variant={ref2.current ? 'default' : 'secondary'} data-testid="ref2-status">
                {ref2.current
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.callbackRefCalled', 'callbackRef called:')}
              </span>
              <Badge
                variant={callbackCalled ? 'default' : 'secondary'}
                data-testid="callback-status"
              >
                {callbackCalled
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { composeRefs } from '@/lib/compose-refs';

const ref1 = useRef<HTMLElement>(null);
const ref2 = useRef<HTMLElement>(null);
const callbackRef = (node) => console.log(node);

// Compose all refs into one
const composedRef = composeRefs(ref1, ref2, callbackRef);

<div ref={composedRef} />`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo component showcasing useComposedRefs hook
function UseComposedRefsDemo() {
  const { t } = useTranslation();
  const localRef = useRef<HTMLDivElement>(null);
  const forwardedRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const rect = node.getBoundingClientRect();
      setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
    }
  }, []);

  // Use the hook to compose refs
  const composedRef = useComposedRefs(localRef, forwardedRef, measureRef);

  return (
    <Card className="w-[500px]" data-testid="use-composed-refs-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t('useComposeRefs.story.useComposedRefsHook', 'useComposedRefs() Hook')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'useComposeRefs.story.reactHookMemoizesComposedRefs',
            'React hook that memoizes composed refs for optimal performance'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-medium">
              {i18n.t('useComposeRefs.story.divWith3ComposedRefs', 'Div with 3 composed refs:')}
            </p>
            <div
              ref={composedRef}
              className="bg-primary/10 border-primary/20 rounded-lg border p-4 text-center"
              data-testid="composed-div"
            >
              <p className="text-sm">
                {i18n.t(
                  'useComposeRefs.story.thisDivHasMultipleRefsAttached',
                  'This div has multiple refs attached'
                )}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Width: {dimensions.width}px, Height: {dimensions.height}px
              </p>
            </div>
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.localRefAssigned', 'localRef assigned:')}
              </span>
              <Badge
                variant={localRef.current ? 'default' : 'secondary'}
                data-testid="local-ref-status"
              >
                {localRef.current
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.forwardedRefAssigned', 'forwardedRef assigned:')}
              </span>
              <Badge
                variant={forwardedRef.current ? 'default' : 'secondary'}
                data-testid="forwarded-ref-status"
              >
                {forwardedRef.current
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {i18n.t('useComposeRefs.story.measureRefCaptured', 'measureRef captured:')}
              </span>
              <Badge
                variant={dimensions.width > 0 ? 'default' : 'secondary'}
                data-testid="measure-ref-status"
              >
                {dimensions.width > 0
                  ? t('useComposeRefs.story.yes', 'Yes')
                  : t('useComposeRefs.story.no', 'No')}
              </Badge>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`import { useComposedRefs } from '@/lib/compose-refs';

const localRef = useRef<HTMLDivElement>(null);
const forwardedRef = useRef<HTMLDivElement>(null);
const measureRef = useCallback((node) => {
  if (node) measureDimensions(node);
}, []);

// Hook memoizes the composed ref
const composedRef = useComposedRefs(
  localRef,
  forwardedRef,
  measureRef
);

<div ref={composedRef} />`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo comparing function vs hook
function ComparisonDemo() {
  return (
    <Card className="w-[500px]" data-testid="comparison-demo">
      <CardHeader>
        <CardTitle>
          {i18n.t(
            'useComposeRefs.story.composeRefsVsUseComposedRefs',
            'composeRefs vs useComposedRefs'
          )}
        </CardTitle>
        <CardDescription>
          {i18n.t('useComposeRefs.story.whenToUseEachApi', 'When to use each API')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="mb-2 text-sm font-medium">
              {i18n.t('useComposeRefs.story.composeRefsFunctionLabel', 'composeRefs() - Function')}
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
              <li>
                {i18n.t(
                  'useComposeRefs.story.createsANewCallbackRefEachCall',
                  'Creates a new callback ref each call'
                )}
              </li>
              <li>
                {i18n.t(
                  'useComposeRefs.story.useInEventHandlersOrOutsideRender',
                  'Use in event handlers or outside render'
                )}
              </li>
              <li>
                {i18n.t(
                  'useComposeRefs.story.supportsReact19Cleanup',
                  'Supports React 19 cleanup functions'
                )}
              </li>
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-3">
            <p className="mb-2 text-sm font-medium">
              {i18n.t('useComposeRefs.story.useComposedRefsHookLabel', 'useComposedRefs() - Hook')}
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
              <li>
                {i18n.t(
                  'useComposeRefs.story.memoizesTheComposedRefWithUsecallback',
                  'Memoizes the composed ref with useCallback'
                )}
              </li>
              <li>
                {i18n.t(
                  'useComposeRefs.story.useInComponentRenderForOptimalPerformanc',
                  'Use in component render for optimal performance'
                )}
              </li>
              <li>
                {i18n.t(
                  'useComposeRefs.story.reComposesOnlyWhenRefsChange',
                  'Re-composes only when refs change'
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="overflow-x-auto text-xs">
            {`// In component render - use the hook
function MyComponent({ forwardedRef }) {
  const localRef = useRef(null);
  const ref = useComposedRefs(localRef, forwardedRef);
  return <div ref={ref} />;
}

// Outside render - use the function
const handleClick = () => {
  const ref = composeRefs(ref1, ref2);
  createPortal(<Modal ref={ref} />);
};`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

// Combined demo
function ComposeRefsFullDemo() {
  return (
    <div className="space-y-6">
      <ComposeRefsDemo />
      <UseComposedRefsDemo />
      <ComparisonDemo />
    </div>
  );
}

// Wrapper for meta
function ComposeRefsWrapper() {
  return <ComposeRefsDemo />;
}

const meta = {
  title: 'Hooks/useComposedRefs',
  component: ComposeRefsWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## lib/compose-refs.ts

Utilities for composing multiple React refs into a single ref.

### composeRefs()

Function that composes multiple refs into a single callback ref:

\`\`\`tsx
import { composeRefs } from '@/lib/compose-refs';

const ref1 = useRef(null);
const ref2 = useRef(null);
const composedRef = composeRefs(ref1, ref2, callbackRef);

<div ref={composedRef} />
\`\`\`

### useComposedRefs()

Hook that memoizes the composed ref for optimal performance:

\`\`\`tsx
import { useComposedRefs } from '@/lib/compose-refs';

const localRef = useRef(null);
const composedRef = useComposedRefs(localRef, forwardedRef);

<div ref={composedRef} />
\`\`\`

### Features

- Supports RefObject and callback refs
- Handles null/undefined refs gracefully
- Supports React 19 cleanup functions
- Memoized hook for optimal re-render performance
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ComposeRefsWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ComposeRefsDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    expect(canvas.getByTestId('compose-refs-demo')).toBeInTheDocument();

    // Verify input is rendered
    expect(canvas.getByTestId('composed-input')).toBeInTheDocument();

    // Verify refs are assigned (badges should show "Yes")
    expect(canvas.getByTestId('ref1-status')).toHaveTextContent('Yes');
    expect(canvas.getByTestId('ref2-status')).toHaveTextContent('Yes');
    expect(canvas.getByTestId('callback-status')).toHaveTextContent('Yes');
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const ComposeRefsFunction: Story = {
  render: () => <ComposeRefsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('compose-refs-demo')).toBeInTheDocument();

    // All refs should be assigned
    expect(canvas.getByTestId('ref1-status')).toHaveTextContent('Yes');
    expect(canvas.getByTestId('ref2-status')).toHaveTextContent('Yes');
  },
};

export const UseComposedRefsHook: Story = {
  render: () => <UseComposedRefsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('use-composed-refs-demo')).toBeInTheDocument();

    // All refs should be assigned
    expect(canvas.getByTestId('local-ref-status')).toHaveTextContent('Yes');
    expect(canvas.getByTestId('forwarded-ref-status')).toHaveTextContent('Yes');
    expect(canvas.getByTestId('measure-ref-status')).toHaveTextContent('Yes');
  },
};

export const Comparison: Story = {
  render: () => <ComparisonDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('comparison-demo')).toBeInTheDocument();
  },
};

export const AllDemos: Story = {
  render: () => <ComposeRefsFullDemo />,
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

// ============ COMBINED VARIANTS ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('useComposeRefs.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('useComposeRefs.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('useComposeRefs.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('useComposeRefs.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('useComposeRefs.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify input is accessible
    const input = canvas.getByTestId('composed-input');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');

    // Verify buttons are accessible
    const buttons = canvas.getAllByRole('button');
    expect(buttons.length).not.toBe(0);
  },
};
