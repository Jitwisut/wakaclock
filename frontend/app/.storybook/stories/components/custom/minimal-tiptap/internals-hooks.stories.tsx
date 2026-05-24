import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import {
  createFakeBlogPostContent,
  createFakeBlogPosts,
  createFakeChatMessageEditor,
  createFakeCodeContent,
  createFakeCommentContent,
  createFakeComments,
  createFakeDocumentationContent,
  createFakeEditor,
  createFakeEditorConfig,
  createFakeEditorContent,
  createFakeEditorContents,
  createFakeEditorLabelsEn,
  createFakeEditorLabelsJa,
  createFakeEditorShowcase,
  createFakeEmailContent,
  createFakeEmptyEditorContent,
  createFakeLongFormEditor,
  createFakeMinimalContent,
  createFakeNoteContent,
  createFakeNotes,
  createFakeReadOnlyEditor,
  createFakeRichContent,
  createFakeSocialPostEditor,
  createFakeToolbarConfig,
} from '@/.storybook/stories/_factories/minimal-tiptap.factory';
import { formHandlers, formStatusHandlers } from '@/.storybook/stories/_handlers/form.handlers';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, within } from 'storybook/test';

// Ensure these hook modules are explicitly represented.
import '@/components/ui/custom/minimal-tiptap/extensions/image/hooks/use-drag-resize';
import '@/components/ui/custom/minimal-tiptap/extensions/image/hooks/use-image-actions';

import { useContainerSize } from '@/components/ui/custom/minimal-tiptap/hooks/use-container-size';
import useTheme from '@/components/ui/custom/minimal-tiptap/hooks/use-theme';
import { useThrottle } from '@/components/ui/custom/minimal-tiptap/hooks/use-throttle';
import { Slider } from '@/components/ui/slider';

import i18n from 'i18next';

seedFaker();

const DEFAULT_TITLE = 'Minimal Tiptap hooks';

function ContainerSizeCard() {
  const [width, setWidth] = React.useState(520);
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const rect = useContainerSize(element);
  const setRef = React.useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  return (
    <div className="bg-background space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">useContainerSize</div>
      <Slider
        aria-label={i18n.t('tiptapHooks.story.containerWidth', 'Container width')}
        value={[width]}
        min={280}
        max={720}
        step={10}
        onValueChange={(v) => setWidth(v[0] ?? 520)}
      />
      <div ref={setRef} className="bg-muted rounded-md p-4 text-sm" style={{ width }}>
        Resize me
      </div>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
        {JSON.stringify(
          {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

function ThemeCard() {
  const isDarkMode = useTheme();
  return (
    <div className="bg-background space-y-2 rounded-md border p-4">
      <div className="text-sm font-medium">useTheme</div>
      <div className="text-muted-foreground text-sm">
        Prefers dark mode: <span className="font-medium">{String(isDarkMode)}</span>
      </div>
    </div>
  );
}

function ThrottleCard() {
  const [raw, setRaw] = React.useState(0);
  const [throttled, setThrottled] = React.useState(0);
  const updateThrottled = useThrottle((value: number) => setThrottled(value), 400);

  return (
    <div className="bg-background space-y-3 rounded-md border p-4">
      <div className="text-sm font-medium">useThrottle</div>
      <Slider
        aria-label={i18n.t('tiptapHooks.story.rawValue', 'Raw value')}
        value={[raw]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => {
          const next = v[0] ?? 0;
          setRaw(next);
          updateThrottled(next);
        }}
      />
      <div className="text-muted-foreground text-sm">
        Raw: <span className="font-medium">{raw}</span> • Throttled (400ms):{' '}
        <span className="font-medium">{throttled}</span>
      </div>
    </div>
  );
}

type MinimalTiptapHooksDemoProps = {
  _actionStub?: unknown;
  title?: string;
};

function MinimalTiptapHooksDemo({ title = DEFAULT_TITLE }: MinimalTiptapHooksDemoProps) {
  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="text-sm font-medium">{title}</div>
      <ContainerSizeCard />
      <ThrottleCard />
      <ThemeCard />
    </div>
  );
}

function I18nMinimalTiptapHooksDemo(props: MinimalTiptapHooksDemoProps) {
  const { t } = useTranslation();
  return <MinimalTiptapHooksDemo {...props} title={t('minimalTiptap.internals.hooks.title')} />;
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Internals/Hooks',
  component: MinimalTiptapHooksDemo,
  tags: ['autodocs'],
  args: {
    title: DEFAULT_TITLE,
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    title: {
      control: { type: 'text' },
      description: i18n.t(
        'internalsHooks.argType.headingDisplayedAboveTheHooksDemonstration',
        'Heading displayed above the hooks demonstration'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Minimal Tiptap hooks' },
      },
    },
    // Appearance
    // (Card-based layout for each hook demonstration)
    // State
    // (Interactive demos with local state management)
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'internalsHooks.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Reference
    // (Documentation component - demonstrates available hooks)
    // Hooks Reference:
    // Available Custom Hooks:
    //
    // useContainerSize(element: HTMLElement | null):
    // - Returns: { width, height, x, y } DOMRect-like object
    // - Uses ResizeObserver for responsive measurements
    // - Useful for responsive toolbar layouts
    //
    // useTheme():
    // - Returns: boolean (true if dark mode preferred)
    // - Uses matchMedia for system preference detection
    // - Updates on system theme changes
    //
    // useThrottle<T>(callback: T, delay: number):
    // - Returns: Throttled version of callback
    // - Limits execution frequency to once per delay ms
    // - Useful for resize/scroll handlers
    //
    // useMinimalTiptapEditor(options):
    // - Returns: Editor instance or null
    // - Main hook for creating Tiptap editor
    // - Configures extensions, content, and output format
    //
    // useDragResize (image extension):
    // - Handles image resize via drag handles
    // - Updates image dimensions on drag
    //
    // useImageActions (image extension):
    // - Provides image action handlers
    // - View, download, copy, copy link functionality
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapHooksDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const containerCardHeading = canvas.getByText('useContainerSize');
    const containerCard = containerCardHeading.closest('div');
    if (!(containerCard instanceof HTMLElement)) {
      throw new TypeError('Could not locate the useContainerSize card.');
    }

    const containerCanvas = within(containerCard);
    await userEvent.click(containerCanvas.getByText('Resize me'));

    const pre = containerCard.querySelector('pre');
    if (!(pre instanceof HTMLElement)) {
      throw new TypeError('Could not find the container rect output.');
    }

    await expect(pre).toHaveTextContent('"width"');

    const rect = JSON.parse(pre.textContent ?? '{}') as {
      height?: number;
      width?: number;
      x?: number;
      y?: number;
    };

    expect(rect).toEqual({
      width: expect.any(Number),
      height: expect.any(Number),
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(rect.width).not.toBe(0);
    expect(rect.height).not.toBe(0);

    const throttleCardHeading = canvas.getByText('useThrottle');
    const throttleCard = throttleCardHeading.closest('div');
    if (!(throttleCard instanceof HTMLElement)) {
      throw new TypeError('Could not locate the useThrottle card.');
    }

    const throttleCanvas = within(throttleCard);
    const rawSlider = throttleCanvas.getByLabelText('Raw value');
    const rawThumb = rawSlider.querySelector('[data-slot="slider-thumb"]');
    if (!(rawThumb instanceof HTMLElement)) {
      throw new TypeError('Could not find the raw value slider thumb.');
    }

    const output = throttleCanvas.getByText(/Raw:/);
    await expect(output).toHaveTextContent(/Raw:\s*0/);
    await expect(output).toHaveTextContent(/Throttled\s*\(400ms\):\s*0/);

    rawThumb.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');

    await expect(output).toHaveTextContent(/Raw:\s*5/);
    await expect(output).toHaveTextContent(/Throttled\s*\(400ms\):\s*5/);

    const themeCardHeading = canvas.getByText('useTheme');
    const themeCard = themeCardHeading.closest('div');
    if (!(themeCard instanceof HTMLElement)) {
      throw new TypeError('Could not locate the useTheme card.');
    }

    await expect(themeCard).toHaveTextContent(/Prefers dark mode:\s*(true|false)/);
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
    expect(canvas.getByText('Minimal Tiptap hooks')).toBeInTheDocument();
    expect(canvas.getByText('useContainerSize')).toBeInTheDocument();
    expect(canvas.getByText('useThrottle')).toBeInTheDocument();
    expect(canvas.getByText('useTheme')).toBeInTheDocument();
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
    expect(canvas.getByText('Minimal Tiptap hooks')).toBeInTheDocument();
    expect(canvas.getByLabelText('Container width')).toBeInTheDocument();
    expect(canvas.getByLabelText('Raw value')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: (args) => <I18nMinimalTiptapHooksDemo {...args} />,
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('Minimal Tiptap フック')).toBeInTheDocument();
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
  name: i18n.t('internalsHooks.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

function FactoryDataDemo() {
  const { t } = useTranslation();
  const blogPostContent = createFakeBlogPostContent();
  const blogPosts = createFakeBlogPosts(2);
  const chatMessageEditor = createFakeChatMessageEditor();
  const codeContent = createFakeCodeContent();
  const commentContent = createFakeCommentContent();
  const comments = createFakeComments(2);
  const documentationContent = createFakeDocumentationContent();
  const editor = createFakeEditor();
  const editorConfig = createFakeEditorConfig();
  const editorContent = createFakeEditorContent();
  const editorContents = createFakeEditorContents(2);
  const editorLabelsEn = createFakeEditorLabelsEn();
  const editorLabelsJa = createFakeEditorLabelsJa();
  const editorShowcase = createFakeEditorShowcase();
  const emailContent = createFakeEmailContent();
  const emptyEditorContent = createFakeEmptyEditorContent();
  const longFormEditor = createFakeLongFormEditor();
  const minimalContent = createFakeMinimalContent();
  const noteContent = createFakeNoteContent();
  const notes = createFakeNotes(2);
  const readOnlyEditor = createFakeReadOnlyEditor();
  const richContent = createFakeRichContent();
  const socialPostEditor = createFakeSocialPostEditor();
  const toolbarConfig = createFakeToolbarConfig();

  return (
    <div className="space-y-4 p-4" data-testid="factory-data-demo">
      <h3 className="text-sm font-medium">
        {t('internalsHooks.story.allFactoryData', 'All Factory Data')}
      </h3>
      <pre className="bg-muted max-h-96 overflow-auto rounded p-2 text-xs">
        {JSON.stringify(
          {
            blogPostContent,
            blogPosts,
            chatMessageEditor,
            codeContent,
            commentContent,
            comments,
            documentationContent,
            editor,
            editorConfig,
            editorContent,
            editorContents,
            editorLabelsEn,
            editorLabelsJa,
            editorShowcase,
            emailContent,
            emptyEditorContent,
            longFormEditor,
            minimalContent,
            noteContent,
            notes,
            readOnlyEditor,
            richContent,
            socialPostEditor,
            toolbarConfig,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

// ============================================================================
// FACTORY & MSW STORIES
// ============================================================================

export const FactoryData: Story = {
  render: () => <FactoryDataDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const demo = canvas.getByTestId('factory-data-demo');
    expect(demo).toBeInTheDocument();
    expect(demo.querySelectorAll('.rounded-md').length).toBeGreaterThanOrEqual(3);
  },
};

// =============================================================================
// ENTERPRISE STORY EXPORTS
// =============================================================================

export const Variants: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsHooks.story.defaultHooksDemo', 'Default hooks demo')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsHooks.story.customTitle', 'Custom title')}
          </div>
          <MinimalTiptapHooksDemo
            title={i18n.t('tiptapHooks.story.customHooksTitle', 'Custom hooks title')}
          />
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsHooks.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[350px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsHooks.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[550px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsHooks.story.largeContainer', 'Large container')}
          </div>
          <div className="max-w-[800px]">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.withMswHandlers', 'With MSW Handlers'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formHandlers },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.loading', 'Loading'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.loading },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.error400BadRequest', 'Error: 400 Bad Request'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.badRequest },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.unauthorized },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.error403Forbidden', 'Error: 403 Forbidden'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.forbidden },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  name: i18n.t(
    'internalsHooks.storyName.error500InternalServerError',
    'Error: 500 Internal Server'
  ),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.internalServerError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.networkError', 'Network Error'),
  parameters: {
    ...Default.parameters,
    msw: { handlers: formStatusHandlers.networkError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test sliders have proper aria-labels
    const containerSlider = canvas.getByLabelText('Container width');
    expect(containerSlider).toBeInTheDocument();

    const rawSlider = canvas.getByLabelText('Raw value');
    expect(rawSlider).toBeInTheDocument();

    // Test keyboard navigation on slider
    const containerThumb = containerSlider.querySelector('[data-slot="slider-thumb"]');
    if (!(containerThumb instanceof HTMLElement)) {
      throw new TypeError('Container slider thumb was not rendered.');
    }

    containerThumb.focus();
    expect(document.activeElement).toBe(containerThumb);

    // Arrow keys should work
    await userEvent.keyboard('{ArrowRight}');

    // Tab to next interactive element
    await userEvent.tab();

    // Verify hook cards are present
    expect(canvas.getByText('useContainerSize')).toBeInTheDocument();
    expect(canvas.getByText('useThrottle')).toBeInTheDocument();
    expect(canvas.getByText('useTheme')).toBeInTheDocument();
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('internalsHooks.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
