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
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { LinkBubbleMenu } from '@/components/ui/custom/minimal-tiptap/components/bubble-menu/link-bubble-menu';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

function LinkBubbleMenuDemo() {
  const { t } = useTranslation();

  const labels = {
    editBlock: {
      urlLabel: t('minimalTiptap.link.urlLabel'),
      urlPlaceholder: t('minimalTiptap.link.urlPlaceholder'),
      textLabel: t('minimalTiptap.link.textLabel'),
      textPlaceholder: t('minimalTiptap.link.textPlaceholder'),
      openInNewTab: t('minimalTiptap.link.openInNewTab'),
      save: t('minimalTiptap.link.save'),
    },
    popoverBlock: {
      editLink: t('minimalTiptap.link.editLink'),
      openLink: t('minimalTiptap.link.openLink'),
      clearLink: t('minimalTiptap.link.clearLink'),
      copy: t('minimalTiptap.link.copy'),
      copied: t('minimalTiptap.link.copied'),
    },
  };

  return (
    <MinimalTiptapStoryHarness
      content={`<p><a href="https://example.com" target="_blank">${t('linkBubbleMenu.story.exampleLink', 'Example link')}</a></p><p>Select the link text to show the bubble menu.</p>`}
      onReady={(editor) => {
        requestAnimationFrame(() => {
          const needle = 'Example link';
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
      showEditor
    >
      {(editor) => <LinkBubbleMenu editor={editor} labels={labels} />}
    </MinimalTiptapStoryHarness>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Link Bubble Menu',
  component: LinkBubbleMenuDemo,
  tags: ['autodocs'],
  args: {
    _actionStub: fn(),
  },
  argTypes: {
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // LinkBubbleMenu Props Reference:
    // - editor: Tiptap editor instance (Editor, required)
    // - labels: Localization labels object (Labels)
    //   - editBlock: Link edit form labels
    //     - urlLabel, urlPlaceholder, textLabel, textPlaceholder
    //     - openInNewTab, save
    //   - popoverBlock: Action button labels
    //     - editLink, openLink, clearLink, copy, copied
    //
    // Behavior:
    // - Appears when selecting existing link text
    // - Shows URL preview and action buttons
    // - Click "Edit link" to modify URL/text
    // - Click "Clear link" to remove link
    // - Click "Copy" to copy URL to clipboard
    // - Opens in bubble menu (floating) position
    //
    // Integration:
    // - Uses BubbleMenu from @tiptap/react
    // - Contains LinkPopoverBlock for actions
    // - Contains LinkEditBlock for editing
    // - Part of MinimalTiptap editor toolbar
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LinkBubbleMenuDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(document.querySelector('[data-slot="link-bubble-menu"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText('Example link')).toBeInTheDocument();

    const root = within(document.body);
    expect(await root.findByRole('button', { name: 'Edit link' })).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Editing: Story = {
  ...Default,
  name: i18n.t('linkBubbleMenu.storyName.editing', 'Editing (link editor)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const root = within(document.body);
    const edit = await root.findByRole('button', { name: 'Edit link' });
    await userEvent.click(edit);
    expect(await root.findByText('URL')).toBeInTheDocument();
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
    expect(document.querySelector('[data-slot="link-bubble-menu"]')).toBeInTheDocument();
    const canvas = within(canvasElement);
    expect(canvas.getByText('Example link')).toBeInTheDocument();
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

    const root = within(document.body);
    expect(await root.findByText('リンクを編集')).toBeInTheDocument();
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
  name: i18n.t('linkBubbleMenu.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('linkBubbleMenu.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('linkBubbleMenu.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkBubbleMenu.story.defaultPopover', 'Default (popover)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Editing (link editor)
          </div>
          <p className="text-muted-foreground text-xs">
            Click &quot;Edit link&quot; in the bubble menu to see the editing state.
          </p>
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
  name: i18n.t('linkBubbleMenu.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkBubbleMenu.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[350px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkBubbleMenu.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[550px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkBubbleMenu.story.largeContainer', 'Large container')}
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
  name: i18n.t('linkBubbleMenu.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('linkBubbleMenu.storyName.loading', 'Loading'),
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
  name: i18n.t('linkBubbleMenu.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('linkBubbleMenu.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('linkBubbleMenu.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('linkBubbleMenu.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'linkBubbleMenu.storyName.error500InternalServerError',
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
  name: i18n.t('linkBubbleMenu.storyName.networkError', 'Network Error'),
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
  name: i18n.t('linkBubbleMenu.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement: _canvasElement }) => {
    const root = within(document.body);

    // Test bubble menu buttons are keyboard accessible
    const editButton = await root.findByRole('button', { name: 'Edit link' });
    expect(editButton).toBeInTheDocument();

    // Test Tab navigation between bubble menu buttons
    editButton.focus();
    expect(document.activeElement).toBe(editButton);

    await userEvent.tab();
    const openButton = root.getByRole('button', { name: 'Open link' });
    expect(document.activeElement).toBe(openButton);

    await userEvent.tab();
    const copyButton = root.getByRole('button', { name: 'Copy link' });
    expect(document.activeElement).toBe(copyButton);

    // Test keyboard activation of edit button
    editButton.focus();
    await userEvent.keyboard('{Enter}');

    // Edit form should appear
    await waitFor(() => {
      expect(root.getByLabelText('URL')).toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('linkBubbleMenu.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('linkBubbleMenu.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('linkBubbleMenu.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('linkBubbleMenu.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
