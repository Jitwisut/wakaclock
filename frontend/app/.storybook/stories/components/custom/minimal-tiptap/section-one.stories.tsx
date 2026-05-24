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
import { SectionOne } from '@/components/ui/custom/minimal-tiptap/components/section/one';
import type { Level } from '@tiptap/extension-heading';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type SectionOneDemoProps = {
  _actionStub?: unknown;
  activeLevels: Level[];
  content: string;
  selectionNeedle: string;
};

function SectionOneDemo({ activeLevels, content, selectionNeedle }: SectionOneDemoProps) {
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
        <SectionOne
          editor={editor}
          activeLevels={activeLevels}
          labels={{
            textStyles: i18n.t('minimalTiptap.sectionOne.textStyles'),
            normalText: i18n.t('minimalTiptap.sectionOne.normalText'),
            heading1: i18n.t('minimalTiptap.sectionOne.heading1'),
            heading2: i18n.t('minimalTiptap.sectionOne.heading2'),
            heading3: i18n.t('minimalTiptap.sectionOne.heading3'),
            heading4: i18n.t('minimalTiptap.sectionOne.heading4'),
            heading5: i18n.t('minimalTiptap.sectionOne.heading5'),
            heading6: i18n.t('minimalTiptap.sectionOne.heading6'),
          }}
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Section One',
  component: SectionOneDemo,
  tags: ['autodocs'],
  args: {
    activeLevels: [1, 2, 3, 4, 5, 6],
    content: `<p>${i18n.t('sectionOne.story.useTheMenuToApplyHeadings', 'Use the menu to apply headings.')}</p>`,
    selectionNeedle: 'headings',
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    activeLevels: {
      control: { type: 'object' },
      description: i18n.t(
        'sectionOne.argType.headingLevelsToShowInDropdown16',
        'Heading levels to show in dropdown (1-6)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Level[]' },
        defaultValue: { summary: '[1, 2, 3, 4, 5, 6]' },
      },
    },
    content: {
      control: { type: 'text' },
      description: i18n.t(
        'sectionOne.argType.initialHtmlContentForEditorDemoProp',
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
        'sectionOne.argType.textToAutoselectOnLoadDemoProp',
        'Text to auto-select on load (demo prop)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // SectionOne Props Reference (Heading Selector):
    // - editor: Tiptap editor instance (Editor, required)
    // - activeLevels: Heading levels to display (Level[], default: [1,2,3,4,5,6])
    // - labels: Localization labels (Labels)
    //   - textStyles: Dropdown trigger text (string)
    //   - normalText: Normal paragraph option (string)
    //   - heading1-6: Heading level labels (string)
    //
    // Level Type: 1 | 2 | 3 | 4 | 5 | 6
    //
    // Dropdown Options:
    // - Normal Text: Paragraph format (p tag)
    // - Heading 1-6: H1-H6 tags based on activeLevels
    //
    // State Behavior:
    // - Shows current format in trigger button
    // - Disabled when cursor is in code block
    // - Selection is preserved when changing format
    //
    // Usage Notes:
    // - Part of MinimalTiptap toolbar sections
    // - Limit activeLevels for simpler UIs
    // - Requires Heading extension in Tiptap
    // - Uses DropdownMenu for selection UI
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SectionOneDemo>;

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

    expect(canvasElement.querySelector('[data-slot="section-one"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Text styles' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await userEvent.click(trigger);
    expect(await root.findByText('Normal Text')).toBeInTheDocument();
    expect(await root.findByText('Heading 1')).toBeInTheDocument();
    expect(await root.findByText('Heading 6')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Text styles' });
    expect(trigger).toBeInTheDocument();

    // Open dropdown and select Heading 1
    await userEvent.click(trigger);
    const heading1Option = await root.findByText('Heading 1');
    expect(heading1Option).toBeInTheDocument();
    await userEvent.click(heading1Option);

    // Verify dropdown closed and trigger updated
    await waitFor(() => {
      expect(root.queryByText('Normal Text')).not.toBeInTheDocument();
    });

    // Re-open and verify Heading 1 is now indicated as selected
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(root.getByText('Heading 1')).toBeInTheDocument();
    });
  },
};

export const LimitedLevels: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.limitedLevels', 'Limited levels (H1 + H2)'),
  args: {
    ...(Default.args ?? {}),
    activeLevels: [1, 2],
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Text styles' }));
    expect(await root.findByText('Heading 2')).toBeInTheDocument();
    expect(root.queryByText('Heading 3')).not.toBeInTheDocument();
  },
};

export const DisabledInCodeBlock: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  args: {
    ...(Default.args ?? {}),
    content: `<pre><code>${i18n.t('sectionOne.story.useTheMenuToApplyHeadings', 'Use the menu to apply headings.')}</code></pre>`,
    selectionNeedle: 'headings',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Text styles' })).toBeDisabled();
    });
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

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'テキストスタイル' }));
    expect(await root.findByText('標準テキスト')).toBeInTheDocument();
    expect(await root.findByText('見出し 1')).toBeInTheDocument();
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
  name: i18n.t('sectionOne.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('sectionOne.story.allFactoryData', 'All Factory Data')}
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
        <p className="mb-2 text-sm font-medium">All Heading Levels (1-6)</p>
        <SectionOneDemo
          activeLevels={[1, 2, 3, 4, 5, 6]}
          content="<p>{i18n.t('sectionOne.story.fullHeadingSelector', 'Full heading selector')}</p>"
          selectionNeedle="selector"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Limited Levels (H1-H3)</p>
        <SectionOneDemo
          activeLevels={[1, 2, 3]}
          content="<p>{i18n.t('sectionOne.story.simpleHeadingSelector', 'Simple heading selector')}</p>"
          selectionNeedle="selector"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Minimal Levels (H1-H2)</p>
        <SectionOneDemo
          activeLevels={[1, 2]}
          content="<p>{i18n.t('sectionOne.story.minimalHeadingSelector', 'Minimal heading selector')}</p>"
          selectionNeedle="selector"
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
          {i18n.t('sectionOne.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <SectionOneDemo
            activeLevels={[1, 2]}
            content="<p>{i18n.t('sectionOne.story.compactView', 'Compact view')}</p>"
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionOne.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <SectionOneDemo
            activeLevels={[1, 2, 3, 4]}
            content="<p>{i18n.t('sectionOne.story.mediumView', 'Medium view')}</p>"
            selectionNeedle="view"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionOne.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <SectionOneDemo
            activeLevels={[1, 2, 3, 4, 5, 6]}
            content="<p>{i18n.t('sectionOne.story.fullWidthView', 'Full width view')}</p>"
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
  name: i18n.t('sectionOne.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = within(document.body);

    // Test dropdown trigger is keyboard accessible
    const trigger = canvas.getByRole('button', { name: 'Text styles' });
    expect(trigger).toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open dropdown with keyboard
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(root.getByText('Normal Text')).toBeInTheDocument();
    });

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Select with Enter
    await userEvent.keyboard('{Enter}');

    // Close dropdown with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(root.queryByText('Normal Text')).not.toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sectionOne.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
