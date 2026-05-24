import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import type {
  BlockType,
  EditorContentType,
  EditorOutputFormat,
  FakeBlogPostContent,
  FakeCommentContent,
  FakeDocumentationContent,
  FakeEditor,
  FakeEditorConfig,
  FakeEditorContent,
  FakeEditorLabels,
  FakeEditorShowcase,
  FakeEmailContent,
  FakeNoteContent,
  FakeRichTextBlock,
  FakeToolbarConfig,
  HeadingLevel,
  TextFormat,
  ToolbarGroup,
} from '@/.storybook/stories/_factories/minimal-tiptap.factory';
import {
  BLOCK_TYPES,
  CODE_LANGUAGES,
  CODE_SNIPPETS,
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
  EDITOR_CONTENT_TYPES,
  EDITOR_OUTPUT_FORMATS,
  HEADING_LEVELS,
  TEXT_FORMATS,
  TOOLBAR_GROUPS,
} from '@/.storybook/stories/_factories/minimal-tiptap.factory';
import {
  minimalTiptapHandlers,
  minimalTiptapStatusHandlers,
} from '@/.storybook/stories/_handlers/minimal-tiptap.handlers';
import { seedFaker } from '../../_factories';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, within } from 'storybook/test';

import { MinimalTiptapEditor } from '@/components/ui/custom/minimal-tiptap/minimal-tiptap';
import { Toaster } from '@/components/ui/sonner';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

const initialValue = `<p>${i18n.t('minimalTiptap.story.startTyping', 'Start typing…')}</p><p><strong>Tip:</strong> Try <code>Ctrl/Cmd + B</code> for bold.</p>`;
const initialValueJapanese = `<p>入力を開始…</p><p><strong>ヒント:</strong> 太字は <code>Ctrl/Cmd + B</code> を試してください。</p>`;

type MinimalTiptapDemoProps = {
  editable?: boolean;
  initialValue?: string;
  labels?: React.ComponentProps<typeof MinimalTiptapEditor>['labels'];
  onChange?: (value: string) => void;
  placeholder?: string;
};

function MinimalTiptapDemo({
  editable = true,
  initialValue: initialValueProp = initialValue,
  labels,
  placeholder = i18n.t('minimalTiptap.story.writeSomething', 'Write something…'),
  onChange: onChangeProp,
}: MinimalTiptapDemoProps) {
  useTranslation();
  const [output, setOutput] = React.useState<string>('');

  React.useEffect(() => {
    setOutput('');
  }, [initialValueProp]);

  const handleChange = React.useCallback(
    (value: React.ComponentProps<typeof MinimalTiptapEditor>['value']) => {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      setOutput(stringValue);
      onChangeProp?.(stringValue);
    },
    [onChangeProp]
  );

  return (
    <div className="w-full max-w-4xl space-y-4">
      <Toaster position="bottom-right" richColors />
      <MinimalTiptapEditor
        key={initialValueProp}
        editorContentClassName="p-4"
        onChange={handleChange}
        editable={editable}
        labels={labels}
        placeholder={placeholder}
        value={initialValueProp}
      />
      <div className="text-sm font-medium">
        {i18n.t('minimalTiptap.story.outputHtml', 'Output (HTML)')}
      </div>
      <pre
        aria-label={i18n.t('minimalTiptap.story.editorOutputHtml', 'Editor output (HTML)')}
        className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs"
      >
        {output || '—'}
      </pre>
    </div>
  );
}

function I18nMinimalTiptapDemo(props: MinimalTiptapDemoProps) {
  const { t } = useTranslation();

  return (
    <MinimalTiptapDemo
      {...props}
      placeholder={t('minimalTiptap.demo.placeholder')}
      labels={{
        textStyle: {
          bold: t('minimalTiptap.toolbar.bold'),
          italic: t('minimalTiptap.toolbar.italic'),
          underline: t('minimalTiptap.toolbar.underline'),
          strikethrough: t('minimalTiptap.toolbar.strikethrough'),
          code: t('minimalTiptap.toolbar.code'),
          clearFormatting: t('minimalTiptap.toolbar.clearFormatting'),
          moreFormatting: t('minimalTiptap.toolbar.moreFormatting'),
        },
        lists: {
          orderedList: t('minimalTiptap.toolbar.orderedList'),
          bulletList: t('minimalTiptap.toolbar.bulletList'),
          lists: t('minimalTiptap.toolbar.lists'),
        },
        linkBubbleMenu: {
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
        },
      }}
    />
  );
}

// ============ TYPE-ASSERTION HELPERS (consume type-only imports) ============

function _assertTypes() {
  // These type assertions exist solely to consume the type-only imports from
  // the factory so ESLint `no-unused-vars` does not flag them. They are never
  // called at runtime.
  const _blockType: BlockType = 'paragraph';
  const _contentType: EditorContentType = 'article';
  const _outputFormat: EditorOutputFormat = 'html';
  const _textFormat: TextFormat = 'bold';
  const _headingLevel: HeadingLevel = 1;
  const _toolbarGroup: ToolbarGroup = 'formatting';
  const _editorContent: FakeEditorContent | null = null;
  const _editorConfig: FakeEditorConfig | null = null;
  const _editor: FakeEditor | null = null;
  const _richTextBlock: FakeRichTextBlock | null = null;
  const _editorLabels: FakeEditorLabels | null = null;
  const _blogPost: FakeBlogPostContent | null = null;
  const _comment: FakeCommentContent | null = null;
  const _doc: FakeDocumentationContent | null = null;
  const _email: FakeEmailContent | null = null;
  const _note: FakeNoteContent | null = null;
  const _toolbar: FakeToolbarConfig | null = null;
  const _showcase: FakeEditorShowcase | null = null;
  return [
    _blockType,
    _contentType,
    _outputFormat,
    _textFormat,
    _headingLevel,
    _toolbarGroup,
    _editorContent,
    _editorConfig,
    _editor,
    _richTextBlock,
    _editorLabels,
    _blogPost,
    _comment,
    _doc,
    _email,
    _note,
    _toolbar,
    _showcase,
  ];
}
// Prevent tree-shaking
void _assertTypes;

const meta = {
  title: 'Components/Custom/Minimal Tiptap',
  component: MinimalTiptapDemo,
  tags: ['autodocs'],
  args: {
    editable: true,
    initialValue,
    labels: undefined,
    placeholder: i18n.t('minimalTiptap.story.writeSomething', 'Write something…'),
    // Event handlers with fn() for Actions panel logging
    onChange: fn(),
  },
  argTypes: {
    // Content
    initialValue: {
      control: false,
      description: i18n.t(
        'minimalTiptap.argType.initialHtmlContentForTheEditor',
        'Initial HTML content for the editor'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    labels: {
      control: false,
      description: i18n.t(
        'minimalTiptap.argType.localizationLabelsForToolbarAndMenus',
        'Localization labels for toolbar and menus'
      ),
      table: {
        category: 'Content',
        type: { summary: 'Labels' },
      },
    },
    placeholder: {
      control: { type: 'text' },
      description: i18n.t(
        'minimalTiptap.argType.placeholderTextWhenEditorIsEmpty',
        'Placeholder text when editor is empty'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
        defaultValue: { summary: 'Write something…' },
      },
    },
    // State
    editable: {
      control: { type: 'boolean' },
      description: i18n.t(
        'minimalTiptap.argType.whetherTheEditorContentIsEditable',
        'Whether the editor content is editable'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Events
    onChange: {
      action: 'onChange',
      description: i18n.t(
        'minimalTiptap.argType.calledWhenEditorContentChanges',
        'Called when editor content changes'
      ),
      table: {
        category: 'Events',
        type: { summary: '(value: string | JSONContent) => void' },
      },
    },
    // MinimalTiptapEditor Props Reference (Tiptap-based):
    // Event Handlers (in actual component):
    // - onChange: Called when editor content changes (value: string | JSONContent) => void
    // - onFocus: Called when editor receives focus (event: FocusEvent) => void
    // - onBlur: Called when editor loses focus (event: FocusEvent) => void
    // - onUpdate: Called on every editor update (props: EditorUpdateProps) => void
    // - onTransaction: Called on every transaction (props: TransactionProps) => void
    // - onSelectionUpdate: Called when text selection changes (props: SelectionUpdateProps) => void
    //
    // - value: Editor content in HTML (string)
    // - onChange: Content change handler ((value: string) => void)
    // - editable: Enable/disable editing (boolean, default: true)
    // - placeholder: Empty state placeholder (string)
    // - editorContentClassName: Classes for editor content area (string)
    // - labels: Localization labels object (Labels)
    //
    // Labels Structure:
    // - textStyle: { bold, italic, underline, strikethrough, code, clearFormatting, moreFormatting }
    // - lists: { orderedList, bulletList, lists }
    // - linkBubbleMenu:
    //   - editBlock: { urlLabel, urlPlaceholder, textLabel, textPlaceholder, openInNewTab, save }
    //   - popoverBlock: { editLink, openLink, clearLink, copy, copied }
    //
    // Toolbar Features:
    // - Text formatting: Bold, Italic, Underline, Strikethrough, Code
    // - Lists: Ordered list, Bullet list
    // - Links: Insert/edit links with bubble menu
    // - Clear formatting
    //
    // Keyboard Shortcuts:
    // - Ctrl/Cmd + B: Bold
    // - Ctrl/Cmd + I: Italic
    // - Ctrl/Cmd + U: Underline
    // - Ctrl/Cmd + Shift + S: Strikethrough
    // - Ctrl/Cmd + E: Code
    //
    // Usage Notes:
    // - Built on Tiptap (ProseMirror) editor
    // - Outputs HTML string
    // - Supports read-only mode via editable prop
    // - Full i18n support through labels
  },
  parameters: {
    msw: { handlers: minimalTiptapHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Editor: Story = {
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Editor,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Default: Story = {
  ...Playground,
  play: async ({ canvasElement }) => {
    const root = canvasElement;

    if (!root.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();

    const editor = root.querySelector('.minimal-tiptap-editor');
    if (!(editor instanceof HTMLElement)) throw new TypeError('Editor root was not rendered.');

    editor.focus();

    const button = root.querySelector('button[aria-label]:not([disabled])');
    if (button instanceof HTMLElement) {
      await userEvent.click(button);
    }

    expect(root.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  ...Default,
  name: i18n.t('minimalTiptap.storyName.empty', 'Empty (placeholder)'),
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  ...Default,
  name: i18n.t('minimalTiptap.storyName.readOnly', 'Read-only'),
  args: {
    editable: false,
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
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
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap"]')).toBeInTheDocument();
    expect(canvas.getByRole('textbox')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  args: {
    initialValue: initialValueJapanese,
  },
  render: (args) => <I18nMinimalTiptapDemo {...args} />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
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
  name: i18n.t('minimalTiptap.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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

// ============ MSW + FAKER STORIES ============

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapHandlers },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.loading },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  name: i18n.t('minimalTiptap.storyName.error400BadRequest', 'Error 400: Bad Request'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.badRequest },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('minimalTiptap.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.unauthorized },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('minimalTiptap.storyName.error403Forbidden', 'Error 403: Forbidden'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.forbidden },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error404NotFound: Story = {
  name: i18n.t('minimalTiptap.storyName.error404NotFound', 'Error 404: Not Found'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.notFound },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error409Conflict: Story = {
  name: i18n.t('minimalTiptap.storyName.error409Conflict', 'Error 409: Conflict'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.conflict },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.error422UnprocessableEntity',
    'Error 422: Unprocessable Entity'
  ),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('minimalTiptap.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.tooManyRequests },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.error500InternalServerError',
    'Error 500: Internal Server Error'
  ),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.internalServerError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('minimalTiptap.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.badGateway },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.error503ServiceUnavailable',
    'Error 503: Service Unavailable'
  ),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.serviceUnavailable },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('minimalTiptap.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.gatewayTimeout },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const SlowResponse: Story = {
  name: i18n.t('minimalTiptap.storyName.slowResponse', 'Slow Response (3-5s)'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.slowResponse },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  name: i18n.t('minimalTiptap.storyName.networkError', 'Network Error'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.networkError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

export const SuccessHandler: Story = {
  name: i18n.t('minimalTiptap.storyName.successHandler', 'Success Handler'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.success },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const EmptyDataHandler: Story = {
  name: i18n.t('minimalTiptap.storyName.emptyDataHandler', 'Empty Data Response'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.emptyData },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const UploadError: Story = {
  name: i18n.t('minimalTiptap.storyName.uploadError', 'Upload Error'),
  ...Default,
  parameters: {
    msw: { handlers: minimalTiptapStatusHandlers.uploadError },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.defaultEditor', 'Default Editor')}
        </p>
        <div className="w-full max-w-4xl">
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            value={initialValue}
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.emptyWithPlaceholder', 'Empty with Placeholder')}
        </p>
        <div className="w-full max-w-4xl">
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            placeholder={i18n.t(
              'minimalTiptap.story.startTyping',
              'Start typing your content here...'
            )}
            value=""
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.readOnlyMode', 'Read-only Mode')}
        </p>
        <div className="w-full max-w-4xl">
          <MinimalTiptapEditor
            editable={false}
            editorContentClassName="p-4"
            onChange={() => {}}
            value="<p>{i18n.t('minimalTiptap.story.thisContentIs', 'This content is')}<strong>read-only</strong> and cannot be edited.</p>"
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.richContent', 'Rich Content')}
        </p>
        <div className="w-full max-w-4xl">
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            value="<p>{i18n.t('minimalTiptap.story.thisEditorSupports', 'This editor supports')}<strong>bold</strong>, <em>italic</em>, <u>underline</u>, <s>strikethrough</s>, and <code>inline code</code>.</p><ul><li>{i18n.t('minimalTiptap.story.bulletListItem', 'Bullet list item')}</li><li>{i18n.t('minimalTiptap.story.anotherItem', 'Another item')}</li></ul><ol><li>{i18n.t('minimalTiptap.story.numberedListItem', 'Numbered list item')}</li><li>{i18n.t('minimalTiptap.story.anotherNumberedItem', 'Another numbered item')}</li></ol>"
          />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(4);
    const toolbars = canvasElement.querySelectorAll('[data-slot="minimal-tiptap-toolbar"]');
    expect(toolbars.length).toBe(4);
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.compactMaxwmd', 'Compact (max-w-md)')}
        </p>
        <div className="max-w-md">
          <MinimalTiptapEditor
            editorContentClassName="p-2"
            onChange={() => {}}
            placeholder={i18n.t('minimalTiptap.story.compactEditor', 'Compact editor...')}
            value=""
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.mediumMaxw2xl', 'Medium (max-w-2xl)')}
        </p>
        <div className="max-w-2xl">
          <MinimalTiptapEditor
            editorContentClassName="p-3"
            onChange={() => {}}
            placeholder={i18n.t('minimalTiptap.story.mediumEditor', 'Medium editor...')}
            value=""
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.largeMaxw4xl', 'Large (max-w-4xl)')}
        </p>
        <div className="max-w-4xl">
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            placeholder={i18n.t('minimalTiptap.story.largeEditor', 'Large editor...')}
            value=""
          />
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('minimalTiptap.story.fullWidth', 'Full Width')}
        </p>
        <div className="w-full">
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            placeholder={i18n.t('minimalTiptap.story.fullWidthEditor', 'Full width editor...')}
            value=""
          />
        </div>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(4);
    const toolbars = canvasElement.querySelectorAll('[data-slot="minimal-tiptap-toolbar"]');
    expect(toolbars.length).toBe(4);
  },
};

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('minimalTiptap.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test toolbar exists and has proper structure
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();

    // Test editor content area is accessible
    const editor = canvasElement.querySelector('.minimal-tiptap-editor');
    expect(editor).toBeInTheDocument();

    // Test toolbar buttons have aria-labels
    const buttons = canvasElement.querySelectorAll('[data-slot="minimal-tiptap-toolbar"] button');
    expect(buttons.length).not.toBe(0);

    // Verify at least one button has an aria-label
    const buttonsWithLabels = [...buttons].filter(
      (btn) => btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby')
    );
    expect(buttonsWithLabels.length).not.toBe(0);

    // Test keyboard navigation in toolbar
    const firstButton = buttons[0] as HTMLElement;
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    // Tab through toolbar buttons
    await userEvent.tab();
    expect(document.activeElement).not.toBe(firstButton);

    // Test output has aria-label
    const output = canvas.getByLabelText('Editor output (HTML)');
    expect(output).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  ...Default,
  name: i18n.t('minimalTiptap.storyName.withFakerData', 'With Faker Data'),
  args: {
    ...Default.args,
    initialValue: createFakeEditorContent().html,
  },
  play: async ({ canvasElement }) => {
    // Verify editor rendered with faker content
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="minimal-tiptap-toolbar"]')).toBeInTheDocument();

    // Verify content is present in the editor
    const editorContent = canvasElement.querySelector('.ProseMirror');
    expect(editorContent).toBeInTheDocument();
    expect(editorContent?.textContent?.length).toBeGreaterThan(50);
  },
};

// ============ FACTORY: createFakeEditorContents ============

function EditorContentsDemo() {
  const contents = createFakeEditorContents(3);

  return (
    <div className="flex flex-col gap-6" data-testid="editor-contents-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <p className="text-muted-foreground text-sm">
        Showing {contents.length} generated editor contents
      </p>
      {contents.map((content) => (
        <div key={content.id} className="w-full max-w-4xl">
          <div className="text-muted-foreground mb-1 text-xs">
            Type: {content.contentType} | Words: {content.wordCount} | Chars:{' '}
            {content.characterCount}
          </div>
          <MinimalTiptapEditor
            editorContentClassName="p-4"
            onChange={() => {}}
            value={content.html}
          />
        </div>
      ))}
    </div>
  );
}

export const MultipleEditorContents: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.multipleEditorContents',
    'Multiple Editor Contents (createFakeEditorContents)'
  ),
  render: () => <EditorContentsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('editor-contents-demo')).toBeInTheDocument();
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(3);
  },
};

// ============ FACTORY: createFakeEditorConfig ============

function EditorConfigDemo() {
  const config = createFakeEditorConfig();

  return (
    <div className="flex flex-col gap-4" data-testid="editor-config-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.editorConfigDetails', 'Editor config details')}
      >
        <p>ID: {config.id}</p>
        <p>Editable: {String(config.editable)}</p>
        <p>Autofocus: {String(config.autofocus)}</p>
        <p>Min Height: {config.minHeight}px</p>
        <p>Max Length: {config.maxLength ?? 'unlimited'}</p>
        <p>Placeholder: {config.placeholder}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editable={config.editable}
          editorContentClassName="p-4"
          onChange={() => {}}
          placeholder={config.placeholder}
          value=""
        />
      </div>
    </div>
  );
}

export const EditorConfig: Story = {
  name: i18n.t('minimalTiptap.storyName.editorConfig', 'Editor Config (createFakeEditorConfig)'),
  render: () => <EditorConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('editor-config-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Editor config details')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeEditor ============

function FullEditorDemo() {
  const editor = createFakeEditor();

  return (
    <div className="flex flex-col gap-4" data-testid="full-editor-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.fullEditorMetadata', 'Full editor metadata')}
      >
        <p>Editor ID: {editor.id}</p>
        <p>Editable: {String(editor.editable)}</p>
        <p>Content Type: {editor.content.contentType}</p>
        <p>Word Count: {editor.content.wordCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editable={editor.editable}
          editorContentClassName="p-4"
          onChange={() => {}}
          placeholder={editor.placeholder}
          value={editor.content.html}
        />
      </div>
    </div>
  );
}

export const FullEditor: Story = {
  name: i18n.t('minimalTiptap.storyName.fullEditor', 'Full Editor (createFakeEditor)'),
  render: () => <FullEditorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('full-editor-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Full editor metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeRichContent ============

function RichContentDemo() {
  const richContent = createFakeRichContent();

  return (
    <div className="flex flex-col gap-4" data-testid="rich-content-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.richContentStats', 'Rich content stats')}
      >
        <p>Content Type: {richContent.contentType}</p>
        <p>Word Count: {richContent.wordCount}</p>
        <p>Character Count: {richContent.characterCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={richContent.html}
        />
      </div>
    </div>
  );
}

export const RichContent: Story = {
  name: i18n.t('minimalTiptap.storyName.richContent', 'Rich Content (createFakeRichContent)'),
  render: () => <RichContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('rich-content-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Rich content stats')).toBeInTheDocument();
    const editor = canvasElement.querySelector('.ProseMirror');
    expect(editor).toBeInTheDocument();
    expect(editor?.textContent?.length).toBeGreaterThan(20);
  },
};

// ============ FACTORY: createFakeCodeContent ============

function CodeContentDemo() {
  const codeContent = createFakeCodeContent('typescript');

  return (
    <div className="flex flex-col gap-4" data-testid="code-content-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.codeContentMetadata', 'Code content metadata')}
      >
        <p>Content Type: {codeContent.contentType}</p>
        <p>Word Count: {codeContent.wordCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={codeContent.html}
        />
      </div>
    </div>
  );
}

export const CodeContent: Story = {
  name: i18n.t('minimalTiptap.storyName.codeContent', 'Code Content (createFakeCodeContent)'),
  render: () => <CodeContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('code-content-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Code content metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeBlogPostContent + createFakeBlogPosts ============

function BlogPostContentDemo() {
  const blogPost = createFakeBlogPostContent();
  const blogPosts = createFakeBlogPosts(2);

  return (
    <div className="flex flex-col gap-6" data-testid="blog-post-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.blogPostMetadata', 'Blog post metadata')}
      >
        <p>Title: {blogPost.title}</p>
        <p>Author: {blogPost.author}</p>
        <p>Category: {blogPost.category}</p>
        <p>Tags: {blogPost.tags.join(', ')}</p>
        <p>Excerpt: {blogPost.excerpt.slice(0, 80)}...</p>
        <p>Published: {blogPost.publishDate.toLocaleDateString()}</p>
        {blogPost.featuredImage ? (
          <p>{i18n.t('minimalTiptap.story.featuredImagePresent', 'Featured Image: present')}</p>
        ) : null}
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={blogPost.html}
        />
      </div>
      <div className="text-muted-foreground mt-4 text-xs">
        + {blogPosts.length} additional blog posts generated via createFakeBlogPosts
      </div>
    </div>
  );
}

export const BlogPostContent: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.blogPostContent',
    'Blog Post Content (createFakeBlogPostContent)'
  ),
  render: () => <BlogPostContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('blog-post-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Blog post metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeCommentContent + createFakeComments ============

function CommentContentDemo() {
  const comments = createFakeComments(3);
  const singleComment = createFakeCommentContent();

  return (
    <div className="flex flex-col gap-6" data-testid="comment-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.singleCommentMetadata', 'Single comment metadata')}
      >
        <p>Author: {singleComment.author}</p>
        <p>Created: {singleComment.createdAt.toLocaleDateString()}</p>
        {singleComment.replyTo ? <p>Reply to: {singleComment.replyTo}</p> : null}
        {singleComment.parentId ? <p>Parent: {singleComment.parentId}</p> : null}
      </div>
      {comments.map((comment) => (
        <div key={comment.id} className="w-full max-w-4xl">
          <div className="text-muted-foreground mb-1 text-xs">
            {comment.author} - {comment.createdAt.toLocaleDateString()}
          </div>
          <MinimalTiptapEditor
            editable={false}
            editorContentClassName="p-3"
            onChange={() => {}}
            value={comment.html}
          />
        </div>
      ))}
    </div>
  );
}

export const CommentContent: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.commentContent',
    'Comment Thread (createFakeCommentContent)'
  ),
  render: () => <CommentContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('comment-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Single comment metadata')).toBeInTheDocument();
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(3);
  },
};

// ============ FACTORY: createFakeDocumentationContent ============

function DocumentationContentDemo() {
  const doc = createFakeDocumentationContent();

  return (
    <div className="flex flex-col gap-4" data-testid="documentation-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.documentationMetadata', 'Documentation metadata')}
      >
        <p>Title: {doc.title}</p>
        <p>Section: {doc.section}</p>
        <p>Version: {doc.version}</p>
        <p>Code Examples: {doc.codeExamples.length}</p>
        <p>Related Links: {doc.relatedLinks.length}</p>
        {doc.relatedLinks.map((link) => (
          <p key={`${link.text}-${link.url}`} className="ml-4 text-xs">
            - {link.text}: {link.url}
          </p>
        ))}
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor editorContentClassName="p-4" onChange={() => {}} value={doc.html} />
      </div>
    </div>
  );
}

export const DocumentationContent: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.documentationContent',
    'Documentation (createFakeDocumentationContent)'
  ),
  render: () => <DocumentationContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('documentation-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Documentation metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeEmailContent ============

function EmailContentDemo() {
  const email = createFakeEmailContent();

  return (
    <div className="flex flex-col gap-4" data-testid="email-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.emailMetadata', 'Email metadata')}
      >
        <p>From: {email.from}</p>
        <p>To: {email.to.join(', ')}</p>
        {email.cc ? <p>CC: {email.cc.join(', ')}</p> : null}
        {email.bcc ? <p>BCC: {email.bcc.join(', ')}</p> : null}
        <p>Subject: {email.subject}</p>
        <p>Word Count: {email.wordCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor editorContentClassName="p-4" onChange={() => {}} value={email.html} />
      </div>
    </div>
  );
}

export const EmailContent: Story = {
  name: i18n.t('minimalTiptap.storyName.emailContent', 'Email Content (createFakeEmailContent)'),
  render: () => <EmailContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('email-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Email metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeNoteContent + createFakeNotes ============

function NoteContentDemo() {
  const note = createFakeNoteContent();
  const notes = createFakeNotes(3);

  return (
    <div className="flex flex-col gap-6" data-testid="note-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.noteMetadata', 'Note metadata')}
      >
        <p>Title: {note.title}</p>
        <p>Pinned: {String(note.isPinned)}</p>
        {note.color ? <p>Color: {note.color}</p> : null}
        <p>Created: {note.createdAt.toLocaleDateString()}</p>
        <p>Updated: {note.updatedAt.toLocaleDateString()}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {notes.map((n) => (
          <div key={n.id} className="w-full">
            <div className="text-muted-foreground mb-1 text-xs">
              {n.title} {n.isPinned ? '(pinned)' : ''}
            </div>
            <MinimalTiptapEditor editorContentClassName="p-3" onChange={() => {}} value={n.html} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const NoteContent: Story = {
  name: i18n.t('minimalTiptap.storyName.noteContent', 'Notes (createFakeNoteContent)'),
  render: () => <NoteContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('note-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Note metadata')).toBeInTheDocument();
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(3);
  },
};

// ============ FACTORY: createFakeEditorLabelsEn + createFakeEditorLabelsJa ============

function EditorLabelsDemo() {
  const labelsEn = createFakeEditorLabelsEn();
  const labelsJa = createFakeEditorLabelsJa();

  return (
    <div className="flex flex-col gap-6" data-testid="editor-labels-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="bg-muted rounded-md p-3 text-sm"
          aria-label={i18n.t('minimalTiptap.story.englishLabels', 'English labels')}
        >
          <h4 className="mb-2 font-medium">
            {i18n.t('minimalTiptap.story.englishLabels', 'English Labels')}
          </h4>
          {Object.entries(labelsEn).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
        </div>
        <div
          className="bg-muted rounded-md p-3 text-sm"
          aria-label={i18n.t('minimalTiptap.story.japaneseLabels', 'Japanese labels')}
        >
          <h4 className="mb-2 font-medium">
            {i18n.t('minimalTiptap.story.japaneseLabels', 'Japanese Labels')}
          </h4>
          {Object.entries(labelsJa).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          placeholder={labelsEn.placeholder}
          value=""
        />
      </div>
    </div>
  );
}

export const EditorLabels: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.editorLabels',
    'Editor Labels (createFakeEditorLabelsEn / Ja)'
  ),
  render: () => <EditorLabelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('editor-labels-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('English labels')).toBeInTheDocument();
    expect(canvas.getByLabelText('Japanese labels')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeToolbarConfig ============

function ToolbarConfigDemo() {
  const toolbarConfig = createFakeToolbarConfig();

  return (
    <div className="flex flex-col gap-4" data-testid="toolbar-config-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.toolbarConfigDetails', 'Toolbar config details')}
      >
        <p>ID: {toolbarConfig.id}</p>
        <p>Position: {toolbarConfig.position}</p>
        <p>Show Labels: {String(toolbarConfig.showLabels)}</p>
        <p>Enabled Groups: {toolbarConfig.enabledGroups.join(', ')}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={initialValue}
        />
      </div>
    </div>
  );
}

export const ToolbarConfig: Story = {
  name: i18n.t('minimalTiptap.storyName.toolbarConfig', 'Toolbar Config (createFakeToolbarConfig)'),
  render: () => <ToolbarConfigDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('toolbar-config-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Toolbar config details')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeEditorShowcase ============

function EditorShowcaseDemo() {
  const showcase = createFakeEditorShowcase();

  return (
    <div className="flex flex-col gap-6" data-testid="editor-showcase-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.showcaseStats', 'Showcase stats')}
      >
        <p>Blog Posts: {showcase.blogPosts.length}</p>
        <p>Comments: {showcase.comments.length}</p>
        <p>Documentation: {showcase.documentation.length}</p>
        <p>Emails: {showcase.emails.length}</p>
        <p>Notes: {showcase.notes.length}</p>
      </div>
      <div className="w-full max-w-4xl">
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('minimalTiptap.story.firstBlogPost', 'First Blog Post')}
        </h4>
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={showcase.blogPosts[0]?.html ?? ''}
        />
      </div>
      <div className="w-full max-w-4xl">
        <h4 className="mb-2 text-sm font-medium">
          {i18n.t('minimalTiptap.story.firstEmail', 'First Email')}
        </h4>
        <MinimalTiptapEditor
          editable={false}
          editorContentClassName="p-4"
          onChange={() => {}}
          value={showcase.emails[0]?.html ?? ''}
        />
      </div>
    </div>
  );
}

export const EditorShowcase: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.editorShowcase',
    'Editor Showcase (createFakeEditorShowcase)'
  ),
  render: () => <EditorShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('editor-showcase-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Showcase stats')).toBeInTheDocument();
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(2);
  },
};

// ============ FACTORY: createFakeEmptyEditorContent ============

function EmptyEditorContentDemo() {
  const emptyContent = createFakeEmptyEditorContent();

  return (
    <div className="flex flex-col gap-4" data-testid="empty-editor-content-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.emptyContentStats', 'Empty content stats')}
      >
        <p>Content Type: {emptyContent.contentType}</p>
        <p>Word Count: {emptyContent.wordCount}</p>
        <p>Character Count: {emptyContent.characterCount}</p>
        <p>HTML: {emptyContent.html || '(empty)'}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          placeholder={i18n.t(
            'minimalTiptap.story.editorStartsEmpty',
            'This editor starts empty...'
          )}
          value={emptyContent.html}
        />
      </div>
    </div>
  );
}

export const EmptyEditorContent: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.emptyEditorContent',
    'Empty Editor Content (createFakeEmptyEditorContent)'
  ),
  render: () => <EmptyEditorContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('empty-editor-content-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Empty content stats')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeMinimalContent ============

function MinimalContentDemo() {
  const minimalContent = createFakeMinimalContent();

  return (
    <div className="flex flex-col gap-4" data-testid="minimal-content-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.minimalContentStats', 'Minimal content stats')}
      >
        <p>Word Count: {minimalContent.wordCount}</p>
        <p>Character Count: {minimalContent.characterCount}</p>
        <p>Plain Text: {minimalContent.plainText}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={minimalContent.html}
        />
      </div>
    </div>
  );
}

export const MinimalContent: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.minimalContent',
    'Minimal Content (createFakeMinimalContent)'
  ),
  render: () => <MinimalContentDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('minimal-content-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Minimal content stats')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeReadOnlyEditor ============

function ReadOnlyEditorDemo() {
  const readOnlyEditor = createFakeReadOnlyEditor();

  return (
    <div className="flex flex-col gap-4" data-testid="read-only-editor-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t(
          'minimalTiptap.story.readOnlyEditorMetadata',
          'Read-only editor metadata'
        )}
      >
        <p>Editable: {String(readOnlyEditor.editable)}</p>
        <p>Content Type: {readOnlyEditor.content.contentType}</p>
        <p>Word Count: {readOnlyEditor.content.wordCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editable={readOnlyEditor.editable}
          editorContentClassName="p-4"
          onChange={() => {}}
          value={readOnlyEditor.content.html}
        />
      </div>
    </div>
  );
}

export const ReadOnlyEditorFactory: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.readOnlyEditorFactory',
    'Read-Only Editor (createFakeReadOnlyEditor)'
  ),
  render: () => <ReadOnlyEditorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('read-only-editor-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Read-only editor metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeChatMessageEditor ============

function ChatMessageEditorDemo() {
  const chatEditor = createFakeChatMessageEditor();

  return (
    <div className="flex flex-col gap-4" data-testid="chat-editor-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.chatEditorMetadata', 'Chat editor metadata')}
      >
        <p>Autofocus: {String(chatEditor.autofocus)}</p>
        <p>Max Length: {chatEditor.maxLength ?? 'unlimited'}</p>
        <p>Min Height: {chatEditor.minHeight}px</p>
        <p>Placeholder: {chatEditor.placeholder}</p>
      </div>
      <div className="mx-auto w-full max-w-2xl">
        <MinimalTiptapEditor
          editorContentClassName="p-3"
          onChange={() => {}}
          placeholder={chatEditor.placeholder}
          value=""
        />
      </div>
    </div>
  );
}

export const ChatMessageEditor: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.chatMessageEditor',
    'Chat Message Editor (createFakeChatMessageEditor)'
  ),
  render: () => <ChatMessageEditorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('chat-editor-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Chat editor metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeSocialPostEditor ============

function SocialPostEditorDemo() {
  const socialEditor = createFakeSocialPostEditor();

  return (
    <div className="flex flex-col gap-4" data-testid="social-editor-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.socialEditorMetadata', 'Social editor metadata')}
      >
        <p>Max Length: {socialEditor.maxLength ?? 'unlimited'}</p>
        <p>Min Height: {socialEditor.minHeight}px</p>
        <p>Placeholder: {socialEditor.placeholder}</p>
      </div>
      <div className="mx-auto w-full max-w-xl">
        <MinimalTiptapEditor
          editorContentClassName="p-3"
          onChange={() => {}}
          placeholder={socialEditor.placeholder}
          value=""
        />
      </div>
    </div>
  );
}

export const SocialPostEditor: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.socialPostEditor',
    'Social Post Editor (createFakeSocialPostEditor)'
  ),
  render: () => <SocialPostEditorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('social-editor-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Social editor metadata')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ FACTORY: createFakeLongFormEditor ============

function LongFormEditorDemo() {
  const longFormEditor = createFakeLongFormEditor();

  return (
    <div className="flex flex-col gap-4" data-testid="long-form-editor-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t(
          'minimalTiptap.story.longFormEditorMetadata',
          'Long-form editor metadata'
        )}
      >
        <p>Min Height: {longFormEditor.minHeight}px</p>
        <p>Placeholder: {longFormEditor.placeholder}</p>
        <p>Content Type: {longFormEditor.content.contentType}</p>
        <p>Word Count: {longFormEditor.content.wordCount}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          placeholder={longFormEditor.placeholder}
          value={longFormEditor.content.html}
        />
      </div>
    </div>
  );
}

export const LongFormEditor: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.longFormEditor',
    'Long-Form Editor (createFakeLongFormEditor)'
  ),
  render: () => <LongFormEditorDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('long-form-editor-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Long-form editor metadata')).toBeInTheDocument();
    const editor = canvasElement.querySelector('.ProseMirror');
    expect(editor).toBeInTheDocument();
    expect(editor?.textContent?.length).toBeGreaterThan(50);
  },
};

// ============ CONSTANTS: EDITOR_OUTPUT_FORMATS ============

function OutputFormatsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="output-formats-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.outputFormatsList', 'Output formats list')}
      >
        <h4 className="mb-2 font-medium">Editor Output Formats ({EDITOR_OUTPUT_FORMATS.length})</h4>
        {EDITOR_OUTPUT_FORMATS.map((format) => (
          <p key={format}>{format}</p>
        ))}
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={initialValue}
        />
      </div>
    </div>
  );
}

export const OutputFormats: Story = {
  name: i18n.t('minimalTiptap.storyName.outputFormats', 'Output Formats (EDITOR_OUTPUT_FORMATS)'),
  render: () => <OutputFormatsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('output-formats-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Output formats list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: EDITOR_CONTENT_TYPES ============

function ContentTypesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="content-types-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.contentTypesList', 'Content types list')}
      >
        <h4 className="mb-2 font-medium">Editor Content Types ({EDITOR_CONTENT_TYPES.length})</h4>
        <div className="flex flex-wrap gap-2">
          {EDITOR_CONTENT_TYPES.map((type) => (
            <span key={type} className="bg-background rounded px-2 py-1 text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={initialValue}
        />
      </div>
    </div>
  );
}

export const ContentTypes: Story = {
  name: i18n.t('minimalTiptap.storyName.contentTypes', 'Content Types (EDITOR_CONTENT_TYPES)'),
  render: () => <ContentTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('content-types-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Content types list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: TEXT_FORMATS ============

function TextFormatsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="text-formats-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.textFormatsList', 'Text formats list')}
      >
        <h4 className="mb-2 font-medium">Text Formats ({TEXT_FORMATS.length})</h4>
        <div className="flex flex-wrap gap-2">
          {TEXT_FORMATS.map((format) => (
            <span key={format} className="bg-background rounded px-2 py-1 text-xs">
              {format}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value="<p>{i18n.t('minimalTiptap.story.try', 'Try')}<strong>bold</strong>, <em>italic</em>, <u>underline</u>, <s>strikethrough</s>, <code>code</code>, and <mark>highlight</mark>.</p>"
        />
      </div>
    </div>
  );
}

export const TextFormats: Story = {
  name: i18n.t('minimalTiptap.storyName.textFormats', 'Text Formats (TEXT_FORMATS)'),
  render: () => <TextFormatsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('text-formats-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Text formats list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: BLOCK_TYPES ============

function BlockTypesDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="block-types-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.blockTypesList', 'Block types list')}
      >
        <h4 className="mb-2 font-medium">Block Types ({BLOCK_TYPES.length})</h4>
        <div className="flex flex-wrap gap-2">
          {BLOCK_TYPES.map((type) => (
            <span key={type} className="bg-background rounded px-2 py-1 text-xs">
              {type}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value="<h2>{i18n.t('minimalTiptap.story.heading', 'Heading')}</h2><p>{i18n.t('minimalTiptap.story.paragraph', 'Paragraph')}</p><ul><li>{i18n.t('minimalTiptap.story.bulletList', 'Bullet list')}</li></ul><ol><li>{i18n.t('minimalTiptap.story.numberedList', 'Numbered list')}</li></ol><blockquote><p>{i18n.t('minimalTiptap.story.blockquote', 'Blockquote')}</p></blockquote>"
        />
      </div>
    </div>
  );
}

export const BlockTypes: Story = {
  name: i18n.t('minimalTiptap.storyName.blockTypes', 'Block Types (BLOCK_TYPES)'),
  render: () => <BlockTypesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('block-types-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Block types list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: HEADING_LEVELS ============

function HeadingLevelsDemo() {
  const headingHtml = HEADING_LEVELS.map(
    (level) => `<h${level}>Heading Level ${level}</h${level}>`
  ).join('');

  return (
    <div className="flex flex-col gap-4" data-testid="heading-levels-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.headingLevelsList', 'Heading levels list')}
      >
        <h4 className="mb-2 font-medium">Heading Levels ({HEADING_LEVELS.length})</h4>
        <p>Levels: {HEADING_LEVELS.join(', ')}</p>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editable={false}
          editorContentClassName="p-4"
          onChange={() => {}}
          value={headingHtml}
        />
      </div>
    </div>
  );
}

export const HeadingLevelsStory: Story = {
  name: i18n.t('minimalTiptap.storyName.headingLevelsStory', 'Heading Levels (HEADING_LEVELS)'),
  render: () => <HeadingLevelsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('heading-levels-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Heading levels list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: TOOLBAR_GROUPS ============

function ToolbarGroupsDemo() {
  return (
    <div className="flex flex-col gap-4" data-testid="toolbar-groups-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.toolbarGroupsList', 'Toolbar groups list')}
      >
        <h4 className="mb-2 font-medium">Toolbar Groups ({TOOLBAR_GROUPS.length})</h4>
        <div className="flex flex-wrap gap-2">
          {TOOLBAR_GROUPS.map((group) => (
            <span key={group} className="bg-background rounded px-2 py-1 text-xs">
              {group}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full max-w-4xl">
        <MinimalTiptapEditor
          editorContentClassName="p-4"
          onChange={() => {}}
          value={initialValue}
        />
      </div>
    </div>
  );
}

export const ToolbarGroupsStory: Story = {
  name: i18n.t('minimalTiptap.storyName.toolbarGroupsStory', 'Toolbar Groups (TOOLBAR_GROUPS)'),
  render: () => <ToolbarGroupsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('toolbar-groups-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Toolbar groups list')).toBeInTheDocument();
    expect(canvasElement.querySelector('.minimal-tiptap-editor')).toBeInTheDocument();
  },
};

// ============ CONSTANTS: CODE_SNIPPETS + CODE_LANGUAGES ============

function CodeSnippetsDemo() {
  return (
    <div className="flex flex-col gap-6" data-testid="code-snippets-demo">
      <h3 className="text-lg font-semibold">{i18n.t('minimalTiptap.demo.placeholder')}</h3>
      <div
        className="bg-muted rounded-md p-3 text-sm"
        aria-label={i18n.t('minimalTiptap.story.codeLanguagesList', 'Code languages list')}
      >
        <h4 className="mb-2 font-medium">Code Languages ({CODE_LANGUAGES.length})</h4>
        <div className="flex flex-wrap gap-2">
          {CODE_LANGUAGES.map((lang) => (
            <span key={lang} className="bg-background rounded px-2 py-1 text-xs">
              {lang}
            </span>
          ))}
        </div>
      </div>
      {Object.entries(CODE_SNIPPETS)
        .slice(0, 3)
        .map(([lang, snippet]) => (
          <div key={lang} className="w-full max-w-4xl">
            <h4 className="mb-2 text-sm font-medium">{lang}</h4>
            <MinimalTiptapEditor
              editable={false}
              editorContentClassName="p-4"
              onChange={() => {}}
              value={`<pre><code class="language-${lang}">${snippet}</code></pre>`}
            />
          </div>
        ))}
    </div>
  );
}

export const CodeSnippets: Story = {
  name: i18n.t(
    'minimalTiptap.storyName.codeSnippets',
    'Code Snippets (CODE_SNIPPETS + CODE_LANGUAGES)'
  ),
  render: () => <CodeSnippetsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('code-snippets-demo')).toBeInTheDocument();
    expect(canvas.getByLabelText('Code languages list')).toBeInTheDocument();
    const editors = canvasElement.querySelectorAll('.minimal-tiptap-editor');
    expect(editors.length).toBe(3);
  },
};

// ============ SPECIAL STATE STORIES ============
