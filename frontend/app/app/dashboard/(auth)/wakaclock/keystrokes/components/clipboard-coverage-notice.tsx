'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ClipboardCoverageNotice({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <Alert>
        <AlertTitle>Clipboard tracking was not available for this range</AlertTitle>
        <AlertDescription>
          These heartbeats came from an older extension, so zero cannot be interpreted as no Copy or
          Paste activity.
        </AlertDescription>
      </Alert>
    );
  }
  if (percent < 100) {
    return (
      <Alert>
        <AlertTitle>Partial clipboard coverage</AlertTitle>
        <AlertDescription>
          {percent.toFixed(1)}% of VS Code heartbeats support clipboard metrics. Copy and Paste
          totals may be incomplete.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
