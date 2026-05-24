import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface ErrorDisplayProps {
  /** Error code identifier */
  code?: string;
  /** Additional error details as key-value pairs */
  details?: Record<string, string>;
  /** Error message to display */
  message: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** HTTP status code */
  status?: number;
}

/**
 * ErrorDisplay - Reusable error display component for stories
 *
 * Shows error icon, status code, message, details list, and optional retry button.
 * Uses the existing Alert component for consistent styling.
 */
export function ErrorDisplay({ status, code, message, details, onRetry }: ErrorDisplayProps) {
  const { t } = useTranslation();
  return (
    <Alert
      data-error-status={status}
      data-slot="error-display"
      data-testid="story-error"
      variant="destructive"
    >
      <AlertCircle className="size-4" />
      <AlertTitle className="flex items-center gap-2">
        {status && <span className="font-mono text-xs opacity-80">{status}</span>}
        {code && <span className="font-mono text-xs opacity-80">[{code}]</span>}
        <span>{t('errorDisplay.title', 'Error')}</span>
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{message}</p>

          {details && Object.keys(details).length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-xs opacity-80">
              {Object.entries(details).map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium">{key}:</span> {value}
                </li>
              ))}
            </ul>
          )}

          {onRetry && (
            <Button
              className="mt-2"
              data-testid="error-retry-button"
              onClick={onRetry}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3" />
              {t('errorDisplay.retry', 'Retry')}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

ErrorDisplay.displayName = 'ErrorDisplay';
