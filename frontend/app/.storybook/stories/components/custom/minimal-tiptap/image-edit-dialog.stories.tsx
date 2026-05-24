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
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { Editor } from '@tiptap/react';

import { ImageEditDialog } from '@/components/ui/custom/minimal-tiptap/components/image/image-edit-dialog';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type ImageEditDialogDemoProps = {
  _actionStub?: unknown;
} & Pick<ComponentProps<typeof ImageEditDialog>, 'labels'>;

function ImageEditDialogDisabledNotEditable() {
  const editor = {
    isEditable: false,
    isActive: () => false,
  } as unknown as Editor;

  return <ImageEditDialog editor={editor} />;
}

function ImageEditDialogDisabledInCodeBlock() {
  const editor = {
    isEditable: true,
    isActive: (name: string) => name === 'codeBlock',
  } as unknown as Editor;

  return <ImageEditDialog editor={editor} />;
}

function ImageEditDialogDemo(props: ImageEditDialogDemoProps) {
  return (
    <MinimalTiptapStoryHarness
      content={`<p>${i18n.t('imageEditDialog.story.clickTheImageIconToInsertAnImage', 'Click the image icon to insert an image.')}</p>`}
      toolbar={(editor) => <ImageEditDialog editor={editor} {...props} />}
    />
  );
}

function I18nImageEditDialogDemo(props: ImageEditDialogDemoProps) {
  const { t } = useTranslation();

  return (
    <ImageEditDialogDemo
      {...props}
      labels={{
        trigger: t('minimalTiptap.imageEditDialog.trigger'),
        dialogTitle: t('minimalTiptap.imageEditDialog.dialogTitle'),
        dialogDescription: t('minimalTiptap.imageEditDialog.dialogDescription'),
        editBlock: {
          attachLink: t('minimalTiptap.imageEditBlock.attachLink'),
          placeholder: t('minimalTiptap.imageEditBlock.placeholder'),
          submit: t('minimalTiptap.imageEditBlock.submit'),
          upload: t('minimalTiptap.imageEditBlock.upload'),
          fileInputAriaLabel: t('minimalTiptap.imageEditBlock.fileInputAriaLabel'),
        },
      }}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Image Edit Dialog',
  component: ImageEditDialogDemo,
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
        'imageEditDialog.argType.localizationLabelsForDialogAndForm',
        'Localization labels for dialog and form'
      ),
      table: {
        category: 'Content',
        type: { summary: 'ImageEditDialogLabels' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // ImageEditDialog Props Reference:
    // - editor: Tiptap editor instance (Editor, required)
    // - labels: Localization labels (ImageEditDialogLabels)
    //   - trigger: Tooltip for toolbar button
    //   - dialogTitle: Dialog header title
    //   - dialogDescription: Dialog description text
    //   - editBlock: ImageEditBlock labels (nested)
    //
    // Trigger Button:
    // - Icon button with image icon
    // - Disabled when not editable
    // - Disabled in code blocks
    //
    // Dialog Content:
    // - Title: "Select image"
    // - Contains ImageEditBlock form
    // - Closes on successful insertion
    //
    // State Behavior:
    // - Disabled when editor.isEditable is false
    // - Disabled when cursor is in code block
    // - Uses Dialog from UI library
    //
    // Integration:
    // - Part of SectionFive toolbar section
    // - Works with Image extension in Tiptap
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ImageEditDialogDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const trigger = canvas.getByRole('button', { name: 'Image' });
    await userEvent.click(trigger);

    const content = document.querySelector('[data-slot="dialog-content"]');

    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dialog content was not rendered.');
    }

    await within(content).findByText('Select image');
    await within(content).findByLabelText('Attach an image link');

    expect(content).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DisabledNotEditable: Story = {
  name: i18n.t('imageEditDialog.storyName.disabledNotEditable', 'Disabled (not editable)'),
  render: () => <ImageEditDialogDisabledNotEditable />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Image' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeDisabled();
  },
};

export const DisabledInCodeBlock: Story = {
  name: i18n.t('imageEditDialog.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  render: () => <ImageEditDialogDisabledInCodeBlock />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Image' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toBeDisabled();
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
    const trigger = canvas.getByRole('button', { name: 'Image' });
    expect(trigger).toBeInTheDocument();
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
  render: (args) => <I18nImageEditDialogDemo {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button');
    expect(trigger).toBeInTheDocument();
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
  name: i18n.t('imageEditDialog.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('imageEditDialog.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('imageEditDialog.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditDialog.story.defaultEnabled', 'Default (enabled)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Disabled (not editable)
          </div>
          <ImageEditDialogDisabledNotEditable />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            Disabled (in code block)
          </div>
          <ImageEditDialogDisabledInCodeBlock />
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
  name: i18n.t('imageEditDialog.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditDialog.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[300px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditDialog.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[500px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('imageEditDialog.story.largeContainer', 'Large container')}
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
  name: i18n.t('imageEditDialog.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('imageEditDialog.storyName.loading', 'Loading'),
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
  name: i18n.t('imageEditDialog.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('imageEditDialog.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('imageEditDialog.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('imageEditDialog.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
    'imageEditDialog.storyName.error500InternalServerError',
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
  name: i18n.t('imageEditDialog.storyName.networkError', 'Network Error'),
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
  name: i18n.t('imageEditDialog.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test trigger button is keyboard accessible
    const trigger = canvas.getByRole('button', { name: 'Image' });
    expect(trigger).toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open dialog with keyboard
    await userEvent.keyboard('{Enter}');

    const content = document.querySelector('[data-slot="dialog-content"]');
    if (!(content instanceof HTMLElement)) {
      throw new TypeError('Dialog content was not rendered.');
    }

    // Verify dialog has proper ARIA attributes
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();

    // Test form elements are accessible
    const urlInput = await within(content).findByLabelText('Attach an image link');
    expect(urlInput).toBeInTheDocument();

    // Tab navigation within dialog
    urlInput.focus();
    expect(document.activeElement).toBe(urlInput);

    // Close dialog with Escape
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('imageEditDialog.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('imageEditDialog.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('imageEditDialog.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('imageEditDialog.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
