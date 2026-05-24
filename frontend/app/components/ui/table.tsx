'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Table component props
 *
 * @description Props for the Table data display component.
 */
export type TableProps = React.ComponentProps<'table'> & {
  /**
   * Custom test ID for testing
   * @default 'table'
   */
  testId?: string;
};

/**
 * TableHeader component props
 *
 * @description Props for the table header section.
 */
export type TableHeaderProps = React.ComponentProps<'thead'> & {
  /**
   * Custom test ID for testing
   * @default 'table-header'
   */
  testId?: string;
};

/**
 * TableBody component props
 *
 * @description Props for the table body section.
 */
export type TableBodyProps = React.ComponentProps<'tbody'> & {
  /**
   * Custom test ID for testing
   * @default 'table-body'
   */
  testId?: string;
};

/**
 * TableFooter component props
 *
 * @description Props for the table footer section.
 */
export type TableFooterProps = React.ComponentProps<'tfoot'> & {
  /**
   * Custom test ID for testing
   * @default 'table-footer'
   */
  testId?: string;
};

/**
 * TableRow component props
 *
 * @description Props for individual table rows.
 */
export type TableRowProps = React.ComponentProps<'tr'> & {
  /**
   * Custom test ID for testing
   * @default 'table-row'
   */
  testId?: string;
};

/**
 * TableHead component props
 *
 * @description Props for table header cells.
 */
export type TableHeadProps = React.ComponentProps<'th'> & {
  /**
   * Custom test ID for testing
   * @default 'table-head'
   */
  testId?: string;
};

/**
 * TableCell component props
 *
 * @description Props for table data cells.
 */
export type TableCellProps = React.ComponentProps<'td'> & {
  /**
   * Custom test ID for testing
   * @default 'table-cell'
   */
  testId?: string;
};

/**
 * TableCaption component props
 *
 * @description Props for table caption element.
 */
export type TableCaptionProps = React.ComponentProps<'caption'> & {
  /**
   * Custom test ID for testing
   * @default 'table-caption'
   */
  testId?: string;
};

/**
 * Table component - Responsive data table
 *
 * @description
 * A semantic table component for displaying structured data in rows
 * and columns. Includes responsive horizontal scrolling for smaller viewports.
 *
 * ## Features
 * - **Responsive**: Horizontal scroll on small screens
 * - **Semantic HTML**: Proper table structure for accessibility
 * - **Sortable Ready**: Works with sorting libraries
 * - **Selection Support**: Row selection with data-state
 * - **Sticky Headers**: Compatible with sticky positioning
 *
 * ## Use Cases
 * - Data grids and listings
 * - Admin dashboards
 * - Reports and analytics
 * - Sortable/filterable data views
 * - Paginated content
 *
 * ## Accessibility
 * - Uses semantic `<table>` elements
 * - `scope` attribute on header cells
 * - Caption support for table description
 * - Keyboard navigable
 *
 * @example
 * ```tsx
 * // Basic table
 * <Table>
 *   <TableCaption>A list of recent invoices</TableCaption>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Invoice</TableHead>
 *       <TableHead>Status</TableHead>
 *       <TableHead className="text-right">Amount</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>INV001</TableCell>
 *       <TableCell>Paid</TableCell>
 *       <TableCell className="text-right">$250.00</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 *
 * // With footer
 * <Table>
 *   <TableHeader>...</TableHeader>
 *   <TableBody>...</TableBody>
 *   <TableFooter>
 *     <TableRow>
 *       <TableCell colSpan={2}>Total</TableCell>
 *       <TableCell className="text-right">$2,500.00</TableCell>
 *     </TableRow>
 *   </TableFooter>
 * </Table>
 * ```
 */
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, testId = 'table', ...props }, ref) => {
    return (
      <div
        data-slot="table-container"
        data-testid={`${testId}-container`}
        className="relative w-full overflow-x-auto"
      >
        <table
          ref={ref}
          data-slot="table"
          data-testid={testId}
          className={cn('w-full caption-bottom text-sm', className)}
          {...props}
        />
      </div>
    );
  }
);
Table.displayName = 'Table';

/** TableHeader component - container for header rows */
const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, testId = 'table-header', ...props }, ref) => {
    return (
      <thead
        ref={ref}
        data-slot="table-header"
        data-testid={testId}
        className={cn('[&_tr]:border-b', className)}
        {...props}
      />
    );
  }
);
TableHeader.displayName = 'TableHeader';

/** TableBody component - container for body rows */
const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, testId = 'table-body', ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        data-slot="table-body"
        data-testid={testId}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
      />
    );
  }
);
TableBody.displayName = 'TableBody';

/** TableFooter component - container for footer rows */
const TableFooter = React.forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, testId = 'table-footer', ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        data-slot="table-footer"
        data-testid={testId}
        className={cn('bg-muted/50 border-t font-medium [&>tr]:last:border-b-0', className)}
        {...props}
      />
    );
  }
);
TableFooter.displayName = 'TableFooter';

/** TableRow component - table row with hover state */
const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, testId = 'table-row', ...props }, ref) => {
    return (
      <tr
        ref={ref}
        data-slot="table-row"
        data-testid={testId}
        className={cn(
          'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
          className
        )}
        {...props}
      />
    );
  }
);
TableRow.displayName = 'TableRow';

/** TableHead component - header cell with proper scope */
const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, scope = 'col', testId = 'table-head', ...props }, ref) => {
    return (
      <th
        ref={ref}
        scope={scope}
        data-slot="table-head"
        data-testid={testId}
        className={cn(
          'text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
          className
        )}
        {...props}
      />
    );
  }
);
TableHead.displayName = 'TableHead';

/** TableCell component - data cell */
const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, testId = 'table-cell', ...props }, ref) => {
    return (
      <td
        ref={ref}
        data-slot="table-cell"
        data-testid={testId}
        className={cn(
          'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
          className
        )}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

/** TableCaption component - accessible table caption */
const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, testId = 'table-caption', ...props }, ref) => {
    return (
      <caption
        ref={ref}
        data-slot="table-caption"
        data-testid={testId}
        className={cn('text-muted-foreground mt-4 text-sm', className)}
        {...props}
      />
    );
  }
);
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
