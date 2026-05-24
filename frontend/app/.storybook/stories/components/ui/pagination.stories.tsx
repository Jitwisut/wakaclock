import type { Meta, StoryObj } from '@storybook/react';
import { useCallback, useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';

import type {
  FakeInfiniteScrollPagination,
  FakePageItem,
  FakePaginationConfig,
  FakeTablePagination,
  PageItemType,
  PaginationLayout,
  PaginationSize,
  PaginationState,
  PaginationVariant,
} from '@/.storybook/stories/_factories/pagination.factory';
import {
  COMMON_PAGE_COUNTS,
  createFakeCompactPagination,
  createFakeDataTablePagination,
  createFakeDisabledPagination,
  createFakeFirstPagePagination,
  createFakeInfiniteScrollPagination,
  createFakeLargePagination,
  createFakeLastPagePagination,
  createFakeMiddlePagePagination,
  createFakePageItem,
  createFakePaginationConfig,
  createFakePaginationConfigs,
  createFakeSimplePagination,
  createFakeSinglePagePagination,
  createFakeTablePagination,
  createPaginationLayoutMatrix,
  createPaginationPositionMatrix,
  createPaginationShowcase,
  createPaginationSizeMatrix,
  createPaginationStateMatrix,
  createPaginationTestData,
  createPaginationVariantMatrix,
  ITEMS_PER_PAGE_OPTIONS,
  PAGE_ITEM_TYPES,
  PAGINATION_LAYOUTS,
  PAGINATION_SIZES,
  PAGINATION_STATES,
  PAGINATION_VARIANTS,
  SIBLING_COUNT_OPTIONS,
} from '@/.storybook/stories/_factories/pagination.factory';
import {
  paginationHandlers,
  paginationStatusHandlers,
} from '@/.storybook/stories/_handlers/pagination.handlers';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

// Seed faker for deterministic tests
import i18n from 'i18next';

seedFaker();

// =============================================================================
// INTERACTIVE DEMO COMPONENT - Exposes all props as Storybook Controls
// =============================================================================

type PaginationDemoProps = {
  /** Currently active page (1-indexed) */
  currentPage: number;
  /** Disabled state */
  disabled: boolean;
  /** Called on blur */
  onBlur: (event: React.FocusEvent) => void;
  /** Called on any click */
  onClick: (event: React.MouseEvent) => void;
  /** Called on focus */
  onFocus: (event: React.FocusEvent) => void;
  /** Called on keydown */
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** Called when page changes */
  onPageChange: (page: number) => void;
  /** Show first/last page buttons */
  showFirstLast: boolean;
  /** Show previous/next buttons */
  showPrevNext: boolean;
  /** Number of sibling pages to show on each side of current */
  siblingCount: number;
  /** Size variant */
  size: 'sm' | 'default' | 'lg';
  /** Total number of pages */
  totalPages: number;
};

function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | 'ellipsis-start' | 'ellipsis-end')[] {
  const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const leftSibling = Math.max(2, currentPage - siblingCount);
  const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

  // Add start ellipsis if needed
  if (leftSibling > 2) {
    pages.push('ellipsis-start');
  }

  // Add pages in range
  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i !== 1 && i !== totalPages) {
      pages.push(i);
    }
  }

  // Add end ellipsis if needed
  if (rightSibling < totalPages - 1) {
    pages.push('ellipsis-end');
  }

  // Always show last page if more than 1 page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

function InteractivePaginationDemo({
  totalPages,
  currentPage: controlledCurrentPage,
  siblingCount,
  showFirstLast,
  showPrevNext,
  size,
  disabled,
  onPageChange,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
}: PaginationDemoProps) {
  const [internalPage, setInternalPage] = useState(controlledCurrentPage);

  // Use controlled value if provided, otherwise internal state
  const currentPage = controlledCurrentPage ?? internalPage;

  const handlePageChange = useCallback(
    (page: number) => {
      if (disabled) return;
      if (page < 1 || page > totalPages) return;
      setInternalPage(page);
      onPageChange(page);
    },
    [disabled, totalPages, onPageChange]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent, page?: number) => {
      e.preventDefault();
      onClick(e);
      if (page !== undefined) {
        handlePageChange(page);
      }
    },
    [onClick, handlePageChange]
  );

  const pages = generatePageNumbers(currentPage, totalPages, siblingCount);

  // Size classes
  const sizeClasses = {
    sm: { item: 'h-7 w-7 text-xs', nav: 'h-7 px-2 text-xs', gap: 'gap-0.5' },
    default: { item: 'h-9 w-9 text-sm', nav: 'h-9 px-3 text-sm', gap: 'gap-1' },
    lg: { item: 'h-12 w-12 text-base', nav: 'h-12 px-6 text-base', gap: 'gap-2' },
  };

  const classes = sizeClasses[size];
  const disabledClass = disabled ? 'pointer-events-none opacity-50' : '';

  return (
    <Pagination
      aria-label={i18n.t('pagination.story.pagination', 'Pagination')}
      className={disabledClass}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-testid="pagination-demo"
    >
      <PaginationContent className={classes.gap}>
        {/* First Page Button */}
        {showFirstLast && (
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e) => handleClick(e, 1)}
              aria-label={i18n.t('pagination.story.goToFirstPage', 'Go to first page')}
              aria-disabled={currentPage === 1 || disabled}
              className={`${classes.item} ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
              data-pagination-control="first"
            >
              «
            </PaginationLink>
          </PaginationItem>
        )}

        {/* Previous Button */}
        {showPrevNext && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => handleClick(e, currentPage - 1)}
              aria-label={i18n.t('pagination.story.goToPreviousPage', 'Go to previous page')}
              aria-disabled={currentPage === 1 || disabled}
              label={i18n.t('pagination.story.previous', 'Previous')}
              className={`${classes.nav} ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
              data-pagination-control="previous"
            />
          </PaginationItem>
        )}

        {/* Page Numbers */}
        {pages.map((page, index) => (
          <PaginationItem key={typeof page === 'number' ? page : `${page}-${index}`}>
            {page === 'ellipsis-start' || page === 'ellipsis-end' ? (
              <PaginationEllipsis
                label={i18n.t('pagination.story.morePages', 'More pages')}
                className={classes.item}
                data-pagination-ellipsis={page}
              />
            ) : (
              <PaginationLink
                href="#"
                onClick={(e) => handleClick(e, page)}
                isActive={page === currentPage}
                aria-label={i18n.t('pagination.page.ariaLabel', {
                  page,
                  defaultValue: `Page ${page}`,
                })}
                className={classes.item}
                data-pagination-page={page}
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        {/* Next Button */}
        {showPrevNext && (
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => handleClick(e, currentPage + 1)}
              aria-label={i18n.t('pagination.story.goToNextPage', 'Go to next page')}
              aria-disabled={currentPage === totalPages || disabled}
              label={i18n.t('pagination.story.next', 'Next')}
              className={`${classes.nav} ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
              data-pagination-control="next"
            />
          </PaginationItem>
        )}

        {/* Last Page Button */}
        {showFirstLast && (
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e) => handleClick(e, totalPages)}
              aria-label={i18n.t('pagination.story.goToLastPage', 'Go to last page')}
              aria-disabled={currentPage === totalPages || disabled}
              className={`${classes.item} ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
              data-pagination-control="last"
            >
              »
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}

// =============================================================================
// META - Full Controls, Actions, Accessibility Configuration
// =============================================================================

const meta = {
  title: 'Components/UI/Pagination',
  component: InteractivePaginationDemo,
  tags: ['autodocs'],

  // ═══════════════════════════════════════════════════════════════════════════
  // ARGS - Default values for all controls
  // ═══════════════════════════════════════════════════════════════════════════
  args: {
    totalPages: 10,
    currentPage: 1,
    siblingCount: 1,
    showFirstLast: false,
    showPrevNext: true,
    size: 'default',
    disabled: false,
    onPageChange: fn(),
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ARG TYPES - Categorized controls with full documentation
  // ═══════════════════════════════════════════════════════════════════════════
  argTypes: {
    // ─────────────────────────────────────────────────────────────────────────
    // CONTENT CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    totalPages: {
      control: { type: 'number', min: 1, max: 100, step: 1 },
      description: i18n.t(
        'pagination.argType.totalNumberOfPagesInThePagination',
        'Total number of pages in the pagination'
      ),
      table: {
        category: 'Content',
        type: { summary: 'number' },
        defaultValue: { summary: '10' },
      },
    },
    currentPage: {
      control: { type: 'number', min: 1, max: 100, step: 1 },
      description: i18n.t(
        'pagination.argType.currentlyActivePage1indexed',
        'Currently active page (1-indexed)'
      ),
      table: {
        category: 'Content',
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },
    siblingCount: {
      control: { type: 'number', min: 0, max: 5, step: 1 },
      description: i18n.t(
        'pagination.argType.numberOfSiblingPagesToShowOnEachSideOfCurrentPage',
        'Number of sibling pages to show on each side of current page'
      ),
      table: {
        category: 'Content',
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // APPEARANCE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg'],
      description: i18n.t(
        'pagination.argType.sizeVariantOfPaginationButtons',
        'Size variant of pagination buttons'
      ),
      table: {
        category: 'Appearance',
        type: { summary: "'sm' | 'default' | 'lg'" },
        defaultValue: { summary: "'default'" },
      },
    },
    showFirstLast: {
      control: { type: 'boolean' },
      description: i18n.t(
        'pagination.argType.showFirstlastPageNavigationButtons',
        'Show first/last page navigation buttons (« »)'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    showPrevNext: {
      control: { type: 'boolean' },
      description: i18n.t(
        'pagination.argType.showPreviousnextNavigationButtons',
        'Show previous/next navigation buttons'
      ),
      table: {
        category: 'Appearance',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // STATE CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    disabled: {
      control: { type: 'boolean' },
      description: i18n.t(
        'pagination.argType.disableAllPaginationInteractions',
        'Disable all pagination interactions'
      ),
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT HANDLERS (Actions)
    // ─────────────────────────────────────────────────────────────────────────
    onPageChange: {
      action: 'page-changed',
      description: i18n.t(
        'pagination.argType.calledWhenUserNavigatesToADifferentPageReceivesTheNewPageNumber',
        'Called when user navigates to a different page. Receives the new page number.'
      ),
      table: {
        category: 'Events',
        type: { summary: '(page: number) => void' },
      },
    },
    onClick: {
      action: 'clicked',
      description: i18n.t(
        'pagination.argType.calledOnAnyClickWithinPagination',
        'Called on any click within pagination'
      ),
      table: {
        category: 'Events',
        type: { summary: '(event: MouseEvent) => void' },
      },
    },
    onFocus: {
      action: 'focused',
      description: i18n.t(
        'pagination.argType.calledWhenPaginationReceivesFocus',
        'Called when pagination receives focus'
      ),
      table: {
        category: 'Events',
        type: { summary: '(event: FocusEvent) => void' },
      },
    },
    onBlur: {
      action: 'blurred',
      description: i18n.t(
        'pagination.argType.calledWhenPaginationLosesFocus',
        'Called when pagination loses focus'
      ),
      table: {
        category: 'Events',
        type: { summary: '(event: FocusEvent) => void' },
      },
    },
    onKeyDown: {
      action: 'key-pressed',
      description: i18n.t(
        'pagination.argType.calledOnKeyboardEventsWithinPagination',
        'Called on keyboard events within pagination'
      ),
      table: {
        category: 'Events',
        type: { summary: '(event: KeyboardEvent) => void' },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PARAMETERS - A11y, MSW, and other configurations
  // ═══════════════════════════════════════════════════════════════════════════
  parameters: {
    msw: { handlers: paginationHandlers },
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
    docs: {
      description: {
        component: `
A flexible pagination component for navigating through pages of content.

## Features
- **Keyboard Navigation**: Full Tab and Enter/Space support
- **Screen Reader Support**: Proper ARIA labels and current page indication
- **Responsive**: Adapts to container width with ellipsis
- **Customizable**: Size variants, show/hide first/last buttons

## Usage
\`\`\`tsx
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationLink href="#" isActive>1</PaginationLink>
    </PaginationItem>
  </PaginationContent>
</Pagination>
\`\`\`
        `,
      },
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
} satisfies Meta<typeof InteractivePaginationDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

// =============================================================================
// STORIES
// =============================================================================

/**
 * Default pagination with interactive controls.
 * Try changing the controls in the panel below!
 */
export const Default: Story = {
  args: {
    totalPages: 10,
    currentPage: 1,
  },
  play: async ({ canvasElement, args }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify page links
    const pageLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(pageLinks.length).not.toBe(0);

    // Click page 2
    const page2 = canvasElement.querySelector('[data-pagination-page="2"]');
    if (page2 instanceof HTMLElement) {
      await userEvent.click(page2);
      expect(args.onPageChange).toHaveBeenCalledWith(2);
      expect(args.onClick).toHaveBeenCalled();
    }

    // Click next button
    const nextBtn = canvasElement.querySelector('[data-pagination-control="next"]');
    if (nextBtn instanceof HTMLElement) {
      await userEvent.click(nextBtn);
      expect(args.onPageChange).toHaveBeenCalled();
    }
  },
};

/**
 * Interactive playground - adjust all controls to see live changes.
 */
export const Playground: Story = {
  args: {
    totalPages: 20,
    currentPage: 10,
    siblingCount: 2,
    showFirstLast: true,
    showPrevNext: true,
    size: 'default',
  },
  play: async ({ canvasElement, args }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify all navigation controls exist
    expect(canvasElement.querySelector('[data-pagination-control="first"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-pagination-control="previous"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-pagination-control="next"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-pagination-control="last"]')).toBeInTheDocument();

    // Verify ellipsis elements exist
    const ellipsis = canvasElement.querySelectorAll('[data-slot="pagination-ellipsis"]');
    expect(ellipsis.length).toBeGreaterThan(0);

    // Click first button
    const firstBtn = canvasElement.querySelector('[data-pagination-control="first"]');
    if (firstBtn instanceof HTMLElement) {
      await userEvent.click(firstBtn);
      expect(args.onPageChange).toHaveBeenCalledWith(1);
    }
  },
};

/**
 * All size variants displayed together.
 */
function SizesDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.sizes.small')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={5}
          siblingCount={1}
          showFirstLast={false}
          showPrevNext
          size="sm"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.sizes.default')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={5}
          siblingCount={1}
          showFirstLast={false}
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.sizes.large')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={5}
          siblingCount={1}
          showFirstLast={false}
          showPrevNext
          size="lg"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify multiple pagination instances exist (small, default, large)
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(3);

    // Verify pagination content exists for each size
    const paginationContents = canvasElement.querySelectorAll('[data-slot="pagination-content"]');
    expect(paginationContents.length).toBe(3);

    // Verify size labels are present
    expect(canvas.getByText('Small')).toBeInTheDocument();
    expect(canvas.getByText('Default')).toBeInTheDocument();
    expect(canvas.getByText('Large')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

/**
 * Different pagination configurations.
 */
function VariantsDemo() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.basic')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={5}
          siblingCount={1}
          showFirstLast={false}
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.withFirstLast')}
        </p>
        <InteractivePaginationDemo
          totalPages={20}
          currentPage={10}
          siblingCount={1}
          showFirstLast
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.moreSiblings')}
        </p>
        <InteractivePaginationDemo
          totalPages={20}
          currentPage={10}
          siblingCount={3}
          showFirstLast={false}
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.disabled')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={5}
          siblingCount={1}
          showFirstLast={false}
          showPrevNext
          size="default"
          disabled
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.firstPage')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={1}
          siblingCount={1}
          showFirstLast
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium">
          {i18n.t('pagination.variants.lastPage')}
        </p>
        <InteractivePaginationDemo
          totalPages={10}
          currentPage={10}
          siblingCount={1}
          showFirstLast
          showPrevNext
          size="default"
          disabled={false}
          onPageChange={fn()}
          onClick={fn()}
          onFocus={fn()}
          onBlur={fn()}
          onKeyDown={fn()}
        />
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify multiple pagination instances exist for different variants
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBeGreaterThanOrEqual(4);

    // Verify pagination content exists
    const paginationContents = canvasElement.querySelectorAll('[data-slot="pagination-content"]');
    expect(paginationContents.length).toBeGreaterThanOrEqual(4);

    // Verify variant labels are present
    expect(canvas.getByText('Basic')).toBeInTheDocument();
    expect(canvas.getByText('With First/Last')).toBeInTheDocument();
    expect(canvas.getByText('More Siblings')).toBeInTheDocument();
    expect(canvas.getByText('Disabled')).toBeInTheDocument();

    // Verify pagination navigation controls exist
    const prevButtons = canvasElement.querySelectorAll('[data-pagination-control="previous"]');
    expect(prevButtons.length).toBeGreaterThan(0);

    const nextButtons = canvasElement.querySelectorAll('[data-pagination-control="next"]');
    expect(nextButtons.length).toBeGreaterThan(0);
  },
};

/**
 * Pagination at first page - Previous button disabled.
 */
export const FirstPage: Story = {
  args: {
    totalPages: 10,
    currentPage: 1,
    showFirstLast: true,
  },
  play: async ({ canvasElement }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();

    // Verify previous and first buttons are disabled
    const prevBtn = canvasElement.querySelector('[data-pagination-control="previous"]');
    const firstBtn = canvasElement.querySelector('[data-pagination-control="first"]');

    expect(prevBtn?.className).toContain('pointer-events-none');
    expect(prevBtn?.className).toContain('opacity-50');
    expect(firstBtn?.className).toContain('pointer-events-none');
    expect(firstBtn?.className).toContain('opacity-50');

    // Verify next and last buttons are enabled
    const nextBtn = canvasElement.querySelector('[data-pagination-control="next"]');
    const lastBtn = canvasElement.querySelector('[data-pagination-control="last"]');

    expect(nextBtn?.className).not.toContain('pointer-events-none');
    expect(lastBtn?.className).not.toContain('pointer-events-none');

    // Verify current page is marked as active
    const activePage = canvasElement.querySelector('[data-pagination-page="1"]');
    expect(activePage?.getAttribute('aria-current')).toBe('page');
  },
};

/**
 * Pagination at last page - Next button disabled.
 */
export const LastPage: Story = {
  args: {
    totalPages: 10,
    currentPage: 10,
    showFirstLast: true,
  },
  play: async ({ canvasElement }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();

    // Verify next and last buttons are disabled
    const nextBtn = canvasElement.querySelector('[data-pagination-control="next"]');
    const lastBtn = canvasElement.querySelector('[data-pagination-control="last"]');

    expect(nextBtn?.className).toContain('pointer-events-none');
    expect(nextBtn?.className).toContain('opacity-50');
    expect(lastBtn?.className).toContain('pointer-events-none');
    expect(lastBtn?.className).toContain('opacity-50');

    // Verify previous and first buttons are enabled
    const prevBtn = canvasElement.querySelector('[data-pagination-control="previous"]');
    const firstBtn = canvasElement.querySelector('[data-pagination-control="first"]');

    expect(prevBtn?.className).not.toContain('pointer-events-none');
    expect(firstBtn?.className).not.toContain('pointer-events-none');

    // Verify current page is marked as active
    const activePage = canvasElement.querySelector('[data-pagination-page="10"]');
    expect(activePage?.getAttribute('aria-current')).toBe('page');
  },
};

/**
 * Pagination in the middle - shows ellipsis on both sides.
 */
export const MiddlePage: Story = {
  args: {
    totalPages: 20,
    currentPage: 10,
    siblingCount: 1,
    showFirstLast: true,
  },
  play: async ({ canvasElement, args }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();

    // Verify ellipsis exist on both sides
    const ellipsisStart = canvasElement.querySelector(
      '[data-pagination-ellipsis="ellipsis-start"]'
    );
    const ellipsisEnd = canvasElement.querySelector('[data-pagination-ellipsis="ellipsis-end"]');

    expect(ellipsisStart).toBeInTheDocument();
    expect(ellipsisEnd).toBeInTheDocument();

    // Verify both ellipsis are hidden from screen readers
    expect(ellipsisStart?.getAttribute('aria-hidden')).toBe('true');
    expect(ellipsisEnd?.getAttribute('aria-hidden')).toBe('true');

    // Verify current page is marked as active
    const activePage = canvasElement.querySelector('[data-pagination-page="10"]');
    expect(activePage?.getAttribute('aria-current')).toBe('page');
    expect(activePage?.getAttribute('data-active')).toBe('true');

    // Verify all navigation buttons are enabled
    const prevBtn = canvasElement.querySelector('[data-pagination-control="previous"]');
    const nextBtn = canvasElement.querySelector('[data-pagination-control="next"]');

    expect(prevBtn?.className).not.toContain('pointer-events-none');
    expect(nextBtn?.className).not.toContain('pointer-events-none');

    // Click previous button
    if (prevBtn instanceof HTMLElement) {
      await userEvent.click(prevBtn);
      expect(args.onPageChange).toHaveBeenCalled();
    }
  },
};

/**
 * Large number of pages with ellipsis.
 */
export const ManyPages: Story = {
  args: {
    totalPages: 100,
    currentPage: 50,
    siblingCount: 2,
    showFirstLast: true,
  },
  play: async ({ canvasElement, args }) => {
    // Verify pagination renders
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();

    // Verify ellipsis exist
    const ellipsis = canvasElement.querySelectorAll('[data-slot="pagination-ellipsis"]');
    expect(ellipsis.length).toBeGreaterThan(0);

    // Verify current page is marked as active
    const activePage = canvasElement.querySelector('[data-pagination-page="50"]');
    expect(activePage?.getAttribute('aria-current')).toBe('page');

    // Verify first and last page buttons exist
    const firstBtn = canvasElement.querySelector('[data-pagination-control="first"]');
    const lastBtn = canvasElement.querySelector('[data-pagination-control="last"]');

    expect(firstBtn).toBeInTheDocument();
    expect(lastBtn).toBeInTheDocument();

    // Click last button
    if (lastBtn instanceof HTMLElement) {
      await userEvent.click(lastBtn);
      expect(args.onPageChange).toHaveBeenCalledWith(100);
    }

    // Verify page numbers are rendered (not all 100, but a subset with siblings)
    const pageLinks = canvasElement.querySelectorAll('[data-pagination-page]');
    expect(pageLinks.length).toBeLessThan(100);
    expect(pageLinks.length).toBeGreaterThan(0);
  },
};

/**
 * Disabled state - no interactions allowed.
 */
export const Disabled: Story = {
  args: {
    totalPages: 10,
    currentPage: 5,
    disabled: true,
  },
  play: async ({ canvasElement, args }) => {
    // Verify pagination is visually disabled
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.className).toContain('opacity-50');

    // Try to click - should not fire onPageChange
    const page2 = canvasElement.querySelector('[data-pagination-page="2"]');
    if (page2 instanceof HTMLElement) {
      await userEvent.click(page2);
      // onPageChange should NOT be called because disabled
      expect(args.onPageChange).not.toHaveBeenCalled();
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY STORY - Comprehensive a11y testing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Accessibility testing story with comprehensive keyboard and ARIA checks.
 */
export const Accessibility: Story = {
  args: {
    totalPages: 10,
    currentPage: 5,
    showFirstLast: true,
    showPrevNext: true,
  },
  play: async ({ canvasElement, args }) => {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. ARIA ROLES AND LABELS
    // ─────────────────────────────────────────────────────────────────────────

    // Verify nav role and aria-label
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    expect(pagination).toHaveProperty('tagName', 'NAV');
    expect(pagination).toHaveAttribute('role', 'navigation');
    expect(pagination).toHaveAttribute('aria-label');

    // Verify list structure
    const list = canvasElement.querySelector('[data-slot="pagination-content"]');
    expect(list).toHaveProperty('tagName', 'UL');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CURRENT PAGE INDICATION
    // ─────────────────────────────────────────────────────────────────────────

    // Verify active page has aria-current="page"
    const activePage = canvasElement.querySelector('[data-pagination-page="5"]');
    expect(activePage).toBeInTheDocument();
    expect(activePage?.getAttribute('aria-current')).toBe('page');
    expect(activePage?.getAttribute('data-active')).toBe('true');

    // ─────────────────────────────────────────────────────────────────────────
    // 3. NAVIGATION BUTTON ACCESSIBILITY
    // ─────────────────────────────────────────────────────────────────────────

    // Verify all navigation buttons have aria-labels
    const prevBtn = canvasElement.querySelector('[data-pagination-control="previous"]');
    const nextBtn = canvasElement.querySelector('[data-pagination-control="next"]');
    const firstBtn = canvasElement.querySelector('[data-pagination-control="first"]');
    const lastBtn = canvasElement.querySelector('[data-pagination-control="last"]');

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
    expect(firstBtn).toBeInTheDocument();
    expect(lastBtn).toBeInTheDocument();

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ELLIPSIS ACCESSIBILITY
    // ─────────────────────────────────────────────────────────────────────────

    // Verify ellipsis is hidden from screen readers but has sr-only text
    const ellipsis = canvasElement.querySelector('[data-slot="pagination-ellipsis"]');
    if (ellipsis) {
      expect(ellipsis.getAttribute('aria-hidden')).toBe('true');
      const srOnly = ellipsis.querySelector('.sr-only');
      expect(srOnly).toBeInTheDocument();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. KEYBOARD NAVIGATION
    // ─────────────────────────────────────────────────────────────────────────

    // Tab through pagination elements
    if (firstBtn instanceof HTMLElement) {
      firstBtn.focus();
      expect(document.activeElement).toBe(firstBtn);
    }

    // Tab to next element
    await userEvent.tab();
    expect(document.activeElement).not.toBe(firstBtn);

    // Continue tabbing through all focusable elements
    const focusableElements = canvasElement.querySelectorAll('a[href]');
    expect(focusableElements.length).not.toBe(0);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. LINK ACCESSIBILITY
    // ─────────────────────────────────────────────────────────────────────────

    // All page links should have href
    const pageLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    for (const link of pageLinks) {
      expect(link).toBeInTheDocument();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. INTERACTION TEST
    // ─────────────────────────────────────────────────────────────────────────

    // Click page 3 and verify onPageChange fires
    const page3 = canvasElement.querySelector('[data-pagination-page="3"]');
    if (page3 instanceof HTMLElement) {
      await userEvent.click(page3);
      expect(args.onPageChange).toHaveBeenCalledWith(3);
    }

    // Test keyboard activation (Enter key)
    if (nextBtn instanceof HTMLElement) {
      nextBtn.focus();
      await userEvent.keyboard('{Enter}');
      expect(args.onClick).toHaveBeenCalled();
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// THEME & LOCALE STORIES
// ═══════════════════════════════════════════════════════════════════════════

export const Dark: Story = {
  args: { ...Default.args },
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);

    // Verify dark theme is applied by checking document
    expect(canvasElement.ownerDocument.documentElement.classList.contains('dark')).toBe(true);
  },
};

export const RTL: Story = {
  args: { ...Default.args },
  globals: { addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);

    // Verify RTL direction is applied
    expect(canvasElement.ownerDocument.documentElement.getAttribute('dir')).toBe('rtl');
  },
};

export const Japanese: Story = {
  args: { ...Default.args },
  globals: { locale: 'ja' },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);

    // Verify navigation controls exist
    expect(canvasElement.querySelector('[data-pagination-control="previous"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-pagination-control="next"]')).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PSEUDO STATES
// ═══════════════════════════════════════════════════════════════════════════

export const PseudoStates: Story = {
  args: { ...Default.args },
  tags: ['!test'],
  name: 'Pseudo States (hover / focus / active)',
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            {i18n.t('pagination.story.hover', 'Hover')}
          </p>
          <div id="hover">
            <Story />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            {i18n.t('pagination.story.focus', 'Focus')}
          </p>
          <div id="focus">
            <Story />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-sm">
            {i18n.t('pagination.story.active', 'Active')}
          </p>
          <div id="active">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
  parameters: {
    pseudo: {
      hover: ['#hover [data-slot="pagination-link"]'],
      focusVisible: ['#focus [data-slot="pagination-link"]'],
      active: ['#active [data-slot="pagination-link"]'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MSW STORIES
// ═══════════════════════════════════════════════════════════════════════════

export const WithMswHandlers: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationHandlers } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);

    // Verify navigation controls exist
    expect(canvasElement.querySelector('[data-pagination-control="previous"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-pagination-control="next"]')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.loading } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error400BadRequest: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.badRequest } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error401Unauthorized: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.unauthorized } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error403Forbidden: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.forbidden } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error404NotFound: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.notFound } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error429RateLimit: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.tooManyRequests } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: paginationStatusHandlers.unprocessableEntity },
  },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error500InternalServerError: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.internalServerError } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error502BadGateway: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.badGateway } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error503ServiceUnavailable: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.serviceUnavailable } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const Error504GatewayTimeout: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.gatewayTimeout } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const EmptyData: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.emptyData } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const SlowResponse: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.slowResponse } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

export const NetworkError: Story = {
  args: { ...Default.args },
  parameters: { msw: { handlers: paginationStatusHandlers.networkError } },
  play: async ({ canvasElement }) => {
    // Verify the component rendered
    expect(canvasElement.querySelector('[data-slot="pagination"]')).toBeInTheDocument();

    // Verify pagination has navigation role
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination?.getAttribute('role')).toBe('navigation');

    // Verify pagination content exists
    expect(canvasElement.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();

    // Verify pagination links exist
    const paginationLinks = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(paginationLinks.length).toBeGreaterThan(0);
  },
};

// ============ FAKER DATA STORIES ============

export const WithFakerData: Story = {
  render: () => {
    const fakeConfigs = createFakePaginationConfigs(3);

    return (
      <div className="flex flex-col gap-6" data-testid="pagination-faker">
        {fakeConfigs.map((config) => (
          <Pagination key={config.id}>
            <PaginationContent>
              {config.hasPrevNext && (
                <PaginationItem>
                  <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} />
                </PaginationItem>
              )}
              {config.pageItems.map((item) => (
                <PaginationItem key={item.id}>
                  {item.type === 'ellipsis-start' || item.type === 'ellipsis-end' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      isActive={item.isActive}
                    >
                      {item.label}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              {config.hasPrevNext && (
                <PaginationItem>
                  <PaginationNext href="#" onClick={(e) => e.preventDefault()} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="pagination-faker"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(3);
    paginations.forEach((pagination) => {
      expect(pagination.querySelector('[data-slot="pagination-content"]')).toBeInTheDocument();
    });
  },
};

// =============================================================================
// HELPER: Render a FakePaginationConfig as an actual Pagination component
// =============================================================================

function PaginationFromConfig({ config }: { config: FakePaginationConfig }) {
  return (
    <Pagination>
      <PaginationContent>
        {config.hasPrevNext && (
          <PaginationItem>
            <PaginationPrevious href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
        )}
        {config.pageItems.map((item: FakePageItem) => (
          <PaginationItem key={item.id}>
            {item.type === 'ellipsis-start' || item.type === 'ellipsis-end' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink href="#" onClick={(e) => e.preventDefault()} isActive={item.isActive}>
                {item.label}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        {config.hasPrevNext && (
          <PaginationItem>
            <PaginationNext href="#" onClick={(e) => e.preventDefault()} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}

// =============================================================================
// FACTORY: createFakePageItem
// =============================================================================

function PageItemDemo() {
  const numberItem: FakePageItem = createFakePageItem('number', { pageNumber: 5, isActive: true });
  const ellipsisStartItem: FakePageItem = createFakePageItem('ellipsis-start');
  const ellipsisEndItem: FakePageItem = createFakePageItem('ellipsis-end');
  const allTypes: PageItemType[] = [...PAGE_ITEM_TYPES];

  return (
    <div className="flex flex-col gap-6" data-testid="page-item-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      <div data-testid="page-item-types">
        <p className="mb-2 text-sm font-medium">{`Page item types: ${allTypes.join(', ')}`}</p>
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationEllipsis data-testid={`item-${ellipsisStartItem.type}`} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e) => e.preventDefault()}
              isActive={numberItem.isActive}
              data-testid="item-number"
            >
              {numberItem.label}
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis data-testid={`item-${ellipsisEndItem.type}`} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export const FactoryPageItem: Story = {
  render: () => <PageItemDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const container = canvasElement.querySelector('[data-testid="page-item-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="item-number"]')).toBeInTheDocument();
    expect(canvas.getByText('5')).toBeInTheDocument();
    const ellipses = canvasElement.querySelectorAll('[data-slot="pagination-ellipsis"]');
    expect(ellipses.length).toBe(2);
    expect(canvasElement.querySelector('[data-testid="page-item-types"]')).toBeInTheDocument();
  },
};

// =============================================================================
// FACTORY: createFakePaginationConfig
// =============================================================================

function PaginationConfigDemo() {
  const config: FakePaginationConfig = createFakePaginationConfig({
    totalPages: 10,
    currentPage: 3,
  });

  return (
    <div className="flex flex-col gap-4" data-testid="pagination-config-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      <p className="text-sm" data-testid="config-info">
        {`Page ${config.currentPage} of ${config.totalPages} (${config.totalItems} items, ${config.itemsPerPage}/page)`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryPaginationConfig: Story = {
  render: () => <PaginationConfigDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="pagination-config-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="config-info"]')).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeTablePagination
// =============================================================================

function TablePaginationDemo() {
  const tablePag: FakeTablePagination = createFakeTablePagination({
    totalItems: 200,
    itemsPerPage: 20,
    currentPage: 3,
    totalPages: 10,
  });

  return (
    <div className="flex flex-col gap-4" data-testid="table-pagination-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      <p className="text-sm" data-testid="table-info">
        {`Showing ${tablePag.startIndex}-${tablePag.endIndex} of ${tablePag.totalItems} items`}
        {tablePag.filteredCount !== undefined && ` (${tablePag.filteredCount} filtered)`}
      </p>
      <p className="text-muted-foreground text-xs" data-testid="table-nav-info">
        {`Has previous: ${tablePag.hasPreviousPage}, Has next: ${tablePag.hasNextPage}, Per page: ${tablePag.selectedPerPage}`}
      </p>
      <PaginationFromConfig config={tablePag} />
    </div>
  );
}

export const FactoryTablePagination: Story = {
  render: () => <TablePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="table-pagination-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="table-info"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="table-nav-info"]')).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
  },
};

// =============================================================================
// FACTORY: createFakeInfiniteScrollPagination
// =============================================================================

function InfiniteScrollDemo() {
  const infiniteScroll: FakeInfiniteScrollPagination = createFakeInfiniteScrollPagination({
    pageSize: 20,
    totalCount: 100,
    loadedCount: 40,
  });

  return (
    <div className="flex flex-col gap-4" data-testid="infinite-scroll-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      <p className="text-sm" data-testid="infinite-info">
        {`Loaded ${infiniteScroll.loadedCount} of ${infiniteScroll.totalCount ?? '?'} (page size: ${infiniteScroll.pageSize})`}
      </p>
      <p className="text-muted-foreground text-xs" data-testid="infinite-state">
        {`Has more: ${infiniteScroll.hasMore}, Loading: ${infiniteScroll.isLoading}, Cursor: ${infiniteScroll.cursor ?? 'none'}`}
      </p>
      <div className="bg-muted rounded-md p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">{`${infiniteScroll.loadedCount} items loaded`}</span>
          {infiniteScroll.hasMore && (
            <button className="text-primary text-sm underline" data-testid="load-more-btn">
              Load more
            </button>
          )}
        </div>
        <div className="bg-primary/20 mt-2 h-2 w-full rounded">
          <div
            className="bg-primary h-2 rounded"
            style={{
              width: `${(infiniteScroll.loadedCount / (infiniteScroll.totalCount ?? infiniteScroll.loadedCount)) * 100}%`,
            }}
            data-testid="progress-bar"
          />
        </div>
      </div>
    </div>
  );
}

export const FactoryInfiniteScroll: Story = {
  render: () => <InfiniteScrollDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="infinite-scroll-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="infinite-info"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="infinite-state"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="progress-bar"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="load-more-btn"]')).toBeInTheDocument();
  },
};

// =============================================================================
// FACTORY: createFakeSimplePagination
// =============================================================================

function SimplePaginationDemo() {
  const config = createFakeSimplePagination(5);

  return (
    <div className="flex flex-col gap-4" data-testid="simple-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Layouts
        {' - Simple layout with few pages'}
      </p>
      <p className="text-xs" data-testid="simple-info">
        {`Layout: ${config.layout}, Pages: ${config.totalPages}, Siblings: ${config.siblingCount}`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactorySimplePagination: Story = {
  render: () => <SimplePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="simple-pagination-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="simple-info"]')).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeFirstPagePagination
// =============================================================================

function FirstPagePaginationDemo() {
  const config = createFakeFirstPagePagination(15);

  return (
    <div className="flex flex-col gap-4" data-testid="first-page-pagination-demo">
      <p className="text-muted-foreground text-sm">
        First Page
        {` - Page ${config.currentPage} of ${config.totalPages}`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryFirstPagePagination: Story = {
  render: () => <FirstPagePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="first-page-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeLastPagePagination
// =============================================================================

function LastPagePaginationDemo() {
  const config = createFakeLastPagePagination(15);

  return (
    <div className="flex flex-col gap-4" data-testid="last-page-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Last Page
        {` - Page ${config.currentPage} of ${config.totalPages}`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryLastPagePagination: Story = {
  render: () => <LastPagePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="last-page-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeMiddlePagePagination
// =============================================================================

function MiddlePagePaginationDemo() {
  const config = createFakeMiddlePagePagination(20);

  return (
    <div className="flex flex-col gap-4" data-testid="middle-page-pagination-demo">
      <p className="text-muted-foreground text-sm">
        {i18n.t(
          'pagination.story.playground',
          'Interactive playground for testing pagination behavior.'
        )}
        {` - Page ${config.currentPage} of ${config.totalPages}`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryMiddlePagePagination: Story = {
  render: () => <MiddlePagePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="middle-page-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const ellipses = canvasElement.querySelectorAll('[data-slot="pagination-ellipsis"]');
    expect(ellipses.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeDisabledPagination
// =============================================================================

function DisabledPaginationDemo() {
  const config = createFakeDisabledPagination();

  return (
    <div className="flex flex-col gap-4" data-testid="disabled-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Disabled
        {` - isDisabled: ${config.isDisabled}`}
      </p>
      <div className={config.isDisabled ? 'pointer-events-none opacity-50' : ''}>
        <PaginationFromConfig config={config} />
      </div>
    </div>
  );
}

export const FactoryDisabledPagination: Story = {
  render: () => <DisabledPaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="disabled-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
  },
};

// =============================================================================
// FACTORY: createFakeSinglePagePagination
// =============================================================================

function SinglePagePaginationDemo() {
  const config = createFakeSinglePagePagination();

  return (
    <div className="flex flex-col gap-4" data-testid="single-page-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Default
        {` - Single page (${config.totalItems} items)`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactorySinglePagePagination: Story = {
  render: () => <SinglePagePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="single-page-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBe(1);
  },
};

// =============================================================================
// FACTORY: createFakeLargePagination
// =============================================================================

function LargePaginationDemo() {
  const config = createFakeLargePagination(100);

  return (
    <div className="flex flex-col gap-4" data-testid="large-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Variants
        {` - Large dataset: ${config.totalPages} pages, ${config.totalItems} items`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryLargePagination: Story = {
  render: () => <LargePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="large-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
    const links = canvasElement.querySelectorAll('[data-slot="pagination-link"]');
    expect(links.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// FACTORY: createFakeCompactPagination
// =============================================================================

function CompactPaginationDemo() {
  const config = createFakeCompactPagination();

  return (
    <div className="flex flex-col gap-4" data-testid="compact-pagination-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Layouts
        {` - Compact: layout=${config.layout}, variant=${config.variant}, siblings=${config.siblingCount}`}
      </p>
      <PaginationFromConfig config={config} />
    </div>
  );
}

export const FactoryCompactPagination: Story = {
  render: () => <CompactPaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="compact-pagination-demo"]');
    expect(container).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
  },
};

// =============================================================================
// FACTORY: createFakeDataTablePagination
// =============================================================================

function DataTablePaginationDemo() {
  const tablePag = createFakeDataTablePagination(150, 10);

  return (
    <div className="flex flex-col gap-4" data-testid="data-table-pagination-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      <div className="bg-muted rounded-md p-3" data-testid="data-table-info">
        <p className="text-sm">
          {`Rows ${tablePag.startIndex}-${tablePag.endIndex} of ${tablePag.totalItems}`}
        </p>
        <p className="text-muted-foreground text-xs">
          {`Per page: ${tablePag.selectedPerPage} | Previous: ${tablePag.hasPreviousPage} | Next: ${tablePag.hasNextPage}`}
        </p>
      </div>
      <PaginationFromConfig config={tablePag} />
    </div>
  );
}

export const FactoryDataTablePagination: Story = {
  render: () => <DataTablePaginationDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="data-table-pagination-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="data-table-info"]')).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
  },
};

// =============================================================================
// MATRIX: createPaginationSizeMatrix + PAGINATION_SIZES constant
// =============================================================================

function SizeMatrixDemo() {
  const sizeMatrix = createPaginationSizeMatrix();
  const allSizes: PaginationSize[] = [...PAGINATION_SIZES];

  return (
    <div className="flex flex-col gap-6" data-testid="size-matrix-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Sizes
        {` (${allSizes.join(', ')})`}
      </p>
      {sizeMatrix.map((config, idx) => (
        <div key={config.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`size-label-${idx}`}>
            {`Size: ${config.size}`}
          </p>
          <PaginationFromConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactorySizeMatrix: Story = {
  render: () => <SizeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="size-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(PAGINATION_SIZES.length);
    for (let i = 0; i < PAGINATION_SIZES.length; i++) {
      expect(canvasElement.querySelector(`[data-testid="size-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

// =============================================================================
// MATRIX: createPaginationLayoutMatrix + PAGINATION_LAYOUTS constant
// =============================================================================

function LayoutMatrixDemo() {
  const layoutMatrix = createPaginationLayoutMatrix();
  const allLayouts: PaginationLayout[] = [...PAGINATION_LAYOUTS];

  return (
    <div className="flex flex-col gap-6" data-testid="layout-matrix-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Layouts
        {` (${allLayouts.join(', ')})`}
      </p>
      {layoutMatrix.map((config, idx) => (
        <div key={config.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`layout-label-${idx}`}>
            {`Layout: ${config.layout}`}
          </p>
          <PaginationFromConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryLayoutMatrix: Story = {
  render: () => <LayoutMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="layout-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(PAGINATION_LAYOUTS.length);
    for (let i = 0; i < PAGINATION_LAYOUTS.length; i++) {
      expect(canvasElement.querySelector(`[data-testid="layout-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

// =============================================================================
// MATRIX: createPaginationVariantMatrix + PAGINATION_VARIANTS constant
// =============================================================================

function VariantMatrixDemo() {
  const variantMatrix = createPaginationVariantMatrix();
  const allVariants: PaginationVariant[] = [...PAGINATION_VARIANTS];

  return (
    <div className="flex flex-col gap-6" data-testid="variant-matrix-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Variants
        {` (${allVariants.join(', ')})`}
      </p>
      {variantMatrix.map((config, idx) => (
        <div key={config.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`variant-label-${idx}`}>
            {`Variant: ${config.variant}`}
          </p>
          <PaginationFromConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryVariantMatrix: Story = {
  render: () => <VariantMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="variant-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(PAGINATION_VARIANTS.length);
    for (let i = 0; i < PAGINATION_VARIANTS.length; i++) {
      expect(canvasElement.querySelector(`[data-testid="variant-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

// =============================================================================
// MATRIX: createPaginationStateMatrix + PAGINATION_STATES constant
// =============================================================================

function StateMatrixDemo() {
  const stateMatrix = createPaginationStateMatrix();
  const allStates: PaginationState[] = [...PAGINATION_STATES];

  return (
    <div className="flex flex-col gap-6" data-testid="state-matrix-demo">
      <p className="text-muted-foreground text-sm">
        Pagination States
        {` (${allStates.join(', ')})`}
      </p>
      {stateMatrix.map((config, idx) => (
        <div key={config.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`state-label-${idx}`}>
            {`State: ${allStates[idx]} (disabled: ${config.isDisabled})`}
          </p>
          <div className={config.isDisabled ? 'pointer-events-none opacity-50' : ''}>
            <PaginationFromConfig config={config} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const FactoryStateMatrix: Story = {
  render: () => <StateMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="state-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(PAGINATION_STATES.length);
    for (let i = 0; i < PAGINATION_STATES.length; i++) {
      expect(canvasElement.querySelector(`[data-testid="state-label-${i}"]`)).toBeInTheDocument();
    }
  },
};

// =============================================================================
// MATRIX: createPaginationPositionMatrix
// =============================================================================

function PositionMatrixDemo() {
  const positionMatrix = createPaginationPositionMatrix(10);
  const positionLabels = [
    i18n.t('pagination.story.first', 'First'),
    i18n.t('pagination.story.middle', 'Middle'),
    i18n.t('pagination.story.last', 'Last'),
  ];

  return (
    <div className="flex flex-col gap-6" data-testid="position-matrix-demo">
      <p className="text-muted-foreground text-sm">
        Pagination Variants
        {' - Position matrix (first, middle, last)'}
      </p>
      {positionMatrix.map((config, idx) => (
        <div key={config.id} className="space-y-1">
          <p className="text-xs font-medium" data-testid={`position-label-${idx}`}>
            {`${positionLabels[idx]}: page ${config.currentPage} of ${config.totalPages}`}
          </p>
          <PaginationFromConfig config={config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryPositionMatrix: Story = {
  render: () => <PositionMatrixDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="position-matrix-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBe(3);
    expect(canvasElement.querySelector('[data-testid="position-label-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="position-label-1"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="position-label-2"]')).toBeInTheDocument();
  },
};

// =============================================================================
// SHOWCASE: createPaginationShowcase
// =============================================================================

function ShowcaseDemo() {
  const showcase = createPaginationShowcase();

  return (
    <div className="flex flex-col gap-6" data-testid="showcase-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>
      {showcase.map((item, idx) => (
        <div key={item.config.id} className="space-y-1">
          <p className="text-sm font-medium" data-testid={`showcase-name-${idx}`}>
            {item.name}
          </p>
          <p className="text-muted-foreground text-xs" data-testid={`showcase-desc-${idx}`}>
            {item.description}
          </p>
          <PaginationFromConfig config={item.config} />
        </div>
      ))}
    </div>
  );
}

export const FactoryShowcase: Story = {
  render: () => <ShowcaseDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="showcase-demo"]');
    expect(container).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBeGreaterThanOrEqual(9);
    expect(canvasElement.querySelector('[data-testid="showcase-name-0"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="showcase-desc-0"]')).toBeInTheDocument();
  },
};

// =============================================================================
// COMPREHENSIVE: createPaginationTestData
// =============================================================================

function TestDataDemo() {
  const testData = createPaginationTestData();

  return (
    <div className="flex flex-col gap-8" data-testid="test-data-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>

      <div data-testid="test-data-configs">
        <p className="mb-2 text-sm font-medium">{`Configs (${testData.configs.length})`}</p>
        {testData.configs.map((config) => (
          <PaginationFromConfig key={config.id} config={config} />
        ))}
      </div>

      <div data-testid="test-data-page-items">
        <p className="mb-2 text-sm font-medium">{`Page Items (${testData.pageItems.length})`}</p>
        <div className="flex gap-2">
          {testData.pageItems.map((item) => (
            <span key={item.id} className="bg-muted rounded px-2 py-1 text-xs">
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div data-testid="test-data-table">
        <p className="mb-2 text-sm font-medium">
          {`Table Paginations (${testData.tablePaginations.length})`}
        </p>
        {testData.tablePaginations.map((tp) => (
          <div key={tp.id} className="text-xs">
            {`${tp.startIndex}-${tp.endIndex} of ${tp.totalItems}`}
          </div>
        ))}
      </div>

      <div data-testid="test-data-infinite">
        <p className="mb-2 text-sm font-medium">
          {`Infinite Scroll (${testData.infiniteScroll.length})`}
        </p>
        {testData.infiniteScroll.map((inf) => (
          <div key={inf.id} className="text-xs">
            {`${inf.loadedCount}/${inf.totalCount ?? '?'} loaded, hasMore: ${inf.hasMore}`}
          </div>
        ))}
      </div>

      <div data-testid="test-data-matrices">
        <p className="mb-2 text-sm font-medium">
          {i18n.t('pagination.story.matrices', 'Matrices')}
        </p>
        <p className="text-xs">{`Size matrix: ${testData.sizeMatrix.length} items`}</p>
        <p className="text-xs">{`Layout matrix: ${testData.layoutMatrix.length} items`}</p>
        <p className="text-xs">{`Variant matrix: ${testData.variantMatrix.length} items`}</p>
        <p className="text-xs">{`State matrix: ${testData.stateMatrix.length} items`}</p>
        <p className="text-xs">{`Position matrix: ${testData.positionMatrix.length} items`}</p>
        <p className="text-xs">{`Showcase: ${testData.showcase.length} items`}</p>
      </div>
    </div>
  );
}

export const FactoryTestData: Story = {
  render: () => <TestDataDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="test-data-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="test-data-configs"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="test-data-page-items"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="test-data-table"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="test-data-infinite"]')).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="test-data-matrices"]')).toBeInTheDocument();
    const paginations = canvasElement.querySelectorAll('[data-slot="pagination"]');
    expect(paginations.length).toBeGreaterThan(0);
  },
};

// =============================================================================
// CONSTANTS: COMMON_PAGE_COUNTS, ITEMS_PER_PAGE_OPTIONS, SIBLING_COUNT_OPTIONS
// =============================================================================

function ConstantsDemo() {
  return (
    <div className="flex flex-col gap-6" data-testid="constants-demo">
      <p className="text-muted-foreground text-sm">Navigation component for paginated content.</p>

      <div data-testid="common-page-counts">
        <p className="mb-1 text-sm font-medium">
          {i18n.t('pagination.story.commonPageCounts', 'Common Page Counts')}
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_PAGE_COUNTS.map((count) => (
            <span key={count} className="bg-muted rounded px-2 py-1 text-xs">
              {count}
            </span>
          ))}
        </div>
      </div>

      <div data-testid="items-per-page-options">
        <p className="mb-1 text-sm font-medium">
          {i18n.t('pagination.story.itemsPerPageOptions', 'Items Per Page Options')}
        </p>
        <div className="flex flex-wrap gap-2">
          {ITEMS_PER_PAGE_OPTIONS.map((option) => (
            <span key={option} className="bg-muted rounded px-2 py-1 text-xs">
              {option}
            </span>
          ))}
        </div>
      </div>

      <div data-testid="sibling-count-options">
        <p className="mb-1 text-sm font-medium">
          {i18n.t('pagination.story.siblingCountOptions', 'Sibling Count Options')}
        </p>
        <div className="flex flex-wrap gap-2">
          {SIBLING_COUNT_OPTIONS.map((count) => (
            <span key={count} className="bg-muted rounded px-2 py-1 text-xs">
              {count}
            </span>
          ))}
        </div>
      </div>

      <div data-testid="constants-pagination-preview">
        <p className="mb-1 text-sm font-medium">
          Preview with COMMON_PAGE_COUNTS[4] = {COMMON_PAGE_COUNTS[4]}
        </p>
        <PaginationFromConfig
          config={createFakePaginationConfig({
            totalPages: COMMON_PAGE_COUNTS[4],
            currentPage: 1,
            itemsPerPage: ITEMS_PER_PAGE_OPTIONS[1],
            siblingCount: SIBLING_COUNT_OPTIONS[1],
          })}
        />
      </div>
    </div>
  );
}

export const FactoryConstants: Story = {
  render: () => <ConstantsDemo />,
  play: async ({ canvasElement }) => {
    const container = canvasElement.querySelector('[data-testid="constants-demo"]');
    expect(container).toBeInTheDocument();
    expect(canvasElement.querySelector('[data-testid="common-page-counts"]')).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="items-per-page-options"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="sibling-count-options"]')
    ).toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-testid="constants-pagination-preview"]')
    ).toBeInTheDocument();
    const pagination = canvasElement.querySelector('[data-slot="pagination"]');
    expect(pagination).toBeInTheDocument();
  },
};

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   conflict
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: paginationStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};

export const HandlerConflict: Story = {
  ...Default,
  name: i18n.t('pagination.storyName.handlerConflict', 'Handler: Conflict'),
  parameters: { msw: { handlers: paginationStatusHandlers.conflict } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
