import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';

import { formatBytes, useFileUpload } from '@/hooks/use-file-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { File, Image, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// Basic file upload demo
function FileUploadDemo({
  multiple = false,
  maxSize,
  accept,
  maxFiles,
}: {
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
}) {
  const { t } = useTranslation();
  const [state, actions] = useFileUpload({
    multiple,
    maxSize,
    accept,
    maxFiles,
    onFilesChange: fn(),
    onFilesAdded: fn(),
  });

  return (
    <Card className="w-[500px]" data-testid="file-upload-demo">
      <CardHeader>
        <CardTitle>{t('useFileUpload.story.fileUploadDemo', 'File Upload Demo')}</CardTitle>
        <CardDescription>
          {multiple
            ? t('useFileUpload.story.uploadMultipleFiles', 'Upload multiple files')
            : t('useFileUpload.story.uploadSingleFile', 'Upload a single file')}
          {maxSize && ` (max ${formatBytes(maxSize)})`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${state.isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'} `}
          data-testid="drop-zone"
          onDragEnter={actions.handleDragEnter}
          onDragLeave={actions.handleDragLeave}
          onDragOver={actions.handleDragOver}
          onDrop={actions.handleDrop}
        >
          <Upload className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground mb-2 text-sm">
            {state.isDragging
              ? t('useFileUpload.story.dropFilesHere', 'Drop files here')
              : t('useFileUpload.story.dragAndDropFilesHere', 'Drag and drop files here')}
          </p>
          <Button onClick={actions.openFileDialog} size="sm" variant="secondary">
            {t('useFileUpload.story.browseFiles', 'Browse Files')}
          </Button>
          <input {...actions.getInputProps()} className="hidden" data-testid="file-input" />
        </div>

        {/* Errors */}
        {state.errors.length > 0 && (
          <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
            {state.errors.map((error) => (
              <p key={error} className="text-destructive text-sm" data-testid="error-message">
                {error}
              </p>
            ))}
            <Button className="mt-2" onClick={actions.clearErrors} size="sm" variant="ghost">
              {t('useFileUpload.story.clearErrors', 'Clear errors')}
            </Button>
          </div>
        )}

        {/* Files list */}
        {state.files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {t('useFileUpload.story.filesCount', 'Files ({{count}})', {
                  count: state.files.length,
                })}
              </p>
              <Button onClick={actions.clearFiles} size="sm" variant="ghost">
                {t('useFileUpload.story.clearAll', 'Clear all')}
              </Button>
            </div>
            {state.files.map((file) => (
              <div
                key={file.id}
                className="bg-muted flex items-center gap-3 rounded-lg p-2"
                data-testid="file-item"
              >
                {file.preview &&
                file.file instanceof File &&
                file.file.type.startsWith('image/') ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted-foreground/10 flex h-10 w-10 items-center justify-center rounded">
                    {file.file instanceof File && file.file.type.startsWith('image/') ? (
                      <Image className="text-muted-foreground h-5 w-5" />
                    ) : (
                      <File className="text-muted-foreground h-5 w-5" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.file.name}</p>
                  <p className="text-muted-foreground text-xs">{formatBytes(file.file.size)}</p>
                </div>
                <Button onClick={() => actions.removeFile(file.id)} size="icon" variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* State debug */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="mb-2 text-xs font-medium">
            {t('useFileUpload.story.hookState', 'Hook State')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">files: {state.files.length}</Badge>
            <Badge variant="outline">isDragging: {String(state.isDragging)}</Badge>
            <Badge variant="outline">errors: {state.errors.length}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Wrapper for meta component
function HookWrapper() {
  return <FileUploadDemo />;
}

const meta = {
  title: 'Hooks/useFileUpload',
  component: HookWrapper,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## useFileUpload

A comprehensive file upload hook with drag-and-drop support.

### Usage

\`\`\`tsx
import { useFileUpload } from '@/hooks/use-file-upload';

function MyUploader() {
  const [state, actions] = useFileUpload({
    multiple: true,
    maxSize: 5 * 1024 * 1024, // 5MB
    accept: 'image/*',
    maxFiles: 10,
    onFilesChange: (files) => console.log(files),
  });

  return (
    <div
      onDragEnter={actions.handleDragEnter}
      onDragLeave={actions.handleDragLeave}
      onDragOver={actions.handleDragOver}
      onDrop={actions.handleDrop}
    >
      <input {...actions.getInputProps()} />
      <button onClick={actions.openFileDialog}>{i18n.t('useFileUpload.story.upload', 'Upload')}</button>
    </div>
  );
}
\`\`\`

### Options

- **multiple**: Allow multiple file selection (default: false)
- **maxSize**: Maximum file size in bytes
- **maxFiles**: Maximum number of files (when multiple is true)
- **accept**: Accepted file types (e.g., 'image/*', '.pdf')
- **initialFiles**: Pre-populate with existing files
- **onFilesChange**: Callback when files change
- **onFilesAdded**: Callback when new files are added

### State

- **files**: Array of FileWithPreview objects
- **isDragging**: Whether user is dragging over drop zone
- **errors**: Array of validation error messages

### Actions

- **addFiles**: Add files programmatically
- **removeFile**: Remove a file by ID
- **clearFiles**: Clear all files
- **clearErrors**: Clear all errors
- **openFileDialog**: Open native file picker
- **getInputProps**: Get props for hidden input element
- **handleDrag***: Drag event handlers
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof HookWrapper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FileUploadDemo />,
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const canvas = within(canvasElement);

    // Verify demo is rendered
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
    expect(canvas.getByTestId('file-input')).toBeInTheDocument();
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const SingleFile: Story = {
  render: () => <FileUploadDemo multiple={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const MultipleFiles: Story = {
  render: () => <FileUploadDemo multiple maxFiles={5} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const WithMaxSize: Story = {
  render: () => <FileUploadDemo maxSize={1024 * 1024} />, // 1MB
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const ImagesOnly: Story = {
  render: () => <FileUploadDemo accept="image/*" multiple />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const PDFsOnly: Story = {
  render: () => <FileUploadDemo accept=".pdf,application/pdf" multiple />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('useFileUpload.story.singleFile', 'Single File')}
        </p>
        <FileUploadDemo />
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-sm">
          {i18n.t('useFileUpload.story.multipleFilesMax3', 'Multiple Files (max 3)')}
        </p>
        <FileUploadDemo multiple maxFiles={3} />
      </div>
    </div>
  ),
  tags: ['!test'],
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
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('drop-zone')).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    expect(canvas.getByTestId('file-input')).toBeInTheDocument();
  },
};

export const Japanese: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    locale: 'ja',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByTestId('file-upload-demo')).toBeInTheDocument();
    const browseButton = canvas.getByRole('button', { name: /browse/i });
    expect(browseButton).toBeInTheDocument();
  },
  tags: ['!test'],
};

// ============ COMBINED VARIANTS ============

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('useFileUpload.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('useFileUpload.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('useFileUpload.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('useFileUpload.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ UTILITY FUNCTION STORIES ============

export const FormatBytesUtility: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>
          {i18n.t('useFileUpload.story.formatBytesUtility', 'formatBytes() Utility')}
        </CardTitle>
        <CardDescription>
          {i18n.t(
            'useFileUpload.story.convertsBytesToHumanreadableFormat',
            'Converts bytes to human-readable format'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">{i18n.t('useFileUpload.story.bytes', 'Bytes')}</th>
              <th className="py-2 text-left">
                {i18n.t('useFileUpload.story.formatted', 'Formatted')}
              </th>
            </tr>
          </thead>
          <tbody>
            {[0, 500, 1024, 1024 * 500, 1024 * 1024, 1024 * 1024 * 50, 1024 * 1024 * 1024].map(
              (bytes) => (
                <tr key={bytes} className="border-b last:border-0">
                  <td className="py-2 font-mono">{bytes}</td>
                  <td className="py-2">{formatBytes(bytes)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  ),
  tags: ['!test'],
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ ACCESSIBILITY ============

export const Accessibility: Story = {
  ...Default,
  name: i18n.t('useFileUpload.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify drop zone is present
    const dropZone = canvas.getByTestId('drop-zone');
    expect(dropZone).toBeInTheDocument();

    // Verify file input is present (hidden but accessible)
    const fileInput = canvas.getByTestId('file-input');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');

    // Verify browse button is accessible
    const browseButton = canvas.getByRole('button', { name: /browse/i });
    expect(browseButton).toBeInTheDocument();
  },
};
