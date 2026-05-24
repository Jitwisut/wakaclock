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
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { LinkEditBlock } from '@/components/ui/custom/minimal-tiptap/components/link/link-edit-block';
import { useTranslation } from 'react-i18next';

import i18n from 'i18next';

seedFaker();

type LinkEditBlockDemoProps = {
  _actionStub?: unknown;
  defaultIsNewTab?: boolean;
  defaultText?: string;
  defaultUrl?: string;
};

function LinkEditBlockDemo({ defaultIsNewTab, defaultText, defaultUrl }: LinkEditBlockDemoProps) {
  const [saved, setSaved] = React.useState<{
    isNewTab?: boolean;
    text?: string;
    url: string;
  } | null>(null);

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="bg-background rounded-md border p-4">
        <LinkEditBlock
          defaultIsNewTab={defaultIsNewTab}
          defaultText={defaultText}
          defaultUrl={defaultUrl}
          labels={{
            urlLabel: i18n.t('minimalTiptap.link.urlLabel'),
            urlPlaceholder: i18n.t('minimalTiptap.link.urlPlaceholder'),
            textLabel: i18n.t('minimalTiptap.link.textLabel'),
            textPlaceholder: i18n.t('minimalTiptap.link.textPlaceholder'),
            openInNewTab: i18n.t('minimalTiptap.link.openInNewTab'),
            save: i18n.t('minimalTiptap.link.save'),
          }}
          onSave={(url, text, isNewTab) => setSaved({ url, text, isNewTab })}
        />
      </div>
      <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
        {saved
          ? JSON.stringify(saved, null, 2)
          : i18n.t('minimalTiptap.linkEditBlock.outputPlaceholder')}
      </pre>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Link Edit Block',
  component: LinkEditBlockDemo,
  tags: ['autodocs'],
  args: {
    defaultIsNewTab: false,
    defaultText: '',
    defaultUrl: '',
    _actionStub: fn(),
  },
  argTypes: {
    // State
    defaultIsNewTab: {
      control: { type: 'boolean' },
      description: i18n.t(
        'linkEditBlock.argType.defaultStateForOpenInNewTabSwitch',
        'Default state for "Open in new tab" switch'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    defaultText: {
      control: { type: 'text' },
      description: i18n.t(
        'linkEditBlock.argType.defaultDisplayTextForLink',
        'Default display text for link'
      ),
      table: {
        category: 'State',
        type: { summary: 'string' },
        defaultValue: { summary: "''" },
      },
    },
    defaultUrl: {
      control: { type: 'text' },
      description: i18n.t('linkEditBlock.argType.defaultUrlValue', 'Default URL value'),
      table: {
        category: 'State',
        type: { summary: 'string' },
        defaultValue: { summary: "''" },
      },
    },
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // LinkEditBlock Props Reference:
    // Event Handlers (documented):
    // - onSave: Called when form is saved with valid URL (url: string, text?: string, isNewTab?: boolean) => void
    // - defaultUrl: Initial URL value (string)
    // - defaultText: Initial display text (string)
    // - defaultIsNewTab: Initial new tab state (boolean)
    // - labels: Localization labels (Labels)
    //   - urlLabel: "URL" field label
    //   - urlPlaceholder: Placeholder for URL input
    //   - textLabel: "Display Text" field label
    //   - textPlaceholder: Placeholder for text input
    //   - openInNewTab: Switch label
    //   - save: Save button text
    // - onSave: Callback (url, text, isNewTab) => void
    //
    // Form Fields:
    // - URL input (required, validates as URL)
    // - Display text input (optional)
    // - "Open in new tab" switch
    // - Save button
    //
    // Validation:
    // - URL is required (uses HTML5 validation)
    // - Empty URL prevents save
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof LinkEditBlockDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="link-edit-block"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    expect(canvas.getByText(/Click.*Save.*output/)).toBeInTheDocument();

    const urlInput = canvas.getByLabelText('URL');
    if (!(urlInput instanceof HTMLInputElement)) {
      throw new TypeError('URL input was not rendered.');
    }

    const textInput = canvas.getByLabelText('Display Text (optional)');
    if (!(textInput instanceof HTMLInputElement)) {
      throw new TypeError('Text input was not rendered.');
    }

    await userEvent.clear(urlInput);
    await userEvent.type(urlInput, 'https://example.com');

    await userEvent.clear(textInput);
    await userEvent.type(textInput, 'Example link');

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(canvas.getByText(/https:\/\/example\.com/)).toBeInTheDocument();
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Prefilled: Story = {
  ...Default,
  args: {
    ...(Default.args ?? {}),
    defaultIsNewTab: true,
    defaultText: 'Example link',
    defaultUrl: 'https://example.com',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const urlInput = canvas.getByLabelText('URL');
    if (!(urlInput instanceof HTMLInputElement)) {
      throw new TypeError('URL input was not rendered.');
    }
    expect(urlInput.value).toBe('https://example.com');

    const textInput = canvas.getByLabelText('Display Text (optional)');
    if (!(textInput instanceof HTMLInputElement)) {
      throw new TypeError('Text input was not rendered.');
    }
    expect(textInput.value).toBe('Example link');

    const openInNewTab = canvas.getByRole('switch');
    expect(openInNewTab.getAttribute('aria-checked')).toBe('true');

    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(canvas.getByText(/https:\/\/example\.com/)).toBeInTheDocument();
    });
  },
};

export const Validation: Story = {
  ...Default,
  name: i18n.t('linkEditBlock.storyName.validation', 'Validation (required URL)'),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const output = canvas.getByText(/Click.*Save.*output/);

    const urlInput = canvas.getByLabelText('URL');
    if (!(urlInput instanceof HTMLInputElement)) {
      throw new TypeError('URL input was not rendered.');
    }

    await userEvent.clear(urlInput);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    expect(urlInput).toBeInvalid();
    expect(output).toBeInTheDocument();
    expect(canvas.queryByText(/https:\/\/example\.com/)).not.toBeInTheDocument();
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

    const root = within(canvasElement);
    expect(root.getByRole('button', { name: '保存' })).toBeInTheDocument();
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
  name: i18n.t('linkEditBlock.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('linkEditBlock.story.allFactoryData', 'All Factory Data')}
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
  name: i18n.t('linkEditBlock.storyName.variants', 'Variants'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditBlock.story.defaultEmpty', 'Default (empty)')}
          </div>
          <Story />
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditBlock.story.prefilled', 'Prefilled')}
          </div>
          <LinkEditBlockDemo
            defaultUrl="https://example.com"
            defaultText="Example link"
            defaultIsNewTab
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
  name: i18n.t('linkEditBlock.storyName.sizes', 'Sizes'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditBlock.story.smallContainer', 'Small container')}
          </div>
          <div className="max-w-[300px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditBlock.story.mediumContainer', 'Medium container')}
          </div>
          <div className="max-w-[450px]">
            <Story />
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            {i18n.t('linkEditBlock.story.largeContainer', 'Large container')}
          </div>
          <div className="max-w-[600px]">
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
  name: i18n.t('linkEditBlock.storyName.withMswHandlers', 'With MSW Handlers'),
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
  name: i18n.t('linkEditBlock.storyName.loading', 'Loading'),
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
  name: i18n.t('linkEditBlock.storyName.error400BadRequest', 'Error: 400 Bad Request'),
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
  name: i18n.t('linkEditBlock.storyName.error401Unauthorized', 'Error: 401 Unauthorized'),
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
  name: i18n.t('linkEditBlock.storyName.error403Forbidden', 'Error: 403 Forbidden'),
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
  name: i18n.t('linkEditBlock.storyName.error422UnprocessableEntity', 'Error: 422 Validation'),
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
  name: i18n.t('linkEditBlock.storyName.error500InternalServerError', 'Error: 500 Internal Server'),
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
  name: i18n.t('linkEditBlock.storyName.networkError', 'Network Error'),
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
  name: i18n.t('linkEditBlock.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test form labels are properly associated
    const urlInput = canvas.getByLabelText('URL');
    expect(urlInput).toHaveAttribute('type', 'text');
    expect(urlInput).toHaveAttribute('required');

    const textInput = canvas.getByLabelText('Display Text (optional)');
    expect(textInput).toHaveAttribute('type', 'text');

    // Test Tab navigation
    urlInput.focus();
    expect(document.activeElement).toBe(urlInput);

    await userEvent.tab();
    expect(document.activeElement).toBe(textInput);

    await userEvent.tab();
    const switchElement = canvas.getByRole('switch');
    expect(document.activeElement).toBe(switchElement);

    await userEvent.tab();
    const saveButton = canvas.getByRole('button', { name: 'Save' });
    expect(document.activeElement).toBe(saveButton);

    // Test switch keyboard interaction
    switchElement.focus();
    await userEvent.keyboard(' ');
    expect(switchElement.getAttribute('aria-checked')).toBe('true');
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('linkEditBlock.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('linkEditBlock.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('linkEditBlock.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('linkEditBlock.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
