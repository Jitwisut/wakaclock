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
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { LinkEditPopover } from '@/components/ui/custom/minimal-tiptap/components/link/link-edit-popover';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type LinkEditPopoverDemoProps = {
  _actionStub?: unknown;
  content: string;
  selectionNeedle: string;
};

function LinkEditPopoverDemo({ content, selectionNeedle }: LinkEditPopoverDemoProps) {
  const labels = {
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
  };

  return (
    <MinimalTiptapStoryHarness
      content={content}
      onReady={(editor) => {
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
      }}
      toolbar={(editor) => <LinkEditPopover editor={editor} labels={labels} />}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Link Edit Popover',
  component: LinkEditPopoverDemo,
  tags: ['autodocs'],
  args: {
    content: `<p>${i18n.t('linkEditPopover.story.selectTextThenClickTheLinkIcon', 'Select text, then click the link icon.')}</p><p>${i18n.t('linkEditPopover.story.linkMe', 'Link me')}</p>`,
    selectionNeedle: 'Link me',
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    content: {
      control: { type: 'text' },
      description: i18n.t(
        'linkEditPopover.argType.initialHtmlContentForEditorDemoProp',
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
        'linkEditPopover.argType.textToAutoselectOnLoadDemoProp',
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
    // LinkEditPopover Props Reference:
    // - editor: Tiptap editor instance (Editor, required)
    // - labels: Localization labels (Labels)
    //   - tooltip: Tooltip for trigger button
    //   - ariaLabel: Accessible label for trigger
    //   - editBlock: LinkEditBlock labels (nested)
    //
    // Trigger Button:
    // - Icon button with link icon
    // - Disabled in code blocks
    // - Opens popover on click
    //
    // Popover Content:
    // - Contains LinkEditBlock form
    // - Auto-populates text from selection
    // - Closes on save or click outside
    //
    // Link Insertion:
    // - Creates <a> tag with href
    // - Optionally adds target="_blank"
    // - Replaces selected text with link text
    //
    // State Behavior:
    // - Disabled when cursor is in code block
    // - Enabled when text is selected or cursor in paragraph
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LinkEditPopoverDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

async function waitForEditorSelection() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="link-edit-popover"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const trigger = await waitFor(() => canvas.getByRole('button', { name: 'Insert link' }));
    expect(trigger).toBeEnabled();

    await userEvent.click(trigger);

    const root = within(document.body);
    expect(await root.findByText('URL')).toBeInTheDocument();
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
  name: i18n.t('linkEditPopover.storyName.editing', 'Editing (popover open)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Insert link' });
    await userEvent.click(trigger);

    const root = within(document.body);
    expect(await root.findByText('URL')).toBeInTheDocument();
  },
};

export const Save: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.save', 'Save (inserts link)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    await waitForEditorSelection();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Insert link' });
    await userEvent.click(trigger);

    const root = within(document.body);
    const urlInput = (await root.findByLabelText('URL')) as HTMLInputElement;
    await userEvent.type(urlInput, 'https://example.com');

    const textInput = (await root.findByLabelText('Display Text (optional)')) as HTMLInputElement;
    await waitFor(() => {
      expect(textInput.value).toBe('Link me');
    });
    await userEvent.clear(textInput);
    await userEvent.type(textInput, 'Example link');

    await userEvent.click(root.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const link = canvasElement.querySelector('a[href="https://example.com"]');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('Example link');
    });
  },
};

export const OpenInNewTab: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.openInNewTab', 'Open in new tab'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    await waitForEditorSelection();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Insert link' });
    await userEvent.click(trigger);

    const root = within(document.body);
    await userEvent.type(await root.findByLabelText('URL'), 'https://example.com');

    await userEvent.click(root.getByRole('switch', { name: 'Open in New Tab' }));
    await userEvent.click(root.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const link = canvasElement.querySelector('a[href="https://example.com"]');
      expect(link).toBeInTheDocument();
      expect(link?.getAttribute('target')).toBe('_blank');
    });
  },
};

export const Validation: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.validation', 'Validation (required URL)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    await waitForEditorSelection();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Insert link' });
    await userEvent.click(trigger);

    const root = within(document.body);
    const urlInput = (await root.findByLabelText('URL')) as HTMLInputElement;
    expect(urlInput.value).toBe('');
    expect(canvasElement.querySelector('a')).not.toBeInTheDocument();

    await userEvent.click(root.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(canvasElement.querySelector('a')).not.toBeInTheDocument();
      expect(urlInput).toBeInvalid();
    });
  },
};

export const DisabledInCodeBlock: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  args: {
    ...(Default.args ?? {}),
    content: `<pre><code>${i18n.t('linkEditPopover.story.linkMe', 'Link me')}</code></pre>`,
    selectionNeedle: 'Link me',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Insert link' })).toBeDisabled();
    });
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    await waitForEditorSelection();

    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'リンクを挿入' });
    await userEvent.click(trigger);

    const root = within(document.body);
    expect(await root.findByRole('button', { name: '保存' })).toBeInTheDocument();
  },
};

export const EmptySelection: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    content: `<p>${i18n.t('linkEditPopover.story.noTextSelectedHere', 'No text selected here.')}</p>`,
    selectionNeedle: '',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  name: i18n.t('linkEditPopover.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('linkEditPopover.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('linkEditPopover.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditPopover.story.defaultEnabled', 'Default (enabled)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Disabled (in code block)
          </div>
          <LinkEditPopoverDemo
            content="<pre><code>{i18n.t('linkEditPopover.story.linkMe', 'Link me')}</code></pre>"
            selectionNeedle="Link me"
          />
        </div>
      </div>
    ),
  ],
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditPopover.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[350px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditPopover.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[550px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditPopover.story.largeContainer', 'Large container')}
          </div>
          <div className="max-w-[800px]">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('linkEditPopover.storyName.loading', 'Loading'),
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
  name: i18n.t('linkEditPopover.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('linkEditPopover.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('linkEditPopover.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('linkEditPopover.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'linkEditPopover.storyName.error500InternalServerError',
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
  name: i18n.t('linkEditPopover.storyName.networkError', 'Network Error'),
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
  name: i18n.t('linkEditPopover.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test keyboard navigation to trigger button
    const trigger = await waitFor(() => canvas.getByRole('button', { name: 'Insert link' }));
    expect(trigger).toHaveAttribute('type', 'button');

    // Open popover with keyboard
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const root = within(document.body);
    const urlInput = await root.findByLabelText('URL');
    expect(urlInput).toBeInTheDocument();

    // Test Tab navigation within popover
    await userEvent.tab();
    expect(document.activeElement).toBeInstanceOf(HTMLInputElement);

    // Escape closes popover
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(root.queryByLabelText('URL')).not.toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('linkEditPopover.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
