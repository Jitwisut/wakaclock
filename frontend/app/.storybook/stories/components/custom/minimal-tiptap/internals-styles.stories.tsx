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

import '@/components/ui/custom/minimal-tiptap/styles/index.css';

import i18n from 'i18next';

seedFaker();

// Keep explicit references to the partial style files for coverage/traceability.
const STYLE_PARTIALS = [
  '@/components/ui/custom/minimal-tiptap/styles/partials/code.css',
  '@/components/ui/custom/minimal-tiptap/styles/partials/lists.css',
  '@/components/ui/custom/minimal-tiptap/styles/partials/placeholder.css',
  '@/components/ui/custom/minimal-tiptap/styles/partials/typography.css',
  '@/components/ui/custom/minimal-tiptap/styles/partials/zoom.css',
];

function MinimalTiptapStylesDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-3xl space-y-4">
      <div className="bg-background rounded-md border p-4">
        <div className="text-sm font-medium">{t('minimalTiptap.internals.styles.entryTitle')}</div>
        <div className="text-muted-foreground mt-1 text-sm">
          {t('minimalTiptap.internals.styles.entryDescriptionPrefix')}{' '}
          <code className="font-mono text-xs">styles/index.css</code>{' '}
          {t('minimalTiptap.internals.styles.entryDescriptionSuffix')}
        </div>
      </div>

      <div className="minimal-tiptap-editor bg-background rounded-md border p-4">
        <div className="ProseMirror">
          <p
            className="text-node is-editor-empty"
            data-placeholder={t('minimalTiptap.internals.styles.placeholder')}
          />
          <p className="text-node">
            Typography: <strong>bold</strong>, <em>italic</em>, <code>inline code</code>,{' '}
            <a className="link" href="#styles">
              link
            </a>
          </p>
          <ul className="list-node">
            <li>{t('internalsStyles.story.listItemOne', 'List item one')}</li>
            <li>{t('internalsStyles.story.listItemTwo', 'List item two')}</li>
          </ul>
          <pre className="block-node">
            <code>{`const hello = (name: string) => \`Hello, \${name}\`;`}</code>
          </pre>
        </div>
      </div>

      <details className="bg-background rounded-md border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t('minimalTiptap.internals.styles.partialsHeading')}
        </summary>
        <pre className="bg-muted mt-3 overflow-auto rounded-md p-3 text-xs">
          {JSON.stringify(STYLE_PARTIALS, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Internals/Styles',
  component: MinimalTiptapStylesDemo,
  tags: ['autodocs'],
  args: {
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    // (Demonstrates style partials and CSS classes)
    // Appearance
    // (Showcases editor typography, lists, code blocks)
    // State
    // (Static display with expandable partials section)
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'internalsStyles.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Reference
    // (Documentation component - lists style partials)
    // Styles Reference:
    // Entry Point: styles/index.css
    // - Imports all partial stylesheets
    // - Provides base editor styling
    //
    // Style Partials:
    // - partials/code.css: Code block and inline code styling
    // - partials/lists.css: Ordered and unordered list styling
    // - partials/placeholder.css: Empty editor placeholder text
    // - partials/typography.css: Text formatting (bold, italic, links)
    // - partials/zoom.css: Editor zoom functionality styles
    //
    // CSS Classes:
    // - .minimal-tiptap-editor: Root editor container
    // - .ProseMirror: TipTap content container
    // - .text-node: Paragraph elements
    // - .block-node: Block-level elements (pre, blockquote)
    // - .list-node: List containers (ul, ol)
    // - .is-editor-empty: Empty paragraph with placeholder
    // - .link: Anchor elements within editor
    //
    // Customization:
    // - Styles use CSS custom properties
    // - Theme-aware via Tailwind classes
    // - Override via .minimal-tiptap-editor selector
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapStylesDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('Styles entry')).toBeInTheDocument();
    expect(canvas.getByText(/Typography:/)).toBeInTheDocument();
    expect(canvas.getByText('List item one')).toBeInTheDocument();

    const summary = canvas.getByText('Referenced partials');
    const details = summary.closest('details');

    if (!(details instanceof HTMLDetailsElement)) {
      throw new TypeError('Partials section was not rendered.');
    }

    expect(details).toHaveProperty('open', false);
    await userEvent.click(summary);
    expect(details).toHaveProperty('open', true);
    expect(canvas.getByText(/partials\/code\.css/)).toBeInTheDocument();
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
    expect(canvas.getByText('Styles entry')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
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
    expect(canvas.getByText('Styles entry')).toBeInTheDocument();
    expect(canvasElement.querySelector('.ProseMirror')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('スタイルエントリ')).toBeInTheDocument();
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
  name: i18n.t('internalsStyles.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('internalsStyles.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('internalsStyles.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsStyles.story.defaultStylesDemo', 'Default styles demo')}
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
  name: i18n.t('internalsStyles.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsStyles.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[350px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsStyles.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[550px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsStyles.story.largeContainer', 'Large container')}
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
  name: i18n.t('internalsStyles.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('internalsStyles.storyName.loading', 'Loading'),
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
  name: i18n.t('internalsStyles.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('internalsStyles.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('internalsStyles.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('internalsStyles.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'internalsStyles.storyName.error500InternalServerError',
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
  name: i18n.t('internalsStyles.storyName.networkError', 'Network Error'),
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
  name: i18n.t('internalsStyles.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test details/summary is keyboard accessible
    const summary = canvas.getByText('Referenced partials');
    const details = summary.closest('details');

    if (!(details instanceof HTMLDetailsElement)) {
      throw new TypeError('Partials section was not rendered.');
    }

    expect(details).toHaveProperty('open', false);

    // Focus and activate with keyboard
    summary.focus();
    expect(document.activeElement).toBe(summary);

    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(details).toHaveProperty('open', true);
    });

    // Test link has proper href
    const link = canvas.getByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', '#styles');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('internalsStyles.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('internalsStyles.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('internalsStyles.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('internalsStyles.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
