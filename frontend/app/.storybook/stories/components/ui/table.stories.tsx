import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { normalizeDecorators } from '@/.storybook/stories/_utils/normalize-decorators';
import { tableHandlers, tableStatusHandlers } from '@/.storybook/stories/_handlers/table.handlers';
import { seedFaker } from '@/.storybook/stories/_utils/faker-seed';
import { STORY_NO_DOM_ERROR } from '@/.storybook/stories/_utils/story-helpers';
import {
  createFakeActiveProduct,
  createFakeActiveTableRow,
  createFakeActiveUserRow,
  createFakeBulkActions,
  createFakeCancelledOrder,
  createFakeComfortableTableConfig,
  createFakeCompactTableConfig,
  createFakeCompletedTransaction,
  createFakeCriticalTableRow,
  createFakeDataGridRows,
  createFakeDeliveredOrder,
  createFakeDraftInvoice,
  createFakeDraftProduct,
  createFakeEmptyTableResponse,
  createFakeExportConfig,
  createFakeFailedTransaction,
  createFakeFirstPagePagination,
  createFakeHighPriorityTableRow,
  createFakeInactiveTableRow,
  createFakeInvoice,
  createFakeInvoices,
  createFakeInvoiceStatusMatrix,
  createFakeLastPagePagination,
  createFakeOrders,
  createFakeOrderStatusMatrix,
  createFakeOutOfStockProduct,
  createFakeOverdueInvoice,
  createFakePagination,
  createFakePaidInvoice,
  createFakePendingOrder,
  createFakePendingTableRow,
  createFakePendingUserRow,
  createFakeProducts,
  createFakeProductStatusMatrix,
  createFakeRefundTransaction,
  createFakeSelectableTableConfig,
  createFakeShippedOrder,
  createFakeSinglePageTableResponse,
  createFakeStripedTableConfig,
  createFakeSuspendedUserRow,
  createFakeTableColumns,
  createFakeTableConfig,
  createFakeTableData,
  createFakeTableDemoData,
  createFakeTableDensityMatrix,
  createFakeTableFilter,
  createFakeTableResponse,
  createFakeTableRow,
  createFakeTableRowPriorityMatrix,
  createFakeTableRowStatusMatrix,
  createFakeTableSelectionModeMatrix,
  createFakeTableSort,
  createFakeTransactions,
  createFakeTransactionStatusMatrix,
  createFakeUserTableRows,
  createFakeUserTableStatusMatrix,
  type FakeInvoice,
  type FakeTableRow,
} from '@/.storybook/stories/_factories/table.factory';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

// Seed faker for deterministic data
import i18n from 'i18next';

seedFaker();

// Static demo with inline data
function TableDemo() {
  const { t } = useTranslation();

  return (
    <div className="w-[680px]">
      <Table>
        <TableCaption>
          {t('table.story.recentInvoicesCaption', 'A list of recent invoices.')}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{t('table.story.status', 'Status')}</TableHead>
            <TableHead>{t('table.story.method', 'Method')}</TableHead>
            <TableHead className="text-right">{t('table.story.amount', 'Amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            {
              id: 'INV-001',
              status: i18n.t('table.story.paid', 'Paid'),
              method: i18n.t('table.story.card', 'Card'),
              amount: '$250.00',
            },
            {
              id: 'INV-002',
              status: i18n.t('table.story.pending', 'Pending'),
              method: i18n.t('table.story.paypal', 'PayPal'),
              amount: '$120.00',
            },
            {
              id: 'INV-003',
              status: i18n.t('table.story.failed', 'Failed'),
              method: i18n.t('table.story.bank', 'Bank'),
              amount: '$340.00',
            },
          ].map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.method}</TableCell>
              <TableCell className="text-right">{row.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Demo with Faker data (static, no API)
function TableWithFakerData() {
  const invoices = React.useMemo(() => createFakeInvoices(5), []);

  return (
    <div className="w-[800px]">
      <Table>
        <TableCaption>
          {i18n.t(
            'table.story.invoiceDataGeneratedWithFakerjs',
            'Invoice data generated with Faker.js'
          )}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
            <TableHead>{i18n.t('table.story.status', 'Status')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.story.amount', 'Amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
              <TableCell>{invoice.customer}</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell className="text-right">
                ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Error display component
interface ApiError {
  code: string;
  details?: Record<string, string>;
  message: string;
  status: number;
}

function TableErrorDisplay({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" data-error-status={error.status} data-testid="table-error">
      <AlertCircleIcon className="size-4" />
      <AlertTitle>
        Error {error.status}: {error.code}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {error.message}
        {error.details && (
          <ul className="mt-2 list-disc pl-4 text-sm">
            {Object.entries(error.details).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCwIcon className="mr-2 size-4" />
          {i18n.t('table.story.retry', 'Retry')}
        </Button>
      )}
    </Alert>
  );
}

// Loading skeleton
function TableLoadingSkeleton() {
  return (
    <div className="w-[800px]" data-state="loading" data-testid="table-loading">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
            <TableHead>{i18n.t('table.story.status', 'Status')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.story.amount', 'Amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`table-skeleton-row-${String(i)}`}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Empty state
function TableEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-state="empty"
      data-testid="table-empty"
    >
      <p className="text-muted-foreground">
        {i18n.t('table.story.noInvoicesFound', 'No invoices found')}
      </p>
    </div>
  );
}

// Demo component with async data fetching via MSW
function TableWithAsyncData() {
  const [data, setData] = React.useState<FakeInvoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/invoices?limit=5')
      .then(async (res) => {
        if (!res.ok) {
          const err = (await res.json()) as ApiError;
          throw err;
        }
        return res.json() as Promise<{ invoices: FakeInvoice[]; total: number }>;
      })
      .then((json) => {
        setData(json.invoices);
        setLoading(false);
        return undefined;
      })
      .catch((error_: ApiError) => {
        setError(error_);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <TableLoadingSkeleton />;
  }

  if (error) {
    return <TableErrorDisplay error={error} onRetry={fetchData} />;
  }

  if (data.length === 0) {
    return <TableEmptyState />;
  }

  return (
    <div className="w-[800px]" data-state="success" data-testid="table-success">
      <Table>
        <TableCaption>
          {i18n.t('table.story.dataFetchedCaption', 'Data fetched via MSW + Faker')}
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
            <TableHead>{i18n.t('table.story.status', 'Status')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.story.amount', 'Amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
              <TableCell>{invoice.customer}</TableCell>
              <TableCell>{invoice.status}</TableCell>
              <TableCell className="text-right">
                ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function I18nTableDemo() {
  const { t } = useTranslation();

  const rows = [
    {
      id: 'INV-001',
      status: t('table.status.paid'),
      method: t('table.method.card'),
      amount: '$250.00',
    },
    {
      id: 'INV-002',
      status: t('table.status.pending'),
      method: t('table.method.paypal'),
      amount: '$120.00',
    },
    {
      id: 'INV-003',
      status: t('table.status.failed'),
      method: t('table.method.bank'),
      amount: '$340.00',
    },
  ];

  return (
    <div className="w-[680px]">
      <Table>
        <TableCaption>{t('table.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.head.invoice')}</TableHead>
            <TableHead>{t('table.head.status')}</TableHead>
            <TableHead>{t('table.head.method')}</TableHead>
            <TableHead className="text-right">{t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.method}</TableCell>
              <TableCell className="text-right">{row.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const meta = {
  title: 'Components/UI/Table',
  component: TableDemo,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    onFocus: fn(),
    onBlur: fn(),
    onKeyDown: fn(),
    onKeyUp: fn(),
    onMouseEnter: fn(),
    onMouseLeave: fn(),
    onSort: fn(),
    onRowSelect: fn(),
  },
  parameters: {
    msw: {
      handlers: tableHandlers,
    },
    a11y: {
      // Uses global WCAG config from ssot.ts
    },
  },
  argTypes: {
    // Events
    onClick: {
      action: 'onClick',
      description: i18n.t('table.argType.clickEventHandler', 'Click event handler'),
      table: { category: 'Events' },
    },
    onFocus: {
      action: 'onFocus',
      description: i18n.t('table.argType.focusEventHandler', 'Focus event handler'),
      table: { category: 'Events' },
    },
    onBlur: {
      action: 'onBlur',
      description: i18n.t('table.argType.blurEventHandler', 'Blur event handler'),
      table: { category: 'Events' },
    },
    onKeyDown: {
      action: 'onKeyDown',
      description: i18n.t('table.argType.keydownEventHandler', 'KeyDown event handler'),
      table: { category: 'Events' },
    },
    onKeyUp: {
      action: 'onKeyUp',
      description: i18n.t('table.argType.keyupEventHandler', 'KeyUp event handler'),
      table: { category: 'Events' },
    },
    onMouseEnter: {
      action: 'onMouseEnter',
      description: i18n.t('table.argType.mouseenterEventHandler', 'MouseEnter event handler'),
      table: { category: 'Events' },
    },
    onMouseLeave: {
      action: 'onMouseLeave',
      description: i18n.t('table.argType.mouseleaveEventHandler', 'MouseLeave event handler'),
      table: { category: 'Events' },
    },
    onSort: {
      action: 'onSort',
      description: i18n.t('table.argType.calledWhenColumnIsSorted', 'Called when column is sorted'),
      table: { category: 'Events' },
    },
    onRowSelect: {
      action: 'onRowSelect',
      description: i18n.t('table.argType.calledWhenRowIsSelected', 'Called when row is selected'),
      table: { category: 'Events' },
    },
    // Table Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Table content (ReactNode)
    //
    // TableHeader Props Reference:
    // - className: Additional CSS classes (string)
    // - children: TableRow elements with TableHead cells (ReactNode)
    //
    // TableBody Props Reference:
    // - className: Additional CSS classes (string)
    // - children: TableRow elements with TableCell cells (ReactNode)
    //
    // TableFooter Props Reference:
    // - className: Additional CSS classes (string)
    // - children: TableRow elements for footer content (ReactNode)
    //
    // TableRow Props Reference:
    // - className: Additional CSS classes (string)
    // - children: TableHead or TableCell elements (ReactNode)
    //
    // TableHead Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Header cell content (ReactNode)
    //
    // TableCell Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Cell content (ReactNode)
    //
    // TableCaption Props Reference:
    // - className: Additional CSS classes (string)
    // - children: Caption text describing the table (ReactNode)
    //
    // Usage Notes:
    // - Use TableCaption for accessibility to describe the table's purpose
    // - Apply text alignment classes like 'text-right' for numeric columns
    // - Use 'font-medium' class for emphasis on important cells
  },
} satisfies Meta<typeof TableDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    if (!canvasElement.querySelector('*')) {
      throw new Error(STORY_NO_DOM_ERROR);
    }

    const table = canvasElement.querySelector('[data-slot="table"]');
    if (!(table instanceof HTMLTableElement)) {
      throw new Error('Table element was not found.');
    }

    const caption = table.querySelector('[data-slot="table-caption"]');
    if (!(caption instanceof HTMLTableCaptionElement)) {
      throw new Error('Table caption was not found.');
    }

    expect(caption.textContent?.trim()).toBeInTheDocument();

    const headerCells = table.querySelectorAll('thead [data-slot="table-head"]');
    expect(headerCells.length).toBe(4);
    expect(headerCells[0]?.textContent?.trim()).toBeInTheDocument();
    expect(headerCells[1]?.textContent?.trim()).toBeInTheDocument();
    expect(headerCells[2]?.textContent?.trim()).toBeInTheDocument();
    expect(headerCells[3]?.textContent?.trim()).toBeInTheDocument();

    const body = table.querySelector('[data-slot="table-body"]');
    if (!(body instanceof HTMLTableSectionElement)) {
      throw new Error('Table body was not found.');
    }

    const rows = body.querySelectorAll('[data-slot="table-row"]');
    expect(rows.length).toBe(3);

    const expectedRows = [
      {
        id: 'INV-001',
        status: i18n.t('table.story.paid', 'Paid'),
        method: i18n.t('table.story.card', 'Card'),
        amount: '$250.00',
      },
      {
        id: 'INV-002',
        status: i18n.t('table.story.pending', 'Pending'),
        method: i18n.t('table.story.paypal', 'PayPal'),
        amount: '$120.00',
      },
      {
        id: 'INV-003',
        status: i18n.t('table.story.failed', 'Failed'),
        method: i18n.t('table.story.bank', 'Bank'),
        amount: '$340.00',
      },
    ];

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('[data-slot="table-cell"]');
      expect(cells.length).toBe(4);

      const expected = expectedRows[index];
      if (!expected) {
        throw new Error('Unexpected table row count.');
      }

      expect(cells[0]).toHaveTextContent(expected.id);
      expect(cells[1]).toBeInTheDocument();
      expect(cells[2]).toBeInTheDocument();
      expect(cells[3]).toHaveTextContent(expected.amount);

      const amountCell = cells[3];
      if (!(amountCell instanceof HTMLElement)) {
        throw new Error('Amount cell was not an HTMLElement.');
      }

      expect(amountCell.className).toContain('text-right');
    });
  },
};

export const Playground: Story = {
  ...Default,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();

    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);

    const headerCells = canvasElement.querySelectorAll('thead [data-slot="table-head"]');
    expect(headerCells.length).toBe(4);
  },
};

// Table with Sorting (for Variants)
function SortableTable() {
  const [sortKey, setSortKey] = React.useState<'customer' | 'amount'>('customer');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const data = [
    { id: 'INV-001', customer: i18n.t('table.story.johnDoe', 'John Doe'), amount: 250 },
    { id: 'INV-002', customer: i18n.t('table.story.janeSmith', 'Jane Smith'), amount: 120 },
    { id: 'INV-003', customer: i18n.t('table.story.bobJohnson', 'Bob Johnson'), amount: 340 },
    { id: 'INV-004', customer: i18n.t('table.story.aliceBrown', 'Alice Brown'), amount: 89 },
  ];
  const sorted = [...data].sort((a, b) => {
    const mult = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'amount') return (a.amount - b.amount) * mult;
    return a.customer.localeCompare(b.customer) * mult;
  });
  const toggleSort = (key: 'customer' | 'amount') => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
          <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('customer')}>
            Customer {sortKey === 'customer' && (sortDir === 'asc' ? '↑' : '↓')}
          </TableHead>
          <TableHead
            className="cursor-pointer text-right select-none"
            onClick={() => toggleSort('amount')}
          >
            Amount {sortKey === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.customer}</TableCell>
            <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Table with Selection (for Variants)
function SelectableTable() {
  const data = [
    {
      id: 'INV-001',
      customer: i18n.t('table.story.johnDoe', 'John Doe'),
      status: i18n.t('table.story.paid', 'Paid'),
    },
    {
      id: 'INV-002',
      customer: i18n.t('table.story.janeSmith', 'Jane Smith'),
      status: i18n.t('table.story.pending', 'Pending'),
    },
    {
      id: 'INV-003',
      customer: i18n.t('table.story.bobJohnson', 'Bob Johnson'),
      status: i18n.t('table.story.failed', 'Failed'),
    },
  ];
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === data.length) setSelected(new Set());
    else setSelected(new Set(data.map((d) => d.id)));
  };
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-sm">
        Selected: {selected.size} of {data.length}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                checked={selected.size === data.length}
                onChange={toggleAll}
                className="size-4"
              />
            </TableHead>
            <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
            <TableHead>{i18n.t('table.story.status', 'Status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id} className={selected.has(row.id) ? 'bg-muted/50' : ''}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.has(row.id)}
                  onChange={() => toggleSelect(row.id)}
                  className="size-4"
                />
              </TableCell>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Table with Pagination (for Variants)
function PaginatedTable() {
  const allData = Array.from({ length: 12 }, (_, i) => ({
    id: `INV-${String(i + 1).padStart(3, '0')}`,
    customer: `Customer ${i + 1}`,
    amount: Math.floor(Math.random() * 500) + 50,
  }));
  const [page, setPage] = React.useState(0);
  const pageSize = 4;
  const totalPages = Math.ceil(allData.length / pageSize);
  const pageData = allData.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
            <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.story.amount', 'Amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Page {page + 1} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function VariantsDemo() {
  const { t } = useTranslation();

  const basicData = [
    { id: 'INV-001', customer: i18n.t('table.story.johnDoe', 'John Doe'), amount: '$250.00' },
    { id: 'INV-002', customer: i18n.t('table.story.janeSmith', 'Jane Smith'), amount: '$120.00' },
    { id: 'INV-003', customer: i18n.t('table.story.bobJohnson', 'Bob Johnson'), amount: '$340.00' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-sm font-medium">{t('table.variants.basic')}</p>
        <div className="w-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.story.invoice', 'Invoice')}</TableHead>
                <TableHead>{t('table.story.customer', 'Customer')}</TableHead>
                <TableHead className="text-right">{t('table.story.amount', 'Amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {basicData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell className="text-right">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('table.variants.withSorting')}</p>
        <div className="w-[500px]">
          <SortableTable />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('table.variants.withSelection')}</p>
        <div className="w-[550px]">
          <SelectableTable />
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t('table.variants.withPagination')}</p>
        <div className="w-[500px]">
          <PaginatedTable />
        </div>
      </div>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantsDemo />,
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll('[data-slot="table"]');
    expect(tables.length).toBe(4);
    const checkboxes = canvasElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(4); // 3 rows + 1 select-all
  },
};

function SizesDemo() {
  const data = [
    {
      id: 'INV-001',
      customer: i18n.t('table.story.johnDoe', 'John Doe'),
      status: i18n.t('table.story.paid', 'Paid'),
      amount: '$250.00',
    },
    {
      id: 'INV-002',
      customer: i18n.t('table.story.janeSmith', 'Jane Smith'),
      status: i18n.t('table.story.pending', 'Pending'),
      amount: '$120.00',
    },
    {
      id: 'INV-003',
      customer: i18n.t('table.story.bobJohnson', 'Bob Johnson'),
      status: i18n.t('table.story.failed', 'Failed'),
      amount: '$340.00',
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="mb-3 text-sm font-medium">{i18n.t('table.sizes.compact')}</p>
        <div className="w-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="py-1 text-xs">
                  {i18n.t('table.story.invoice', 'Invoice')}
                </TableHead>
                <TableHead className="py-1 text-xs">
                  {i18n.t('table.story.customer', 'Customer')}
                </TableHead>
                <TableHead className="py-1 text-xs">
                  {i18n.t('table.story.status', 'Status')}
                </TableHead>
                <TableHead className="py-1 text-right text-xs">
                  {i18n.t('table.story.amount', 'Amount')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className="h-8">
                  <TableCell className="py-1 text-xs font-medium">{row.id}</TableCell>
                  <TableCell className="py-1 text-xs">{row.customer}</TableCell>
                  <TableCell className="py-1 text-xs">{row.status}</TableCell>
                  <TableCell className="py-1 text-right text-xs">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{i18n.t('table.sizes.default')}</p>
        <div className="w-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{i18n.t('table.story.invoice', 'Invoice')}</TableHead>
                <TableHead>{i18n.t('table.story.customer', 'Customer')}</TableHead>
                <TableHead>{i18n.t('table.story.status', 'Status')}</TableHead>
                <TableHead className="text-right">
                  {i18n.t('table.story.amount', 'Amount')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="text-right">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{i18n.t('table.sizes.spacious')}</p>
        <div className="w-[700px]">
          <Table>
            <TableHeader>
              <TableRow className="h-14">
                <TableHead className="py-4 text-base">
                  {i18n.t('table.story.invoice', 'Invoice')}
                </TableHead>
                <TableHead className="py-4 text-base">
                  {i18n.t('table.story.customer', 'Customer')}
                </TableHead>
                <TableHead className="py-4 text-base">
                  {i18n.t('table.story.status', 'Status')}
                </TableHead>
                <TableHead className="py-4 text-right text-base">
                  {i18n.t('table.story.amount', 'Amount')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className="h-16">
                  <TableCell className="py-5 text-base font-medium">{row.id}</TableCell>
                  <TableCell className="py-5 text-base">{row.customer}</TableCell>
                  <TableCell className="py-5 text-base">{row.status}</TableCell>
                  <TableCell className="py-5 text-right text-base">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export const Sizes: Story = {
  render: () => <SizesDemo />,
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll('[data-slot="table"]');
    expect(tables.length).toBe(3);
  },
};

export const Dark: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    theme: 'dark',
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();

    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);

    const caption = canvasElement.querySelector('[data-slot="table-caption"]');
    expect(caption).toBeInTheDocument();
  },
};

export const RTL: Story = {
  ...Default,
  globals: {
    ...(Default.globals ?? {}),
    addonRtl: 'rtl',
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();

    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);

    // Verify the amount column has text-right alignment
    const amountCells = canvasElement.querySelectorAll('tbody [data-slot="table-cell"]:last-child');
    for (const cell of amountCells) {
      expect(cell).toBeInTheDocument();
    }
  },
};

export const Japanese: Story = {
  globals: {
    locale: 'ja',
  },
  render: () => <I18nTableDemo />,
  play: async (context) => {
    const doc = context.canvasElement.ownerDocument;
    expect(doc.documentElement.lang).toBe('ja');

    const caption = context.canvasElement.querySelector('[data-slot="table-caption"]');
    expect(caption).toHaveTextContent('最近の請求書の一覧です。');

    await Default.play?.(context);
  },
};

export const DesignReference: Story = {
  ...Default,
  tags: ['!test'],
  parameters: {
    ...(Default.parameters ?? {}),
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/LKQ4FJ4bTnCSjedbRpk931/Sample-File',
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const PseudoStates: Story = {
  ...Default,
  tags: ['!test'],
  name: i18n.t('table.storyName.pseudoStates', 'Pseudo States (hover / focus / active)'),
  decorators: [
    ...normalizeDecorators(Default.decorators),
    (Story) => (
      <div className="flex flex-wrap items-center gap-3">
        <div id="hover">
          <Story />
        </div>
        <div id="focus">
          <Story />
        </div>
        <div id="active">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    ...(Default.parameters ?? {}),
    pseudo: {
      hover: ['#hover *'],
      focusVisible: ['#focus *'],
      active: ['#active *'],
    },
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============ FAKER INTEGRATION STORIES ============

export const WithFakerData: Story = {
  render: () => <TableWithFakerData />,
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="table"]')).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
  },
};

// ============ MSW ASYNC DATA STORIES ============

export const WithAsyncData: Story = {
  parameters: {
    msw: { handlers: tableHandlers },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state first
    expect(canvasElement.querySelector('[data-testid="table-loading"]')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="table-success"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify table rendered with data
    const rows = canvasElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5);
  },
};

export const Loading: Story = {
  parameters: {
    msw: { handlers: tableStatusHandlers.loading },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading state persists
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(canvasElement.querySelector('[data-testid="table-loading"]')).toBeInTheDocument();
  },
};

export const EmptyData: Story = {
  parameters: {
    msw: { handlers: tableStatusHandlers.emptyData },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="table-empty"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (4xx) ============

export const Error400BadRequest: Story = {
  name: i18n.t('table.storyName.error400BadRequest', 'Error 400: Bad Request'),
  parameters: {
    msw: { handlers: tableStatusHandlers.badRequest },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="400"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error401Unauthorized: Story = {
  name: i18n.t('table.storyName.error401Unauthorized', 'Error 401: Unauthorized'),
  parameters: {
    msw: { handlers: tableStatusHandlers.unauthorized },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="401"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error403Forbidden: Story = {
  name: i18n.t('table.storyName.error403Forbidden', 'Error 403: Forbidden'),
  parameters: {
    msw: { handlers: tableStatusHandlers.forbidden },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="403"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error429RateLimit: Story = {
  name: i18n.t('table.storyName.error429RateLimit', 'Error 429: Rate Limit'),
  parameters: {
    msw: { handlers: tableStatusHandlers.tooManyRequests },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="429"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ HTTP STATUS CODE STORIES (5xx) ============

export const Error422UnprocessableEntity: Story = {
  parameters: {
    msw: { handlers: tableStatusHandlers.unprocessableEntity },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="422"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error500InternalServerError: Story = {
  name: i18n.t('table.storyName.error500InternalServerError', 'Error 500: Internal Server Error'),
  parameters: {
    msw: { handlers: tableStatusHandlers.internalServerError },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="500"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error502BadGateway: Story = {
  name: i18n.t('table.storyName.error502BadGateway', 'Error 502: Bad Gateway'),
  parameters: {
    msw: { handlers: tableStatusHandlers.badGateway },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="502"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error503ServiceUnavailable: Story = {
  name: i18n.t('table.storyName.error503ServiceUnavailable', 'Error 503: Service Unavailable'),
  parameters: {
    msw: { handlers: tableStatusHandlers.serviceUnavailable },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="503"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const Error504GatewayTimeout: Story = {
  name: i18n.t('table.storyName.error504GatewayTimeout', 'Error 504: Gateway Timeout'),
  parameters: {
    msw: { handlers: tableStatusHandlers.gatewayTimeout },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-error-status="504"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

// ============ SPECIAL STATE STORIES ============

export const SlowResponse: Story = {
  name: i18n.t('table.storyName.slowResponse', 'Slow Response (3-5s)'),
  parameters: {
    msw: { handlers: tableStatusHandlers.slowResponse },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    // Verify loading shows first
    expect(canvasElement.querySelector('[data-testid="table-loading"]')).toBeInTheDocument();
    // Wait for data (slow response takes 5s)
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="table-success"]')).toBeInTheDocument();
      },
      { timeout: 7000 }
    );
  },
};

export const NetworkError: Story = {
  name: i18n.t('table.storyName.networkError', 'Network Error'),
  parameters: {
    msw: { handlers: tableStatusHandlers.networkError },
  },
  render: () => <TableWithAsyncData />,
  play: async ({ canvasElement }) => {
    await waitFor(
      () => {
        expect(canvasElement.querySelector('[data-testid="table-error"]')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  },
};

export const WithMswHandlers: Story = {
  ...Default,
  parameters: {
    msw: { handlers: tableHandlers },
  },
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();

    const headerCells = canvasElement.querySelectorAll('thead [data-slot="table-head"]');
    expect(headerCells.length).toBe(4);

    const bodyRows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(bodyRows.length).toBe(3);
  },
};

// ============ ACCESSIBILITY STORY ============

export const Accessibility: Story = {
  name: i18n.t('table.storyName.accessibility', 'Accessibility'),
  play: async ({ canvasElement }) => {
    // Verify table has proper ARIA attributes
    const table = canvasElement.querySelector('table');
    expect(table).toBeInTheDocument();

    // Verify table headers exist
    const headers = canvasElement.querySelectorAll('th');
    expect(headers.length).not.toBe(0);

    // Verify all headers have scope attribute or are properly associated
    for (const header of headers) {
      expect(header.tagName).toBe('TH');
    }

    // Verify table body exists
    const tbody = canvasElement.querySelector('tbody');
    expect(tbody).toBeInTheDocument();

    // Verify table cells exist
    const cells = canvasElement.querySelectorAll('td');
    expect(cells.length).not.toBe(0);

    // Test keyboard navigation - focus on first interactive element
    const firstLink = canvasElement.querySelector('a, button');
    if (firstLink instanceof HTMLElement) {
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);

      // Tab to next element
      await userEvent.tab();
      expect(document.activeElement).not.toBe(firstLink);
    }

    // Verify data-slot attributes for component identification
    const tableContainer = canvasElement.querySelector('[data-slot="table"]');
    expect(tableContainer).toBeInTheDocument();
  },
};

// ============ FACTORY: SINGLE ITEM FACTORIES ============

function FactoryTableRowDemo() {
  const row = React.useMemo(() => createFakeTableRow(), []);
  return (
    <div className="w-[800px]">
      <Table>
        <TableCaption>{i18n.t('table.factory.statusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.id')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.priority')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">{row.id.slice(0, 8)}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.email}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.priority}</TableCell>
            <TableCell className="text-right">
              ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTableRow: Story = {
  name: i18n.t('table.storyName.factoryTableRow', 'Factory: Table Row'),
  render: () => <FactoryTableRowDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(1);
    const cells = canvasElement.querySelectorAll('tbody [data-slot="table-cell"]');
    expect(cells.length).toBe(6);
  },
};

function FactoryTableColumnsDemo() {
  const columns = React.useMemo(() => createFakeTableColumns(6), []);
  return (
    <div className="w-[800px]">
      <Table>
        <TableCaption>{i18n.t('table.factory.tableConfig.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.id')}</TableHead>
            <TableHead>{i18n.t('table.story.header', 'Header')}</TableHead>
            <TableHead>{i18n.t('table.story.accessor', 'Accessor')}</TableHead>
            <TableHead>{i18n.t('table.story.align', 'Align')}</TableHead>
            <TableHead>{i18n.t('table.story.sortable', 'Sortable')}</TableHead>
            <TableHead>{i18n.t('table.story.format', 'Format')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((col) => (
            <TableRow key={col.id}>
              <TableCell className="font-medium">{col.id.slice(0, 8)}</TableCell>
              <TableCell>{col.header}</TableCell>
              <TableCell>{col.accessor}</TableCell>
              <TableCell>{col.align}</TableCell>
              <TableCell>
                {col.sortable ? i18n.t('table.story.yes', 'Yes') : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>{col.format}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTableColumns: Story = {
  name: i18n.t('table.storyName.factoryTableColumns', 'Factory: Table Columns'),
  render: () => <FactoryTableColumnsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(6);
  },
};

function FactoryTableDataDemo() {
  const rows = React.useMemo(() => createFakeTableData(5), []);

  return (
    <div className="w-[800px]">
      <Table>
        <TableCaption>{i18n.t('table.factory.statusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.priority')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row: FakeTableRow) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.priority}</TableCell>
              <TableCell className="text-right">
                ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTableData: Story = {
  name: i18n.t('table.storyName.factoryTableData', 'Factory: Table Data (Bulk)'),
  render: () => <FactoryTableDataDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryOrdersDemo() {
  const orders = React.useMemo(() => createFakeOrders(5), []);
  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.orders')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.orders.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.orderNumber')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.customer')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.paymentStatus')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.shippingMethod')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.orderNumber}</TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>{order.status}</TableCell>
              <TableCell>{order.paymentStatus}</TableCell>
              <TableCell>{order.shippingMethod}</TableCell>
              <TableCell className="text-right">
                ${order.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryOrders: Story = {
  name: i18n.t('table.storyName.factoryOrders', 'Factory: Orders'),
  render: () => <FactoryOrdersDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
    const headers = canvasElement.querySelectorAll('thead [data-slot="table-head"]');
    expect(headers.length).toBe(6);
  },
};

function FactoryProductsDemo() {
  const products = React.useMemo(() => createFakeProducts(5), []);
  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.products')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.products.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.sku')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.category')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.inventory')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.price')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.sku}</TableCell>
              <TableCell>{product.category}</TableCell>
              <TableCell>{product.status}</TableCell>
              <TableCell>{product.inventory}</TableCell>
              <TableCell className="text-right">
                ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryProducts: Story = {
  name: i18n.t('table.storyName.factoryProducts', 'Factory: Products'),
  render: () => <FactoryProductsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryUsersDemo() {
  const users = React.useMemo(() => createFakeUserTableRows(5), []);
  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.users')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.users.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.role')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.department')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.lastActive')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>{user.department}</TableCell>
              <TableCell>{user.status}</TableCell>
              <TableCell>{new Date(user.lastActiveAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryUsers: Story = {
  name: i18n.t('table.storyName.factoryUsers', 'Factory: Users'),
  render: () => <FactoryUsersDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryTransactionsDemo() {
  const transactions = React.useMemo(() => createFakeTransactions(5), []);
  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.transactions')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.transactions.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.reference')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.type')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.method')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.fee')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.net')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{tx.reference}</TableCell>
              <TableCell>{tx.type}</TableCell>
              <TableCell>{tx.status}</TableCell>
              <TableCell>{tx.method}</TableCell>
              <TableCell className="text-right">
                ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right">
                ${tx.fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right">
                ${tx.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTransactions: Story = {
  name: i18n.t('table.storyName.factoryTransactions', 'Factory: Transactions'),
  render: () => <FactoryTransactionsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
    const headers = canvasElement.querySelectorAll('thead [data-slot="table-head"]');
    expect(headers.length).toBe(7);
  },
};

function FactoryInvoicesWithSingleDemo() {
  const invoice = React.useMemo(() => createFakeInvoice(), []);
  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.invoiceStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.invoiceStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.invoiceNumber')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.customer')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.items')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.subtotal')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.tax')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
            <TableCell>{invoice.customer}</TableCell>
            <TableCell>{invoice.status}</TableCell>
            <TableCell>{invoice.items}</TableCell>
            <TableCell>${invoice.subtotal.toFixed(2)}</TableCell>
            <TableCell>${invoice.tax.toFixed(2)}</TableCell>
            <TableCell className="text-right">${invoice.amount.toFixed(2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryInvoiceSingle: Story = {
  name: i18n.t('table.storyName.factoryInvoiceSingle', 'Factory: Invoice (Single)'),
  render: () => <FactoryInvoicesWithSingleDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(1);
  },
};

// ============ FACTORY: DATA GRID ============

function FactoryDataGridDemo() {
  const gridRows = React.useMemo(() => createFakeDataGridRows(5, 4), []);
  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.dataGrid')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.dataGrid.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.value')} 1</TableHead>
            <TableHead>{i18n.t('table.factory.head.value')} 2</TableHead>
            <TableHead>{i18n.t('table.factory.head.value')} 3</TableHead>
            <TableHead>{i18n.t('table.factory.head.value')} 4</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gridRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.status}</TableCell>
              {row.cells.map((cell) => (
                <TableCell key={cell.id}>{String(cell.value ?? '-')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryDataGrid: Story = {
  name: i18n.t('table.storyName.factoryDataGrid', 'Factory: Data Grid'),
  render: () => <FactoryDataGridDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============ FACTORY: BULK ACTIONS & EXPORT ============

function FactoryBulkActionsDemo() {
  const actions = React.useMemo(() => createFakeBulkActions(5), []);
  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.bulkActions')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.bulkActions.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.label')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.dangerous')}</TableHead>
            <TableHead>
              {i18n.t('table.story.requiresConfirmation', 'Requires Confirmation')}
            </TableHead>
            <TableHead>{i18n.t('table.story.disabled', 'Disabled')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => (
            <TableRow key={action.id}>
              <TableCell className="font-medium">{action.label}</TableCell>
              <TableCell>
                {action.dangerous
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>
                {action.requiresConfirmation
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>
                {action.disabled
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryBulkActions: Story = {
  name: i18n.t('table.storyName.factoryBulkActions', 'Factory: Bulk Actions'),
  render: () => <FactoryBulkActionsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryExportConfigDemo() {
  const configs = React.useMemo(
    () =>
      (['csv', 'xlsx', 'pdf', 'json'] as const).map((fmt) =>
        createFakeExportConfig({ format: fmt })
      ),
    []
  );
  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.exportConfig')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.exportConfig.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.format')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.filename')}</TableHead>
            <TableHead>{i18n.t('table.story.includeHeaders', 'Include Headers')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.selectedOnly')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((config) => (
            <TableRow key={config.id}>
              <TableCell className="font-medium">{config.format.toUpperCase()}</TableCell>
              <TableCell>{config.filename}</TableCell>
              <TableCell>
                {config.includeHeaders
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>
                {config.selectedOnly
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryExportConfig: Story = {
  name: i18n.t('table.storyName.factoryExportConfig', 'Factory: Export Config'),
  render: () => <FactoryExportConfigDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(4);
  },
};

// ============ FACTORY: PAGINATION ============

function FactoryPaginationDemo() {
  const pagination = React.useMemo(() => createFakePagination(), []);
  const firstPage = React.useMemo(() => createFakeFirstPagePagination(), []);
  const lastPage = React.useMemo(() => createFakeLastPagePagination(), []);
  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.pagination')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.pagination.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.state', 'State')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.page')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.limit')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.totalPages')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.hasNext')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.hasPrev')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { label: 'Default', pg: pagination },
            { label: 'First Page', pg: firstPage },
            { label: 'Last Page', pg: lastPage },
          ].map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.pg.page}</TableCell>
              <TableCell>{item.pg.limit}</TableCell>
              <TableCell>{item.pg.totalPages}</TableCell>
              <TableCell>
                {item.pg.hasNext
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>
                {item.pg.hasPrev
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryPagination: Story = {
  name: i18n.t('table.storyName.factoryPagination', 'Factory: Pagination'),
  render: () => <FactoryPaginationDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: TABLE CONFIG ============

function FactoryTableConfigDemo() {
  const config = React.useMemo(() => createFakeTableConfig(), []);
  const compact = React.useMemo(() => createFakeCompactTableConfig(), []);
  const comfortable = React.useMemo(() => createFakeComfortableTableConfig(), []);
  const striped = React.useMemo(() => createFakeStripedTableConfig(), []);
  const selectable = React.useMemo(() => createFakeSelectableTableConfig(), []);
  const configs = [
    { label: 'Default', cfg: config },
    { label: 'Compact', cfg: compact },
    { label: 'Comfortable', cfg: comfortable },
    { label: 'Striped', cfg: striped },
    { label: 'Selectable', cfg: selectable },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.tableConfig')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.tableConfig.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.config', 'Config')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.density')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.selectionMode')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.striped')}</TableHead>
            <TableHead>{i18n.t('table.story.columns', 'Columns')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configs.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.cfg.density}</TableCell>
              <TableCell>{item.cfg.selectionMode}</TableCell>
              <TableCell>
                {item.cfg.striped
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>{item.cfg.columns.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTableConfig: Story = {
  name: i18n.t('table.storyName.factoryTableConfig', 'Factory: Table Config'),
  render: () => <FactoryTableConfigDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============ FACTORY: SORT & FILTER ============

function FactorySortFilterDemo() {
  const sort = React.useMemo(() => createFakeTableSort(), []);
  const filters = React.useMemo(() => Array.from({ length: 3 }, () => createFakeTableFilter()), []);
  return (
    <div className="w-[800px]">
      <div className="mb-4">
        <p className="mb-2 text-sm font-medium">
          {i18n.t('table.story.currentSort', 'Current Sort')}
        </p>
        <Table>
          <TableCaption>
            Sort: {sort.column} ({sort.direction})
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t('table.story.column', 'Column')}</TableHead>
              <TableHead>{i18n.t('table.story.direction', 'Direction')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">{sort.column}</TableCell>
              <TableCell>{sort.direction}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('table.story.activeFilters', 'Active Filters')}
        </p>
        <Table>
          <TableCaption>{i18n.t('table.factory.tableConfig.caption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t('table.story.column', 'Column')}</TableHead>
              <TableHead>{i18n.t('table.story.operator', 'Operator')}</TableHead>
              <TableHead>{i18n.t('table.factory.head.value')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filters.map((filter) => (
              <TableRow key={filter.id}>
                <TableCell className="font-medium">{filter.column}</TableCell>
                <TableCell>{filter.operator}</TableCell>
                <TableCell>{String(filter.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export const FactorySortFilter: Story = {
  name: i18n.t('table.storyName.factorySortFilter', 'Factory: Sort & Filter'),
  render: () => <FactorySortFilterDemo />,
  play: async ({ canvasElement }) => {
    const tables = canvasElement.querySelectorAll('[data-slot="table"]');
    expect(tables.length).toBe(2);
  },
};

// ============ FACTORY: TABLE RESPONSE ============

function FactoryTableResponseDemo() {
  const response = React.useMemo(() => createFakeTableResponse(5), []);
  const emptyResponse = React.useMemo(() => createFakeEmptyTableResponse(), []);
  const singlePageResponse = React.useMemo(() => createFakeSinglePageTableResponse(3), []);
  return (
    <div className="flex w-[800px] flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-medium">Standard Response ({response.data.length} rows)</p>
        <Table>
          <TableCaption>
            Page {response.pagination.page} of {response.pagination.totalPages}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
              <TableHead>{i18n.t('table.head.status')}</TableHead>
              <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {response.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('table.factory.emptyResponse')} ({emptyResponse.data.length} rows)
        </p>
        <p className="text-muted-foreground text-sm">Total: {emptyResponse.pagination.total}</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">
          {i18n.t('table.factory.singlePageResponse')} ({singlePageResponse.data.length} rows)
        </p>
        <p className="text-muted-foreground text-sm">
          Has Next:{' '}
          {singlePageResponse.pagination.hasNext
            ? i18n.t('table.story.yes', 'Yes')
            : i18n.t('table.story.no', 'No')}
        </p>
      </div>
    </div>
  );
}

export const FactoryTableResponse: Story = {
  name: i18n.t('table.storyName.factoryTableResponse', 'Factory: Table Response'),
  render: () => <FactoryTableResponseDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============ FACTORY: SPECIALIZED ROWS ============

function FactorySpecializedRowsDemo() {
  const activeRow = React.useMemo(() => createFakeActiveTableRow(), []);
  const inactiveRow = React.useMemo(() => createFakeInactiveTableRow(), []);
  const pendingRow = React.useMemo(() => createFakePendingTableRow(), []);
  const highPriorityRow = React.useMemo(() => createFakeHighPriorityTableRow(), []);
  const criticalRow = React.useMemo(() => createFakeCriticalTableRow(), []);

  const rows = [
    { label: 'Active', row: activeRow },
    { label: 'Inactive', row: inactiveRow },
    { label: i18n.t('table.story.pending', 'Pending'), row: pendingRow },
    { label: 'High Priority', row: highPriorityRow },
    { label: 'Critical', row: criticalRow },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedRows')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedRows.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.priority')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.row.name}</TableCell>
              <TableCell>{item.row.status}</TableCell>
              <TableCell>{item.row.priority}</TableCell>
              <TableCell className="text-right">${item.row.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedRows: Story = {
  name: i18n.t('table.storyName.factorySpecializedRows', 'Factory: Specialized Rows'),
  render: () => <FactorySpecializedRowsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============ FACTORY: SPECIALIZED INVOICES ============

function FactorySpecializedInvoicesDemo() {
  const paid = React.useMemo(() => createFakePaidInvoice(), []);
  const overdue = React.useMemo(() => createFakeOverdueInvoice(), []);
  const draft = React.useMemo(() => createFakeDraftInvoice(), []);

  const invoices = [
    { label: i18n.t('table.story.paid', 'Paid'), inv: paid },
    { label: 'Overdue', inv: overdue },
    { label: 'Draft', inv: draft },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedInvoices')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedInvoices.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.invoiceNumber')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.currency')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.inv.invoiceNumber}</TableCell>
              <TableCell>{item.inv.status}</TableCell>
              <TableCell>{item.inv.currency}</TableCell>
              <TableCell className="text-right">${item.inv.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedInvoices: Story = {
  name: i18n.t('table.storyName.factorySpecializedInvoices', 'Factory: Specialized Invoices'),
  render: () => <FactorySpecializedInvoicesDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: SPECIALIZED ORDERS ============

function FactorySpecializedOrdersDemo() {
  const pending = React.useMemo(() => createFakePendingOrder(), []);
  const shipped = React.useMemo(() => createFakeShippedOrder(), []);
  const delivered = React.useMemo(() => createFakeDeliveredOrder(), []);
  const cancelled = React.useMemo(() => createFakeCancelledOrder(), []);

  const orders = [
    { label: i18n.t('table.story.pending', 'Pending'), ord: pending },
    { label: 'Shipped', ord: shipped },
    { label: 'Delivered', ord: delivered },
    { label: 'Cancelled', ord: cancelled },
  ];

  return (
    <div className="w-[900px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedOrders')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedOrders.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.orderNumber')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.paymentStatus')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.fulfillment')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.ord.orderNumber}</TableCell>
              <TableCell>{item.ord.status}</TableCell>
              <TableCell>{item.ord.paymentStatus}</TableCell>
              <TableCell>{item.ord.fulfillmentStatus}</TableCell>
              <TableCell className="text-right">${item.ord.total.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedOrders: Story = {
  name: i18n.t('table.storyName.factorySpecializedOrders', 'Factory: Specialized Orders'),
  render: () => <FactorySpecializedOrdersDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(4);
  },
};

// ============ FACTORY: SPECIALIZED PRODUCTS ============

function FactorySpecializedProductsDemo() {
  const active = React.useMemo(() => createFakeActiveProduct(), []);
  const outOfStock = React.useMemo(() => createFakeOutOfStockProduct(), []);
  const draftProduct = React.useMemo(() => createFakeDraftProduct(), []);

  const products = [
    { label: 'Active', prod: active },
    { label: 'Out of Stock', prod: outOfStock },
    { label: 'Draft', prod: draftProduct },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedProducts')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedProducts.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.inventory')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.price')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.prod.name}</TableCell>
              <TableCell>{item.prod.status}</TableCell>
              <TableCell>{item.prod.inventory}</TableCell>
              <TableCell className="text-right">${item.prod.price.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedProducts: Story = {
  name: i18n.t('table.storyName.factorySpecializedProducts', 'Factory: Specialized Products'),
  render: () => <FactorySpecializedProductsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: SPECIALIZED USERS ============

function FactorySpecializedUsersDemo() {
  const activeUser = React.useMemo(() => createFakeActiveUserRow(), []);
  const suspended = React.useMemo(() => createFakeSuspendedUserRow(), []);
  const pendingUser = React.useMemo(() => createFakePendingUserRow(), []);

  const users = [
    { label: 'Active', user: activeUser },
    { label: 'Suspended', user: suspended },
    { label: i18n.t('table.story.pending', 'Pending'), user: pendingUser },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedUsers')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedUsers.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.role')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.user.name}</TableCell>
              <TableCell>{item.user.email}</TableCell>
              <TableCell>{item.user.status}</TableCell>
              <TableCell>{item.user.role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedUsers: Story = {
  name: i18n.t('table.storyName.factorySpecializedUsers', 'Factory: Specialized Users'),
  render: () => <FactorySpecializedUsersDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: SPECIALIZED TRANSACTIONS ============

function FactorySpecializedTransactionsDemo() {
  const completed = React.useMemo(() => createFakeCompletedTransaction(), []);
  const failed = React.useMemo(() => createFakeFailedTransaction(), []);
  const refund = React.useMemo(() => createFakeRefundTransaction(), []);

  const transactions = [
    { label: 'Completed', tx: completed },
    { label: i18n.t('table.story.failed', 'Failed'), tx: failed },
    { label: 'Refund', tx: refund },
  ];

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.specializedTransactions')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.specializedTransactions.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.story.variant', 'Variant')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.reference')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.type')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium">{item.label}</TableCell>
              <TableCell>{item.tx.reference}</TableCell>
              <TableCell>{item.tx.status}</TableCell>
              <TableCell>{item.tx.type}</TableCell>
              <TableCell className="text-right">${item.tx.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySpecializedTransactions: Story = {
  name: i18n.t(
    'table.storyName.factorySpecializedTransactions',
    'Factory: Specialized Transactions'
  ),
  render: () => <FactorySpecializedTransactionsDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: MATRIX STORIES ============

function FactoryRowStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTableRowStatusMatrix(), []);
  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.statusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.statusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, row]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryRowStatusMatrix: Story = {
  name: i18n.t('table.storyName.factoryRowStatusMatrix', 'Factory: Row Status Matrix'),
  render: () => <FactoryRowStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

function FactoryPriorityMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTableRowPriorityMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.priorityMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.priorityMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.priority')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([priority, row]) => (
            <TableRow key={priority}>
              <TableCell className="font-medium">{priority}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryPriorityMatrix: Story = {
  name: i18n.t('table.storyName.factoryPriorityMatrix', 'Factory: Priority Matrix'),
  render: () => <FactoryPriorityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryInvoiceStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeInvoiceStatusMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.invoiceStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.invoiceStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.invoiceNumber')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.customer')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, inv]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{inv.invoiceNumber}</TableCell>
              <TableCell>{inv.customer}</TableCell>
              <TableCell className="text-right">${inv.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryInvoiceStatusMatrix: Story = {
  name: i18n.t('table.storyName.factoryInvoiceStatusMatrix', 'Factory: Invoice Status Matrix'),
  render: () => <FactoryInvoiceStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(6);
  },
};

function FactoryOrderStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeOrderStatusMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.orderStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.orderStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.orderNumber')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.customer')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, ord]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{ord.orderNumber}</TableCell>
              <TableCell>{ord.customer}</TableCell>
              <TableCell className="text-right">${ord.total.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryOrderStatusMatrix: Story = {
  name: i18n.t('table.storyName.factoryOrderStatusMatrix', 'Factory: Order Status Matrix'),
  render: () => <FactoryOrderStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(7);
  },
};

function FactoryProductStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeProductStatusMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.productStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.productStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.category')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.factory.head.price')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, prod]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{prod.name}</TableCell>
              <TableCell>{prod.category}</TableCell>
              <TableCell className="text-right">${prod.price.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryProductStatusMatrix: Story = {
  name: i18n.t('table.storyName.factoryProductStatusMatrix', 'Factory: Product Status Matrix'),
  render: () => <FactoryProductStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryUserStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeUserTableStatusMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.userStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.userStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.email')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.department')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, user]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.department}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryUserStatusMatrix: Story = {
  name: i18n.t('table.storyName.factoryUserStatusMatrix', 'Factory: User Status Matrix'),
  render: () => <FactoryUserStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

function FactoryTransactionStatusMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTransactionStatusMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.transactionStatusMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.transactionStatusMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.reference')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.type')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([status, tx]) => (
            <TableRow key={status}>
              <TableCell className="font-medium">{status}</TableCell>
              <TableCell>{tx.reference}</TableCell>
              <TableCell>{tx.type}</TableCell>
              <TableCell className="text-right">${tx.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryTransactionStatusMatrix: Story = {
  name: i18n.t(
    'table.storyName.factoryTransactionStatusMatrix',
    'Factory: Transaction Status Matrix'
  ),
  render: () => <FactoryTransactionStatusMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(6);
  },
};

function FactoryDensityMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTableDensityMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.densityMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.densityMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.density')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.selectionMode')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.striped')}</TableHead>
            <TableHead>{i18n.t('table.story.columns', 'Columns')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([density, cfg]) => (
            <TableRow key={density}>
              <TableCell className="font-medium">{density}</TableCell>
              <TableCell>{cfg.selectionMode}</TableCell>
              <TableCell>
                {cfg.striped ? i18n.t('table.story.yes', 'Yes') : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>{cfg.columns.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryDensityMatrix: Story = {
  name: i18n.t('table.storyName.factoryDensityMatrix', 'Factory: Density Matrix'),
  render: () => <FactoryDensityMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

function FactorySelectionModeMatrixDemo() {
  const matrix = React.useMemo(() => createFakeTableSelectionModeMatrix(), []);

  return (
    <div className="w-[800px]">
      <p className="mb-2 text-sm font-medium">{i18n.t('table.factory.selectionModeMatrix')}</p>
      <Table>
        <TableCaption>{i18n.t('table.factory.selectionModeMatrix.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.selectionMode')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.density')}</TableHead>
            <TableHead>{i18n.t('table.story.rowSelection', 'Row Selection')}</TableHead>
            <TableHead>{i18n.t('table.story.columns', 'Columns')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(matrix).map(([mode, cfg]) => (
            <TableRow key={mode}>
              <TableCell className="font-medium">{mode}</TableCell>
              <TableCell>{cfg.density}</TableCell>
              <TableCell>
                {cfg.enableRowSelection
                  ? i18n.t('table.story.yes', 'Yes')
                  : i18n.t('table.story.no', 'No')}
              </TableCell>
              <TableCell>{cfg.columns.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactorySelectionModeMatrix: Story = {
  name: i18n.t('table.storyName.factorySelectionModeMatrix', 'Factory: Selection Mode Matrix'),
  render: () => <FactorySelectionModeMatrixDemo />,
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(3);
  },
};

// ============ FACTORY: COMPLETE DEMO DATA ============

function FactoryDemoDataDemo() {
  const demo = React.useMemo(() => createFakeTableDemoData(), []);

  return (
    <div className="flex w-[900px] flex-col gap-6">
      <p className="text-sm font-medium">{i18n.t('table.factory.demoData')}</p>
      <div>
        <p className="text-muted-foreground mb-1 text-xs">
          Rows: {demo.rows.length} | Invoices: {demo.invoices.length} | Orders: {demo.orders.length}{' '}
          | Products: {demo.products.length} | Users: {demo.users.length} | Transactions:{' '}
          {demo.transactions.length}
        </p>
        <p className="text-muted-foreground mb-2 text-xs">
          Sort: {demo.sort.column} ({demo.sort.direction}) | Filters: {demo.filters.length} | Bulk
          Actions: {demo.bulkActions.length} | Export: {demo.exportConfig.format}
        </p>
      </div>
      <Table>
        <TableCaption>{i18n.t('table.factory.demoData.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n.t('table.factory.head.name')}</TableHead>
            <TableHead>{i18n.t('table.head.status')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.priority')}</TableHead>
            <TableHead>{i18n.t('table.factory.head.category')}</TableHead>
            <TableHead className="text-right">{i18n.t('table.head.amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {demo.rows.slice(0, 5).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{row.priority}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="text-right">${row.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const FactoryDemoData: Story = {
  name: i18n.t('table.storyName.factoryDemoData', 'Factory: Complete Demo Data'),
  render: () => <FactoryDemoDataDemo />,
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('[data-slot="table"]');
    expect(table).toBeInTheDocument();
    const rows = canvasElement.querySelectorAll('tbody [data-slot="table-row"]');
    expect(rows.length).toBe(5);
  },
};

// ============================================================================
// FACTORY CATALOG REFERENCE
// Available factory functions for additional story coverage:
//   createFakeOrderItem
//   createFakeAddress
//   createFakeProductVariant
//   createFakeDataGridCell
// ============================================================================

export const DarkRTL: Story = {
  ...Default,
  name: i18n.t('table.storyName.darkRTL', 'Dark Mode + RTL'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', addonRtl: 'rtl' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DarkJapanese: Story = {
  ...Default,
  name: i18n.t('table.storyName.darkJapanese', 'Dark Mode + Japanese'),
  globals: { ...(Default.globals ?? {}), theme: 'dark', locale: 'ja' },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  ...Default,
  name: i18n.t('table.storyName.mobile', 'Mobile Viewport'),
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

export const DataAttributes: Story = {
  ...Default,
  name: i18n.t('table.storyName.dataAttributes', 'Data Attributes'),
  play: async ({ canvasElement }) => {
    expect(canvasElement.firstElementChild).toBeInTheDocument();
  },
};

// ============================================================================
// HANDLER STATUS KEYS CATALOG
// Available MSW handler status keys for error/edge-case stories:
//   created
//   notFound
//   conflict
//   partialData
// ============================================================================

export const HandlerSuccess: Story = {
  ...Default,
  name: i18n.t('table.storyName.handlerSuccess', 'Handler: Success'),
  parameters: { msw: { handlers: tableStatusHandlers.success } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/./)).toBeInTheDocument();
  },
};
