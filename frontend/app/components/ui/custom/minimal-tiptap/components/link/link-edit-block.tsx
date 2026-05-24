import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Labels configuration for the link edit block component */
export type LinkEditBlockLabels = {
  /** Label for the URL input field */
  urlLabel: string;
  /** Placeholder text for the URL input */
  urlPlaceholder: string;
  /** Label for the display text input field */
  textLabel: string;
  /** Placeholder text for the display text input */
  textPlaceholder: string;
  /** Label for the open in new tab switch */
  openInNewTab: string;
  /** Label for the save button */
  save: string;
};

const DEFAULT_LABELS: LinkEditBlockLabels = {
  urlLabel: 'URL',
  urlPlaceholder: 'Enter URL',
  textLabel: 'Display Text (optional)',
  textPlaceholder: 'Enter display text',
  openInNewTab: 'Open in New Tab',
  save: 'Save',
};

/** Props for the LinkEditBlock component */
export interface LinkEditorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Default URL value for the input */
  defaultUrl?: string;
  /** Default display text value */
  defaultText?: string;
  /** Whether to open link in new tab by default */
  defaultIsNewTab?: boolean;
  /** Callback when the link is saved */
  onSave: (url: string, text?: string, isNewTab?: boolean) => void;
  /** Custom labels for the edit block */
  labels?: Partial<LinkEditBlockLabels>;
}

/**
 * A form component for editing link properties in the TipTap editor.
 * Allows users to set URL, display text, and whether to open in a new tab.
 */
export const LinkEditBlock = React.forwardRef<HTMLDivElement, LinkEditorProps>(
  ({ onSave, defaultIsNewTab, defaultUrl, defaultText, className, labels }, ref) => {
    const formRef = React.useRef<HTMLDivElement>(null);
    const urlId = React.useId();
    const textId = React.useId();
    const openInNewTabId = React.useId();

    const mergedLabels = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
    const [url, setUrl] = React.useState(defaultUrl || '');
    const [text, setText] = React.useState(defaultText || '');
    const [isNewTab, setIsNewTab] = React.useState(defaultIsNewTab || false);

    const handleSave = React.useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (formRef.current) {
          const isValid = Array.from(formRef.current.querySelectorAll('input')).every((input) =>
            input.checkValidity()
          );

          if (isValid) {
            onSave(url, text, isNewTab);
          } else {
            formRef.current.querySelectorAll('input').forEach((input) => {
              if (!input.checkValidity()) {
                input.reportValidity();
              }
            });
          }
        }
      },
      [onSave, url, text, isNewTab]
    );

    React.useImperativeHandle(ref, () => formRef.current as HTMLDivElement);

    return (
      <div
        ref={formRef}
        data-slot="link-edit-block"
        data-testid="link-edit-block"
        role="form"
        aria-label="Edit link"
      >
        <div className={cn('space-y-4', className)}>
          <div className="space-y-1">
            <Label htmlFor={urlId}>{mergedLabels.urlLabel}</Label>
            <Input
              id={urlId}
              type="url"
              required
              placeholder={mergedLabels.urlPlaceholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor={textId}>{mergedLabels.textLabel}</Label>
            <Input
              id={textId}
              type="text"
              placeholder={mergedLabels.textPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor={openInNewTabId}>{mergedLabels.openInNewTab}</Label>
            <Switch id={openInNewTabId} checked={isNewTab} onCheckedChange={setIsNewTab} />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={handleSave}>
              {mergedLabels.save}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

LinkEditBlock.displayName = 'LinkEditBlock';

export default LinkEditBlock;
