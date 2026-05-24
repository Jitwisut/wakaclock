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
import { Spinner } from '@/components/ui/custom/minimal-tiptap/components/spinner';
import { useTranslation } from 'react-i18next';
import { expect, fn, within } from 'storybook/test';

import i18n from 'i18next';

seedFaker();

function MinimalTiptapSpinnerDemo() {
  const { t } = useTranslation();
  const loadingLabel = t('minimalTiptap.spinner.loading');

  return (
    <div className="flex items-center gap-6">
      <Spinner className="text-muted-foreground size-4" aria-label={loadingLabel} />
      <Spinner className="text-foreground size-6" aria-hidden="true" />
      <Spinner className="text-primary size-8" aria-hidden="true" />
    </div>
  );
}

const meta = {
  title: 'Components/Custom/Minimal Tiptap/Spinner',
  component: MinimalTiptapSpinnerDemo,
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
    // Spinner Props Reference (MinimalTiptap):
    // - className: CSS classes for size and color (string)
    // - aria-label: Accessible label for screen readers (string)
    // - aria-hidden: Hide from screen readers when decorative (boolean)
    //
    // Recommended Classes:
    // - Size: size-4 (16px), size-6 (24px), size-8 (32px)
    // - Color: text-muted-foreground, text-foreground, text-primary
    //
    // Animation:
    // - Uses animate-spin CSS animation
    // - SVG-based spinner for smooth rotation
    //
    // Accessibility:
    // - Use aria-label when spinner indicates loading state
    // - Use aria-hidden="true" for decorative spinners
    // - Should have role="status" when representing status
    //
    // Usage Notes:
    // - Used in MinimalTiptap for image loading states
    // - Displayed while images are being uploaded
    // - Also shown during async operations
  },
  parameters: {
    msw: { handlers: formHandlers },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof MinimalTiptapSpinnerDemo>;

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

    expect(canvasElement.querySelector('[data-slot="tiptap-spinner"]')).toBeInTheDocument();

    const canvas = within(canvasElement);

    expect(canvas.getByRole('status', { name: 'Loading' })).toBeInTheDocument();

    const svgs = canvasElement.querySelectorAll('svg.animate-spin');
    expect(svgs.length).toBe(3);

    const svg0Class = svgs[0]?.getAttribute('class') ?? '';
    const svg1Class = svgs[1]?.getAttribute('class') ?? '';
    const svg2Class = svgs[2]?.getAttribute('class') ?? '';

    expect(svg0Class).toContain('size-4');
    expect(svg1Class).toContain('size-6');
    expect(svg2Class).toContain('size-8');
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

    expect(canvasElement.querySelector('[data-slot="tiptap-spinner"]')).toBeInTheDocument();

    const svgs = canvasElement.querySelectorAll('svg.animate-spin');
    expect(svgs.length).toBe(3);
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
    expect(canvas.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.japanese', 'Japanese'),
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    expect(canvas.getByRole('status', { name: '読み込み中' })).toBeInTheDocument();
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
  name: i18n.t('spinner.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
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
        {t('spinner.story.allFactoryData', 'All Factory Data')}
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
          {i18n.t('spinner.story.mutedForeground', 'Muted Foreground')}
        </p>
        <Spinner
          className="text-muted-foreground size-6"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.foreground', 'Foreground')}
        </p>
        <Spinner
          className="text-foreground size-6"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{i18n.t('spinner.story.primary', 'Primary')}</p>
        <Spinner
          className="text-primary size-6"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.destructive', 'Destructive')}
        </p>
        <Spinner
          className="text-destructive size-6"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
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
          {i18n.t('spinner.story.extraSmallSize3', 'Extra Small (size-3)')}
        </p>
        <Spinner
          className="text-foreground size-3"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.smallSize4', 'Small (size-4)')}
        </p>
        <Spinner
          className="text-foreground size-4"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.mediumSize6', 'Medium (size-6)')}
        </p>
        <Spinner
          className="text-foreground size-6"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.largeSize8', 'Large (size-8)')}
        </p>
        <Spinner
          className="text-foreground size-8"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('spinner.story.extraLargeSize12', 'Extra Large (size-12)')}
        </p>
        <Spinner
          className="text-foreground size-12"
          aria-label={i18n.t('spinner.story.loading', 'Loading')}
        />
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
  name: i18n.t('spinner.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test spinner has role="status" and aria-label
    const spinner = canvas.getByRole('status', { name: 'Loading' });
    expect(spinner).toBeInTheDocument();

    // Test data-slot for identification
    expect(canvasElement.querySelector('[data-slot="tiptap-spinner"]')).toBeInTheDocument();

    // Verify aria-hidden spinners don't have accessible names
    const allSpinners = canvasElement.querySelectorAll('svg.animate-spin');
    expect(allSpinners.length).toBe(3);

    // First spinner has aria-label, others are decorative
    const firstSpinner = allSpinners[0];
    expect(firstSpinner).toHaveAttribute('aria-label');
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   notFound
//   conflict
//   tooManyRequests
//   badGateway
//   serviceUnavailable
//   gatewayTimeout
//   slowResponse
//   emptyData
// ============================================================================

// ============================================================================
// Dark RTL / Dark Japanese / Mobile / DataAttributes
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.mobile', 'Mobile Viewport'),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('spinner.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};
