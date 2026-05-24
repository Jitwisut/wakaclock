'use client';

import { useState } from 'react';

import { CircleAlertIcon, XIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function NotificationBanner() {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <Alert className="flex items-center justify-between border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-800">
      <div className="flex gap-3">
        <CircleAlertIcon className="mt-0.5 size-4" />
        <AlertTitle>You have information to submit in verification center</AlertTitle>
      </div>
      <div className="flex items-center gap-2">
        <Button>Submit Now</Button>
        <Button onClick={() => setShow(false)} size="icon" variant="ghost">
          <XIcon />
        </Button>
      </div>
    </Alert>
  );
}
