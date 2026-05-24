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
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { action } from 'storybook/actions';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { ImageActionsLabels } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-actions';
import { ImageActions } from '@/components/ui/custom/minimal-tiptap/extensions/image/components/image-actions';

import i18n from 'i18next';

seedFaker();

type ImageActionsDemoProps = Pick<
  ComponentProps<typeof ImageActions>,
  'isLink' | 'shouldMerge' | 'labels' | 'onCopy' | 'onCopyLink' | 'onDownload' | 'onView'
>;

const COPY_LINK_LABEL = 'Copy image link';

function ImageActionsDemo({
  isLink,
  shouldMerge,
  labels,
  onView,
  onDownload,
  onCopy,
  onCopyLink,
}: ImageActionsDemoProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-muted relative h-28 w-full max-w-xl rounded-md border p-4">
      <div className="text-sm font-medium">
        {t('imageActions.story.hoverTheArea', 'Hover the area')}
      </div>
      <div className="text-muted-foreground mt-1 text-sm">
        {t('imageActions.story.showsImageActionButtons', 'Shows image action buttons.')}
      </div>

      <div className="group/node-image absolute inset-0" data-testid="image-actions-area">
        <ImageActions
          shouldMerge={shouldMerge}
          isLink={isLink}
          labels={labels}
          onView={onView}
          onDownload={onDownload}
          onCopy={onCopy}
          onCopyLink={onCopyLink}
        />
      </div>
    </div>
  );
}

function I18nImageActionsDemo(props: Omit<ImageActionsDemoProps, 'labels'>) {
  const { t } = useTranslation();

  const labels: ImageActionsLabels = {
    view: t('minimalTiptap.imageActions.view'),
    download: t('minimalTiptap.imageActions.download'),
    copy: t('minimalTiptap.imageActions.copy'),
    copyLink: t('minimalTiptap.imageActions.copyLink'),
    openMenu: t('minimalTiptap.imageActions.openMenu'),
  };

  return (
    <div className="bg-muted relative h-28 w-full max-w-xl rounded-md border p-4">
      <div className="text-sm font-medium">{t('minimalTiptap.imageActions.heading')}</div>
      <div className="text-muted-foreground mt-1 text-sm">
        {t('minimalTiptap.imageActions.description')}
      </div>

      <div className="group/node-image absolute inset-0" data-testid="image-actions-area">
        <ImageActions {...props} labels={labels} />
      </div>
    </div>
  );
}

async function hoverActionsArea(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const area = canvas.getByTestId('image-actions-area');
  await userEvent.hover(area);
  return canvas;
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Image Actions',
  component: ImageActionsDemo,
  tags: ['autodocs'],
  args: {
    shouldMerge: false,
    isLink: false,
    labels: undefined,
    // Event handlers with fn() for Actions panel logging
    onView: fn(),
    onDownload: fn(),
    onCopy: fn(),
    onCopyLink: fn(),
  },
  argTypes: {
    // Content
    labels: {
      control: { type: 'object' },
      description: i18n.t(
        'imageActions.argType.localizationLabelsForActionButtonsAndTooltips',
        'Localization labels for action buttons and tooltips'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ImageActionsLabels' },
      },
    },
    // Appearance
    shouldMerge: {
      control: { type: 'boolean' },
      description: i18n.t(
        'imageActions.argType.mergeActionsIntoADropdownMenuForSmallImages',
        'Merge actions into a dropdown menu (for small images)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // State
    isLink: {
      control: { type: 'boolean' },
      description: i18n.t(
        'imageActions.argType.showCopyLinkActionImageHasExternalUrl',
        'Show "Copy link" action (image has external URL)'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    // Behavior
    // (Actions are triggered via event callbacks)
    // Events
    onView: {
      action: 'onView',
      description: i18n.t(
        'imageActions.argType.calledWhenViewImageActionIsClicked',
        'Called when "View image" action is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onDownload: {
      action: 'onDownload',
      description: i18n.t(
        'imageActions.argType.calledWhenDownloadImageActionIsClicked',
        'Called when "Download image" action is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onCopy: {
      action: 'onCopy',
      description: i18n.t(
        'imageActions.argType.calledWhenCopyImageActionIsClicked',
        'Called when "Copy image" action is clicked'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    onCopyLink: {
      action: 'onCopyLink',
      description: i18n.t(
        'imageActions.argType.calledWhenCopyLinkActionIsClickedRequiresIslink',
        'Called when "Copy link" action is clicked (requires isLink)'
      ),
      table: {
        category: 'Events',
        type: { summary: '() => void' },
      },
    },
    // ImageActions Props Reference:
    // Actions Available:
    // - View: Opens image in new tab/lightbox
    // - Download: Downloads image to device
    // - Copy: Copies image to clipboard
    // - Copy Link: Copies image URL (only when isLink=true)
    //
    // Display Modes:
    // - Expanded: Individual buttons (default)
    // - Merged: Dropdown menu (shouldMerge=true)
    //
    // Labels Structure (ImageActionsLabels):
    // - view: "View image" button label
    // - download: "Download image" button label
    // - copy: "Copy image to clipboard" button label
    // - copyLink: "Copy image link" button label
    // - openMenu: "Open menu" dropdown trigger label
    //
    // Visibility:
    // - Actions appear on hover (group-hover/node-image)
    // - Positioned at top-right of image
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ImageActionsDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = await hoverActionsArea(canvasElement);

    await expect(canvas.getByRole('button', { name: 'View image' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Download image' })).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Copy image to clipboard' })
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: COPY_LINK_LABEL })).not.toBeInTheDocument();
  },
};

export const WithLink: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    isLink: true,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = await hoverActionsArea(canvasElement);

    await expect(canvas.getByRole('button', { name: COPY_LINK_LABEL })).toBeInTheDocument();
  },
};

export const WithActions: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.withActions', 'With actions (callbacks)'),
  args: {
    ...(Default.args ?? {}),
    onView: fn(),
    onDownload: fn(),
    onCopy: fn(),
  },
  play: async (context) => {
    await Default.play?.(context);

    const canvas = within(context.canvasElement);
    const view = canvas.getByRole('button', { name: 'View image' });
    const download = canvas.getByRole('button', { name: 'Download image' });
    const copy = canvas.getByRole('button', { name: 'Copy image to clipboard' });

    await userEvent.click(view);
    await userEvent.click(download);
    await userEvent.click(copy);

    await expect(context.args.onView).toHaveBeenCalledTimes(1);
    await expect(context.args.onDownload).toHaveBeenCalledTimes(1);
    await expect(context.args.onCopy).toHaveBeenCalledTimes(1);
  },
};

export const Merged: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    shouldMerge: true,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = await hoverActionsArea(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open menu' }));

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    await expect(within(content).getByText('View image')).toBeInTheDocument();
    await expect(within(content).getByText('Download image')).toBeInTheDocument();
    await expect(within(content).getByText('Copy image to clipboard')).toBeInTheDocument();
    await expect(within(content).queryByText(COPY_LINK_LABEL)).not.toBeInTheDocument();
  },
};

export const MergedWithLink: Story = {
  ...Merged,
  args: {
    ...(Merged.args ?? {}),
    isLink: true,
    onCopyLink: fn(),
  },
  play: async (context) => {
    await Merged.play?.(context);

    const content = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dropdown menu content was not rendered.');
    }

    const copyLink = within(content).getByText(COPY_LINK_LABEL);
    await userEvent.click(copyLink);

    await expect(context.args.onCopyLink).toHaveBeenCalledTimes(1);
  },
};

export const ActionPanel: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.actionPanel', 'Action panel (storybook/actions)'),
  args: {
    ...(Default.args ?? {}),
    onView: fn(() => action('image')('view')),
    onDownload: fn(() => action('image')('download')),
    onCopy: fn(() => action('image')('copy')),
    onCopyLink: fn(() => action('image')('copyLink')),
  },
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
  render: ({ labels: _labels, ...args }) => <I18nImageActionsDemo {...args} />,
  tags: ['!test'],
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
  name: i18n.t('imageActions.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('imageActions.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('imageActions.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageActions.story.expandedDefault', 'Expanded (default)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Expanded with copy link
          </div>
          <ImageActionsDemo
            isLink
            shouldMerge={false}
            onView={() => action('image')('view')}
            onDownload={() => action('image')('download')}
            onCopy={() => action('image')('copy')}
            onCopyLink={() => action('image')('copyLink')}
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageActions.story.mergedDropdown', 'Merged (dropdown)')}
          </div>
          <ImageActionsDemo
            shouldMerge
            isLink={false}
            onView={() => action('image')('view')}
            onDownload={() => action('image')('download')}
            onCopy={() => action('image')('copy')}
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Merged with copy link
          </div>
          <ImageActionsDemo
            shouldMerge
            isLink
            onView={() => action('image')('view')}
            onDownload={() => action('image')('download')}
            onCopy={() => action('image')('copy')}
            onCopyLink={() => action('image')('copyLink')}
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
  name: i18n.t('imageActions.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageActions.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[200px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageActions.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[400px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageActions.story.largeContainer', 'Large container')}
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
  name: i18n.t('imageActions.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('imageActions.storyName.loading', 'Loading'),
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
  name: i18n.t('imageActions.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('imageActions.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('imageActions.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('imageActions.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
  name: i18n.t('imageActions.storyName.error500InternalServerError', 'Error: 500 Internal Server'),
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
  name: i18n.t('imageActions.storyName.networkError', 'Network Error'),
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
  name: i18n.t('imageActions.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = await hoverActionsArea(canvasElement);

    // Test action buttons have proper aria-labels
    const viewButton = canvas.getByRole('button', { name: 'View image' });
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

    // Test keyboard activation
    await userEvent.keyboard('{Enter}');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('imageActions.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
    const container = canvasElement.querySelector('[data-testid]');
    if (container) {
      expect(container).toBeInTheDocument();
    }
  },
};
