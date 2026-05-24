import * as React from 'react';

import { useTranslation } from 'react-i18next';

import { EmptyState } from './EmptyState';
import { ErrorDisplay } from './ErrorDisplay';
import { LoadingSkeleton } from './LoadingSkeleton';

/**
 * Custom error class to include HTTP status information
 */
class FetchError extends Error {
  body?: string;
  status?: number;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Default function to check if data is empty
 */
function isDataEmpty(data: unknown): boolean {
  if (data === null || data === undefined) {
    return true;
  }

  if (Array.isArray(data)) {
    return data.length === 0;
  }

  if (typeof data === 'object') {
    return Object.keys(data).length === 0;
  }

  return false;
}

export interface AsyncWrapperProps<T> {
  /** Render function for successful data */
  children: (data: T) => React.ReactNode;
  /** Custom empty state fallback component */
  emptyFallback?: React.ReactNode;
  /** API endpoint to fetch data from */
  endpoint: string;
  /** Custom error fallback render function */
  errorFallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** Function to determine if data is empty */
  isEmpty?: (data: T) => boolean;
  /** Custom loading fallback component */
  loadingFallback?: React.ReactNode;
  /** Number of skeleton rows when loading */
  skeletonRows?: number;
  /** Loading skeleton variant */
  skeletonVariant?: 'card' | 'list' | 'table' | 'text';
}

interface FetchState<T> {
  data: null | T;
  error: Error | null;
  status: 'error' | 'idle' | 'loading' | 'success';
}

/**
 * AsyncWrapper - Generic async data wrapper component for stories
 *
 * Fetches data from endpoint, shows loading/error/empty states automatically.
 * Uses the existing UI components for consistent styling.
 */
export function AsyncWrapper<T>({
  endpoint,
  children,
  loadingFallback,
  errorFallback,
  emptyFallback,
  isEmpty,
  skeletonVariant = 'list',
  skeletonRows = 3,
}: AsyncWrapperProps<T>) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<FetchState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const fetchData = React.useCallback(async () => {
    setState({ status: 'loading', data: null, error: null });

    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new FetchError(
          `Request failed with status ${String(response.status)}`,
          response.status,
          errorBody
        );
      }

      const data = (await response.json()) as T;
      setState({ status: 'success', data, error: null });
    } catch (error_) {
      const error = error_ instanceof Error ? error_ : new Error(String(error_));
      setState({ status: 'error', data: null, error });
    }
  }, [endpoint]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Loading state
  if (state.status === 'idle' || state.status === 'loading') {
    if (loadingFallback) {
      return loadingFallback as React.ReactElement;
    }

    return <LoadingSkeleton rows={skeletonRows} showHeader variant={skeletonVariant} />;
  }

  // Error state
  if (state.status === 'error' && state.error) {
    if (errorFallback) {
      return errorFallback(state.error, fetchData) as React.ReactElement;
    }

    const fetchError = state.error as FetchError;
    return (
      <ErrorDisplay
        details={fetchError.body ? { Response: fetchError.body.slice(0, 200) } : undefined}
        message={state.error.message}
        onRetry={fetchData}
        status={fetchError.status}
      />
    );
  }

  // Success state - check for empty
  if (state.status === 'success' && state.data !== null) {
    const dataIsEmpty = isEmpty ? isEmpty(state.data) : isDataEmpty(state.data);

    if (dataIsEmpty) {
      if (emptyFallback) {
        return emptyFallback as React.ReactElement;
      }

      return (
        <EmptyState
          description={t(
            'asyncWrapper.emptyDescription',
            'The request was successful but returned no data.'
          )}
          title={t('asyncWrapper.emptyTitle', 'No results found')}
        />
      );
    }

    // Render success content
    return (
      <div data-slot="async-wrapper-content" data-state="success" data-testid="story-success">
        {children(state.data)}
      </div>
    );
  }

  return null;
}

AsyncWrapper.displayName = 'AsyncWrapper';
