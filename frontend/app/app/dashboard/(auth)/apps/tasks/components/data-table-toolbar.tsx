'use client';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { priorities, statuses } from '../data/data';

import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { DataTableViewOptions } from './data-table-view-options';

import type { Table } from '@tanstack/react-table';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between lg:hidden">
        <h1 className="me-4 text-xl font-bold tracking-tight lg:text-2xl">Tasks</h1>
        <Button size="sm">Add Task</Button>
      </div>
      <div className="flex flex-col justify-between md:flex-row lg:items-center">
        <h1 className="me-4 hidden text-xl font-bold tracking-tight lg:flex lg:text-2xl">Tasks</h1>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            className="h-8 w-[150px] lg:w-[250px]"
            onChange={(event) => table.getColumn('title')?.setFilterValue(event.target.value)}
            placeholder="Filter tasks..."
            value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          />
          {table.getColumn('status') && (
            <DataTableFacetedFilter
              column={table.getColumn('status')}
              options={statuses}
              title="Status"
            />
          )}
          {table.getColumn('priority') && (
            <DataTableFacetedFilter
              column={table.getColumn('priority')}
              options={priorities}
              title="Priority"
            />
          )}
          {isFiltered && (
            <Button onClick={() => table.resetColumnFilters()} size="sm" variant="ghost">
              Reset
              <X />
            </Button>
          )}
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <DataTableViewOptions table={table} />
          <Button size="sm">Add Task</Button>
        </div>
      </div>
    </div>
  );
}
