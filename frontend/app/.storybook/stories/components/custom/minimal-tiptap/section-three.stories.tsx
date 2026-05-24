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
import { SectionThree } from '@/components/ui/custom/minimal-tiptap/components/section/three';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type SectionThreeDemoProps = {
  _actionStub?: unknown;
  content: string;
  selectionNeedle: string;
};

function SectionThreeDemo({ content, selectionNeedle }: SectionThreeDemoProps) {
  return (
    <MinimalTiptapStoryHarness
      content={content}
      onReady={(editor) => {
        requestAnimationFrame(() => {
          const needle = selectionNeedle;
          let from = -1;
          let to = -1;

          editor.state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return true;
            const index = node.text.indexOf(needle);
            if (index === -1) return true;
            from = pos + index;
            to = from + needle.length;
            return false;
          });

          if (from !== -1 && to !== -1) {
            editor.chain().focus().setTextSelection({ from, to }).run();
          }
        });
      }}
      toolbar={(editor) => (
        <SectionThree
          editor={editor}
          labels={{
            textColor: i18n.t('minimalTiptap.sectionThree.textColor'),
            default: i18n.t('minimalTiptap.sectionThree.default'),
            boldBlue: i18n.t('minimalTiptap.sectionThree.boldBlue'),
            boldTeal: i18n.t('minimalTiptap.sectionThree.boldTeal'),
            boldGreen: i18n.t('minimalTiptap.sectionThree.boldGreen'),
            boldOrange: i18n.t('minimalTiptap.sectionThree.boldOrange'),
            boldRed: i18n.t('minimalTiptap.sectionThree.boldRed'),
            boldPurple: i18n.t('minimalTiptap.sectionThree.boldPurple'),
            gray: i18n.t('minimalTiptap.sectionThree.gray'),
            blue: i18n.t('minimalTiptap.sectionThree.blue'),
            teal: i18n.t('minimalTiptap.sectionThree.teal'),
            green: i18n.t('minimalTiptap.sectionThree.green'),
            orange: i18n.t('minimalTiptap.sectionThree.orange'),
            red: i18n.t('minimalTiptap.sectionThree.red'),
            purple: i18n.t('minimalTiptap.sectionThree.purple'),
            white: i18n.t('minimalTiptap.sectionThree.white'),
            black: i18n.t('minimalTiptap.sectionThree.black'),
            blueSubtle: i18n.t('minimalTiptap.sectionThree.blueSubtle'),
            tealSubtle: i18n.t('minimalTiptap.sectionThree.tealSubtle'),
            greenSubtle: i18n.t('minimalTiptap.sectionThree.greenSubtle'),
            yellowSubtle: i18n.t('minimalTiptap.sectionThree.yellowSubtle'),
            redSubtle: i18n.t('minimalTiptap.sectionThree.redSubtle'),
            purpleSubtle: i18n.t('minimalTiptap.sectionThree.purpleSubtle'),
          }}
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Section Three',
  component: SectionThreeDemo,
  tags: ['autodocs'],
  args: {
    content: `<p>${i18n.t('sectionThree.story.pickAColorForThisWord', 'Pick a color for this word.')}</p>`,
    selectionNeedle: 'word',
    _actionStub: fn(),
  },
  argTypes: {
    // Content
    content: {
      control: { type: 'text' },
      description: i18n.t(
        'sectionThree.argType.initialHtmlContentForEditorDemoProp',
        'Initial HTML content for editor (demo prop)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    selectionNeedle: {
      control: { type: 'text' },
      description: i18n.t(
        'sectionThree.argType.textToAutoselectOnLoadDemoProp',
        'Text to auto-select on load (demo prop)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'string' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // SectionThree Props Reference (Text Color Selector):
    // - editor: Tiptap editor instance (Editor, required)
    // - labels: Localization labels (Labels)
    //   - textColor: Dropdown trigger text
    //   - default: Remove color option
    //
    // Color Categories:
    // - Bold Colors: boldBlue, boldTeal, boldGreen, boldOrange, boldRed, boldPurple
    // - Standard Colors: gray, blue, teal, green, orange, red, purple
    // - Subtle Colors: blueSubtle, tealSubtle, greenSubtle, yellowSubtle, redSubtle, purpleSubtle
    // - Contrast Colors: white (light mode), black (dark mode)
    //
    // State Behavior:
    // - Shows current color in trigger button
    // - Checkmark indicates selected color
    // - Disabled when cursor is in code block
    //
    // Usage Notes:
    // - Part of MinimalTiptap toolbar sections
    // - Requires Color extension in Tiptap
    // - Uses DropdownMenu with color swatches
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SectionThreeDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// ============================================================================
// DEFAULT STORIES
// ============================================================================

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="section-three"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Text color' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await userEvent.click(trigger);

    const boldBlueButton = root.getByLabelText('Bold blue');
    expect(boldBlueButton).toBeInTheDocument();
    await userEvent.click(boldBlueButton);
    expect(boldBlueButton.querySelector('svg')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Text color' });
    expect(trigger).toBeInTheDocument();

    // Open color picker
    await userEvent.click(trigger);

    // Verify color options are present
    const boldBlueButton = root.getByLabelText('Bold blue');
    const boldRedButton = root.getByLabelText('Bold red');
    const grayButton = root.getByLabelText('Gray');
    expect(boldBlueButton).toBeInTheDocument();
    expect(boldRedButton).toBeInTheDocument();
    expect(grayButton).toBeInTheDocument();

    // Select bold blue color
    await userEvent.click(boldBlueButton);

    // Verify checkmark appears (svg indicator)
    await waitFor(() => {
      expect(boldBlueButton.querySelector('svg')).toBeInTheDocument();
    });

    // Open again and select a different color
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(root.getByLabelText('Bold red')).toBeInTheDocument();
    });

    await userEvent.click(root.getByLabelText('Bold red'));
    await waitFor(() => {
      expect(root.getByLabelText('Bold red').querySelector('svg')).toBeInTheDocument();
    });
  },
};

// ============================================================================
// VARIANT STORIES (Dark, RTL, Japanese)
// ============================================================================

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

export const DisabledInCodeBlock: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.disabledInCodeBlock', 'Disabled (code block)'),
  args: {
    ...(Default.args ?? {}),
    content: `<pre><code>${i18n.t('sectionThree.story.pickAColorForThisWord', 'Pick a color for this word.')}</code></pre>`,
    selectionNeedle: 'word',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Text color' })).toBeDisabled();
    });
  },
};

export const DarkLabel: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.darkLabel', 'Dark label (White → Black)'),
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Text color' }));
    await waitFor(() => {
      expect(root.getByLabelText('Black')).toBeInTheDocument();
    });
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: '文字色' }));
    expect(root.getByLabelText('太字の青')).toBeInTheDocument();
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
  name: i18n.t('sectionThree.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('sectionThree.story.allFactoryData', 'All Factory Data')}
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

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionThree.story.lightThemeColors', 'Light Theme Colors')}
        </p>
        <SectionThreeDemo
          content={`<p>${i18n.t('sectionThree.story.selectTextToApplyColors', 'Select text to apply colors')}</p>`}
          selectionNeedle="colors"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Pre-colored Text</p>
        <SectionThreeDemo
          content={`<p>${i18n.t('sectionThree.story.this', 'This')}<span style="color: #2563eb">blue text</span> and <span style="color: #dc2626">red text</span> are pre-colored</p>`}
          selectionNeedle="blue"
        />
      </div>
    </div>
  ),

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionThree.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <SectionThreeDemo
            content="<p>{i18n.t('sectionThree.story.compactColorPicker', 'Compact color picker')}</p>"
            selectionNeedle="picker"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionThree.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <SectionThreeDemo
            content="<p>{i18n.t('sectionThree.story.mediumColorPicker', 'Medium color picker')}</p>"
            selectionNeedle="picker"
          />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionThree.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <SectionThreeDemo
            content="<p>{i18n.t('sectionThree.story.fullWidthColorPicker', 'Full width color picker')}</p>"
            selectionNeedle="picker"
          />
        </div>
      </div>
    </div>
  ),

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formHandlers },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Loading: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.loading },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error400BadRequest: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.badRequest },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error401Unauthorized: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unauthorized },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error403Forbidden: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.forbidden },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error422UnprocessableEntity: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.unprocessableEntity },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Error500InternalServerError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.internalServerError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const NetworkError: Story = {
  ...Default,
  parameters: {
    msw: { handlers: formStatusHandlers.networkError },
  },

  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = within(document.body);

    // Test color picker trigger is keyboard accessible
    const trigger = canvas.getByRole('button', { name: 'Text color' });
    expect(trigger).toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open color picker with keyboard
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(root.getByLabelText('Bold blue')).toBeInTheDocument();
    });

    // Color buttons should have aria-label
    const boldBlueButton = root.getByLabelText('Bold blue');
    expect(boldBlueButton).toBeInTheDocument();

    // Navigate and select with keyboard
    boldBlueButton.focus();
    await userEvent.keyboard('{Enter}');

    // Color should be selected (indicated by checkmark)
    expect(boldBlueButton.querySelector('svg')).toBeInTheDocument();
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sectionThree.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
