import type { Meta, StoryObj } from '@storybook/react';
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
import { expect, fn, within } from 'storybook/test';

import { ResizeHandle } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/resize-handle';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

function ResizeHandleDemo({ isResizing }: { _actionStub?: unknown; isResizing: boolean }) {
  return (
    <div className="group/node-image bg-muted relative h-20 w-full max-w-xl rounded-md border">
      <div className="text-muted-foreground absolute top-2 left-2 text-xs" />
      <ResizeHandle className="left-1" data-testid="resize-handle" isResizing={isResizing} />
      <ResizeHandle className="right-1" data-testid="resize-handle" isResizing={isResizing} />
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Resize Handle',
  component: ResizeHandleDemo,
  tags: ['autodocs'],
  args: {
    isResizing: false,
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    // (No text content - visual handle element)
    // Appearance
    // (Styling controlled via className prop for positioning)
    // State
    isResizing: {
      control: { type: 'boolean' },
      description: i18n.t(
        'resizeHandle.argType.whetherTheResizeOperationIsCurrentlyActive',
        'Whether the resize operation is currently active'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'resizeHandle.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Events
    // (Drag events handled via useDragResize hook in parent)
    // ResizeHandle Props Reference:
    // - className: Position class (left-1, right-1) for handle placement
    // - isResizing: Controls opacity state (boolean)
    //
    // Visual States:
    // - Default: Hidden (opacity-0)
    // - Hover (parent): Visible (group-hover/node-image:opacity-80)
    // - Resizing: Always visible (opacity-80)
    //
    // Styling Classes:
    // - Position: absolute left-1 or right-1
    // - Appearance: rounded bg handle with backdrop-blur
    // - Size: h-full w-1
    //
    // Usage Notes:
    // - Used in ImageViewBlock for image resizing
    // - Requires parent with group/node-image class
    // - Handles are positioned at left and right edges
    // - Drag interaction handled by useDragResize hook
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ResizeHandleDemo>;

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

    expect(canvasElement.querySelector('[data-slot="resize-handle"]')).toBeInTheDocument();

    const handles = canvasElement.querySelectorAll('[data-testid="resize-handle"]');
    expect(handles.length).toBe(2);

    for (const handle of handles) {
      if (!(handle instanceof HTMLElement)) {
        throw new TypeError('Resize handle is not an HTMLElement.');
      }

      expect(handle).toHaveClass('group-hover/node-image:opacity-80');
      expect(handle).not.toHaveClass('opacity-80');
    }
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Resizing: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    isResizing: true,
  },
  play: async ({ canvasElement }) => {
    const handles = canvasElement.querySelectorAll('[data-testid="resize-handle"]');
    expect(handles.length).toBe(2);
    for (const handle of handles) {
      if (!(handle instanceof HTMLElement)) continue;
      expect(handle).toHaveClass('opacity-80');
      expect(handle).not.toHaveClass('group-hover/node-image:opacity-80');
    }
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

    expect(canvasElement.querySelector('[data-slot="resize-handle"]')).toBeInTheDocument();

    const handles = canvasElement.querySelectorAll('[data-testid="resize-handle"]');
    expect(handles.length).toBe(2);
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
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('ホバーしてハンドルを表示')).toBeInTheDocument();
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
  name: i18n.t('resizeHandle.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('resizeHandle.story.allFactoryData', 'All Factory Data')}
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
          {i18n.t('resizeHandle.story.defaultNotResizing', 'Default (Not Resizing)')}
        </p>
        <div className="group/node-image bg-muted relative h-20 w-full max-w-xl rounded-md border">
          <ResizeHandle className="left-1" isResizing={false} />
          <ResizeHandle className="right-1" isResizing={false} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('resizeHandle.story.resizingState', 'Resizing State')}
        </p>
        <div className="group/node-image bg-muted relative h-20 w-full max-w-xl rounded-md border">
          <ResizeHandle className="left-1" isResizing />
          <ResizeHandle className="right-1" isResizing />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('resizeHandle.story.singleHandleLeftOnly', 'Single Handle (Left Only)')}
        </p>
        <div className="group/node-image bg-muted relative h-20 w-full max-w-xl rounded-md border">
          <ResizeHandle className="left-1" isResizing={false} />
        </div>
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
        <p className="mb-2 text-sm font-medium">Small Container (200px)</p>
        <div className="group/node-image bg-muted relative h-16 w-[200px] rounded-md border">
          <ResizeHandle className="left-1" isResizing={false} />
          <ResizeHandle className="right-1" isResizing={false} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Medium Container (400px)</p>
        <div className="group/node-image bg-muted relative h-20 w-[400px] rounded-md border">
          <ResizeHandle className="left-1" isResizing={false} />
          <ResizeHandle className="right-1" isResizing={false} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Large Container (600px)</p>
        <div className="group/node-image bg-muted relative h-24 w-[600px] rounded-md border">
          <ResizeHandle className="left-1" isResizing={false} />
          <ResizeHandle className="right-1" isResizing={false} />
        </div>
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
  name: i18n.t('resizeHandle.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Test resize handles have data-slot for identification
    const handles = canvasElement.querySelectorAll('[data-slot="resize-handle"]');
    expect(handles.length).not.toBe(0);

    // Verify handles are within the group container
    const container = canvasElement.querySelector('.group\\/node-image');
    expect(container).toBeInTheDocument();

    // Test handles have appropriate visual indicators
    for (const handle of handles) {
      if (!(handle instanceof HTMLElement)) continue;
      // Handles should become visible on parent hover
      expect(handle).toHaveClass('group-hover/node-image:opacity-80');
    }
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('resizeHandle.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('resizeHandle.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('resizeHandle.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('resizeHandle.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
