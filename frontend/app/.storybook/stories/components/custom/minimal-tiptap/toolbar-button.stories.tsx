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
import { FontBoldIcon, FontItalicIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { ToolbarButton } from '@/components/ui/custom/minimal-tiptap/components/toolbar-button';

import i18n from 'i18next';

seedFaker();

function ToolbarButtonDemo() {
  const { t } = useTranslation();
  const boldLabel = t('minimalTiptap.toolbar.bold');
  const italicLabel = t('minimalTiptap.toolbar.italic');
  const disabledLabel = t('minimalTiptap.toolbarButton.disabled');

  return (
    <div className="flex items-center gap-2">
      <ToolbarButton tooltip={boldLabel} aria-label={boldLabel} pressed>
        <FontBoldIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton tooltip={italicLabel} aria-label={italicLabel}>
        <FontItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton tooltip={disabledLabel} aria-label={disabledLabel} disabled>
        <FontBoldIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Toolbar Button',
  component: ToolbarButtonDemo,
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
    // ToolbarButton Props Reference:
    // Event Handlers (documented):
    // - onClick: Called when button is clicked (event: MouseEvent) => void
    // - onPressedChange: Called when pressed state changes (pressed: boolean) => void
    // - tooltip: Tooltip text to show on hover (string)
    // - aria-label: Accessible label for button (string, required)
    // - pressed: Whether button shows active/pressed state (boolean)
    // - disabled: Whether button is disabled (boolean)
    // - children: Icon or content inside button (ReactNode)
    // - className: Additional CSS classes (string)
    // - onClick: Click handler (function)
    //
    // Visual States:
    // - Default: data-state="off"
    // - Pressed: data-state="on" (highlighted background)
    // - Disabled: opacity reduced, non-interactive
    //
    // Tooltip Behavior:
    // - Shows on hover when tooltip prop provided
    // - Uses Tooltip component from UI library
    // - No tooltip if prop is undefined
    //
    // Usage Notes:
    // - Extends Toggle component from Radix UI
    // - Used inside ToolbarSection for formatting buttons
    // - Should have aria-label for accessibility
    // - Icon should be 16x16px (size-4 class)
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof ToolbarButtonDemo>;

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

    const canvas = within(canvasElement);
    const root = within(document.body);

    const buttons = canvas.getAllByRole('button');
    if (buttons.length < 3) throw new Error('Expected at least three toolbar buttons.');

    const [pressedButton, idleButton, disabledButton] = buttons;

    expect(pressedButton).toBeInTheDocument();
    expect(idleButton).toBeInTheDocument();
    expect(disabledButton).toBeInTheDocument();

    const pressedLabel = pressedButton.getAttribute('aria-label') ?? '';
    const idleLabel = idleButton.getAttribute('aria-label') ?? '';

    if (!pressedLabel || !idleLabel) {
      throw new Error('Expected aria-labels for toolbar buttons.');
    }

    expect(pressedButton).toHaveAttribute('data-state', 'on');
    expect(pressedButton).toHaveAttribute('aria-pressed', 'true');
    expect(idleButton).toHaveAttribute('data-state', 'off');
    expect(idleButton).toHaveAttribute('aria-pressed', 'false');
    expect(disabledButton).toBeDisabled();

    await userEvent.hover(pressedButton);
    expect(await root.findByText(pressedLabel)).toBeInTheDocument();
    await userEvent.unhover(pressedButton);

    await userEvent.hover(idleButton);
    expect(await root.findByText(idleLabel)).toBeInTheDocument();
  },
};

export const Playground: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    const buttons = canvas.getAllByRole('button');
    const [pressedButton, idleButton, disabledButton] = buttons;

    // Verify initial states
    expect(pressedButton).toBeInTheDocument();
    expect(pressedButton).toHaveAttribute('aria-pressed', 'true');
    expect(idleButton).toHaveAttribute('aria-pressed', 'false');
    expect(disabledButton).toBeDisabled();

    // Test toggle behavior on idle button
    await userEvent.click(idleButton);
    await waitFor(() => {
      expect(idleButton).toHaveAttribute('aria-pressed', 'true');
      expect(idleButton).toHaveAttribute('data-state', 'on');
    });

    // Toggle off
    await userEvent.click(idleButton);
    await waitFor(() => {
      expect(idleButton).toHaveAttribute('aria-pressed', 'false');
      expect(idleButton).toHaveAttribute('data-state', 'off');
    });

    // Test keyboard toggle with Space
    idleButton.focus();
    expect(document.activeElement).toBe(idleButton);
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(idleButton).toHaveAttribute('aria-pressed', 'true');
    });

    // Test that disabled button cannot be clicked
    const disabledInitialState = disabledButton.getAttribute('data-state');
    await userEvent.click(disabledButton);
    expect(disabledButton).toHaveAttribute('data-state', disabledInitialState);
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

export const WithoutTooltip: Story = {
  name: i18n.t('toolbarButton.storyName.withoutTooltip', 'Without tooltip'),
  render: () => (
    <div className="flex items-center gap-2">
      <ToolbarButton aria-label={i18n.t('toolbarButton.story.noTooltip', 'No tooltip')}>
        <FontBoldIcon className="size-4" />
      </ToolbarButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'No tooltip' });

    await userEvent.hover(button);

    expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('toolbarButton.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByRole('button', { name: '太字' }).getAttribute('data-state')).toBe('on');
    expect(canvas.getByRole('button', { name: '斜体' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: '無効' })).toBeDisabled();
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
  name: i18n.t('toolbarButton.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('toolbarButton.story.allFactoryData', 'All Factory Data')}
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
          {i18n.t('toolbarButton.story.defaultState', 'Default State')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
        >
          <FontBoldIcon className="size-4" />
        </ToolbarButton>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarButton.story.pressedState', 'Pressed State')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
          pressed
        >
          <FontBoldIcon className="size-4" />
        </ToolbarButton>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarButton.story.disabledState', 'Disabled State')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
          disabled
        >
          <FontBoldIcon className="size-4" />
        </ToolbarButton>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarButton.story.withoutTooltip', 'Without Tooltip')}
        </p>
        <ToolbarButton aria-label={i18n.t('toolbarButton.story.italic', 'Italic')}>
          <FontItalicIcon className="size-4" />
        </ToolbarButton>
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
          {i18n.t('toolbarButton.story.smallIconSize3', 'Small Icon (size-3)')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
        >
          <FontBoldIcon className="size-3" />
        </ToolbarButton>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarButton.story.defaultIconSize4', 'Default Icon (size-4)')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
        >
          <FontBoldIcon className="size-4" />
        </ToolbarButton>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('toolbarButton.story.largeIconSize5', 'Large Icon (size-5)')}
        </p>
        <ToolbarButton
          tooltip={i18n.t('toolbarButton.story.bold', 'Bold')}
          aria-label={i18n.t('toolbarButton.story.bold', 'Bold')}
        >
          <FontBoldIcon className="size-5" />
        </ToolbarButton>
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
  name: i18n.t('toolbarButton.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = within(document.body);

    const buttons = canvas.getAllByRole('button');
    const [pressedButton, idleButton, disabledButton] = buttons;

    // Test all buttons have aria-labels
    expect(pressedButton.getAttribute('aria-label')).not.toBe('');
    expect(idleButton.getAttribute('aria-label')).not.toBe('');
    expect(disabledButton.getAttribute('aria-label')).not.toBe('');

    // Test keyboard navigation
    pressedButton.focus();
    expect(document.activeElement).toBe(pressedButton);

    await userEvent.tab();
    expect(document.activeElement).toBe(idleButton);

    // Disabled button should be skipped
    await userEvent.tab();
    expect(document.activeElement).not.toBe(disabledButton);

    // Test keyboard toggle
    idleButton.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => {
      expect(idleButton.getAttribute('data-state')).toBe('on');
    });

    // Test tooltip appears on hover
    await userEvent.hover(pressedButton);
    const tooltip = await root.findByText(pressedButton.getAttribute('aria-label') ?? '');
    expect(tooltip).toBeInTheDocument();
  },
};

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('toolbarButton.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('toolbarButton.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('toolbarButton.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('toolbarButton.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
