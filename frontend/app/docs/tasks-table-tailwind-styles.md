# Tasks Table - Tailwind CSS Style Guide

> Complete responsive Tailwind classes for data tables across all devices

## Breakpoint Reference

| Breakpoint | Min Width | Device        |
| ---------- | --------- | ------------- |
| (default)  | 0px       | Mobile        |
| `sm:`      | 640px     | Large Mobile  |
| `md:`      | 768px     | Tablet        |
| `lg:`      | 1024px    | Desktop       |
| `xl:`      | 1280px    | Large Desktop |
| `2xl:`     | 1536px    | Extra Large   |

---

## 1. Table Container

```tsx
{
  /* Main wrapper */
}
<div className="flex flex-col gap-4">
  {/* Toolbar */}
  {/* Table */}
  {/* Pagination */}
</div>;

{
  /* Table border wrapper */
}
<div className="rounded-md border">
  <Table />
</div>;
```

| Class           | Purpose                       |
| --------------- | ----------------------------- |
| `flex flex-col` | Vertical stack layout         |
| `gap-4`         | 16px spacing between sections |
| `rounded-md`    | 6px border radius             |
| `border`        | 1px border using theme color  |

---

## 2. Base Table Component

```tsx
{
  /* Table container - enables horizontal scroll on mobile */
}
<div className="relative w-full overflow-x-auto">
  <table className="w-full caption-bottom text-sm">...</table>
</div>;
```

| Class             | Purpose                                |
| ----------------- | -------------------------------------- |
| `relative`        | Positioning context                    |
| `w-full`          | Full width                             |
| `overflow-x-auto` | Horizontal scroll on overflow (mobile) |
| `caption-bottom`  | Caption below table                    |
| `text-sm`         | 14px font size                         |

---

## 3. Table Header

```tsx
<thead className="[&_tr]:border-b">
  <tr>
    <th className="text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
      ...
    </th>
  </tr>
</thead>
```

### TableHeader (`<thead>`)

| Class             | Purpose                         |
| ----------------- | ------------------------------- |
| `[&_tr]:border-b` | Bottom border on all child rows |

### TableHead (`<th>`)

| Class                                   | Purpose                            |
| --------------------------------------- | ---------------------------------- |
| `text-muted-foreground`                 | Muted text color                   |
| `h-10`                                  | 40px height                        |
| `px-2`                                  | 8px horizontal padding             |
| `text-left`                             | Left-aligned text                  |
| `align-middle`                          | Vertical center                    |
| `font-medium`                           | 500 font weight                    |
| `whitespace-nowrap`                     | Prevent text wrap                  |
| `[&:has([role=checkbox])]:pr-0`         | Remove right padding when checkbox |
| `[&>[role=checkbox]]:translate-y-[2px]` | Align checkbox vertically          |

---

## 4. Table Body

```tsx
<tbody className="[&_tr:last-child]:border-0">
  <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
    <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
      ...
    </td>
  </tr>
</tbody>
```

### TableBody (`<tbody>`)

| Class                        | Purpose               |
| ---------------------------- | --------------------- |
| `[&_tr:last-child]:border-0` | No border on last row |

### TableRow (`<tr>`)

| Class                            | Purpose                     |
| -------------------------------- | --------------------------- |
| `hover:bg-muted/50`              | 50% muted bg on hover       |
| `data-[state=selected]:bg-muted` | Full muted bg when selected |
| `border-b`                       | Bottom border               |
| `transition-colors`              | Smooth color transition     |

### TableCell (`<td>`)

| Class                                   | Purpose                            |
| --------------------------------------- | ---------------------------------- |
| `p-2`                                   | 8px padding all sides              |
| `align-middle`                          | Vertical center                    |
| `whitespace-nowrap`                     | Prevent text wrap                  |
| `[&:has([role=checkbox])]:pr-0`         | Remove right padding when checkbox |
| `[&>[role=checkbox]]:translate-y-[2px]` | Align checkbox vertically          |

---

## 5. Empty State

```tsx
<tr>
  <td colSpan={columns.length} className="h-24 text-center">
    No results.
  </td>
</tr>
```

| Class         | Purpose       |
| ------------- | ------------- |
| `h-24`        | 96px height   |
| `text-center` | Centered text |

---

## 6. Column Cells - Responsive Widths

### Task ID Column

```tsx
<div className="w-[80px]">{row.getValue('id')}</div>
```

### Title Column with Badge

```tsx
<div className="flex gap-2">
  <Badge variant="outline">{label}</Badge>
  <span className="max-w-[500px] truncate font-medium">{title}</span>
</div>
```

| Class           | Purpose              |
| --------------- | -------------------- |
| `flex gap-2`    | Flexbox with 8px gap |
| `max-w-[500px]` | Max width 500px      |
| `truncate`      | Ellipsis on overflow |
| `font-medium`   | 500 font weight      |

### Status/Priority Column with Icon

```tsx
<div className="flex w-[100px] items-center gap-2">
  <StatusIcon className="text-muted-foreground size-4" />
  <span>{status.label}</span>
</div>
```

| Class                   | Purpose             |
| ----------------------- | ------------------- |
| `flex`                  | Flexbox             |
| `w-[100px]`             | Fixed 100px width   |
| `items-center`          | Vertical center     |
| `gap-2`                 | 8px gap             |
| `text-muted-foreground` | Muted icon color    |
| `size-4`                | 16px width & height |

---

## 7. Toolbar - Full Responsive

```tsx
<div className="space-y-2">
  {/* Mobile Header */}
  <div className="flex items-center justify-between lg:hidden">
    <h1 className="me-4 text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
    <Button size="sm">Add Task</Button>
  </div>

  {/* Desktop Toolbar */}
  <div className="flex flex-col justify-between md:flex-row lg:items-center">
    {/* Desktop Title */}
    <h1 className="me-4 hidden text-xl font-bold tracking-tight lg:flex lg:text-2xl">
      Tasks
    </h1>

    {/* Filters */}
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <Input className="h-8 w-[150px] lg:w-[250px]" />
      {/* Filter buttons */}
    </div>

    {/* Desktop Actions */}
    <div className="hidden items-center gap-2 lg:flex">
      {/* View options + Add button */}
    </div>
  </div>
</div>
```

### Responsive Breakdown

| Element            | Mobile                | Tablet        | Desktop                    |
| ------------------ | --------------------- | ------------- | -------------------------- |
| Title + Add button | Visible (`lg:hidden`) | Visible       | Hidden                     |
| Desktop title      | Hidden                | Hidden        | Visible (`hidden lg:flex`) |
| Filter input       | `w-[150px]`           | `w-[150px]`   | `w-[250px]`                |
| View options       | Hidden                | Hidden        | Visible (`hidden lg:flex`) |
| Layout             | `flex-col`            | `md:flex-row` | `lg:items-center`          |

### Toolbar Classes

| Class                               | Purpose                          |
| ----------------------------------- | -------------------------------- |
| `space-y-2`                         | 8px vertical spacing             |
| `flex items-center justify-between` | Space between layout             |
| `lg:hidden`                         | Hide on desktop                  |
| `hidden lg:flex`                    | Show only on desktop             |
| `flex-col md:flex-row`              | Column on mobile, row on tablet+ |
| `flex-1 flex-wrap`                  | Fill space, wrap items           |
| `me-4`                              | 16px margin end (RTL safe)       |
| `text-xl lg:text-2xl`               | Responsive font size             |
| `font-bold tracking-tight`          | Bold, tight letter spacing       |

---

## 8. Search Input

```tsx
<Input placeholder="Filter tasks..." className="h-8 w-[150px] lg:w-[250px]" />
```

| Breakpoint    | Width |
| ------------- | ----- |
| Mobile        | 150px |
| Desktop (lg:) | 250px |

---

## 9. Filter Button (Faceted Filter Trigger)

```tsx
<Button variant="outline" size="sm" className="h-8 border-dashed">
  <PlusCircle />
  {title}
  {selectedValues?.size > 0 && (
    <>
      <Separator orientation="vertical" className="mx-2 h-4" />
      {/* Mobile: count badge */}
      <Badge
        variant="secondary"
        className="rounded-sm px-1 font-normal lg:hidden"
      >
        {selectedValues.size}
      </Badge>
      {/* Desktop: detailed badges */}
      <div className="hidden gap-1 lg:flex">
        <Badge variant="secondary" className="rounded-sm px-1 font-normal">
          {selectedValues.size > 2 ? `${selectedValues.size} selected` : label}
        </Badge>
      </div>
    </>
  )}
</Button>
```

| Class                  | Purpose                            |
| ---------------------- | ---------------------------------- |
| `h-8`                  | 32px height                        |
| `border-dashed`        | Dashed border style                |
| `mx-2 h-4`             | Separator: 8px margin, 16px height |
| `rounded-sm px-1`      | Badge: small radius, 4px padding   |
| `font-normal`          | Badge: 400 weight                  |
| `lg:hidden`            | Mobile badge only                  |
| `hidden lg:flex gap-1` | Desktop badges only                |

---

## 10. Filter Popover Content

```tsx
<PopoverContent align="start" className="w-[200px] p-0">
  <Command>
    <CommandInput placeholder={title} />
    <CommandList>
      <CommandItem>
        {/* Checkbox indicator */}
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
        {/* Icon */}
        <option.icon className="text-muted-foreground size-4" />
        {/* Label */}
        <span>{option.label}</span>
        {/* Count */}
        <span className="text-muted-foreground ml-auto flex size-4 items-center justify-center font-mono text-xs">
          {count}
        </span>
      </CommandItem>
    </CommandList>
  </Command>
</PopoverContent>
```

### Filter Checkbox Indicator

| State      | Classes                                                        |
| ---------- | -------------------------------------------------------------- |
| Container  | `flex size-4 items-center justify-center rounded-[4px] border` |
| Selected   | `bg-primary border-primary text-primary-foreground`            |
| Unselected | `border-input [&_svg]:invisible`                               |

### Count Badge

| Class                   | Purpose         |
| ----------------------- | --------------- |
| `text-muted-foreground` | Muted color     |
| `ml-auto`               | Push to right   |
| `size-4`                | 16px square     |
| `font-mono text-xs`     | Monospace, 12px |

---

## 11. Column Header (Sortable)

```tsx
<div className="flex items-center gap-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="data-[state=open]:bg-accent -ml-3 h-8"
      >
        <span>{title}</span>
        <SortIcon /> {/* ArrowUp | ArrowDown | ChevronsUpDown */}
      </Button>
    </DropdownMenuTrigger>
  </DropdownMenu>
</div>
```

| Class                         | Purpose                            |
| ----------------------------- | ---------------------------------- |
| `flex items-center gap-2`     | Flex layout                        |
| `-ml-3`                       | Negative margin to align with cell |
| `h-8`                         | 32px height                        |
| `data-[state=open]:bg-accent` | Accent bg when dropdown open       |

---

## 12. Pagination - Full Responsive

```tsx
<div className="flex items-center justify-between px-2">
  {/* Selection count - desktop only */}
  <div className="text-muted-foreground hidden flex-1 text-sm lg:inline">
    {selected} of {total} row(s) selected.
  </div>

  <div className="flex items-center space-x-4 lg:space-x-8">
    {/* Rows per page */}
    <div className="flex items-center space-x-2">
      <p className="hidden text-sm font-medium lg:inline">Rows per page</p>
      <Select>
        <SelectTrigger className="h-8 w-[70px]">
          <SelectValue />
        </SelectTrigger>
      </Select>
    </div>

    {/* Page indicator */}
    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
      Page {current} of {total}
    </div>

    {/* Navigation buttons */}
    <div className="flex items-center space-x-2">
      {/* First page - desktop only */}
      <Button size="icon" variant="outline" className="hidden size-8 lg:flex">
        <ChevronsLeft />
      </Button>
      {/* Previous - always visible */}
      <Button size="icon" variant="outline" className="size-8">
        <ChevronLeft />
      </Button>
      {/* Next - always visible */}
      <Button size="icon" variant="outline" className="size-8">
        <ChevronRight />
      </Button>
      {/* Last page - desktop only */}
      <Button size="icon" variant="outline" className="hidden size-8 lg:flex">
        <ChevronsRight />
      </Button>
    </div>
  </div>
</div>
```

### Pagination Responsive Table

| Element               | Mobile      | Desktop            |
| --------------------- | ----------- | ------------------ |
| Selection count       | Hidden      | `hidden lg:inline` |
| "Rows per page" label | Hidden      | `hidden lg:inline` |
| Page indicator        | Visible     | Visible            |
| First/Last buttons    | Hidden      | `hidden lg:flex`   |
| Prev/Next buttons     | Visible     | Visible            |
| Spacing               | `space-x-4` | `lg:space-x-8`     |

### Pagination Classes

| Class                    | Purpose                       |
| ------------------------ | ----------------------------- |
| `px-2`                   | 8px horizontal padding        |
| `flex-1`                 | Fill available space          |
| `space-x-4 lg:space-x-8` | Responsive horizontal spacing |
| `w-[70px]`               | Select trigger width          |
| `w-[100px]`              | Page indicator width          |
| `size-8`                 | 32px square buttons           |

---

## 13. Row Actions Button

```tsx
<Button
  variant="ghost"
  size="icon"
  className="data-[state=open]:bg-muted size-8"
>
  <MoreHorizontal />
  <span className="sr-only">Open menu</span>
</Button>
```

| Class                        | Purpose                 |
| ---------------------------- | ----------------------- |
| `size-8`                     | 32px square             |
| `data-[state=open]:bg-muted` | Muted bg when menu open |
| `sr-only`                    | Screen reader only text |

---

## 14. View Options Button (Desktop Only)

```tsx
<Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
  <Settings2 />
  View
</Button>
```

| Class            | Purpose       |
| ---------------- | ------------- |
| `ml-auto`        | Push to right |
| `hidden lg:flex` | Desktop only  |
| `h-8`            | 32px height   |

---

## 15. Complete Class Summary by Device

### Mobile (< 768px)

```css
/* Visible */
- Mobile header with title + Add button
- Search input (150px width)
- Filter buttons (count badge only)
- Prev/Next pagination buttons
- Horizontal scroll on table

/* Hidden */
- Desktop title
- View options button
- First/Last pagination buttons
- "Rows per page" label
- Selection count
```

### Tablet (768px - 1023px)

```css
/* Changes from mobile */
- Toolbar switches to flex-row (md:flex-row)
- Better horizontal spacing
```

### Desktop (1024px+)

```css
/* Visible */
- Desktop title
- Search input (250px width)
- Filter buttons (detailed badges)
- View options button
- All pagination buttons
- "Rows per page" label
- Selection count

/* Hidden */
- Mobile header
```

---

## 16. Copy-Paste Ready Classes

### Table Structure

```tsx
// Container
'flex flex-col gap-4';

// Table wrapper
'rounded-md border';

// Table
'relative w-full overflow-x-auto';
'w-full caption-bottom text-sm';

// Header
'[&_tr]:border-b';
'text-muted-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]';

// Body
'[&_tr:last-child]:border-0';
'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors';
'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]';
```

### Responsive Visibility

```tsx
// Mobile only
'lg:hidden';

// Desktop only
'hidden lg:flex';
'hidden lg:inline';

// Tablet+ row layout
'flex-col md:flex-row';
```

### Interactive States

```tsx
// Hover
'hover:bg-muted/50';

// Selected row
'data-[state=selected]:bg-muted';

// Dropdown open
'data-[state=open]:bg-accent';
'data-[state=open]:bg-muted';
```

### Spacing Responsive

```tsx
// Gap
'gap-2';
'gap-4';

// Space between
'space-x-2';
'space-x-4 lg:space-x-8';

// Margin
'me-4';
'mx-2';
'-ml-3';
'ml-auto';
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ CONTAINER      │ flex flex-col gap-4                    │
│ TABLE WRAPPER  │ rounded-md border                      │
│ TABLE          │ w-full overflow-x-auto                 │
├─────────────────────────────────────────────────────────┤
│ HEADER ROW     │ [&_tr]:border-b                        │
│ HEADER CELL    │ h-10 px-2 text-muted-foreground        │
│ BODY ROW       │ hover:bg-muted/50 border-b             │
│ BODY CELL      │ p-2 align-middle whitespace-nowrap     │
├─────────────────────────────────────────────────────────┤
│ MOBILE ONLY    │ lg:hidden                              │
│ DESKTOP ONLY   │ hidden lg:flex                         │
│ RESPONSIVE     │ flex-col md:flex-row                   │
├─────────────────────────────────────────────────────────┤
│ SELECTED       │ data-[state=selected]:bg-muted         │
│ HOVER          │ hover:bg-muted/50                      │
│ DROPDOWN OPEN  │ data-[state=open]:bg-accent            │
└─────────────────────────────────────────────────────────┘
```

---

_Tailwind CSS v3.4+ | Responsive Data Table Styles_
