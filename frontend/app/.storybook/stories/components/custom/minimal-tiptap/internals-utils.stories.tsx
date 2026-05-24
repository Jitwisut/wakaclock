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
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import {
  getShortcutKeys,
  isClient,
  isMacOS,
  isServer,
  isUrl,
  randomId,
  sanitizeUrl,
} from '@/components/ui/custom/minimal-tiptap/utils';

import i18n from 'i18next';

seedFaker();

function MinimalTiptapUtilsDemo() {
  const { t } = useTranslation();
  const [nonce, setNonce] = React.useState(1);
  const id = randomId(`minimal-tiptap-utils-${nonce}`);

  const examples = {
    env: { isClient: isClient(), isServer: isServer(), isMacOS: isMacOS() },
    shortcutKeys: getShortcutKeys(['mod', 'alt', 'shift', 'k']),
    urls: {
      isUrl_https: isUrl('https://example.com'),
      isUrl_relative: isUrl('/dashboard'),
      sanitizeUrl_plain: sanitizeUrl('example.com'),
      sanitizeUrl_relative: sanitizeUrl('/dashboard'),
      sanitizeUrl_hash: sanitizeUrl('#section'),
    },
    randomId: id,
  };

  return (
    <div className="w-full max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{t('minimalTiptap.utils.title')}</div>
        <button
          type="button"
          className="bg-background rounded-md border px-3 py-1 text-xs"
          onClick={() => setNonce((value) => value + 1)}
        >
          {t('minimalTiptap.utils.generateId')}
        </button>
      </div>
      <pre
        aria-label={t('minimalTiptap.utils.outputAriaLabel')}
        className="bg-muted overflow-auto rounded-md p-3 text-xs"
      >
        {JSON.stringify(examples, null, 2)}
      </pre>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Internals/Utils',
  component: MinimalTiptapUtilsDemo,
  tags: ['autodocs'],
  args: {
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    // (Displays utility function outputs in JSON format)
    // Appearance
    // (Card layout with heading, button, and pre block)
    // State
    // (Interactive - regenerates random ID on button click)
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'internalsUtils.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Reference
    // (Documentation component - demonstrates utility functions)
    // Utils Reference:
    // Available Utility Functions:
    //
    // Environment Detection:
    // - isClient(): boolean - Check if running in browser
    // - isServer(): boolean - Check if running on server (SSR)
    // - isMacOS(): boolean - Check if macOS platform
    //
    // Keyboard Shortcuts:
    // - getShortcutKeys(keys: string[]): string[]
    //   Converts key names to platform-specific symbols
    //   'mod' → ⌘ (Mac) or Ctrl (others)
    //   'alt' → ⌥ (Mac) or Alt (others)
    //   'shift' → ⇧
    //
    // URL Utilities:
    // - isUrl(string): boolean - Validates URL format
    // - sanitizeUrl(string): string - Normalizes URL
    //   - Adds https:// if no protocol
    //   - Preserves relative paths (/path)
    //   - Preserves hash links (#section)
    //
    // ID Generation:
    // - randomId(prefix: string): string
    //   Generates deterministic ID from prefix
    //   Useful for stable element IDs
    //
    // Usage Notes:
    // - These utils are used internally by MinimalTiptap
    // - Can be imported for custom implementations
    // - All functions are tree-shakeable
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapUtilsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const output = canvas.getByLabelText('Utils output');
    await expect(output).toHaveTextContent(randomId('minimal-tiptap-utils-1'));

    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await expect(output).toHaveTextContent(randomId('minimal-tiptap-utils-2'));
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
    expect(canvas.getByLabelText('Utils output')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
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
    expect(canvas.getByLabelText('Utils output')).toBeInTheDocument();
    expect(canvas.getByRole('button')).toBeInTheDocument();
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
    expect(canvas.getByText('ユーティリティ関数')).toBeInTheDocument();
    expect(canvas.getByText('IDを生成')).toBeInTheDocument();
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
  name: i18n.t('internalsUtils.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('internalsUtils.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('internalsUtils.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsUtils.story.defaultUtilsDemo', 'Default utils demo')}
          </div>
          <Story />
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
  name: i18n.t('internalsUtils.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsUtils.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[300px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsUtils.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[500px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsUtils.story.largeContainer', 'Large container')}
          </div>
          <div className="max-w-[700px]">
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
  name: i18n.t('internalsUtils.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('internalsUtils.storyName.loading', 'Loading'),
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
  name: i18n.t('internalsUtils.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('internalsUtils.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('internalsUtils.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('internalsUtils.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'internalsUtils.storyName.error500InternalServerError',
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
  name: i18n.t('internalsUtils.storyName.networkError', 'Network Error'),
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
  name: i18n.t('internalsUtils.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test output has proper aria-label
    const output = canvas.getByLabelText('Utils output');
    expect(output).toBeInTheDocument();
    expect(output.tagName).toBe('PRE');

    // Test button is keyboard accessible
    const button = canvas.getByRole('button');
    expect(button).toBeInTheDocument();

    button.focus();
    expect(document.activeElement).toBe(button);

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(output).toHaveTextContent(randomId('minimal-tiptap-utils-2'));
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('internalsUtils.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('internalsUtils.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('internalsUtils.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('internalsUtils.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
