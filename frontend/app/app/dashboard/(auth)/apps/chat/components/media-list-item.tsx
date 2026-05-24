import { Check, CheckCheck, CircleCheck } from 'lucide-react';

import type { MediaListItemType } from '../types';

export function MediaListItem({ type }: MediaListItemType) {
  switch (type) {
    case 'image': {
      return <CircleCheck className="h-4 w-4 text-green-500" />;
    }
    case 'pdf_file': {
      return <CheckCheck className="text-muted-foreground h-4 w-4" />;
    }
    case 'text_file': {
      return <Check className="text-muted-foreground h-4 w-4" />;
    }
    default: {
      return null;
    }
  }
}
