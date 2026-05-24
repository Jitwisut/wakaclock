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
import type { MouseEvent } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { LinkPopoverBlock } from '@/components/ui/custom/minimal-tiptap/components/link/link-popover-block';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

type LinkPopoverBlockDemoProps = {
  onClear?: () => void;
  onCopy?: (url: string) => Promise<void> | void;
  onEdit?: (e: MouseEvent<HTMLButtonElement>) => void;
  url: string;
};

function LinkPopoverBlockDemo({ url, onClear, onCopy, onEdit }: LinkPopoverBlockDemoProps) {
  return (
    <div className="flex items-center justify-center">
      <LinkPopoverBlock
        labels={{
          editLink: i18n.t('minimalTiptap.link.editLink'),
          openLink: i18n.t('minimalTiptap.link.openLink'),
          clearLink: i18n.t('minimalTiptap.link.clearLink'),
          copy: i18n.t('minimalTiptap.link.copy'),
          copied: i18n.t('minimalTiptap.link.copied'),
        }}
        url={url}
        onClear={onClear ?? (() => undefined)}
        onCopy={onCopy}
        onEdit={onEdit ?? ((e) => e.preventDefault())}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Link Popover Block',
  component: LinkPopoverBlockDemo,
  tags: ['autodocs'],
  args: {
    url: 'https://example.com',
    onClear: undefined,
    onCopy: undefined,
    onEdit: undefined,
  },
  argTypes: {
    // Content
    url: {
      control: { type: 'text' },
      description: i18n.t(
        'linkPopoverBlock.argType.urlToDisplayAndActUpon',
        'URL to display and act upon'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // Events
    onClear: {
      action: 'onClear',
      description: i18n.t(
        'linkPopoverBlock.argType.calledWhenClearLinkIsClicked',
        'Called when "Clear link" is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onCopy: {
      action: 'onCopy',
      description: i18n.t(
        'linkPopoverBlock.argType.calledWhenCopyIsClickedWithUrl',
        'Called when "Copy" is clicked with URL'
      ),
      table: {
        category: 'Events',
        type: { summary: '(url: string) => Promise<void> | void' },
      },
    },
    onEdit: {
      action: 'onEdit',
      description: i18n.t(
        'linkPopoverBlock.argType.calledWhenEditLinkIsClicked',
        'Called when "Edit link" is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '(e: MouseEvent) => void' },
      },
    },
    // LinkPopoverBlock Props Reference:
    // - url: The link URL to display (string, required)
    // - labels: Localization labels (Labels)
    //   - editLink: "Edit link" button label
    //   - openLink: "Open link" button label
    //   - clearLink: "Clear link" button label
    //   - copy: "Copy" button label
    //   - copied: "Copied!" tooltip after copy
    // - onEdit: Edit button click handler
    // - onClear: Clear button click handler
    // - onCopy: Copy button click handler
    //
    // Action Buttons:
    // - Edit: Opens link editor
    // - Open: Opens URL in new tab (window.open)
    // - Clear: Removes link from selection
    // - Copy: Copies URL to clipboard
    //
    // Copy Behavior:
    // - Tooltip changes to "Copied!" after click
    // - Resets after brief delay
    //
    // Usage:
    // - Shown inside LinkBubbleMenu
    // - Appears when clicking existing link
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LinkPopoverBlockDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="link-popover-block"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByRole('button', { name: 'Edit link' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Open link in a new tab' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Clear link' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const CopySuccess: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.copySuccess', 'Copy (success)'),
  args: {
    ...(Default.args ?? {}),
    onCopy: fn(),
  },
  play: async ({ args, canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    const copy = canvas.getByRole('button', { name: 'Copy' });
    await userEvent.hover(copy);
    expect(await root.findByText('Copy')).toBeInTheDocument();

    await userEvent.click(copy);
    await userEvent.hover(copy);
    expect(await root.findByText('Copied!')).toBeInTheDocument();

    expect(args.onCopy).toHaveBeenCalledTimes(1);
    expect(args.onCopy).toHaveBeenCalledWith('https://example.com');
  },
};

export const Edit: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.edit', 'Edit (action)'),
  args: {
    ...(Default.args ?? {}),
    onEdit: fn(),
  },
  play: async ({ args, canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit link' }));

    expect(args.onEdit).toHaveBeenCalledTimes(1);
  },
};

export const Clear: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.clear', 'Clear (action)'),
  args: {
    ...(Default.args ?? {}),
    onClear: fn(),
  },
  play: async ({ args, canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear link' }));

    expect(args.onClear).toHaveBeenCalledTimes(1);
  },
};

export const OpenLink: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.openLink', 'Open link (window.open)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    if (typeof window === 'undefined') {
      throw new Error('Story requires a browser environment.');
    }

    const originalOpen = window.open;
    const openSpy = fn(() => null);

    try {
      window.open = openSpy as unknown as typeof window.open;

      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole('button', { name: 'Open link in a new tab' }));
    } finally {
      window.open = originalOpen;
    }

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
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

    const canvas = within(canvasElement);
    expect(canvas.getByRole('button', { name: 'リンクを編集' })).toBeInTheDocument();
  },
};

export const LongUrl: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    url: 'https://example.com/very/long/path/to/resource/that/might/wrap/in/small/containers',
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
  name: i18n.t('linkPopoverBlock.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('linkPopoverBlock.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('linkPopoverBlock.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkPopoverBlock.story.defaultUrl', 'Default URL')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkPopoverBlock.story.longUrl', 'Long URL')}
          </div>
          <LinkPopoverBlockDemo
            url="https://example.com/very/long/path/to/resource/that/might/wrap"
            onClear={fn()}
            onEdit={fn()}
            onCopy={fn()}
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
  name: i18n.t('linkPopoverBlock.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkPopoverBlock.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[250px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkPopoverBlock.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[400px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkPopoverBlock.story.largeContainer', 'Large container')}
          </div>
          <div className="max-w-[600px]">
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
  name: i18n.t('linkPopoverBlock.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('linkPopoverBlock.storyName.loading', 'Loading'),
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
  name: i18n.t('linkPopoverBlock.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('linkPopoverBlock.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('linkPopoverBlock.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('linkPopoverBlock.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'linkPopoverBlock.storyName.error500InternalServerError',
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
  name: i18n.t('linkPopoverBlock.storyName.networkError', 'Network Error'),
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
  name: i18n.t('linkPopoverBlock.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test all action buttons have proper aria-labels
    const editButton = canvas.getByRole('button', { name: 'Edit link' });
    expect(editButton).toBeInTheDocument();

    const openButton = canvas.getByRole('button', { name: 'Open link in a new tab' });
    expect(openButton).toBeInTheDocument();

    const clearButton = canvas.getByRole('button', { name: 'Clear link' });
    expect(clearButton).toBeInTheDocument();

    const copyButton = canvas.getByRole('button', { name: 'Copy' });
    expect(copyButton).toBeInTheDocument();

    // Test keyboard navigation between buttons
    editButton.focus();
    expect(document.activeElement).toBe(editButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(openButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(clearButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(copyButton);

    // Test keyboard activation
    editButton.focus();
    await userEvent.keyboard('{Enter}');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('linkPopoverBlock.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
