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
import { SectionTwo } from '@/components/ui/custom/minimal-tiptap/components/section/two';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MinimalTiptapStoryHarness } from './_harness';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

type TextStyleAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'clearFormatting';

type SectionTwoDemoProps = {
  _actionStub?: unknown;
  activeActions: TextStyleAction[];
  content: string;
  mainActionCount: number;
  selectionNeedle: string;
};

function SectionTwoDemo({
  activeActions,
  content,
  mainActionCount,
  selectionNeedle,
}: SectionTwoDemoProps) {
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
        <SectionTwo
          editor={editor}
          activeActions={activeActions}
          mainActionCount={mainActionCount}
          labels={{
            bold: i18n.t('minimalTiptap.toolbar.bold'),
            italic: i18n.t('minimalTiptap.toolbar.italic'),
            underline: i18n.t('minimalTiptap.toolbar.underline'),
            strikethrough: i18n.t('minimalTiptap.toolbar.strikethrough'),
            code: i18n.t('minimalTiptap.toolbar.code'),
            clearFormatting: i18n.t('minimalTiptap.toolbar.clearFormatting'),
            moreFormatting: i18n.t('minimalTiptap.toolbar.moreFormatting'),
          }}
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Section Two',
  component: SectionTwoDemo,
  tags: ['autodocs'],
  args: {
    activeActions: ['bold', 'italic', 'underline', 'strikethrough', 'code', 'clearFormatting'],
    content: '<p>Bold, italic, underline, code, etc. on this word.</p>',
    mainActionCount: 3,
    selectionNeedle: 'word',
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    activeActions: {
      control: { type: 'object' },
      description: i18n.t(
        'sectionTwo.argType.textStyleActionsToEnable',
        'Text style actions to enable'
      ),
      table: {
        category: 'Content',
        type: { summary: 'TextStyleAction[]' },
        defaultValue: {
          summary: "['bold', 'italic', 'underline', 'strikethrough', 'code', 'clearFormatting']",
        },
      },
    },
    content: {
      control: { type: 'text' },
      description: i18n.t(
        'sectionTwo.argType.initialHtmlContentForEditorDemoProp',
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
        'sectionTwo.argType.textToAutoselectOnLoadDemoProp',
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
        'sectionTwo.argType.numberOfActionsShownInMainToolbarRestInDropdown',
        'Number of actions shown in main toolbar (rest in dropdown)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '3' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // SectionTwo Props Reference (Text Formatting):
    // - editor: Tiptap editor instance (Editor, required)
    // - activeActions: Formatting actions to enable (TextStyleAction[])
    // - mainActionCount: Actions in main toolbar (number, default: 3)
    // - labels: Localization labels (Labels)
    //   - bold, italic, underline, strikethrough, code, clearFormatting
    //   - moreFormatting: Dropdown trigger text
    //
    // TextStyleAction Options:
    // - 'bold': Bold text (Ctrl/Cmd + B)
    // - 'italic': Italic text (Ctrl/Cmd + I)
    // - 'underline': Underlined text (Ctrl/Cmd + U)
    // - 'strikethrough': Strikethrough text (Ctrl/Cmd + Shift + S)
    // - 'code': Inline code (Ctrl/Cmd + E)
    // - 'clearFormatting': Remove all formatting
    //
    // Layout Behavior:
    // - First N actions (mainActionCount) shown as buttons
    // - Remaining actions in "More formatting" dropdown
    // - Set mainActionCount to activeActions.length to hide dropdown
    //
    // State Behavior:
    // - Toggle buttons show active state when format applied
    // - All buttons disabled when cursor is in code block
    //
    // Usage Notes:
    // - Part of MinimalTiptap toolbar sections
    // - Requires Bold, Italic, Underline, Strike, Code extensions
    // - Uses Toggle buttons for main actions
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SectionTwoDemo>;

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

    expect(canvasElement.querySelector('[data-slot="section-two"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    const boldButton = canvas.getByRole('button', { name: 'Bold' });
    expect(boldButton).toBeInTheDocument();
    expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(boldButton);
    await waitFor(() => {
      expect(boldButton).toHaveAttribute('data-state', 'on');
      expect(boldButton).toHaveAttribute('aria-pressed', 'true');
    });
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Test toggle behavior for Bold button
    const boldButton = canvas.getByRole('button', { name: 'Bold' });
    expect(boldButton).toBeInTheDocument();
    expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    // Toggle on
    await userEvent.click(boldButton);
    await waitFor(() => {
      expect(boldButton).toHaveAttribute('aria-pressed', 'true');
      expect(boldButton).toHaveAttribute('data-state', 'on');
    });

    // Toggle off
    await userEvent.click(boldButton);
    await waitFor(() => {
      expect(boldButton).toHaveAttribute('aria-pressed', 'false');
      expect(boldButton).toHaveAttribute('data-state', 'off');
    });

    // Test Italic button
    const italicButton = canvas.getByRole('button', { name: 'Italic' });
    expect(italicButton).toBeInTheDocument();
    await userEvent.click(italicButton);
    await waitFor(() => {
      expect(italicButton).toHaveAttribute('aria-pressed', 'true');
    });

    // Test Underline button
    const underlineButton = canvas.getByRole('button', { name: 'Underline' });
    expect(underlineButton).toBeInTheDocument();
    await userEvent.click(underlineButton);
    await waitFor(() => {
      expect(underlineButton).toHaveAttribute('aria-pressed', 'true');
    });
  },
};

export const WithDropdown: Story = {
  ...Default,
  name: i18n.t('sectionTwo.storyName.withDropdown', 'With dropdown'),
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
    expect(await root.findByText('Italic')).toBeInTheDocument();
    expect(await root.findByText('Underline')).toBeInTheDocument();
  },
};

export const AllMainActions: Story = {
  ...Default,
  name: i18n.t('sectionTwo.storyName.allMainActions', 'All main actions (no dropdown)'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 6,
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
  name: i18n.t('sectionTwo.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  args: {
    ...(Default.args ?? {}),
    content: '<pre><code>Bold, italic, underline, code, etc. on this word.</code></pre>',
    mainActionCount: 6,
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
  name: i18n.t('sectionTwo.storyName.japanese', 'Japanese'),
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

    await userEvent.click(canvas.getByRole('button', { name: 'その他の書式' }));
    expect(await root.findByText('斜体')).toBeInTheDocument();
    expect(await root.findByText('下線')).toBeInTheDocument();
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
  name: i18n.t('sectionTwo.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('sectionTwo.story.allFactoryData', 'All Factory Data')}
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
        <SectionTwoDemo
          activeActions={[
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'code',
            'clearFormatting',
          ]}
          content="<p>{i18n.t('sectionTwo.story.allFormattingInDropdown', 'All formatting in dropdown')}</p>"
          mainActionCount={0}
          selectionNeedle="formatting"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Some Main Actions (mainActionCount: 3)</p>
        <SectionTwoDemo
          activeActions={[
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'code',
            'clearFormatting',
          ]}
          content="<p>{i18n.t('sectionTwo.story.mixedMainAndDropdown', 'Mixed main and dropdown')}</p>"
          mainActionCount={3}
          selectionNeedle="Mixed"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">All Main Actions (mainActionCount: 6)</p>
        <SectionTwoDemo
          activeActions={[
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'code',
            'clearFormatting',
          ]}
          content="<p>{i18n.t('sectionTwo.story.allFormattingAsButtons', 'All formatting as buttons')}</p>"
          mainActionCount={6}
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
          {i18n.t('sectionTwo.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <SectionTwoDemo
            activeActions={['bold', 'italic', 'underline']}
            content="<p>{i18n.t('sectionTwo.story.compactView', 'Compact view')}</p>"
            mainActionCount={0}
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionTwo.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <SectionTwoDemo
            activeActions={['bold', 'italic', 'underline', 'strikethrough']}
            content="<p>{i18n.t('sectionTwo.story.mediumView', 'Medium view')}</p>"
            mainActionCount={2}
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionTwo.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <SectionTwoDemo
            activeActions={[
              'bold',
              'italic',
              'underline',
              'strikethrough',
              'code',
              'clearFormatting',
            ]}
            content="<p>{i18n.t('sectionTwo.story.fullWidthView', 'Full width view')}</p>"
            mainActionCount={6}
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
  name: i18n.t('sectionTwo.storyName.accessibility', 'Accessibility'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test toggle buttons are keyboard accessible
    const boldButton = canvas.getByRole('button', { name: 'Bold' });
    expect(boldButton).toBeInTheDocument();

    boldButton.focus();
    expect(document.activeElement).toBe(boldButton);

    // Toggle with keyboard
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(boldButton.getAttribute('data-state')).toBe('on');
    });

    // Tab to next button
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
  name: i18n.t('sectionTwo.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sectionTwo.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sectionTwo.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sectionTwo.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
