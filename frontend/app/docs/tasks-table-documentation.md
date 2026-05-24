# Tasks Table System Documentation

> A comprehensive TanStack Table implementation with Tailwind CSS styling for
> task/issue tracking

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Data Schema](#data-schema)
- [Component Reference](#component-reference)
- [Tailwind CSS Classes Reference](#tailwind-css-classes-reference)
- [Feature Breakdown](#feature-breakdown)
- [Usage Examples](#usage-examples)

---

## Overview

The Tasks Table is a full-featured data table built with:

| Technology            | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| **TanStack Table v8** | Headless table logic (sorting, filtering, pagination) |
| **Tailwind CSS**      | Styling with utility classes                          |
| **Zod**               | Runtime schema validation                             |
| **Lucide React**      | Icon system                                           |
| **Radix UI**          | Accessible primitives (Popover, Dropdown, Command)    |

**Route:** `/dashboard/apps/tasks`

---

## Architecture

```
app/dashboard/(auth)/apps/tasks/
├── page.tsx                           # Server Component - data fetching
├── components/
│   ├── data-table.tsx                 # Main table container
│   ├── columns.tsx                    # Column definitions
│   ├── data-table-toolbar.tsx         # Search + filters + actions
│   ├── data-table-pagination.tsx      # Pagination controls
│   ├── data-table-column-header.tsx   # Sortable column headers
│   ├── data-table-faceted-filter.tsx  # Multi-select filter dropdowns
│   ├── data-table-row-actions.tsx     # Row action menu
│   └── data-table-view-options.tsx    # Column visibility toggle
└── data/
    ├── schema.ts                      # Zod schema + TypeScript types
    ├── data.tsx                       # Static filter options with icons
    └── tasks.json                     # Sample data (100 tasks)
```

---

## Data Schema

### Task Schema (`data/schema.ts`)

```typescript
import { z } from 'zod';

export const taskSchema = z.object({
  id: z.string(), // Format: "TASK-XXXX"
  title: z.string(), // Task description
  status: z.string(), // "backlog" | "todo" | "in progress" | "done" | "canceled"
  label: z.string(), // "bug" | "feature" | "documentation"
  priority: z.string(), // "low" | "medium" | "high"
});

export type Task = z.infer<typeof taskSchema>;
```

### Sample Task Data

```json
{
  "id": "TASK-8782",
  "title": "You can't compress the program without quantifying the open-source SSD pixel!",
  "status": "in progress",
  "label": "documentation",
  "priority": "medium"
}
```

### Filter Options (`data/data.tsx`)

| Category       | Values                                     | Icons                                             |
| -------------- | ------------------------------------------ | ------------------------------------------------- |
| **Labels**     | bug, feature, documentation                | —                                                 |
| **Statuses**   | backlog, todo, in progress, done, canceled | HelpCircle, Circle, Timer, CheckCircle, CircleOff |
| **Priorities** | low, medium, high                          | ArrowDown, ArrowRight, ArrowUp                    |

---

## Component Reference

### 1. DataTable (`data-table.tsx`)

**Purpose:** Main container orchestrating all table features

**Props:**

```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}
```

**State Management:**

```typescript
const [rowSelection, setRowSelection] = useState({});
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [sorting, setSorting] = useState<SortingState>([]);
```

**TanStack Table Configuration:**

```typescript
const table = useReactTable({
  data,
  columns,
  state: { sorting, columnVisibility, rowSelection, columnFilters },
  initialState: { pagination: { pageSize: 25 } },
  enableRowSelection: true,
  // Row models for features
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
});
```

**Tailwind Structure:**

```tsx
<div className="flex flex-col gap-4">
  <DataTableToolbar table={table} />
  <div className="rounded-md border">
    <Table>...</Table>
  </div>
  <DataTablePagination table={table} />
</div>
```

---

### 2. Column Definitions (`columns.tsx`)

**6 Columns Defined:**

| Column   | Key        | Sortable | Hideable | Filter      |
| -------- | ---------- | -------- | -------- | ----------- |
| Select   | `select`   | No       | No       | —           |
| Task ID  | `id`       | No       | No       | —           |
| Title    | `title`    | Yes      | Yes      | Text search |
| Status   | `status`   | Yes      | Yes      | Faceted     |
| Priority | `priority` | Yes      | Yes      | Faceted     |
| Actions  | `actions`  | No       | No       | —           |

**Select Column (Checkbox):**

```tsx
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected() ||
               (table.getIsSomePageRowsSelected() && 'indeterminate')}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
      className="translate-y-[2px]"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
      className="translate-y-[2px]"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

**Title Column with Label Badge:**

```tsx
{
  accessorKey: 'title',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
  cell: ({ row }) => {
    const label = labels.find((item) => item.value === row.original.label);
    return (
      <div className="flex gap-2">
        {label && <Badge variant="outline">{label.label}</Badge>}
        <span className="max-w-[500px] truncate font-medium">
          {row.getValue('title')}
        </span>
      </div>
    );
  },
}
```

**Status Column with Icon:**

```tsx
{
  accessorKey: 'status',
  cell: ({ row }) => {
    const status = statuses.find((item) => item.value === row.getValue('status'));
    return (
      <div className="flex w-[100px] items-center gap-2">
        {status.icon && <status.icon className="text-muted-foreground size-4" />}
        <span>{status.label}</span>
      </div>
    );
  },
  filterFn: (row, id, value) => value.includes(row.getValue(id)),
}
```

---

### 3. DataTableToolbar (`data-table-toolbar.tsx`)

**Layout Structure:**

```tsx
<div className="space-y-2">
  {/* Mobile header */}
  <div className="flex items-center justify-between lg:hidden">
    <h1 className="me-4 text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
    <Button size="sm">Add Task</Button>
  </div>

  {/* Desktop toolbar */}
  <div className="flex flex-col justify-between md:flex-row lg:items-center">
    <h1 className="me-4 hidden text-xl font-bold tracking-tight lg:flex lg:text-2xl">
      Tasks
    </h1>
    <div className="flex flex-1 flex-wrap items-center gap-2">
      {/* Search input */}
      <Input
        placeholder="Filter tasks..."
        value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
        onChange={(event) =>
          table.getColumn('title')?.setFilterValue(event.target.value)
        }
        className="h-8 w-[150px] lg:w-[250px]"
      />
      {/* Faceted filters */}
      <DataTableFacetedFilter
        column={table.getColumn('status')}
        title="Status"
        options={statuses}
      />
      <DataTableFacetedFilter
        column={table.getColumn('priority')}
        title="Priority"
        options={priorities}
      />
      {/* Reset button */}
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetColumnFilters()}
        >
          Reset <X />
        </Button>
      )}
    </div>
    {/* Desktop actions */}
    <div className="hidden items-center gap-2 lg:flex">
      <DataTableViewOptions table={table} />
      <Button size="sm">Add Task</Button>
    </div>
  </div>
</div>
```

---

### 4. DataTableFacetedFilter (`data-table-faceted-filter.tsx`)

**Props:**

```typescript
interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}
```

**Key Features:**

- Multi-select with checkboxes
- Shows count badges for selected items
- Displays faceted counts (how many items match each option)
- "Clear filters" action

**Trigger Button:**

```tsx
<Button variant="outline" size="sm" className="h-8 border-dashed">
  <PlusCircle />
  {title}
  {selectedValues?.size > 0 && (
    <>
      <Separator orientation="vertical" className="mx-2 h-4" />
      <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
        {selectedValues.size}
      </Badge>
      <div className="hidden gap-1 lg:flex">
        {selectedValues.size > 2 ? (
          <Badge variant="secondary">{selectedValues.size} selected</Badge>
        ) : (
          // Show individual badges
        )}
      </div>
    </>
  )}
</Button>
```

**Filter Item with Count:**

```tsx
<CommandItem onSelect={() => toggleSelection(option.value)}>
  <div
    className={cn(
      'flex size-4 items-center justify-center rounded-[4px] border',
      isSelected
        ? 'bg-primary border-primary text-primary-foreground'
        : 'border-input [&_svg]:invisible'
    )}
  >
    <Check className="text-primary-foreground size-3.5" />
  </div>
  {option.icon && <option.icon className="text-muted-foreground size-4" />}
  <span>{option.label}</span>
  <span className="text-muted-foreground ml-auto font-mono text-xs">
    {facets?.get(option.value)}
  </span>
</CommandItem>
```

---

### 5. DataTableColumnHeader (`data-table-column-header.tsx`)

**Sortable Header with Dropdown:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      className="data-[state=open]:bg-accent -ml-3 h-8"
    >
      <span>{title}</span>
      {getSortIcon(column.getIsSorted())}{' '}
      {/* ArrowUp | ArrowDown | ChevronsUpDown */}
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start">
    <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
      <ArrowUp /> Asc
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
      <ArrowDown /> Desc
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
      <EyeOff /> Hide
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### 6. DataTablePagination (`data-table-pagination.tsx`)

**Layout:**

```tsx
<div className="flex items-center justify-between px-2">
  {/* Selection count (desktop only) */}
  <div className="text-muted-foreground hidden flex-1 text-sm lg:inline">
    {table.getFilteredSelectedRowModel().rows.length} of{' '}
    {table.getFilteredRowModel().rows.length} row(s) selected.
  </div>

  <div className="flex items-center space-x-4 lg:space-x-8">
    {/* Rows per page selector */}
    <Select
      value={`${table.getState().pagination.pageSize}`}
      onValueChange={(value) => table.setPageSize(Number(value))}
    >
      {[10, 20, 25, 30, 40, 50].map((pageSize) => (
        <SelectItem key={pageSize} value={`${pageSize}`}>
          {pageSize}
        </SelectItem>
      ))}
    </Select>

    {/* Page indicator */}
    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
    </div>

    {/* Navigation buttons */}
    <div className="flex items-center space-x-2">
      <Button
        size="icon"
        variant="outline"
        className="hidden size-8 lg:flex"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.setPageIndex(0)}
      >
        <ChevronsLeft /> {/* First page */}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        <ChevronLeft /> {/* Previous */}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="size-8"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        <ChevronRight /> {/* Next */}
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="hidden size-8 lg:flex"
        disabled={!table.getCanNextPage()}
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
      >
        <ChevronsRight /> {/* Last page */}
      </Button>
    </div>
  </div>
</div>
```

---

### 7. DataTableRowActions (`data-table-row-actions.tsx`)

**Row Action Menu:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="data-[state=open]:bg-muted size-8"
    >
      <MoreHorizontal />
      <span className="sr-only">Open menu</span>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-[160px]">
    <DropdownMenuItem>Edit</DropdownMenuItem>
    <DropdownMenuItem>Make a copy</DropdownMenuItem>
    <DropdownMenuItem>Favorite</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Labels</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={task.label}>
          {labels.map((label) => (
            <DropdownMenuRadioItem key={label.value} value={label.value}>
              {label.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">
      Delete
      <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### 8. DataTableViewOptions (`data-table-view-options.tsx`)

**Column Visibility Toggle:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
      <Settings2 />
      View
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-[150px]">
    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
    <DropdownMenuSeparator />
    {table
      .getAllColumns()
      .filter(
        (column) => column.accessorFn !== undefined && column.getCanHide()
      )
      .map((column) => (
        <DropdownMenuCheckboxItem
          key={column.id}
          className="capitalize"
          checked={column.getIsVisible()}
          onCheckedChange={(value) => column.toggleVisibility(!!value)}
        >
          {column.id}
        </DropdownMenuCheckboxItem>
      ))}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Tailwind CSS Classes Reference

### Table Container Classes

| Element       | Classes                         | Purpose                      |
| ------------- | ------------------------------- | ---------------------------- |
| Container     | `flex flex-col gap-4`           | Vertical layout with spacing |
| Table wrapper | `rounded-md border`             | Rounded corners, border      |
| Table         | `w-full caption-bottom text-sm` | Full width, small text       |

### Table Structure Classes

| Element     | Classes                                                                                | Purpose                        |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------ |
| TableHeader | `[&_tr]:border-b`                                                                      | Bottom border on rows          |
| TableBody   | `[&_tr:last-child]:border-0`                                                           | No border on last row          |
| TableRow    | `hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors`          | Hover state, selection, border |
| TableHead   | `text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap` | Header styling                 |
| TableCell   | `p-2 align-middle whitespace-nowrap`                                                   | Cell padding, alignment        |

### Checkbox Alignment

```css
[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]
```

- Removes padding when checkbox present
- Slight vertical adjustment for visual alignment

### Responsive Patterns

| Pattern          | Classes                  | Behavior                   |
| ---------------- | ------------------------ | -------------------------- |
| Mobile only      | `lg:hidden`              | Hidden on large screens    |
| Desktop only     | `hidden lg:flex`         | Hidden until large screens |
| Responsive width | `w-[150px] lg:w-[250px]` | Wider on desktop           |
| Responsive gap   | `space-x-4 lg:space-x-8` | More space on desktop      |

### Interactive States

```tsx
// Dropdown trigger active state
className="data-[state=open]:bg-accent"

// Selected row state
data-state={row.getIsSelected() && 'selected'}

// Button hover with muted background
className="data-[state=open]:bg-muted"
```

### Color Tokens Used

| Token                     | Usage                            |
| ------------------------- | -------------------------------- |
| `text-muted-foreground`   | Secondary text, icons            |
| `bg-muted`                | Selected rows, hover states      |
| `bg-muted/50`             | Subtle backgrounds (50% opacity) |
| `bg-primary`              | Selected checkboxes              |
| `text-primary-foreground` | Text on primary background       |
| `border-input`            | Input/checkbox borders           |
| `bg-accent`               | Active dropdown triggers         |

---

## Feature Breakdown

### Sorting

**Configuration:**

- Enabled per column via `enableSorting: true` (default)
- Disabled for select and ID columns

**UI Indicators:**

- `ArrowUp` - Ascending
- `ArrowDown` - Descending
- `ChevronsUpDown` - Not sorted

### Filtering

**Text Search:**

- Filters `title` column
- Real-time filtering as user types

**Faceted Filters:**

- Multi-select for `status` and `priority`
- Shows count of matching items per option
- Custom `filterFn` for array matching:

```typescript
filterFn: (row, id, value) => value.includes(row.getValue(id));
```

### Pagination

**Configuration:**

- Default page size: 25 rows
- Available sizes: 10, 20, 25, 30, 40, 50
- First/Last page buttons on desktop only

### Row Selection

**Features:**

- Individual row selection via checkbox
- Select all (current page) via header checkbox
- Indeterminate state when some rows selected
- Selection count displayed in pagination

### Column Visibility

**Hideable Columns:**

- title, status, priority (have `accessorFn`)
- Not hideable: select, id, actions

---

## Usage Examples

### Basic Implementation

```tsx
// page.tsx
import { columns } from './components/columns';
import { DataTable } from './components/data-table';

export default async function TaskPage() {
  const tasks = await getTasks(); // Fetch your data
  return <DataTable columns={columns} data={tasks} />;
}
```

### Custom Column Definition

```tsx
// Add a new column
{
  accessorKey: 'assignee',
  header: ({ column }) => <DataTableColumnHeader column={column} title="Assignee" />,
  cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage src={row.original.assignee.avatar} />
        <AvatarFallback>{row.original.assignee.initials}</AvatarFallback>
      </Avatar>
      <span>{row.original.assignee.name}</span>
    </div>
  ),
}
```

### Add New Filter

```tsx
// In data-table-toolbar.tsx
{
  table.getColumn('assignee') && (
    <DataTableFacetedFilter
      column={table.getColumn('assignee')}
      title="Assignee"
      options={assignees} // From your data config
    />
  );
}
```

### Custom Row Action

```tsx
// In data-table-row-actions.tsx
<DropdownMenuItem onClick={() => handleArchive(task.id)}>
  <Archive className="mr-2 size-4" />
  Archive
</DropdownMenuItem>
```

---

## Dependencies

```json
{
  "@tanstack/react-table": "^8.x",
  "zod": "^3.x",
  "lucide-react": "^0.x",
  "@radix-ui/react-checkbox": "^1.x",
  "@radix-ui/react-dropdown-menu": "^2.x",
  "@radix-ui/react-popover": "^1.x",
  "@radix-ui/react-select": "^2.x",
  "cmdk": "^1.x"
}
```

---

## File Size Reference

| File                            | Lines | Purpose             |
| ------------------------------- | ----- | ------------------- |
| `data-table.tsx`                | 116   | Main container      |
| `columns.tsx`                   | 102   | Column definitions  |
| `data-table-faceted-filter.tsx` | 136   | Multi-select filter |
| `data-table-toolbar.tsx`        | 66    | Search + filters    |
| `data-table-pagination.tsx`     | 95    | Pagination controls |
| `data-table-column-header.tsx`  | 65    | Sortable headers    |
| `data-table-row-actions.tsx`    | 66    | Row menu            |
| `data-table-view-options.tsx`   | 46    | Column visibility   |

**Total: ~692 lines** for complete table system

---

_Documentation generated for template-frontend-rust Tasks Table System_
