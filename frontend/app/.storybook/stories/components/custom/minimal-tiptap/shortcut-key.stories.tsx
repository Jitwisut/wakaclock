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
import { ShortcutKey } from '@/components/ui/custom/minimal-tiptap/components/shortcut-key';
import { useTranslation } from 'react-i18next';
import { expect, fn, within } from 'storybook/test';

import { getShortcutKey } from '@/components/ui/custom/minimal-tiptap/utils';

import i18n from 'i18next';

seedFaker();

function ShortcutKeyDemo() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="bg-background flex items-center justify-between gap-6 rounded-md border px-4 py-3">
        <span>{t('minimalTiptap.shortcutKey.openCommandPalette')}</span>
        <ShortcutKey keys={['mod', 'k']} />
      </div>
      <div className="bg-background flex items-center justify-between gap-6 rounded-md border px-4 py-3">
        <span>{t('minimalTiptap.toolbar.bold')}</span>
        <ShortcutKey keys={['mod', 'b']} />
      </div>
      <div className="bg-background flex items-center justify-between gap-6 rounded-md border px-4 py-3">
        <span>{t('minimalTiptap.sectionOne.heading2')}</span>
        <ShortcutKey keys={['mod', 'alt', '2']} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Shortcut Key',
  component: ShortcutKeyDemo,
  tags: ['autodocs'],
  args: {
    _actionStub: fn(),
  },
  argTypes: {
    // State
    _actionStub: {
      control: false,
      table: { disable: true },
    },
    // ShortcutKey Props Reference:
    // - keys: Array of key identifiers (string[], required)
    // - className: Additional CSS classes (string)
    //
    // Key Modifiers:
    // - 'mod': Ctrl on Windows/Linux, Cmd on Mac (⌘ / Ctrl)
    // - 'alt': Alt/Option key (⌥ / Alt)
    // - 'shift': Shift key (⇧)
    // - 'ctrl': Control key
    //
    // Common Key Names:
    // - Single letters: 'a'-'z', 'A'-'Z'
    // - Numbers: '0'-'9'
    // - Special: 'enter', 'escape', 'space', 'tab'
    // - Arrows: 'up', 'down', 'left', 'right'
    //
    // Display Format:
    // - Keys displayed in <kbd> elements
    // - Separated by '+' visually
    // - aria-label with readable key names
    //
    // Platform Detection:
    // - Uses getShortcutKey() utility for platform-specific symbols
    // - Mac: ⌘ for mod, ⌥ for alt
    // - Windows/Linux: Ctrl for mod, Alt for alt
    //
    // Usage Notes:
    // - Used in tooltips and keyboard shortcut hints
    // - Commonly paired with ToolbarButton tooltips
    // - Example: keys={['mod', 'b']} → "⌘ + B" on Mac
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ShortcutKeyDemo>;

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

    expect(canvasElement.querySelector('[data-slot="shortcut-key"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    const ariaLabelFor = (keys: string[]) =>
      keys.map((key) => getShortcutKey(key).readable).join(' + ');

    expect(canvas.getByText('Open command palette')).toBeInTheDocument();
    expect(canvas.getByLabelText(ariaLabelFor(['mod', 'k']))).toBeInTheDocument();
    expect(canvas.getByText('Bold')).toBeInTheDocument();
    expect(canvas.getByLabelText(ariaLabelFor(['mod', 'b']))).toBeInTheDocument();
    expect(canvas.getByText('Heading 2')).toBeInTheDocument();
    expect(canvas.getByLabelText(ariaLabelFor(['mod', 'alt', '2']))).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
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
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    expect(canvasElement.querySelector('[data-slot="shortcut-key"]')).toBeInTheDocument();

    const kbdElements = canvasElement.querySelectorAll('kbd');
    expect(kbdElements.length).toBeGreaterThan(0);
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
    expect(canvas.getByText('Open command palette')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-slot="shortcut-key"]')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('shortcutKey.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByText('コマンドパレットを開く')).toBeInTheDocument();
    expect(canvas.getByText('太字')).toBeInTheDocument();
    expect(canvas.getByText('見出し 2')).toBeInTheDocument();
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
  name: i18n.t('shortcutKey.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('shortcutKey.story.allFactoryData', 'All Factory Data')}
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
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.singleModifier', 'Single Modifier')}
        </p>
        <ShortcutKey keys={['mod', 's']} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.multipleModifiers', 'Multiple Modifiers')}
        </p>
        <ShortcutKey keys={['mod', 'shift', 's']} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.altModifier', 'Alt Modifier')}
        </p>
        <ShortcutKey keys={['mod', 'alt', 'p']} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.functionKey', 'Function Key')}
        </p>
        <ShortcutKey keys={['F1']} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.arrowKey', 'Arrow Key')}
        </p>
        <ShortcutKey keys={['mod', 'ArrowUp']} />
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
          {i18n.t('shortcutKey.story.compactDisplay', 'Compact Display')}
        </p>
        <div className="w-[200px]">
          <ShortcutKey keys={['mod', 'k']} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.standardDisplay', 'Standard Display')}
        </p>
        <div className="w-[300px]">
          <ShortcutKey keys={['mod', 'shift', 'p']} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('shortcutKey.story.wideDisplay', 'Wide Display')}
        </p>
        <div className="w-[400px]">
          <ShortcutKey keys={['mod', 'alt', 'shift', 'k']} />
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
  name: i18n.t('shortcutKey.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test shortcut keys have proper aria-labels
    const ariaLabelFor = (keys: string[]) =>
      keys.map((key) => getShortcutKey(key).readable).join(' + ');

    const modKShortcut = canvas.getByLabelText(ariaLabelFor(['mod', 'k']));
    expect(modKShortcut).toBeInTheDocument();

    const modBShortcut = canvas.getByLabelText(ariaLabelFor(['mod', 'b']));
    expect(modBShortcut).toBeInTheDocument();

    const modAlt2Shortcut = canvas.getByLabelText(ariaLabelFor(['mod', 'alt', '2']));
    expect(modAlt2Shortcut).toBeInTheDocument();

    // Verify kbd elements are present
    const kbdElements = canvasElement.querySelectorAll('kbd');
    expect(kbdElements.length).not.toBe(0);
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('shortcutKey.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('shortcutKey.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('shortcutKey.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('shortcutKey.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
