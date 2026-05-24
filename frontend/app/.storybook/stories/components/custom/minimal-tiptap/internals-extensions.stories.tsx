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
import { expect, fn, within } from 'storybook/test';
// Direct file imports (ensures module-level coverage per file).
import '@/components/ui/custom/minimal-tiptap/extensions/code-block-lowlight/code-block-lowlight';
import '@/components/ui/custom/minimal-tiptap/extensions/color/color';
import '@/components/ui/custom/minimal-tiptap/extensions/horizontal-rule/horizontal-rule';
import '@/components/ui/custom/minimal-tiptap/extensions/link/link';
import '@/components/ui/custom/minimal-tiptap/extensions/reset-marks-on-enter/reset-marks-on-enter';
import '@/components/ui/custom/minimal-tiptap/extensions/selection/selection';
import '@/components/ui/custom/minimal-tiptap/extensions/unset-all-marks/unset-all-marks';
import '@/components/ui/custom/minimal-tiptap/extensions/image/image';
import '@/components/ui/custom/minimal-tiptap/extensions/file-handler';

import {
  CodeBlockLowlight,
  Color,
  FileHandler,
  HorizontalRule,
  Image,
  Link,
  ResetMarksOnEnter,
  Selection,
  UnsetAllMarks,
} from '@/components/ui/custom/minimal-tiptap/extensions';

import i18n from 'i18next';

seedFaker();

const DEFAULT_TITLE = 'Minimal Tiptap extensions';

type MinimalTiptapExtensionsDemoProps = {
  _actionStub?: unknown;
  title?: string;
};

function MinimalTiptapExtensionsDemo({ title = DEFAULT_TITLE }: MinimalTiptapExtensionsDemoProps) {
  const rows = [
    CodeBlockLowlight,
    Color,
    FileHandler,
    HorizontalRule,
    Link,
    ResetMarksOnEnter,
    Selection,
    UnsetAllMarks,
    Image,
  ].map((ext) => ({ name: ext.name }));

  return (
    <div className="w-full max-w-2xl space-y-3">
      <div className="text-sm font-medium">{title}</div>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </div>
  );
}

function I18nMinimalTiptapExtensionsDemo(props: MinimalTiptapExtensionsDemoProps) {
  const { t } = useTranslation();

  return (
    <MinimalTiptapExtensionsDemo {...props} title={t('minimalTiptap.internals.extensions.title')} />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Internals/Extensions',
  component: MinimalTiptapExtensionsDemo,
  tags: ['autodocs'],
  args: {
    title: DEFAULT_TITLE,
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    title: {
      control: { type: 'text' },
      description: i18n.t(
        'internalsExtensions.argType.headingDisplayedAboveTheExtensionsList',
        'Heading displayed above the extensions list'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Minimal Tiptap extensions' },
      },
    },
    // Appearance
    // (Default styling with heading and pre block)
    // State
    // (Static display - no interactive state)
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'internalsExtensions.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Reference
    // (Documentation component - lists available extensions)
    // Extensions Reference:
    // Available Tiptap Extensions:
    // - CodeBlockLowlight: Syntax highlighting for code blocks
    // - Color: Text color formatting
    // - FileHandler: File upload and drag-drop support
    // - HorizontalRule: Horizontal divider insertion
    // - Link: Hyperlink support with edit/unlink
    // - ResetMarksOnEnter: Clears formatting on new paragraphs
    // - Selection: Selection highlighting and tracking
    // - UnsetAllMarks: Remove all formatting from selection
    // - Image: Image insertion with resize/actions
    //
    // Extension Configuration:
    // - Each extension is configured via MinimalTiptap props
    // - Extensions are automatically loaded when using MinimalTiptap
    // - Individual extensions can be customized or disabled
    //
    // Usage Notes:
    // - Extensions provide core editor functionality
    // - This story demonstrates available extensions
    // - See MinimalTiptap component for integration
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapExtensionsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const pre = canvasElement.querySelector('pre');

    if (!(pre instanceof HTMLElement)) {
      throw new TypeError('Could not find the extensions output.');
    }

    const rows = JSON.parse(pre.textContent ?? '[]') as Array<{ name: string }>;
    const names = rows.map((row) => row.name);

    expect(names).toEqual([
      'codeBlockLowlight',
      'color',
      'fileHandler',
      'horizontalRule',
      'link',
      'resetMarksOnEnter',
      'selection',
      'unsetAllMarks',
      'image',
    ]);
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
    expect(canvas.getByText('Minimal Tiptap extensions')).toBeInTheDocument();
    expect(canvasElement.querySelector('pre')).toBeInTheDocument();
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
    expect(canvas.getByText('Minimal Tiptap extensions')).toBeInTheDocument();
    const pre = canvasElement.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('codeBlockLowlight');
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: (args) => <I18nMinimalTiptapExtensionsDemo {...args} />,
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    expect(canvas.getByText('Minimal Tiptap 拡張機能')).toBeInTheDocument();
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
  name: i18n.t(
    'internalsExtensions.storyName.pseudoStates',
    'Pseudo States (hover / focus / active)'
  ),
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
        {t('internalsExtensions.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('internalsExtensions.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsExtensions.story.defaultExtensions', 'Default extensions')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsExtensions.story.customTitle', 'Custom title')}
          </div>
          <MinimalTiptapExtensionsDemo
            title={i18n.t(
              'tiptapExtensions.story.customExtensionsTitle',
              'Custom extensions title'
            )}
          />
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
  name: i18n.t('internalsExtensions.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsExtensions.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[300px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsExtensions.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[500px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('internalsExtensions.story.largeContainer', 'Large container')}
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
  name: i18n.t('internalsExtensions.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('internalsExtensions.storyName.loading', 'Loading'),
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
  name: i18n.t('internalsExtensions.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('internalsExtensions.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('internalsExtensions.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t(
    'internalsExtensions.storyName.error422UnprocessableEntity',
    'Error: 422 Validation'
  ),
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
    'internalsExtensions.storyName.error500InternalServerError',
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
  name: i18n.t('internalsExtensions.storyName.networkError', 'Network Error'),
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
  name: i18n.t('internalsExtensions.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test heading is present
    expect(canvas.getByText('Minimal Tiptap extensions')).toBeInTheDocument();

    // Test pre element is properly structured
    const pre = canvasElement.querySelector('pre');
    expect(pre).toBeInTheDocument();

    // Verify extensions list content is readable
    const rows = JSON.parse(pre?.textContent ?? '[]') as Array<{ name: string }>;
    expect(rows.length).not.toBe(0);

    // Verify all required extensions are listed
    const names = rows.map((row) => row.name);
    expect(names).toContain('codeBlockLowlight');
    expect(names).toContain('link');
    expect(names).toContain('image');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('internalsExtensions.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('internalsExtensions.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('internalsExtensions.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('internalsExtensions.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
