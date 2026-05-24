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
import { SectionFive } from '@/components/ui/custom/minimal-tiptap/components/section/five';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type SectionFiveDemoProps = {
  _actionStub?: unknown;
  mainActionCount: number;
};

function SectionFiveDemo({ mainActionCount }: SectionFiveDemoProps) {
  return (
    <MinimalTiptapStoryHarness
      content={`<p>${i18n.t('sectionFive.story.insertElementsLinkImageCodeBlockBlockquo', 'Insert elements: link, image, code block, blockquote, divider.')}</p>`}
      toolbar={(editor) => (
        <SectionFive
          editor={editor}
          mainActionCount={mainActionCount}
          labels={{
            insertElements: i18n.t('minimalTiptap.sectionFive.insertElements'),
            codeBlock: i18n.t('minimalTiptap.sectionFive.codeBlock'),
            blockquote: i18n.t('minimalTiptap.sectionFive.blockquote'),
            divider: i18n.t('minimalTiptap.sectionFive.divider'),
            linkEditPopover: {
              tooltip: i18n.t('minimalTiptap.linkEditPopover.tooltip'),
              ariaLabel: i18n.t('minimalTiptap.linkEditPopover.ariaLabel'),
              editBlock: {
                urlLabel: i18n.t('minimalTiptap.link.urlLabel'),
                urlPlaceholder: i18n.t('minimalTiptap.link.urlPlaceholder'),
                textLabel: i18n.t('minimalTiptap.link.textLabel'),
                textPlaceholder: i18n.t('minimalTiptap.link.textPlaceholder'),
                openInNewTab: i18n.t('minimalTiptap.link.openInNewTab'),
                save: i18n.t('minimalTiptap.link.save'),
              },
            },
            imageEditDialog: {
              trigger: i18n.t('minimalTiptap.imageEditDialog.trigger'),
              dialogTitle: i18n.t('minimalTiptap.imageEditDialog.dialogTitle'),
              dialogDescription: i18n.t('minimalTiptap.imageEditDialog.dialogDescription'),
              editBlock: {
                attachLink: i18n.t('minimalTiptap.imageEditBlock.attachLink'),
                placeholder: i18n.t('minimalTiptap.imageEditBlock.placeholder'),
                submit: i18n.t('minimalTiptap.imageEditBlock.submit'),
                upload: i18n.t('minimalTiptap.imageEditBlock.upload'),
                fileInputAriaLabel: i18n.t('minimalTiptap.imageEditBlock.fileInputAriaLabel'),
              },
            },
          }}
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Section Five',
  component: SectionFiveDemo,
  tags: ['autodocs'],
  args: {
    mainActionCount: 0,
    _actionStub: fn(),
  },
  argTypes: {
    // Appearance
    mainActionCount: {
      control: { type: 'number' },
      description: i18n.t(
        'sectionFive.argType.numberOfActionsShownInMainToolbarRestInDropdown',
        'Number of actions shown in main toolbar (rest in dropdown)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // SectionFive Props Reference (Insert Elements):
    // - editor: Tiptap editor instance (Editor, required)
    // - mainActionCount: Actions in main toolbar (number, default: 0)
    // - labels: Localization labels (Labels)
    //   - insertElements: Dropdown trigger text
    //   - codeBlock: Code block action label
    //   - blockquote: Blockquote action label
    //   - divider: Horizontal divider action label
    //   - linkEditPopover: Link insertion popover labels
    //   - imageEditDialog: Image insertion dialog labels
    //
    // Insert Actions:
    // - Link: Opens popover with URL/text fields
    // - Image: Opens dialog for URL or file upload
    // - Code Block: Inserts fenced code block
    // - Blockquote: Inserts quote block
    // - Divider: Inserts horizontal rule
    //
    // Nested Label Structures:
    // - linkEditPopover: { tooltip, ariaLabel, editBlock: { urlLabel, urlPlaceholder, textLabel, textPlaceholder, openInNewTab, save } }
    // - imageEditDialog: { trigger, dialogTitle, dialogDescription, editBlock: { attachLink, placeholder, submit, upload, fileInputAriaLabel } }
    //
    // Usage Notes:
    // - Part of MinimalTiptap toolbar sections
    // - Requires Link, Image, CodeBlock, Blockquote, HorizontalRule extensions
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SectionFiveDemo>;

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

    expect(canvasElement.querySelector('[data-slot="section-five"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Insert elements' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await userEvent.click(trigger);
    expect(await root.findByText('Code block')).toBeInTheDocument();
    expect(await root.findByText('Blockquote')).toBeInTheDocument();
    expect(await root.findByText('Divider')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Insert elements' });
    expect(trigger).toBeInTheDocument();

    // Open dropdown and insert code block
    await userEvent.click(trigger);
    const codeBlockOption = await root.findByText('Code block');
    expect(codeBlockOption).toBeInTheDocument();
    await userEvent.click(codeBlockOption);

    // Verify dropdown closed
    await waitFor(() => {
      expect(root.queryByText('Code block')).not.toBeInTheDocument();
    });

    // Open again and insert blockquote
    await userEvent.click(trigger);
    const blockquoteOption = await root.findByText('Blockquote');
    expect(blockquoteOption).toBeInTheDocument();
    await userEvent.click(blockquoteOption);

    // Verify dropdown closed
    await waitFor(() => {
      expect(root.queryByText('Blockquote')).not.toBeInTheDocument();
    });

    // Open again and insert divider
    await userEvent.click(trigger);
    const dividerOption = await root.findByText('Divider');
    expect(dividerOption).toBeInTheDocument();
    await userEvent.click(dividerOption);

    // Verify dropdown closed
    await waitFor(() => {
      expect(root.queryByText('Divider')).not.toBeInTheDocument();
    });
  },
};

export const AllMainActions: Story = {
  ...Default,
  name: i18n.t('sectionFive.storyName.allMainActions', 'All main actions (no dropdown)'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 3,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.queryByRole('button', { name: 'Insert elements' })).not.toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Code block' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Blockquote' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Divider' })).toBeInTheDocument();
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

    await userEvent.click(canvas.getByRole('button', { name: '要素を挿入' }));
    expect(await root.findByText('コードブロック')).toBeInTheDocument();
    expect(await root.findByText('引用')).toBeInTheDocument();
    expect(await root.findByText('区切り線')).toBeInTheDocument();
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
  name: i18n.t('sectionFive.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('sectionFive.story.allFactoryData', 'All Factory Data')}
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
        <SectionFiveDemo mainActionCount={0} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Some Main Actions (mainActionCount: 2)</p>
        <SectionFiveDemo mainActionCount={2} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">All Main Actions (mainActionCount: 5)</p>
        <SectionFiveDemo mainActionCount={5} />
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
          {i18n.t('sectionFive.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <SectionFiveDemo mainActionCount={0} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionFive.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <SectionFiveDemo mainActionCount={2} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionFive.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <SectionFiveDemo mainActionCount={3} />
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
  name: i18n.t('sectionFive.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = within(document.body);

    // Test insert elements dropdown trigger is keyboard accessible
    const trigger = canvas.getByRole('button', { name: 'Insert elements' });
    expect(trigger).toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open dropdown with keyboard
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(root.getByText('Code block')).toBeInTheDocument();
    });

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Select blockquote with Enter
    await userEvent.keyboard('{Enter}');

    // Dropdown should close
    await waitFor(() => {
      expect(root.queryByText('Code block')).not.toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sectionFive.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sectionFive.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sectionFive.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sectionFive.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
