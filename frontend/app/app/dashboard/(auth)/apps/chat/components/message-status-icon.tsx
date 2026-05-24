import { Check, CheckCheck } from 'lucide-react';

import type { MessageStatusIconType } from '../types';

export function MessageStatusIcon({ status }: MessageStatusIconType) {
  switch (status) {
    case 'read': {
      return <CheckCheck className="h-4 w-4 shrink-0 text-green-500" />;
    }
    case 'forwarded': {
      return <CheckCheck className="text-muted-foreground h-4 w-4 shrink-0" />;
    }
    case 'sent': {
      return <Check className="text-muted-foreground h-4 w-4 shrink-0" />;
    }
    default: {
      return null;
    }
  }
}
