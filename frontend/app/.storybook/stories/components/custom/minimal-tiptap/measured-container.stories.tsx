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
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MeasuredContainer } from '@/components/ui/custom/minimal-tiptap/components/measured-container';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

type MeasuredContainerDemoProps = {
  _actionStub?: unknown;
  initialWidth: number;
};

function MeasuredContainerDemo({ initialWidth }: MeasuredContainerDemoProps) {
  const [width, setWidth] = React.useState(initialWidth);

  React.useEffect(() => {
    setWidth(initialWidth);
  }, [initialWidth]);

  const widthLabel = i18n.t('minimalTiptap.measuredContainer.widthLabel');

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">{widthLabel}</div>
        <Slider
          aria-label={widthLabel}
          value={[width]}
          min={280}
          max={720}
          step={10}
          onValueChange={(v) => setWidth(v[0] ?? initialWidth)}
        />
        <div className="text-muted-foreground text-xs">{width}px</div>
      </div>

      <MeasuredContainer
        as="div"
        name="demo"
        id="demo-container"
        className="bg-background rounded-md border p-4"
        style={{ width }}
      >
        <div className="text-sm font-medium" />
        <div className="text-muted-foreground mt-1 text-sm">
          {' '}
          <code className="font-mono text-xs">--demo-width</code>{' '}
          <code className="font-mono text-xs">--demo-height</code>
        </div>
        <div className="bg-muted mt-3 rounded p-2 text-xs" />
      </MeasuredContainer>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Measured Container',
  component: MeasuredContainerDemo,
  tags: ['autodocs'],
  args: {
    initialWidth: 520,
    _actionStub: fn(),
  },
  argTypes: {
    // Appearance
    initialWidth: {
      control: { type: 'number' },
      description: i18n.t(
        'measuredContainer.argType.initialWidthOfTheContainerInPixels',
        'Initial width of the container in pixels'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '520' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // MeasuredContainer Props Reference:
    // - as: Element type to render (keyof JSX.IntrinsicElements, default: 'div')
    // - name: CSS variable prefix (string, required)
    // - id: Element ID (string)
    // - className: Additional CSS classes (string)
    // - style: Inline styles (CSSProperties)
    // - children: Container content (ReactNode)
    //
    // CSS Variables Generated:
    // - --{name}-width: Container width in pixels
    // - --{name}-height: Container height in pixels
    //
    // Measurement:
    // - Uses ResizeObserver to track size changes
    // - Updates CSS variables on resize
    // - Debounced for performance
    //
    // Usage Notes:
    // - Used in MinimalTiptap for responsive toolbar
    // - CSS variables enable responsive styling
    // - Example: --demo-width for name="demo"
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MeasuredContainerDemo>;

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

    const container = canvasElement.querySelector('#demo-container');
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('Could not find the measured container element.');
    }

    await waitFor(() => {
      const widthVar = parseFloat(container.style.getPropertyValue('--demo-width'));
      const heightVar = parseFloat(container.style.getPropertyValue('--demo-height'));

      expect(widthVar).not.toBe(0);
      expect(heightVar).not.toBe(0);
    });

    const slider = canvasElement.querySelector('[data-slot="slider"]');
    if (!(slider instanceof HTMLElement)) {
      throw new TypeError('Could not find the width slider.');
    }

    const thumb = slider.querySelector('[data-slot="slider-thumb"]');
    if (!(thumb instanceof HTMLElement)) {
      throw new TypeError('Could not find the width slider thumb.');
    }

    const before = parseFloat(container.style.getPropertyValue('--demo-width'));

    thumb.focus();
    await userEvent.keyboard('{ArrowRight}');

    await waitFor(() => {
      const after = parseFloat(container.style.getPropertyValue('--demo-width'));
      expect(after).toBeGreaterThan(before);
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// VARIANT STORIES (Dark, RTL, Japanese)
// ============================================================================

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
    expect(canvas.getByText('Measured container')).toBeInTheDocument();
    expect(canvasElement.querySelector('#demo-container')).toBeInTheDocument();
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
    expect(canvas.getByText('Measured container')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="slider"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('幅')).toBeInTheDocument();
    expect(canvas.getByText('計測コンテナ')).toBeInTheDocument();
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
  name: i18n.t(
    'measuredContainer.storyName.pseudoStates',
    'Pseudo States (hover / focus / active)'
  ),
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
        {t('measuredContainer.story.allFactoryData', 'All Factory Data')}
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

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('measuredContainer.story.defaultContainerDiv', 'Default Container (div)')}
        </p>
        <MeasuredContainer as="div" name="variant-div" className="bg-muted rounded-md border p-4">
          <span className="text-sm">
            {i18n.t('measuredContainer.story.containerAsDivElement', 'Container as div element')}
          </span>
        </MeasuredContainer>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('measuredContainer.story.sectionContainer', 'Section Container')}
        </p>
        <MeasuredContainer
          as="section"
          name="variant-section"
          className="bg-muted rounded-md border p-4"
        >
          <span className="text-sm">
            {i18n.t(
              'measuredContainer.story.containerAsSectionElement',
              'Container as section element'
            )}
          </span>
        </MeasuredContainer>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('measuredContainer.story.articleContainer', 'Article Container')}
        </p>
        <MeasuredContainer
          as="article"
          name="variant-article"
          className="bg-muted rounded-md border p-4"
        >
          <span className="text-sm">
            {i18n.t(
              'measuredContainer.story.containerAsArticleElement',
              'Container as article element'
            )}
          </span>
        </MeasuredContainer>
      </div>
    </div>
  ),

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Small (280px)</p>
        <MeasuredContainer
          as="div"
          name="size-sm"
          className="bg-muted rounded-md border p-4"
          style={{ width: 280 }}
        >
          <span className="text-sm">
            {i18n.t('measuredContainer.story.smallContainer', 'Small container')}
          </span>
        </MeasuredContainer>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Medium (480px)</p>
        <MeasuredContainer
          as="div"
          name="size-md"
          className="bg-muted rounded-md border p-4"
          style={{ width: 480 }}
        >
          <span className="text-sm">
            {i18n.t('measuredContainer.story.mediumContainer', 'Medium container')}
          </span>
        </MeasuredContainer>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Large (720px)</p>
        <MeasuredContainer
          as="div"
          name="size-lg"
          className="bg-muted rounded-md border p-4"
          style={{ width: 720 }}
        >
          <span className="text-sm">
            {i18n.t('measuredContainer.story.largeContainer', 'Large container')}
          </span>
        </MeasuredContainer>
      </div>
    </div>
  ),

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('measuredContainer.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Test slider has proper aria-label
    const slider = canvasElement.querySelector('[data-slot="slider"]');
    expect(slider).toBeInTheDocument();

    const thumb = canvasElement.querySelector('[data-slot="slider-thumb"]');
    if (!(thumb instanceof HTMLElement)) {
      throw new TypeError('Slider thumb was not rendered.');
    }

    // Test keyboard navigation on slider
    thumb.focus();
    expect(document.activeElement).toBe(thumb);

    // Arrow keys should work
    await userEvent.keyboard('{ArrowRight}');

    // Verify CSS variables are set on container
    const container = canvasElement.querySelector('#demo-container');
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('Container was not rendered.');
    }

    await waitFor(() => {
      const widthVar = parseFloat(container.style.getPropertyValue('--demo-width'));
      expect(widthVar).not.toBe(0);
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('measuredContainer.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('measuredContainer.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('measuredContainer.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('measuredContainer.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
