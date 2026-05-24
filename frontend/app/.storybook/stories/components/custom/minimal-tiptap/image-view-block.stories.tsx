import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentProps } from 'react';
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
import { expect, fn, userEvent, within } from 'storybook/test';

import { ImageViewBlock } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-view-block';
import { useMinimalTiptapEditor } from '@/components/ui/custom/minimal-tiptap/hooks/use-minimal-tiptap';

import i18n from 'i18next';

seedFaker();

type ImageViewBlockDemoProps = {
  _actionStub?: unknown;
} & Pick<ComponentProps<typeof ImageViewBlock>, 'labels'>;

const NODE_VIEW_DESCRIPTION = 'NodeView demo (hover to reveal actions, drag handles, etc).';
const DEMO_IMAGE = 'Demo image';

function ImageViewBlockDemo(props: ImageViewBlockDemoProps) {
  const editor = useMinimalTiptapEditor({
    content: '<p></p>',
    output: 'html',
    throttleDelay: 0,
  });

  const [attrs, setAttrs] = React.useState({
    id: 'sb-image',
    src: '/images/extra/image1.jpg',
    width: 520,
    height: 320,
    fileName: 'image1.jpg',
    alt: DEMO_IMAGE,
    title: DEMO_IMAGE,
  });

  if (!editor) return null;

  const node = editor.schema.nodes.image.create(attrs);

  const nodeViewProps = {
    editor,
    node,
    selected: true,
    labels: props.labels,
    updateAttributes: (next: Partial<typeof attrs>) => setAttrs((prev) => ({ ...prev, ...next })),
  } as unknown as React.ComponentProps<typeof ImageViewBlock>;

  return (
    <div className="w-full max-w-4xl">
      <div className="text-muted-foreground mb-3 text-sm">{NODE_VIEW_DESCRIPTION}</div>
      <div className="group/node-image bg-background rounded-md border p-4">
        <ImageViewBlock {...nodeViewProps} />
      </div>
    </div>
  );
}

function ImageViewBlockMergedDemo(props: ImageViewBlockDemoProps) {
  const editor = useMinimalTiptapEditor({
    content: '<p></p>',
    output: 'html',
    throttleDelay: 0,
  });

  const [attrs, setAttrs] = React.useState({
    id: 'sb-image',
    src: '/images/extra/image1.jpg',
    width: 160,
    height: 120,
    fileName: 'image1.jpg',
    alt: DEMO_IMAGE,
    title: DEMO_IMAGE,
  });

  if (!editor) return null;

  const node = editor.schema.nodes.image.create(attrs);

  const nodeViewProps = {
    editor,
    node,
    selected: true,
    labels: props.labels,
    updateAttributes: (next: Partial<typeof attrs>) => setAttrs((prev) => ({ ...prev, ...next })),
  } as unknown as React.ComponentProps<typeof ImageViewBlock>;

  return (
    <div className="w-full max-w-4xl">
      <div className="text-muted-foreground mb-3 text-sm">{NODE_VIEW_DESCRIPTION}</div>
      <div className="group/node-image bg-background rounded-md border p-4">
        <ImageViewBlock {...nodeViewProps} />
      </div>
    </div>
  );
}

function ImageViewBlockErrorDemo(props: ImageViewBlockDemoProps) {
  const editor = useMinimalTiptapEditor({
    content: '<p></p>',
    output: 'html',
    throttleDelay: 0,
  });

  const [attrs, setAttrs] = React.useState({
    id: 'sb-image',
    src: '/images/extra/does-not-exist.jpg',
    width: 520,
    height: 320,
    fileName: 'does-not-exist.jpg',
    alt: 'Missing image',
    title: 'Missing image',
  });

  if (!editor) return null;

  const node = editor.schema.nodes.image.create(attrs);

  const nodeViewProps = {
    editor,
    node,
    selected: true,
    labels: props.labels,
    updateAttributes: (next: Partial<typeof attrs>) => setAttrs((prev) => ({ ...prev, ...next })),
  } as unknown as React.ComponentProps<typeof ImageViewBlock>;

  return (
    <div className="w-full max-w-4xl">
      <div className="text-muted-foreground mb-3 text-sm">{NODE_VIEW_DESCRIPTION}</div>
      <div className="group/node-image bg-background rounded-md border p-4">
        <ImageViewBlock {...nodeViewProps} />
      </div>
    </div>
  );
}

function I18nImageViewBlockDemo(props: ImageViewBlockDemoProps) {
  const { t } = useTranslation();

  return (
    <ImageViewBlockDemo
      {...props}
      labels={{
        failedToLoad: t('minimalTiptap.imageViewBlock.failedToLoad'),
        removeImage: t('minimalTiptap.imageViewBlock.removeImage'),
        overlay: {
          uploading: t('minimalTiptap.imageOverlay.uploading'),
        },
        actions: {
          view: t('minimalTiptap.imageActions.view'),
          download: t('minimalTiptap.imageActions.download'),
          copy: t('minimalTiptap.imageActions.copy'),
          copyLink: t('minimalTiptap.imageActions.copyLink'),
          openMenu: t('minimalTiptap.imageActions.openMenu'),
        },
      }}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Image View Block',
  component: ImageViewBlockDemo,
  tags: ['autodocs'],
  args: {
    labels: undefined,
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    labels: {
      control: { type: 'object' },
      description: i18n.t(
        'imageViewBlock.argType.localizationLabelsForAllImageViewBlockElements',
        'Localization labels for all image view block elements'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ImageViewBlockLabels' },
      },
    },
    // Appearance
    // (Styling controlled via image attributes and container)
    // State
    // (Image state managed internally: loading, error, selected)
    // Behavior
    _actionStub: {
      control: false,
      description: i18n.t(
        'imageViewBlock.argType.internalStubForActionPanelLogging',
        'Internal stub for action panel logging'
      ),
      table: {
        category: 'Behavior',
        type: { summary: 'unknown' },
      },
    },
    // Events
    // (Events handled via Tiptap editor instance)
    // ImageViewBlock Props Reference:
    // Required Props (from Tiptap NodeViewProps):
    // - editor: Tiptap editor instance (Editor)
    // - node: ProseMirror node representing the image
    // - selected: Whether the node is currently selected
    // - updateAttributes: Function to update node attributes
    //
    // Labels Structure (ImageViewBlockLabels):
    // - failedToLoad: Error message when image fails to load
    // - removeImage: Button label for removing failed image
    // - overlay: { uploading: string } - Upload overlay labels
    // - actions: ImageActionsLabels - Action button labels
    //
    // Image Attributes (via node.attrs):
    // - id: Unique identifier for the image
    // - src: Image source URL
    // - width: Image width in pixels
    // - height: Image height in pixels
    // - fileName: Original file name
    // - alt: Alt text for accessibility
    // - title: Title attribute
    //
    // Features:
    // - Resizable with drag handles
    // - Action buttons on hover (view, download, copy)
    // - Upload overlay during file upload
    // - Error state with fallback message
    // - Responsive image sizing
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ImageViewBlockDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    await canvas.findByRole('img', { name: 'Demo image' });

    await canvas.findByRole('button', { name: 'View image' });
    expect(canvas.getByRole('button', { name: 'Download image' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Copy image to clipboard' })).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Merged: Story = {
  ...Default,
  render: (args) => <ImageViewBlockMergedDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const trigger = await canvas.findByRole('button', { name: 'Open menu' });
    await userEvent.click(trigger);

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    await within(content).findByText('View image');
    await within(content).findByText('Download image');
    await within(content).findByText('Copy image to clipboard');
  },
};

export const ErrorState: Story = {
  ...Default,
  render: (args) => <ImageViewBlockErrorDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const img = await canvas.findByRole('img', { name: 'Missing image' });
    img.dispatchEvent(new Event('error'));

    await canvas.findByText('Failed to load image');
    expect(canvas.getByRole('button', { name: 'Remove image' })).toBeInTheDocument();
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
  globals: {
    locale: 'ja',
  },
  render: (args) => <I18nImageViewBlockDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole('img', { name: 'Demo image' });

    await canvas.findByRole('button', { name: '画像を表示' });
    expect(canvas.getByRole('button', { name: '画像をダウンロード' })).toBeInTheDocument();
    expect(
      canvas.getByRole('button', { name: '画像をクリップボードにコピー' })
    ).toBeInTheDocument();
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
  name: i18n.t('imageViewBlock.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('imageViewBlock.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('imageViewBlock.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.defaultExpanded', 'Default (expanded)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.mergedDropdown', 'Merged (dropdown)')}
          </div>
          <ImageViewBlockMergedDemo />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.errorState', 'Error state')}
          </div>
          <ImageViewBlockErrorDemo />
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
  name: i18n.t('imageViewBlock.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[300px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[500px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageViewBlock.story.largeContainer', 'Large container')}
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
  name: i18n.t('imageViewBlock.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('imageViewBlock.storyName.loading', 'Loading'),
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
  name: i18n.t('imageViewBlock.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('imageViewBlock.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('imageViewBlock.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('imageViewBlock.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'imageViewBlock.storyName.error500InternalServerError',
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
  name: i18n.t('imageViewBlock.storyName.networkError', 'Network Error'),
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
  name: i18n.t('imageViewBlock.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test image has proper alt text
    const img = await canvas.findByRole('img', { name: 'Demo image' });
    expect(img).toHaveAttribute('alt', 'Demo image');

    // Test action buttons have proper aria-labels
    const viewButton = await canvas.findByRole('button', { name: 'View image' });
    expect(viewButton).toBeInTheDocument();

    const downloadButton = canvas.getByRole('button', { name: 'Download image' });
    expect(downloadButton).toBeInTheDocument();

    const copyButton = canvas.getByRole('button', { name: 'Copy image to clipboard' });
    expect(copyButton).toBeInTheDocument();

    // Test keyboard navigation
    viewButton.focus();
    expect(document.activeElement).toBe(viewButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(downloadButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(copyButton);
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('imageViewBlock.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('imageViewBlock.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('imageViewBlock.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('imageViewBlock.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
