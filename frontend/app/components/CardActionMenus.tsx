import * as React from 'react';

import { FolderUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Export format type - supported export file formats */
export type ExportFormat = 'excel' | 'pdf';

/** Labels configuration for ExportButton component */
export interface ExportButtonLabels {
  /** Label for the main export button */
  button?: string;
  /** Label for Excel export option */
  excel?: string;
  /** Label for PDF export option */
  pdf?: string;
}

/**
 * ExportButton component props
 *
 * @description Props for the export dropdown menu component.
 */
export interface ExportButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the export button is disabled */
  disabled?: boolean;
  /** Custom labels for the button and menu items */
  labels?: ExportButtonLabels;
  /** Callback when an export format is selected */
  onExport?: (format: ExportFormat) => void;
  /**
   * Custom test ID for testing
   * @default 'export-button'
   */
  testId?: string;
}

/**
 * ExportButton component - Data export dropdown
 *
 * @description
 * A dropdown menu button for exporting data in various formats.
 * Supports Excel and PDF export options with customizable labels.
 *
 * ## Features
 * - **Multiple Formats**: Excel and PDF export options
 * - **Custom Labels**: i18n-ready label customization
 * - **Disabled State**: Full disabled support
 * - **Responsive**: Text hidden on small screens
 *
 * ## Use Cases
 * - Table data export
 * - Report generation
 * - Data download functionality
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ExportButton onExport={(format) => handleExport(format)} />
 *
 * // With custom labels
 * <ExportButton
 *   labels={{ button: 'Download', excel: 'XLS', pdf: 'PDF' }}
 *   onExport={(format) => console.log(format)}
 * />
 *
 * // Disabled
 * <ExportButton disabled onExport={handleExport} />
 * ```
 */
const ExportButton = React.forwardRef<HTMLDivElement, ExportButtonProps>(
  ({ className, disabled = false, labels, onExport, testId = 'export-button', ...props }, ref) => {
    const buttonLabel = labels?.button ?? 'Export';
    const excelLabel = labels?.excel ?? 'Excel';
    const pdfLabel = labels?.pdf ?? 'PDF';

    return (
      <div
        className={cn(className)}
        data-slot="export-button"
        data-testid={testId}
        ref={ref}
        {...props}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={buttonLabel} disabled={disabled} variant="outline">
              <FolderUp /> <span className="hidden lg:inline">{buttonLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onExport?.('excel')}>{excelLabel}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport?.('pdf')}>{pdfLabel}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);
ExportButton.displayName = 'ExportButton';

export { ExportButton };
