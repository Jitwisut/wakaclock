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
import { FontBoldIcon, FontItalicIcon, UnderlineIcon } from '@radix-ui/react-icons';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { FormatAction } from '@/components/ui/custom/minimal-tiptap/types';
import { ToolbarSection } from '@/components/ui/custom/minimal-tiptap/components/toolbar-section';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type ToolbarSectionAction = 'bold' | 'italic' | 'underline';

type ToolbarSectionDemoProps = {
  _actionStub?: unknown;
  activeActions: ToolbarSectionAction[];
  content: string;
  mainActionCount: number;
  selectionNeedle: string;
};

function ToolbarSectionDemo({
  activeActions,
  content,
  mainActionCount,
  selectionNeedle,
}: ToolbarSectionDemoProps) {
  const demoActions: FormatAction[] = [
    {
      value: 'bold',
      label: i18n.t('minimalTiptap.toolbar.bold'),
      icon: <FontBoldIcon className="size-5" />,
      action: (editor) => editor.chain().focus().toggleBold().run(),
      isActive: (editor) => editor.isActive('bold'),
      canExecute: (editor) => editor.can().chain().focus().toggleBold().run(),
      shortcuts: ['mod', 'b'],
    },
    {
      value: 'italic',
      label: i18n.t('minimalTiptap.toolbar.italic'),
      icon: <FontItalicIcon className="size-5" />,
      action: (editor) => editor.chain().focus().toggleItalic().run(),
      isActive: (editor) => editor.isActive('italic'),
      canExecute: (editor) => editor.can().chain().focus().toggleItalic().run(),
      shortcuts: ['mod', 'i'],
    },
    {
      value: 'underline',
      label: i18n.t('minimalTiptap.toolbar.underline'),
      icon: <UnderlineIcon className="size-5" />,
      action: (editor) => editor.chain().focus().toggleUnderline().run(),
      isActive: (editor) => editor.isActive('underline'),
      canExecute: (editor) => editor.can().chain().focus().toggleUnderline().run(),
      shortcuts: ['mod', 'u'],
    },
  ];

  return (
    <MinimalTiptapStoryHarness
      content={content}
      onReady={(editor) => {
        requestAnimationFrame(() => {
          const needle = selectionNeedle;
          let from = -1;
          let to = -1;

          editor.state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return true;
            const index = node.text.indexOf(needle);
            if (index === -1) return true;
            from = pos + index;
            to = from + needle.length;
            return false;
          });

          if (from !== -1 && to !== -1) {
            editor.chain().focus().setTextSelection({ from, to }).run();
          }
        });
      }}
      toolbar={(editor) => (
        <ToolbarSection
          editor={editor}
          actions={demoActions}
          activeActions={activeActions}
          mainActionCount={mainActionCount}
          dropdownTooltip="More formatting"
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Toolbar Section',
  component: ToolbarSectionDemo,
  tags: ['autodocs'],
  args: {
    activeActions: ['bold', 'italic', 'underline'],
    content: `<p>${i18n.t('toolbarSection.story.selectTextThenUseTheToolbarButtons', 'Select text, then use the toolbar buttons.')}</p>`,
    mainActionCount: 1,
    selectionNeedle: 'text',
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    activeActions: {
      control: { type: 'object' },
      description: i18n.t(
        'toolbarSection.argType.actionsToEnableInToolbarSection',
        'Actions to enable in toolbar section'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string[]' },
        defaultValue: { summary: "['bold', 'italic', 'underline']" },
      },
    },
    content: {
      control: { type: 'text' },
      description: i18n.t(
        'toolbarSection.argType.initialHtmlContentForEditorDemoProp',
        'Initial HTML content for editor (demo prop)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    selectionNeedle: {
      control: { type: 'text' },
      description: i18n.t(
        'toolbarSection.argType.textToAutoselectOnLoadDemoProp',
        'Text to auto-select on load (demo prop)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Appearance
    mainActionCount: {
      control: { type: 'number' },
      description: i18n.t(
        'toolbarSection.argType.numberOfActionsShownInMainToolbarRestInDropdown',
        'Number of actions shown in main toolbar (rest in dropdown)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // ToolbarSection Props Reference:
    // - editor: Tiptap editor instance (Editor, required)
    // - actions: Array of FormatAction objects (FormatAction[], required)
    // - activeActions: Which actions to display (string[])
    // - mainActionCount: Actions in main toolbar (number)
    // - dropdownTooltip: Tooltip for dropdown trigger (string)
    //
    // FormatAction Structure:
    // {
    //   value: string              // Unique identifier
    //   label: string              // Display label
    //   icon: ReactNode            // Icon element (16x16)
    //   action: (editor) => void   // Command to execute
    //   isActive: (editor) => bool // Check if format is active
    //   canExecute: (editor) => bool // Check if command can run
    //   shortcuts?: string[]       // Keyboard shortcut keys
    // }
    //
    // Layout Behavior:
    // - First N actions (mainActionCount) shown as ToolbarButtons
    // - Remaining actions in dropdown menu
    // - Set mainActionCount=0 for all in dropdown
    // - Set mainActionCount >= actions.length for no dropdown
    //
    // State Behavior:
    // - Toggle buttons show active state when format applied
    // - Disabled when canExecute returns false (e.g., in code block)
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ToolbarSectionDemo>;

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

    expect(canvasElement.querySelector('[data-slot="toolbar-section"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Bold' }));

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Bold' }).getAttribute('data-state')).toBe('on');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithDropdown: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.withDropdown', 'With dropdown'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 1,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'More formatting' }));
    expect(await root.findByRole('menuitem', { name: 'Italic' })).toBeInTheDocument();
    expect(await root.findByRole('menuitem', { name: 'Underline' })).toBeInTheDocument();
  },
};

export const AllMainActions: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.allMainActions', 'All main actions (no dropdown)'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 3,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.queryByRole('button', { name: 'More formatting' })).not.toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
  },
};

export const AllInDropdown: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.allInDropdown', 'All in dropdown'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 0,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    expect(canvas.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'More formatting' }));
    expect(await root.findByRole('menuitem', { name: 'Bold' })).toBeInTheDocument();
    expect(await root.findByRole('menuitem', { name: 'Italic' })).toBeInTheDocument();
    expect(await root.findByRole('menuitem', { name: 'Underline' })).toBeInTheDocument();
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

export const DisabledInCodeBlock: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  args: {
    ...(Default.args ?? {}),
    content: '<pre><code>Bold, italic, underline on this word.</code></pre>',
    mainActionCount: 3,
    selectionNeedle: 'word',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Bold' })).toBeDisabled();
    });
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 1,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: '太字' }));
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: '太字' }).getAttribute('data-state')).toBe('on');
    });

    await userEvent.click(canvas.getByRole('button', { name: 'その他の書式' }));
    expect(await root.findByRole('menuitem', { name: '斜体' })).toBeInTheDocument();
    expect(await root.findByRole('menuitem', { name: '下線' })).toBeInTheDocument();
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
  name: i18n.t('toolbarSection.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('toolbarSection.story.allFactoryData', 'All Factory Data')}
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
        <p className="mb-2 text-sm font-medium">All in Dropdown (mainActionCount: 0)</p>
        <ToolbarSectionDemo
          activeActions={['bold', 'italic', 'underline']}
          content="<p>{i18n.t('toolbarSection.story.allActionsInDropdown', 'All actions in dropdown')}</p>"
          mainActionCount={0}
          selectionNeedle="actions"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Some Main Actions (mainActionCount: 1)</p>
        <ToolbarSectionDemo
          activeActions={['bold', 'italic', 'underline']}
          content="<p>{i18n.t('toolbarSection.story.mixedMainAndDropdown', 'Mixed main and dropdown')}</p>"
          mainActionCount={1}
          selectionNeedle="Mixed"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">All Main Actions (mainActionCount: 3)</p>
        <ToolbarSectionDemo
          activeActions={['bold', 'italic', 'underline']}
          content="<p>{i18n.t('toolbarSection.story.allAsToolbarButtons', 'All as toolbar buttons')}</p>"
          mainActionCount={3}
          selectionNeedle="buttons"
        />
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
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarSection.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <ToolbarSectionDemo
            activeActions={['bold', 'italic']}
            content="<p>{i18n.t('toolbarSection.story.compactView', 'Compact view')}</p>"
            mainActionCount={0}
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarSection.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <ToolbarSectionDemo
            activeActions={['bold', 'italic', 'underline']}
            content="<p>{i18n.t('toolbarSection.story.mediumView', 'Medium view')}</p>"
            mainActionCount={2}
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarSection.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <ToolbarSectionDemo
            activeActions={['bold', 'italic', 'underline']}
            content="<p>{i18n.t('toolbarSection.story.fullWidthView', 'Full width view')}</p>"
            mainActionCount={3}
            selectionNeedle="view"
          />
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
  name: i18n.t('toolbarSection.storyName.accessibility', 'Accessibility'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test toolbar buttons are keyboard accessible
    const boldButton = canvas.getByRole('button', { name: 'Bold' });
    expect(boldButton).toBeInTheDocument();

    boldButton.focus();
    expect(document.activeElement).toBe(boldButton);

    // Test toggle with keyboard
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(boldButton.getAttribute('data-state')).toBe('on');
    });

    // Tab through buttons
    await userEvent.tab();
    const italicButton = canvas.getByRole('button', { name: 'Italic' });
    expect(document.activeElement).toBe(italicButton);

    await userEvent.tab();
    const underlineButton = canvas.getByRole('button', { name: 'Underline' });
    expect(document.activeElement).toBe(underlineButton);
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('toolbarSection.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
