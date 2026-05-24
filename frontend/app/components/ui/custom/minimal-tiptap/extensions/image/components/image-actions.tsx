import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ClipboardCopyIcon,
  DotsHorizontalIcon,
  DownloadIcon,
  Link2Icon,
  SizeIcon,
} from '@radix-ui/react-icons';

/**
 * Labels for image action buttons and tooltips
 */
export type ImageActionsLabels = {
  /** Label for view action */
  view: string;
  /** Label for download action */
  download: string;
  /** Label for copy action */
  copy: string;
  /** Label for copy link action */
  copyLink: string;
  /** Label for open menu action */
  openMenu: string;
};

/** Default labels for image actions */
const defaultLabels: ImageActionsLabels = {
  view: 'View image',
  download: 'Download image',
  copy: 'Copy image to clipboard',
  copyLink: 'Copy image link',
  openMenu: 'Open menu',
};

/**
 * Props for the ImageActions component
 */
export interface ImageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to merge actions into a dropdown menu */
  shouldMerge?: boolean;
  /** Whether the image source is a URL link */
  isLink?: boolean;
  /** Custom labels for action buttons */
  labels?: Partial<ImageActionsLabels>;
  /** Handler for view action */
  onView?: () => void;
  /** Handler for download action */
  onDownload?: () => void;
  /** Handler for copy action */
  onCopy?: () => void;
  /** Handler for copy link action */
  onCopyLink?: () => void;
}

/**
 * Props for individual action buttons
 */
export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon to display in the button */
  icon: React.ReactNode;
  /** Tooltip text for the button */
  tooltip: string;
}

/**
 * Wrapper component for image action buttons
 * Provides consistent positioning and styling for action controls
 */
export const ActionWrapper = React.memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, className, ...props }, ref) => (
      <div
        ref={ref}
        data-slot="action-wrapper"
        data-testid="action-wrapper"
        className={cn(
          'absolute top-3 right-3 flex flex-row rounded px-0.5 opacity-0 group-hover/node-image:opacity-100',
          'border-[0.5px] bg-[var(--mt-bg-secondary)] [backdrop-filter:saturate(1.8)_blur(20px)]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  )
);

ActionWrapper.displayName = 'ActionWrapper';

/**
 * Individual action button with tooltip
 * Used for image actions like view, download, copy
 */
export const ActionButton = React.memo(
  React.forwardRef<HTMLButtonElement, ActionButtonProps>(
    ({ icon, tooltip, className, 'aria-label': ariaLabel, ...props }, ref) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            data-slot="action-button"
            data-testid="action-button"
            variant="ghost"
            aria-label={ariaLabel ?? tooltip}
            className={cn(
              'text-muted-foreground hover:text-foreground relative flex h-7 w-7 flex-row rounded-none p-0',
              'bg-transparent hover:bg-transparent',
              className
            )}
            {...props}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    )
  )
);

ActionButton.displayName = 'ActionButton';

/** Keys for action handler functions */
type ActionKey = 'onView' | 'onDownload' | 'onCopy' | 'onCopyLink';
/** Keys for action labels (excluding openMenu) */
type ActionLabelKey = Exclude<keyof ImageActionsLabels, 'openMenu'>;

/** Configuration for available image action items */
const ActionItems: Array<{
  key: ActionKey;
  icon: React.ReactNode;
  labelKey: ActionLabelKey;
  isLink?: boolean;
}> = [
  { key: 'onView', icon: <SizeIcon className="size-4" />, labelKey: 'view' },
  { key: 'onDownload', icon: <DownloadIcon className="size-4" />, labelKey: 'download' },
  { key: 'onCopy', icon: <ClipboardCopyIcon className="size-4" />, labelKey: 'copy' },
  { key: 'onCopyLink', icon: <Link2Icon className="size-4" />, labelKey: 'copyLink', isLink: true },
];

/**
 * Container component for image action buttons
 * Displays view, download, copy actions with optional dropdown mode
 */
export const ImageActions = React.memo(
  React.forwardRef<HTMLDivElement, ImageActionsProps>(
    (
      {
        shouldMerge = false,
        isLink = false,
        labels: labelsProp,
        className,
        onView,
        onDownload,
        onCopy,
        onCopyLink,
        ...props
      },
      ref
    ) => {
      const [isOpen, setIsOpen] = React.useState(false);

      const labels = React.useMemo(
        () => ({ ...defaultLabels, ...(labelsProp ?? {}) }),
        [labelsProp]
      );

      const actions = { onView, onDownload, onCopy, onCopyLink };

      const handleAction = React.useCallback(
        (e: React.MouseEvent, action: (() => void) | undefined) => {
          e.preventDefault();
          e.stopPropagation();
          action?.();
        },
        []
      );

      const filteredActions = React.useMemo(
        () => ActionItems.filter((item) => isLink || !item.isLink),
        [isLink]
      );

      return (
        <ActionWrapper
          ref={ref}
          data-slot="image-actions"
          data-testid="image-actions"
          className={cn({ 'opacity-100': isOpen }, className)}
          {...props}
        >
          {shouldMerge ? (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <ActionButton
                  icon={<DotsHorizontalIcon className="size-4" />}
                  tooltip={labels.openMenu}
                  onClick={(e) => e.preventDefault()}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                {filteredActions.map(({ key, icon, labelKey }) => (
                  <DropdownMenuItem key={key} onClick={(e) => handleAction(e, actions[key])}>
                    <div className="flex flex-row items-center gap-2">
                      {icon}
                      <span>{labels[labelKey]}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            filteredActions.map(({ key, icon, labelKey }) => (
              <ActionButton
                key={key}
                icon={icon}
                tooltip={labels[labelKey]}
                onClick={(e) => handleAction(e, actions[key])}
              />
            ))
          )}
        </ActionWrapper>
      );
    }
  )
);

ImageActions.displayName = 'ImageActions';
