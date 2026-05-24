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
import type { Editor } from '@tiptap/react';
import { action } from 'storybook/actions';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { ImageEditBlockLabels } from '@/components/ui/custom/minimal-tiptap/components/image/image-edit-block';
import { ImageEditBlock } from '@/components/ui/custom/minimal-tiptap/components/image/image-edit-block';

import { MinimalTiptapStoryHarness } from './_harness';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

type ImageEditBlockDemoProps = {
  editor?: Editor;
  labels?: Partial<ImageEditBlockLabels>;
  onClose?: () => void;
};

function ImageEditBlockDemo({ labels, onClose, editor: editorOverride }: ImageEditBlockDemoProps) {
  if (editorOverride) {
    return (
      <div className="bg-background w-full max-w-lg rounded-md border p-4">
        <ImageEditBlock
          editor={editorOverride}
          close={onClose ?? (() => undefined)}
          labels={labels}
        />
      </div>
    );
  }

  return (
    <MinimalTiptapStoryHarness showEditor={false}>
      {(editor) => (
        <div className="bg-background w-full max-w-lg rounded-md border p-4">
          <ImageEditBlock editor={editor} close={onClose ?? (() => undefined)} labels={labels} />
        </div>
      )}
    </MinimalTiptapStoryHarness>
  );
}

function I18nImageEditBlockDemo({ onClose, editor }: Omit<ImageEditBlockDemoProps, 'labels'>) {
  const labels: ImageEditBlockLabels = {
    attachLink: i18n.t('minimalTiptap.imageEditBlock.attachLink'),
    placeholder: i18n.t('minimalTiptap.imageEditBlock.placeholder'),
    submit: i18n.t('minimalTiptap.imageEditBlock.submit'),
    upload: i18n.t('minimalTiptap.imageEditBlock.upload'),
    fileInputAriaLabel: i18n.t('minimalTiptap.imageEditBlock.fileInputAriaLabel'),
  };

  return <ImageEditBlockDemo editor={editor} labels={labels} onClose={onClose} />;
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Image Edit Block',
  component: ImageEditBlockDemo,
  tags: ['autodocs'],
  args: {
    labels: undefined,
    onClose: undefined,
    editor: undefined,
  },
  argTypes: {
    // Content
    labels: {
      control: { type: 'object' },
      description: i18n.t(
        'imageEditBlock.argType.localizationLabelsForFormElements',
        'Localization labels for form elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ImageEditBlockLabels' },
      },
    },
    // State
    editor: {
      control: false,
      description: i18n.t(
        'imageEditBlock.argType.tiptapEditorInstanceForImageInsertion',
        'Tiptap editor instance (for image insertion)'
      ),
      table: {
        category: 'State',
        type: { summary: 'Editor' },
      },
    },
    // Events
    onClose: {
      action: 'onClose',
      description: i18n.t(
        'imageEditBlock.argType.calledWhenImageIsInsertedOrDialogClosed',
        'Called when image is inserted or dialog closed'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    // ImageEditBlock Props Reference:
    // - editor: Tiptap editor instance (Editor, required)
    // - close: Callback to close dialog/popover (() => void)
    // - labels: Localization labels (ImageEditBlockLabels)
    //   - attachLink: URL input label
    //   - placeholder: URL input placeholder
    //   - submit: Submit button text
    //   - upload: Upload button text
    //   - fileInputAriaLabel: Accessible label for file input
    //
    // Input Methods:
    // - URL: Paste image URL and click Submit
    // - Upload: Click "Upload" or drag file to input
    //
    // File Upload:
    // - Accepts image/* file types
    // - Multiple files supported
    // - Uses editor.commands.setImages()
    //
    // URL Submission:
    // - Validates URL format
    // - Inserts image at cursor position
    // - Calls close() after insertion
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ImageEditBlockDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...(meta.args ?? {}),
    onClose: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="image-edit-block"]')).toBeInTheDocument();

    const urlInput = canvas.getByLabelText('Attach an image link');
    await userEvent.type(urlInput, 'https://example.com');

    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));

    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Upload: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.upload', 'Upload (mocked editor)'),
  args: {
    ...(Default.args ?? {}),
    editor: {
      commands: {
        setImages: fn(),
      },
    } as unknown as Editor,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const file = new File(['test'], 'image.png', { type: 'image/png' });
    await userEvent.upload(canvas.getByLabelText('Upload image files'), file);

    await expect(args.onClose).toHaveBeenCalledTimes(1);
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
    expect(canvasElement.querySelector('[data-slot="image-edit-block"]')).toBeInTheDocument();
    expect(canvas.getByLabelText('Attach an image link')).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
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
  render: ({ labels: _labels, ...args }) => <I18nImageEditBlockDemo {...args} />,
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const ActionPanel: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.actionPanel', 'Action panel (storybook/actions)'),
  args: {
    ...(Default.args ?? {}),
    onClose: () => action('imageEditBlock')('close'),
  },
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
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
  name: i18n.t('imageEditBlock.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('imageEditBlock.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('imageEditBlock.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditBlock.story.defaultEmpty', 'Default (empty)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditBlock.story.withUrlPrefilled', 'With URL pre-filled')}
          </div>
          <ImageEditBlockDemo
            labels={{
              attachLink: 'Attach an image link',
              placeholder: 'https://example.com/image.jpg',
              submit: 'Submit',
              upload: 'Upload',
              fileInputAriaLabel: 'Upload image files',
            }}
            onClose={() => action('imageEditBlock')('close')}
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
  name: i18n.t('imageEditBlock.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditBlock.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[280px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditBlock.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[400px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditBlock.story.largeContainer', 'Large container')}
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
  name: i18n.t('imageEditBlock.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('imageEditBlock.storyName.loading', 'Loading'),
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
  name: i18n.t('imageEditBlock.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('imageEditBlock.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('imageEditBlock.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('imageEditBlock.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'imageEditBlock.storyName.error500InternalServerError',
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
  name: i18n.t('imageEditBlock.storyName.networkError', 'Network Error'),
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
  name: i18n.t('imageEditBlock.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test form elements have proper labels
    const urlInput = canvas.getByLabelText('Attach an image link');
    expect(urlInput).toBeInTheDocument();
    expect(urlInput).toHaveAttribute('type', 'text');

    const fileInput = canvas.getByLabelText('Upload image files');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');

    // Test submit button is present
    const submitButton = canvas.getByRole('button', { name: 'Submit' });
    expect(submitButton).toBeInTheDocument();

    // Test keyboard navigation
    urlInput.focus();
    expect(document.activeElement).toBe(urlInput);

    await userEvent.tab();
    expect(document.activeElement).toBe(submitButton);

    // Test keyboard submission
    urlInput.focus();
    await userEvent.type(urlInput, 'https://example.com/image.jpg');
    await userEvent.keyboard('{Enter}');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('imageEditBlock.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
