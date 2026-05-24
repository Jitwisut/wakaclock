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
import { SectionFour } from '@/components/ui/custom/minimal-tiptap/components/section/four';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { MinimalTiptapStoryHarness } from './_harness';

import i18n from 'i18next';

seedFaker();

type SectionFourDemoProps = {
  _actionStub?: unknown;
  mainActionCount: number;
};

function SectionFourDemo({ mainActionCount }: SectionFourDemoProps) {
  return (
    <MinimalTiptapStoryHarness
      content={`<p>${i18n.t('sectionFour.story.listFormattingControls', 'List formatting controls.')}</p>`}
      toolbar={(editor) => (
        <SectionFour
          editor={editor}
          activeActions={['orderedList', 'bulletList']}
          mainActionCount={mainActionCount}
          labels={{
            orderedList: i18n.t('minimalTiptap.toolbar.orderedList'),
            bulletList: i18n.t('minimalTiptap.toolbar.bulletList'),
            lists: i18n.t('minimalTiptap.toolbar.lists'),
          }}
        />
      )}
    />
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Section Four',
  component: SectionFourDemo,
  tags: ['autodocs'],
  args: {
    mainActionCount: 0,
    _actionStub: fn(),
  },
  argTypes: {
    // Appearance
    mainActionCount: {
      control: { type: 'number' },
      description: i18n.t(
        'sectionFour.argType.numberOfActionsShownInMainToolbarRestInDropdown',
        'Number of actions shown in main toolbar (rest in dropdown)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // SectionFour Props Reference (List Formatting):
    // - editor: Tiptap editor instance (Editor, required)
    // - activeActions: List actions to enable (ListAction[])
    // - mainActionCount: Actions in main toolbar (number, default: 0)
    // - labels: Localization labels (Labels)
    //   - orderedList: Numbered list label
    //   - bulletList: Bullet list label
    //   - lists: Dropdown trigger text
    //
    // ListAction Options:
    // - 'orderedList': Numbered/ordered list (1. 2. 3.)
    // - 'bulletList': Bullet/unordered list (• • •)
    //
    // Layout Behavior:
    // - mainActionCount=0: All in dropdown
    // - mainActionCount=2: All as main buttons (no dropdown)
    //
    // State Behavior:
    // - Toggle buttons show active state when format applied
    // - Toggles between list types (clicking one removes other)
    //
    // Usage Notes:
    // - Part of MinimalTiptap toolbar sections
    // - Requires OrderedList and BulletList extensions
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof SectionFourDemo>;

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

    expect(canvasElement.querySelector('[data-slot="section-four"]')).toBeInTheDocument();

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Lists' });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await userEvent.click(trigger);
    expect(await root.findByText('Numbered list')).toBeInTheDocument();
    expect(await root.findByText('Bullet list')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const root = within(document.body);

    const trigger = canvas.getByRole('button', { name: 'Lists' });
    expect(trigger).toBeInTheDocument();

    // Open dropdown and select numbered list
    await userEvent.click(trigger);
    const numberedListOption = await root.findByText('Numbered list');
    expect(numberedListOption).toBeInTheDocument();
    await userEvent.click(numberedListOption);

    // Verify dropdown closed
    await waitFor(() => {
      expect(root.queryByText('Numbered list')).not.toBeInTheDocument();
    });

    // Open again and select bullet list
    await userEvent.click(trigger);
    const bulletListOption = await root.findByText('Bullet list');
    expect(bulletListOption).toBeInTheDocument();
    await userEvent.click(bulletListOption);

    // Verify dropdown closed again
    await waitFor(() => {
      expect(root.queryByText('Bullet list')).not.toBeInTheDocument();
    });
  },
};

export const AllMainActions: Story = {
  ...Default,
  name: i18n.t('sectionFour.storyName.allMainActions', 'All main actions (no dropdown)'),
  args: {
    ...(Default.args ?? {}),
    mainActionCount: 2,
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.queryByRole('button', { name: 'Lists' })).not.toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Numbered list' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Bullet list' })).toBeInTheDocument();
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
    const root = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'リスト' }));
    expect(await root.findByText('番号付きリスト')).toBeInTheDocument();
    expect(await root.findByText('箇条書き')).toBeInTheDocument();
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
  name: i18n.t('sectionFour.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {i18n.t('sectionFour.story.allFactoryData', 'All Factory Data')}
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
        <p className="mb-2 text-sm font-medium">All in Dropdown (mainActionCount: 0)</p>
        <SectionFourDemo mainActionCount={0} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">One Main Action (mainActionCount: 1)</p>
        <SectionFourDemo mainActionCount={1} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">All Main Actions (mainActionCount: 2)</p>
        <SectionFourDemo mainActionCount={2} />
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
          {i18n.t('sectionFour.story.compactContainer', 'Compact Container')}
        </p>
        <div className="w-[300px]">
          <SectionFourDemo mainActionCount={0} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionFour.story.mediumContainer', 'Medium Container')}
        </p>
        <div className="w-[500px]">
          <SectionFourDemo mainActionCount={1} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('sectionFour.story.fullWidthContainer', 'Full Width Container')}
        </p>
        <div className="w-full">
          <SectionFourDemo mainActionCount={2} />
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
  name: i18n.t('sectionFour.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = within(document.body);

    // Test lists dropdown trigger is keyboard accessible
    const trigger = canvas.getByRole('button', { name: 'Lists' });
    expect(trigger).toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open dropdown with keyboard
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(root.getByText('Numbered list')).toBeInTheDocument();
    });

    // Navigate with arrow keys
    await userEvent.keyboard('{ArrowDown}');

    // Select with Enter
    await userEvent.keyboard('{Enter}');

    // Dropdown should close
    await waitFor(() => {
      expect(root.queryByText('Numbered list')).not.toBeInTheDocument();
    });
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('sectionFour.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('sectionFour.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('sectionFour.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('sectionFour.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
