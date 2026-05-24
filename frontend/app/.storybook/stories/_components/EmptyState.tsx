import * as React from 'react';

import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

export interface EmptyStateProps {
  /** Action button configuration */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
  /** Description text explaining the empty state */
  description?: string;
  /** Custom icon to display (defaults to Inbox icon) */
  icon?: React.ReactNode;
  /** Title text for the empty state */
  title?: string;
}

/**
 * EmptyState - Reusable empty state component for stories
 *
 * Shows empty icon, title, description, and optional action button.
 * Uses the existing Empty component for consistent styling.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('emptyState.title', 'No data available');
  const resolvedDescription =
    description ?? t('emptyState.description', 'There are no items to display at this time.');
  return (
    <Empty
      className={className}
      data-slot="empty-state"
      data-state="empty"
      data-testid="story-empty"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox className="size-5" />}</EmptyMedia>
        <EmptyTitle>{resolvedTitle}</EmptyTitle>
        <EmptyDescription>{resolvedDescription}</EmptyDescription>
      </EmptyHeader>

      {action && (
        <EmptyContent>
          <Button data-testid="empty-action-button" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

EmptyState.displayName = 'EmptyState';
