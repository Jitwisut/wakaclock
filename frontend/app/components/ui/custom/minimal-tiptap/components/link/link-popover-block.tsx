import * as React from 'react';
import { Separator } from '@/components/ui/separator';
import { ToolbarButton } from '../toolbar-button';
import { CopyIcon, ExternalLinkIcon, LinkBreak2Icon } from '@radix-ui/react-icons';

/** Labels configuration for the link popover block component */
export type LinkPopoverBlockLabels = {
  /** Label for the edit link button */
  editLink: string;
  /** Label for the open link button */
  openLink: string;
  /** Label for the clear link button */
  clearLink: string;
  /** Label for the copy button */
  copy: string;
  /** Label shown after copying */
  copied: string;
};

const DEFAULT_LABELS: LinkPopoverBlockLabels = {
  editLink: 'Edit link',
  openLink: 'Open link in a new tab',
  clearLink: 'Clear link',
  copy: 'Copy',
  copied: 'Copied!',
};

/** Props for the LinkPopoverBlock component */
export interface LinkPopoverBlockProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onCopy'
> {
  /** The URL of the link */
  url: string;
  /** Callback when the link is cleared */
  onClear: () => void;
  /** Callback when edit is clicked */
  onEdit: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Optional custom copy handler */
  onCopy?: (url: string) => Promise<void> | void;
  /** Custom labels for the popover block */
  labels?: Partial<LinkPopoverBlockLabels>;
}

/**
 * A popover block component for displaying link actions in the TipTap editor.
 * Provides buttons to edit, open, copy, or clear the selected link.
 */
const LinkPopoverBlock = React.forwardRef<HTMLDivElement, LinkPopoverBlockProps>(
  ({ url, onClear, onEdit, onCopy, labels, className, ...props }, ref) => {
    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const [isCopied, setIsCopied] = React.useState(false);
    const resetCopyTimeoutRef = React.useRef<number | null>(null);
    const copyTitle = isCopied ? mergedLabels.copied : mergedLabels.copy;

    React.useEffect(() => {
      return () => {
        if (resetCopyTimeoutRef.current === null) return;
        window.clearTimeout(resetCopyTimeoutRef.current);
      };
    }, []);

    const handleCopy = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const copy = async () => {
          if (onCopy) {
            await onCopy(url);
            return;
          }

          const writeText = navigator.clipboard?.writeText;
          if (typeof writeText !== 'function') {
            throw new Error('Clipboard API is not available.');
          }

          await writeText.call(navigator.clipboard, url);
        };

        void copy()
          .then(() => {
            setIsCopied(true);
            if (resetCopyTimeoutRef.current !== null) {
              window.clearTimeout(resetCopyTimeoutRef.current);
            }
            resetCopyTimeoutRef.current = window.setTimeout(() => setIsCopied(false), 1000);
          })
          .catch(console.error);
      },
      [onCopy, url]
    );

    const handleOpenLink = React.useCallback(() => {
      if (typeof window === 'undefined') return;
      window.open(url, '_blank', 'noopener,noreferrer');
    }, [url]);

    return (
      <div
        ref={ref}
        data-slot="link-popover-block"
        data-testid="link-popover-block"
        className={className ?? 'bg-background flex h-10 overflow-hidden rounded p-2 shadow-lg'}
        {...props}
      >
        <div className="inline-flex items-center gap-1">
          <ToolbarButton
            tooltip={mergedLabels.editLink}
            aria-label={mergedLabels.editLink}
            onClick={onEdit}
            className="w-auto px-2"
          >
            {mergedLabels.editLink}
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            tooltip={mergedLabels.openLink}
            aria-label={mergedLabels.openLink}
            onClick={handleOpenLink}
          >
            <ExternalLinkIcon className="size-4" />
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            tooltip={mergedLabels.clearLink}
            aria-label={mergedLabels.clearLink}
            onClick={onClear}
          >
            <LinkBreak2Icon className="size-4" />
          </ToolbarButton>
          <Separator orientation="vertical" />
          <ToolbarButton
            tooltip={copyTitle}
            aria-label={mergedLabels.copy}
            onClick={handleCopy}
            tooltipOptions={{
              onPointerDownOutside: (e) => {
                if (e.target === e.currentTarget) e.preventDefault();
              },
            }}
          >
            <CopyIcon className="size-4" />
          </ToolbarButton>
        </div>
      </div>
    );
  }
);

LinkPopoverBlock.displayName = 'LinkPopoverBlock';

export { LinkPopoverBlock };
export type { LinkPopoverBlockProps as LinkPopoverBlockComponentProps };
